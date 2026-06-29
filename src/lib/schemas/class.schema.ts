import { z } from 'zod'

export const CreateClassSchema = z.object({
  instructorId: z.string().uuid('Nieprawidłowy identyfikator instruktora'),
  name: z.string().min(2, 'Nazwa zajęć musi mieć co najmniej 2 znaki').max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  duration: z.number().int().min(15, 'Minimalna długość zajęć to 15 minut').max(480),
})

export const UpdateClassSchema = CreateClassSchema

export const CreateSessionSchema = z.object({
  classId: z.string().uuid(),
  roomId: z.string().uuid(),
  instructorId: z.string().uuid(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  maxCapacity: z.number().int().min(1).max(1000),
}).refine((data) => data.endTime > data.startTime, {
  message: 'Czas zakończenia musi być późniejszy niż czas rozpoczęcia',
  path: ['endTime'],
})

export const RescheduleSessionSchema = z.object({
  sessionId: z.string().uuid(),
  newStartTime: z.coerce.date(),
  newEndTime: z.coerce.date(),
}).refine((data) => data.newEndTime > data.newStartTime, {
  message: 'Czas zakończenia musi być późniejszy niż czas rozpoczęcia',
  path: ['newEndTime'],
})

export const CreateRecurringSessionsSchema = z.object({
  classId: z.string().uuid(),
  roomId: z.string().uuid(),
  instructorId: z.string().uuid(),
  startTime: z.string().datetime(),
  maxCapacity: z.number().int().min(1).max(1000),
  duration: z.number().int().min(15).max(480),
  rruleString: z.string().min(1, 'Podaj regułę RRule'),
})

export const UpdateUserRolesSchema = z.object({
  userId: z.string().uuid(),
  roleNames: z.array(z.enum(['ADMIN', 'INSTRUCTOR', 'RECEPTIONIST', 'USER'])).min(1),
})

export const CreateLocationSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  openingHours: z.string().max(50).optional(),
})

export const CreateRoomSchema = z.object({
  locationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  capacity: z.number().int().min(1).max(10000),
})

export type CreateClassInput = z.infer<typeof CreateClassSchema>
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>
export type RescheduleSessionInput = z.infer<typeof RescheduleSessionSchema>
export type CreateRecurringSessionsInput = z.infer<typeof CreateRecurringSessionsSchema>
export type UpdateUserRolesInput = z.infer<typeof UpdateUserRolesSchema>
export type CreateLocationInput = z.infer<typeof CreateLocationSchema>
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>
