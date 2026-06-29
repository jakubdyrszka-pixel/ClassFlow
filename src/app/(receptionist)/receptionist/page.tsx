import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import ReceptionistDashboard from '@/components/ReceptionistDashboard'

export default async function ReceptionistRootPage() {
  const { userId: clerkId } = await auth()
  
  if (!clerkId) {
    redirect('/sign-in')
  }

  // Fetch current user roles
  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
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

  const isReceptionistOrAdmin = user.roles.some(
    (ur) => ur.role.name === 'RECEPTIONIST' || ur.role.name === 'ADMIN'
  )

  if (!isReceptionistOrAdmin) {
    redirect('/')
  }

  // Fetch all instructors for swap options
  const instructors = await prisma.instructor.findMany({
    include: {
      user: true,
    },
  })

  // Fetch all class sessions for today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const sessions = await prisma.classSession.findMany({
    where: {
      startTime: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
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
        include: {
          user: true,
          attendance: true,
        },
      },
      waitlists: {
        include: {
          user: true,
        },
        orderBy: {
          joinedAt: 'asc',
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  })

  return <ReceptionistDashboard sessions={sessions} instructors={instructors} />
}
