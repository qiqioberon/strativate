'use client'

import { CalendarDays, CheckCircle2, Clock3, ExternalLink, MessageCircle, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { publicContact } from '@/lib/content/brand'
import { createClient } from '@/lib/supabase/client'
import type { PrivateMentoringSessionFocusView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'

type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}

type Draft={topic:string;focusId:string}

function sessionStatus(status: string) {
  if (status === 'awaiting_focus') return { label: 'Menunggu topik', tone: 'warning' }
  if (status === 'awaiting_scheduling') return { label: 'Menunggu admin', tone: 'info' }
  if (status === 'scheduled') return { label: 'Terjadwal', tone: 'positive' }
  if (status === 'completed') return { label: 'Selesai', tone: 'neutral' }
  if (status === 'cancelled') return { label: 'Dibatalkan', tone: 'neutral' }
  return { label: status.replaceAll('_', ' '), tone: 'neutral' }
}

function topicStatus(status: PrivateMentoringSessionView['topicStatus']) {
  if (status === 'pending_review') return 'Menunggu review admin'
  if (status === 'confirmed') return 'Topik dikonfirmasi'
  return 'Topik belum diajukan'
}

function supportHref(session: PrivateMentoringSessionView) {
  const when = session.scheduledStartAt
    ? new Intl.DateTimeFormat('id-ID', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit', timeZone: session.mentorTimezone || undefined }).format(new Date(session.scheduledStartAt))
    : 'jadwal yang sedang dibahas'
  const message = `Halo admin Strativate, mau diskusi terkait jadwal Private Mentoring sesi ${session.sessionNumber} pada ${when}.`
  return `${publicContact.whatsapp}?text=${encodeURIComponent(message)}`
}

function canEditTopic(session:PrivateMentoringSessionView){
  if(session.status==='completed'||session.status==='cancelled')return false
  if(session.status==='scheduled'&&session.scheduledStartAt)return new Date(session.scheduledStartAt).getTime()>Date.now()
  return true
}

export function PrivateMentoringSessions({ sessions, sessionFocuses }: { sessions: PrivateMentoringSessionView[]; sessionFocuses: PrivateMentoringSessionFocusView[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [drafts,setDrafts]=useState<Record<string,Draft>>({})
  const enrollmentIds = [...new Set(sessions.map(session => session.enrollmentId))]

  function draftFor(session:PrivateMentoringSessionView):Draft{
    return drafts[session.sessionId]??{topic:session.menteeTopicRequest??session.resolvedTopic??'',focusId:session.requestedFocusId??session.sessionFocusId??''}
  }
  function patchDraft(session:PrivateMentoringSessionView,patch:Partial<Draft>){setDrafts(current=>({...current,[session.sessionId]:{...draftFor(session),...patch}}))}

  async function submitTopic(session:PrivateMentoringSessionView) {
    const draft=draftFor(session);const topic=draft.topic.trim();if(topic.length<5){setMessage('Ceritakan tujuan atau hal yang ingin dibahas minimal 5 karakter.');return}
    setBusyId(session.sessionId);setMessage('')
    const { error } = await rpc.rpc('submit_private_mentoring_topic_request', { p_session_id: session.sessionId, p_requested_focus_id:draft.focusId||null, p_topic_request:topic })
    setBusyId(null)
    if (error) { setMessage(error.message); return }
    setMessage(session.topicStatus==='confirmed'?'Perubahan topik dikirim untuk review ulang admin. Jadwal yang sudah ada tetap dipertahankan sampai admin meninjau.':'Permintaan topik terkirim. Admin akan meninjau kategori, ruang lingkup, dan kecocokan sesi sebelum penjadwalan.')
    router.refresh()
  }

  if (sessions.length === 0) return <section className="workspace-card"><p className="kicker">Private Mentoring</p><h3>Belum ada sesi aktif.</h3><p className="muted">Sesi akan muncul setelah pembayaran paket Private Mentoring terverifikasi.</p></section>

  return <div className="engagement-list mentoring-groups">
    {enrollmentIds.map(enrollmentId => {
      const rows = sessions.filter(session => session.enrollmentId === enrollmentId)
      const purchased = rows[0]?.purchasedSessions ?? rows.length
      const used = rows.filter(session => session.status === 'completed').length
      const remaining = Math.max(0, purchased - used)
      const primaryMentor=rows[0]?.primaryMentorName
      return <section className="workspace-card mentoring-group" key={enrollmentId}>
        <div className="mentoring-group__header"><div><p className="kicker">Private Mentoring · {rows[0]?.mentorTierName}</p><h3>{purchased} sesi mentoring</h3><p>{used} selesai · {remaining} tersisa{purchased>=5?` · Mentor utama: ${primaryMentor||'menunggu penetapan admin'}`:''}</p></div><span className="ops-status ops-status--info">{rows[0]?.mentorTierName}</span></div>
        <div className="mentoring-session-list">{rows.map(session => {
          const editable=canEditTopic(session);const status=sessionStatus(session.status);const draft=draftFor(session)
          return <article className="mentoring-session-card" key={session.sessionId}>
            <div className="mentoring-session-card__number"><span>Sesi</span><strong>{session.sessionNumber}</strong></div>
            <div className="mentoring-session-card__body">
              <div className="mentoring-session-card__top"><div><h4>{session.resolvedTopic ?? session.focusName ?? 'Topik belum dikonfirmasi'}</h4><small className="muted">{topicStatus(session.topicStatus)}</small></div><span className={`ops-status ops-status--${status.tone}`}>{status.label}</span></div>
              {session.menteeTopicRequest?<p><strong>Permintaan kamu:</strong> {session.menteeTopicRequest}</p>:null}
              {editable?<div className="ops-form-stack">
                <label className="ops-field"><span>Apa yang ingin kamu bahas di sesi ini?</span><textarea rows={4} disabled={busyId===session.sessionId} value={draft.topic} onChange={event=>patchDraft(session,{topic:event.target.value})} placeholder="Contoh: saya ingin mempersempit problem statement, mengecek asumsi utama, dan menentukan eksperimen berikutnya."/></label>
                <label className="ops-field"><span>Kategori fokus (opsional)</span><select disabled={busyId===session.sessionId} value={draft.focusId} onChange={event=>patchDraft(session,{focusId:event.target.value})}><option value="">Biarkan admin membantu mengelompokkan</option>{sessionFocuses.map(focus => <option value={focus.id} key={focus.id}>{focus.name}</option>)}</select></label>
                <p className="muted">Kategori hanya membantu pengelompokan. Admin akan review permintaanmu dan menetapkan topik/scope final sebelum sesi dijadwalkan. Mengubah topik sesi yang sudah terjadwal akan membuka review ulang tanpa membuat event baru.</p>
                <button className="button button-outline" type="button" disabled={busyId===session.sessionId} onClick={()=>void submitTopic(session)}>{session.topicStatus==='confirmed'?'Ajukan perubahan topik':'Kirim untuk review'}</button>
              </div>:null}
              <div className="mentoring-session-card__meta"><span><UserRound aria-hidden="true" />{session.mentorName ?? (session.primaryMentorName?`Mentor utama: ${session.primaryMentorName}`:'Mentor menunggu penugasan admin')}</span><span><CalendarDays aria-hidden="true" />{session.scheduledStartAt ? new Intl.DateTimeFormat('id-ID', { dateStyle:'medium', timeStyle:'short', timeZone: session.mentorTimezone || undefined }).format(new Date(session.scheduledStartAt)) : 'Jadwal menunggu admin'}</span><span>{session.status === 'completed' ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}{status.label}</span></div>
              {session.scheduledStartAt && session.status !== 'cancelled' ? <div className="button-row mentoring-session-card__actions">{session.meetingUrl ? <a className="button button-primary" href={session.meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Join Google Meet</a> : <span className="muted">Meeting link {session.googleSyncStatus === 'failed' ? 'sedang bermasalah; hubungi admin.' : 'sedang disiapkan.'}</span>}<a className="button button-outline" href={supportHref(session)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Ada masalah dengan jadwal? Hubungi Admin</a></div> : null}
            </div>
          </article>
        })}</div>
      </section>
    })}
    {message ? <p className="muted" role="status">{message}</p> : null}
  </div>
}
