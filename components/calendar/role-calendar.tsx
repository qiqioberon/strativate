'use client'

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  ExternalLink,
  Link2,
  Check,
  Loader2,
  RefreshCw,
  Unplug,
  UsersRound,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AdminScheduleDialog } from '@/components/admin/admin-schedule-dialog'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { publicContact } from '@/lib/content/brand'
import {
  addDays, compareEvents, eventDisplayTitle, eventRangeLabel, isSpanning, overlaps, readableStatus,
  visibleRange, type CalendarRole, type CalendarView, type EventItem,
} from '@/lib/calendar/presentation'
import { CalendarAgenda, CalendarEventButton, CalendarMonth, CalendarWeek } from './calendar-views'
import { CalendarLegend } from './calendar-legend'

type Connection = {
  connected: boolean
  accountEmail: string | null
  status: 'connected' | 'invalid' | 'disconnected' | 'not_connected'
  scopes: string[]
  lastError: string | null
}
type Payload = { events: EventItem[]; connection: Connection; googleError: string | null }
type OauthNotice = { tone: 'success' | 'warning'; message: string }

function supportHref(event: EventItem) {
  const when = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    ...(event.timezone ? { timeZone: event.timezone } : {}),
  }).format(new Date(event.start))
  const label=event.mentoringType==='intensive'?'Intensive Mentoring':'Private Mentoring'
  const message = `Halo admin Strativate, mau diskusi terkait jadwal ${label} sesi ${event.sessionNumber ?? ''} pada ${when}.`
  return `${publicContact.whatsapp}?text=${encodeURIComponent(message)}`
}

export function RoleCalendar({ role, onOpenAvailability }: { role: CalendarRole; onOpenAvailability?: () => void }) {
  const [view, setView] = useState<CalendarView>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [oauthNotice, setOauthNotice] = useState<OauthNotice | null>(null)
  const [showStrativate, setShowStrativate] = useState(true)
  const [showGoogle, setShowGoogle] = useState(true)
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [scheduleKind,setScheduleKind]=useState<'private'|'intensive'>('private')
  const [meetingDraft, setMeetingDraft] = useState('')
  const [agendaQuery, setAgendaQuery] = useState('')
  const [agendaPage, setAgendaPage] = useState(1)
  const [overflowDay, setOverflowDay] = useState<Date | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dayDialogRef = useRef<HTMLDialogElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const visible = useMemo(() => visibleRange(cursor, view), [cursor, view])

  const range = useMemo(() => ({ start: visible.start.toISOString(), end: visible.end.toISOString() }), [visible])

  const load = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/calendar/events?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`, { cache: 'no-store', signal: controller.signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Kalender belum dapat dimuat.')
      if (!controller.signal.aborted) setPayload(data)
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Kalender belum dapat dimuat.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [range.end, range.start])

  useEffect(() => { void load(); return () => requestRef.current?.abort() }, [load])
  useOperationalInvalidation(['calendar', 'provider'], () => { void load() })
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
      setActionError('')
      setCopied(false)
      dialog.showModal()
    }
    if (!selected && dialog.open) dialog.close()
  }, [selected])
  useEffect(() => {
    const dialog = dayDialogRef.current
    if (!dialog) return
    if (overflowDay && !dialog.open) dialog.showModal()
    if (!overflowDay && dialog.open) dialog.close()
  }, [overflowDay])

  const events = useMemo(() => (payload?.events ?? [])
    .filter(event => (event.source === 'strativate' ? showStrativate : showGoogle)
      && overlaps(event, visible.start, visible.end))
    .sort(compareEvents), [payload, showGoogle, showStrativate, visible])
  const dayEvents = overflowDay ? events.filter(event => overlaps(event, overflowDay, addDays(overflowDay, 1))) : []
  const googleAvailable = Boolean(payload?.connection.connected || payload?.events.some(event => event.source === 'google'))
  const sourcesHidden = !showStrativate && (!showGoogle || !googleAvailable)
  const emptyMessage = sourcesHidden
    ? 'Agenda disembunyikan oleh filter. Aktifkan sumber kalender untuk menampilkan jadwal.'
    : 'Tidak ada agenda pada rentang ini.'

  function selectEvent(event: EventItem) {
    dayDialogRef.current?.close()
    setOverflowDay(null)
    setSelected(event)
  }
  function resetPeriod() { setAgendaPage(1); setOverflowDay(null) }
  function move(direction: number) {
    resetPeriod()
    setCursor(current => {
      if (view !== 'month') return addDays(current, 7 * direction)
      const first = new Date(current.getFullYear(), current.getMonth() + direction, 1)
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
      first.setDate(Math.min(current.getDate(), last))
      return first
    })
  }
  async function runAction(action: () => Promise<void>) {
    setActionBusy(true)
    setActionError('')
    try { await action() }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Tindakan belum dapat diselesaikan.') }
    finally { setActionBusy(false) }
  }
  async function requireSuccess(response: Response) {
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Tindakan belum dapat diselesaikan. Silakan coba lagi.')
    }
  }
  async function disconnect() {
    await requireSuccess(await fetch('/api/google-calendar/connection', { method: 'DELETE' }))
    setOauthNotice(null)
    await load()
  }
  function connect() {
    window.location.assign(`/api/google-calendar/connect?returnTo=${encodeURIComponent(window.location.pathname)}`)
  }
  async function retrySync(event: EventItem) {
    if (!event.sessionId) return
    const kind=event.mentoringType==='intensive'?'intensive':'private'
    await requireSuccess(await fetch(`/api/admin/${kind}-mentoring/sessions/${event.sessionId}/sync`, { method: 'POST' }))
    await load()
    setSelected(null)
  }
  async function saveMeeting(event: EventItem, url: string | null) {
    if (!event.sessionId) return
    const kind=event.mentoringType==='intensive'?'intensive':'private'
    const response = await fetch(`/api/admin/${kind}-mentoring/sessions/${event.sessionId}/meeting`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    await requireSuccess(response)
    await load()
    setSelected(null)
  }

  const label = view === 'month'
    ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(cursor)
    : `${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(visible.start)} – ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(addDays(visible.end, -1))}`

  return <div className="native-calendar">
    <div className="role-page-title">
      <p className="kicker">Jadwal terintegrasi</p>
      <h2>{role === 'admin' ? 'Jadwal Mentoring' : role === 'mentor' ? 'Kalender' : 'Jadwal'}</h2>
      <p>{role === 'admin' ? 'Pantau seluruh sesi Strativate, Zoom room, dan sinkronisasi Google Calendar tanpa membuka detail kalender pribadi mentor atau mentee.' : 'Gabungkan sesi Strativate dengan agenda Google Calendar pribadi Anda. Link Zoom sesi tersedia pada detail jadwal.'}</p>
    </div>

    <section className="calendar-connection-card">
      <div className="calendar-connection-card__identity">
        <CalendarDays />
        <div>
          <strong>Google Calendar</strong>
          {!payload && loading ? <span>Memuat status koneksi…</span> : payload?.connection.connected
            ? <span>Terhubung · {payload.connection.accountEmail}</span>
            : <span>{payload?.connection.status === 'invalid' ? 'Koneksi perlu diperbarui.' : 'Hubungkan agar agenda pribadi tampil bersama jadwal Strativate.'}</span>}
        </div>
      </div>
      <div className="button-row">
        {payload?.connection.connected ? <>
          <button className="button button-outline" disabled={loading || actionBusy} onClick={() => void load()}><RefreshCw />Muat ulang</button>
          <button className="button button-ghost" disabled={actionBusy} onClick={() => void runAction(disconnect)}><Unplug />Putuskan</button>
        </> : <button className="button button-primary" disabled={!payload && loading} onClick={connect}>{payload?.connection.status === 'invalid' ? 'Hubungkan ulang Google Calendar' : 'Hubungkan Google Calendar'}</button>}
      </div>
    </section>

    {oauthNotice ? <p className={`calendar-oauth-notice ${oauthNotice.tone}`} role="status">{oauthNotice.message}</p> : null}

    <section className="role-card calendar-card" aria-label="Jadwal kalender" aria-busy={loading}>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" aria-label="Hari ini" onClick={() => { resetPeriod(); setCursor(new Date()) }}>Hari ini</button>
          <button type="button" aria-label="Sebelumnya" onClick={() => move(-1)}><ChevronLeft /></button>
          <button type="button" aria-label="Berikutnya" onClick={() => move(1)}><ChevronRight /></button>
          <strong className="calendar-period" aria-live="polite">{label}</strong>
        </div>
        <div className="calendar-view-switch" role="group" aria-label="Tampilan kalender">
          {(['month', 'week', 'agenda'] as CalendarView[]).map(item => <button type="button" key={item} aria-pressed={view === item} className={view === item ? 'active' : ''} onClick={() => { resetPeriod(); setView(item) }}>{item === 'month' ? 'Bulan' : item === 'week' ? 'Minggu' : 'Agenda'}</button>)}
        </div>
      </div>

      <div className="calendar-filter-row">
        <div className="calendar-source-controls" role="group" aria-label="Sumber kalender">
          <label className="calendar-source-toggle">
            <input type="checkbox" checked={showStrativate} onChange={event => { setShowStrativate(event.target.checked); setAgendaPage(1) }} />
            <span className="calendar-toggle-check"><Check aria-hidden="true" /></span><i className="calendar-source-dot strativate" aria-hidden="true" /><span>Sesi Strativate</span>
          </label>
          <label className="calendar-source-toggle">
            <input type="checkbox" checked={showGoogle} onChange={event => { setShowGoogle(event.target.checked); setAgendaPage(1) }} aria-describedby={!googleAvailable ? 'calendar-google-source-status' : undefined} />
            <span className="calendar-toggle-check"><Check aria-hidden="true" /></span><i className="calendar-source-dot google" aria-hidden="true" /><span>Google Calendar</span>
            {!googleAvailable ? <small id="calendar-google-source-status">{payload?.connection.status === 'invalid' ? 'Hubungkan ulang' : 'Belum terhubung'}</small> : null}
          </label>
        </div>
        <CalendarLegend events={events} showGoogle={showGoogle && googleAvailable} />
      </div>
      {loading ? <p className={`calendar-loading${!payload && view === 'agenda' ? ' calendar-loading--initial' : ''}`} role="status"><Loader2 className="spin" aria-hidden="true" />Memuat kalender…</p> : null}
      {error ? <div className="calendar-error" role="alert"><span>{error}</span><button type="button" disabled={loading} onClick={() => void load()}>Coba lagi</button></div> : null}
      {payload?.googleError && showGoogle ? <p className="calendar-warning" role="status">Agenda Google Calendar belum dapat dimuat. Sesi Strativate tetap tersedia.{payload.connection.status === 'invalid' ? ' Hubungkan ulang akun Google.' : ' Gunakan Muat ulang untuk mencoba lagi.'}</p> : null}
      {actionError && !selected ? <p className="calendar-error" role="alert">{actionError}</p> : null}
      {view === 'month' ? <CalendarMonth start={visible.start} cursor={cursor} events={events} onSelect={selectEvent} onOpenDay={setOverflowDay} /> : null}
      {view === 'week' ? <CalendarWeek start={visible.start} events={events} onSelect={selectEvent} loading={loading} /> : null}
      {view === 'agenda' && payload ? <CalendarAgenda events={events} role={role} query={agendaQuery} page={agendaPage}
        onQueryChange={query => { setAgendaQuery(query); setAgendaPage(1) }} onPageChange={setAgendaPage} onSelect={selectEvent} emptyMessage={emptyMessage} /> : null}
      {view !== 'agenda' && !events.length && !loading && !error ? <p className="calendar-empty">{emptyMessage}</p> : null}
    </section>

    <dialog ref={dayDialogRef} className="calendar-dialog calendar-day-dialog" aria-labelledby="calendar-day-title"
      onCancel={event => { event.preventDefault(); setOverflowDay(null) }} onClose={() => setOverflowDay(null)}
      onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOverflowDay(null) } }}>
      {overflowDay ? <>
        <div className="calendar-dialog__head"><div><h3 id="calendar-day-title">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(overflowDay)}</h3><p>{dayEvents.length} agenda</p></div><button className="icon-button" type="button" aria-label="Tutup agenda harian" onClick={() => setOverflowDay(null)}><X aria-hidden="true" /></button></div>
        <div className="calendar-day-detail-list">{dayEvents.map(event => <div key={`${event.source}-${event.id}`}><CalendarEventButton event={event} onSelect={selectEvent} variant="schedule" />{isSpanning(event) ? <small>{eventRangeLabel(event)}</small> : null}</div>)}{!dayEvents.length ? <p className="calendar-empty">{emptyMessage}</p> : null}</div>
      </> : null}
    </dialog>

    <dialog ref={dialogRef} className="calendar-dialog" aria-labelledby="calendar-event-title" onCancel={event => { event.preventDefault(); setSelected(null) }} onClose={() => setSelected(null)}>
      {selected ? <>
        <div className="calendar-dialog__head">
          <div>
            <span className={`source-badge source-${selected.source}`}>{selected.source === 'strativate' ? 'Sesi Strativate' : 'Google Calendar'}</span>
            <h3 id="calendar-event-title">{eventDisplayTitle(selected)}</h3>
            {selected.purchasedSessions ? <p>Sesi {selected.sessionNumber} dari {selected.purchasedSessions}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Tutup detail"><X aria-hidden="true" /></button>
        </div>
        <dl className="calendar-detail-list">
          <div><dt>Waktu</dt><dd>{eventRangeLabel(selected, true)}</dd></div>
          {selected.source === 'strativate' ? <>
            <div><dt>Program</dt><dd>{selected.mentoringType === 'intensive' ? 'Intensive Mentoring' : 'Private Mentoring'}</dd></div>
            <div><dt>Durasi</dt><dd>{selected.durationMinutes ? `${selected.durationMinutes} menit` : 'Belum tersedia'}</dd></div>
            <div><dt>Zona waktu</dt><dd>{selected.timezone || 'Zona waktu perangkat'}</dd></div>
            <div><dt>Status</dt><dd>{readableStatus(selected.status)}</dd></div>
            {role === 'admin' ? <>
              <div><dt>Mentee</dt><dd>{selected.menteeName || 'Mentee'}{selected.menteeEmail ? ` · ${selected.menteeEmail}` : ''}</dd></div>
              <div><dt>Mentor</dt><dd>{selected.mentorName || 'Belum ditetapkan'}{selected.mentorTierName ? ` · ${selected.mentorTierName}` : ''}</dd></div>
              <div><dt>Zoom room</dt><dd>{selected.zoomRoomName || (selected.manualMeetingUrl ? 'Link manual' : 'Belum ditetapkan')}</dd></div>
              <div><dt>Sinkronisasi Google</dt><dd>{readableStatus(selected.googleSyncStatus || 'pending')}{selected.googleSyncError ? ` · ${selected.googleSyncError}` : ''}</dd></div>
            </> : role === 'mentor'
              ? <div><dt>Mentee</dt><dd>{selected.menteeName || 'Mentee'}</dd></div>
              : <div><dt>Mentor</dt><dd>{selected.mentorName || 'Menunggu admin'}</dd></div>}
            <div><dt>Meeting</dt><dd>{selected.meetingUrl ? 'Link meeting tersedia' : 'Link meeting belum tersedia'}</dd></div>
          </> : null}
        </dl>
        {actionError ? <p className="calendar-error" role="alert">{actionError}</p> : null}
        {copied ? <p className="calendar-copy-notice" role="status">Link meeting disalin.</p> : null}
        <div className="calendar-dialog__actions calendar-dialog__actions--wrap">
          {selected.source === 'google' && selected.htmlLink ? <a className="button button-primary" href={selected.htmlLink} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Buka di Google Calendar</a> : null}
          {selected.source === 'strativate' && selected.status === 'scheduled' && selected.meetingUrl ? <>
            <a className="button button-primary" href={selected.meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Join Meeting</a>
            <button className="button button-outline" type="button" disabled={actionBusy} onClick={() => void runAction(async () => { await navigator.clipboard.writeText(selected.meetingUrl!); setCopied(true) })}><Clipboard aria-hidden="true" />Salin link meeting</button>
          </> : null}
          {selected.source === 'strativate' && role !== 'admin' ? <a className="button button-outline" href={supportHref(selected)} target="_blank" rel="noopener noreferrer">Hubungi Admin via WhatsApp</a> : null}
          {role === 'mentor' && selected.source === 'strativate' && onOpenAvailability ? <button className="button button-outline" type="button" onClick={() => { setSelected(null); onOpenAvailability() }}><UsersRound aria-hidden="true" />Atur ketersediaan</button> : null}
          {role === 'admin' && selected.source === 'strativate' ? <>
            <button className="button button-outline" type="button" disabled={actionBusy || !selected.sessionId} onClick={() => {
              setScheduleKind(selected.mentoringType === 'intensive' ? 'intensive' : 'private')
              setScheduleId(selected.sessionId || null)
              setSelected(null)
            }}>Ubah jadwal</button>
            {selected.googleSyncStatus === 'failed' ? <button className="button button-outline" type="button" disabled={actionBusy || !selected.sessionId} onClick={() => void runAction(() => retrySync(selected))}><RefreshCw aria-hidden="true" />Ulangi sinkronisasi Google</button> : null}
          </> : null}
        </div>
        {role === 'admin' && selected.source === 'strativate' && selected.status === 'scheduled' ? <div className="meeting-override">
          <label><span>Ganti link meeting (override)</span><input type="url" placeholder="https://…" value={meetingDraft} onChange={event => setMeetingDraft(event.target.value)} /></label>
          <div className="button-row">
            <button className="button button-outline" type="button" disabled={actionBusy || !selected.sessionId || !meetingDraft.trim()} onClick={() => void runAction(() => saveMeeting(selected, meetingDraft.trim()))}><Link2 aria-hidden="true" />Simpan link</button>
            <button className="button button-ghost" type="button" disabled={actionBusy || !selected.sessionId || !selected.manualMeetingUrl || !selected.managedMeetingUrl} onClick={() => void runAction(() => saveMeeting(selected, null))}>Kembali ke link Zoom terkelola</button>
          </div>
        </div> : null}
      </> : null}
    </dialog>
    <AdminScheduleDialog sessionId={scheduleId} mentoringKind={scheduleKind} onClose={() => setScheduleId(null)} onScheduled={() => { void load(); setScheduleId(null) }} />
  </div>
}
