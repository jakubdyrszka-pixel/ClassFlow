import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { cache } from 'react'

export type CurrentUser = {
  id: string
  clerkId: string
  email: string
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
  roles: string[]
  permissions: string[]
}

/**
 * Retrieves the current authenticated user from the database (not from Clerk metadata).
 * Roles and permissions are fetched from PostgreSQL — Clerk only stores the session identity.
 * 
 * Uses React cache() to deduplicate calls within a single request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  })

  if (!user) return null

  const roles = user.roles.map((ur) => ur.role.name)
  const permissions = user.roles.flatMap((ur) =>
    ur.role.permissions.map((rp) => rp.permission.action)
  )

  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    roles,
    permissions: [...new Set(permissions)],
  }
})
