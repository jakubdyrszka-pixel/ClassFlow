'use client'
 
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts'
import {
  Users, Calendar, Landmark, DollarSign, Activity, FileSpreadsheet, Plus, Trash2, Edit2, ShieldAlert, Image, Compass, Settings, BookOpen, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { isActionError } from '@/lib/types/action-result'
import {
  createLocation, updateLocation, deleteLocation,
  createRoom, updateRoom, deleteRoom,
  createInstructor, updateInstructor, deleteInstructor,
  createClass, updateClass, deleteClass,
  createSession, createRecurringSessions, deleteSession,
  updateUserRoles
} from '@/actions/admin'
 
interface AdminDashboardProps {
  currentUserRole?: 'ADMIN' | 'INSTRUCTOR'
  currentInstructorId?: string | null
  analytics: {
    stats: {
      totalUsers: number
      totalBookings: number
      totalRevenue: number
      occupancyRate: number
    }
    revenueHistory: Array<{ date: string; revenue: number }>
    popularClasses: Array<{ name: string; bookings: number }>
  }
  users: any[]
  roles: any[]
  classes: any[]
  locations: any[]
  instructors: any[]
  sessions: any[]
  activityLogs: any[]
}
 
export default function AdminDashboard({
  currentUserRole = 'ADMIN',
  currentInstructorId = null,
  analytics,
  users,
  roles,
  classes,
  locations,
  instructors,
  sessions,
  activityLogs,
}: AdminDashboardProps) {
  // Navigation active tab (analytics, users, classes, sessions, instructors, facilities, logs)
  const [activeView, setActiveView] = useState<'analytics' | 'users' | 'classes' | 'sessions' | 'instructors' | 'facilities' | 'logs'>(
    'analytics'
  )

  // Calculations for Instructor Analytics
  const mySessions = sessions.filter((s) => s.instructorId === currentInstructorId)
  const myClasses = classes.filter((c) => c.instructorId === currentInstructorId)
  const myTotalBookings = mySessions.reduce((acc, s) => acc + s.bookings.length, 0)
  const myTotalCapacity = mySessions.reduce((acc, s) => acc + s.maxCapacity, 0)
  const myOccupancyRate = myTotalCapacity > 0 ? Math.round((myTotalBookings / myTotalCapacity) * 100) : 0
  
  const now = new Date()
  const myFutureSessions = mySessions.filter((s) => new Date(s.startTime) >= now)
  const myPastSessionsCount = mySessions.length - myFutureSessions.length

  const myClassBookingsCount: Record<string, number> = {}
  mySessions.forEach((s) => {
    const className = s.class.name
    myClassBookingsCount[className] = (myClassBookingsCount[className] || 0) + s.bookings.length
  })
  const myPopularClassesData = Object.keys(myClassBookingsCount).map((className) => ({
    name: className,
    bookings: myClassBookingsCount[className],
  })).sort((a, b) => b.bookings - a.bookings).slice(0, 5)

  const myClassOccupancy: Record<string, { bookings: number; capacity: number }> = {}
  mySessions.forEach((s) => {
    const className = s.class.name
    if (!myClassOccupancy[className]) {
      myClassOccupancy[className] = { bookings: 0, capacity: 0 }
    }
    myClassOccupancy[className].bookings += s.bookings.length
    myClassOccupancy[className].capacity += s.maxCapacity
  })
  const myOccupancyByClassData = Object.keys(myClassOccupancy).map((className) => ({
    name: className,
    rate: myClassOccupancy[className].capacity > 0 
      ? Math.round((myClassOccupancy[className].bookings / myClassOccupancy[className].capacity) * 100)
      : 0
  })).sort((a, b) => b.rate - a.rate)
 
  // User Management State
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([])
  const [isUpdatingUser, setIsUpdatingUser] = useState(false)
 
  // CRUD Location State
  const [editingLocId, setEditingLocId] = useState<string | null>(null)
  const [locName, setLocName] = useState('')
  const [locAddress, setLocAddress] = useState('')
  const [locCapacity, setLocCapacity] = useState(50)
  const [locOpenHours, setLocOpenHours] = useState('06:00 - 22:00')
 
  // CRUD Room State
  const [roomName, setRoomName] = useState('')
  const [roomCapacity, setRoomCapacity] = useState(20)
  const [roomLocId, setRoomLocId] = useState('')
 
  // CRUD Instructor State
  const [instUserId, setInstUserId] = useState('')
  const [instBio, setInstBio] = useState('')
  const [instImageUrl, setInstImageUrl] = useState('')
 
  // CRUD Class State
  const [editingClassId, setEditingClassId] = useState<string | null>(null)
  const [classNameField, setClassNameField] = useState('')
  const [classDesc, setClassDesc] = useState('')
  const [classCat, setClassCat] = useState('')
  const [classDur, setClassDur] = useState(60)
  const [classInstId, setClassInstId] = useState(currentUserRole === 'INSTRUCTOR' ? (currentInstructorId || '') : '')
 
  // CRUD Session State
  const [sessClassId, setSessClassId] = useState('')
  const [sessRoomId, setSessRoomId] = useState('')
  const [sessInstId, setSessInstId] = useState(currentUserRole === 'INSTRUCTOR' ? (currentInstructorId || '') : '')
  const [sessStart, setSessStart] = useState('')
  const [sessCap, setSessCap] = useState(15)
 
  // Recurring rule state
  const [isRecurring, setIsRecurring] = useState(false)
  const [rruleFreq, setRruleFreq] = useState('WEEKLY')
  const [rruleCount, setRruleCount] = useState(5)

  // Additional navigation & display states
  const [sessionsDisplayMode, setSessionsDisplayMode] = useState<'list' | 'calendar'>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(new Date())
  const [viewingBookingsSession, setViewingBookingsSession] = useState<any | null>(null)
 
  useEffect(() => {
    if (currentUserRole === 'INSTRUCTOR' && currentInstructorId) {
      setClassInstId(currentInstructorId)
      setSessInstId(currentInstructorId)
    }
  }, [currentUserRole, currentInstructorId])
 
  // Pre-fill user roles when selected
  const handleSelectUser = (user: any) => {
    setSelectedUser(user)
    setSelectedRoleNames(user.roles.map((ur: any) => ur.role.name))
  }
 
  const handleToggleRole = (roleName: string) => {
    setSelectedRoleNames((prev) =>
      prev.includes(roleName) ? prev.filter((name) => name !== roleName) : [...prev, roleName]
    )
  }
 
  const handleSaveUserRoles = async () => {
    if (!selectedUser) return
    setIsUpdatingUser(true)
    const res = await updateUserRoles(selectedUser.id, selectedRoleNames)
    setIsUpdatingUser(false)
    if (isActionError(res)) {
      toast.error(res.error)
    } else {
      toast.success('Pomyślnie zaktualizowano role!')
      setSelectedUser(null)
    }
  }
 
  // Location Submit
  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingLocId) {
        await updateLocation(editingLocId, { name: locName, address: locAddress, openingHours: locOpenHours })
        toast.success('Zaktualizowano lokalizację!')
        setEditingLocId(null)
      } else {
        await createLocation({ name: locName, address: locAddress, openingHours: locOpenHours })
        toast.success('Utworzono lokalizację!')
      }
      setLocName('')
      setLocAddress('')
    } catch (err: any) {
      toast.error(err.message || 'Wystąpił błąd podczas zapisu.')
    }
  }
 
  const handleEditLocation = (loc: any) => {
    setEditingLocId(loc.id)
    setLocName(loc.name)
    setLocAddress(loc.address || '')
    setLocCapacity(loc.capacity)
    setLocOpenHours(loc.openingHours || '06:00 - 22:00')
  }
 
  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę lokalizację? Wszystkie powiązane sale również zostaną usunięte.')) return
    try {
      await deleteLocation(id)
      toast.success('Usunięto lokalizację.')
    } catch (err: any) {
      toast.error(err.message || 'Błąd usuwania.')
    }
  }
 
  // Room Submit
  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomLocId) {
      toast.error('Wybierz lokalizację dla sali.')
      return
    }
    try {
      await createRoom({ name: roomName, capacity: roomCapacity, locationId: roomLocId })
      toast.success('Utworzono salę!')
      setRoomName('')
      setRoomCapacity(20)
    } catch (err: any) {
      toast.error(err.message || 'Błąd zapisu sali.')
    }
  }
 
  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Czy chcesz usunąć tę salę?')) return
    try {
      await deleteRoom(id)
      toast.success('Usunięto salę.')
    } catch (err: any) {
      toast.error(err.message || 'Błąd usuwania.')
    }
  }
 
  // Instructor Submit
  const handleInstructorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!instUserId) {
      toast.error('Wybierz użytkownika.')
      return
    }
    try {
      await createInstructor({ userId: instUserId, bio: instBio })
      toast.success('Nadano uprawnienia instruktora!')
      setInstUserId('')
      setInstBio('')
      setInstImageUrl('')
    } catch (err: any) {
      toast.error(err.message || 'Błąd zapisu.')
    }
  }
 
  const handleDeleteInst = async (id: string) => {
    if (!confirm('Czy na pewno chcesz odebrać uprawnienia instruktora? Powiązane sesje mogą ulec zmianie.')) return
    try {
      await deleteInstructor(id)
      toast.success('Odebrano uprawnienia instruktora.')
    } catch (err: any) {
      toast.error(err.message || 'Błąd zapisu.')
    }
  }
 
  // Class Submit
  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const finalInstId = currentUserRole === 'INSTRUCTOR' ? (currentInstructorId || classInstId) : classInstId
    
    if (!finalInstId) {
      toast.error('Wybierz instruktora.')
      return
    }
 
    try {
      if (editingClassId) {
        await updateClass(editingClassId, {
          name: classNameField,
          description: classDesc,
          category: classCat,
          duration: classDur,
          instructorId: finalInstId
        })
        toast.success('Zaktualizowano zajęcia!')
        setEditingClassId(null)
      } else {
        await createClass({
          name: classNameField,
          description: classDesc,
          category: classCat,
          duration: classDur,
          instructorId: finalInstId
        })
        toast.success('Utworzono zajęcia!')
      }
      setClassNameField('')
      setClassDesc('')
      setClassCat('')
      if (currentUserRole !== 'INSTRUCTOR') {
        setClassInstId('')
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd zapisu.')
    }
  }
 
  const handleEditClass = (c: any) => {
    setEditingClassId(c.id)
    setClassNameField(c.name)
    setClassDesc(c.description || '')
    setClassCat(c.category || '')
    setClassDur(c.duration)
    setClassInstId(c.instructorId)
  }
 
  const handleDeleteClass = async (id: string) => {
    if (!confirm('Czy chcesz usunąć te zajęcia wraz ze wszystkimi sesjami?')) return
    try {
      await deleteClass(id)
      toast.success('Usunięto zajęcia.')
    } catch (err: any) {
      toast.error(err.message || 'Błąd usuwania.')
    }
  }
 
  // Session Submit
  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const finalInstId = currentUserRole === 'INSTRUCTOR' ? (currentInstructorId || sessInstId) : sessInstId

    if (!sessClassId || !sessRoomId || !finalInstId || !sessStart) {
      toast.error('Uzupełnij wszystkie dane sesji.')
      return
    }
 
    const startDate = new Date(sessStart)
    const selectedClass = classes.find((c) => c.id === sessClassId)
    const duration = selectedClass ? selectedClass.duration : 60
    const endDate = new Date(startDate.getTime() + duration * 60000)
 
    try {
      if (isRecurring) {
        const rruleString = `FREQ=${rruleFreq};COUNT=${rruleCount}`
 
        const res = await createRecurringSessions({
          classId: sessClassId,
          roomId: sessRoomId,
          instructorId: finalInstId,
          startTime: startDate.toISOString(),
          maxCapacity: sessCap,
          duration,
          rruleString
        })
        if (isActionError(res)) {
          toast.error(res.error)
        } else {
          toast.success('Utworzono cykl sesji pomyślnie!')
          setSessStart('')
        }
      } else {
        await createSession({
          classId: sessClassId,
          roomId: sessRoomId,
          instructorId: finalInstId,
          startTime: startDate,
          endTime: endDate,
          maxCapacity: sessCap
        })
        toast.success('Utworzono sesję jednorazową!')
        setSessStart('')
      }
    } catch (err: any) {
      toast.error(err.message || 'Wystąpił błąd.')
    }
  }
 
  const handleDeleteSession = async (id: string) => {
    if (!confirm('Czy chcesz odwołać i usunąć tę sesję z grafiku?')) return
    try {
      await deleteSession(id)
      toast.success('Usunięto sesję z grafiku.')
    } catch (err: any) {
      toast.error(err.message || 'Błąd usuwania.')
    }
  }
 
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row border-t border-border/40">
      
      {/* 1. SIDEBAR NAVIGATION (LEFT) */}
      <aside className="w-full lg:w-64 border-r border-border/30 bg-muted/10 p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light">Zarządzanie</p>
            <p className="text-xl font-light text-foreground">
              {currentUserRole === 'ADMIN' ? 'Panel Admina' : 'Panel Instruktora'}
            </p>
          </div>
 
          {/* Navigation Links */}
          <nav className="space-y-1 pt-4 border-t border-border/10">
            <button
              onClick={() => setActiveView('analytics')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all font-light text-left",
                activeView === 'analytics' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
              )}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{currentUserRole === 'ADMIN' ? 'Analityka i Statystyki' : 'Moje statystyki'}</span>
            </button>
 
            {currentUserRole === 'ADMIN' && (
              <button
                onClick={() => setActiveView('users')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all font-light text-left",
                  activeView === 'users' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Użytkownicy i Role</span>
              </button>
            )}
 
            <button
              onClick={() => setActiveView('classes')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all font-light text-left",
                activeView === 'classes' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Baza zajęć</span>
            </button>
 
            <button
              onClick={() => setActiveView('sessions')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all font-light text-left",
                activeView === 'sessions' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Harmonogram sesji</span>
            </button>
 
            {currentUserRole === 'ADMIN' && (
              <button
                onClick={() => setActiveView('instructors')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all font-light text-left",
                  activeView === 'instructors' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Kadra instruktorska</span>
              </button>
            )}
 
            {currentUserRole === 'ADMIN' && (
              <button
                onClick={() => setActiveView('facilities')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all font-light text-left",
                  activeView === 'facilities' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
                )}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>Sale i lokalizacje</span>
              </button>
            )}
 
            {currentUserRole === 'ADMIN' && (
              <button
                onClick={() => setActiveView('logs')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all font-light text-left",
                  activeView === 'logs' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
                )}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Logi systemowe</span>
              </button>
            )}
          </nav>
        </div>
 
        <div className="pt-6 border-t border-border/20 text-[10px] text-muted-foreground font-light">
          ClassFlow v1.1 • {currentUserRole === 'ADMIN' ? 'Panel Admina' : 'Panel Instruktora'}
        </div>
      </aside>
 
      {/* 2. MAIN HUB (CENTER) */}
      <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-border/20">
          <div>
            <h2 className="text-2xl font-light tracking-wide text-foreground">
              {activeView === 'analytics' && (currentUserRole === 'ADMIN' ? 'Centrum analityczne' : 'Moje statystyki')}
              {activeView === 'users' && 'Uprawnienia i role'}
              {activeView === 'classes' && 'Katalog dyscyplin'}
              {activeView === 'sessions' && 'Rozkład zajęć'}
              {activeView === 'instructors' && 'Instruktorzy i bio'}
              {activeView === 'facilities' && 'Budynki i sale lekcyjne'}
              {activeView === 'logs' && 'Audyt operacji'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 font-light">
              {activeView === 'analytics' && (currentUserRole === 'ADMIN' ? 'Wgląd w przychody, frekwencję oraz popularność dyscyplin.' : 'Twoje statystyki, frekwencja oraz popularność prowadzonych zajęć.')}
              {activeView === 'users' && 'Wyszukiwanie kont w bazie i konfigurowanie dostępu dla personelu.'}
              {activeView === 'classes' && 'Tworzenie i edycja szablonów zajęć.'}
              {activeView === 'sessions' && 'Planowanie konkretnych godzin w salach i wdrożenia cykliczne.'}
              {activeView === 'instructors' && 'Zarządzanie uprawnieniami trenerskimi i profilami.'}
              {activeView === 'facilities' && 'Struktura placówek i pojemność sal gimnastycznych.'}
              {activeView === 'logs' && 'Kluczowe zmiany zapisane przez system.'}
            </p>
          </div>
        </div>
 
        {/* VIEW: ANALYTICS */}
        {activeView === 'analytics' && (
          <div className="space-y-6">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border border-border/60 rounded-xl p-4 bg-card space-y-1">
                <p className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Użytkownicy</p>
                <p className="text-2xl font-light text-foreground">{analytics.stats.totalUsers}</p>
              </div>
              <div className="border border-border/60 rounded-xl p-4 bg-card space-y-1">
                <p className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Rezerwacje</p>
                <p className="text-2xl font-light text-foreground">{analytics.stats.totalBookings}</p>
              </div>
              <div className="border border-border/60 rounded-xl p-4 bg-card space-y-1">
                <p className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Przychód (suma)</p>
                <p className="text-2xl font-light text-foreground">{analytics.stats.totalRevenue} PLN</p>
              </div>
              <div className="border border-border/60 rounded-xl p-4 bg-card space-y-1">
                <p className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Obłożenie sal</p>
                <p className="text-2xl font-light text-foreground">{analytics.stats.occupancyRate}%</p>
              </div>
            </div>
            <Calendar />
 
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Revenue */}
              <div className="border border-border/60 rounded-xl p-5 bg-card space-y-3">
                <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Historia przychodów</h3>
                <div className="h-64 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.revenueHistory}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 10, fontFamily: 'var(--font-sans)', fontWeight: 300 }} />
                      <YAxis tickLine={false} axisLine={false} style={{ fontSize: 10, fontFamily: 'var(--font-sans)', fontWeight: 300 }} />
                      <Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 300 }} />
                      <Bar dataKey="revenue" fill="var(--primary)" name="Przychód (PLN)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
 
              {/* Popularity */}
              <div className="border border-border/60 rounded-xl p-5 bg-card space-y-3">
                <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Popularność zajęć</h3>
                <div className="h-64 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.popularClasses} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" tickLine={false} axisLine={false} style={{ fontSize: 10, fontFamily: 'var(--font-sans)', fontWeight: 300 }} />
                      <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} style={{ fontSize: 10, fontFamily: 'var(--font-sans)', fontWeight: 300 }} />
                      <Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 300 }} />
                      <Bar dataKey="bookings" fill="var(--chart-2)" name="Rezerwacje" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
 
        {/* VIEW: USERS & ROLES */}
        {activeView === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-border/60 rounded-xl bg-card overflow-hidden">
              <div className="p-4 border-b border-border/10">
                <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Lista użytkowników</h3>
              </div>
              <div className="divide-y divide-border/10 max-h-[500px] overflow-y-auto">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={cn(
                      "flex items-center justify-between p-3.5 cursor-pointer transition-colors hover:bg-muted/5",
                      selectedUser?.id === u.id && "bg-accent/40"
                    )}
                    onClick={() => handleSelectUser(u)}
                  >
                    <div>
                      <p className="text-sm font-light text-foreground">{u.firstName} {u.lastName}</p>
                      <p className="text-[10px] text-muted-foreground font-light">{u.email}</p>
                      <div className="flex gap-1.5 mt-1.5">
                        {u.roles.map((ur: any) => (
                          <span key={ur.roleId} className="text-[9px] bg-muted font-light px-2 py-0.5 rounded-full border border-border/80 text-muted-foreground">
                            {ur.role.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
 
            {/* Roles editor on right */}
            <div className="lg:col-span-1">
              {selectedUser ? (
                <div className="border border-border/60 rounded-xl bg-card p-5 space-y-4">
                  <h3 className="text-sm font-light text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-primary" /> Uprawnienia
                  </h3>
                  <p className="text-xs text-muted-foreground font-light">
                    Modyfikujesz role dla: <span className="text-foreground">{selectedUser.firstName} {selectedUser.lastName}</span>
                  </p>
                  
                  <div className="space-y-2 pt-2">
                    {roles.map((role) => (
                      <div key={role.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`role-${role.id}`}
                          checked={selectedRoleNames.includes(role.name)}
                          onCheckedChange={() => handleToggleRole(role.name)}
                        />
                        <Label htmlFor={`role-${role.id}`} className="text-xs font-light text-muted-foreground cursor-pointer select-none">
                          {role.name}
                        </Label>
                      </div>
                    ))}
                  </div>
 
                  <Button className="w-full font-light h-9 text-xs mt-4" onClick={handleSaveUserRoles} disabled={isUpdatingUser}>
                    Zapisz uprawnienia
                  </Button>
                </div>
              ) : (
                <div className="border border-dashed border-border/80 rounded-xl p-5 text-center bg-card/20 h-[180px] flex flex-col items-center justify-center space-y-2">
                  <ShieldAlert className="w-6 h-6 opacity-45 text-primary" />
                  <p className="text-xs text-muted-foreground font-light">Wybierz użytkownika z tabeli obok, aby skonfigurować uprawnienia.</p>
                </div>
              )}
            </div>
          </div>
        )}
 
        {/* VIEW: CLASSES */}
        {activeView === 'classes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* CRUD Form */}
            <div className="lg:col-span-1 border border-border/60 rounded-xl bg-card p-5 space-y-4">
              <h3 className="text-sm font-light text-foreground uppercase tracking-wider">{editingClassId ? 'Edytuj zajęcia' : 'Utwórz rodzaj zajęć'}</h3>
              <form onSubmit={handleClassSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <Label htmlFor="c-name" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Nazwa</Label>
                  <Input id="c-name" value={classNameField} onChange={(e) => setClassNameField(e.target.value)} required className="h-9 font-light" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-desc" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Opis</Label>
                  <Textarea id="c-desc" value={classDesc} onChange={(e) => setClassDesc(e.target.value)} rows={3} className="font-light text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-cat" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Kategoria</Label>
                  <Input id="c-cat" value={classCat} onChange={(e) => setClassCat(e.target.value)} placeholder="Joga, Pilates, Cardio..." className="h-9 font-light" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="c-dur" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Czas (min)</Label>
                    <Input id="c-dur" type="number" value={classDur} onChange={(e) => setClassDur(Number(e.target.value))} required className="h-9 font-light" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Instruktor główny</Label>
                    <select
                      value={classInstId}
                      onChange={(e) => setClassInstId(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-xs font-light shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={currentUserRole === 'INSTRUCTOR'}
                    >
                      <option value="">Wybierz...</option>
                      {instructors.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.user.firstName} {inst.user.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full font-light h-9 text-xs">{editingClassId ? 'Zapisz zmiany' : 'Utwórz zajęcia'}</Button>
                {editingClassId && (
                  <Button variant="outline" className="w-full font-light h-9 text-xs" onClick={() => {
                    setEditingClassId(null)
                    setClassNameField('')
                    setClassDesc('')
                    setClassCat('')
                    setClassInstId('')
                  }}>
                    Anuluj edycję
                  </Button>
                )}
              </form>
            </div>
 
            {/* List */}
            <div className="lg:col-span-2 border border-border/60 rounded-xl bg-card overflow-hidden">
              <div className="p-4 border-b border-border/10">
                <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Zdefiniowane zajęcia</h3>
              </div>
              <div className="divide-y divide-border/10 max-h-[500px] overflow-y-auto">
                {classes.map((c) => (
                  <div key={c.id} className="p-4 flex justify-between items-center hover:bg-muted/5 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-light text-foreground">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground font-light">
                        Kategoria: {c.category || 'brak'} • Czas: {c.duration} min • Prowadzi: {c.instructor.user.firstName} {c.instructor.user.lastName}
                      </p>
                    </div>
                    {(currentUserRole === 'ADMIN' || c.instructorId === currentInstructorId) && (
                      <div className="flex gap-2">
                        <Button size="xs" variant="outline" className="font-light" onClick={() => handleEditClass(c)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="xs" variant="destructive" className="font-light" onClick={() => handleDeleteClass(c.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
 
        {/* VIEW: SESSIONS (SCHEDULE) */}
        {activeView === 'sessions' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* CRUD Form */}
            <div className="lg:col-span-1 border border-border/60 rounded-xl bg-card p-5 space-y-4">
              <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Zaplanuj termin w kalendarzu</h3>
              <form onSubmit={handleSessionSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <Label className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Zajęcia</Label>
                  <select
                    value={sessClassId}
                    onChange={(e) => {
                      const val = e.target.value
                      setSessClassId(val)
                      const cl = classes.find((c) => c.id === val)
                      if (cl) {
                        if (currentUserRole !== 'INSTRUCTOR') {
                          setSessInstId(cl.instructorId)
                        }
                      }
                    }}
                    className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-xs font-light shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Wybierz...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Sala</Label>
                    <select
                      value={sessRoomId}
                      onChange={(e) => setSessRoomId(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-xs font-light shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Wybierz...</option>
                      {locations.map((loc) =>
                        loc.rooms.map((room: any) => (
                          <option key={room.id} value={room.id}>
                            {room.name} ({loc.name})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Instruktor</Label>
                    <select
                      value={sessInstId}
                      onChange={(e) => setSessInstId(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-xs font-light shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={currentUserRole === 'INSTRUCTOR'}
                    >
                      <option value="">Wybierz...</option>
                      {instructors.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.user.firstName} {inst.user.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-start" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Rozpoczęcie</Label>
                  <Input id="s-start" type="datetime-local" value={sessStart} onChange={(e) => setSessStart(e.target.value)} required className="h-9 font-light" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-cap" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Limit miejsc</Label>
                  <Input id="s-cap" type="number" value={sessCap} onChange={(e) => setSessCap(Number(e.target.value))} required className="h-9 font-light" />
                </div>
 
                {/* Recurrence Checkbox */}
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox id="s-rec" checked={isRecurring} onCheckedChange={(checked) => setIsRecurring(!!checked)} />
                  <Label htmlFor="s-rec" className="text-xs font-light text-muted-foreground cursor-pointer select-none">Powtarzaj cyklicznie</Label>
                </div>
 
                {isRecurring && (
                  <div className="space-y-4 border border-border/50 rounded-xl p-3.5 bg-muted/40">
                    <div className="space-y-1">
                      <Label className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Częstotliwość cyklu</Label>
                      <select
                        value={rruleFreq}
                        onChange={(e) => setRruleFreq(e.target.value)}
                        className="flex h-8 w-full rounded-lg border border-input bg-card px-3 py-1 text-xs font-light shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="DAILY">Codziennie</option>
                        <option value="WEEKLY">Co tydzień</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="s-count" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Liczba powtórzeń</Label>
                      <Input id="s-count" type="number" value={rruleCount} onChange={(e) => setRruleCount(Number(e.target.value))} className="h-8 font-light" />
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full font-light h-9 text-xs">Dodaj sesję</Button>
              </form>
            </div>
 
            {/* List / Calendar */}
            <div className="lg:col-span-2 border border-border/60 rounded-xl bg-card overflow-hidden">
              <div className="p-4 border-b border-border/10 flex justify-between items-center bg-card">
                <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Nadchodzące wydarzenia</h3>
                <div className="flex gap-1 bg-muted/30 p-1 rounded-lg border border-border/10">
                  <button
                    type="button"
                    onClick={() => setSessionsDisplayMode('list')}
                    className={cn(
                      "px-3 py-1 rounded-md text-[10px] font-light transition-all",
                      sessionsDisplayMode === 'list' ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionsDisplayMode('calendar')}
                    className={cn(
                      "px-3 py-1 rounded-md text-[10px] font-light transition-all",
                      sessionsDisplayMode === 'calendar' ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Kalendarz
                  </button>
                </div>
              </div>

              {sessionsDisplayMode === 'list' ? (
                <div className="divide-y divide-border/10 max-h-[500px] overflow-y-auto">
                  {sessions.map((s) => (
                    <div key={s.id} className="p-4 flex justify-between items-center hover:bg-muted/5 transition-colors">
                      <div className="space-y-0.5">
                        <p className="text-sm font-light text-foreground">
                          {s.class.name}
                          {s.isCancelled && <span className="text-[8px] bg-red-500/10 border border-red-500/20 text-red-600 px-1.5 py-0.2 rounded-full ml-2">Odwołane</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-light">
                          {new Date(s.startTime).toLocaleString('pl-PL')} • Sala: {s.room.name} • Instruktor: {s.instructor.user.firstName} {s.instructor.user.lastName} • Zapisy: {s.bookings.length} / {s.maxCapacity}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {(currentUserRole === 'ADMIN' || s.instructorId === currentInstructorId) && (
                          <Button size="xs" variant="outline" className="font-light gap-1" onClick={() => setViewingBookingsSession(s)}>
                            <Users className="w-3.5 h-3.5" />
                            <span>Zapisy ({s.bookings.length})</span>
                          </Button>
                        )}
                        {(currentUserRole === 'ADMIN' || s.instructorId === currentInstructorId) && (
                          <Button size="xs" variant="destructive" className="font-light" onClick={() => handleDeleteSession(s.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Calendar Navigation */}
                  <div className="flex justify-between items-center pb-2 border-b border-border/10">
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                      className="text-[10px] font-light text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted/20"
                    >
                      ← Poprzedni
                    </button>
                    <span className="text-xs uppercase tracking-wider text-foreground font-light">
                      {['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'][currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                      className="text-[10px] font-light text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted/20"
                    >
                      Następny →
                    </button>
                  </div>

                  {/* Calendar Calculations */}
                  {(() => {
                    const year = currentMonth.getFullYear()
                    const month = currentMonth.getMonth()
                    const firstDay = new Date(year, month, 1)
                    let startDay = firstDay.getDay()
                    startDay = startDay === 0 ? 6 : startDay - 1 // Monday = 0

                    const totalDays = new Date(year, month + 1, 0).getDate()
                    const prevMonthDays = new Date(year, month, 0).getDate()

                    const prevPadding = Array.from({ length: startDay }, (_, i) => ({
                      day: prevMonthDays - startDay + i + 1,
                      isCurrentMonth: false,
                      date: new Date(year, month - 1, prevMonthDays - startDay + i + 1)
                    }))

                    const currentDays = Array.from({ length: totalDays }, (_, i) => ({
                      day: i + 1,
                      isCurrentMonth: true,
                      date: new Date(year, month, i + 1)
                    }))

                    const remainingSlots = 42 - (prevPadding.length + currentDays.length)
                    const nextPadding = Array.from({ length: remainingSlots }, (_, i) => ({
                      day: i + 1,
                      isCurrentMonth: false,
                      date: new Date(year, month + 1, i + 1)
                    }))

                    const calendarDays = [...prevPadding, ...currentDays, ...nextPadding]
                    const selectedDaySessions = sessions.filter((s) => {
                      if (!selectedCalendarDate) return false
                      const sDate = new Date(s.startTime)
                      return sDate.getFullYear() === selectedCalendarDate.getFullYear() &&
                             sDate.getMonth() === selectedCalendarDate.getMonth() &&
                             sDate.getDate() === selectedCalendarDate.getDate()
                    })

                    return (
                      <>
                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map((d) => (
                            <span key={d} className="text-[10px] text-muted-foreground font-light uppercase py-1">
                              {d}
                            </span>
                          ))}

                          {calendarDays.map((cell, idx) => {
                            const isToday = new Date().toDateString() === cell.date.toDateString()
                            const isSelected = selectedCalendarDate?.toDateString() === cell.date.toDateString()
                            
                            const daySessionsCount = sessions.filter((s) => {
                              const sDate = new Date(s.startTime)
                              return sDate.getFullYear() === cell.date.getFullYear() &&
                                     sDate.getMonth() === cell.date.getMonth() &&
                                     sDate.getDate() === cell.date.getDate()
                            }).length

                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedCalendarDate(cell.date)}
                                className={cn(
                                  "aspect-square flex flex-col items-center justify-between p-1.5 rounded-lg border text-xs transition-all relative",
                                  cell.isCurrentMonth ? "text-foreground" : "text-muted-foreground/35 border-transparent pointer-events-none",
                                  isSelected ? "border-primary bg-primary/5 text-primary" : "border-border/30 hover:bg-muted/10",
                                  isToday && !isSelected && "border-foreground/30 bg-muted/20"
                                )}
                              >
                                <span className={cn("font-light", isToday && "font-normal")}>{cell.day}</span>
                                {daySessionsCount > 0 && (
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full mb-0.5",
                                    isSelected ? "bg-primary" : "bg-primary/55"
                                  )} />
                                )}
                              </button>
                            )
                          })}
                        </div>

                        {/* Selected Day Details */}
                        <div className="border-t border-border/10 pt-4 space-y-2.5">
                          <h4 className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">
                            Sesje w dniu {selectedCalendarDate?.toLocaleDateString('pl-PL')}
                          </h4>
                          
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {selectedDaySessions.length === 0 ? (
                              <p className="text-xs text-muted-foreground font-light py-4 text-center">
                                Brak zaplanowanych sesji na ten dzień.
                              </p>
                            ) : (
                              selectedDaySessions.map((s) => (
                                <div key={s.id} className="p-3 border border-border/40 rounded-xl flex justify-between items-center bg-muted/5">
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-normal text-foreground">{s.class.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-light">
                                      {new Date(s.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} • Sala: {s.room.name} • Zapisy: {s.bookings.length} / {s.maxCapacity}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    {(currentUserRole === 'ADMIN' || s.instructorId === currentInstructorId) && (
                                      <Button size="xs" variant="outline" className="font-light gap-1" onClick={() => setViewingBookingsSession(s)}>
                                        <Users className="w-3.5 h-3.5" />
                                        <span>Zapisy ({s.bookings.length})</span>
                                      </Button>
                                    )}
                                    {(currentUserRole === 'ADMIN' || s.instructorId === currentInstructorId) && (
                                      <Button size="xs" variant="destructive" className="font-light" onClick={() => handleDeleteSession(s.id)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
 
        {/* VIEW: INSTRUCTORS */}
        {activeView === 'instructors' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form */}
            <div className="lg:col-span-1 border border-border/60 rounded-xl bg-card p-5 space-y-4">
              <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Dodaj instruktora</h3>
              <form onSubmit={handleInstructorSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <Label className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Wybierz użytkownika</Label>
                  <select
                    value={instUserId}
                    onChange={(e) => setInstUserId(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-xs font-light shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Wybierz...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="i-bio" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Biogram / Opis</Label>
                  <Textarea id="i-bio" value={instBio} onChange={(e) => setInstBio(e.target.value)} rows={3} className="font-light text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="i-img" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">URL Zdjęcia</Label>
                  <Input id="i-img" value={instImageUrl} onChange={(e) => setInstImageUrl(e.target.value)} placeholder="https://..." className="h-9 font-light" />
                </div>
                <Button type="submit" className="w-full font-light h-9 text-xs">Zatwierdź kadrowicza</Button>
              </form>
            </div>
 
            {/* List */}
            <div className="lg:col-span-2 border border-border/60 rounded-xl bg-card overflow-hidden">
              <div className="p-4 border-b border-border/10">
                <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Kadra instruktorska</h3>
              </div>
              <div className="divide-y divide-border/10 max-h-[500px] overflow-y-auto">
                {instructors.map((inst) => (
                  <div key={inst.id} className="p-4 flex justify-between items-center hover:bg-muted/5 transition-colors">
                    <div className="flex items-center gap-4">
                      {inst.user.imageUrl ? (
                        <img src={inst.user.imageUrl} alt={inst.user.firstName} className="w-10 h-10 rounded-full object-cover border border-border/40" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border/60 text-[10px] text-muted-foreground font-light">No Photo</div>
                      )}
                      <div>
                        <p className="text-sm font-light text-foreground">{inst.user.firstName} {inst.user.lastName}</p>
                        <p className="text-[10px] text-muted-foreground font-light line-clamp-1">{inst.bio}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="destructive" className="font-light" onClick={() => handleDeleteInst(inst.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
 
        {/* VIEW: FACILITIES (LOCATIONS & ROOMS) */}
        {activeView === 'facilities' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Locations */}
            <div className="space-y-6">
              <div className="border border-border/60 rounded-xl bg-card p-5 space-y-4">
                <h3 className="text-sm font-light text-foreground uppercase tracking-wider">{editingLocId ? 'Edytuj placówkę' : 'Utwórz placówkę'}</h3>
                <form onSubmit={handleLocationSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="l-name" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Nazwa</Label>
                    <Input id="l-name" value={locName} onChange={(e) => setLocName(e.target.value)} required className="h-9 font-light" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="l-addr" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Adres</Label>
                    <Input id="l-addr" value={locAddress} onChange={(e) => setLocAddress(e.target.value)} className="h-9 font-light" />
                  </div>
                  <Button type="submit" className="w-full font-light h-9 text-xs">{editingLocId ? 'Zapisz zmiany' : 'Utwórz placówkę'}</Button>
                  {editingLocId && (
                    <Button variant="outline" className="w-full font-light h-9 text-xs" onClick={() => {
                      setEditingLocId(null)
                      setLocName('')
                      setLocAddress('')
                    }}>
                      Anuluj edycję
                    </Button>
                  )}
                </form>
              </div>
 
              <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
                <div className="p-4 border-b border-border/10">
                  <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Nasze placówki</h3>
                </div>
                <div className="divide-y divide-border/10">
                  {locations.map((loc) => (
                    <div key={loc.id} className="p-4 flex justify-between items-center hover:bg-muted/5 transition-colors">
                      <div className="space-y-0.5">
                        <p className="text-sm font-light text-foreground">{loc.name}</p>
                        <p className="text-[10px] text-muted-foreground font-light">{loc.address}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="xs" variant="outline" className="font-light" onClick={() => handleEditLocation(loc)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="xs" variant="destructive" className="font-light" onClick={() => handleDeleteLocation(loc.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
 
            {/* Rooms */}
            <div className="space-y-6">
              <div className="border border-border/60 rounded-xl bg-card p-5 space-y-4">
                <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Dodaj salę ćwiczeń</h3>
                <form onSubmit={handleRoomSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Lokalizacja</Label>
                    <select
                      value={roomLocId}
                      onChange={(e) => setRoomLocId(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-xs font-light shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Wyszukaj placówkę...</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="r-name" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Nazwa sali</Label>
                      <Input id="r-name" value={roomName} onChange={(e) => setRoomName(e.target.value)} required className="h-9 font-light" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="r-cap" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Max osób</Label>
                      <Input id="r-cap" type="number" value={roomCapacity} onChange={(e) => setRoomCapacity(Number(e.target.value))} required className="h-9 font-light" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full font-light h-9 text-xs">Dodaj salę</Button>
                </form>
              </div>
 
              <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
                <div className="p-4 border-b border-border/10">
                  <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Sale według placówek</h3>
                </div>
                <div className="divide-y divide-border/10 bg-muted/5">
                  {locations.map((loc) => (
                    <div key={loc.id} className="p-4 space-y-2">
                      <h4 className="text-[10px] tracking-wider font-light text-primary uppercase">{loc.name}</h4>
                      {loc.rooms.length === 0 ? (
                        <p className="text-xs text-muted-foreground font-light italic">Brak sal.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {loc.rooms.map((room: any) => (
                            <div key={room.id} className="flex justify-between items-center bg-card p-2 rounded-lg text-xs font-light border border-border/40">
                              <span className="text-muted-foreground">{room.name} (maksymalnie {room.capacity} osób)</span>
                              <Button size="xs" variant="ghost" className="text-red-500 hover:text-red-700 h-6 w-6 p-0 rounded-lg" onClick={() => handleDeleteRoom(room.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
 
        {/* VIEW: LOGS */}
        {activeView === 'logs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 border border-border/60 rounded-xl bg-card p-5 space-y-4">
              <h3 className="text-sm font-light text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-green-600" /> Pobierz arkusz CSV
              </h3>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">
                Wyeksportuj całą zawartość baz danych do pliku w formacie arkusza kalkulacyjnego.
              </p>
              <div className="space-y-2">
                <a
                  href="/api/admin/export-csv?type=users"
                  download
                  className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start gap-2 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 font-light h-9 text-xs")}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Eksportuj użytkowników
                </a>
                <a
                  href="/api/admin/export-csv?type=bookings"
                  download
                  className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start gap-2 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 font-light h-9 text-xs")}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Eksportuj rezerwacje
                </a>
                <a
                  href="/api/admin/export-csv?type=classes"
                  download
                  className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start gap-2 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 font-light h-9 text-xs")}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Eksportuj zajęcia
                </a>
              </div>
            </div>
 
            <div className="lg:col-span-2 border border-border/60 rounded-xl bg-card overflow-hidden">
              <div className="p-4 border-b border-border/10">
                <h3 className="text-sm font-light text-foreground uppercase tracking-wider">Log zdarzeń systemowych</h3>
              </div>
              <div className="divide-y divide-border/10 max-h-[500px] overflow-y-auto">
                {activityLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-light p-6 text-center">Brak zdarzeń w bazie.</p>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="p-3.5 hover:bg-muted/5 transition-colors text-xs font-light space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-primary font-light uppercase tracking-wider text-[9px] bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{log.action}</span>
                        <span className="text-[9px] text-muted-foreground font-light">{new Date(log.createdAt).toLocaleString('pl-PL')}</span>
                      </div>
                      <p className="text-foreground">{log.details}</p>
                      <p className="text-[10px] text-muted-foreground font-light">Pracownik: {log.user.firstName} {log.user.lastName} ({log.user.email})</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {/* Bookings Modal */}
        {viewingBookingsSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <button 
                type="button"
                onClick={() => setViewingBookingsSession(null)}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground text-sm font-light p-1"
              >
                ✕
              </button>
              <div>
                <h3 className="text-[10px] font-light uppercase tracking-wider text-muted-foreground">Lista zapisanych osób</h3>
                <h4 className="text-base font-normal text-foreground mt-0.5">{viewingBookingsSession.class.name}</h4>
                <p className="text-[10px] text-muted-foreground font-light mt-0.5">
                  {new Date(viewingBookingsSession.startTime).toLocaleString('pl-PL')} • Sala: {viewingBookingsSession.room.name}
                </p>
              </div>

              <div className="border border-border/60 rounded-xl divide-y divide-border/60 max-h-[260px] overflow-y-auto bg-muted/10">
                {viewingBookingsSession.bookings.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground font-light">
                    Brak zapisanych uczestników na tę sesję.
                  </div>
                ) : (
                  viewingBookingsSession.bookings.map((b: any) => (
                    <div key={b.id} className="p-3.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-normal text-foreground">{b.user.firstName} {b.user.lastName}</p>
                        <p className="text-[10px] text-muted-foreground font-light">{b.user.email}</p>
                      </div>
                      <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-light">
                        Zapisany
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-1">
                <Button variant="outline" className="font-light text-xs h-8 px-4" onClick={() => setViewingBookingsSession(null)}>
                  Zamknij
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
