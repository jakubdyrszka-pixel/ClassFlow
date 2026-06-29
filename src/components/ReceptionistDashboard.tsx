'use client'
 
import React, { useState, useEffect } from 'react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, ArrowUpRight, Trash, ScanLine, CameraOff, UserCheck, Printer, Compass, BookOpen, AlertCircle, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { cn } from '@/lib/utils'

import {
  searchClients,
  quickBook,
  markPaymentPaid,
  checkInClient,
  promoteFromWaitlist,
  updateSessionInstructor,
  removeFromWaitlist,
  receptionistCancelBooking,
  createClientAccount,
} from '@/actions/receptionist'
 
interface ReceptionistDashboardProps {
  sessions: any[]
  instructors: any[]
}
 
export default function ReceptionistDashboard({ sessions, instructors }: ReceptionistDashboardProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
 
  // Active Tab: schedule, checkins, waitlist, quickbook
  const [activeView, setActiveView] = useState<'schedule' | 'checkins' | 'waitlist' | 'quickbook'>('checkins')
 
  // QR Scanning States
  const [isScanningOpen, setIsScanningOpen] = useState(false)
 
  // Create Client Form State
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientFirstName, setNewClientFirstName] = useState('')
  const [newClientLastName, setNewClientLastName] = useState('')
  const [isCreatingClient, setIsCreatingClient] = useState(false)
 
  const activeSession = sessions.find((s) => s.id === selectedSessionId)
 
  // Debounced search for clients
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
 
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await searchClients({ query: searchQuery })
        if (res && res.data) {
          setSearchResults(res.data)
        } else if (res?.serverError || res?.validationErrors) {
          toast.error(res?.serverError || 'Błąd walidacji')
        }
      } catch (err) {
        toast.error('Błąd podczas wyszukiwania klientów.')
      } finally {
        setIsSearching(false)
      }
    }, 300)
 
    return () => clearTimeout(delayDebounce)
  }, [searchQuery])
 
  // Select first session by default
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id)
    }
  }, [sessions, selectedSessionId])
 
  // QR Code Scanner Effect
  useEffect(() => {
    if (!isScanningOpen) return
 
    const timer = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          'reader',
          { fps: 10, qrbox: { width: 200, height: 200 } },
          false
        )
 
        scanner.render(
          async (decodedText) => {
            scanner.clear().catch((e) => console.error(e))
            setIsScanningOpen(false)
            
            toast.info('Skanowanie powiodło się! Przetwarzanie wejścia...')
            
            const res = await checkInClient({ bookingId: decodedText, checkedIn: true })
            if (res?.serverError || res?.validationErrors) {
              toast.error(res?.serverError || 'Błąd walidacji')
            } else if (res?.data) {
              toast.success('Pomyślnie oznaczono obecność klienta!')
            }
          },
          (error) => {
            // Ignore scan failures
          }
        )
 
        return () => {
          scanner.clear().catch((e) => console.error('Error clearing scanner on unmount:', e))
        }
      } catch (e) {
        console.error('Html5QrcodeScanner init error:', e)
      }
    }, 100)
 
    return () => clearTimeout(timer)
  }, [isScanningOpen])
 
  // Quick book client
  const handleQuickBook = async (userId: string) => {
    if (!selectedSessionId) {
      toast.error('Wybierz najpierw zajęcia.')
      return
    }
 
    const res = await quickBook({ userId, classSessionId: selectedSessionId })
    if (res?.serverError || res?.validationErrors) {
      toast.error(res?.serverError || 'Błąd walidacji')
    } else if (res?.data) {
      toast.success(res.data.message || 'Zapisano klienta!')
      setSearchQuery('')
      setSearchResults([])
    }
  }
 
  // Toggle payment
  const handleTogglePayment = async (bookingId: string, currentStatus: boolean) => {
    const res = await markPaymentPaid({ bookingId, hasPaid: !currentStatus })
    if (res?.serverError || res?.validationErrors) {
      toast.error(res?.serverError || 'Błąd walidacji')
    } else if (res?.data) {
      toast.success('Zaktualizowano status płatności!')
    }
  }
 
  // Toggle check-in
  const handleToggleCheckIn = async (bookingId: string, currentStatus: boolean) => {
    const res = await checkInClient({ bookingId, checkedIn: !currentStatus })
    if (res?.serverError || res?.validationErrors) {
      toast.error(res?.serverError || 'Błąd walidacji')
    } else if (res?.data) {
      toast.success('Zaktualizowano status obecności!')
    }
  }
 
  // Promote from waitlist
  const handlePromote = async (waitlistId: string) => {
    const res = await promoteFromWaitlist({ waitlistId })
    if (res?.serverError || res?.validationErrors) {
      toast.error(res?.serverError || 'Błąd walidacji')
    } else if (res?.data) {
      toast.success(res.data.message || 'Promowano klienta!')
    }
  }
 
  // Remove from waitlist
  const handleRemoveWaitlist = async (waitlistId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć klienta z listy rezerwowej?')) return
    const res = await removeFromWaitlist({ waitlistId })
    if (res?.serverError || res?.validationErrors) {
      toast.error(res?.serverError || 'Błąd walidacji')
    } else if (res?.data) {
      toast.success('Usunięto z listy rezerwowej.')
    }
  }
 
  // Cancel booking
  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Czy na pewno chcesz anulować rezerwację tego uczestnika? Jeśli na liście rezerwowej są osoby, pierwsza z nich zostanie automatycznie dopisana.')) {
      return
    }
 
    const res = await receptionistCancelBooking({ bookingId })
    if (res?.serverError || res?.validationErrors) {
      toast.error(res?.serverError || 'Błąd walidacji')
    } else if (res?.data) {
      toast.success('Anulowano rezerwację pomyślnie!')
    }
  }
 
  // Create client account
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClientEmail || !newClientFirstName || !newClientLastName) {
      toast.error('Uzupełnij wszystkie dane konta klienta.')
      return
    }
 
    setIsCreatingClient(true)
    try {
      const res = await createClientAccount({ email: newClientEmail, firstName: newClientFirstName, lastName: newClientLastName })
      if (res?.serverError || res?.validationErrors) {
        toast.error(res?.serverError || 'Błąd walidacji')
      } else if (res?.data) {
        toast.success(res.data.message || 'Utworzono konto klienta!')
        setNewClientEmail('')
        setNewClientFirstName('')
        setNewClientLastName('')
      }
    } catch (err) {
      toast.error('Błąd podczas tworzenia konta.')
    } finally {
      setIsCreatingClient(false)
    }
  }
 
  // Print List function
  const handlePrintList = () => {
    if (!activeSession) return
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
 
    const bookingsHtml = activeSession.bookings.map((b: any) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 10px;">${b.user.firstName} ${b.user.lastName}</td>
        <td style="padding: 10px;">${b.user.email}</td>
        <td style="padding: 10px;">${b.hasPaid ? 'TAK' : 'NIE'}</td>
        <td style="padding: 10px;">${b.attendance ? 'OBECNY' : 'NIEOSIĄGALNY'}</td>
      </tr>
    `).join('')
 
    printWindow.document.write(`
      <html>
        <head>
          <title>Lista uczestników: ${activeSession.class.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; padding: 10px; }
            h2 { margin-bottom: 5px; font-weight: 300; }
            p { color: #666; margin-top: 0; }
          </style>
        </head>
        <body>
          <h2>Lista uczestników: ${activeSession.class.name}</h2>
          <p>Data: ${new Date(activeSession.startTime).toLocaleString('pl-PL')} | Pokój: ${activeSession.room.name} | Instruktor: ${activeSession.instructor.user.firstName} ${activeSession.instructor.user.lastName}</p>
          <table>
            <thead>
              <tr>
                <th>Imię i nazwisko</th>
                <th>E-mail</th>
                <th>Opłacone</th>
                <th>Obecność</th>
              </tr>
            </thead>
            <tbody>
              ${bookingsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }
 
  // Counter stats
  const totalCheckedIn = activeSession?.bookings.filter((b: any) => b.attendance).length || 0;
  const totalBooked = activeSession?.bookings.length || 0;
 
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row border-t border-border/40">
      
      {/* 1. SIDEBAR CONFIGURATION (LEFT) */}
      <aside className="w-full lg:w-64 border-r border-border/30 bg-muted/10 p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light">Recepcja</p>
            <p className="text-xl font-light text-foreground">Front-Desk</p>
          </div>
 
          {/* Active Session Picker */}
          <div className="space-y-1.5 pt-4 border-t border-border/10">
            <Label className="text-[9px] tracking-wider uppercase text-muted-foreground font-light">Dziś w grafiku</Label>
            <Select value={selectedSessionId} onValueChange={(val) => setSelectedSessionId(val || '')}>
              <SelectTrigger className="h-8 font-light text-xs bg-card">
                <SelectValue placeholder="Wybierz sesję..." />
              </SelectTrigger>
              <SelectContent>
                {sessions.length === 0 ? (
                  <SelectItem value="none" disabled className="font-light text-xs">Brak dzisiejszych zajęć</SelectItem>
                ) : (
                  sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="font-light text-xs">
                      {s.class.name} ({new Date(s.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
 
          {activeSession && (
            <div className="text-xs space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/50 text-muted-foreground font-light">
              <p className="text-foreground">{activeSession.class.name}</p>
              <p>Sala: {activeSession.room.name} ({activeSession.room.location.name})</p>
              
              {/* Swap Instructor Dropdown */}
              <div className="pt-2 border-t border-border/10 mt-2 space-y-1.5">
                <Label className="text-[9px] uppercase tracking-wider text-foreground flex items-center gap-1 font-light">
                  <UserCheck className="w-3.5 h-3.5 text-primary" /> Zastępstwo
                </Label>
                <Select
                  value={activeSession.instructorId}
                  onValueChange={async (newInstId) => {
                    const res = await updateSessionInstructor({ sessionId: activeSession.id, instructorId: newInstId || '' })
                    if (res?.serverError || res?.validationErrors) {
                      toast.error(res?.serverError || 'Błąd walidacji')
                    } else if (res?.data) {
                      toast.success('Pomyślnie zmieniono instruktora dla tej sesji!')
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-[11px] font-light bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {instructors.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id} className="text-[11px] font-light">
                        {inst.user.firstName} {inst.user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
 
          {/* Navigation Views */}
          <nav className="space-y-1 pt-2">
            <button
              onClick={() => setActiveView('checkins')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all font-light text-left",
                activeView === 'checkins' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
              )}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Karta obecności ({totalBooked})</span>
            </button>
 
            <button
              onClick={() => setActiveView('waitlist')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all font-light text-left",
                activeView === 'waitlist' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
              )}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Lista rezerwowa ({activeSession?.waitlists.length || 0})</span>
            </button>
 
            <button
              onClick={() => setActiveView('schedule')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all font-light text-left",
                activeView === 'schedule' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Info o sesji</span>
            </button>
 
            <button
              onClick={() => setActiveView('quickbook')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all font-light text-left",
                activeView === 'quickbook' ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/40"
              )}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Szybki zapis / Konto</span>
            </button>
          </nav>
        </div>
 
        <div className="space-y-2 pt-4 border-t border-border/20">
          <Button variant="outline" size="sm" className="w-full text-xs font-light" onClick={handlePrintList} disabled={!activeSession}>
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Drukuj listę
          </Button>
          <div className="text-[10px] text-muted-foreground font-light">ClassFlow v1.1 • Recepcja</div>
        </div>
      </aside>
 
      {/* 2. MAIN HUB (CENTER) */}
      <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-border/20">
          <div>
            <h2 className="text-2xl font-light tracking-wide text-foreground">
              {activeView === 'checkins' && 'Wejścia i rejestracja opłat'}
              {activeView === 'waitlist' && 'Obsługa listy rezerwowej'}
              {activeView === 'schedule' && 'Szczegóły sesji'}
              {activeView === 'quickbook' && 'Baza klientów'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 font-light">
              {activeView === 'checkins' && `Zajęcia: ${activeSession?.class.name || 'brak'}`}
              {activeView === 'waitlist' && `Dopisywanie uczestników do zajęć: ${activeSession?.class.name || 'brak'}`}
              {activeView === 'schedule' && 'Podgląd lokalizacji, pojemności sali i notatek prowadzącego.'}
              {activeView === 'quickbook' && 'Tworzenie kont klienckich i szybkie rezerwacje.'}
            </p>
          </div>
        </div>
 
        {/* VIEW: CHECKINS */}
        {activeView === 'checkins' && (
          <div className="space-y-4">
            {!activeSession ? (
              <div className="border border-dashed border-border/80 rounded-xl text-center py-12 text-muted-foreground font-light text-sm bg-card/20">
                Wybierz najpierw dzisiejsze zajęcia z paska po lewej stronie.
              </div>
            ) : activeSession.bookings.length === 0 ? (
              <div className="border border-dashed border-border/80 rounded-xl text-center py-12 text-muted-foreground font-light text-sm bg-card/20">
                Brak zarejestrowanych uczestników na te zajęcia.
              </div>
            ) : (
              <div className="divide-y divide-border/10 border border-border/50 rounded-xl bg-card overflow-hidden">
                {activeSession.bookings.map((booking: any) => (
                  <div key={booking.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 gap-4 hover:bg-muted/5 transition-colors">
                    <div>
                      <p className="text-sm font-light text-foreground">{booking.user.firstName} {booking.user.lastName}</p>
                      <p className="text-[10px] text-muted-foreground font-light">{booking.user.email}</p>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      {/* Payment */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-light text-muted-foreground cursor-pointer select-none" htmlFor={`pay-${booking.id}`}>
                          {booking.hasPaid ? (
                            <span className="text-green-600 dark:text-green-400 font-light bg-green-500/10 px-2 py-0.5 rounded-full text-[10px] border border-green-500/20">Opłacone</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-light bg-red-500/10 px-2 py-0.5 rounded-full text-[10px] border border-red-500/20">Nieopłacone</span>
                          )}
                        </Label>
                        <Checkbox
                          id={`pay-${booking.id}`}
                          checked={booking.hasPaid}
                          onCheckedChange={() => handleTogglePayment(booking.id, booking.hasPaid)}
                        />
                      </div>
 
                      {/* Check-in */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-light text-muted-foreground cursor-pointer select-none" htmlFor={`check-${booking.id}`}>
                          Zamelduj
                        </Label>
                        <Checkbox
                          id={`check-${booking.id}`}
                          checked={!!booking.attendance}
                          onCheckedChange={() => handleToggleCheckIn(booking.id, !!booking.attendance)}
                        />
                      </div>
 
                      {/* Cancel */}
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-red-500 hover:text-red-700 h-7 w-7 p-0 rounded-lg"
                        onClick={() => handleCancelBooking(booking.id)}
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
 
        {/* VIEW: WAITLIST */}
        {activeView === 'waitlist' && (
          <div className="space-y-4">
            {!activeSession ? (
              <div className="border border-dashed border-border/80 rounded-xl text-center py-12 text-muted-foreground font-light text-sm bg-card/20">
                Wybierz najpierw zajęcia.
              </div>
            ) : activeSession.waitlists.length === 0 ? (
              <div className="border border-dashed border-border/80 rounded-xl text-center py-12 text-muted-foreground font-light text-sm bg-card/20">
                Brak osób na liście rezerwowej.
              </div>
            ) : (
              <div className="divide-y divide-border/10 border border-border/50 rounded-xl bg-card overflow-hidden">
                {activeSession.waitlists.map((w: any, index: number) => (
                  <div key={w.id} className="flex justify-between items-center p-4 hover:bg-muted/5 transition-colors">
                    <div>
                      <p className="text-sm font-light text-foreground">
                        <span className="text-primary font-light mr-1.5">#{index + 1}</span>
                        {w.user.firstName} {w.user.lastName}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-light">{w.user.email}</p>
                    </div>
 
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-500/20 hover:bg-green-500/5 text-xs font-light h-8"
                        onClick={() => handlePromote(w.id)}
                      >
                        Wpisz na zajęcia
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 h-8 text-xs font-light"
                        onClick={() => handleRemoveWaitlist(w.id)}
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
 
        {/* VIEW: SCHEDULE DETAILS */}
        {activeView === 'schedule' && (
          <div className="space-y-4">
            {activeSession ? (
              <div className="border border-border/60 rounded-xl bg-card p-6 space-y-4">
                <div className="space-y-1 pb-3 border-b border-border/10">
                  <h3 className="text-lg font-light text-foreground">{activeSession.class.name}</h3>
                  <p className="text-xs text-muted-foreground font-light">
                    Termin: {new Date(activeSession.startTime).toLocaleString('pl-PL')}
                  </p>
                </div>
                <div className="space-y-2 text-sm font-light text-muted-foreground leading-relaxed">
                  <p><span className="text-foreground">Lokalizacja:</span> {activeSession.room.location.name} ({activeSession.room.location.address || 'Brak adresu'})</p>
                  <p><span className="text-foreground">Sala:</span> {activeSession.room.name} (maksymalnie {activeSession.room.capacity} miejsc)</p>
                  <p><span className="text-foreground">Limit sesji:</span> {activeSession.maxCapacity} miejsc</p>
                  <p><span className="text-foreground">Notatki instruktora:</span> {activeSession.notes || 'Brak notatek.'}</p>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-border/80 rounded-xl text-center py-12 text-muted-foreground font-light text-sm bg-card/20">
                Wybierz najpierw zajęcia.
              </div>
            )}
          </div>
        )}
 
        {/* VIEW: QUICKBOOK & CREATE */}
        {activeView === 'quickbook' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Search & Enroll */}
            <div className="border border-border/60 rounded-xl bg-card p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-light text-foreground">Wyszukaj i zapisz</h3>
                <p className="text-xs text-muted-foreground font-light">Wybierz klienta z bazy, aby dopisać go do bieżącej lekcji.</p>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Imię, nazwisko lub e-mail..."
                  className="pl-9 h-9 font-light"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
 
              {isSearching && <p className="text-xs text-muted-foreground text-center font-light">Szukanie...</p>}
 
              {searchResults.length > 0 && (
                <div className="border border-border/50 rounded-xl max-h-[200px] overflow-y-auto divide-y divide-border/10 bg-muted/10">
                  {searchResults.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => handleQuickBook(client.id)}
                      className="flex justify-between items-center p-3 cursor-pointer hover:bg-card transition-colors"
                    >
                      <div className="text-xs font-light">
                        <p className="text-foreground">{client.firstName} {client.lastName}</p>
                        <p className="text-muted-foreground">{client.email}</p>
                      </div>
                      <span className="text-[10px] text-primary flex items-center gap-0.5 font-light">
                        Dopisz <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
 
              {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                <p className="text-xs text-muted-foreground text-center font-light">Brak wyników wyszukiwania.</p>
              )}
            </div>
 
            {/* Create Account */}
            <div className="border border-border/60 rounded-xl bg-card p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-light text-foreground font-light">Zarejestruj klienta</h3>
                <p className="text-xs text-muted-foreground font-light">Utwórz konto w systemie dla nowego klienta.</p>
              </div>
              
              <form onSubmit={handleCreateClient} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="c-firstname" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Imię</Label>
                    <Input
                      id="c-firstname"
                      value={newClientFirstName}
                      onChange={(e) => setNewClientFirstName(e.target.value)}
                      required
                      className="h-9 font-light"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="c-lastname" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Nazwisko</Label>
                    <Input
                      id="c-lastname"
                      value={newClientLastName}
                      onChange={(e) => setNewClientLastName(e.target.value)}
                      required
                      className="h-9 font-light"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-email" className="text-[10px] tracking-wider uppercase text-muted-foreground font-light">Adres E-mail</Label>
                  <Input
                    id="c-email"
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    required
                    className="h-9 font-light"
                  />
                </div>
                <Button type="submit" className="w-full font-light h-9 text-xs" disabled={isCreatingClient}>
                  {isCreatingClient ? 'Trwa zapis...' : 'Utwórz profil klienta'}
                </Button>
              </form>
            </div>
          </div>
        )}
      </main>
 
      {/* 3. QUICK SCAN & LOOKUP (RIGHT) */}
      <aside className="w-full lg:w-80 border-l border-border/30 bg-muted/5 p-6 space-y-6 shrink-0">
        
        {/* Scanner Widget */}
        <div className="space-y-3">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5 text-primary" /> Melduj wejścia
          </p>
          <div className="border border-border/60 rounded-xl p-4 bg-card text-center space-y-4">
            <p className="text-xs text-muted-foreground font-light leading-relaxed">
              Otwórz obiektyw kamery, aby automatycznie skanować kody kreskowe lub QR z kart wstępu klientów.
            </p>
            <Button onClick={() => setIsScanningOpen(true)} className="w-full gap-2 font-light h-9 text-xs">
              <ScanLine className="w-4 h-4" /> Uruchom skaner
            </Button>
          </div>
        </div>
 
        {/* Capacity Widget */}
        {activeSession && (
          <div className="space-y-3">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-light">Frekwencja</p>
            <div className="border border-border/60 rounded-xl p-4 bg-card space-y-3">
              <div className="flex justify-between items-center text-xs font-light text-muted-foreground">
                <span>Obecni</span>
                <span className="text-foreground">{totalCheckedIn} osób</span>
              </div>
              <div className="flex justify-between items-center text-xs font-light text-muted-foreground">
                <span>Zapisani</span>
                <span className="text-foreground">{totalBooked} / {activeSession.maxCapacity}</span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (totalCheckedIn / (activeSession.maxCapacity || 1)) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </aside>
 
      {/* QR Code Scanner Dialog */}
      <Dialog open={isScanningOpen} onOpenChange={setIsScanningOpen}>
        <DialogContent className="sm:max-w-[380px] text-center">
          <DialogHeader>
            <DialogTitle className="font-light text-base">Skaner kodów QR (Rejestracja wejść)</DialogTitle>
            <DialogDescription className="font-light text-xs">
              Zbliż kod QR z karty wstępu klienta do obiektywu kamery.
            </DialogDescription>
          </DialogHeader>
          <div className="my-3 overflow-hidden rounded-xl border border-border/50 bg-black aspect-video flex items-center justify-center relative">
            <div id="reader" className="w-full h-full"></div>
          </div>
          <Button variant="outline" className="w-full gap-1.5 font-light text-xs" onClick={() => setIsScanningOpen(false)}>
            <CameraOff className="w-4 h-4" /> Zamknij kamerę
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
