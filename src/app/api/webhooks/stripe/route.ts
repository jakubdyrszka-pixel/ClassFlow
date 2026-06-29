import { NextRequest, NextResponse } from 'next/server'
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe'
import { activateMembership } from '@/lib/services/membership.service'
import { logAudit } from '@/lib/services/audit.service'
import { prisma } from '@/lib/db'
import type Stripe from 'stripe'

// Stripe webhooks require raw body — disable body parsing
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const userId = session.metadata?.userId
        const planId = session.metadata?.planId

        if (!userId || !planId) {
          console.error('[Stripe Webhook] Missing metadata on checkout session:', session.id)
          break
        }

        if (session.payment_status !== 'paid') {
          console.warn('[Stripe Webhook] Session not paid yet:', session.id)
          break
        }

        await activateMembership({
          userId,
          planId,
          stripePaymentIntentId: session.payment_intent as string | undefined,
          stripeCustomerId: session.customer as string | undefined,
        })

        await logAudit({
          actorId: userId,
          actorRole: null,
          action: 'membership.activated',
          entityType: 'Membership',
          metadata: { planId, stripeSessionId: session.id },
        })

        console.log(`[Stripe Webhook] Membership activated for user ${userId}, plan ${planId}`)
        break
      }

      case 'customer.subscription.deleted': {
        // Handle subscription cancellation (for future subscription plans)
        const subscription = event.data.object as Stripe.Subscription

        const membership = await prisma.membership.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })

        if (membership) {
          await prisma.membership.update({
            where: { id: membership.id },
            data: { status: 'CANCELLED' },
          })

          await logAudit({
            actorId: membership.userId,
            actorRole: null,
            action: 'membership.cancelled',
            entityType: 'Membership',
            entityId: membership.id,
            metadata: { stripeSubscriptionId: subscription.id },
          })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.warn('[Stripe Webhook] Payment failed:', paymentIntent.id)

        await logAudit({
          action: 'payment.failed',
          metadata: {
            stripePaymentIntentId: paymentIntent.id,
            reason: paymentIntent.last_payment_error?.message,
          },
        })
        break
      }

      default:
        // Ignore unhandled event types
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err: any) {
    console.error('[Stripe Webhook] Handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
