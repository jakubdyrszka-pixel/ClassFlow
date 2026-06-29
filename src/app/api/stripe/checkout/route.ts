import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/auth/get-current-user'

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { planId } = body

    if (!planId) {
      return NextResponse.json({ error: 'Brak identyfikatora planu' }, { status: 400 })
    }

    const plan = await prisma.membershipPlan.findUnique({ where: { id: planId, isActive: true } })

    if (!plan) {
      return NextResponse.json({ error: 'Plan nie istnieje lub jest nieaktywny' }, { status: 404 })
    }

    // Create or retrieve Stripe customer
    let stripeCustomerId: string | undefined

    const existingMembership = await prisma.membership.findFirst({
      where: { userId: currentUser.id, stripeCustomerId: { not: null } },
      orderBy: { purchasedAt: 'desc' },
    })

    if (existingMembership?.stripeCustomerId) {
      stripeCustomerId = existingMembership.stripeCustomerId
    } else {
      const customer = await stripe.customers.create({
        email: currentUser.email,
        name: [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' '),
        metadata: { userId: currentUser.id },
      })
      stripeCustomerId = customer.id
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create Stripe Checkout Session (one-time payment for entry packs)
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: `Karnet ClassFlow — ${plan.name}`,
              description: plan.entriesTotal
                ? `${plan.entriesTotal} wejść`
                : 'Unlimited — nielimitowane wejścia',
            },
            unit_amount: plan.priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/membership`,
      metadata: {
        userId: currentUser.id,
        planId: plan.id,
      },
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err: any) {
    console.error('[Stripe Checkout] Error:', err)
    return NextResponse.json({ error: err.message || 'Stripe checkout failed' }, { status: 500 })
  }
}
