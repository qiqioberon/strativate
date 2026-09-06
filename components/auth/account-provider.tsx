'use client'
import { createContext, useContext, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/client'
const AccountContext = createContext<Profile | null>(null)
export function AccountProvider({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') window.location.replace('/auth')
      else if (event === 'USER_UPDATED') router.refresh()
    })
    return () => subscription.unsubscribe()
  }, [router])
  return <AccountContext.Provider value={profile}>{children}</AccountContext.Provider>
}
export function useAccount() {
  const profile = useContext(AccountContext)
  if (!profile) throw new Error('AccountProvider is required.')
  return profile
}
