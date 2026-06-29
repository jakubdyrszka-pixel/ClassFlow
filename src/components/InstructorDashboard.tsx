'use client'
 
import React, { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar as CalendarIcon, Clock, Users, FileText, CheckCircle, XCircle, AlertCircle, Mail, Send, Compass, BookOpen, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { isActionError } from '@/lib/types/action-result'
import { bulkCheckIn, updateSessionNotes, cancelSession, sendEmailToParticipants } from '@/actions/instructor'
 
interface InstructorDashboardProps {
  instructor: any
  sessions: any[]
}
 
export default function InstructorDashboard({ instructor, sessions }: InstructorDashboardProps) {
  const [selectedSession, setSelectedSession] = useState<any | null>(null)
  
  // Navigation Tabs state (today, schedule, attendance, messages)
  const [activeView, setActiveView] = useState<'today' | 'schedule' | 'attendance' | 'messages'>('today')
 
  // Manage Form states for selected session
  const [notes, setNotes] = useState('')
  const [checkedBookings, setCheckedBookings] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
 
  // Broadcast Message State
  const [messageSubject, setMessageSubject] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [isSendingMsg, setIsSendingMsg] = useState(false)
 
  // Filter today's sessions vs rest of week
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const endOfToday = new Date(today)
  endOfToday.setHours(23, 59, 59, 999)
 
  const todaySessions = sessions.filter((s) => {
    const startTime = new Date(s.startTime)
    return startTime >= today && startTime <= endOfToday
  })
 
  const weekSessions = sessions.filter((s) => {
    const startTime = new Date(s.startTime)
    return startTime > endOfToday
  })
 
  // Select a session to manage
  const handleSelectSession = (session: any, viewOverride?: 'attendance' | 'messages') => {
    setSelectedSession(session)
    setNotes(session.notes || '')
    setMessageSubject(`Wiadomość dot. zajęć ${session.class.name}`)
    setMessageBody('')
    // Pre-fill check-in list from current attendances
    const currentAttendances = session.bookings
      .filter((b: any) => b.attendance)
      .map((b: any) => b.id)
    setCheckedBookings(currentAttendances)
    
    if (viewOverride) {
      setActiveView(viewOverride)
    }
  }
 
  // Toggle Checkbox for participant
  const handleToggleAttendance = (bookingId: string) => {
    setCheckedBookings((prev) =>
      prev.includes(bookingId) ? prev.filter((id) => id !== bookingId) : [...prev, bookingId]
    )
  }
 
  // Save Attendance & Notes
  const handleSaveSession = async () => {
    if (!selectedSession) return
    setIsSaving(true)
 
    try {
      const attendanceRes = await bulkCheckIn(selectedSession.id, checkedBookings)
      if (isActionError(attendanceRes)) {
        toast.error(attendanceRes.error)
        setIsSaving(false)
        return
      }
 
      const notesRes = await updateSessionNotes(selectedSession.id, notes)
      if (isActionError(notesRes)) {
        toast.error(notesRes.error)
        setIsSaving(false)
        return
      }
 
      toast.success('Pomyślnie zapisano zmiany!')
      
      // Update local state
      setSelectedSession({
        ...selectedSession,
        notes,
        bookings: selectedSession.bookings.map((b: any) => ({
          ...b,
          attendance: checkedBookings.includes(b.id) ? { id: 'temp' } : null,
        })),
      })
    } catch (err) {
      toast.error('Błąd zapisu.')
    } finally {
      setIsSaving(false)
    }
  }
 
  // Cancel Session
  const handleCancelSession = async () => {
    if (!selectedSession) return
    if (!confirm('Czy na pewno chcesz odwołać te zajęcia? Ta operacja jest nieodwracalna, a wszyscy uczestnicy zostaną wypisani.')) {
      return
    }
 
    const res = await cancelSession(selectedSession.id)
    if (isActionError(res)) {
      toast.error(res.error)
    } else {
      toast.success('Zajęcia zostały odwołane!')
      setSelectedSession(null)
    }
  }
 
  // Broadcast email to participants
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSession) return
    if (!messageSubject || !messageBody) {
      toast.error('Uzupełnij temat i treść wiadomości.')
      return
    }
 
    setIsSendingMsg(true)
    try {
      const res = await sendEmailToParticipants(selectedSession.id, messageSubject, messageBody)
      if (isActionError(res)) {
        toast.error(res.error)
      } else {
        toast.success(res.data.message || 'Wiadomość wysłana!')
        setMessageBody('')
      }
    } catch (err) {
      toast.error('Błąd wysyłania wiadomości.')
    } finally {
      setIsSendingMsg(false)
    }
  }
 
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row border-t border-border/40">
      
      {/* 1. SIDEBAR NAVIGATION (LEFT) */}
      <aside className="w-full lg:w-60 border-r border-border/30 bg-muted/10 p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          
          {/* Instructor Profile Info */}
          <div className="space-y-2">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light">Panel Instruktora</p>
            <p className="text-xl font-light text-foreground truncate">
              {instructor.user.firstName || 'Instruktor'}
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-light bg-primary/10 text-primary border border-primary/20">
              Prowadzący
            </div>
          </div>
 
          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveView('today')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-light text-left",
                activeView === 'today' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <Compass className="w-4 h-4" />
              <span>Dziś ({todaySessions.length})</span>
            </button>
 
            <button
              onClick={() => setActiveView('schedule')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-light text-left",
                activeView === 'schedule' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Grafik ({weekSessions.length})</span>
            </button>
 
            <button
              onClick={() => {
                if (selectedSession) {
                  setActiveView('attendance')
                } else {
                  toast.info('Najpierw wybierz sesję z listy.')
                }
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-light text-left",
                activeView === 'attendance' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                !selectedSession && "opacity-50"
              )}
            >
              <CheckCircle className="w-4 h-4" />
              <span>Obecność</span>
            </button>
 
            <button
              onClick={() => {
                if (selectedSession) {
                  setActiveView('messages')
                } else {
                  toast.info('Najpierw wybierz sesję z listy.')
                }
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-light text-left",
                activeView === 'messages' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                !selectedSession && "opacity-50"
              )}
            >
              <Mail className="w-4 h-4" />
              <span>Ogłoszenia</span>
            </button>

            <Link
              href="/admin"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-light text-left text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            >
              <Settings className="w-4 h-4" />
              <span>Zarządzaj zajęciami</span>
            </Link>
          </nav>
        </div>
 
        <div className="pt-6 border-t border-border/20 text-[10px] text-muted-foreground font-light">
          ClassFlow v1.1 • Spokój w ruchu
        </div>
      </aside>
 
      {/* 2. MAIN HUB (CENTER) */}
      <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-border/20">
          <div>
            <h2 className="text-2xl font-light tracking-wide text-foreground">
              {activeView === 'today' && 'Zajęcia na dziś'}
              {activeView === 'schedule' && 'Zaplanowane lekcje'}
              {activeView === 'attendance' && 'Rejestr obecności'}
              {activeView === 'messages' && 'Komunikacja z grupą'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 font-light">
              {activeView === 'today' && 'Twoje dzisiejsze sesje. Wybierz jedną, by sprawdzić listę obecności.'}
              {activeView === 'schedule' && 'Planowane zajęcia na kolejne dni tygodnia.'}
              {activeView === 'attendance' && `Weryfikacja obecności dla zajęć: ${selectedSession?.class.name || 'nie wybrano'}`}
              {activeView === 'messages' && `Wyślij e-mail do uczestników zajęć: ${selectedSession?.class.name || 'nie wybrano'}`}
            </p>
          </div>
        </div>
 
        {/* VIEW: TODAY */}
        {activeView === 'today' && (
          <div className="space-y-4">
            {todaySessions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/80 rounded-xl text-muted-foreground bg-card/20 font-light text-sm">
                Brak zajęć zaplanowanych na dzisiaj.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todaySessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "rounded-xl border p-5 bg-card flex flex-col justify-between transition-all cursor-pointer",
                      selectedSession?.id === session.id ? "border-primary ring-1 ring-primary/20" : "border-border/60 hover:border-primary/20",
                      session.isCancelled && "opacity-60"
                    )}
                    onClick={() => handleSelectSession(session, 'attendance')}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-light text-foreground">{session.class.name}</h3>
                        {session.isCancelled && (
                          <span className="text-[9px] font-light px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                            Odwołane
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-xs font-light text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          {new Date(session.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} - {new Date(session.endTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          Zapisanych: {session.bookings.length} / {session.maxCapacity}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" className="w-full text-xs font-light">Wybierz sesję</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
 
        {/* VIEW: SCHEDULE */}
        {activeView === 'schedule' && (
          <div className="space-y-4">
            {weekSessions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/80 rounded-xl text-muted-foreground bg-card/20 font-light text-sm">
                Brak zaplanowanych zajęć na kolejne dni tygodnia.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "rounded-xl border p-5 bg-card flex flex-col justify-between transition-all cursor-pointer",
                      selectedSession?.id === session.id ? "border-primary ring-1 ring-primary/20" : "border-border/60 hover:border-primary/20",
                      session.isCancelled && "opacity-60"
                    )}
                    onClick={() => handleSelectSession(session, 'attendance')}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-light text-foreground">{session.class.name}</h3>
                        {session.isCancelled && (
                          <span className="text-[9px] font-light px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                            Odwołane
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-xs font-light text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                          {new Date(session.startTime).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          {new Date(session.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          Zapisanych: {session.bookings.length} / {session.maxCapacity}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button variant="outline" size="sm" className="w-full text-xs font-light">Wybierz sesję</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
 
        {/* VIEW: ATTENDANCE */}
        {activeView === 'attendance' && (
          <div className="space-y-4">
            {selectedSession ? (
              <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
                <div className="p-5 border-b border-border/10 space-y-1">
                  <h3 className="text-lg font-light text-foreground">Lista obecności</h3>
                  <p className="text-xs text-muted-foreground font-light">
                    {selectedSession.class.name} • {new Date(selectedSession.startTime).toLocaleString('pl-PL')}
                  </p>
                </div>
                
                {selectedSession.bookings.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-light text-center p-8 bg-muted/10">Brak zarejestrowanych uczestników.</p>
                ) : (
                  <div className="divide-y divide-border/10">
                    {selectedSession.bookings.map((booking: any) => (
                      <div key={booking.id} className="flex items-center justify-between p-4 hover:bg-muted/5 transition-colors">
                        <div>
                          <p className="text-sm font-light text-foreground">{booking.user.firstName} {booking.user.lastName}</p>
                          <p className="text-[10px] text-muted-foreground font-light">{booking.user.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`att-${booking.id}`}
                            checked={checkedBookings.includes(booking.id)}
                            onCheckedChange={() => handleToggleAttendance(booking.id)}
                            disabled={selectedSession.isCancelled}
                          />
                          <Label htmlFor={`att-${booking.id}`} className="text-xs font-light text-muted-foreground cursor-pointer select-none">
                            {checkedBookings.includes(booking.id) ? 'Obecny(a)' : 'Nieobecny(a)'}
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {!selectedSession.isCancelled && (
                  <div className="p-4 bg-muted/20 border-t border-border/10">
                    <Button className="w-full font-light h-9 text-xs" onClick={handleSaveSession} disabled={isSaving}>
                      Zapisz listę obecności
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-border/80 rounded-xl text-center py-12 text-muted-foreground font-light text-sm bg-card/20">
                Wybierz najpierw zajęcia z listy "Dziś" lub "Grafik".
              </div>
            )}
          </div>
        )}
 
        {/* VIEW: MESSAGES */}
        {activeView === 'messages' && (
          <div className="space-y-4">
            {selectedSession ? (
              <div className="border border-border/60 rounded-xl bg-card p-6 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-lg font-light text-foreground">Wyślij wiadomość do uczestników</h3>
                  <p className="text-xs text-muted-foreground font-light">
                    Wiadomość e-mail trafi do wszystkich ({selectedSession.bookings.length}) zapisanych osób.
                  </p>
                </div>
                
                <form onSubmit={handleSendMessage} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="subject" className="text-xs font-light text-muted-foreground uppercase tracking-wider">Temat</Label>
                    <Input
                      id="subject"
                      value={messageSubject}
                      onChange={(e) => setMessageSubject(e.target.value)}
                      required
                      className="font-light"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="body" className="text-xs font-light text-muted-foreground uppercase tracking-wider">Treść wiadomości</Label>
                    <Textarea
                      id="body"
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      placeholder="Wpisz treść ogłoszenia..."
                      rows={5}
                      required
                      className="font-light"
                    />
                  </div>
                  <Button type="submit" disabled={isSendingMsg || selectedSession.bookings.length === 0} className="w-full gap-2 font-light">
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingMsg ? 'Wysyłanie...' : 'Wyślij e-mail do grupy'}</span>
                  </Button>
                </form>
              </div>
            ) : (
              <div className="border border-dashed border-border/80 rounded-xl text-center py-12 text-muted-foreground font-light text-sm bg-card/20">
                Wybierz najpierw zajęcia z listy "Dziś" lub "Grafik".
              </div>
            )}
          </div>
        )}
      </main>
 
      {/* 3. MANAGEMENT / OPTIONS (RIGHT) */}
      <aside className="w-full lg:w-80 border-l border-border/30 bg-muted/5 p-6 space-y-6 shrink-0">
        {selectedSession ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light">Wybrana sesja</p>
              <h4 className="text-base font-light text-foreground">{selectedSession.class.name}</h4>
              <p className="text-xs text-muted-foreground font-light">
                Sala: {selectedSession.room?.name} {selectedSession.room?.location?.name ? `(${selectedSession.room.location.name})` : ''}
              </p>
            </div>
 
            {selectedSession.isCancelled && (
              <div className="p-3 bg-red-500/5 border border-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-start gap-2 font-light">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Te zajęcia zostały odwołane.</span>
              </div>
            )}
 
            {/* Notes Section */}
            <div className="space-y-2 pt-4 border-t border-border/10">
              <Label htmlFor="notes-aside" className="text-xs font-light text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" /> Notatki do lekcji
              </Label>
              <Textarea
                id="notes-aside"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Wpisz notatki z lekcji (np. tematyka zajęć)..."
                rows={4}
                disabled={selectedSession.isCancelled}
                className="font-light text-xs"
              />
            </div>
 
            <div className="space-y-2 pt-2">
              {!selectedSession.isCancelled && (
                <>
                  <Button className="w-full font-light h-9 text-xs" onClick={handleSaveSession} disabled={isSaving}>
                    {isSaving ? 'Zapisywanie...' : 'Zapisz notatki'}
                  </Button>
                  <Button variant="destructive" className="w-full font-light h-9 text-xs" onClick={handleCancelSession}>
                    Odwołaj zajęcia
                  </Button>
                </>
              )}
              {selectedSession.isCancelled && (
                <Button variant="outline" className="w-full font-light h-9 text-xs" onClick={() => setSelectedSession(null)}>
                  Zamknij
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-border/80 rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-3 bg-card/30 h-[250px]">
            <Compass className="w-8 h-8 opacity-45 text-primary" />
            <p className="text-xs text-muted-foreground font-light">
              Kliknij na wybrane zajęcia z harmonogramu, aby załadować opcje zarządzania lekcją.
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
