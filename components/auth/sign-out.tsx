'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
export function SignOut({ className }: { className?: string }) {
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
  return <><button className={className} onClick={signOut} disabled={busy}>{busy ? 'Keluar…' : 'Keluar'}</button>{error && <p className="form-error" role="alert">Belum berhasil keluar. Coba lagi.</p>}</>
}
