import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import InstructorDashboard from '@/components/InstructorDashboard'

export default async function InstructorRootPage() {
  const { userId: clerkId } = await auth()
  
  if (!clerkId) {
    redirect('/sign-in')
  }

  // Fetch user, roles, and instructor profile
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

  // 1. Jeśli użytkownik nie istnieje lub nie ma ról -> Onboarding
  if (!user || user.roles.length === 0) {
    redirect('/onboarding')
  }

  // 2. Weryfikacja uprawnień instruktora lub admina
  const isInstructor = user.roles.some((r) => r.role.name === 'INSTRUCTOR')
  const isAdmin = user.roles.some((r) => r.role.name === 'ADMIN')

  if (!isInstructor && !isAdmin) {
    redirect('/')
  }

  // Zabezpieczenie na wypadek braku rekordu instruktora mimo przypisanej roli
  if (!user.instructor) {
    redirect('/onboarding')
  }

  // Fetch all class sessions for this instructor (today + future)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const sessions = await prisma.classSession.findMany({
    where: {
      instructorId: user.instructor.id,
      startTime: {
        gte: todayStart,
      },
    },
    include: {
      class: true,
      room: true,
      bookings: {
        where: {
          status: 'CONFIRMED',
        },
        include: {
          user: true,
          attendance: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  })

  return (
    <InstructorDashboard
      instructor={{
        ...user.instructor,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
      }}
      sessions={sessions}
    />
  )
}
