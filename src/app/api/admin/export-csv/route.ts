import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check admin role
  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { roles: { include: { role: true } } },
  })

  const isAdmin = user?.roles.some((ur) => ur.role.name === 'ADMIN')
  if (!isAdmin) {
    return new Response('Forbidden', { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'users', 'bookings', 'classes'

  let csvContent = ''
  let filename = 'export.csv'

  if (type === 'users') {
    filename = 'uzytkownicy.csv'
    const users = await prisma.user.findMany({
      include: { roles: { include: { role: true } } },
    })

    // Header
    csvContent = 'ID,Imię,Nazwisko,E-mail,Role,Data rejestracji\n'
    
    // Rows
    users.forEach((u) => {
      const rolesStr = u.roles.map((r) => r.role.name).join(';')
      csvContent += `"${u.id}","${u.firstName || ''}","${u.lastName || ''}","${u.email}","${rolesStr}","${u.createdAt.toISOString()}"\n`
    })
  } else if (type === 'bookings') {
    filename = 'rezerwacje.csv'
    const bookings = await prisma.booking.findMany({
      include: {
        user: true,
        classSession: {
          include: {
            class: true,
          },
        },
      },
    })

    csvContent = 'ID rezerwacji,Klient,E-mail klienta,Nazwa zajęć,Data zajęć,Płatność,Status\n'
    bookings.forEach((b) => {
      const clientName = `${b.user.firstName || ''} ${b.user.lastName || ''}`.trim()
      const startTime = new Date(b.classSession.startTime).toLocaleString('pl-PL')
      csvContent += `"${b.id}","${clientName}","${b.user.email}","${b.classSession.class.name}","${startTime}","${b.hasPaid ? 'Opłacone' : 'Nieopłacone'}","${b.status}"\n`
    })
  } else if (type === 'classes') {
    filename = 'zajecia.csv'
    const classes = await prisma.class.findMany({
      include: {
        instructor: {
          include: {
            user: true,
          },
        },
      },
    })

    csvContent = 'ID,Nazwa,Kategoria,Czas trwania (min),Instruktor\n'
    classes.forEach((c) => {
      const instructorName = `${c.instructor.user.firstName || ''} ${c.instructor.user.lastName || ''}`.trim()
      csvContent += `"${c.id}","${c.name}","${c.category || ''}",${c.duration},"${instructorName}"\n`
    })
  } else {
    return new Response('Invalid type parameter', { status: 400 })
  }

  // Prepend UTF-8 BOM so Excel opens it with proper encoding
  const BOM = '\uFEFF'
  const responseContent = BOM + csvContent

  return new Response(responseContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
