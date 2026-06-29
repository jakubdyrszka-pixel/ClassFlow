import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bookSession, cancelBooking } from '../bookings'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth/require-role'
import { consumeEntry, refundEntry } from '@/lib/services/membership.service'
import { logAuditTx } from '@/lib/services/audit.service'
import { sendBookingConfirmation, sendBookingCancellation } from '@/lib/email'
import { revalidatePath } from 'next/cache'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    classSession: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    waitlist: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/auth/require-role', () => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/services/membership.service', () => ({
  consumeEntry: vi.fn(),
  refundEntry: vi.fn(),
}))

vi.mock('@/lib/services/audit.service', () => ({
  logAuditTx: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendBookingConfirmation: vi.fn(),
  sendBookingCancellation: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('bookings actions', () => {
  const mockUser = {
    id: 'user_1',
    roles: ['USER'],
    email: 'test@example.com',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue(mockUser as any)
    
    // Mock Prisma transaction to execute the callback synchronously
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return await callback(prisma)
    })
  })

  describe('bookSession', () => {
    it('should successfully book a session when spots are available', async () => {
      vi.mocked(prisma.classSession.findUnique).mockResolvedValue({
        id: 'session_1',
        isCancelled: false,
        startTime: new Date(Date.now() + 86400000), // future
        maxCapacity: 10,
        class: { name: 'Yoga' },
        bookings: [], // 0 bookings
      } as any)

      vi.mocked(prisma.booking.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.waitlist.findUnique).mockResolvedValue(null)
      
      vi.mocked(prisma.booking.upsert).mockResolvedValue({
        id: 'booking_1',
      } as any)

      const result = await bookSession('session_1')

      expect(result).toEqual({
        isSuccess: true,
        data: {
          status: 'booked',
          message: 'Zapisano pomyślnie!'
        }
      })
      expect(prisma.booking.upsert).toHaveBeenCalled()
      expect(consumeEntry).toHaveBeenCalledWith(prisma, mockUser.id, 'booking_1')
      expect(logAuditTx).toHaveBeenCalled()
      expect(sendBookingConfirmation).toHaveBeenCalledWith('test@example.com', 'Yoga', expect.any(Date))
    })

    it('should add to waitlist when no spots are available', async () => {
      vi.mocked(prisma.classSession.findUnique).mockResolvedValue({
        id: 'session_1',
        isCancelled: false,
        startTime: new Date(Date.now() + 86400000), // future
        maxCapacity: 1,
        class: { name: 'Yoga' },
        bookings: [{ id: 'other_booking' }], // 1 booking, full capacity
      } as any)

      vi.mocked(prisma.booking.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.waitlist.findUnique).mockResolvedValue(null)

      vi.mocked(prisma.waitlist.create).mockResolvedValue({
        id: 'waitlist_1',
      } as any)

      const result = await bookSession('session_1')

      expect(result).toEqual({
        isSuccess: true,
        data: {
          status: 'waitlist',
          message: 'Brak wolnych miejsc. Zostałeś(aś) dodany(a) do listy rezerwowej.'
        }
      })
      expect(prisma.waitlist.create).toHaveBeenCalled()
      expect(prisma.booking.upsert).not.toHaveBeenCalled()
    })
  })

  describe('cancelBooking', () => {
    it('should cancel booking and promote next person from waitlist', async () => {
      vi.mocked(prisma.booking.findUnique).mockResolvedValue({
        id: 'booking_1',
        status: 'CONFIRMED',
        classSession: {
          startTime: new Date(Date.now() + 86400000),
          class: { name: 'Yoga' }
        }
      } as any)

      vi.mocked(prisma.waitlist.findUnique).mockResolvedValue(null)
      
      vi.mocked(prisma.waitlist.findFirst).mockResolvedValue({
        id: 'waitlist_1',
        userId: 'user_2',
        user: { email: 'user2@example.com' }
      } as any)

      vi.mocked(prisma.booking.upsert).mockResolvedValue({
        id: 'booking_2',
      } as any)

      const result = await cancelBooking('session_1')

      expect(result).toEqual({
        isSuccess: true,
        data: {
          message: 'Rezerwacja anulowana pomyślnie.'
        }
      })
      
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking_1' },
        data: { status: 'CANCELLED' }
      })
      expect(refundEntry).toHaveBeenCalledWith(prisma, 'booking_1')
      
      // Waitlist promotion checks
      expect(prisma.waitlist.delete).toHaveBeenCalledWith({ where: { id: 'waitlist_1' } })
      expect(prisma.booking.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: { userId: 'user_2', classSessionId: 'session_1', status: 'CONFIRMED' }
      }))
      expect(consumeEntry).toHaveBeenCalledWith(prisma, 'user_2', 'booking_2')
      
      // Emails
      expect(sendBookingCancellation).toHaveBeenCalledWith('test@example.com', 'Yoga', expect.any(Date))
      expect(sendBookingConfirmation).toHaveBeenCalledWith('user2@example.com', 'Yoga', expect.any(Date))
    })
  })
})
