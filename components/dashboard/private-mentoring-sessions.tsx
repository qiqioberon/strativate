'use client'

import { ExternalLink, Eye, MessageCircle, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { TablePagination } from '@/components/admin/table-pagination'
import { CopyTextButton } from '@/components/dashboard/copy-text-button'
import { MentoringCompetitionEditor } from '@/components/mentoring/mentoring-competition-editor'
import { MentoringSessionPreferences } from '@/components/mentoring/mentoring-session-preferences'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { publicContact } from '@/lib/content/brand'
import { createClient } from '@/lib/supabase/client'
import type { PrivateMentoringSessionFocusView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'

type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}
type Competition={enrollment_id:string;competition_category_id:string|null;competition_category_name:string|null;competition_name:string|null;competition_updated_at:string|null}
type SortMode='session'|'schedule_asc'|'schedule_desc'

function sessionStatus(status:string){
  if(status==='awaiting_focus')return{label:'Menunggu review',tone:'warning'}
  if(status==='awaiting_scheduling')return{label:'Menunggu admin',tone:'info'}
  if(status==='scheduled')return{label:'Terjadwal',tone:'positive'}
  if(status==='completed')return{label:'Selesai',tone:'neutral'}
  if(status==='cancelled')return{label:'Dibatalkan',tone:'neutral'}
  return{label:status.replaceAll('_',' '),tone:'neutral'}
}
function topicStatus(status:PrivateMentoringSessionView['topicStatus']){
  if(status==='pending_review')return'Menunggu review admin'
  if(status==='confirmed')return'Topik dikonfirmasi'
  return'Preferensi belum ditinjau'
}
function supportHref(session:PrivateMentoringSessionView){
  const when=session.scheduledStartAt
    ? new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:session.mentorTimezone||undefined}).format(new Date(session.scheduledStartAt))
    : 'jadwal yang sedang dibahas'
  return publicContact.whatsapp+'?text='+encodeURIComponent('Halo admin Strativate, mau diskusi terkait jadwal mentoring sesi '+session.sessionNumber+' pada '+when+'. Session ID: '+session.sessionId)
}
function shortId(id:string){return '…'+id.slice(-8)}
function scheduleText(session:PrivateMentoringSessionView){
  return session.scheduledStartAt
    ? new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:session.mentorTimezone||undefined}).format(new Date(session.scheduledStartAt))
    : 'Menunggu admin'
}

export function PrivateMentoringSessions({
  sessions,
  sessionFocuses:_sessionFocuses,
  focusSessionId,
  focusEnrollmentId,
}:{
  sessions:PrivateMentoringSessionView[]
  sessionFocuses:PrivateMentoringSessionFocusView[]
  focusSessionId?:string|null
  focusEnrollmentId?:string|null
}){
  const supabase=useMemo(()=>createClient(),[])
  const rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
  const[competitions,setCompetitions]=useState<Record<string,Competition>>({})
  const[selectedSessionId,setSelectedSessionId]=useState<string|null>(null)
  const[query,setQuery]=useState('')
  const[statusFilter,setStatusFilter]=useState('all')
  const[mentorFilter,setMentorFilter]=useState('all')
  const[focusFilter,setFocusFilter]=useState('all')
  const[sort,setSort]=useState<SortMode>('session')
  const[page,setPage]=useState(0)
  const[pageSize,setPageSize]=useState(10)
  const detailRef=useRef<HTMLDialogElement>(null)
  const enrollmentIds=[...new Set(sessions.map(session=>session.enrollmentId))]
  const[selectedEnrollmentId,setSelectedEnrollmentId]=useState(enrollmentIds[0]??'')
  const selected=useMemo(()=>selectedSessionId?sessions.find(session=>session.sessionId===selectedSessionId)??null:null,[selectedSessionId,sessions])

  useEffect(()=>{if(selectedSessionId&&!selected)setSelectedSessionId(null)},[selected,selectedSessionId])

  const loadCompetitions=useCallback(async()=>{
    const competition=await rpc.rpc<Competition[]>('list_my_private_mentoring_competitions')
    const rows=competition.data??[]
    setCompetitions(Object.fromEntries(rows.map(row=>[row.enrollment_id,row])))
  },[rpc])
  useEffect(()=>{void loadCompetitions()},[loadCompetitions])
  useOperationalInvalidation(['mentoring'],()=>{void loadCompetitions()})

  useEffect(()=>{
    const dialog=detailRef.current
    if(!dialog)return
    if(selected&&!dialog.open)dialog.showModal()
    if(!selected&&dialog.open)dialog.close()
  },[selected])

  useEffect(()=>{
    if(!focusSessionId)return
    const match=sessions.find(session=>session.sessionId===focusSessionId)
    if(match)setSelectedSessionId(match.sessionId)
  },[focusSessionId,sessions])

  useEffect(()=>{
    if(!focusEnrollmentId)return
    setSelectedEnrollmentId(focusEnrollmentId)
    requestAnimationFrame(()=>document.getElementById('private-enrollment-detail')?.scrollIntoView({behavior:'smooth',block:'center'}))
  },[focusEnrollmentId])

  const mentors=useMemo(()=>[...new Set(sessions.map(s=>s.mentorName||s.primaryMentorName).filter((v):v is string=>Boolean(v)))].sort((a,b)=>a.localeCompare(b,'id-ID')),[sessions])
  const focusNames=useMemo(()=>[...new Set(sessions.map(s=>s.focusName).filter((v):v is string=>Boolean(v)))].sort((a,b)=>a.localeCompare(b,'id-ID')),[sessions])
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('id-ID')
    const rows=sessions.filter(session=>{
      if(session.enrollmentId!==selectedEnrollmentId)return false
      const searchable=[session.sessionId,`sesi ${session.sessionNumber}`,session.resolvedTopic,session.menteeTopicRequest,session.focusName,session.mentorName,session.primaryMentorName].filter(Boolean).join(' ').toLocaleLowerCase('id-ID')
      return (!q||searchable.includes(q))
        &&(statusFilter==='all'||session.status===statusFilter)
        &&(mentorFilter==='all'||session.mentorName===mentorFilter||session.primaryMentorName===mentorFilter)
        &&(focusFilter==='all'||session.focusName===focusFilter)
    })
    return [...rows].sort((a,b)=>{
      if(sort==='schedule_asc')return (a.scheduledStartAt?new Date(a.scheduledStartAt).getTime():Number.MAX_SAFE_INTEGER)-(b.scheduledStartAt?new Date(b.scheduledStartAt).getTime():Number.MAX_SAFE_INTEGER)
      if(sort==='schedule_desc')return (b.scheduledStartAt?new Date(b.scheduledStartAt).getTime():Number.MIN_SAFE_INTEGER)-(a.scheduledStartAt?new Date(a.scheduledStartAt).getTime():Number.MIN_SAFE_INTEGER)
      return a.sessionNumber-b.sessionNumber
    })
  },[focusFilter,mentorFilter,query,selectedEnrollmentId,sessions,sort,statusFilter])
  const safePage=Math.min(page,Math.max(0,Math.ceil(filtered.length/pageSize)-1))
  const visible=filtered.slice(safePage*pageSize,safePage*pageSize+pageSize)

  function resetPage(){setPage(0)}

  if(sessions.length===0)return <section className="workspace-card"><p className="kicker">Private Mentoring</p><h3>Belum ada sesi Private Mentoring aktif.</h3><p className="muted">Sesi Private akan muncul setelah pembayaran paket terverifikasi.</p></section>

  return <div className="mentoring-management">
    <div className="mentoring-enrollment-selector" role="list" aria-label="Pilih enrollment Private Mentoring">
      {enrollmentIds.map(enrollmentId=>{
        const rows=sessions.filter(session=>session.enrollmentId===enrollmentId)
        const purchased=rows[0]?.purchasedSessions??rows.length
        const used=rows.filter(session=>session.status==='completed').length
        const comp=competitions[enrollmentId]
        return <button type="button" role="listitem" className={'mentoring-enrollment-summary '+(selectedEnrollmentId===enrollmentId?'active':'')} key={enrollmentId} onClick={()=>{setSelectedEnrollmentId(enrollmentId);resetPage()}}>
          <span className="mentoring-enrollment-summary__eyebrow">Private Mentoring · {rows[0]?.mentorTierName}</span>
          <strong>{purchased} sesi · {used} selesai · {Math.max(0,purchased-used)} tersisa</strong>
          <span>{comp?.competition_name||'Competition / bidang lomba belum dilengkapi'}</span>
          <small>{rows[0]?.primaryMentorName||rows[0]?.mentorName||'Mentor belum ditetapkan'}</small>
        </button>
      })}
    </div>
    {selectedEnrollmentId&&(()=>{
      const rows=sessions.filter(session=>session.enrollmentId===selectedEnrollmentId)
      return <section className="workspace-card private-enrollment-detail" id="private-enrollment-detail">
        <div className="mentoring-group__header"><div><p className="kicker">Enrollment Private Mentoring</p><h3>{rows[0]?.mentorTierName} · {rows[0]?.purchasedSessions??rows.length} sesi dibeli</h3><p className="muted">Metadata kompetisi berlaku untuk enrollment ini. Topik setiap sesi tetap dikelola pada detail sesi.</p></div><span className="ops-status ops-status--info">{rows.filter(session=>session.status==='completed').length} selesai</span></div>
        <div className="mentoring-competition-section"><MentoringCompetitionEditor kind="private" parentId={selectedEnrollmentId}/></div>
      </section>
    })()}

    <section className="workspace-card mentoring-session-table-section">
      <div className="data-management-toolbar">
        <label className="ops-field ops-field--wide"><span>Cari sesi</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15}/><input type="search" value={query} onChange={event=>{setQuery(event.target.value);resetPage()}} placeholder="Session ID, topik, mentor, atau nomor sesi"/></div></label>
        <label className="ops-field"><span>Status</span><select value={statusFilter} onChange={event=>{setStatusFilter(event.target.value);resetPage()}}><option value="all">Semua status</option><option value="awaiting_focus">Menunggu review</option><option value="awaiting_scheduling">Menunggu admin</option><option value="scheduled">Terjadwal</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></label>
        <label className="ops-field"><span>Mentor</span><select value={mentorFilter} onChange={event=>{setMentorFilter(event.target.value);resetPage()}}><option value="all">Semua mentor</option>{mentors.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <label className="ops-field"><span>Fokus</span><select value={focusFilter} onChange={event=>{setFocusFilter(event.target.value);resetPage()}}><option value="all">Semua fokus</option>{focusNames.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <label className="ops-field"><span>Urutkan</span><select value={sort} onChange={event=>{setSort(event.target.value as SortMode);resetPage()}}><option value="session">Nomor sesi</option><option value="schedule_asc">Jadwal terdekat</option><option value="schedule_desc">Jadwal terbaru</option></select></label>
        <label className="ops-field"><span>Per halaman</span><select value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));resetPage()}}>{[5,10,20,50].map(size=><option value={size} key={size}>{size}</option>)}</select></label>
      </div>
      <div className="data-management-summary"><strong>{filtered.length} sesi</strong><span>Gunakan Session ID saat menghubungi admin.</span></div>
      <div className="ops-table-wrap"><table className="ops-table mentee-session-table" data-testid="mentee-mentoring-session-table"><thead><tr><th>Sesi</th><th>Topik / Fokus</th><th>Mentor</th><th>Jadwal</th><th>Status</th><th>Zoom</th><th>Detail</th></tr></thead><tbody>{visible.length?visible.map(session=>{const status=sessionStatus(session.status);return <tr key={session.sessionId}><td data-label="Sesi"><strong>Sesi {session.sessionNumber}/{session.purchasedSessions}</strong><small><code title={session.sessionId}>{shortId(session.sessionId)}</code></small></td><td data-label="Topik / Fokus"><strong>{session.resolvedTopic||session.focusName||'Belum dikonfirmasi'}</strong><small>{topicStatus(session.topicStatus)}</small></td><td data-label="Mentor">{session.mentorName||session.primaryMentorName||'Menunggu admin'}</td><td data-label="Jadwal">{scheduleText(session)}</td><td data-label="Status"><span className={`ops-status ops-status--${status.tone}`}>{status.label}</span></td><td data-label="Zoom">{session.status==='scheduled'&&session.meetingUrl?<a className="button button-primary button-compact" href={session.meetingUrl} target="_blank" rel="noopener noreferrer" aria-label={`Buka Zoom sesi ${session.sessionNumber}`}><ExternalLink aria-hidden="true"/>Zoom</a>:<span className="muted">Belum tersedia</span>}</td><td data-label="Detail"><button className="button button-outline button-compact" type="button" onClick={()=>setSelectedSessionId(session.sessionId)}><Eye aria-hidden="true"/>Detail</button></td></tr>}):<tr className="responsive-table-empty"><td colSpan={7}>Tidak ada sesi yang cocok dengan filter.</td></tr>}</tbody></table></div>
      <TablePagination page={safePage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} label="Pagination sesi Private Mentoring"/>
    </section>

    <dialog ref={detailRef} className="ops-dialog mentoring-detail-dialog" aria-labelledby="mentee-session-detail-title" onCancel={event=>{event.preventDefault();setSelectedSessionId(null)}} onClose={()=>setSelectedSessionId(null)}>
      {selected?<div className="ops-dialog__surface">
        <header className="ops-dialog__header"><div><p className="kicker">Mentoring Saya</p><h2 id="mentee-session-detail-title">Private Mentoring · Sesi {selected.sessionNumber}/{selected.purchasedSessions}</h2><p>Session ID <code>{selected.sessionId}</code></p></div><button type="button" className="ops-icon-button" onClick={()=>setSelectedSessionId(null)} aria-label="Tutup detail"><X/></button></header>
        <div className="session-reference-row"><div><span>Session ID</span><strong>{selected.sessionId}</strong></div><CopyTextButton value={selected.sessionId} label="Salin Session ID" copiedLabel="ID disalin"/></div>
        <dl className="ops-detail-grid">
          <div><span>Package / tier</span><strong>{selected.mentorTierName} · {selected.purchasedSessions} sesi</strong></div>
          <div><span>Status</span><strong>{sessionStatus(selected.status).label}</strong></div>
          <div><span>Competition</span><strong>{competitions[selected.enrollmentId]?.competition_name||'Belum dilengkapi'}</strong></div>
          <div><span>Focus</span><strong>{selected.focusName||'Belum dikonfirmasi'}</strong></div>
          <div><span>Mentor</span><strong>{selected.mentorName||selected.primaryMentorName||'Menunggu admin'}</strong></div>
          <div><span>Jadwal</span><strong>{scheduleText(selected)}</strong></div>
          <div><span>Timezone</span><strong>{selected.mentorTimezone||'Timezone lokal'}</strong></div>
          <div><span>Link meeting</span><strong>{selected.status==='scheduled'&&selected.meetingUrl?'Tersedia':'Belum tersedia'}</strong></div>
        </dl>
        <section className="ops-dialog__section"><MentoringSessionPreferences kind="private" sessionId={selected.sessionId} role="mentee"/></section>
        <div className="calendar-dialog__actions calendar-dialog__actions--wrap">{selected.status==='scheduled'&&selected.meetingUrl?<><a className="button button-primary" href={selected.meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink/>Join Zoom</a><CopyTextButton value={selected.meetingUrl} label="Salin link Zoom" copiedLabel="Link disalin"/></>:null}<a className="button button-outline" href={supportHref(selected)} target="_blank" rel="noopener noreferrer"><MessageCircle/>Hubungi Admin</a></div>
      </div>:null}
    </dialog>
  </div>
}
