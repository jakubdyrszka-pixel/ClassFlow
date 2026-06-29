import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/get-current-user'

// GET /api/sessions?cursor=<id>&limit=20&category=<cat>&instructorId=<id>&from=<ISO>&to=<ISO>
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const category = searchParams.get('category') || undefined
  const instructorId = searchParams.get('instructorId') || undefined
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const from = fromParam ? new Date(fromParam) : new Date()
  const to = toParam ? new Date(toParam) : undefined

  const sessions = await prisma.classSession.findMany({
    where: {
      isCancelled: false,
      startTime: {
        gte: from,
        ...(to ? { lte: to } : {}),
      },
      ...(instructorId ? { instructorId } : {}),
      ...(category ? { class: { category } } : {}),
    },
    take: limit + 1, // fetch one extra to determine if there's a next page
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      class: true,
      room: { include: { location: true } },
      instructor: { include: { user: true } },
      _count: {
        select: {
          bookings: { where: { status: 'CONFIRMED' } },
          waitlists: true,
        },
      },
    },
    orderBy: { startTime: 'asc' },
  })

  // Determine next cursor
  let nextCursor: string | null = null
  if (sessions.length > limit) {
    const nextItem = sessions.pop()
    nextCursor = nextItem?.id || null
  }

  return NextResponse.json({ data: sessions, nextCursor })
}
