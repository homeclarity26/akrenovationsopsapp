import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13?target=deno';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';
import { getCorsHeaders } from '../_shared/cors.ts'

// Stripe webhook handler
// This function receives webhook events from Stripe and routes them to the
// appropriate handlers. It verifies the webhook signature before processing.
//
// Required Supabase secrets:
// - STRIPE_SECRET_KEY: Your Stripe secret key
// - STRIPE_WEBHOOK_SECRET: From Stripe Dashboard → Webhooks → signing secret
//
// To activate: Add both secrets in Supabase dashboard, then set up the webhook
// endpoint in Stripe Dashboard pointing to this function's URL:
//   https://mebzqfeeiciayxdetteb.supabase.co/functions/v1/stripe-webhook
//
// STATUS: STUB — ready to activate when Stripe is configured.


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const rateLimitResult = await checkRateLimit(req, 'stripe-webhook');
  if (!rateLimitResult.allowed) return rateLimitResponse(rateLimitResult);

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  // If Stripe is not yet configured, log and return 200
  // (Stripe retries on non-200 responses, which would fill the error log)
  if (!stripeSecretKey || !webhookSecret) {
    console.log('stripe-webhook: Stripe not configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to proceed.');
    return new Response(JSON.stringify({ received: true, status: 'not_configured' }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const body = await req.text();

  // Log the webhook event to the database for debugging
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (verifyErr) {
      console.error('stripe-webhook: signature verification failed:', verifyErr);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    // Log the event
    await supabase.from('stripe_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      payload: event,
      received_at: new Date().toISOString(),
      processed: false,
    }).catch(() => {
      // Table may not exist yet — log to console
      console.log('stripe-webhook event received:', event.type, event.id);
    });

    const eventObject = event.data.object as Record<string, unknown>;

    // Route to handlers based on event type
    switch (event.type) {
      case 'payment_intent.succeeded':
        // TODO: Mark invoice as paid, send receipt
        console.log('Payment succeeded:', eventObject.id);
        break;

      case 'payment_intent.payment_failed':
        // TODO: Notify admin of failed payment
        console.log('Payment failed:', eventObject.id);
        break;

      case 'invoice.paid':
        // TODO: Update invoice status in AK Ops
        console.log('Invoice paid:', eventObject.id);
        break;

      default:
        console.log('Unhandled Stripe event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('stripe-webhook error:', err);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
