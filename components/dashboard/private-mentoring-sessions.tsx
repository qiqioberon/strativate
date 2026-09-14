'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import type { PrivateMentoringSessionFocusView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'

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

  return <div className="engagement-list">
    {enrollmentIds.map(enrollmentId => {
      const rows = sessions.filter(session => session.enrollmentId === enrollmentId)
      const purchased = rows[0]?.purchasedSessions ?? rows.length
      const used = rows.filter(session => session.status === 'completed').length
      const remaining = Math.max(0, purchased - used)
      return <section className="workspace-card engagement-card" key={enrollmentId}>
        <div className="card-heading"><div><p className="kicker">Private Mentoring · {rows[0]?.mentorTierName}</p><h3>{purchased} sesi</h3></div><span className="status-chip">{remaining} tersisa</span></div>
        <div className="confirmation-grid"><div><span>Dibeli</span><strong>{purchased} sesi</strong></div><div><span>Selesai</span><strong>{used} sesi</strong></div><div><span>Sisa</span><strong>{remaining} sesi</strong></div><div><span>Tier mentor</span><strong>{rows[0]?.mentorTierName}</strong></div></div>
        <div className="program-list">{rows.map(session => {
          const canChooseFocus = session.status === 'awaiting_focus' || session.status === 'awaiting_scheduling'
          return <article className="focus-row" key={session.sessionId}>
            <span className="program-number orange">{session.sessionNumber}</span>
            <div style={{ flex: 1 }}>
              <strong>Sesi {session.sessionNumber}</strong>
              {canChooseFocus ? <label className="form-label">Fokus sesi<select disabled={busyId === session.sessionId} value={session.sessionFocusId ?? ''} onChange={event => chooseFocus(session.sessionId, event.target.value)}><option value="">Pilih fokus</option>{sessionFocuses.map(focus => <option value={focus.id} key={focus.id}>{focus.name}</option>)}</select></label> : <span>Fokus: {session.focusName ?? '—'}</span>}
              <span>Mentor: {session.mentorName ?? 'Menunggu penjadwalan admin'}</span>
              <span>Jadwal: {session.scheduledStartAt ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.scheduledStartAt)) : 'Menunggu penjadwalan admin'}</span>
            </div>
            <span className="status-chip">{session.status.replaceAll('_', ' ')}</span>
          </article>
        })}</div>
      </section>
    })}
    {message ? <p className="muted" role="status">{message}</p> : null}
  </div>
}
