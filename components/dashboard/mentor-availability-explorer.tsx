'use client'

import { CalendarDays, ChevronRight, Clock3, Loader2, Search, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(dateValue(dateKey))
}

function fullDate(dateKey: string) {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateValue(dateKey))
}

function timeRange(start: string, end: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone })
  return `${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`
}

function dateButtonLabel(dateKey: string, day: MenteeAvailabilityDay | undefined) {
  const label = fullDate(dateKey)
  return day ? `${label}, tersedia, ${day.slots.length} slot valid` : `${label}, tidak tersedia`
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

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/mentee/mentor-availability', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Ketersediaan mentor belum dapat dimuat.')
      setPayload(data as MenteeAvailabilityPayload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Ketersediaan mentor belum dapat dimuat.')
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
    if (detailLoadingKey) return
    setDetailLoadingKey(loadingKey)
    setNotice('')
    try {
      const response = await fetch(`/api/mentee/mentor-availability?mentorId=${encodeURIComponent(mentor.mentorId)}&date=${encodeURIComponent(dateKey)}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Ketersediaan terbaru belum dapat diverifikasi.')
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
        setNotice('Ketersediaan pada tanggal tersebut baru saja berubah. Kalender sudah diperbarui.')
        return
      }
      setSelectedDetail({ mentor: freshMentor, day: freshDay })
    } catch (detailError) {
      setSelectedDetail(null)
      setNotice(detailError instanceof Error ? detailError.message : 'Ketersediaan terbaru belum dapat diverifikasi.')
    } finally {
      setDetailLoadingKey(null)
    }
  }

  if (loading) {
    return <section className="mentee-availability-shell" aria-busy="true" aria-label="Memuat ketersediaan mentor">
      <div className="mentee-availability-loading"><Loader2 className="spin" aria-hidden="true"/><span>Menghitung slot mentor yang benar-benar tersedia…</span></div>
      <div className="mentee-availability-skeleton-grid" aria-hidden="true"><i/><i/><i/></div>
    </section>
  }

  if (error && !payload) {
    return <section className="workspace-card mentee-availability-error" role="alert">
      <CalendarDays aria-hidden="true"/>
      <div><strong>Ketersediaan mentor belum dapat dimuat.</strong><p>{error}</p></div>
      <button type="button" className="button button-outline" onClick={() => void load()}>Coba lagi</button>
    </section>
  }

  if (!payload) return null

  return <section className="mentee-availability-shell">
    <div className="mentee-availability-trust-note">
      <Clock3 aria-hidden="true"/>
      <div><strong>Hanya jadwal yang memiliki slot valid yang ditampilkan.</strong><p>Ini adalah tampilan discovery. Penetapan mentor dan penjadwalan sesi tetap dilakukan oleh admin Strativate.</p></div>
    </div>

    <div className="mentee-availability-filters" aria-label="Filter ketersediaan mentor">
      <div className="mentee-availability-filter-copy"><strong>Temukan mentor</strong><small>Filter bekerja pada slot {payload.durationMinutes} menit yang saat ini dapat digunakan.</small></div>
      <label className="mentee-availability-field mentee-availability-field--search"><span>Nama mentor</span><div><Search aria-hidden="true"/><input type="search" value={filters.mentorQuery} onChange={event => updateFilter('mentorQuery', event.target.value)} placeholder="Cari nama mentor"/></div></label>
      <label className="mentee-availability-field"><span>Level mentor</span><select value={filters.tierId} onChange={event => updateFilter('tierId', event.target.value)}><option value="">Semua level</option>{payload.tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
      <label className="mentee-availability-field"><span>Hari / tanggal</span><input type="date" min={payload.windowStart} max={payload.windowEnd} value={filters.date} onChange={event => updateFilter('date', event.target.value)}/></label>
      <div className="mentee-availability-field"><span>Rentang waktu</span><div className="mentee-availability-time"><input type="time" aria-label="Jam mulai" value={filters.timeStart} onChange={event => updateFilter('timeStart', event.target.value)}/><span>–</span><input type="time" aria-label="Jam selesai" value={filters.timeEnd} onChange={event => updateFilter('timeEnd', event.target.value)}/></div></div>
      <div className="mentee-availability-filter-actions"><small>{activeFilterCount ? `${activeFilterCount} filter aktif` : 'Semua mentor tersedia'}</small>{activeFilterCount ? <button type="button" onClick={resetFilters}><X aria-hidden="true"/>Reset</button> : null}</div>
    </div>

    {invalidTimeRange ? <p className="form-error mentee-availability-inline-feedback" role="alert">Jam selesai harus sama dengan atau setelah jam mulai.</p> : null}
    {notice ? <p className="mentee-availability-notice" role="status">{notice}</p> : null}
    {error ? <p className="form-error mentee-availability-inline-feedback" role="alert">{error}</p> : null}

    {payload.mentors.length === 0 ? <AvailabilityEmpty title="Belum ada mentor dengan slot yang bisa digunakan." detail="Availability mentor dapat berubah. Coba periksa kembali setelah mentor memperbarui jadwalnya."/> : visibleMentors.length === 0 ? <AvailabilityEmpty title="Tidak ada mentor yang cocok dengan filter." detail="Ubah atau reset filter untuk melihat slot lain yang saat ini tersedia."/> : <div className="mentee-availability-list">{visibleMentors.map(mentor => {
      const expanded = expandedMentorId === mentor.mentorId
      const dates = buildTwoWeekDateKeys(mentor.weekStartDate)
      return <article className={`mentee-availability-mentor${expanded ? ' is-expanded' : ''}`} key={mentor.mentorId}>
        <button type="button" className="mentee-availability-mentor__summary" aria-expanded={expanded} aria-controls={`mentor-calendar-${mentor.mentorId}`} onClick={() => toggleMentor(mentor.mentorId)}>
          <span className="mentee-availability-avatar" aria-hidden="true"><UserRound/></span>
          <span className="mentee-availability-identity"><strong>{mentor.mentorName}</strong><span>{mentor.tierName}</span><small>{mentor.timezone}</small></span>
          <span className="mentee-availability-count"><strong>{mentor.days.length} hari tersedia</strong><small>dalam 2 minggu ke depan</small></span>
          <ChevronRight className={expanded ? 'is-open' : ''} aria-hidden="true"/>
        </button>
        {expanded ? <div className="mentee-availability-calendar" id={`mentor-calendar-${mentor.mentorId}`}>
          {[0, 7].map(offset => <section className="mentee-availability-week" key={offset} aria-label={offset === 0 ? 'Minggu ini' : 'Minggu depan'}>
            <div className="mentee-availability-week__heading"><strong>{offset === 0 ? 'Minggu ini' : 'Minggu depan'}</strong><span>{compactDate(dates[offset])} – {compactDate(dates[offset + 6])}</span></div>
            <div className="mentee-availability-days">{dates.slice(offset, offset + 7).map(dateKey => {
              const day = mentor.days.find(item => item.dateKey === dateKey)
              const isLoading = detailLoadingKey === `${mentor.mentorId}:${dateKey}`
              const isSelected = selectedDetail?.mentor.mentorId === mentor.mentorId && selectedDetail.day.dateKey === dateKey
              const parts = compactDate(dateKey).split(' ')
              return <button type="button" key={dateKey} className={`mentee-availability-day${day ? ' is-available' : ''}${isSelected ? ' is-selected' : ''}`} disabled={!day || Boolean(detailLoadingKey)} aria-label={dateButtonLabel(dateKey, day)} aria-pressed={day ? isSelected : undefined} onClick={() => day && void openFreshDay(mentor, dateKey)}>
                <span>{parts[0]}</span><strong>{parts.at(-1)}</strong>{day ? <small><i aria-hidden="true"/>{isLoading ? 'Memuat…' : 'Tersedia'}</small> : <small>Tidak tersedia</small>}
              </button>
            })}</div>
          </section>)}
        </div> : null}
      </article>
    })}</div>}

    <dialog ref={dialogRef} className="mentee-availability-dialog" aria-labelledby="mentor-availability-dialog-title" onCancel={event => { event.preventDefault(); setSelectedDetail(null) }} onClose={() => setSelectedDetail(null)}>
      {selectedDetail ? <div className="mentee-availability-dialog__surface">
        <div className="mentee-availability-dialog__head"><div><p className="kicker">Ketersediaan mentor</p><h2 id="mentor-availability-dialog-title">Ketersediaan {selectedDetail.mentor.mentorName}</h2><p>{fullDate(selectedDetail.day.dateKey)} · {selectedDetail.mentor.timezone}</p></div><button type="button" className="ops-icon-button" onClick={() => setSelectedDetail(null)} aria-label="Tutup detail ketersediaan"><X/></button></div>
        <div className="mentee-availability-dialog__ranges" aria-label="Rentang waktu tersedia">{selectedDetail.day.ranges.map(range => <div key={`${range.start}-${range.end}`}><Clock3 aria-hidden="true"/><strong>{timeRange(range.start, range.end, selectedDetail.mentor.timezone)}</strong></div>)}</div>
        <p className="mentee-availability-dialog__note">Setiap rentang di atas memiliki setidaknya satu slot {payload.durationMinutes} menit yang masih valid saat detail ini dibuka.</p>
        <div className="mentee-availability-dialog__actions"><button type="button" className="button button-primary" onClick={() => setSelectedDetail(null)}>Tutup</button></div>
      </div> : null}
    </dialog>
  </section>
}

function AvailabilityEmpty({ title, detail }: { title: string; detail: string }) {
  return <section className="workspace-card mentee-availability-empty"><CalendarDays aria-hidden="true"/><div><strong>{title}</strong><p>{detail}</p></div></section>
}
