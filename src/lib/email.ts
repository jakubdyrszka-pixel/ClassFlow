import { Resend } from 'resend'

// Initialize Resend if key is available
const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

// From address (must be verified in Resend, otherwise fallback to standard testing domain)
const FROM_EMAIL = process.env.EMAIL_FROM || 'ClassFlow <onboarding@resend.dev>'

// Main send wrapper with console fallback for local dev
async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (resend) {
    try {
      const data = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      })
      console.log(`[Email Sent via Resend] ID: ${data.data?.id} to ${to}`)
      return { success: true, id: data.data?.id }
    } catch (error) {
      console.error('[Resend Error] Failed to send email:', error)
      return { error }
    }
  } else {
    // Fallback for local development
    console.log('\n=================== EMAIL SIMULATION ===================')
    console.log(`To:      ${to}`)
    console.log(`Subject: ${subject}`)
    console.log('-------------------- HTML CONTENT --------------------')
    console.log(html)
    console.log('========================================================\n')
    return { success: true, simulated: true }
  }
}

// 1. Confirm booking
export async function sendBookingConfirmation(to: string, className: string, startTime: Date) {
  const formattedDate = new Date(startTime).toLocaleString('pl-PL')
  const subject = `Potwierdzenie zapisu na zajęcia: ${className}`
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h2 style="color: oklch(0.205 0 0);">Potwierdzenie rezerwacji</h2>
      <p>Cześć!</p>
      <p>Twój zapis na zajęcia <strong>${className}</strong> został pomyślnie potwierdzony.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Zajęcia:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${className}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Termin:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formattedDate}</td>
        </tr>
      </table>
      <p>Do zobaczenia na zajęciach!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
      <p style="font-size: 12px; color: #888;">ClassFlow System</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// 2. Booking cancellation
export async function sendBookingCancellation(to: string, className: string, startTime: Date) {
  const formattedDate = new Date(startTime).toLocaleString('pl-PL')
  const subject = `Anulowanie rezerwacji: ${className}`
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h2 style="color: #d92727;">Rezerwacja anulowana</h2>
      <p>Cześć!</p>
      <p>Twoja rezerwacja na zajęcia <strong>${className}</strong> (termin: ${formattedDate}) została anulowana.</p>
      <p>Mamy nadzieję, że zobaczymy się w innym terminie!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
      <p style="font-size: 12px; color: #888;">ClassFlow System</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// 3. Class cancelled by instructor
export async function sendClassCancellation(to: string, className: string, startTime: Date) {
  const formattedDate = new Date(startTime).toLocaleString('pl-PL')
  const subject = `PILNE: Zajęcia ${className} zostały odwołane`
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px; background-color: #fff9f9; border-left: 5px solid #d92727;">
      <h2 style="color: #d92727; margin-top: 0;">Zajęcia odwołane</h2>
      <p>Cześć!</p>
      <p>Informujemy, że zaplanowane na <strong>${formattedDate}</strong> zajęcia <strong>${className}</strong> zostały odwołane przez instruktora.</p>
      <p>Twoje punkty / płatność zostały zwrócone na konto. Przepraszamy za niedogodności.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
      <p style="font-size: 12px; color: #888;">ClassFlow System</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// 4. Booking reminder 2h before
export async function sendClassReminder(to: string, className: string, startTime: Date) {
  const formattedDate = new Date(startTime).toLocaleString('pl-PL')
  const subject = `Przypomnienie: Zajęcia ${className} już za 2 godziny!`
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h2 style="color: oklch(0.205 0 0);">Przypomnienie o zajęciach</h2>
      <p>Cześć!</p>
      <p>Przypominamy, że już za 2 godziny rozpoczynają się Twoje zajęcia <strong>${className}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Zajęcia:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${className}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Godzina:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formattedDate}</td>
        </tr>
      </table>
      <p>Przygotuj ręcznik, wodę i dobry nastrój. Do zobaczenia!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
      <p style="font-size: 12px; color: #888;">ClassFlow System</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendClassAnnouncement(to: string, className: string, userSubject: string, message: string) {
  const subject = `[${className}] ${userSubject}`
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h3 style="color: oklch(0.205 0 0);">Wiadomość od instruktora zajęć ${className}</h3>
      <p>Cześć!</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid oklch(0.205 0 0); margin: 15px 0; white-space: pre-wrap;">
        ${message}
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
      <p style="font-size: 12px; color: #888;">Wiadomość wysłana z systemu ClassFlow</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}
