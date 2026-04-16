// stripe-webhook — Handles Stripe webhook events.
// Verifies signature using STRIPE_WEBHOOK_SECRET + raw body.
// Handles checkout.session.completed: marks invoice paid.
// Handles checkout.session.expired: no-op (user abandoned).
// No auth check — Stripe calls this directly.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13?target=deno'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  const rateLimitResult = await checkRateLimit(req, 'stripe-webhook')
  if (!rateLimitResult.allowed) return rateLimitResponse(rateLimitResult)

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  // If Stripe is not yet configured, return 200 so Stripe doesn't retry
  if (!stripeSecretKey || !webhookSecret) {
    console.log('stripe-webhook: Stripe not configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to proceed.')
    return new Response(JSON.stringify({ received: true, status: 'not_configured' }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const body = await req.text()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } catch (verifyErr) {
      console.error('stripe-webhook: signature verification failed:', verifyErr)
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Log the event (best-effort — table may not exist)
    await supabase.from('stripe_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      payload: event,
      received_at: new Date().toISOString(),
      processed: false,
    }).catch(() => {
      console.log('stripe-webhook event received:', event.type, event.id)
    })

    // Route to handlers based on event type
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const invoiceId = session.metadata?.invoice_id
        if (invoiceId) {
          const { error: updateErr } = await supabase
            .from('invoices')
            .update({
              status: 'paid',
              stripe_payment_id: typeof session.payment_intent === 'string'
                ? session.payment_intent
                : (session.payment_intent as { id: string } | null)?.id ?? null,
              paid_at: new Date().toISOString(),
            })
            .eq('id', invoiceId)

          if (updateErr) {
            console.error('stripe-webhook: failed to update invoice:', updateErr.message)
          } else {
            console.log('stripe-webhook: invoice marked paid:', invoiceId)
          }

          // Mark webhook event as processed
          await supabase
            .from('stripe_webhook_events')
            .update({ processed: true })
            .eq('event_id', event.id)
            .catch(() => {})
        } else {
          console.warn('stripe-webhook: checkout.session.completed missing invoice_id in metadata')
        }
        break
      }

      case 'checkout.session.expired': {
        // No-op — user abandoned the checkout. Log it and move on.
        console.log('stripe-webhook: checkout session expired:', (event.data.object as { id: string }).id)
        break
      }

      default:
        console.log('Unhandled Stripe event type:', event.type)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('stripe-webhook error:', err)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
