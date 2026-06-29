import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from 'next-safe-action'
import { requireRole } from '@/lib/auth/require-role'

// Bazowy klient nieautoryzowany
export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof Error) {
      return e.message
    }
    return DEFAULT_SERVER_ERROR_MESSAGE
  },
})

// Akcje wymagające autoryzacji jako RECEPCJONISTA lub ADMIN
export const receptionistAction = actionClient.use(async ({ next }) => {
  try {
    const actor = await requireRole('RECEPTIONIST', 'ADMIN')
    return next({ ctx: { actor } })
  } catch (error: any) {
    throw new Error(error.message || 'Brak uprawnień')
  }
})
