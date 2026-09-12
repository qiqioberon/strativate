'use client'

import { useState } from 'react'

import { formError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import type { MentorTier } from '@/lib/supabase/database.types'

type Props = {
  mentorId: string
  mentorName: string
  value: string | null
  currentTierName: string | null
  tiers: MentorTier[]
  onSaved: (tierId: string) => void
  onFailure: (message: string) => void | Promise<void>
}

export function MentorTierSelect({ mentorId, mentorName, value, currentTierName, tiers, onSaved, onFailure }: Props) {
  const [busy, setBusy] = useState(false)
  const currentTierIsInactive = !!value && !tiers.some(tier => tier.id === value)

  async function changeTier(tierId: string) {
    if (!tierId || tierId === value) return
    setBusy(true)
    try {
      const { error } = await createClient().rpc('set_mentor_tier', {
        p_mentor_id: mentorId,
        p_tier_id: tierId,
      })
      if (error) throw error
      onSaved(tierId)
    } catch (error) {
      await onFailure(formError(error, 'Tier mentor belum dapat diperbarui.'))
    } finally {
      setBusy(false)
    }
  }

  return <div className="mentor-tier-control">
    <label htmlFor={`mentor-tier-${mentorId}`}>Tier</label>
    <select
      id={`mentor-tier-${mentorId}`}
      value={value || ''}
      disabled={busy || tiers.length === 0}
      aria-label={`Tier ${mentorName}`}
      onChange={event => void changeTier(event.target.value)}
    >
      <option value="" disabled>Tier belum ditentukan</option>
      {currentTierIsInactive && <option value={value!} disabled>{currentTierName || 'Tier nonaktif'} · Nonaktif</option>}
      {tiers.map(tier => <option value={tier.id} key={tier.id}>{tier.name}</option>)}
    </select>
    {busy && <small role="status">Menyimpan tier…</small>}
  </div>
}
