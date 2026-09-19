'use client'

import { ExternalLink, Eye, MessageCircle, Pencil, Save, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { TablePagination } from '@/components/admin/table-pagination'
import { CopyTextButton } from '@/components/dashboard/copy-text-button'
import { publicContact } from '@/lib/content/brand'
import { createClient } from '@/lib/supabase/client'
import type { PrivateMentoringSessionFocusView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'

type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}
type Draft={topic:string;focusId:string}
type Competition={enrollment_id:string;competition_category_id:string|null;competition_category_name:string|null;competition_name:string|null;competition_updated_at:string|null}
type Category={id:string;name:string}
type CompetitionDraft={categoryId:string;name:string}
type SortMode='session'|'schedule_asc'|'schedule_desc'

function sessionStatus(status:string){
  if(status==='awaiting_focus')return{label:'Menunggu topik',tone:'warning'}
  if(status==='awaiting_scheduling')return{label:'Menunggu admin',tone:'info'}
  if(status==='scheduled')return{label:'Terjadwal',tone:'positive'}
  if(status==='completed')return{label:'Selesai',tone:'neutral'}
  if(status==='cancelled')return{label:'Dibatalkan',tone:'neutral'}
  return{label:status.replaceAll('_',' '),tone:'neutral'}
}
function topicStatus(status:PrivateMentoringSessionView['topicStatus']){
  if(status==='pending_review')return'Menunggu review admin'
  if(status==='confirmed')return'Topik dikonfirmasi'
  return'Topik belum diajukan'
}
function meetingProvider(url:string|null){
  if(!url)return'Belum tersedia'
  if(/zoom\./i.test(url))return'Zoom'
  return'Manual override'
}
function supportHref(session:PrivateMentoringSessionView){
  const when=session.scheduledStartAt
    ? new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:session.mentorTimezone||undefined}).format(new Date(session.scheduledStartAt))
    : 'jadwal yang sedang dibahas'
  return publicContact.whatsapp+'?text='+encodeURIComponent('Halo admin Strativate, mau diskusi terkait jadwal mentoring sesi '+session.sessionNumber+' pada '+when+'. Session ID: '+session.sessionId)
}
function canEditTopic(session:PrivateMentoringSessionView){
  if(session.status==='completed'||session.status==='cancelled')return false
  if(session.scheduledStartAt&&session.status==='scheduled')return new Date(session.scheduledStartAt).getTime()>Date.now()
  return true
}
function shortId(id:string){return '…'+id.slice(-8)}
function scheduleText(session:PrivateMentoringSessionView){
  return session.scheduledStartAt
    ? new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:session.mentorTimezone||undefined}).format(new Date(session.scheduledStartAt))
    : 'Menunggu admin'
}

export function PrivateMentoringSessions({
  sessions,
  sessionFocuses,
  focusSessionId,
  focusEnrollmentId,
}:{
  sessions:PrivateMentoringSessionView[]
  sessionFocuses:PrivateMentoringSessionFocusView[]
  focusSessionId?:string|null
  focusEnrollmentId?:string|null
}){
  const router=useRouter()
  const supabase=useMemo(()=>createClient(),[])
  const rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
  const[busyId,setBusyId]=useState<string|null>(null)
  const[message,setMessage]=useState('')
  const[drafts,setDrafts]=useState<Record<string,Draft>>({})
  const[competitions,setCompetitions]=useState<Record<string,Competition>>({})
  const[competitionDrafts,setCompetitionDrafts]=useState<Record<string,CompetitionDraft>>({})
  const[categories,setCategories]=useState<Category[]>([])
  const[selected,setSelected]=useState<PrivateMentoringSessionView|null>(null)
  const[editingTopic,setEditingTopic]=useState(false)
  const[editingCompetitions,setEditingCompetitions]=useState<Set<string>>(()=>new Set())
  const[query,setQuery]=useState('')
  const[statusFilter,setStatusFilter]=useState('all')
  const[mentorFilter,setMentorFilter]=useState('all')
  const[focusFilter,setFocusFilter]=useState('all')
  const[sort,setSort]=useState<SortMode>('session')
  const[page,setPage]=useState(0)
  const[pageSize,setPageSize]=useState(10)
  const detailRef=useRef<HTMLDialogElement>(null)
  const enrollmentIds=[...new Set(sessions.map(session=>session.enrollmentId))]

  useEffect(()=>{
    let active=true
    void Promise.all([
      rpc.rpc<Competition[]>('list_my_private_mentoring_competitions'),
      supabase.from('competition_categories').select('id,name').eq('is_active',true).order('sort_order'),
    ]).then(([competition,catalog])=>{
      if(!active)return
      const rows=competition.data??[]
      setCompetitions(Object.fromEntries(rows.map(row=>[row.enrollment_id,row])))
      setCompetitionDrafts(Object.fromEntries(rows.map(row=>[row.enrollment_id,{categoryId:row.competition_category_id??'',name:row.competition_name??''}])))
      setCategories((catalog.data??[]) as Category[])
    })
    return()=>{active=false}
  },[rpc,supabase])

  useEffect(()=>{
    const dialog=detailRef.current
    if(!dialog)return
    if(selected&&!dialog.open)dialog.showModal()
    if(!selected&&dialog.open)dialog.close()
  },[selected])

  useEffect(()=>{setEditingTopic(false)},[selected?.sessionId])

  useEffect(()=>{
    if(!focusSessionId)return
    const match=sessions.find(session=>session.sessionId===focusSessionId)
    if(match)setSelected(match)
  },[focusSessionId,sessions])

  useEffect(()=>{
    if(!focusEnrollmentId)return
    requestAnimationFrame(()=>document.getElementById(`mentoring-enrollment-${focusEnrollmentId}`)?.scrollIntoView({behavior:'smooth',block:'center'}))
  },[focusEnrollmentId])

  const mentors=useMemo(()=>[...new Set(sessions.map(s=>s.mentorName||s.primaryMentorName).filter((v):v is string=>Boolean(v)))].sort((a,b)=>a.localeCompare(b,'id-ID')),[sessions])
  const focusNames=useMemo(()=>[...new Set(sessions.map(s=>s.focusName).filter((v):v is string=>Boolean(v)))].sort((a,b)=>a.localeCompare(b,'id-ID')),[sessions])
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('id-ID')
    const rows=sessions.filter(session=>{
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
  },[focusFilter,mentorFilter,query,sessions,sort,statusFilter])
  const safePage=Math.min(page,Math.max(0,Math.ceil(filtered.length/pageSize)-1))
  const visible=filtered.slice(safePage*pageSize,safePage*pageSize+pageSize)

  function resetPage(){setPage(0)}
  function draftFor(session:PrivateMentoringSessionView):Draft{
    return drafts[session.sessionId]??{topic:session.menteeTopicRequest??session.resolvedTopic??'',focusId:session.requestedFocusId??session.sessionFocusId??''}
  }
  function patchDraft(session:PrivateMentoringSessionView,patch:Partial<Draft>){
    setDrafts(current=>({...current,[session.sessionId]:{...draftFor(session),...patch}}))
  }
  function competitionDraft(enrollmentId:string):CompetitionDraft{
    return competitionDrafts[enrollmentId]??{categoryId:competitions[enrollmentId]?.competition_category_id??'',name:competitions[enrollmentId]?.competition_name??''}
  }

  async function submitTopic(session:PrivateMentoringSessionView){
    const draft=draftFor(session)
    const topic=draft.topic.trim()
    if(topic.length<5){setMessage('Ceritakan tujuan atau hal yang ingin dibahas minimal 5 karakter.');return}
    setBusyId(session.sessionId);setMessage('')
    const{error}=await rpc.rpc('submit_private_mentoring_topic_request',{p_session_id:session.sessionId,p_requested_focus_id:draft.focusId||null,p_topic_request:topic})
    setBusyId(null)
    if(error){setMessage(error.message);return}
    setMessage(session.topicStatus==='confirmed'?'Perubahan topik dikirim untuk review ulang admin.':'Permintaan topik terkirim. Admin akan meninjau scope final.')
    setEditingTopic(false)
    router.refresh()
  }

  async function saveCompetition(enrollmentId:string){
    const draft=competitionDraft(enrollmentId)
    if(draft.name.trim().length<2){setMessage('Competition / bidang lomba wajib diisi minimal 2 karakter.');return}
    setBusyId('competition:'+enrollmentId);setMessage('')
    const{error}=await rpc.rpc('set_private_mentoring_competition',{p_enrollment_id:enrollmentId,p_competition_category_id:draft.categoryId||null,p_competition_name:draft.name.trim()})
    setBusyId(null)
    if(error){setMessage(error.message);return}
    setCompetitions(current=>({...current,[enrollmentId]:{
      enrollment_id:enrollmentId,
      competition_category_id:draft.categoryId||null,
      competition_category_name:categories.find(item=>item.id===draft.categoryId)?.name??null,
      competition_name:draft.name.trim(),
      competition_updated_at:new Date().toISOString(),
    }}))
    setEditingCompetitions(current=>{const next=new Set(current);next.delete(enrollmentId);return next})
    setMessage('Competition / bidang lomba tersimpan. Data ini terpisah dari topic/scope tiap sesi.')
    router.refresh()
  }

  if(sessions.length===0)return <section className="workspace-card"><p className="kicker">Private Mentoring</p><h3>Belum ada sesi Private Mentoring aktif.</h3><p className="muted">Sesi Private akan muncul setelah pembayaran paket terverifikasi.</p></section>

  return <div className="mentoring-management">
    <div className="mentoring-enrollment-summaries">
      {enrollmentIds.map(enrollmentId=>{
        const rows=sessions.filter(session=>session.enrollmentId===enrollmentId)
        const purchased=rows[0]?.purchasedSessions??rows.length
        const used=rows.filter(session=>session.status==='completed').length
        const comp=competitions[enrollmentId]
        const compDraft=competitionDraft(enrollmentId)
        return <section className="workspace-card mentoring-enrollment-summary" id={`mentoring-enrollment-${enrollmentId}`} key={enrollmentId}>
          <div className="mentoring-group__header"><div><p className="kicker">Private Mentoring · {rows[0]?.mentorTierName}</p><h3>{purchased} sesi · {used} selesai · {Math.max(0,purchased-used)} tersisa</h3></div><span className="ops-status ops-status--info">{rows[0]?.mentorTierName}</span></div>
          <div className="mentoring-competition-section">
            {comp?.competition_name&&!editingCompetitions.has(enrollmentId)?<div className="competition-readonly"><div><span>Competition / bidang lomba</span><strong>{comp.competition_name}</strong><small>{comp.competition_category_name||'Tanpa kategori'}</small></div><button className="button button-outline button-compact" type="button" onClick={()=>setEditingCompetitions(current=>new Set(current).add(enrollmentId))}><Pencil aria-hidden="true"/>Edit</button></div>:<div className="ops-form-stack competition-edit-form"><p className="kicker">{comp?.competition_name?'Edit competition':'Wajib dilengkapi sebelum scheduling'}</p><label className="ops-field"><span>Kategori (opsional)</span><select value={compDraft.categoryId} onChange={event=>setCompetitionDrafts(current=>({...current,[enrollmentId]:{...compDraft,categoryId:event.target.value}}))}><option value="">Tanpa kategori</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="ops-field"><span>Nama lomba / bidang lomba</span><input value={compDraft.name} maxLength={300} onChange={event=>setCompetitionDrafts(current=>({...current,[enrollmentId]:{...compDraft,name:event.target.value}}))} placeholder="Contoh: Business Case Competition"/></label><div className="button-row"><button className="button competition-save-button" type="button" disabled={busyId==='competition:'+enrollmentId} onClick={()=>void saveCompetition(enrollmentId)}><Save aria-hidden="true"/>{busyId==='competition:'+enrollmentId?'Menyimpan…':'Simpan lomba'}</button>{comp?.competition_name?<button className="button button-ghost" type="button" onClick={()=>{setCompetitionDrafts(current=>({...current,[enrollmentId]:{categoryId:comp.competition_category_id??'',name:comp.competition_name??''}}));setEditingCompetitions(current=>{const next=new Set(current);next.delete(enrollmentId);return next})}}>Batal</button>:null}</div></div>}
          </div>
        </section>
      })}
    </div>

    <section className="workspace-card mentoring-session-table-section">
      <div className="data-management-toolbar">
        <label className="ops-field ops-field--wide"><span>Cari sesi</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15}/><input type="search" value={query} onChange={event=>{setQuery(event.target.value);resetPage()}} placeholder="Session ID, topik, mentor, atau nomor sesi"/></div></label>
        <label className="ops-field"><span>Status</span><select value={statusFilter} onChange={event=>{setStatusFilter(event.target.value);resetPage()}}><option value="all">Semua status</option><option value="awaiting_focus">Menunggu topik</option><option value="awaiting_scheduling">Menunggu admin</option><option value="scheduled">Terjadwal</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></label>
        <label className="ops-field"><span>Mentor</span><select value={mentorFilter} onChange={event=>{setMentorFilter(event.target.value);resetPage()}}><option value="all">Semua mentor</option>{mentors.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <label className="ops-field"><span>Fokus</span><select value={focusFilter} onChange={event=>{setFocusFilter(event.target.value);resetPage()}}><option value="all">Semua fokus</option>{focusNames.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <label className="ops-field"><span>Urutkan</span><select value={sort} onChange={event=>{setSort(event.target.value as SortMode);resetPage()}}><option value="session">Nomor sesi</option><option value="schedule_asc">Jadwal terdekat</option><option value="schedule_desc">Jadwal terbaru</option></select></label>
        <label className="ops-field"><span>Per halaman</span><select value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));resetPage()}}>{[5,10,20,50].map(size=><option value={size} key={size}>{size}</option>)}</select></label>
      </div>
      <div className="data-management-summary"><strong>{filtered.length} sesi</strong><span>Gunakan Session ID saat menghubungi admin.</span></div>
      <div className="ops-table-wrap"><table className="ops-table mentee-session-table" data-testid="mentee-mentoring-session-table"><thead><tr><th>Session ID</th><th>Sesi</th><th>Topik / Focus</th><th>Mentor</th><th>Jadwal</th><th>Status</th><th>Zoom</th><th>Detail</th></tr></thead><tbody>{visible.length?visible.map(session=>{const status=sessionStatus(session.status);return <tr key={session.sessionId}><td><div className="session-id-cell"><code title={session.sessionId}>{shortId(session.sessionId)}</code><CopyTextButton value={session.sessionId} label="Salin Session ID" copiedLabel="ID disalin"/></div></td><td>Sesi {session.sessionNumber}/{session.purchasedSessions}</td><td><strong>{session.resolvedTopic||session.focusName||'Belum dikonfirmasi'}</strong><small>{topicStatus(session.topicStatus)}</small></td><td>{session.mentorName||session.primaryMentorName||'Menunggu admin'}</td><td>{scheduleText(session)}</td><td><span className={`ops-status ops-status--${status.tone}`}>{status.label}</span></td><td>{session.status==='scheduled'&&session.meetingUrl?<div className="table-action-group"><a className="button button-primary button-compact" href={session.meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true"/>Zoom</a><CopyTextButton value={session.meetingUrl} label="Salin link Zoom" copiedLabel="Link disalin"/></div>:<span className="muted">Belum tersedia</span>}</td><td><button className="button button-outline button-compact" type="button" onClick={()=>setSelected(session)}><Eye aria-hidden="true"/>Detail</button></td></tr>}):<tr><td colSpan={8}>Tidak ada sesi yang cocok dengan filter.</td></tr>}</tbody></table></div>
      <TablePagination page={safePage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} label="Pagination sesi Private Mentoring"/>
    </section>

    {message?<p className="muted" role="status">{message}</p>:null}

    <dialog ref={detailRef} className="ops-dialog mentoring-detail-dialog" aria-labelledby="mentee-session-detail-title" onCancel={event=>{event.preventDefault();setSelected(null)}} onClose={()=>setSelected(null)}>
      {selected?<div className="ops-dialog__surface">
        <header className="ops-dialog__header"><div><p className="kicker">Mentoring Saya</p><h2 id="mentee-session-detail-title">Private Mentoring · Sesi {selected.sessionNumber}/{selected.purchasedSessions}</h2><p>Session ID <code>{selected.sessionId}</code></p></div><button type="button" className="ops-icon-button" onClick={()=>setSelected(null)} aria-label="Tutup detail"><X/></button></header>
        <div className="session-reference-row"><div><span>Session ID</span><strong>{selected.sessionId}</strong></div><CopyTextButton value={selected.sessionId} label="Salin Session ID" copiedLabel="ID disalin"/></div>
        <dl className="ops-detail-grid">
          <div><span>Package / tier</span><strong>{selected.mentorTierName} · {selected.purchasedSessions} sesi</strong></div>
          <div><span>Status</span><strong>{sessionStatus(selected.status).label}</strong></div>
          <div><span>Competition</span><strong>{competitions[selected.enrollmentId]?.competition_name||'Belum dilengkapi'}</strong></div>
          <div><span>Focus</span><strong>{selected.focusName||'Belum dikonfirmasi'}</strong></div>
          <div><span>Mentor</span><strong>{selected.mentorName||selected.primaryMentorName||'Menunggu admin'}</strong></div>
          <div><span>Jadwal</span><strong>{scheduleText(selected)}</strong></div>
          <div><span>Timezone</span><strong>{selected.mentorTimezone||'Timezone lokal'}</strong></div>
          <div><span>Meeting provider</span><strong>{meetingProvider(selected.meetingUrl)}</strong></div>
        </dl>
        <section className="ops-dialog__section"><div className="section-heading-with-action"><div><h3>Topik / scope sesi</h3><p>{topicStatus(selected.topicStatus)}</p></div>{canEditTopic(selected)&&!editingTopic?<button className="button button-outline button-compact" type="button" onClick={()=>setEditingTopic(true)}><Pencil aria-hidden="true"/>Edit topik sesi</button>:null}</div>
          {!editingTopic?<div className="topic-readonly-grid"><div><span>Scope final</span><strong>{selected.resolvedTopic||'Belum dikonfirmasi admin'}</strong></div><div><span>Permintaan kamu</span><strong>{selected.menteeTopicRequest||'Belum diajukan'}</strong></div></div>:<div className="ops-form-stack topic-edit-form"><label className="ops-field"><span>Apa yang ingin kamu bahas di sesi ini?</span><textarea rows={4} disabled={busyId===selected.sessionId} value={draftFor(selected).topic} onChange={event=>patchDraft(selected,{topic:event.target.value})} placeholder="Ceritakan tujuan, masalah, atau scope yang ingin dibahas."/></label><label className="ops-field"><span>Kategori fokus (opsional)</span><select disabled={busyId===selected.sessionId} value={draftFor(selected).focusId} onChange={event=>patchDraft(selected,{focusId:event.target.value})}><option value="">Biarkan admin membantu mengelompokkan</option>{sessionFocuses.map(focus=><option value={focus.id} key={focus.id}>{focus.name}</option>)}</select></label><div className="button-row"><button className="button button-primary" type="button" disabled={busyId===selected.sessionId} onClick={()=>void submitTopic(selected)}><Save aria-hidden="true"/>{selected.topicStatus==='confirmed'?'Ajukan perubahan topik':'Kirim untuk review'}</button><button className="button button-outline" type="button" onClick={()=>setEditingTopic(false)}>Batal</button></div></div>}
        </section>
        <div className="calendar-dialog__actions calendar-dialog__actions--wrap">{selected.status==='scheduled'&&selected.meetingUrl?<><a className="button button-primary" href={selected.meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink/>Join Zoom</a><CopyTextButton value={selected.meetingUrl} label="Salin link Zoom" copiedLabel="Link disalin"/></>:null}<a className="button button-outline" href={supportHref(selected)} target="_blank" rel="noopener noreferrer"><MessageCircle/>Hubungi Admin</a></div>
      </div>:null}
    </dialog>
  </div>
}
