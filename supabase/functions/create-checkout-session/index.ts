// create-checkout-session — Creates a Stripe Checkout session for a given invoice.
// Called by client portal "Pay Now" button. Requires client role auth.
// Env: STRIPE_SECRET_KEY, STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13?target=deno'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  // Rate limit
  const rl = await checkRateLimit(req, 'create-checkout-session')
  if (!rl.allowed) return rateLimitResponse(rl)

  // Auth — must be a client (they are the one paying)
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  if (auth.role !== 'client' && auth.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden — client role required' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeSecretKey) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
      status: 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { invoice_id } = await req.json()
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id is required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Load invoice
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, title, total, balance_due, status, project_id')
      .eq('id', invoice_id)
      .single()

    if (invoiceErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (invoice.status === 'paid') {
      return new Response(JSON.stringify({ error: 'Invoice is already paid' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const amountCents = Math.round((invoice.balance_due ?? invoice.total ?? 0) * 100)
    if (amountCents <= 0) {
      return new Response(JSON.stringify({ error: 'Invoice has no balance due' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const successUrl = Deno.env.get('STRIPE_SUCCESS_URL') ?? 'https://akrenovationsopsapp.vercel.app/client/invoices?payment=success'
    const cancelUrl = Deno.env.get('STRIPE_CANCEL_URL') ?? 'https://akrenovationsopsapp.vercel.app/client/invoices?payment=cancelled'

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: invoice.title || `Invoice ${invoice.invoice_number}`,
              description: `Invoice #${invoice.invoice_number}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        project_id: invoice.project_id ?? '',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    // Store the checkout session ID on the invoice
    await supabase
      .from('invoices')
      .update({ stripe_checkout_id: session.id })
      .eq('id', invoice.id)

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('create-checkout-session error:', err)
    return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
