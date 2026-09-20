'use client'
import { createContext, useContext, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { OperationalRealtimeProvider } from '@/components/realtime/operational-realtime-provider'
import type { Profile } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/client'
type AccountProfile = Profile & { email: string | null }
const AccountContext = createContext<AccountProfile | null>(null)
export function AccountProvider({ profile, email = null, children }: { profile: Profile; email?: string | null; children: React.ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') window.location.replace('/auth')
      else if (event === 'USER_UPDATED') router.refresh()
    })
    return () => subscription.unsubscribe()
  }, [router])
  return <AccountContext.Provider value={{ ...profile, email }}><OperationalRealtimeProvider>{children}</OperationalRealtimeProvider></AccountContext.Provider>
}
export function useAccount() {
  const profile = useContext(AccountContext)
  if (!profile) throw new Error('AccountProvider is required.')
  return profile
}
