'use server'

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { sendBookingConfirmation, sendBookingCancellation } from '@/lib/email'
import { requireRole } from '@/lib/auth/require-role'
import { logAuditTx, logAudit } from '@/lib/services/audit.service'
import { consumeEntry, refundEntry } from '@/lib/services/membership.service'
import { BookSessionSchema, CancelBookingSchema } from '@/lib/schemas/booking.schema'
import { actionError, actionSuccess, type ActionResult } from '@/lib/types/action-result'

// ---- Book a session ----

export async function bookSession(classSessionId: string): Promise<ActionResult<{ status: 'booked' | 'waitlist'; message: string }>> {
  const parsed = BookSessionSchema.safeParse({ classSessionId })
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')
  }

  let currentUser: Awaited<ReturnType<typeof requireRole>>
  try {
    currentUser = await requireRole('USER', 'INSTRUCTOR', 'RECEPTIONIST', 'ADMIN')
  } catch (err: any) {
    return actionError(err.message, err.code)
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.classSession.findUnique({
        where: { id: classSessionId },
        include: {
          class: true,
          bookings: { where: { status: 'CONFIRMED' } },
        },
      })

      if (!session) throw new Error('Sesja nie istnieje')
      if (session.isCancelled) throw new Error('Zajęcia zostały odwołane')
      if (new Date(session.startTime) < new Date()) {
        throw new Error('Nie można zapisać się na zajęcia, które już się odbyły.')
      }

      const existingBooking = await tx.booking.findUnique({
        where: { userId_classSessionId: { userId: currentUser.id, classSessionId } },
      })

      if (existingBooking?.status === 'CONFIRMED') {
        return { error: 'Jesteś już zapisany(a) na te zajęcia.' }
      }

      const existingWaitlist = await tx.waitlist.findUnique({
        where: { userId_classSessionId: { userId: currentUser.id, classSessionId } },
      })

      if (existingWaitlist) {
        return { error: 'Jesteś już na liście rezerwowej na te zajęcia.' }
      }

      const activeBookingsCount = session.bookings.length

      if (activeBookingsCount < session.maxCapacity) {
        const booking = await tx.booking.upsert({
          where: { userId_classSessionId: { userId: currentUser.id, classSessionId } },
          update: { status: 'CONFIRMED' },
          create: { userId: currentUser.id, classSessionId, status: 'CONFIRMED' },
        })

        // Consume a membership entry
        await consumeEntry(tx, currentUser.id, booking.id)

        await logAuditTx(tx, {
          actorId: currentUser.id,
          actorRole: currentUser.roles[0],
          action: 'booking.create',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: { classSessionId, className: session.class.name },
        })

        return {
          success: true,
          status: 'booked' as const,
          message: 'Zapisano pomyślnie!',
          emailData: { email: currentUser.email, className: session.class.name, startTime: session.startTime },
        }
      } else {
        const waitlist = await tx.waitlist.create({
          data: { userId: currentUser.id, classSessionId },
        })

        await logAuditTx(tx, {
          actorId: currentUser.id,
          actorRole: currentUser.roles[0],
          action: 'waitlist.join',
          entityType: 'Waitlist',
          entityId: waitlist.id,
          metadata: { classSessionId, className: session.class.name },
        })

        return {
          success: true,
          status: 'waitlist' as const,
          message: 'Brak wolnych miejsc. Zostałeś(aś) dodany(a) do listy rezerwowej.',
        }
      }
    })

    if ('error' in result) return actionError(result.error as string)

    if (result.success && result.status === 'booked' && result.emailData) {
      await sendBookingConfirmation(result.emailData.email!, result.emailData.className, result.emailData.startTime)
    }

    revalidatePath('/')
    return actionSuccess({ status: result.status, message: result.message })
  } catch (error: any) {
    console.error('Błąd zapisu na zajęcia:', error)
    return actionError(error.message || 'Wystąpił nieoczekiwany błąd.')
  }
}

// ---- Cancel a booking ----

export async function cancelBooking(classSessionId: string): Promise<ActionResult<{ message: string }>> {
  const parsed = CancelBookingSchema.safeParse({ classSessionId })
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')
  }

  let currentUser: Awaited<ReturnType<typeof requireRole>>
  try {
    currentUser = await requireRole('USER', 'INSTRUCTOR', 'RECEPTIONIST', 'ADMIN')
  } catch (err: any) {
    return actionError(err.message, err.code)
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { userId_classSessionId: { userId: currentUser.id, classSessionId } },
        include: { classSession: { include: { class: true } } },
      })

      const waitlist = await tx.waitlist.findUnique({
        where: { userId_classSessionId: { userId: currentUser.id, classSessionId } },
        include: { classSession: { include: { class: true } } },
      })

      if (!booking && !waitlist) {
        throw new Error('Nie znaleziono Twojego zapisu na te zajęcia')
      }

      // Cancel waitlist entry
      if (waitlist) {
        await tx.waitlist.delete({ where: { id: waitlist.id } })

        await logAuditTx(tx, {
          actorId: currentUser.id,
          actorRole: currentUser.roles[0],
          action: 'waitlist.leave',
          entityType: 'Waitlist',
          entityId: waitlist.id,
          metadata: { classSessionId },
        })

        return { success: true, message: 'Wypisano się z listy rezerwowej.' }
      }

      // Cancel confirmed booking
      if (booking && booking.status === 'CONFIRMED') {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED' },
        })

        // Refund membership entry
        await refundEntry(tx, booking.id)

        await logAuditTx(tx, {
          actorId: currentUser.id,
          actorRole: currentUser.roles[0],
          action: 'booking.cancel',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: { classSessionId, className: booking.classSession.class.name },
        })

        // Promote from waitlist
        const firstOnWaitlist = await tx.waitlist.findFirst({
          where: { classSessionId },
          orderBy: { joinedAt: 'asc' },
          include: { user: true },
        })

        let promotedUserEmail: string | null = null

        if (firstOnWaitlist) {
          await tx.waitlist.delete({ where: { id: firstOnWaitlist.id } })

          const promoted = await tx.booking.upsert({
            where: { userId_classSessionId: { userId: firstOnWaitlist.userId, classSessionId } },
            update: { status: 'CONFIRMED' },
            create: { userId: firstOnWaitlist.userId, classSessionId, status: 'CONFIRMED' },
          })

          // Consume entry for promoted user
          await consumeEntry(tx, firstOnWaitlist.userId, promoted.id)

          await logAuditTx(tx, {
            actorId: null,
            actorRole: null,
            action: 'booking.promote_from_waitlist',
            entityType: 'Booking',
            entityId: promoted.id,
            metadata: { classSessionId, promotedUserId: firstOnWaitlist.userId },
          })

          promotedUserEmail = firstOnWaitlist.user.email
        }

        return {
          success: true,
          message: 'Rezerwacja anulowana pomyślnie.',
          emailData: {
            email: currentUser.email,
            className: booking.classSession.class.name,
            startTime: booking.classSession.startTime,
          },
          promotedEmailData: promotedUserEmail
            ? { email: promotedUserEmail, className: booking.classSession.class.name, startTime: booking.classSession.startTime }
            : null,
        }
      }

      return { error: 'Rezerwacja była już anulowana.' }
    })

    if ('error' in result) return actionError(result.error as string)

    if (result.success && result.emailData) {
      await sendBookingCancellation(result.emailData.email!, result.emailData.className, result.emailData.startTime)
    }

    if (result.success && result.promotedEmailData) {
      await sendBookingConfirmation(result.promotedEmailData.email!, result.promotedEmailData.className, result.promotedEmailData.startTime)
    }

    revalidatePath('/')
    return actionSuccess({ message: result.message })
  } catch (error: any) {
    console.error('Błąd anulowania rezerwacji:', error)
    return actionError(error.message || 'Wystąpił błąd przy anulowaniu rezerwacji.')
  }
}
