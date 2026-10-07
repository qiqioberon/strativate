'use client'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { clearBrowserAuthPersistenceMode } from '@/lib/auth/session-persistence'
import { createClient } from '@/lib/supabase/client'
export function SignOut({ className, withIcon = false, language = 'id' }: { className?: string; withIcon?: boolean; language?: 'id' | 'en' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function signOut() {
    setBusy(true); setError(false)
    try {
      const { error } = await createClient().auth.signOut({ scope: 'local' })
      if (error) throw error
      clearBrowserAuthPersistenceMode()
      window.location.replace('/auth')
    } catch { setError(true); setBusy(false) }
  }
  return <><button type="button" className={className} onClick={signOut} disabled={busy}>{withIcon && <LogOut aria-hidden="true" />}{language === 'en' ? (busy ? 'Signing out…' : 'Sign out') : (busy ? 'Keluar…' : 'Keluar')}</button>{error && <p className="form-error" role="alert">{language === 'en' ? 'We couldn\'t sign you out. Please try again.' : 'Belum berhasil keluar. Coba lagi.'}</p>}</>
}
