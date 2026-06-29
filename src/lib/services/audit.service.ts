import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

// ---- Types ----

type AuditLogInput = {
  actorId?: string | null
  actorRole?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
  userAgent?: string | null
}

/**
 * Writes an entry to the AuditLog table.
 * Should be called from every Server Action and API Route that mutates data.
 * 
 * @example
 * await logAudit({
 *   actorId: user.id,
 *   actorRole: 'RECEPTIONIST',
 *   action: 'booking.cancel',
 *   entityType: 'Booking',
 *   entityId: bookingId,
 *   metadata: { reason: 'receptionist_action', sessionId: classSessionId }
 * })
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  } catch (err) {
    // Audit log failure should never break the main flow
    console.error('[AuditLog] Failed to write audit log:', err)
  }
}

/**
 * Convenience wrapper for a Prisma transaction context.
 * Use when you need to write the audit log within the same transaction.
 */
export async function logAuditTx(
  tx: Prisma.TransactionClient,
  input: AuditLogInput
): Promise<void> {
  try {
    await tx.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log in transaction:', err)
  }
}
