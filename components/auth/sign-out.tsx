'use client'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
export function SignOut({ className, withIcon = false }: { className?: string; withIcon?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function signOut() {
    setBusy(true); setError(false)
    try {
      const { error } = await createClient().auth.signOut({ scope: 'local' })
      if (error) throw error
      window.location.replace('/auth')
    } catch { setError(true); setBusy(false) }
  }
  return <><button type="button" className={className} onClick={signOut} disabled={busy}>{withIcon && <LogOut aria-hidden="true" />}{busy ? 'Keluar…' : 'Keluar'}</button>{error && <p className="form-error" role="alert">Belum berhasil keluar. Coba lagi.</p>}</>
}
