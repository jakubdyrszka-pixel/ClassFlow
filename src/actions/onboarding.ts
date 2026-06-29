'use server'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export async function completeOnboarding(role: 'USER' | 'INSTRUCTOR') {
  const { userId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  try {
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(userId)

    // Ensure user exists in PostgreSQL
    let dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          imageUrl: clerkUser.imageUrl,
        },
      })
    }

    // Assign role in DB (Clerk metadata is NOT used for authorization — only clerkId matters)
    const dbRole = await prisma.role.findUnique({ where: { name: role } })

    if (dbUser && dbRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: dbUser.id, roleId: dbRole.id } },
        update: {},
        create: { userId: dbUser.id, roleId: dbRole.id },
      })

      if (role === 'INSTRUCTOR') {
        await prisma.instructor.upsert({
          where: { userId: dbUser.id },
          update: {},
          create: { userId: dbUser.id },
        })
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error in completeOnboarding:', error)
    return { error: error.message || 'Wystąpił błąd podczas rejestracji.' }
  }
}
