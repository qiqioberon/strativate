'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import {
  DAYS_OF_WEEK,
  availabilityRulesToDraft,
  groupAvailabilityByDay,
  toAvailabilityPayload,
  validateAvailabilityDraft,
  type AvailabilityDraftRange,
  type DayOfWeek,
} from '@/lib/mentor/availability'
import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/database.types'
import { MentorDomainSummary } from './mentor-domain-summary'

type Props = {
  mentorId: string
  mode: 'mentor' | 'admin'
  onSaved?: (configured: boolean) => void
}

function newDraftRange(dayOfWeek: DayOfWeek): AvailabilityDraftRange {
  return {
    key: globalThis.crypto?.randomUUID?.() || `${dayOfWeek}-${Date.now()}`,
    dayOfWeek,
    startTime: '09:00',
    endTime: '10:00',
  }
}

export function MentorAvailabilityEditor({ mentorId, mode, onSaved }: Props) {
  const [ranges, setRanges] = useState<AvailabilityDraftRange[]>([])
  const [tierName, setTierName] = useState<string | null>(null)
  const [timezone, setTimezone] = useState('Asia/Jakarta')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const db = createClient()
      const [profileResult, rulesResult] = await Promise.all([
        db.from('mentor_profiles').select('*').eq('user_id', mentorId).single(),
        db.from('mentor_availability_rules').select('*').eq('mentor_id', mentorId).order('day_of_week').order('start_time'),
      ])
      if (profileResult.error) throw profileResult.error
      if (rulesResult.error) throw rulesResult.error
      const profile = profileResult.data
      let resolvedTierName: string | null = null
      if (profile.tier_id) {
        const tierResult = await db.from('mentor_tiers').select('name').eq('id', profile.tier_id).single()
        if (tierResult.error) throw tierResult.error
        resolvedTierName = tierResult.data.name
      }
      setTierName(resolvedTierName)
      setTimezone(profile.timezone)
      setRanges(availabilityRulesToDraft(rulesResult.data || []))
    } catch (error) {
      setError(formError(error, 'Ketersediaan mentor belum dapat dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [mentorId])

  useEffect(() => { void load() }, [load])

  const grouped = useMemo(() => groupAvailabilityByDay(ranges), [ranges])

  function addRange(dayOfWeek: DayOfWeek) {
    setRanges(current => [...current, newDraftRange(dayOfWeek)])
    setMessage('')
  }

  function updateRange(key: string, field: 'startTime' | 'endTime', value: string) {
    setRanges(current => current.map(range => range.key === key ? { ...range, [field]: value } : range))
    setMessage('')
  }

  function removeRange(key: string) {
    setRanges(current => current.filter(range => range.key !== key))
    setMessage('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    const validationError = validateAvailabilityDraft(ranges)
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    try {
      const payload = toAvailabilityPayload(ranges) as unknown as Json
      const { data, error } = await createClient().rpc('save_mentor_availability', {
        p_mentor_id: mentorId,
        p_rules: payload,
      })
      if (error) throw error
      const persisted = availabilityRulesToDraft(data || [])
      setRanges(persisted)
      setMessage('Ketersediaan mingguan telah disimpan.')
      onSaved?.(persisted.length > 0)
    } catch (error) {
      setError(formError(error, 'Ketersediaan belum dapat disimpan. Perubahan Anda tetap ada di formulir.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p role="status">Memuat ketersediaan…</p>

  return <div className={`mentor-availability-editor ${mode}`}>
    <MentorDomainSummary tierName={tierName} timezone={timezone} />
    <form onSubmit={save}>
      <div className="availability-week">
        {DAYS_OF_WEEK.map(day => <section className="availability-day" key={day.value} aria-labelledby={`availability-day-${mentorId}-${day.value}`}>
          <div className="availability-day-heading">
            <div><h3 id={`availability-day-${mentorId}-${day.value}`}>{day.label}</h3><small>{grouped[day.value].length ? `${grouped[day.value].length} rentang waktu` : 'Tidak tersedia'}</small></div>
            <button type="button" className="text-link" onClick={() => addRange(day.value)}><Plus aria-hidden="true" /> Tambah rentang</button>
          </div>
          {grouped[day.value].map((range, index) => <div className="availability-range" key={range.key}>
            <label>Mulai<span className="sr-only"> {day.label} rentang {index + 1}</span><input
              type="time"
              step={60}
              value={range.startTime}
              onChange={event => updateRange(range.key, 'startTime', event.target.value)}
              required
            /></label>
            <span aria-hidden="true">–</span>
            <label>Selesai<span className="sr-only"> {day.label} rentang {index + 1}</span><input
              type="time"
              step={60}
              value={range.endTime}
              onChange={event => updateRange(range.key, 'endTime', event.target.value)}
              required
            /></label>
            <button type="button" className="availability-remove" onClick={() => removeRange(range.key)} aria-label={`Hapus rentang ${index + 1} hari ${day.label}`}><Trash2 aria-hidden="true" /></button>
          </div>)}
        </section>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <div className="availability-actions">
        <button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan Ketersediaan'}</button>
        <button type="button" className="button button-outline" disabled={busy} onClick={() => void load()}>Batalkan perubahan</button>
      </div>
    </form>
  </div>
}
