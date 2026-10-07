'use client'

import { CalendarDays, ChevronRight, Clock3, Loader2, Search, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import styles from './mentor-availability.module.css'

import {
  buildTwoWeekDateKeys,
  filterMenteeAvailability,
  replaceMenteeMentorDayAvailability,
  type MenteeAvailabilityDay,
  type MenteeAvailabilityFilters,
  type MenteeAvailabilityMentor,
  type MenteeAvailabilityPayload,
} from '@/lib/private-mentoring/mentee-availability'

const EMPTY_FILTERS: MenteeAvailabilityFilters = {
  mentorQuery: '',
  tierId: '',
  date: '',
  timeStart: '',
  timeEnd: '',
}

type SelectedDetail = {
  mentor: MenteeAvailabilityMentor
  day: MenteeAvailabilityDay
}

function dateValue(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`)
}

function compactDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(dateValue(dateKey))
}

function fullDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateValue(dateKey))
}

function timeRange(start: string, end: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone })
  return `${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`
}

function dateButtonLabel(dateKey: string, day: MenteeAvailabilityDay | undefined) {
  const label = fullDate(dateKey)
  return day ? `${label}, available, ${day.slots.length} valid slots` : `${label}, unavailable`
}

export function MentorAvailabilityExplorer() {
  const [payload, setPayload] = useState<MenteeAvailabilityPayload | null>(null)
  const [filters, setFilters] = useState<MenteeAvailabilityFilters>(EMPTY_FILTERS)
  const [expandedMentorId, setExpandedMentorId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null)
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const detailRequestRef = useRef<string | null>(null)

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/mentee/mentor-availability', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error('Unable to load mentor availability. Please try again.')
      setPayload(data as MenteeAvailabilityPayload)
    } catch {
      setError('Unable to load mentor availability. Please try again.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selectedDetail && !dialog.open) dialog.showModal()
    if (!selectedDetail && dialog.open) dialog.close()
  }, [selectedDetail])

  const invalidTimeRange = Boolean(filters.timeStart && filters.timeEnd && filters.timeStart > filters.timeEnd)
  const visibleMentors = useMemo(
    () => payload && !invalidTimeRange ? filterMenteeAvailability(payload.mentors, filters) : [],
    [filters, invalidTimeRange, payload],
  )
  const activeFilterCount = [filters.mentorQuery.trim(), filters.tierId, filters.date, filters.timeStart, filters.timeEnd].filter(Boolean).length

  function updateFilter<K extends keyof MenteeAvailabilityFilters>(key: K, value: MenteeAvailabilityFilters[K]) {
    setFilters(current => ({ ...current, [key]: value }))
    setExpandedMentorId(null)
    setSelectedDetail(null)
    setNotice('')
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
    setExpandedMentorId(null)
    setSelectedDetail(null)
    setNotice('')
  }

  function toggleMentor(mentorId: string) {
    setExpandedMentorId(current => current === mentorId ? null : mentorId)
    setSelectedDetail(null)
    setNotice('')
  }

  async function openFreshDay(mentor: MenteeAvailabilityMentor, dateKey: string) {
    const loadingKey = `${mentor.mentorId}:${dateKey}`
    if (detailRequestRef.current) return
    detailRequestRef.current = loadingKey
    setDetailLoadingKey(loadingKey)
    setNotice('')
    try {
      const response = await fetch(`/api/mentee/mentor-availability?mentorId=${encodeURIComponent(mentor.mentorId)}&date=${encodeURIComponent(dateKey)}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error('Unable to check the latest availability. Please try again.')
      const freshPayload = data as MenteeAvailabilityPayload
      const freshMentor = freshPayload.mentors.find(item => item.mentorId === mentor.mentorId) ?? null
      setPayload(current => current ? {
        ...current,
        generatedAt: freshPayload.generatedAt,
        mentors: replaceMenteeMentorDayAvailability(current.mentors, mentor.mentorId, dateKey, freshMentor),
      } : current)
      const freshDay = freshMentor?.days.find(day => day.dateKey === dateKey)
      if (!freshMentor || !freshDay) {
        setSelectedDetail(null)
        setNotice('Availability for this date has changed. The calendar is now updated.')
        return
      }
      setSelectedDetail({ mentor: freshMentor, day: freshDay })
    } catch {
      setSelectedDetail(null)
      setNotice('Unable to check the latest availability. Please try again.')
    } finally {
      detailRequestRef.current = null
      setDetailLoadingKey(null)
    }
  }

  useOperationalInvalidation(['availability'], () => {
    const detail = selectedDetail
    void (async () => {
      await load(false)
      if (detail) await openFreshDay(detail.mentor, detail.day.dateKey)
    })()
  })

  if (loading) {
    return <section className={`mentee-availability-shell ${styles.explorer}`} lang="en" aria-busy="true" aria-label="Loading mentor availability">
      <div className="mentee-availability-loading"><Loader2 className="spin" aria-hidden="true"/><span>Loading available slots…</span></div>
      <div className="mentee-availability-skeleton-grid" aria-hidden="true"><i/><i/><i/></div>
    </section>
  }

  if (error && !payload) {
    return <section className={`workspace-card mentee-availability-error ${styles.explorer}`} lang="en" role="alert">
      <CalendarDays aria-hidden="true"/>
      <div><strong>Unable to load mentor availability.</strong></div>
      <button type="button" className="button button-outline" onClick={() => void load()}>Try again</button>
    </section>
  }

  if (!payload) return null

  return <section className={`mentee-availability-shell ${styles.explorer}`} lang="en">
    <div className="mentee-availability-filters" aria-label="Mentor availability filters">
      <div className="mentee-availability-filter-copy"><strong>Find a mentor</strong><small><Clock3 aria-hidden="true"/>Only currently valid slots are shown.</small></div>
      <label className="mentee-availability-field mentee-availability-field--search"><span>Mentor name</span><div><Search aria-hidden="true"/><input type="search" value={filters.mentorQuery} onChange={event => updateFilter('mentorQuery', event.target.value)} placeholder="Search mentors"/></div></label>
      <label className="mentee-availability-field"><span>Mentor level</span><select value={filters.tierId} onChange={event => updateFilter('tierId', event.target.value)}><option value="">All levels</option>{payload.tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
      <label className="mentee-availability-field"><span>Date</span><input type="date" min={payload.windowStart} max={payload.windowEnd} value={filters.date} onChange={event => updateFilter('date', event.target.value)}/></label>
      <div className="mentee-availability-field"><span>Time range</span><div className="mentee-availability-time"><input type="time" aria-label="Start time" value={filters.timeStart} onChange={event => updateFilter('timeStart', event.target.value)}/><span>–</span><input type="time" aria-label="End time" value={filters.timeEnd} onChange={event => updateFilter('timeEnd', event.target.value)}/></div></div>
      <div className="mentee-availability-filter-actions"><small>{activeFilterCount ? `${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'} active` : 'All available mentors'}</small>{activeFilterCount ? <button type="button" onClick={resetFilters}><X aria-hidden="true"/>Reset</button> : null}</div>
    </div>

    {invalidTimeRange ? <p className="form-error mentee-availability-inline-feedback" role="alert">End time must be at or after start time.</p> : null}
    {notice ? <p className="mentee-availability-notice" role="status">{notice}</p> : null}
    {error ? <p className="form-error mentee-availability-inline-feedback" role="alert">{error}</p> : null}

    {payload.mentors.length === 0 ? <AvailabilityEmpty title="No mentors have available slots yet." detail="Check back after mentors update their availability."/> : visibleMentors.length === 0 ? <AvailabilityEmpty title="No mentors match your filters." detail="Change or reset your filters to see more slots."/> : <div className="mentee-availability-list">{visibleMentors.map(mentor => {
      const expanded = expandedMentorId === mentor.mentorId
      const dates = buildTwoWeekDateKeys(mentor.weekStartDate)
      return <article className={`mentee-availability-mentor${expanded ? ' is-expanded' : ''}`} key={mentor.mentorId}>
        <button type="button" className="mentee-availability-mentor__summary" aria-expanded={expanded} aria-controls={`mentor-calendar-${mentor.mentorId}`} onClick={() => toggleMentor(mentor.mentorId)}>
          <span className="mentee-availability-avatar" aria-hidden="true"><UserRound/></span>
          <span className="mentee-availability-identity"><strong>{mentor.mentorName}</strong><span>{mentor.tierName}</span><small>{mentor.timezone}</small></span>
          <span className="mentee-availability-count"><strong>{mentor.days.length} {mentor.days.length === 1 ? 'available day' : 'available days'}</strong><small>in the next 2 weeks</small></span>
          <ChevronRight className={expanded ? 'is-open' : ''} aria-hidden="true"/>
        </button>
        {expanded ? <div className="mentee-availability-calendar" id={`mentor-calendar-${mentor.mentorId}`}>
          {[0, 7].map(offset => <section className="mentee-availability-week" key={offset} aria-label={offset === 0 ? 'This week' : 'Next week'}>
            <div className="mentee-availability-week__heading"><strong>{offset === 0 ? 'This week' : 'Next week'}</strong><span>{compactDate(dates[offset])} – {compactDate(dates[offset + 6])}</span></div>
            <div className="mentee-availability-days">{dates.slice(offset, offset + 7).map(dateKey => {
              const day = mentor.days.find(item => item.dateKey === dateKey)
              const isLoading = detailLoadingKey === `${mentor.mentorId}:${dateKey}`
              const isSelected = selectedDetail?.mentor.mentorId === mentor.mentorId && selectedDetail.day.dateKey === dateKey
              const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).formatToParts(dateValue(dateKey))
              return <button type="button" key={dateKey} className={`mentee-availability-day${day ? ' is-available' : ''}${isSelected ? ' is-selected' : ''}`} disabled={!day || Boolean(detailLoadingKey)} aria-label={dateButtonLabel(dateKey, day)} aria-pressed={day ? isSelected : undefined} onClick={() => day && void openFreshDay(mentor, dateKey)}>
                <span>{parts.find(part => part.type === 'weekday')?.value}</span><strong>{parts.find(part => part.type === 'day')?.value}</strong>{day ? <small><i aria-hidden="true"/>{isLoading ? 'Loading…' : 'Available'}</small> : <small>Unavailable</small>}
              </button>
            })}</div>
          </section>)}
        </div> : null}
      </article>
    })}</div>}

    <dialog ref={dialogRef} className="mentee-availability-dialog" aria-labelledby="mentor-availability-dialog-title" onCancel={event => { event.preventDefault(); setSelectedDetail(null) }} onClose={() => setSelectedDetail(null)}>
      {selectedDetail ? <div className="mentee-availability-dialog__surface">
        <div className="mentee-availability-dialog__head"><div><p className={styles.dialogLabel}>Mentor availability</p><h2 id="mentor-availability-dialog-title">Availability for {selectedDetail.mentor.mentorName}</h2><p>{fullDate(selectedDetail.day.dateKey)} · {selectedDetail.mentor.timezone}</p></div><button type="button" className="ops-icon-button" onClick={() => setSelectedDetail(null)} aria-label="Close availability details"><X aria-hidden="true"/></button></div>
        <div className="mentee-availability-dialog__ranges" aria-label="Available time ranges">{selectedDetail.day.ranges.map(range => <div key={`${range.start}-${range.end}`}><Clock3 aria-hidden="true"/><strong>{timeRange(range.start, range.end, selectedDetail.mentor.timezone)}</strong></div>)}</div>
        <p className="mentee-availability-dialog__note">{payload.durationMinutes}-minute slots · Checked when opened.</p>
        <div className="mentee-availability-dialog__actions"><button type="button" className="button button-primary" onClick={() => setSelectedDetail(null)}>Close</button></div>
      </div> : null}
    </dialog>
  </section>
}

function AvailabilityEmpty({ title, detail }: { title: string; detail: string }) {
  return <section className="workspace-card mentee-availability-empty"><CalendarDays aria-hidden="true"/><div><strong>{title}</strong><p>{detail}</p></div></section>
}
