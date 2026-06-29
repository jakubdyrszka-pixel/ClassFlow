'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/require-role'
import { logAudit, logAuditTx } from '@/lib/services/audit.service'
import { actionError, actionSuccess, type ActionResult } from '@/lib/types/action-result'
import { sendClassCancellation } from '@/lib/email'

// Helper — get current instructor profile
async function getInstructorProfile(actor: Awaited<ReturnType<typeof requireRole>>) {
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    include: { instructor: true },
  })

  if (!user?.instructor) {
    throw new Error('Tylko instruktorzy mają dostęp do tych akcji.')
  }

  return user.instructor
}

// ---- Bulk check-in ----

export async function bulkCheckIn(classSessionId: string, bookingIdsToCheckIn: string[]): Promise<ActionResult<{ message: string }>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('INSTRUCTOR', 'ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  try {
    const instructor = await getInstructorProfile(actor)

    const session = await prisma.classSession.findFirst({
      where: { id: classSessionId, instructorId: instructor.id },
    })

    if (!session) return actionError('Nie masz uprawnień do edycji tej sesji.', 'FORBIDDEN')

    await prisma.$transaction(async (tx) => {
      const bookings = await tx.booking.findMany({
        where: { classSessionId, status: 'CONFIRMED' },
      })

      for (const booking of bookings) {
        const shouldCheckIn = bookingIdsToCheckIn.includes(booking.id)
        if (shouldCheckIn) {
          await tx.attendance.upsert({
            where: { bookingId: booking.id },
            update: {},
            create: { userId: booking.userId, classSessionId, bookingId: booking.id },
          })
        } else {
          await tx.attendance.deleteMany({ where: { bookingId: booking.id } })
        }
      }

      await logAuditTx(tx, {
        actorId: actor.id,
        actorRole: 'INSTRUCTOR',
        action: 'attendance.bulk_update',
        entityType: 'ClassSession',
        entityId: classSessionId,
        metadata: { checkedInCount: bookingIdsToCheckIn.length },
      })
    })

    revalidatePath('/')
    return actionSuccess({ message: 'Zaktualizowano obecność pomyślnie!' })
  } catch (err: any) {
    return actionError(err.message || 'Wystąpił błąd podczas zapisywania obecności.')
  }
}

// ---- Update session notes ----

export async function updateSessionNotes(classSessionId: string, notes: string): Promise<ActionResult<{ message: string }>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('INSTRUCTOR', 'ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  try {
    const instructor = await getInstructorProfile(actor)

    const session = await prisma.classSession.findFirst({
      where: { id: classSessionId, instructorId: instructor.id },
    })

    if (!session) return actionError('Nie masz uprawnień do edycji tej sesji.', 'FORBIDDEN')

    await prisma.classSession.update({ where: { id: classSessionId }, data: { notes } })

    await logAudit({
      actorId: actor.id,
      actorRole: 'INSTRUCTOR',
      action: 'session.notes_update',
      entityType: 'ClassSession',
      entityId: classSessionId,
    })

    revalidatePath('/')
    return actionSuccess({ message: 'Notatki zostały zapisane!' })
  } catch (err: any) {
    return actionError(err.message || 'Wystąpił błąd podczas zapisywania notatek.')
  }
}

// ---- Cancel session ----

export async function cancelSession(classSessionId: string): Promise<ActionResult<{ message: string }>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('INSTRUCTOR', 'ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  try {
    const instructor = await getInstructorProfile(actor)

    const session = await prisma.classSession.findFirst({
      where: { id: classSessionId, instructorId: instructor.id },
      include: {
        class: true,
        bookings: { where: { status: 'CONFIRMED' }, include: { user: true } },
      },
    })

    if (!session) return actionError('Nie masz uprawnień do odwołania tej sesji.', 'FORBIDDEN')

    const result = await prisma.$transaction(async (tx) => {
      await tx.classSession.update({ where: { id: classSessionId }, data: { isCancelled: true } })
      await tx.booking.updateMany({ where: { classSessionId, status: 'CONFIRMED' }, data: { status: 'CANCELLED' } })
      await tx.waitlist.deleteMany({ where: { classSessionId } })

      await logAuditTx(tx, {
        actorId: actor.id,
        actorRole: 'INSTRUCTOR',
        action: 'session.cancel',
        entityType: 'ClassSession',
        entityId: classSessionId,
        metadata: { className: session.class.name, startTime: session.startTime, affectedBookings: session.bookings.length },
      })

      return {
        success: true,
        sessionName: session.class.name,
        startTime: session.startTime,
        emails: session.bookings.map((b) => b.user.email),
      }
    })

    if (result.emails.length > 0) {
      for (const email of result.emails) {
        await sendClassCancellation(email, result.sessionName, result.startTime)
      }
    }

    revalidatePath('/')
    return actionSuccess({ message: 'Zajęcia zostały odwołane.' })
  } catch (err: any) {
    return actionError(err.message || 'Wystąpił błąd podczas odwoływania zajęć.')
  }
}

// ---- Send email to participants ----

export async function sendEmailToParticipants(classSessionId: string, subject: string, message: string): Promise<ActionResult<{ message: string }>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('INSTRUCTOR', 'ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  try {
    const instructor = await getInstructorProfile(actor)

    const session = await prisma.classSession.findFirst({
      where: { id: classSessionId, instructorId: instructor.id },
      include: { class: true, bookings: { where: { status: 'CONFIRMED' }, include: { user: true } } },
    })

    if (!session) return actionError('Sesja nie należy do Ciebie lub nie istnieje.', 'FORBIDDEN')

    const emails = session.bookings.map((b) => b.user.email)

    if (emails.length > 0) {
      const { sendClassAnnouncement } = await import('@/lib/email')
      for (const email of emails) {
        await sendClassAnnouncement(email, session.class.name, subject, message)
      }
    }

    await logAudit({
      actorId: actor.id,
      actorRole: 'INSTRUCTOR',
      action: 'session.announcement_sent',
      entityType: 'ClassSession',
      entityId: classSessionId,
      metadata: { subject, recipientCount: emails.length },
    })

    return actionSuccess({ message: `Wiadomość została wysłana do ${emails.length} uczestników!` })
  } catch (err: any) {
    return actionError(err.message || 'Błąd wysyłania wiadomości.')
  }
}
