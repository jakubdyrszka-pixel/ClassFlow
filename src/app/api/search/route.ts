import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/get-current-user'

// GET /api/search?q=<query>&types=instructor,class,user,room&limit=5
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const typesParam = searchParams.get('types')
  const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 20)

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const types = typesParam ? typesParam.split(',') : ['instructor', 'class', 'user', 'room']

  const isAdmin = currentUser.roles.includes('ADMIN')
  const isReceptionist = currentUser.roles.includes('RECEPTIONIST')

  const [instructors, classes, users, rooms] = await Promise.all([
    types.includes('instructor')
      ? prisma.instructor.findMany({
          where: {
            user: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
          take: limit,
          include: { user: true },
        })
      : Promise.resolve([]),

    types.includes('class')
      ? prisma.class.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          include: { instructor: { include: { user: true } } },
        })
      : Promise.resolve([]),

    // Users only visible to ADMIN or RECEPTIONIST
    types.includes('user') && (isAdmin || isReceptionist)
      ? prisma.user.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          include: { roles: { include: { role: true } } },
        })
      : Promise.resolve([]),

    types.includes('room')
      ? prisma.room.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { location: { name: { contains: q, mode: 'insensitive' } } },
            ],
          },
          take: limit,
          include: { location: true },
        })
      : Promise.resolve([]),
  ])

  const results = {
    instructors: instructors.map((i) => ({
      id: i.id,
      type: 'instructor' as const,
      title: `${i.user.firstName} ${i.user.lastName}`,
      subtitle: i.user.email,
      imageUrl: i.user.imageUrl,
    })),
    classes: classes.map((c) => ({
      id: c.id,
      type: 'class' as const,
      title: c.name,
      subtitle: `${c.category || 'Zajęcia'} · ${c.instructor.user.firstName} ${c.instructor.user.lastName}`,
      imageUrl: null,
    })),
    users: (users as any[]).map((u) => ({
      id: u.id,
      type: 'user' as const,
      title: `${u.firstName} ${u.lastName}`,
      subtitle: u.email,
      imageUrl: u.imageUrl,
    })),
    rooms: rooms.map((r) => ({
      id: r.id,
      type: 'room' as const,
      title: r.name,
      subtitle: `${r.location.name} · ${r.capacity} miejsc`,
      imageUrl: null,
    })),
  }

  const totalCount = results.instructors.length + results.classes.length + results.users.length + results.rooms.length

  return NextResponse.json({ results, totalCount, query: q })
}
