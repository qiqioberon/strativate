'use client'

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  ExternalLink,
  Link2,
  Palette,
  Search,
  Loader2,
  RefreshCw,
  Unplug,
  UsersRound,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AdminScheduleDialog } from '@/components/admin/admin-schedule-dialog'
import { publicContact } from '@/lib/content/brand'

type Role = 'admin' | 'mentor' | 'mentee'
type View = 'month' | 'week' | 'agenda'
type Connection = {
  connected: boolean
  accountEmail: string | null
  status: 'connected' | 'invalid' | 'disconnected' | 'not_connected'
  scopes: string[]
  lastError: string | null
}
type EventItem = {
  id: string
  source: 'strativate' | 'google'
  title: string
  start: string
  end: string
  htmlLink?: string | null
  sessionId?: string
  sessionNumber?: number
  purchasedSessions?: number
  focusName?: string | null
  status?: string
  mentorName?: string | null
  mentorTierName?: string | null
  menteeName?: string | null
  menteeEmail?: string | null
  timezone?: string | null
  durationMinutes?: number | null
  meetingUrl?: string | null
  providerMeetingUrl?: string | null
  manualMeetingUrl?: string | null
  googleSyncStatus?: string | null
  googleSyncError?: string | null
  personId?: string | null
  personName?: string | null
  personColor?: string | null
}
type Payload = { events: EventItem[]; connection: Connection; googleError: string | null }
type OauthNotice = { tone: 'success' | 'warning'; message: string }

function monday(value: Date) {
  const d = new Date(value)
  const day = d.getDay() || 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (day - 1))
  return d
}
function addDays(value: Date, n: number) {
  const d = new Date(value)
  d.setDate(d.getDate() + n)
  return d
}
function sameDay(a: string, b: Date) {
  const d = new Date(a)
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate()
}
function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function eventStyle(event: EventItem): CSSProperties | undefined {
  if (event.source !== 'strativate' || !event.personColor) return undefined
  return { '--person-color': event.personColor } as CSSProperties
}
function supportHref(event: EventItem) {
  const when = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    ...(event.timezone ? { timeZone: event.timezone } : {}),
  }).format(new Date(event.start))
  const message = `Halo admin Strativate, mau diskusi terkait jadwal Private Mentoring sesi ${event.sessionNumber ?? ''} pada ${when}.`
  return `${publicContact.whatsapp}?text=${encodeURIComponent(message)}`
}

export function RoleCalendar({ role, onOpenAvailability }: { role: Role; onOpenAvailability?: () => void }) {
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [oauthNotice, setOauthNotice] = useState<OauthNotice | null>(null)
  const [showStrativate, setShowStrativate] = useState(true)
  const [showGoogle, setShowGoogle] = useState(true)
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [meetingDraft, setMeetingDraft] = useState('')
  const [legendOpen, setLegendOpen] = useState(false)
  const [legendQuery, setLegendQuery] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)

  const range = useMemo(() => {
    const start = addDays(monday(new Date(cursor.getFullYear(), cursor.getMonth(), 1)), -7)
    const end = addDays(start, 56)
    return { start: start.toISOString(), end: end.toISOString() }
  }, [cursor])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/calendar/events?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Kalender belum dapat dimuat.')
      setPayload(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kalender belum dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }, [range.end, range.start])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const refresh = () => { void load() }
    window.addEventListener('strativate:operational-refresh', refresh)
    return () => window.removeEventListener('strativate:operational-refresh', refresh)
  }, [load])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const calendarState = params.get('calendar')
    if (!calendarState) return
    if (calendarState === 'connected') {
      setOauthNotice({ tone: 'success', message: 'Google Calendar berhasil terhubung.' })
    } else if (calendarState === 'denied') {
      setOauthNotice({ tone: 'warning', message: 'Google Calendar belum terhubung. Silakan coba lagi.' })
    }
    params.delete('calendar')
    params.delete('reason')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selected && !dialog.open) {
      setMeetingDraft(selected.manualMeetingUrl || '')
      dialog.showModal()
    }
    if (!selected && dialog.open) dialog.close()
  }, [selected])
  useEffect(() => {
    if (!legendOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (legendRef.current && !legendRef.current.contains(event.target as Node)) setLegendOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLegendOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [legendOpen])

  const events = useMemo(
    () => payload?.events.filter(event => (event.source === 'strativate' ? showStrativate : showGoogle)) ?? [],
    [payload, showGoogle, showStrativate],
  )
  const legend = useMemo(() => {
    const people = new Map<string,{name:string;color:string}>()
    for (const event of payload?.events ?? []) {
      if (event.source !== 'strativate' || !event.personId || !event.personColor) continue
      people.set(event.personId,{name:event.personName || event.menteeName || 'Mentee',color:event.personColor})
    }
    return [...people.entries()].map(([id,value])=>({id,...value})).sort((a,b)=>a.name.localeCompare(b.name,'id-ID'))
  },[payload])
  const filteredLegend=useMemo(()=>{
    const query=legendQuery.trim().toLocaleLowerCase('id-ID')
    return query?legend.filter(item=>item.name.toLocaleLowerCase('id-ID').includes(query)):legend
  },[legend,legendQuery])
  const weekStart = monday(cursor)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const monthStart = monday(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(monthStart, i))

  function move(direction: number) {
    setCursor(current => {
      const d = new Date(current)
      if (view === 'month') d.setMonth(d.getMonth() + direction)
      else d.setDate(d.getDate() + 7 * direction)
      return d
    })
  }
  async function disconnect() {
    await fetch('/api/google-calendar/connection', { method: 'DELETE' })
    setOauthNotice(null)
    await load()
  }
  function connect() {
    window.location.assign(`/api/google-calendar/connect?returnTo=${encodeURIComponent(window.location.pathname)}`)
  }
  async function retrySync(event: EventItem) {
    if (!event.sessionId) return
    await fetch(`/api/admin/private-mentoring/sessions/${event.sessionId}/sync`, { method: 'POST' })
    await load()
    setSelected(null)
  }
  async function saveMeeting(event: EventItem, url: string | null) {
    if (!event.sessionId) return
    const response = await fetch(`/api/admin/private-mentoring/sessions/${event.sessionId}/meeting`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!response.ok) {
      const data = await response.json()
      setError(data.error || 'Meeting link belum dapat diubah.')
      return
    }
    await load()
    setSelected(null)
  }

  const label = view === 'month'
    ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(cursor)
    : `${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(weekDays[0])} – ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(weekDays[6])}`

  return <div className="native-calendar">
    <div className="role-page-title">
      <p className="kicker">Jadwal terintegrasi</p>
      <h2>{role === 'admin' ? 'Jadwal Mentoring' : role === 'mentor' ? 'Calendar' : 'Jadwal'}</h2>
      <p>{role === 'admin' ? 'Pantau seluruh sesi Strativate, Zoom, dan sinkronisasi Google Calendar tanpa membuka detail kalender pribadi mentor atau mentee.' : 'Gabungkan sesi Strativate dengan agenda Google Calendar pribadi Anda. Meeting baru menggunakan Zoom; Google Meet tetap tampil hanya untuk sesi legacy.'}</p>
    </div>

    <section className="calendar-connection-card">
      <div className="calendar-connection-card__identity">
        <CalendarDays />
        <div>
          <strong>Google Calendar</strong>
          {payload?.connection.connected
            ? <span>Connected as {payload.connection.accountEmail}</span>
            : <span>{payload?.connection.status === 'invalid' ? 'Koneksi perlu diperbarui.' : 'Hubungkan agar agenda pribadi tampil bersama jadwal Strativate.'}</span>}
        </div>
      </div>
      <div className="button-row">
        {payload?.connection.connected ? <>
          <button className="button button-outline" onClick={() => void load()}><RefreshCw />Refresh</button>
          <button className="button button-ghost" onClick={() => void disconnect()}><Unplug />Disconnect</button>
        </> : <button className="button button-primary" onClick={connect}>{payload?.connection.status === 'invalid' ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}</button>}
      </div>
    </section>

    {oauthNotice ? <p className={`calendar-oauth-notice ${oauthNotice.tone}`} role="status">{oauthNotice.message}</p> : null}

    <section className="role-card calendar-card">
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" aria-label="Hari ini" onClick={() => setCursor(new Date())}>Today</button>
          <button type="button" aria-label="Sebelumnya" onClick={() => move(-1)}><ChevronLeft /></button>
          <button type="button" aria-label="Berikutnya" onClick={() => move(1)}><ChevronRight /></button>
          <strong>{label}</strong>
        </div>
        <div className="calendar-view-switch" role="group" aria-label="Tampilan kalender">
          {(['month', 'week', 'agenda'] as View[]).map(item => <button type="button" key={item} aria-pressed={view === item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item === 'month' ? 'Bulan' : item === 'week' ? 'Minggu' : 'Agenda'}</button>)}
        </div>
      </div>

      <div className="calendar-source-controls" aria-label="Sumber kalender">
        <label><input type="checkbox" checked={showStrativate} onChange={event => setShowStrativate(event.target.checked)} /><span className="source-badge source-strativate">Strativate Session</span></label>
        <label><input type="checkbox" checked={showGoogle} onChange={event => setShowGoogle(event.target.checked)} /><span className="source-badge source-google">Google Calendar</span></label>
      </div>
      <div className="calendar-legend-menu" ref={legendRef}>
        <button className="button button-outline" type="button" aria-haspopup="dialog" aria-expanded={legendOpen} onClick={()=>setLegendOpen(value=>!value)}><Palette aria-hidden="true"/>Legend <span>{legend.length+1}</span></button>
        {legendOpen?<div className="calendar-legend-popover" role="dialog" aria-label="Legenda warna kalender">
          <div className="calendar-legend-popover__head">
            <div><strong>Legenda kalender</strong><small>Warna participant tetap stabil mengikuti identitas kalender yang tersimpan.</small></div>
            <button className="icon-button" type="button" aria-label="Tutup legenda" onClick={()=>setLegendOpen(false)}><X aria-hidden="true"/></button>
          </div>
          {legend.length>8?<label className="calendar-legend-search"><Search aria-hidden="true"/><input aria-label="Cari participant" type="search" value={legendQuery} onChange={event=>setLegendQuery(event.target.value)} placeholder="Cari participant"/></label>:null}
          <div className="calendar-legend-list">
            {filteredLegend.map(item=><span key={item.id}><i style={{backgroundColor:item.color}} aria-hidden="true"/><b>{item.name}</b></span>)}
            {filteredLegend.length===0?<p className="muted">Participant tidak ditemukan.</p>:null}
            <span><i className="calendar-legend__google" aria-hidden="true"/><b>Google Calendar eksternal</b></span>
          </div>
        </div>:null}
      </div>

      {loading ? <p className="calendar-loading"><Loader2 className="spin" />Memuat kalender…</p> : error ? <p className="form-error" role="alert">{error}</p> : null}
      {!loading && !error && view === 'month' ? <div className="calendar-month-grid" role="grid">{monthDays.map(day => <div className={`calendar-day ${day.getMonth() !== cursor.getMonth() ? 'outside' : ''}`} key={dayKey(day)}><time dateTime={dayKey(day)}>{day.getDate()}</time><div>{events.filter(event => sameDay(event.start, day)).slice(0, 3).map(event => <button type="button" key={`${event.source}-${event.id}`} className={`calendar-event ${event.source}`} style={eventStyle(event)} onClick={() => setSelected(event)}><small>{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.start))}</small><span>{event.title}</span><i>{event.source === 'strativate' ? 'Strativate' : 'Google'}</i></button>)}</div></div>)}</div> : null}
      {!loading && !error && view === 'week' ? <div className="calendar-week-grid">{weekDays.map(day => <section key={dayKey(day)}><header><small>{new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(day)}</small><strong>{day.getDate()}</strong></header>{events.filter(event => sameDay(event.start, day)).map(event => <button type="button" className={`calendar-event ${event.source}`} style={eventStyle(event)} key={`${event.source}-${event.id}`} onClick={() => setSelected(event)}><small>{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.start))}</small><span>{event.title}</span><i>{event.source === 'strativate' ? 'Strativate' : 'Google'}</i></button>)}</section>)}</div> : null}
      {!loading && !error && view === 'agenda' ? <div className="calendar-agenda">{events.length ? events.map(event => <button type="button" className="calendar-agenda-row" style={eventStyle(event)} key={`${event.source}-${event.id}`} onClick={() => setSelected(event)}><time>{new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(event.start))}<strong>{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.start))}</strong></time><div><span className={`source-badge source-${event.source}`}>{event.source === 'strativate' ? 'Strativate Session' : 'Google Calendar'}</span><strong>{event.title}</strong>{event.source === 'strativate' ? <small>{event.focusName || 'Fokus mentoring'} · {event.mentorName || event.menteeName || ''}</small> : null}</div><ChevronRight /></button>) : <p className="calendar-empty">Tidak ada agenda pada rentang ini.</p>}</div> : null}
    </section>

    <dialog ref={dialogRef} className="calendar-dialog" onCancel={event => { event.preventDefault(); setSelected(null) }} onClose={() => setSelected(null)}>
      {selected ? <>
        <div className="calendar-dialog__head"><div><span className={`source-badge source-${selected.source}`}>{selected.source === 'strativate' ? 'Strativate Session' : 'Google Calendar'}</span><h3>{selected.source === 'strativate' ? `${selected.focusName || 'Private Mentoring'} · Sesi ${selected.sessionNumber}/${selected.purchasedSessions}` : selected.title}</h3></div><button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Tutup detail"><X /></button></div>
        <dl className="calendar-detail-list"><div><dt>Waktu</dt><dd>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short', ...(selected.timezone ? { timeZone: selected.timezone } : {}) }).format(new Date(selected.start))} – {new Intl.DateTimeFormat('id-ID', { timeStyle: 'short', ...(selected.timezone ? { timeZone: selected.timezone } : {}) }).format(new Date(selected.end))}</dd></div>{selected.source === 'strativate' ? <><div><dt>Durasi</dt><dd>{selected.durationMinutes ? `${selected.durationMinutes} menit` : '—'}</dd></div><div><dt>Timezone</dt><dd>{selected.timezone || 'Timezone lokal perangkat'}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div>{role === 'admin' ? <><div><dt>Mentee</dt><dd>{selected.menteeName || '—'} · {selected.menteeEmail || '—'}</dd></div><div><dt>Mentor</dt><dd>{selected.mentorName || '—'} · {selected.mentorTierName || '—'}</dd></div><div><dt>Google sync</dt><dd>{selected.googleSyncStatus || 'pending'}{selected.googleSyncError ? ` · ${selected.googleSyncError}` : ''}</dd></div></> : role === 'mentor' ? <div><dt>Mentee</dt><dd>{selected.menteeName || '—'}</dd></div> : <div><dt>Mentor</dt><dd>{selected.mentorName || 'Menunggu admin'}</dd></div>}</> : null}</dl>
        <div className="calendar-dialog__actions calendar-dialog__actions--wrap">{selected.source === 'google' && selected.htmlLink ? <a className="button button-primary" href={selected.htmlLink} target="_blank" rel="noopener noreferrer"><ExternalLink />Buka di Google Calendar</a> : null}{selected.source === 'strativate' && selected.meetingUrl ? <><a className="button button-primary" href={selected.meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink />Join Meeting</a><button className="button button-outline" type="button" onClick={() => void navigator.clipboard.writeText(selected.meetingUrl!)}><Clipboard />Copy Meeting Link</button></> : null}{selected.source === 'strativate' && role !== 'admin' ? <a className="button button-outline" href={supportHref(selected)} target="_blank" rel="noopener noreferrer">Hubungi Admin via WhatsApp</a> : null}{role === 'mentor' && selected.source === 'strativate' && onOpenAvailability ? <button className="button button-outline" type="button" onClick={() => { setSelected(null); onOpenAvailability() }}><UsersRound />Atur availability</button> : null}{role === 'admin' && selected.source === 'strativate' ? <><button className="button button-outline" type="button" onClick={() => { setScheduleId(selected.sessionId!); setSelected(null) }}>Reschedule</button>{selected.googleSyncStatus === 'failed' ? <button className="button button-outline" type="button" onClick={() => void retrySync(selected)}><RefreshCw />Retry Google Sync</button> : null}</> : null}</div>
        {role === 'admin' && selected.source === 'strativate' ? <div className="meeting-override"><label><span>Edit meeting link (override)</span><input type="url" placeholder="https://…" value={meetingDraft} onChange={event => setMeetingDraft(event.target.value)} /></label><div className="button-row"><button className="button button-outline" type="button" onClick={() => void saveMeeting(selected, meetingDraft.trim() || null)}><Link2 />Simpan link</button><button className="button button-ghost" type="button" disabled={!selected.manualMeetingUrl} onClick={() => void saveMeeting(selected, null)}>Reset ke provider link</button></div></div> : null}
      </> : null}
    </dialog>
    <AdminScheduleDialog sessionId={scheduleId} onClose={() => setScheduleId(null)} onScheduled={() => { void load(); setScheduleId(null) }} />
  </div>
}
