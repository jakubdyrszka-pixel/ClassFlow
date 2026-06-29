'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAudit, logAuditTx } from '@/lib/services/audit.service'
import { QuickBookSchema, MarkPaymentSchema, CheckInSchema } from '@/lib/schemas/booking.schema'
import { z } from 'zod'
import { receptionistAction } from '@/lib/safe-action'
import { triggerPusherEvent } from '@/lib/pusher'
import { redis } from '@/lib/redis'

// ---- Search clients ----

export const searchClients = receptionistAction
  .schema(z.object({ query: z.string().min(2, "Za krótkie zapytanie") }))
  .action(async ({ parsedInput: { query } }) => {
    
    // Redis Cache logic - if it's a common search we could cache it, but user search is dynamic
    // Let's just fetch from DB
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          take: 1,
          orderBy: { purchasedAt: 'desc' },
        },
      },
    })
    return users
  })

// ---- Quick book on behalf of client ----

export const quickBook = receptionistAction
  .schema(QuickBookSchema)
  .action(async ({ parsedInput: { userId, classSessionId }, ctx: { actor } }) => {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.classSession.findUnique({
        where: { id: classSessionId },
        include: { bookings: { where: { status: 'CONFIRMED' } } },
      })
      if (!session) throw new Error('Sesja nie istnieje')

      const existing = await tx.booking.findUnique({
        where: { userId_classSessionId: { userId, classSessionId } },
      })
      if (existing?.status === 'CONFIRMED') throw new Error('Klient jest już zapisany na te zajęcia.')

      if (session.bookings.length < session.maxCapacity) {
        await tx.booking.upsert({
          where: { userId_classSessionId: { userId, classSessionId } },
          update: { status: 'CONFIRMED' },
          create: { userId, classSessionId, status: 'CONFIRMED' },
        })

        await logAuditTx(tx, {
          actorId: actor.id,
          actorRole: actor.roles[0],
          action: 'booking.receptionist_create',
          entityType: 'Booking',
          metadata: { targetUserId: userId, classSessionId },
        })

        return { message: 'Klient zapisany pomyślnie!', isWaitlist: false }
      } else {
        await tx.waitlist.create({ data: { userId, classSessionId } })

        await logAuditTx(tx, {
          actorId: actor.id,
          actorRole: actor.roles[0],
          action: 'waitlist.receptionist_add',
          entityType: 'Waitlist',
          metadata: { targetUserId: userId, classSessionId },
        })

        return { message: 'Brak miejsc. Klient dodany na listę rezerwową.', isWaitlist: true }
      }
    })

    // Aktualizacja cache po rezerwacji
    await redis.del(`capacity:${classSessionId}`)
    await triggerPusherEvent('studio-events', 'booking-updated', { message: 'Nowa rezerwacja recepcji' })
    revalidatePath('/')
    return result
  })

// ---- Mark payment paid ----

export const markPaymentPaid = receptionistAction
  .schema(MarkPaymentSchema)
  .action(async ({ parsedInput: { bookingId, hasPaid }, ctx: { actor } }) => {
    await prisma.booking.update({ where: { id: bookingId }, data: { hasPaid } })
    await logAudit({
      actorId: actor.id,
      actorRole: actor.roles[0],
      action: 'booking.payment_update',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { hasPaid },
    })

    await triggerPusherEvent('studio-events', 'booking-updated', { message: 'Zaktualizowano płatność' })
    revalidatePath('/')
    return { bookingId }
  })

// ---- Check in client ----

export const checkInClient = receptionistAction
  .schema(CheckInSchema)
  .action(async ({ parsedInput: { bookingId, checkedIn }, ctx: { actor } }) => {
    const booking = await prisma.booking.findUnique({ 
      where: { id: bookingId },
      include: { user: true, classSession: { include: { class: true } } }
    })
    if (!booking) throw new Error('Rezerwacja nie istnieje')

    if (checkedIn) {
      await prisma.attendance.upsert({
        where: { bookingId },
        update: {},
        create: { userId: booking.userId, classSessionId: booking.classSessionId, bookingId },
      })
      
      // Powiadom inne urządzenia na recepcji o wejściu!
      await triggerPusherEvent('studio-events', 'check-in-success', { 
        userName: `${booking.user.firstName} ${booking.user.lastName}`,
        className: booking.classSession.class.name 
      })
    } else {
      await prisma.attendance.deleteMany({ where: { bookingId } })
    }

    await logAudit({
      actorId: actor.id,
      actorRole: actor.roles[0],
      action: checkedIn ? 'attendance.check_in' : 'attendance.check_out',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { targetUserId: booking.userId, classSessionId: booking.classSessionId },
    })

    revalidatePath('/')
    return { bookingId }
  })

// ---- Promote from waitlist ----

export const promoteFromWaitlist = receptionistAction
  .schema(z.object({ waitlistId: z.string() }))
  .action(async ({ parsedInput: { waitlistId }, ctx: { actor } }) => {
    const waitlist = await prisma.waitlist.findUnique({
      where: { id: waitlistId },
      include: { classSession: true },
    })

    if (!waitlist) throw new Error('Wpis na liście rezerwowej nie istnieje')

    await prisma.$transaction(async (tx) => {
      await tx.waitlist.delete({ where: { id: waitlistId } })
      await tx.booking.upsert({
        where: { userId_classSessionId: { userId: waitlist.userId, classSessionId: waitlist.classSessionId } },
        update: { status: 'CONFIRMED' },
        create: { userId: waitlist.userId, classSessionId: waitlist.classSessionId, status: 'CONFIRMED' },
      })

      await logAuditTx(tx, {
        actorId: actor.id,
        actorRole: actor.roles[0],
        action: 'waitlist.receptionist_promote',
        entityType: 'Waitlist',
        entityId: waitlistId,
        metadata: { targetUserId: waitlist.userId, classSessionId: waitlist.classSessionId },
      })
    })

    await triggerPusherEvent('studio-events', 'booking-updated', { message: 'Awans z listy rezerwowej' })
    revalidatePath('/')
    return { message: 'Użytkownik został zapisany z listy rezerwowej!' }
  })

export const updateSessionInstructor = receptionistAction
  .schema(z.object({ sessionId: z.string(), instructorId: z.string() }))
  .action(async ({ parsedInput: { sessionId, instructorId } }) => {
    await prisma.classSession.update({
      where: { id: sessionId },
      data: { instructorId },
    })
    revalidatePath('/')
    return { success: true }
  })

export const removeFromWaitlist = receptionistAction
  .schema(z.object({ waitlistId: z.string() }))
  .action(async ({ parsedInput: { waitlistId } }) => {
    await prisma.waitlist.delete({
      where: { id: waitlistId },
    })
    revalidatePath('/')
    return { success: true }
  })

export const receptionistCancelBooking = receptionistAction
  .schema(z.object({ bookingId: z.string() }))
  .action(async ({ parsedInput: { bookingId } }) => {
    await prisma.booking.delete({
      where: { id: bookingId },
    })
    revalidatePath('/')
    return { success: true }
  })

export const createClientAccount = receptionistAction
  .schema(z.object({ email: z.string().email(), firstName: z.string(), lastName: z.string() }))
  .action(async ({ parsedInput: { email, firstName, lastName } }) => {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw new Error('Użytkownik z tym e-mailem już istnieje')
    const user = await prisma.user.create({
      data: {
        id: `usr_local_${Date.now()}`,
        email,
        firstName,
        lastName,
        clerkId: `clerk_local_${Date.now()}`
      }
    })
    return { message: 'Konto utworzone', userId: user.id }
  })
