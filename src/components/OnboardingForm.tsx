'use client'

import { useSession } from '@clerk/nextjs'
import { useState } from 'react'
import { completeOnboarding } from '@/actions/onboarding'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function OnboardingForm() {
  const { session } = useSession()
  const [loading, setLoading] = useState(false)

  const handleRoleSelect = async (role: 'USER' | 'INSTRUCTOR') => {
    if (!session) {
      toast.error('Brak aktywnej sesji Clerk.')
      return
    }
    
    setLoading(true)
    
    try {
      const res = await completeOnboarding(role)
      if (res.error) {
        toast.error(res.error)
        setLoading(false)
        return
      }

      toast.info('Odświeżanie sesji użytkownika...')
      
      // Reload Clerk session to fetch the new JWT token with updated publicMetadata
      await session.reload()

      toast.success('Zarejestrowano pomyślnie!')
      
      // Force navigation to clear middleware cache
      window.location.href = role === 'INSTRUCTOR' ? '/instructor' : '/'
    } catch (err) {
      toast.error('Wystąpił nieoczekiwany błąd podczas zapisu.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md w-full p-8 bg-card rounded-2xl border border-border/80 text-center shadow-sm">
      <h1 className="text-2xl font-light mb-4 text-foreground">Dokończ rejestrację</h1>
      <p className="text-muted-foreground mb-6">Wybierz, w jaki sposób będziesz korzystać z aplikacji.</p>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Konfigurowanie Twojego profilu...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => handleRoleSelect('USER')}
            disabled={loading}
            className="w-full p-5 text-left border border-border/80 rounded-xl hover:bg-accent hover:border-primary/20 transition-all active:translate-y-[1px]"
          >
            <h2 className="font-normal text-lg text-foreground">Uczestnik</h2>
            <p className="text-sm text-muted-foreground">Chcę zapisywać się na zajęcia</p>
          </button>
 
          <button
            onClick={() => handleRoleSelect('INSTRUCTOR')}
            disabled={loading}
            className="w-full p-5 text-left border border-border/80 rounded-xl hover:bg-accent hover:border-primary/20 transition-all active:translate-y-[1px]"
          >
            <h2 className="font-normal text-lg text-foreground">Instruktor</h2>
            <p className="text-sm text-muted-foreground">Chcę prowadzić zajęcia</p>
          </button>
        </div>
      )}
    </div>
  )
}
