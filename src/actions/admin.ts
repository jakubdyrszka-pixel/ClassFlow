'use server'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { put } from '@vercel/blob'
import { RRule } from 'rrule'
import fs from 'fs'
import path from 'path'
import { requireRole } from '@/lib/auth/require-role'
import { logAudit, logAuditTx } from '@/lib/services/audit.service'
import { detectConflicts } from '@/lib/services/conflict.service'
import {
  CreateLocationSchema,
  CreateRoomSchema,
  CreateClassSchema,
  CreateSessionSchema,
  CreateRecurringSessionsSchema,
  UpdateUserRolesSchema,
  RescheduleSessionSchema,
} from '@/lib/schemas/class.schema'
import { actionError, actionSuccess, type ActionResult } from '@/lib/types/action-result'

// ---- LOCATIONS ----

export async function createLocation(data: { name: string; address?: string; city?: string; openingHours?: string }): Promise<ActionResult<any>> {
  const parsed = CreateLocationSchema.safeParse(data)
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')

  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  const loc = await prisma.location.create({ data: parsed.data })

  await logAudit({ actorId: actor.id, actorRole: 'ADMIN', action: 'location.create', entityType: 'Location', entityId: loc.id, metadata: { name: loc.name } })

  revalidatePath('/')
  return actionSuccess(loc)
}

export async function updateLocation(id: string, data: { name: string; address?: string; city?: string; openingHours?: string }): Promise<ActionResult<any>> {
  const parsed = CreateLocationSchema.safeParse(data)
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')

  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  const loc = await prisma.location.update({ where: { id }, data: parsed.data })

  await logAudit({ actorId: actor.id, actorRole: 'ADMIN', action: 'location.update', entityType: 'Location', entityId: id })

  revalidatePath('/')
  return actionSuccess(loc)
}

export async function deleteLocation(id: string): Promise<ActionResult<{ id: string }>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  await prisma.location.delete({ where: { id } })

  await logAudit({ actorId: actor.id, actorRole: 'ADMIN', action: 'location.delete', entityType: 'Location', entityId: id })

  revalidatePath('/')
  return actionSuccess({ id })
}

export async function createRoom(data: { locationId: string; name: string; capacity: number }): Promise<ActionResult<any>> {
  const parsed = CreateRoomSchema.safeParse(data)
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')

  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  const room = await prisma.room.create({ data: parsed.data })

  await logAudit({ actorId: actor.id, actorRole: 'ADMIN', action: 'room.create', entityType: 'Room', entityId: room.id, metadata: { name: room.name } })

  revalidatePath('/')
  return actionSuccess(room)
}

export async function updateRoom(id: string, data: { name: string; capacity: number }): Promise<ActionResult<any>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  const room = await prisma.room.update({ where: { id }, data })

  await logAudit({ actorId: actor.id, actorRole: 'ADMIN', action: 'room.update', entityType: 'Room', entityId: id })

  revalidatePath('/')
  return actionSuccess(room)
}

export async function deleteRoom(id: string): Promise<ActionResult<{ id: string }>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  await prisma.room.delete({ where: { id } })

  await logAudit({ actorId: actor.id, actorRole: 'ADMIN', action: 'room.delete', entityType: 'Room', entityId: id })

  revalidatePath('/')
  return actionSuccess({ id })
}

// ---- INSTRUCTORS ----

export async function createInstructor(data: {
  userId: string
  bio?: string
  imageFile?: { name: string; type: string; base64: string }
}): Promise<ActionResult<any>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  try {
    let imageUrl: string | null = null
    if (data.imageFile) imageUrl = await uploadImage(data.imageFile)

    const instructorRole = await prisma.role.findUnique({ where: { name: 'INSTRUCTOR' } })
    if (instructorRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: data.userId, roleId: instructorRole.id } },
        update: {},
        create: { userId: data.userId, roleId: instructorRole.id },
      })
    }

    if (imageUrl) {
      await prisma.user.update({ where: { id: data.userId }, data: { imageUrl } })
    }

    const instructor = await prisma.instructor.create({ data: { userId: data.userId, bio: data.bio } })

    await logAudit({ actorId: actor.id, actorRole: 'ADMIN', action: 'instructor.create', entityType: 'Instructor', entityId: instructor.id, metadata: { userId: data.userId } })

    revalidatePath('/')
    return actionSuccess(instructor)
  } catch (err: any) {
    return actionError(err.message || 'Błąd tworzenia instruktora.')
  }
}

export async function updateInstructor(id: string, data: { bio?: string; imageFile?: { name: string; type: string; base64: string } }): Promise<ActionResult<any>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  try {
    let imageUrl: string | null = null
    if (data.imageFile) imageUrl = await uploadImage(data.imageFile)

    const instructor = await prisma.instructor.findUnique({ where: { id } })
    if (!instructor) return actionError('Instruktor nie istnieje')

    if (imageUrl) await prisma.user.update({ where: { id: instructor.userId }, data: { imageUrl } })

    await prisma.instructor.update({ where: { id }, data: { bio: data.bio } })

    await logAudit({ actorId: actor.id, actorRole: 'ADMIN', action: 'instructor.update', entityType: 'Instructor', entityId: id })

    revalidatePath('/')
    return actionSuccess({ id })
  } catch (err: any) {
    return actionError(err.message || 'Błąd aktualizacji instruktora.')
  }
}

export async function deleteInstructor(id: string): Promise<ActionResult<{ id: string }>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  try {
    const instructor = await prisma.instructor.findUnique({ where: { id } })
    if (instructor) {
      const instructorRole = await prisma.role.findUnique({ where: { name: 'INSTRUCTOR' } })
      if (instructorRole) {
        await prisma.userRole.deleteMany({ where: { userId: instructor.userId, roleId: instructorRole.id } })
      }
      await prisma.instructor.delete({ where: { id } })
    }

    await logAudit({ actorId: actor.id, actorRole: 'ADMIN', action: 'instructor.delete', entityType: 'Instructor', entityId: id })

    revalidatePath('/')
    return actionSuccess({ id })
  } catch (err: any) {
    return actionError(err.message || 'Błąd usuwania instruktora.')
  }
}

// ---- CLASSES ----

export async function createClass(data: {
  instructorId: string
  name: string
  description?: string
  category?: string
  duration: number
}): Promise<ActionResult<any>> {
  const parsed = CreateClassSchema.safeParse(data)
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')

  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN', 'INSTRUCTOR') } catch (e: any) { return actionError(e.message, e.code) }

  const isAdmin = actor.roles.includes('ADMIN')
  const classData = { ...parsed.data }

  if (!isAdmin) {
    const userWithInstructor = await prisma.user.findUnique({ where: { id: actor.id }, include: { instructor: true } })
    classData.instructorId = userWithInstructor?.instructor?.id || ''
  }

  const cl = await prisma.class.create({ data: classData })

  await logAudit({ actorId: actor.id, actorRole: actor.roles[0], action: 'class.create', entityType: 'Class', entityId: cl.id, metadata: { name: cl.name } })

  revalidatePath('/')
  return actionSuccess(cl)
}

export async function updateClass(id: string, data: {
  instructorId: string
  name: string
  description?: string
  category?: string
  duration: number
}): Promise<ActionResult<any>> {
  const parsed = CreateClassSchema.safeParse(data)
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')

  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN', 'INSTRUCTOR') } catch (e: any) { return actionError(e.message, e.code) }

  const isAdmin = actor.roles.includes('ADMIN')
  const classData = { ...parsed.data }

  if (!isAdmin) {
    const userWithInstructor = await prisma.user.findUnique({ where: { id: actor.id }, include: { instructor: true } })
    const existingClass = await prisma.class.findUnique({ where: { id } })
    if (!existingClass || existingClass.instructorId !== userWithInstructor?.instructor?.id) {
      return actionError('Nie masz uprawnień do edycji tych zajęć.', 'FORBIDDEN')
    }
    classData.instructorId = userWithInstructor?.instructor?.id || ''
  }

  const cl = await prisma.class.update({ where: { id }, data: classData })

  await logAudit({ actorId: actor.id, actorRole: actor.roles[0], action: 'class.update', entityType: 'Class', entityId: id })

  revalidatePath('/')
  return actionSuccess(cl)
}

export async function deleteClass(id: string): Promise<ActionResult<{ id: string }>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN', 'INSTRUCTOR') } catch (e: any) { return actionError(e.message, e.code) }

  const isAdmin = actor.roles.includes('ADMIN')
  if (!isAdmin) {
    const userWithInstructor = await prisma.user.findUnique({ where: { id: actor.id }, include: { instructor: true } })
    const existingClass = await prisma.class.findUnique({ where: { id } })
    if (!existingClass || existingClass.instructorId !== userWithInstructor?.instructor?.id) {
      return actionError('Nie masz uprawnień do usunięcia tych zajęć.', 'FORBIDDEN')
    }
  }

  await prisma.class.delete({ where: { id } })

  await logAudit({ actorId: actor.id, actorRole: actor.roles[0], action: 'class.delete', entityType: 'Class', entityId: id })

  revalidatePath('/')
  return actionSuccess({ id })
}

// ---- SESSIONS ----

export async function createSession(data: {
  classId: string
  roomId: string
  instructorId: string
  startTime: Date
  endTime: Date
  maxCapacity: number
}): Promise<ActionResult<any>> {
  const parsed = CreateSessionSchema.safeParse(data)
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')

  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN', 'INSTRUCTOR') } catch (e: any) { return actionError(e.message, e.code) }

  const isAdmin = actor.roles.includes('ADMIN')
  const sessionData = { ...parsed.data }

  if (!isAdmin) {
    const userWithInstructor = await prisma.user.findUnique({ where: { id: actor.id }, include: { instructor: true } })
    sessionData.instructorId = userWithInstructor?.instructor?.id || ''
  }

  // Conflict detection
  const conflicts = await detectConflicts(sessionData.instructorId, sessionData.roomId, sessionData.startTime, sessionData.endTime)
  if (conflicts.hasConflict) {
    const descriptions = conflicts.conflicts.map((c) =>
      c.type === 'INSTRUCTOR_BUSY'
        ? `Instruktor jest zajęty (${c.className} ${c.startTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}–${c.endTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })})`
        : `Sala jest zajęta (${c.className} ${c.startTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}–${c.endTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })})`
    )
    return actionError(`Konflikt harmonogramu: ${descriptions.join('; ')}`, 'CONFLICT')
  }

  const session = await prisma.classSession.create({ data: sessionData })

  await logAudit({ actorId: actor.id, actorRole: actor.roles[0], action: 'session.create', entityType: 'ClassSession', entityId: session.id, metadata: { classId: session.classId, startTime: session.startTime } })

  revalidatePath('/')
  return actionSuccess(session)
}

export async function rescheduleSession(data: {
  sessionId: string
  newStartTime: Date
  newEndTime: Date
}): Promise<ActionResult<any>> {
  const parsed = RescheduleSessionSchema.safeParse(data)
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')

  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN', 'INSTRUCTOR') } catch (e: any) { return actionError(e.message, e.code) }

  try {
    const existing = await prisma.classSession.findUnique({ where: { id: parsed.data.sessionId } })
    if (!existing) return actionError('Sesja nie istnieje')

    const isAdmin = actor.roles.includes('ADMIN')
    if (!isAdmin) {
      const userWithInstructor = await prisma.user.findUnique({ where: { id: actor.id }, include: { instructor: true } })
      if (existing.instructorId !== userWithInstructor?.instructor?.id) {
        return actionError('Nie masz uprawnień do zmiany tej sesji.', 'FORBIDDEN')
      }
    }

    // Conflict detection (exclude the session being rescheduled)
    const conflicts = await detectConflicts(
      existing.instructorId,
      existing.roomId,
      parsed.data.newStartTime,
      parsed.data.newEndTime,
      parsed.data.sessionId
    )

    if (conflicts.hasConflict) {
      const descriptions = conflicts.conflicts.map((c) =>
        c.type === 'INSTRUCTOR_BUSY'
          ? `Instruktor jest zajęty (${c.className})`
          : `Sala jest zajęta (${c.className})`
      )
      return actionError(`Konflikt harmonogramu: ${descriptions.join('; ')}`, 'CONFLICT')
    }

    const updated = await prisma.classSession.update({
      where: { id: parsed.data.sessionId },
      data: { startTime: parsed.data.newStartTime, endTime: parsed.data.newEndTime },
    })

    await logAudit({
      actorId: actor.id,
      actorRole: actor.roles[0],
      action: 'session.reschedule',
      entityType: 'ClassSession',
      entityId: parsed.data.sessionId,
      metadata: {
        oldStart: existing.startTime,
        oldEnd: existing.endTime,
        newStart: parsed.data.newStartTime,
        newEnd: parsed.data.newEndTime,
      },
    })

    revalidatePath('/')
    return actionSuccess(updated)
  } catch (err: any) {
    return actionError(err.message || 'Błąd przesunięcia sesji.')
  }
}

export async function createRecurringSessions(data: {
  classId: string
  roomId: string
  instructorId: string
  startTime: string
  maxCapacity: number
  duration: number
  rruleString: string
}): Promise<ActionResult<{ count: number }>> {
  const parsed = CreateRecurringSessionsSchema.safeParse(data)
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')

  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN', 'INSTRUCTOR') } catch (e: any) { return actionError(e.message, e.code) }

  try {
    const start = new Date(parsed.data.startTime)
    const rule = RRule.fromString(`DTSTART:${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\nRRULE:${parsed.data.rruleString}`)
    const dates = rule.all()

    const sessionsData = dates.map((date) => {
      const sessionStart = new Date(date)
      const sessionEnd = new Date(sessionStart.getTime() + parsed.data.duration * 60000)
      return {
        classId: parsed.data.classId,
        roomId: parsed.data.roomId,
        instructorId: parsed.data.instructorId,
        startTime: sessionStart,
        endTime: sessionEnd,
        maxCapacity: parsed.data.maxCapacity,
      }
    })

    await prisma.classSession.createMany({ data: sessionsData })

    await logAudit({
      actorId: actor.id,
      actorRole: actor.roles[0],
      action: 'session.create_recurring',
      entityType: 'ClassSession',
      metadata: { count: sessionsData.length, classId: parsed.data.classId, rruleString: parsed.data.rruleString },
    })

    revalidatePath('/')
    return actionSuccess({ count: sessionsData.length })
  } catch (err: any) {
    return actionError(err.message || 'Błąd generowania cyklicznych sesji')
  }
}

export async function deleteSession(id: string): Promise<ActionResult<{ id: string }>> {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN', 'INSTRUCTOR') } catch (e: any) { return actionError(e.message, e.code) }

  const isAdmin = actor.roles.includes('ADMIN')
  if (!isAdmin) {
    const userWithInstructor = await prisma.user.findUnique({ where: { id: actor.id }, include: { instructor: true } })
    const existingSession = await prisma.classSession.findUnique({ where: { id } })
    if (!existingSession || existingSession.instructorId !== userWithInstructor?.instructor?.id) {
      return actionError('Nie masz uprawnień do usunięcia tej sesji.', 'FORBIDDEN')
    }
  }

  await prisma.classSession.delete({ where: { id } })

  await logAudit({ actorId: actor.id, actorRole: actor.roles[0], action: 'session.delete', entityType: 'ClassSession', entityId: id })

  revalidatePath('/')
  return actionSuccess({ id })
}

// ---- USER ROLES ----

export async function updateUserRoles(userId: string, roleNames: string[]): Promise<ActionResult<{ userId: string }>> {
  const parsed = UpdateUserRolesSchema.safeParse({ userId, roleNames })
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? parsed.error.message, 'VALIDATION_ERROR')

  let actor: Awaited<ReturnType<typeof requireRole>>
  try { actor = await requireRole('ADMIN') } catch (e: any) { return actionError(e.message, e.code) }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } })
      for (const name of parsed.data.roleNames) {
        const role = await tx.role.findUnique({ where: { name } })
        if (role) await tx.userRole.create({ data: { userId, roleId: role.id } })
      }
    })

    await logAudit({
      actorId: actor.id,
      actorRole: 'ADMIN',
      action: 'user.role_update',
      entityType: 'User',
      entityId: userId,
      metadata: { newRoles: roleNames },
    })

    revalidatePath('/')
    return actionSuccess({ userId })
  } catch (err: any) {
    return actionError(err.message || 'Błąd aktualizacji ról')
  }
}

// ---- IMAGE UPLOAD HELPER ----

async function uploadImage(fileData: { name: string; type: string; base64: string }): Promise<string> {
  const buffer = Buffer.from(fileData.base64, 'base64')

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(fileData.name, buffer, { contentType: fileData.type, access: 'public' })
    return blob.url
  } else {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    const fileName = `${Date.now()}-${fileData.name}`
    const filePath = path.join(uploadsDir, fileName)
    fs.writeFileSync(filePath, buffer)
    return `/uploads/${fileName}`
  }
}
