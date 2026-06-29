'use server'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { actionError, actionSuccess, type ActionResult } from '@/lib/types/action-result'

export async function updateProfile(formData: { firstName: string; lastName: string }): Promise<ActionResult<{ message: string }>> {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return actionError('Nieautoryzowany dostęp.', 'UNAUTHORIZED')
  }

  try {
    const client = await clerkClient()
    await client.users.updateUser(clerkId, {
      firstName: formData.firstName,
      lastName: formData.lastName,
    })

    await prisma.user.update({
      where: { clerkId },
      data: {
        firstName: formData.firstName,
        lastName: formData.lastName,
      },
    })

    revalidatePath('/')
    return actionSuccess({ message: 'Profil zaktualizowany pomyślnie!' })
  } catch (error: any) {
    console.error('Błąd aktualizacji profilu:', error)
    return actionError(error.message || 'Wystąpił błąd podczas aktualizacji profilu.')
  }
}
