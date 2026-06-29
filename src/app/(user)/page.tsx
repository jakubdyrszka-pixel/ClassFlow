import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import UserDashboard from '@/components/UserDashboard'

interface PageProps {
  searchParams: Promise<{
    category?: string
    instructor?: string
    date?: string
    onlyAvailable?: string
  }>
}

export default async function UserRootPage({ searchParams }: PageProps) {
  const { userId: clerkId } = await auth()
  
  if (!clerkId) {
    redirect('/sign-in')
  }

  // Await search params in Next.js 15
  const resolvedSearchParams = await searchParams
  const category = resolvedSearchParams.category
  const instructor = resolvedSearchParams.instructor
  const date = resolvedSearchParams.date
  const onlyAvailable = resolvedSearchParams.onlyAvailable === 'true'

  // Fetch current user from DB
  const currentUser = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      roles: {
        include: {
          role: true,
        }
      },
      bookings: {
        include: {
          classSession: {
            include: {
              class: true,
              room: {
                include: {
                  location: true,
                }
              },
            }
          }
        }
      },
      waitlists: true,
    },
  })

  // 1. Jeśli użytkownik nie istnieje w DB lub nie ma roli -> Onboarding
  if (!currentUser || currentUser.roles.length === 0) {
    redirect('/onboarding')
  }

  // 2. Jeśli użytkownik ma rolę instruktora (a nie jest adminem), przekieruj go do panelu instruktora
  const hasUserRole = currentUser.roles.some((r) => r.role.name === 'USER')
  const hasAdminRole = currentUser.roles.some((r) => r.role.name === 'ADMIN')
  
  if (!hasUserRole && !hasAdminRole) {
    const hasInstructorRole = currentUser.roles.some((r) => r.role.name === 'INSTRUCTOR')
    if (hasInstructorRole) {
      redirect('/instructor')
    }
  }

  // Fetch instructors for the filter dropdown
  const dbInstructors = await prisma.instructor.findMany({
    include: {
      user: true,
    },
  })

  // Fetch all unique categories from the classes
  const classesWithCategories = await prisma.class.findMany({
    select: { category: true },
    distinct: ['category'],
  })
  const categories = classesWithCategories
    .map((c) => c.category)
    .filter((cat): cat is string => !!cat)

  // Build where clause for sessions
  const whereClause: any = {
    isCancelled: false,
  }

  if (category) {
    whereClause.class = {
      category: category,
    }
  }

  if (instructor) {
    whereClause.instructorId = instructor
  }

  if (date) {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    whereClause.startTime = {
      gte: startOfDay,
      lte: endOfDay,
    }
  } else {
    // By default, only show future sessions
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    whereClause.startTime = {
      gte: todayStart,
    }
  }

  // Fetch sessions
  let sessions = await prisma.classSession.findMany({
    where: whereClause,
    include: {
      class: true,
      room: {
        include: {
          location: true,
        },
      },
      instructor: {
        include: {
          user: true,
        },
      },
      bookings: {
        where: {
          status: 'CONFIRMED',
        },
      },
      waitlists: true,
    },
    orderBy: {
      startTime: 'asc',
    },
  })

  // Client-side / In-memory filtering for availability (limit places)
  if (onlyAvailable) {
    sessions = sessions.filter((s) => s.bookings.length < s.maxCapacity)
  }

  return (
    <UserDashboard
      sessions={sessions}
      categories={categories}
      instructors={dbInstructors}
      currentUser={currentUser}
      filters={{
        category,
        instructor,
        date,
        onlyAvailable,
      }}
    />
  )
}
