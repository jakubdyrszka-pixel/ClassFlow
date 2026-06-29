import { z } from 'zod'

export const BookSessionSchema = z.object({
  classSessionId: z.string().uuid('Nieprawidłowy identyfikator sesji'),
})

export const CancelBookingSchema = z.object({
  classSessionId: z.string().uuid('Nieprawidłowy identyfikator sesji'),
})

export const QuickBookSchema = z.object({
  userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika'),
  classSessionId: z.string().uuid('Nieprawidłowy identyfikator sesji'),
})

export const MarkPaymentSchema = z.object({
  bookingId: z.string().uuid('Nieprawidłowy identyfikator rezerwacji'),
  hasPaid: z.boolean(),
})

export const CheckInSchema = z.object({
  bookingId: z.string().uuid('Nieprawidłowy identyfikator rezerwacji'),
  checkedIn: z.boolean(),
})

export type BookSessionInput = z.infer<typeof BookSessionSchema>
export type CancelBookingInput = z.infer<typeof CancelBookingSchema>
export type QuickBookInput = z.infer<typeof QuickBookSchema>
export type MarkPaymentInput = z.infer<typeof MarkPaymentSchema>
export type CheckInInput = z.infer<typeof CheckInSchema>
