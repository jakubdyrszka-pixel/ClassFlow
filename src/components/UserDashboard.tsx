'use client'
 
import React, { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from "@/lib/utils"

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar as CalendarIcon, Clock, User, MapPin, Users, CheckCircle, AlertCircle, RefreshCw, QrCode, CreditCard, Compass, BookOpen, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { bookSession, cancelBooking } from '@/actions/bookings'
import { updateProfile } from '@/actions/profile'
import { isActionError } from '@/lib/types/action-result'
import { QRCodeSVG } from 'qrcode.react'
 
// Calendar Import
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/pl'
import 'react-big-calendar/lib/css/react-big-calendar.css'
 
moment.locale('pl')
const localizer = momentLocalizer(moment)
 
interface UserDashboardProps {
  sessions: any[]
  categories: string[]
  instructors: any[]
  currentUser: any
  filters: {
    category?: string
    instructor?: string
    date?: string
    onlyAvailable?: boolean
  }
}
 
export default function UserDashboard({
  sessions,
  categories,
  instructors,
  currentUser,
  filters,
}: UserDashboardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
 
  // Navigation Tabs state (classes, bookings, calendar, profile)
  const [activeView, setActiveView] = useState<'classes' | 'bookings' | 'calendar' | 'profile'>('classes')
 
  // Profile Form State
  const [firstName, setFirstName] = useState(currentUser?.firstName || '')
  const [lastName, setLastName] = useState(currentUser?.lastName || '')
  const [profileMessage, setProfileMessage] = useState('')
 
  // QR Code States
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [isQrOpen, setIsQrOpen] = useState(false)
 
  // Calendar State Management
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState<any>('month')
 
  // Grouped classes selected session tracker
  const [selectedSessionsMap, setSelectedSessionsMap] = useState<{ [classId: string]: string }>({})
 
  // Group sessions by class
  const classGroupsMap: { [classId: string]: { class: any; sessions: any[] } } = {}
  sessions.forEach((s) => {
    const classId = s.classId
    if (!classGroupsMap[classId]) {
      classGroupsMap[classId] = {
        class: s.class,
        sessions: [],
      }
    }
    classGroupsMap[classId].sessions.push(s)
  })
  
  const classGroups = Object.values(classGroupsMap)
 
  // Check if session has a booking status
  const getUserBookingStatus = (sessionId: string) => {
    const booking = currentUser?.bookings?.find(
      (b: any) => b.classSessionId === sessionId
    )
    if (booking) {
      return booking.status
    }
    const waitlisted = currentUser?.waitlists?.find(
      (w: any) => w.classSessionId === sessionId
    )
    if (waitlisted) {
      return 'WAITLIST'
    }
    return null
  }
 
  // Handle filter changes via searchParams
  const updateFilter = (key: string, value: string | boolean) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === true) {
        params.set(key, 'true')
      } else if (value === false || value === '') {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }
 
  const resetFilters = () => {
    startTransition(() => {
      router.push(pathname)
    })
  }
 
  // Handle Book
  const handleBook = async (sessionId: string) => {
    const res = await bookSession(sessionId)
    if (isActionError(res)) {
      toast.error(res.error)
    } else {
      toast.success(res.data.message)
    }
  }
 
  // Handle Cancel
  const handleCancel = async (sessionId: string) => {
    const res = await cancelBooking(sessionId)
    if (isActionError(res)) {
      toast.error(res.error)
    } else {
      toast.success(res.data.message)
    }
  }
 
  // Handle Profile Update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMessage('')
    const res = await updateProfile({ firstName, lastName })
    if (isActionError(res)) {
      toast.error(res.error)
    } else {
      toast.success(res.data.message || 'Zaktualizowano profil!')
      setProfileMessage('Profil zaktualizowany pomyślnie!')
    }
  }
 
  // Fetch verified confirmed bookings
  const confirmedBookings = currentUser?.bookings?.filter(
    (b: any) => b.status === 'CONFIRMED' && new Date(b.classSession.startTime) >= new Date()
  ) || []
 
  // Fetch waitlists
  const waitlistBookings = currentUser?.waitlists?.map((w: any) => ({
    ...w,
    classSession: sessions.find((s) => s.id === w.classSessionId) || w.classSession,
  })).filter((w: any) => w.classSession) || []
 
  // Past bookings
  const pastBookings = currentUser?.bookings?.filter(
    (b: any) => new Date(b.classSession.startTime) < new Date()
  ) || []
 
  // Format events for react-big-calendar
  const calendarEvents = sessions.map((s) => ({
    id: s.id,
    title: `${s.class.name} (${s.bookings.length}/${s.maxCapacity})`,
    start: new Date(s.startTime),
    end: new Date(s.endTime),
    resource: s,
  }))
 
  const handleSelectEvent = (event: any) => {
    const s = event.resource
    const status = getUserBookingStatus(s.id)
    if (status === 'CONFIRMED') {
      toast.info(`Jesteś zapisany(a) na zajęcia: ${s.class.name}`)
    } else if (status === 'WAITLIST') {
      toast.info(`Jesteś na liście rezerwowej: ${s.class.name}`)
    } else {
      const confirmed = confirm(`Czy chcesz zapisać się na ${s.class.name} w dniu ${new Date(s.startTime).toLocaleString()}?`)
      if (confirmed) {
        handleBook(s.id)
      }
    }
  }
 
  // Next upcoming session
  const nextSession = confirmedBookings[0];
 
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row border-t border-border/40">
      
      {/* 1. SIDEBAR NAVIGATION (LEFT) */}
      <aside className="w-full lg:w-60 border-r border-border/30 bg-muted/10 p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          
          {/* User Profile Summary */}
          <div className="space-y-2">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light">Witaj z powrotem</p>
            <p className="text-xl font-light text-foreground truncate">
              {currentUser?.firstName || 'Klient'}
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-light bg-primary/10 text-primary border border-primary/20">
              Karnet Aktywny
            </div>
          </div>
 
          {/* Nav Items */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveView('classes')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-light text-left",
                activeView === 'classes' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <Compass className="w-4 h-4" />
              <span>Oferta zajęć</span>
            </button>
 
            <button
              onClick={() => setActiveView('bookings')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-light text-left",
                activeView === 'bookings' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span>Moje rezerwacje</span>
            </button>
 
            <button
              onClick={() => setActiveView('calendar')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-light text-left",
                activeView === 'calendar' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Harmonogram</span>
            </button>
 
            <button
              onClick={() => setActiveView('profile')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-light text-left",
                activeView === 'profile' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <Settings className="w-4 h-4" />
              <span>Ustawienia profilu</span>
            </button>
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
              {activeView === 'classes' && 'Dostępne zajęcia'}
              {activeView === 'bookings' && 'Twój grafik i uczestnictwo'}
              {activeView === 'calendar' && 'Kalendarz tygodniowy'}
              {activeView === 'profile' && 'Konto i Profil'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 font-light">
              {activeView === 'classes' && 'Wybierz interesującą Cię sesję i zarezerwuj miejsce.'}
              {activeView === 'bookings' && 'Przeglądaj swoje nadchodzące oraz historyczne treningi.'}
              {activeView === 'calendar' && 'Interaktywny widok zaplanowanych wydarzeń.'}
              {activeView === 'profile' && 'Zarządzaj swoimi danymi osobowymi.'}
            </p>
          </div>
          {isPending && <RefreshCw className="animate-spin text-muted-foreground w-4 h-4" />}
        </div>
 
        {/* VIEW: CLASSES */}
        {activeView === 'classes' && (
          <div className="space-y-8">
            
            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-muted/20 p-4 rounded-xl border border-border/40">
              <div className="space-y-1.5">
                <Label className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Kategoria</Label>
                <Select
                  value={filters.category || 'all'}
                  onValueChange={(val) => updateFilter('category', val === 'all' || !val ? '' : val)}
                >
                  <SelectTrigger className="h-9 font-light bg-card">
                    <SelectValue placeholder="Wszystkie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-light">Wszystkie</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat} className="font-light">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
 
              <div className="space-y-1.5">
                <Label className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Instruktor</Label>
                <Select
                  value={filters.instructor || 'all'}
                  onValueChange={(val) => updateFilter('instructor', val === 'all' || !val ? '' : val)}
                >
                  <SelectTrigger className="h-9 font-light bg-card">
                    <SelectValue placeholder="Wszyscy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-light">Wszyscy</SelectItem>
                    {instructors.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id} className="font-light">
                        {inst.user.firstName} {inst.user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
 
              <div className="space-y-1.5">
                <Label className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Data</Label>
                <Input
                  type="date"
                  value={filters.date || ''}
                  onChange={(e) => updateFilter('date', e.target.value)}
                  className="h-9 font-light bg-card"
                />
              </div>
 
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="w-full h-9 font-light"
                  onClick={() => updateFilter('onlyAvailable', !filters.onlyAvailable)}
                >
                  {filters.onlyAvailable ? 'Pokaż pełne' : 'Tylko wolne'}
                </Button>
                <Button variant="ghost" className="h-9 font-light" onClick={resetFilters}>
                  Reset
                </Button>
              </div>
            </div>
 
            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {classGroups.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground font-light border border-dashed border-border/80 rounded-xl bg-card/20">
                  Nie znaleziono zajęć spełniających kryteria.
                </div>
              ) : (
                classGroups.map((group) => {
                  const classId = group.class.id
                  const selectedSessionId = selectedSessionsMap[classId] || group.sessions[0].id
                  const activeSession = group.sessions.find((s) => s.id === selectedSessionId) || group.sessions[0]
                  
                  const status = getUserBookingStatus(activeSession.id)
                  const isFull = activeSession.bookings.length >= activeSession.maxCapacity
 
                  const borderClass = status === 'CONFIRMED'
                    ? 'border-green-500/20 bg-green-500/[0.01]'
                    : status === 'WAITLIST'
                    ? 'border-orange-500/20 bg-orange-500/[0.01]'
                    : 'border-border/60 hover:border-primary/20'
 
                  return (
                    <div
                      key={classId}
                      className={cn("flex flex-col rounded-xl border p-5 transition-all bg-card space-y-4", borderClass)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 text-[9px] tracking-wider uppercase font-light bg-primary/10 text-primary rounded-full">
                            {group.class.category}
                          </span>
                          <h3 className="text-lg font-light text-foreground">{group.class.name}</h3>
                        </div>
                        <span className="text-xs text-muted-foreground font-light">{group.class.duration} min</span>
                      </div>
 
                      <p className="text-xs text-muted-foreground font-light line-clamp-2 leading-relaxed">
                        {group.class.description}
                      </p>
 
                      {/* Session Selector */}
                      <div className="space-y-1.5 p-3 bg-muted/30 rounded-lg border border-border/40">
                        <Label className="text-[9px] tracking-wider uppercase text-muted-foreground font-light">Wybierz godzinę</Label>
                        <Select
                          value={selectedSessionId}
                          onValueChange={(val) => setSelectedSessionsMap(prev => ({ ...prev, [classId]: val || '' }))}
                        >
                          <SelectTrigger className="h-8 w-full bg-card font-light text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {group.sessions.map((s) => {
                              const d = new Date(s.startTime)
                              return (
                                <SelectItem key={s.id} value={s.id} className="font-light text-xs">
                                  {d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} | {d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
 
                      {/* Info Row */}
                      <div className="grid grid-cols-2 gap-2 text-xs font-light text-muted-foreground pt-1.5 border-t border-border/10">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{activeSession.instructor.user.firstName} {activeSession.instructor.user.lastName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{activeSession.room.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>
                            Miejsce: {activeSession.bookings.length} / {activeSession.maxCapacity}
                            {isFull && (
                              <span className="text-orange-500/90 ml-1.5 font-light">
                                (kolejka: {activeSession.waitlists.length})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
 
                      {/* Action Button */}
                      <div className="pt-2">
                        {status === 'CONFIRMED' ? (
                          <Button
                            variant="destructive"
                            className="w-full h-8 text-xs font-light"
                            onClick={() => handleCancel(activeSession.id)}
                          >
                            Zrezygnuj
                          </Button>
                        ) : status === 'WAITLIST' ? (
                          <Button
                            variant="outline"
                            className="w-full h-8 text-xs font-light border-orange-500/20 text-orange-600 hover:bg-orange-500/5"
                            onClick={() => handleCancel(activeSession.id)}
                          >
                            Wycofaj z listy rezerwowej
                          </Button>
                        ) : (
                          <Button
                            className="w-full h-8 text-xs font-light"
                            variant={isFull ? 'outline' : 'default'}
                            onClick={() => handleBook(activeSession.id)}
                          >
                            {isFull ? 'Zapisz na listę rezerwową' : 'Zapisz się'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
 
        {/* VIEW: BOOKINGS */}
        {activeView === 'bookings' && (
          <div className="space-y-8">
            
            {/* Confirmed classes list */}
            <div className="space-y-3">
              <h3 className="text-lg font-light text-foreground flex items-center gap-2 pb-1 border-b border-border/10">
                <CheckCircle className="w-4 h-4 text-green-500" /> Aktywne rezerwacje
              </h3>
              {confirmedBookings.length === 0 ? (
                <p className="text-xs text-muted-foreground font-light p-6 border border-dashed border-border/80 rounded-xl bg-card/10">
                  Brak nadchodzących zajęć.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {confirmedBookings.map((booking: any) => (
                    <div key={booking.id} className="border border-border/60 rounded-xl p-4 space-y-3 bg-card">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-light text-foreground">{booking.classSession.class.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-light bg-green-500/10 text-green-600 border border-green-500/20">
                          Potwierdzona
                        </span>
                      </div>
                      <div className="space-y-1 text-xs font-light text-muted-foreground">
                        <p>{new Date(booking.classSession.startTime).toLocaleString('pl-PL')}</p>
                        <p>Sala: {booking.classSession.room.name} {booking.classSession.room.location?.name && `(${booking.classSession.room.location.name})`}</p>
                      </div>
                      <div className="flex gap-2 pt-1.5 border-t border-border/10">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs font-light"
                          onClick={() => {
                            setSelectedBookingId(booking.id)
                            setIsQrOpen(true)
                          }}
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1.5" /> Pokaz kod
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full text-xs font-light"
                          onClick={() => handleCancel(booking.classSession.id)}
                        >
                          Anuluj rezerwację
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
 
            {/* Waitlist list */}
            <div className="space-y-3">
              <h3 className="text-lg font-light text-foreground flex items-center gap-2 pb-1 border-b border-border/10">
                <AlertCircle className="w-4 h-4 text-orange-500" /> Lista rezerwowa
              </h3>
              {waitlistBookings.length === 0 ? (
                <p className="text-xs text-muted-foreground font-light p-6 border border-dashed border-border/80 rounded-xl bg-card/10">
                  Brak zajęć na liście rezerwowej.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {waitlistBookings.map((waitlist: any) => (
                    <div key={waitlist.id} className="border border-border/60 rounded-xl p-4 space-y-3 bg-card">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-light text-foreground">{waitlist.classSession.class.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-light bg-orange-500/10 text-orange-600 border border-orange-500/20">
                          Rezerwowa
                        </span>
                      </div>
                      <div className="space-y-1 text-xs font-light text-muted-foreground">
                        <p>{new Date(waitlist.classSession.startTime).toLocaleString('pl-PL')}</p>
                        <p>Sala: {waitlist.classSession.room.name}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs font-light border-orange-500/20 text-orange-600 hover:bg-orange-500/5 pt-1.5"
                        onClick={() => handleCancel(waitlist.classSession.id)}
                      >
                        Wycofaj się
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
 
            {/* Past list */}
            <div className="space-y-3">
              <h3 className="text-lg font-light text-foreground flex items-center gap-2 pb-1 border-b border-border/10">
                <Clock className="w-4 h-4 text-muted-foreground" /> Archiwum treningów
              </h3>
              {pastBookings.length === 0 ? (
                <p className="text-xs text-muted-foreground font-light p-6 border border-dashed border-border/80 rounded-xl bg-card/10">
                  Brak odbytej historii zajęć.
                </p>
              ) : (
                <div className="divide-y border border-border/50 rounded-xl bg-card overflow-hidden">
                  {pastBookings.map((booking: any) => (
                    <div
                      key={booking.id}
                      className="flex justify-between items-center p-4 hover:bg-muted/20 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-light text-foreground">{booking.classSession.class.name}</p>
                        <p className="text-[10px] text-muted-foreground font-light">
                          {new Date(booking.classSession.startTime).toLocaleString('pl-PL')}
                        </p>
                      </div>
                      <div className="flex gap-2 items-center">
                        {booking.hasPaid && (
                          <span className="text-[9px] bg-green-500/10 text-green-600 font-light px-2 py-0.5 rounded-full border border-green-500/20">
                            Opłacone
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-light">
                          Odbyte
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
 
        {/* VIEW: CALENDAR */}
        {activeView === 'calendar' && (
          <div className="border border-border/60 rounded-xl p-4 bg-card">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 500 }}
              onSelectEvent={handleSelectEvent}
              date={calendarDate}
              onNavigate={(date) => setCalendarDate(date)}
              view={calendarView}
              onView={(view) => setCalendarView(view)}
              messages={{
                next: 'Następny',
                previous: 'Poprzedni',
                today: 'Dzisiaj',
                month: 'Miesiąc',
                week: 'Tydzień',
                day: 'Dzień',
              }}
            />
          </div>
        )}
 
        {/* VIEW: PROFILE */}
        {activeView === 'profile' && (
          <div className="max-w-md border border-border/60 rounded-xl p-6 bg-card space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-light text-muted-foreground uppercase tracking-wider">Adres E-mail</Label>
                <Input id="email" type="email" value={currentUser?.email || ''} disabled className="font-light bg-muted/40" />
                <p className="text-[10px] text-muted-foreground font-light">Adres e-mail jest połączony z kontem Clerk.</p>
              </div>
              
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-xs font-light text-muted-foreground uppercase tracking-wider">Imię</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="font-light"
                  />
                </div>
 
                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-xs font-light text-muted-foreground uppercase tracking-wider">Nazwisko</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="font-light"
                  />
                </div>
 
                <Button type="submit" className="w-full font-light">
                  Zapisz zmiany
                </Button>
                
                {profileMessage && (
                  <p className="text-xs text-green-600 text-center font-light mt-2">
                    {profileMessage}
                  </p>
                )}
              </form>
            </div>
          </div>
        )}
      </main>
 
      {/* 3. PERMANENT PASS & MEMBERSHIP PANEL (RIGHT) */}
      <aside className="w-full lg:w-80 border-l border-border/30 bg-muted/5 p-6 space-y-8 shrink-0">
        
        {/* Active Membership Pass Card */}
        <div className="space-y-3">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-primary" /> Twoje członkostwo
          </p>
          <div className="border border-border/60 rounded-xl p-4 bg-card space-y-4 relative overflow-hidden">
            <div className="space-y-1">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light">Karta Klubowa</p>
              <h4 className="text-sm font-light text-foreground">Karnet OPEN Joga & Pilates</h4>
              <p className="text-[10px] text-green-600 font-light bg-green-500/5 border border-green-500/10 px-2 py-0.5 rounded-full inline-block mt-1">
                Ważny / Nielimitowany
              </p>
            </div>
            
            <div className="text-[10px] text-muted-foreground font-light pt-2 border-t border-border/10">
              Ważny do: {new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString('pl-PL')}
            </div>
          </div>
        </div>
 
        {/* Permanent QR Code Access Key */}
        <div className="space-y-3">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-primary" /> Szybkie wejście (QR Pass)
          </p>
          <div className="border border-border/60 rounded-xl p-5 bg-card flex flex-col items-center justify-center space-y-4">
            <div className="bg-white p-2.5 rounded-lg border border-border/50">
              <QRCodeSVG value={currentUser?.clerkId || '123'} size={140} includeMargin={false} />
            </div>
            <p className="text-[10px] text-center text-muted-foreground font-light leading-relaxed">
              Zbliż ten kod do czytnika na recepcji lub pokaż go instruktorowi przed zajęciami.
            </p>
          </div>
        </div>
 
        {/* Next Class Hint */}
        {nextSession && (
          <div className="space-y-3">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light">Najbliższe zajęcia</p>
            <div className="border border-border/60 rounded-xl p-3 bg-card space-y-1">
              <p className="text-xs font-light text-foreground">{nextSession.classSession.class.name}</p>
              <p className="text-[10px] text-muted-foreground font-light">
                {new Date(nextSession.classSession.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} • {nextSession.classSession.room.name}
              </p>
            </div>
          </div>
        )}
      </aside>
 
      {/* QR Code Dialog (Fallback for specific booking items) */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="sm:max-w-[340px] text-center">
          <DialogHeader>
            <DialogTitle className="font-light text-lg">Twój kod QR (Karta wstępu)</DialogTitle>
            <DialogDescription className="font-light text-xs">
              Zeskanuj ten kod na recepcji, aby zarejestrować wejście.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-6 bg-white rounded-xl border border-border/50 my-3">
            {selectedBookingId && (
              <QRCodeSVG value={selectedBookingId} size={180} />
            )}
          </div>
          <Button variant="outline" className="w-full font-light" onClick={() => setIsQrOpen(false)}>
            Zamknij
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
