import { getCurrentUser } from './get-current-user'

/**
 * Requires the current user to have a specific role.
 * Throws a typed error (403) if the requirement is not met.
 * 
 * Use in Server Actions and API Route Handlers — NOT just in Middleware.
 * 
 * @example
 * const user = await requireRole('ADMIN')
 * const user = await requireRole('ADMIN', 'RECEPTIONIST') // any of these roles
 */
export async function requireRole(...roles: string[]) {
  const user = await getCurrentUser()

  if (!user) {
    const err = new Error('Unauthorized: musisz być zalogowany.')
    ;(err as any).code = 'UNAUTHORIZED'
    ;(err as any).status = 401
    throw err
  }

  const hasRole = roles.some((role) => user.roles.includes(role))

  if (!hasRole) {
    const err = new Error(
      `Forbidden: wymagana rola ${roles.join(' lub ')}. Posiadasz: ${user.roles.join(', ') || 'brak'}.`
    )
    ;(err as any).code = 'FORBIDDEN'
    ;(err as any).status = 403
    throw err
  }

  return user
}

/**
 * Requires the current user to have a specific permission.
 * Throws a typed error (403) if the requirement is not met.
 * 
 * @example
 * const user = await requirePermission('create:classes')
 * const user = await requirePermission('view:analytics', 'manage:users') // any of these
 */
export async function requirePermission(...permissions: string[]) {
  const user = await getCurrentUser()

  if (!user) {
    const err = new Error('Unauthorized: musisz być zalogowany.')
    ;(err as any).code = 'UNAUTHORIZED'
    ;(err as any).status = 401
    throw err
  }

  const hasPermission = permissions.some((perm) => user.permissions.includes(perm))

  if (!hasPermission) {
    const err = new Error(
      `Forbidden: wymagane uprawnienie ${permissions.join(' lub ')}.`
    )
    ;(err as any).code = 'FORBIDDEN'
    ;(err as any).status = 403
    throw err
  }

  return user
}

/**
 * Returns whether the current user has a given role (non-throwing version).
 * Useful for conditional UI rendering on the server.
 */
export async function hasRole(...roles: string[]): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  return roles.some((role) => user.roles.includes(role))
}

/**
 * Returns whether the current user has a given permission (non-throwing version).
 */
export async function hasPermission(...permissions: string[]): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  return permissions.some((perm) => user.permissions.includes(perm))
}
