'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { inviteMentor } from '@/lib/admin/invite-mentor'
import { formError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import type { MentorTier } from '@/lib/supabase/database.types'

export function MentorInviteForm({ onInvited }: { onInvited: () => void | Promise<void> }) {
  const [tiers, setTiers] = useState<MentorTier[]>([])
  const [loadingTiers, setLoadingTiers] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadTiers = useCallback(async () => {
    setLoadingTiers(true)
    try {
      const { data, error } = await createClient().from('mentor_tiers').select('*').eq('is_active', true).order('sort_order').order('name')
      if (error) throw error
      setTiers(data || [])
    } catch (error) {
      setError(formError(error, 'Daftar tier mentor belum dapat dimuat.'))
    } finally {
      setLoadingTiers(false)
    }
  }, [])

  useEffect(() => { void loadTiers() }, [loadTiers])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const result = await inviteMentor(String(data.get('email') || ''), String(data.get('tier_id') || ''))
      if (result.error) {
        setError(result.error)
        return
      }
      setMessage(result.success || 'Undangan dikirim.')
      form.reset()
      await onInvited()
    } catch (error) {
      setError(formError(error, 'Undangan belum dapat dikirim. Coba lagi.'))
    } finally {
      setBusy(false)
    }
  }

  return <form className="auth-form mentor-invite-form" onSubmit={submit}>
    <div className="mentor-invite-fields">
      <label>Email mentor<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <label>Tier mentor<select name="tier_id" required defaultValue="" disabled={loadingTiers || tiers.length === 0}>
        <option value="" disabled>{loadingTiers ? 'Memuat tier…' : 'Pilih tier'}</option>
        {tiers.map(tier => <option value={tier.id} key={tier.id}>{tier.name}</option>)}
      </select></label>
    </div>
    <button type="submit" className="button button-primary" disabled={busy || loadingTiers || tiers.length === 0}>
      {busy ? 'Mengirim…' : 'Kirim Undangan'}
    </button>
    {error && <p role="alert" className="form-error">{error}</p>}
    {message && <p role="status">{message}</p>}
  </form>
}
