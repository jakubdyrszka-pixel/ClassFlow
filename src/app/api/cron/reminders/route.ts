import { prisma } from '@/lib/db'
import { sendClassReminder } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  // Securing Cron Job (Verify CRON_SECRET if defined)
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const now = new Date()
    // Find sessions starting within the next 2.5 hours (reminding 2h before)
    const reminderThreshold = new Date(now.getTime() + 2.5 * 60 * 60 * 1000)

    // Fetch confirmed bookings that haven't been reminded yet
    const bookingsToRemind = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        reminded: false,
        classSession: {
          startTime: {
            gt: now,
            lte: reminderThreshold,
          },
        },
      },
      include: {
        user: true,
        classSession: {
          include: {
            class: true,
          },
        },
      },
    })

    console.log(`[Cron Reminder] Found ${bookingsToRemind.length} bookings to remind.`)

    for (const booking of bookingsToRemind) {
      // Send email reminder
      await sendClassReminder(
        booking.user.email,
        booking.classSession.class.name,
        booking.classSession.startTime
      )

      // Mark as reminded
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminded: true },
      })
    }

    return NextResponse.json({ success: true, count: bookingsToRemind.length })
  } catch (error: any) {
    console.error('[Cron Reminder Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
