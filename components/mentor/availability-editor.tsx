'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import {
  DAYS_OF_WEEK,
  availabilityRulesToDraft,
  availabilityWeekOptions,
  dateInTimeZone,
  groupAvailabilityByDay,
  toAvailabilityPayload,
  validateAvailabilityDraft,
  type AvailabilityDraftRange,
  type AvailabilityWeekOption,
  type DayOfWeek,
} from '@/lib/mentor/availability'
import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/database.types'
import { MentorDomainSummary } from './mentor-domain-summary'

type AvailabilityConfigured = {
  current: boolean
  next: boolean
}

type Props = {
  mentorId: string
  mode: 'mentor' | 'admin'
  onSaved?: (configured: AvailabilityConfigured) => void
}

function newDraftRange(dayOfWeek: DayOfWeek, weekStartDate: string): AvailabilityDraftRange {
  return {
    key: globalThis.crypto?.randomUUID?.() || `${weekStartDate}-${dayOfWeek}-${Date.now()}`,
    dayOfWeek,
    startTime: '09:00',
    endTime: '10:00',
  }
}

function weekLabel(week: AvailabilityWeekOption) {
  return week.kind === 'current' ? 'Minggu Ini' : 'Minggu Depan'
}

function formatWeekRange(week: AvailabilityWeekOption) {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const start = formatter.format(new Date(`${week.weekStartDate}T00:00:00.000Z`))
  const end = formatter.format(new Date(`${week.weekEndDate}T00:00:00.000Z`))
  return `${start} – ${end}`
}

export function MentorAvailabilityEditor({ mentorId, mode, onSaved }: Props) {
  const [rangesByWeek, setRangesByWeek] = useState<Record<string, AvailabilityDraftRange[]>>({})
  const [weeks, setWeeks] = useState<AvailabilityWeekOption[]>([])
  const [selectedWeekStart, setSelectedWeekStart] = useState('')
  const [tierName, setTierName] = useState<string | null>(null)
  const [timezone, setTimezone] = useState('Asia/Jakarta')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    setLoadFailed(false)
    try {
      const db = createClient()
      const profileResult = await db.from('mentor_profiles').select('*').eq('user_id', mentorId).single()
      if (profileResult.error) throw profileResult.error

      const profile = profileResult.data
      const resolvedWeeks = availabilityWeekOptions(dateInTimeZone(new Date(), profile.timezone))
      const weekStarts = resolvedWeeks.map(week => week.weekStartDate)
      const rulesPromise = db
        .from('mentor_availability_rules')
        .select('*')
        .eq('mentor_id', mentorId)
        .in('week_start_date', weekStarts)
        .order('week_start_date')
        .order('day_of_week')
        .order('start_time')
      const tierPromise = profile.tier_id
        ? db.from('mentor_tiers').select('name').eq('id', profile.tier_id).single()
        : Promise.resolve({ data: null, error: null })
      const [rulesResult, tierResult] = await Promise.all([rulesPromise, tierPromise])
      if (rulesResult.error) throw rulesResult.error
      if (tierResult.error) throw tierResult.error

      const nextRangesByWeek = Object.fromEntries(
        resolvedWeeks.map(week => [
          week.weekStartDate,
          availabilityRulesToDraft((rulesResult.data || []).filter(rule => rule.week_start_date === week.weekStartDate)),
        ]),
      ) as Record<string, AvailabilityDraftRange[]>

      setTierName(tierResult.data?.name || null)
      setTimezone(profile.timezone)
      setWeeks(resolvedWeeks)
      setSelectedWeekStart(current => weekStarts.includes(current) ? current : resolvedWeeks[0].weekStartDate)
      setRangesByWeek(nextRangesByWeek)
    } catch (error) {
      setLoadFailed(true)
      setError(formError(error, 'Ketersediaan mentor belum dapat dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [mentorId])

  useEffect(() => { void load() }, [load])

  const selectedWeek = useMemo(
    () => weeks.find(week => week.weekStartDate === selectedWeekStart) || null,
    [selectedWeekStart, weeks],
  )
  const ranges = selectedWeekStart ? rangesByWeek[selectedWeekStart] || [] : []
  const grouped = useMemo(() => groupAvailabilityByDay(ranges), [ranges])

  function replaceSelectedRanges(update: (current: AvailabilityDraftRange[]) => AvailabilityDraftRange[]) {
    if (!selectedWeekStart) return
    setRangesByWeek(current => ({
      ...current,
      [selectedWeekStart]: update(current[selectedWeekStart] || []),
    }))
    setMessage('')
  }

  function addRange(dayOfWeek: DayOfWeek) {
    if (!selectedWeekStart) return
    replaceSelectedRanges(current => [...current, newDraftRange(dayOfWeek, selectedWeekStart)])
  }

  function updateRange(key: string, field: 'startTime' | 'endTime', value: string) {
    replaceSelectedRanges(current => current.map(range => range.key === key ? { ...range, [field]: value } : range))
  }

  function removeRange(key: string) {
    replaceSelectedRanges(current => current.filter(range => range.key !== key))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!selectedWeekStart || !selectedWeek) {
      setError('Pilih minggu yang ingin diatur.')
      return
    }
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
        p_week_start_date: selectedWeekStart,
        p_rules: payload,
      })
      if (error) throw error
      const persisted = availabilityRulesToDraft(data || [])
      const nextRangesByWeek = { ...rangesByWeek, [selectedWeekStart]: persisted }
      setRangesByWeek(nextRangesByWeek)
      setMessage(`Ketersediaan ${weekLabel(selectedWeek).toLowerCase()} telah disimpan.`)
      const currentWeek = weeks.find(week => week.kind === 'current')
      const nextWeek = weeks.find(week => week.kind === 'next')
      onSaved?.({
        current: Boolean(currentWeek && nextRangesByWeek[currentWeek.weekStartDate]?.length),
        next: Boolean(nextWeek && nextRangesByWeek[nextWeek.weekStartDate]?.length),
      })
    } catch (error) {
      setError(formError(error, 'Ketersediaan belum dapat disimpan. Perubahan Anda tetap ada di formulir.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p role="status">Memuat ketersediaan…</p>
  if (loadFailed) return <div className="mentor-availability-load-error">
    <p className="form-error" role="alert">{error}</p>
    <button type="button" className="button button-outline" onClick={() => void load()}>Coba lagi</button>
  </div>

  return <div className={`mentor-availability-editor ${mode}`}>
    <MentorDomainSummary tierName={tierName} timezone={timezone} />
    <div className="availability-week-switcher" role="group" aria-label="Pilih minggu ketersediaan">
      {weeks.map(week => <button
        type="button"
        key={week.weekStartDate}
        className={`button ${selectedWeekStart === week.weekStartDate ? 'button-primary' : 'button-outline'} availability-week-option`}
        aria-pressed={selectedWeekStart === week.weekStartDate}
        disabled={busy}
        onClick={() => { setSelectedWeekStart(week.weekStartDate); setError(''); setMessage('') }}
      >
        <span>{weekLabel(week)}</span>
        <small>{formatWeekRange(week)}</small>
      </button>)}
    </div>
    {selectedWeek && <p className="availability-week-caption">Atur waktu khusus untuk {weekLabel(selectedWeek).toLowerCase()} ({formatWeekRange(selectedWeek)}). Minggu lainnya tidak akan berubah.</p>}
    <form onSubmit={save}>
      <div className="availability-week">
        {DAYS_OF_WEEK.map(day => <section className="availability-day" key={day.value} aria-labelledby={`availability-day-${mentorId}-${selectedWeekStart}-${day.value}`}>
          <div className="availability-day-heading">
            <div><h3 id={`availability-day-${mentorId}-${selectedWeekStart}-${day.value}`}>{day.label}</h3><small>{grouped[day.value].length ? `${grouped[day.value].length} rentang waktu` : 'Tidak tersedia'}</small></div>
            <button type="button" className="text-link" disabled={!selectedWeekStart || busy} onClick={() => addRange(day.value)}><Plus aria-hidden="true" /> Tambah rentang</button>
          </div>
          {grouped[day.value].map((range, index) => <div className="availability-range" key={range.key}>
            <label>Mulai<span className="sr-only"> {day.label} rentang {index + 1}</span><input
              type="time"
              step={60}
              value={range.startTime}
              disabled={busy}
              onChange={event => updateRange(range.key, 'startTime', event.target.value)}
              required
            /></label>
            <span aria-hidden="true">–</span>
            <label>Selesai<span className="sr-only"> {day.label} rentang {index + 1}</span><input
              type="time"
              step={60}
              value={range.endTime}
              disabled={busy}
              onChange={event => updateRange(range.key, 'endTime', event.target.value)}
              required
            /></label>
            <button type="button" className="availability-remove" disabled={busy} onClick={() => removeRange(range.key)} aria-label={`Hapus rentang ${index + 1} hari ${day.label}`}><Trash2 aria-hidden="true" /></button>
          </div>)}
        </section>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <div className="availability-actions">
        <button type="submit" className="button button-primary" disabled={busy || !selectedWeekStart}>{busy ? 'Menyimpan…' : `Simpan ${selectedWeek ? weekLabel(selectedWeek) : 'Ketersediaan'}`}</button>
        <button type="button" className="button button-outline" disabled={busy} onClick={() => void load()}>Batalkan perubahan</button>
      </div>
    </form>
  </div>
}
