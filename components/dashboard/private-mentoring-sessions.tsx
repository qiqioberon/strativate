'use client'

import { CalendarDays, CheckCircle2, Clock3, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import type { PrivateMentoringSessionFocusView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'

function sessionStatus(status: string) {
  if (status === 'awaiting_focus') return { label: 'Menunggu fokus', tone: 'warning' }
  if (status === 'awaiting_scheduling') return { label: 'Menunggu admin', tone: 'info' }
  if (status === 'scheduled') return { label: 'Terjadwal', tone: 'positive' }
  if (status === 'completed') return { label: 'Selesai', tone: 'neutral' }
  return { label: status.replaceAll('_', ' '), tone: 'neutral' }
}

export function PrivateMentoringSessions({ sessions, sessionFocuses }: { sessions: PrivateMentoringSessionView[]; sessionFocuses: PrivateMentoringSessionFocusView[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const enrollmentIds = [...new Set(sessions.map(session => session.enrollmentId))]

  async function chooseFocus(sessionId: string, focusId: string) {
    if (!focusId) return
    setBusyId(sessionId); setMessage('')
    const { error } = await supabase.rpc('set_private_mentoring_session_focus', { p_session_id: sessionId, p_focus_id: focusId })
    setBusyId(null)
    if (error) { setMessage(error.message); return }
    setMessage('Fokus sesi tersimpan. Tim Strativate akan mengatur mentor dan jadwal.')
    router.refresh()
  }

  if (sessions.length === 0) return <section className="workspace-card"><p className="kicker">Private Mentoring</p><h3>Belum ada sesi aktif.</h3><p className="muted">Sesi akan muncul setelah pembayaran paket Private Mentoring terverifikasi.</p></section>

  return <div className="engagement-list mentoring-groups">
    {enrollmentIds.map(enrollmentId => {
      const rows = sessions.filter(session => session.enrollmentId === enrollmentId)
      const purchased = rows[0]?.purchasedSessions ?? rows.length
      const used = rows.filter(session => session.status === 'completed').length
      const remaining = Math.max(0, purchased - used)
      return <section className="workspace-card mentoring-group" key={enrollmentId}>
        <div className="mentoring-group__header"><div><p className="kicker">Private Mentoring · {rows[0]?.mentorTierName}</p><h3>{purchased} sesi mentoring</h3><p>{used} selesai · {remaining} tersisa</p></div><span className="ops-status ops-status--info">{rows[0]?.mentorTierName}</span></div>
        <div className="mentoring-session-list">{rows.map(session => {
          const canChooseFocus = session.status === 'awaiting_focus' || session.status === 'awaiting_scheduling'
          const status = sessionStatus(session.status)
          return <article className="mentoring-session-card" key={session.sessionId}>
            <div className="mentoring-session-card__number"><span>Sesi</span><strong>{session.sessionNumber}</strong></div>
            <div className="mentoring-session-card__body">
              <div className="mentoring-session-card__top"><h4>{session.focusName ?? 'Fokus belum dipilih'}</h4><span className={`ops-status ops-status--${status.tone}`}>{status.label}</span></div>
              {canChooseFocus ? <label className="ops-field"><span>Fokus / topik sesi</span><select disabled={busyId === session.sessionId} value={session.sessionFocusId ?? ''} onChange={event => chooseFocus(session.sessionId, event.target.value)}><option value="">Pilih fokus</option>{sessionFocuses.map(focus => <option value={focus.id} key={focus.id}>{focus.name}</option>)}</select></label> : null}
              <div className="mentoring-session-card__meta"><span><UserRound aria-hidden="true" />{session.mentorName ?? 'Mentor menunggu penugasan admin'}</span><span><CalendarDays aria-hidden="true" />{session.scheduledStartAt ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.scheduledStartAt)) : 'Jadwal menunggu admin'}</span><span>{session.status === 'completed' ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}{status.label}</span></div>
            </div>
          </article>
        })}</div>
      </section>
    })}
    {message ? <p className="muted" role="status">{message}</p> : null}
  </div>
}
