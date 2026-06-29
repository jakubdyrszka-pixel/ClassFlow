import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding roles...')
  const roles = ['USER', 'INSTRUCTOR', 'RECEPTIONIST', 'ADMIN']
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `Role for ${roleName.toLowerCase()}`
      },
    })
  }

  console.log('Seeding permissions...')
  const permissions = [
    // Classes
    { action: 'create:classes', description: 'Tworzenie zajęć' },
    { action: 'edit:classes', description: 'Edycja zajęć' },
    { action: 'delete:classes', description: 'Usuwanie zajęć' },
    // Sessions
    { action: 'create:sessions', description: 'Tworzenie sesji' },
    { action: 'reschedule:sessions', description: 'Przesuwanie sesji' },
    { action: 'cancel:sessions', description: 'Odwoływanie sesji' },
    // Bookings
    { action: 'view:bookings', description: 'Przeglądanie rezerwacji' },
    { action: 'manage:bookings', description: 'Zarządzanie rezerwacjami' },
    // Users
    { action: 'manage:users', description: 'Zarządzanie użytkownikami' },
    { action: 'view:users', description: 'Przeglądanie użytkowników' },
    // Memberships
    { action: 'purchase:membership', description: 'Zakup karnetu' },
    { action: 'manage:memberships', description: 'Zarządzanie karnetami' },
    // Analytics
    { action: 'view:analytics', description: 'Przeglądanie analityki' },
    // Audit
    { action: 'view:audit_log', description: 'Przeglądanie logów audytu' },
  ]
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { action: perm.action },
      update: { description: perm.description },
      create: perm,
    })
  }

  // Assign permissions to roles
  const allPermissions = await prisma.permission.findMany()
  const permMap = Object.fromEntries(allPermissions.map((p) => [p.action, p.id]))

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } })
  const instructorRole2 = await prisma.role.findUnique({ where: { name: 'INSTRUCTOR' } })
  const receptionistRole = await prisma.role.findUnique({ where: { name: 'RECEPTIONIST' } })
  const userRole = await prisma.role.findUnique({ where: { name: 'USER' } })

  const rolePerms: Record<string, string[]> = {
    ADMIN: Object.keys(permMap), // all permissions
    INSTRUCTOR: ['create:classes', 'edit:classes', 'cancel:sessions', 'view:bookings', 'manage:bookings'],
    RECEPTIONIST: ['view:bookings', 'manage:bookings', 'view:users', 'manage:memberships'],
    USER: ['view:bookings', 'purchase:membership'],
  }

  const roleMap: Record<string, string | undefined> = {
    ADMIN: adminRole?.id,
    INSTRUCTOR: instructorRole2?.id,
    RECEPTIONIST: receptionistRole?.id,
    USER: userRole?.id,
  }

  for (const [roleName, permActions] of Object.entries(rolePerms)) {
    const roleId = roleMap[roleName]
    if (!roleId) continue
    for (const action of permActions) {
      const permId = permMap[action]
      if (!permId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permId } },
        update: {},
        create: { roleId, permissionId: permId },
      })
    }
  }

  console.log('Seeding membership plans...')
  const membershipPlans = [
    { name: 'Open', entriesTotal: null, priceInCents: 0, currency: 'pln' },
    { name: '8 wejść', entriesTotal: 8, priceInCents: 14900, currency: 'pln' },
    { name: '12 wejść', entriesTotal: 12, priceInCents: 19900, currency: 'pln' },
    { name: 'Unlimited', entriesTotal: null, priceInCents: 24900, currency: 'pln' },
  ]

  for (const plan of membershipPlans) {
    await prisma.membershipPlan.upsert({
      where: { stripePriceId: `demo_${plan.name.toLowerCase().replace(/\s/g, '_')}` },
      update: { name: plan.name, priceInCents: plan.priceInCents },
      create: {
        name: plan.name,
        entriesTotal: plan.entriesTotal,
        priceInCents: plan.priceInCents,
        currency: plan.currency,
        stripePriceId: `demo_${plan.name.toLowerCase().replace(/\s/g, '_')}`,
        isActive: true,
      },
    })
  }

  console.log('Seeding locations and rooms...')
  const location1 = await prisma.location.create({
    data: {
      name: 'ClassFlow Center',
      address: 'ul. Marszałkowska 100',
      city: 'Warszawa'
    }
  })

  const roomYoga = await prisma.room.create({
    data: {
      locationId: location1.id,
      name: 'Studio Zen',
      capacity: 15
    }
  })

  const roomCardio = await prisma.room.create({
    data: {
      locationId: location1.id,
      name: 'Strefa Mocy (Klatka MMA)',
      capacity: 20
    }
  })

  console.log('Seeding dummy instructors and users...')
  // Utwórzmy dummy użytkowników dla instruktorów
  const instructorUser1 = await prisma.user.create({
    data: {
      clerkId: 'user_dummy_inst1',
      email: 'katarzyna.pilates@classflow.pl',
      firstName: 'Katarzyna',
      lastName: 'Wójcik',
    }
  })

  const instructorUser2 = await prisma.user.create({
    data: {
      clerkId: 'user_dummy_inst2',
      email: 'robert.mma@classflow.pl',
      firstName: 'Robert',
      lastName: 'Zawadzki',
    }
  })

  const instructorRole = await prisma.role.findUnique({ where: { name: 'INSTRUCTOR' } })
  if (instructorRole) {
    await prisma.userRole.createMany({
      data: [
        { userId: instructorUser1.id, roleId: instructorRole.id },
        { userId: instructorUser2.id, roleId: instructorRole.id }
      ]
    })
  }

  const instructor1 = await prisma.instructor.create({
    data: {
      userId: instructorUser1.id,
      bio: 'Katarzyna nie uczy po prostu pilatesu. Ona uczy świadomości. Z ponad dekadą doświadczenia w pracy z ciałem, jej sesje to mistrzowska precyzja i spokój, który zostaje z Tobą na długo po opuszczeniu maty. Poczuj różnicę.'
    }
  })

  const instructor2 = await prisma.instructor.create({
    data: {
      userId: instructorUser2.id,
      bio: 'Robert to siła spokoju i wulkan energii w jednym. Były zawodnik sportów walki, który udowadnia, że prawdziwa siła rodzi się w głowie. Z nim nie ma wymówek, są tylko twarde rezultaty i przełamywanie barier.'
    }
  })

  console.log('Seeding classes...')
  const classYoga = await prisma.class.create({
    data: {
      instructorId: instructor1.id,
      name: 'Poranne Przebudzenie (Joga Vinyasa)',
      description: 'Przywitaj dzień z energią, o jakiej nie marzyłeś. Płynne przejścia, głęboki oddech, czysty umysł. Zanurz się w praktyce, która przygotuje Cię na każde wyzwanie nadchodzącego dnia.',
      category: 'Joga',
      duration: 60
    }
  })

  const classPilates = await prisma.class.create({
    data: {
      instructorId: instructor1.id,
      name: 'Harmonia Ciała (Pilates)',
      description: 'Poczuj każdy mięsień. Odkryj na nowo równowagę. Nasze sesje Pilates z Katarzyną to nie tylko trening – to elitarna inwestycja w Twoje ciało, która zwraca się z każdym oddechem.',
      category: 'Pilates',
      duration: 55
    }
  })

  const classCrossfit = await prisma.class.create({
    data: {
      instructorId: instructor2.id,
      name: 'Strefa Wojownika (MMA)',
      description: 'Zostaw stres za drzwiami. Przekraczaj własne granice w bezpiecznym, kontrolowanym środowisku. Ten bezkompromisowy trening rzeźbi charakter tak samo mocno, jak mięśnie. Tylko dla głodnych sukcesu.',
      category: 'Sztuki Walki',
      duration: 45
    }
  })

  console.log('Seeding sessions for the next 7 days...')
  const now = new Date()
  
  // Tworzymy sesje codziennie w różnych godzinach
  for (let i = 0; i < 7; i++) {
    const date = new Date()
    date.setDate(now.getDate() + i)
    
    // Ustawiamy godziny sesji
    const morningTime = new Date(date)
    morningTime.setHours(8, 0, 0, 0)
    
    const noonTime = new Date(date)
    noonTime.setHours(12, 0, 0, 0)

    const eveningTime = new Date(date)
    eveningTime.setHours(18, 0, 0, 0)

    // Joga rano w sali jogi
    await prisma.classSession.create({
      data: {
        classId: classYoga.id,
        roomId: roomYoga.id,
        instructorId: instructor1.id,
        startTime: morningTime,
        endTime: new Date(morningTime.getTime() + 60 * 60 * 1000),
        maxCapacity: 15,
      }
    })

    // Pilates w południe w sali jogi
    await prisma.classSession.create({
      data: {
        classId: classPilates.id,
        roomId: roomYoga.id,
        instructorId: instructor1.id,
        startTime: noonTime,
        endTime: new Date(noonTime.getTime() + 55 * 60 * 1000),
        maxCapacity: 15,
      }
    })

    // Crossfit wieczorem w sali cardio
    await prisma.classSession.create({
      data: {
        classId: classCrossfit.id,
        roomId: roomCardio.id,
        instructorId: instructor2.id,
        startTime: eveningTime,
        endTime: new Date(eveningTime.getTime() + 45 * 60 * 1000),
        maxCapacity: 2, // Mały limit żeby łatwo było przetestować waiting list!
      }
    })
  }

  console.log('Demo seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
