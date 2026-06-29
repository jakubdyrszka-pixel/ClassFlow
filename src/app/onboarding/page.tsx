import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import OnboardingForm from '@/components/OnboardingForm'

export default async function OnboardingPage() {
  const { userId: clerkId } = await auth()
  
  if (!clerkId) {
    redirect('/sign-in')
  }

  // Sprawdź, czy użytkownik ma już przypisaną rolę w naszej bazie danych
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

  // Jeśli użytkownik ma już przypisaną rolę, przekieruj go odpowiednio
  if (user && user.roles.length > 0) {
    const isInstructor = user.roles.some((r) => r.role.name === 'INSTRUCTOR')
    redirect(isInstructor ? '/instructor' : '/')
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
      <OnboardingForm />
    </div>
  )
}
