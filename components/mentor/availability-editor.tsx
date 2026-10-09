'use client'

import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'

import { adminFormError, formError } from '@/lib/auth/errors'
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
import styles from './dashboard/mentor-secondary-sections.module.css'

type AvailabilityConfigured = {
  current: boolean
  next: boolean
}

type Props = {
  mentorId: string
  mode: 'mentor' | 'admin'
  language?: 'en' | 'id'
  onSaved?: (configured: AvailabilityConfigured) => void
}

const ENGLISH_DAY_NAMES: Record<DayOfWeek, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
}

function newDraftRange(dayOfWeek: DayOfWeek, weekStartDate: string): AvailabilityDraftRange {
  return {
    key: globalThis.crypto?.randomUUID?.() || `${weekStartDate}-${dayOfWeek}-${Date.now()}`,
    dayOfWeek,
    startTime: '09:00',
    endTime: '10:00',
  }
}

function weekLabel(week: AvailabilityWeekOption, english: boolean) {
  if (english) return week.kind === 'current' ? 'This week' : 'Next week'
  return week.kind === 'current' ? 'Minggu Ini' : 'Minggu Depan'
}

function formatWeekRange(week: AvailabilityWeekOption, english: boolean) {
  const formatter = new Intl.DateTimeFormat(english ? 'en-GB' : 'id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const start = formatter.format(new Date(`${week.weekStartDate}T00:00:00.000Z`))
  const end = formatter.format(new Date(`${week.weekEndDate}T00:00:00.000Z`))
  return `${start} – ${end}`
}

function englishValidationMessage(message: string) {
  if (message === 'Pilih hari antara Senin dan Minggu.') return 'Select a day between Monday and Sunday.'
  if (message === 'Gunakan format waktu 24 jam HH:mm.') return 'Use 24-hour time in HH:mm format.'
  if (message === 'Waktu selesai harus setelah waktu mulai.') return 'End time must be after start time.'
  if (message.startsWith('Rentang waktu hari ') && message.endsWith(' saling tumpang tindih.')) {
    return 'Time ranges on the same day cannot overlap.'
  }
  return 'Check the availability time ranges and try again.'
}

export function MentorAvailabilityEditor({ mentorId, mode, onSaved, language }: Props) {
  const english = language ? language === 'en' : mode === 'mentor'
  const text = (englishText: string, indonesianText: string) => english ? englishText : indonesianText
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
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true)
      setMessage('')
      setLoadFailed(false)
    }
    setError('')
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
      setDirty(false)
    } catch (caught) {
      if (showLoading) setLoadFailed(true)
      setError(english ? adminFormError(caught, 'Availability could not be loaded.') : formError(caught, 'Ketersediaan mentor belum dapat dimuat.'))
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [english, mentorId])

  useEffect(() => { void load() }, [load])
  useOperationalInvalidation(['availability'], () => {
    if (!dirty) void load(false)
  })

  const selectedWeek = useMemo(
    () => weeks.find(week => week.weekStartDate === selectedWeekStart) || null,
    [selectedWeekStart, weeks],
  )
  const ranges = useMemo(
    () => selectedWeekStart ? rangesByWeek[selectedWeekStart] || [] : [],
    [rangesByWeek, selectedWeekStart],
  )
  const grouped = useMemo(() => groupAvailabilityByDay(ranges), [ranges])

  function replaceSelectedRanges(update: (current: AvailabilityDraftRange[]) => AvailabilityDraftRange[]) {
    if (!selectedWeekStart) return
    setRangesByWeek(current => ({
      ...current,
      [selectedWeekStart]: update(current[selectedWeekStart] || []),
    }))
    setDirty(true)
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
      setError(text('Select a week to edit.', 'Pilih minggu yang ingin diatur.'))
      return
    }
    const validationError = validateAvailabilityDraft(ranges)
    if (validationError) {
      setError(english ? englishValidationMessage(validationError) : validationError)
      return
    }
    setBusy(true)
    try {
      const payload = toAvailabilityPayload(ranges) as unknown as Json
      const { data, error: saveError } = await createClient().rpc('save_mentor_availability', {
        p_mentor_id: mentorId,
        p_week_start_date: selectedWeekStart,
        p_rules: payload,
      })
      if (saveError) throw saveError
      const persisted = availabilityRulesToDraft(data || [])
      const nextRangesByWeek = { ...rangesByWeek, [selectedWeekStart]: persisted }
      setRangesByWeek(nextRangesByWeek)
      setDirty(false)
      setMessage(english ? 'Availability saved.' : `Ketersediaan ${weekLabel(selectedWeek, false).toLowerCase()} telah disimpan.`)
      const currentWeek = weeks.find(week => week.kind === 'current')
      const nextWeek = weeks.find(week => week.kind === 'next')
      onSaved?.({
        current: Boolean(currentWeek && nextRangesByWeek[currentWeek.weekStartDate]?.length),
        next: Boolean(nextWeek && nextRangesByWeek[nextWeek.weekStartDate]?.length),
      })
    } catch (caught) {
      setError(english
        ? adminFormError(caught, 'Availability could not be saved. Your changes are still in the form.')
        : formError(caught, 'Ketersediaan belum dapat disimpan. Perubahan Anda tetap ada di formulir.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className={styles.loading} role="status">{text('Loading availability…', 'Memuat ketersediaan…')}</p>
  if (loadFailed) return (
    <div className={`mentor-availability-load-error ${styles.loadError}`}>
      <p className="form-error" role="alert">{error}</p>
      <button type="button" className="button button-outline" onClick={() => void load()}>{text('Try again', 'Coba lagi')}</button>
    </div>
  )

  return (
    <div className={`mentor-availability-editor ${mode} ${styles.editor}`} data-unsaved={dirty ? 'true' : undefined} data-saving={busy ? 'true' : undefined}>
      <MentorDomainSummary tierName={tierName} timezone={timezone} language={english ? 'en' : 'id'} />
      <div className={`availability-week-switcher ${styles.weekSwitcher}`} role="group" aria-label={text('Select availability week', 'Pilih minggu ketersediaan')}>
        {weeks.map(week => (
          <button
            type="button"
            key={week.weekStartDate}
            className={`availability-week-option ${styles.weekOption}`}
            aria-pressed={selectedWeekStart === week.weekStartDate}
            disabled={busy}
            onClick={() => { setSelectedWeekStart(week.weekStartDate); setError(''); setMessage('') }}
          >
            <span>{weekLabel(week, english)}</span>
            <small>{formatWeekRange(week, english)}</small>
          </button>
        ))}
      </div>
      <form className={styles.form} onSubmit={save}>
        <div className={`availability-week ${styles.weekGrid}`}>
          {DAYS_OF_WEEK.map(day => {
            const dayLabel = english ? ENGLISH_DAY_NAMES[day.value] : day.label
            const count = grouped[day.value].length
            const countLabel = english
              ? count === 0 ? 'Not available' : count === 1 ? '1 time range' : `${count} time ranges`
              : count ? `${count} rentang waktu` : 'Tidak tersedia'
            return (
              <section className={`availability-day ${styles.dayCard}`} key={day.value} aria-labelledby={`availability-day-${mentorId}-${selectedWeekStart}-${day.value}`}>
                <div className={`availability-day-heading ${styles.dayHeading}`}>
                  <div>
                    <h3 id={`availability-day-${mentorId}-${selectedWeekStart}-${day.value}`}>{dayLabel}</h3>
                    <small>{countLabel}</small>
                  </div>
                  <button type="button" className={styles.addRange} disabled={!selectedWeekStart || busy} onClick={() => addRange(day.value)}>
                    <Plus aria-hidden="true" />
                    {text('Add range', 'Tambah rentang')}
                  </button>
                </div>
                {grouped[day.value].map((range, index) => (
                  <div className={`availability-range ${styles.range}`} key={range.key}>
                    <label>
                      {text('Start', 'Mulai')}
                      <span className="sr-only"> {dayLabel} {text('range', 'rentang')} {index + 1}</span>
                      <input
                        type="time"
                        step={60}
                        value={range.startTime}
                        disabled={busy}
                        onChange={event => updateRange(range.key, 'startTime', event.target.value)}
                        required
                      />
                    </label>
                    <span aria-hidden="true">–</span>
                    <label>
                      {text('End', 'Selesai')}
                      <span className="sr-only"> {dayLabel} {text('range', 'rentang')} {index + 1}</span>
                      <input
                        type="time"
                        step={60}
                        value={range.endTime}
                        disabled={busy}
                        onChange={event => updateRange(range.key, 'endTime', event.target.value)}
                        required
                      />
                    </label>
                    <button
                      type="button"
                      className={`availability-remove ${styles.removeButton}`}
                      disabled={busy}
                      onClick={() => removeRange(range.key)}
                      aria-label={english ? `Remove range ${index + 1} on ${dayLabel}` : `Hapus rentang ${index + 1} hari ${dayLabel}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </section>
            )
          })}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <div className={`availability-actions ${styles.actions}`}>
          <button type="submit" className="button button-primary" disabled={busy || !selectedWeekStart}>
            <Save aria-hidden="true" />
            {busy
              ? text('Saving…', 'Menyimpan…')
              : selectedWeek
                ? text(`Save ${weekLabel(selectedWeek, true).toLowerCase()}`, `Simpan ${weekLabel(selectedWeek, false)}`)
                : text('Save availability', 'Simpan ketersediaan')}
          </button>
          <button type="button" className="button button-outline" disabled={busy} onClick={() => void load()}>
            <RotateCcw aria-hidden="true" />
            {text('Discard changes', 'Batalkan perubahan')}
          </button>
        </div>
      </form>
    </div>
  )
}
