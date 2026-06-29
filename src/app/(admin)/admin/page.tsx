import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminRootPage() {
  const { userId: clerkId } = await auth()
  
  if (!clerkId) {
    redirect('/sign-in')
  }

  // Fetch current user and verify ADMIN/INSTRUCTOR role
  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      instructor: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
  })

  if (!user) {
    redirect('/onboarding')
  }

  const isAdmin = user.roles.some((ur) => ur.role.name === 'ADMIN')
  const isInstructor = user.roles.some((ur) => ur.role.name === 'INSTRUCTOR')
  
  if (!isAdmin && !isInstructor) {
    redirect('/')
  }

  const currentUserRole = isAdmin ? 'ADMIN' : 'INSTRUCTOR'

  // --- FETCH DATA FOR DASHBOARD ---

  // 1. Users list
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // 2. Classes list
  const classes = await prisma.class.findMany({
    include: {
      instructor: {
        include: {
          user: true,
        },
      },
    },
  })

  // 3. Instructors list
  const instructors = await prisma.instructor.findMany({
    include: {
      user: true,
    },
  })

  // 4. Locations & Rooms
  const locations = await prisma.location.findMany({
    include: {
      rooms: true,
    },
  })

  // 5. Scheduled Sessions
  const sessions = await prisma.classSession.findMany({
    include: {
      class: true,
      room: true,
      instructor: {
        include: {
          user: true,
        },
      },
      bookings: true,
    },
    orderBy: {
      startTime: 'desc',
    },
  })

  // 6. Audit logs
  const activityLogs = await prisma.auditLog.findMany({
    include: {
      actor: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  })

  // 7. Get all roles in system
  const roles = await prisma.role.findMany()
  const allRoles = roles.map((r) => r.name)

  // --- ANALYTICS CALCULATIONS ---
  const totalUsers = await prisma.user.count()
  
  const totalBookings = await prisma.booking.count({
    where: { status: 'CONFIRMED' },
  })

  const paidBookingsCount = await prisma.booking.count({
    where: { status: 'CONFIRMED', hasPaid: true },
  })
  const totalRevenue = paidBookingsCount * 50 // Est. 50 PLN per session

  // Occupancy rate calculation
  const activeSessions = await prisma.classSession.findMany({
    where: { isCancelled: false },
    include: {
      bookings: {
        where: { status: 'CONFIRMED' },
      },
    },
  })

  let totalCapacity = 0
  let totalConfirmedBookingsInActiveSessions = 0
  activeSessions.forEach((s) => {
    totalCapacity += s.maxCapacity
    totalConfirmedBookingsInActiveSessions += s.bookings.length
  })

  const occupancyRate = totalCapacity > 0
    ? Math.round((totalConfirmedBookingsInActiveSessions / totalCapacity) * 100)
    : 0

  // Revenue by Day (for charts)
  const paidBookings = await prisma.booking.findMany({
    where: { hasPaid: true, status: 'CONFIRMED' },
    include: {
      classSession: true,
    },
  })

  const revenueByDayMap: { [key: string]: number } = {}
  paidBookings.forEach((b) => {
    const day = new Date(b.classSession.startTime).toLocaleDateString('pl-PL', {
      month: 'short',
      day: 'numeric',
    })
    revenueByDayMap[day] = (revenueByDayMap[day] || 0) + 50
  })

  const revenueData = Object.keys(revenueByDayMap).map((day) => ({
    date: day,
    revenue: revenueByDayMap[day],
  })).slice(-10) // last 10 days

  // Class Popularity (for charts)
  const allConfirmedBookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED' },
    include: {
      classSession: {
        include: {
          class: true,
        },
      },
    },
  })

  const classBookingsCount: { [key: string]: number } = {}
  allConfirmedBookings.forEach((b) => {
    const className = b.classSession.class.name
    classBookingsCount[className] = (classBookingsCount[className] || 0) + 1
  })

  const popularityData = Object.keys(classBookingsCount).map((className) => ({
    name: className,
    bookings: classBookingsCount[className],
  })).sort((a, b) => b.bookings - a.bookings).slice(0, 5) // top 5 classes

  const currentInstructorId = user?.instructor?.id || null

  return (
    <AdminDashboard
      currentUserRole={currentUserRole}
      currentInstructorId={currentInstructorId}
      analytics={{
        stats: {
          totalUsers,
          totalBookings,
          totalRevenue,
          occupancyRate,
        },
        revenueHistory: revenueData,
        popularClasses: popularityData,
      }}
      users={users}
      roles={roles}
      classes={classes}
      instructors={instructors}
      locations={locations}
      sessions={sessions}
      activityLogs={activityLogs}
    />
  )
}
