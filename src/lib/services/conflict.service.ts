import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export type ConflictType = 'INSTRUCTOR_BUSY' | 'ROOM_OCCUPIED'

export type ConflictResult = {
  hasConflict: boolean
  conflicts: Array<{
    type: ConflictType
    sessionId: string
    className: string
    startTime: Date
    endTime: Date
  }>
}

/**
 * Checks for scheduling conflicts before creating or rescheduling a class session.
 * Detects:
 *  - Instructor assigned to overlapping sessions
 *  - Room occupied by overlapping sessions
 * 
 * @param excludeSessionId - Pass the existing session ID when rescheduling (to exclude itself)
 */
export async function detectConflicts(
  instructorId: string,
  roomId: string,
  startTime: Date,
  endTime: Date,
  excludeSessionId?: string
): Promise<ConflictResult> {
  const timeOverlap: Prisma.ClassSessionWhereInput = {
    isCancelled: false,
    AND: [
      { startTime: { lt: endTime } },
      { endTime: { gt: startTime } },
    ],
    ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
  }

  const [instructorConflicts, roomConflicts] = await Promise.all([
    prisma.classSession.findMany({
      where: { instructorId, ...timeOverlap },
      include: { class: true },
    }),
    prisma.classSession.findMany({
      where: { roomId, ...timeOverlap },
      include: { class: true },
    }),
  ])

  const conflicts: ConflictResult['conflicts'] = []

  for (const s of instructorConflicts) {
    conflicts.push({
      type: 'INSTRUCTOR_BUSY',
      sessionId: s.id,
      className: s.class.name,
      startTime: s.startTime,
      endTime: s.endTime,
    })
  }

  for (const s of roomConflicts) {
    // Avoid duplicates if the same session conflicts on both instructor + room
    if (!conflicts.find((c) => c.sessionId === s.id)) {
      conflicts.push({
        type: 'ROOM_OCCUPIED',
        sessionId: s.id,
        className: s.class.name,
        startTime: s.startTime,
        endTime: s.endTime,
      })
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  }
}
