import { prisma } from '@/lib/db'
import { MembershipStatus, Prisma } from '@prisma/client'

/**
 * Retrieves the currently active membership for a user.
 * Returns null if no active membership exists.
 */
export async function getActiveMembership(userId: string) {
  return prisma.membership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      OR: [
        { currentPeriodEnd: null },
        { currentPeriodEnd: { gte: new Date() } },
      ],
    },
    include: { plan: true },
    orderBy: { purchasedAt: 'desc' },
  })
}

/**
 * Consumes one entry from the user's active membership.
 * Must be called within a Prisma transaction when paired with booking creation.
 * 
 * @returns the updated membership or null if unlimited / no active membership
 * @throws if no active membership or no entries remaining
 */
export async function consumeEntry(
  tx: Prisma.TransactionClient,
  userId: string,
  bookingId: string
): Promise<void> {
  const membership = await tx.membership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      OR: [
        { currentPeriodEnd: null },
        { currentPeriodEnd: { gte: new Date() } },
      ],
    },
    include: { plan: true },
    orderBy: { purchasedAt: 'desc' },
  })

  if (!membership) {
    throw new Error('Brak aktywnego karnetu. Kup karnet, aby zarezerwować zajęcia.')
  }

  // Unlimited plan — just log the entry, don't decrement
  if (membership.entriesRemaining === null) {
    await tx.membershipEntry.create({
      data: { membershipId: membership.id, bookingId, usedAt: new Date() },
    })
    return
  }

  if (membership.entriesRemaining <= 0) {
    throw new Error('Karnet wyczerpany. Kup nowy karnet, aby zarezerwować zajęcia.')
  }

  await tx.membership.update({
    where: { id: membership.id },
    data: { entriesRemaining: { decrement: 1 } },
  })

  await tx.membershipEntry.create({
    data: { membershipId: membership.id, bookingId, usedAt: new Date() },
  })
}

/**
 * Refunds one entry back to the user's membership when a booking is cancelled.
 * Only refunds if the membership is still active.
 */
export async function refundEntry(
  tx: Prisma.TransactionClient,
  bookingId: string
): Promise<void> {
  const entry = await tx.membershipEntry.findUnique({
    where: { bookingId },
    include: { membership: { include: { plan: true } } },
  })

  if (!entry) return // no entry to refund

  if (entry.membership.status !== MembershipStatus.ACTIVE) return

  // Delete the entry record
  await tx.membershipEntry.delete({ where: { id: entry.id } })

  // If limited plan, restore the entry count
  if (entry.membership.entriesRemaining !== null) {
    await tx.membership.update({
      where: { id: entry.membershipId },
      data: { entriesRemaining: { increment: 1 } },
    })
  }
}

/**
 * Activates a membership after successful Stripe payment.
 * Called from the Stripe webhook handler.
 */
export async function activateMembership(data: {
  userId: string
  planId: string
  stripePaymentIntentId?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  currentPeriodEnd?: Date
}): Promise<void> {
  const plan = await prisma.membershipPlan.findUnique({ where: { id: data.planId } })
  if (!plan) throw new Error('Plan nie istnieje')

  await prisma.membership.create({
    data: {
      userId: data.userId,
      planId: data.planId,
      entriesRemaining: plan.entriesTotal ?? null,
      status: MembershipStatus.ACTIVE,
      stripePaymentIntentId: data.stripePaymentIntentId,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      currentPeriodEnd: data.currentPeriodEnd,
    },
  })
}
