'use client'

import { CalendarDays, Eye, Pencil, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CopyTextButton } from '@/components/dashboard/copy-text-button'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { humanizeProviderError } from '@/lib/operations/provider-errors'
import { createClient } from '@/lib/supabase/client'
import type { MentorTier, PrivateMentoringPackage } from '@/lib/supabase/database.types'
import { AdminScheduleDialog } from './admin-schedule-dialog'
import { AdminCompetitionEditor, AdminSessionOperations } from './private-mentoring-session-operations'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'

type EnrollmentRow={total_count:number;enrollment_id:string;mentee_id:string;mentee_email:string;mentee_username:string;mentee_name:string;package_id:string;package_name:string;mentor_tier_id:string;mentor_tier_name:string;purchased_sessions:number;awaiting_focus_sessions:number;awaiting_scheduling_sessions:number;scheduled_sessions:number;completed_sessions:number;configured_sessions:number;purchased_at:string}
type SessionRow={session_id:string;session_number:number;status:string;session_focus_id:string|null;focus_name:string|null;requested_focus_id:string|null;requested_focus_name:string|null;mentee_topic_request:string|null;topic_status:'needs_input'|'pending_review'|'confirmed';resolved_topic:string|null;mentor_scope_notes:string|null;mentor_id:string|null;mentor_name:string|null;primary_mentor_id:string|null;primary_mentor_name:string|null;scheduled_start_at:string|null;scheduled_end_at:string|null;purchased_sessions:number;google_sync_status:string;google_sync_error:string|null}
type FocusRow={id:string;name:string;is_active:boolean}
type EligibleMentor={mentor_id:string;mentor_name:string;tier_id:string;timezone:string}
type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}
type EnrollmentSortKey='user'|'email'|'package'|'purchased_at'|'progress'|'status'
type TopicDraft={focusId:string;resolvedTopic:string;mentorNotes:string}

const DATE=new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'})
const DATE_TIME=new Intl.DateTimeFormat('id-ID',{dateStyle:'full',timeStyle:'short'})

function enrollmentStatus(row:EnrollmentRow){
  if(row.completed_sessions===row.purchased_sessions)return'Selesai'
  if(row.awaiting_focus_sessions>0)return'Menunggu topik'
  if(row.awaiting_scheduling_sessions>0)return'Perlu dijadwalkan'
  if(row.configured_sessions===row.purchased_sessions)return'Semua sesi sudah diatur'
  return'Berjalan'
}
function sessionStatus(value:string){
  if(value==='awaiting_focus')return'Menunggu topik'
  if(value==='awaiting_scheduling')return'Menunggu admin'
  if(value==='scheduled')return'Terjadwal'
  if(value==='completed')return'Selesai'
  if(value==='cancelled')return'Dibatalkan'
  return value.replaceAll('_',' ')
}
function topicStatus(value:SessionRow['topic_status']){
  if(value==='pending_review')return'Menunggu review'
  if(value==='confirmed')return'Dikonfirmasi'
  return'Belum diajukan'
}
function packageLabel(pkg:PrivateMentoringPackage,tiers:MentorTier[]){
  const tier=tiers.find(item=>item.id===pkg.mentor_tier_id)
  return`${tier?.name??'Private Mentoring'} · ${pkg.session_count} sesi`
}
function topicDraft(session:SessionRow):TopicDraft{
  return{
    focusId:session.session_focus_id??session.requested_focus_id??'',
    resolvedTopic:session.resolved_topic??session.mentee_topic_request??'',
    mentorNotes:session.mentor_scope_notes??'',
  }
}

export function PrivateMentoringSessionManagement({focusSessionId,focusEnrollmentId}:{focusSessionId?:string|null;focusEnrollmentId?:string|null}={}){
  const supabase=useMemo(()=>createClient(),[])
  const rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
  const dialogRef=useRef<HTMLDialogElement>(null)
  const cancelDialogRef=useRef<HTMLDialogElement>(null)
  const handledTargetRef=useRef<string|null>(null)

  const[query,setQuery]=useState('')
  const[packageId,setPackageId]=useState('')
  const[tierId,setTierId]=useState('')
  const[progress,setProgress]=useState('all')
  const[fromDate,setFromDate]=useState('')
  const[toDate,setToDate]=useState('')
  const[page,setPage]=useState(0)
  const[pageSize]=useState(10)
  const[total,setTotal]=useState(0)
  const[sortKey,setSortKey]=useState<EnrollmentSortKey|null>(null)
  const[sortDirection,setSortDirection]=useState<SortDirection>(null)

  const[rows,setRows]=useState<EnrollmentRow[]>([])
  const[packages,setPackages]=useState<PrivateMentoringPackage[]>([])
  const[tiers,setTiers]=useState<MentorTier[]>([])
  const[focuses,setFocuses]=useState<FocusRow[]>([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  const[message,setMessage]=useState('')
  const[warning,setWarning]=useState('')
  const[selected,setSelected]=useState<EnrollmentRow|null>(null)
  const[sessions,setSessions]=useState<SessionRow[]>([])
  const[eligibleMentors,setEligibleMentors]=useState<EligibleMentor[]>([])
  const[primaryMentorId,setPrimaryMentorId]=useState('')
  const[mentorReason,setMentorReason]=useState('')
  const[editingPrimaryMentor,setEditingPrimaryMentor]=useState(false)
  const[topicDrafts,setTopicDrafts]=useState<Record<string,TopicDraft>>({})
  const[editingTopics,setEditingTopics]=useState<Set<string>>(()=>new Set())
  const[scheduleId,setScheduleId]=useState<string|null>(null)
  const[cancelTarget,setCancelTarget]=useState<SessionRow|null>(null)
  const[busyId,setBusyId]=useState<string|null>(null)

  const loadCatalog=useCallback(async()=>{
    const[p,t,f]=await Promise.all([
      supabase.from('private_mentoring_packages').select('*').order('sort_order').order('id'),
      supabase.from('mentor_tiers').select('*').eq('is_active',true).order('sort_order').order('name'),
      supabase.from('private_mentoring_session_focuses').select('id,name,is_active').eq('is_active',true).order('sort_order').order('name'),
    ])
    if(p.error||t.error||f.error){setError('Catalog Private Mentoring belum dapat dimuat.');return}
    setPackages(p.data??[])
    setTiers(t.data??[])
    setFocuses((f.data??[]) as FocusRow[])
  },[supabase])

  const load=useCallback(async()=>{
    setLoading(true);setError('')
    const{data,error:e}=await rpc.rpc<EnrollmentRow[]>('list_admin_private_mentoring_enrollments_page',{
      p_query:query.trim(),p_package_id:packageId||null,p_tier_id:tierId||null,p_progress:progress,
      p_from:fromDate||null,p_to:toDate||null,p_limit:pageSize,p_offset:page*pageSize,
    })
    if(e){setError('Daftar pesanan Private Mentoring belum dapat dimuat.');setLoading(false);return}
    const next=data??[]
    if(next.length===0&&page>0){setPage(value=>Math.max(0,value-1));setLoading(false);return}
    setRows(next)
    setSelected(current=>current?next.find(row=>row.enrollment_id===current.enrollment_id)??null:null)
    setTotal(Number(next[0]?.total_count??0));setLoading(false)
  },[fromDate,packageId,page,pageSize,progress,query,rpc,tierId,toDate])

  const loadSessions=useCallback(async(enrollmentId:string)=>{
    const{data,error:e}=await rpc.rpc<SessionRow[]>('get_admin_private_mentoring_enrollment_sessions',{p_enrollment_id:enrollmentId})
    if(e){setError('Detail sesi belum dapat dimuat.');setSessions([]);return}
    const next=data??[]
    setSessions(next)
    setPrimaryMentorId(next[0]?.primary_mentor_id??'')
    setTopicDrafts(Object.fromEntries(next.map(session=>[session.session_id,topicDraft(session)])))
    setEditingPrimaryMentor(false)
    setEditingTopics(new Set())
  },[rpc])

  const loadEligibleMentors=useCallback(async(enrollmentId:string,purchased:number)=>{
    if(purchased<5){setEligibleMentors([]);return}
    const{data,error:e}=await rpc.rpc<EligibleMentor[]>('list_eligible_private_mentoring_enrollment_mentors',{p_enrollment_id:enrollmentId})
    if(e){setWarning('Daftar mentor yang eligible belum dapat dimuat.');setEligibleMentors([]);return}
    setEligibleMentors(data??[])
  },[rpc])

  useEffect(()=>{void loadCatalog()},[loadCatalog])
  useEffect(()=>{const timer=setTimeout(()=>void load(),220);return()=>clearTimeout(timer)},[load])
  useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(selected&&!dialog.open)dialog.showModal();if(!selected&&dialog.open)dialog.close()},[selected])
  useEffect(()=>{const dialog=cancelDialogRef.current;if(!dialog)return;if(cancelTarget&&!dialog.open)dialog.showModal();if(!cancelTarget&&dialog.open)dialog.close()},[cancelTarget])
  const focusTarget=focusSessionId??focusEnrollmentId
  useEffect(()=>{
    if(!focusTarget)return
    handledTargetRef.current=null
    setQuery(focusTarget)
    setPage(0)
  },[focusTarget])
  useEffect(()=>{
    if(!focusTarget||loading||handledTargetRef.current===focusTarget||rows.length===0)return
    const row=rows[0]
    handledTargetRef.current=focusTarget
    setSelected(row);setMessage('');setWarning('');setError('');setMentorReason('')
    void Promise.all([loadSessions(row.enrollment_id),loadEligibleMentors(row.enrollment_id,row.purchased_sessions)])
  },[focusTarget,loadEligibleMentors,loadSessions,loading,rows])
  useEffect(()=>{
    if(!focusSessionId||!sessions.some(session=>session.session_id===focusSessionId))return
    requestAnimationFrame(()=>document.getElementById(`admin-session-${focusSessionId}`)?.scrollIntoView({block:'center'}))
  },[focusSessionId,sessions])

  const visibleRows=useMemo(()=>{
    if(!sortKey||!sortDirection)return rows
    const sign=sortDirection==='asc'?1:-1
    return[...rows].sort((a,b)=>{
      if(sortKey==='purchased_at')return(new Date(a.purchased_at).getTime()-new Date(b.purchased_at).getTime())*sign
      if(sortKey==='progress')return(a.configured_sessions/Math.max(1,a.purchased_sessions)-b.configured_sessions/Math.max(1,b.purchased_sessions))*sign
      const av=sortKey==='user'?a.mentee_name:sortKey==='email'?a.mentee_email:sortKey==='package'?a.package_name:enrollmentStatus(a)
      const bv=sortKey==='user'?b.mentee_name:sortKey==='email'?b.mentee_email:sortKey==='package'?b.package_name:enrollmentStatus(b)
      return av.localeCompare(bv,'id-ID')*sign
    })
  },[rows,sortDirection,sortKey])

  function changeSort(key:string|null,direction:SortDirection){setSortKey(key as EnrollmentSortKey|null);setSortDirection(direction)}
  function resetFilters(){setQuery('');setPackageId('');setTierId('');setProgress('all');setFromDate('');setToDate('');setPage(0)}
  function patchTopic(id:string,patch:Partial<TopicDraft>){setTopicDrafts(current=>({...current,[id]:{...(current[id]??{focusId:'',resolvedTopic:'',mentorNotes:''}),...patch}}))}
  function cancelTopicEdit(session:SessionRow){setTopicDrafts(current=>({...current,[session.session_id]:topicDraft(session)}));setEditingTopics(current=>{const next=new Set(current);next.delete(session.session_id);return next})}

  async function open(row:EnrollmentRow){
    setSelected(row);setMessage('');setWarning('');setError('');setMentorReason('')
    await Promise.all([loadSessions(row.enrollment_id),loadEligibleMentors(row.enrollment_id,row.purchased_sessions)])
  }
  async function refresh(){
    if(selected)await Promise.all([loadSessions(selected.enrollment_id),loadEligibleMentors(selected.enrollment_id,selected.purchased_sessions)])
    await load()
  }

  useOperationalInvalidation(['mentoring', 'provider'],()=>{void refresh()})

  async function setPrimaryMentor(){
    if(!selected||selected.purchased_sessions<5||!primaryMentorId)return
    const current=sessions[0]?.primary_mentor_id??null
    if(current&&current!==primaryMentorId&&!mentorReason.trim()){setError('Alasan wajib diisi saat mengganti mentor utama.');return}
    setBusyId(`mentor:${selected.enrollment_id}`);setError('')
    const{error:e}=await rpc.rpc('admin_set_private_mentoring_primary_mentor',{p_enrollment_id:selected.enrollment_id,p_mentor_id:primaryMentorId,p_reason:mentorReason.trim()||null})
    if(e)setError('Mentor utama belum dapat disimpan. Coba lagi.')
    else{
      setMessage(current?'Mentor utama berhasil diganti dan riwayat perubahan disimpan.':'Mentor utama berhasil ditetapkan untuk enrollment ini.')
      setMentorReason('');setEditingPrimaryMentor(false);await refresh()
    }
    setBusyId(null)
  }

  async function resolveTopic(session:SessionRow){
    const draft=topicDrafts[session.session_id]??topicDraft(session)
    if(!draft.focusId||draft.resolvedTopic.trim().length<3){setError('Pilih kategori focus dan isi topik/scope final minimal 3 karakter.');return}
    setBusyId(`topic:${session.session_id}`);setError('');setWarning('')
    const{error:e}=await rpc.rpc('admin_resolve_private_mentoring_session_topic',{p_session_id:session.session_id,p_focus_id:draft.focusId,p_resolved_topic:draft.resolvedTopic.trim(),p_mentor_scope_notes:draft.mentorNotes.trim()||null})
    if(e){setError('Topik/scope belum dapat disimpan. Coba lagi.');setBusyId(null);return}
    setEditingTopics(current=>{const next=new Set(current);next.delete(session.session_id);return next})
    if(session.status==='scheduled'){
      try{
        const response=await fetch(`/api/admin/private-mentoring/sessions/${session.session_id}/sync`,{method:'POST'})
        const result=await response.json() as{error?:string;status?:string}
        if(!response.ok||result.status==='failed')setWarning(result.error||'Topik tersimpan, tetapi Zoom/Calendar belum berhasil direconcile.')
        else setMessage('Topik/scope dikonfirmasi dan provider meeting serta Calendar sudah direconcile.')
      }catch{setWarning('Topik tersimpan, tetapi Zoom/Calendar belum berhasil direconcile.')}
    }else setMessage('Topik/scope final dikonfirmasi. Sesi siap dijadwalkan.')
    await refresh();setBusyId(null)
  }

  async function cancelSession(session:SessionRow){
    setBusyId(session.session_id);setError('');setMessage('');setWarning('')
    try{
      const response=await fetch(`/api/admin/private-mentoring/sessions/${session.session_id}/cancel`,{method:'POST'})
      const result=await response.json() as{error?:string;sync?:{status?:string;error?:string};zoom?:{status?:string;error?:string}}
      if(!response.ok)throw new Error(result.error||'Sesi belum dapat dibatalkan.')
      setCancelTarget(null)
      if(result.zoom?.status==='failed'&&result.sync?.status==='failed')setWarning('Sesi dibatalkan di Strativate, tetapi Zoom dan Google Calendar masih perlu direconcile.')
      else if(result.zoom?.status==='failed')setWarning(result.zoom.error||'Sesi dibatalkan, tetapi Zoom meeting belum berhasil dibatalkan.')
      else if(result.sync?.status==='failed')setWarning(result.sync.error||'Sesi dibatalkan, tetapi Google Calendar belum berhasil disinkronkan.')
      else setMessage('Sesi dibatalkan dan Zoom serta Google Calendar sudah direconcile.')
      await refresh()
    }catch{setError('Sesi belum dapat dibatalkan. Coba lagi beberapa saat kemudian.')}
    finally{setBusyId(null)}
  }

  async function retryCancellation(session:SessionRow){
    setBusyId(session.session_id);setError('');setWarning('')
    try{
      const response=await fetch(`/api/admin/private-mentoring/sessions/${session.session_id}/sync`,{method:'POST'})
      const result=await response.json() as{error?:string;status?:string}
      if(!response.ok)throw new Error(result.error||'Sinkronisasi belum berhasil.')
      if(result.status==='failed')setWarning('Google Calendar masih belum berhasil disinkronkan.')
      else setMessage('Pembatalan provider dan Google Calendar sudah direconcile.')
      await refresh()
    }catch{setError('Sinkronisasi pembatalan belum berhasil. Coba lagi.')}
    finally{setBusyId(null)}
  }

  const currentPrimary=sessions[0]?.primary_mentor_id??null
  const currentPrimaryName=sessions[0]?.primary_mentor_name??'Belum ditetapkan'

  return <div className="ops-page mentoring-enrollment-page">
    <div className="role-page-title"><p className="kicker">Operasional · Private Mentoring</p><h2>Mentoring Sessions</h2><p>Kelola enrollment, review topik, mentor utama, jadwal, Zoom, dan Session ID dari satu detail operasional.</p></div>

    <div className="ops-filter-bar mentoring-enrollment-filters">
      <label className="ops-field ops-field--wide"><span>Cari user / Session ID</span><div className="ops-input-with-icon"><Search size={15} aria-hidden="true"/><input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(0)}} placeholder="Nama, email, paket, atau full Session ID"/></div></label>
      <label className="ops-field"><span>Paket</span><select value={packageId} onChange={event=>{setPackageId(event.target.value);setPage(0)}}><option value="">Semua paket</option>{packages.map(pkg=><option value={pkg.id} key={pkg.id}>{packageLabel(pkg,tiers)}</option>)}</select></label>
      <label className="ops-field"><span>Tier</span><select value={tierId} onChange={event=>{setTierId(event.target.value);setPage(0)}}><option value="">Semua tier</option>{tiers.map(tier=><option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
      <label className="ops-field"><span>Progress</span><select value={progress} onChange={event=>{setProgress(event.target.value);setPage(0)}}><option value="all">Semua</option><option value="needs_focus">Menunggu topik</option><option value="needs_scheduling">Perlu dijadwalkan</option><option value="configured">Semua sesi sudah diatur</option><option value="in_progress">Berjalan</option><option value="completed">Selesai</option></select></label>
      <label className="ops-field"><span>Dari tanggal beli</span><input type="date" value={fromDate} onChange={event=>{setFromDate(event.target.value);setPage(0)}}/></label>
      <label className="ops-field"><span>Sampai</span><input type="date" value={toDate} onChange={event=>{setToDate(event.target.value);setPage(0)}}/></label>
      <button className="button button-outline ops-reset-action" type="button" onClick={resetFilters}><RotateCcw aria-hidden="true"/>Reset</button>
    </div>

    {error&&!selected?<p className="form-error" role="alert">{error}</p>:null}
    <section className="role-card ops-table-section">
      <div className="ops-section-heading"><div><p className="kicker">Pesanan mentoring</p><h3>{total} paket</h3><p>Satu row mewakili satu enrollment. Search Session ID menemukan parent enrollment yang tepat.</p></div></div>
      <div className="ops-table-wrap"><table className="ops-table mentoring-enrollment-table"><thead><tr><SortableTableHeader label="User / Username" sortKey="user" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Email" sortKey="email" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Paket" sortKey="package" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Tanggal beli" sortKey="purchased_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Progress" sortKey="progress" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><th>Aksi</th></tr></thead><tbody>{visibleRows.map(row=><tr key={row.enrollment_id}><td data-label="User"><strong>{row.mentee_name}</strong><small className="ops-table-secondary">@{row.mentee_username||'username-belum-diatur'}</small></td><td data-label="Email">{row.mentee_email}</td><td data-label="Paket"><strong>{row.package_name}</strong><small className="ops-table-secondary">{row.mentor_tier_name}</small></td><td data-label="Tanggal beli">{DATE.format(new Date(row.purchased_at))}</td><td data-label="Progress">{row.configured_sessions}/{row.purchased_sessions} diatur · {row.completed_sessions} selesai</td><td data-label="Status"><span className="ops-status ops-status--info">{enrollmentStatus(row)}</span></td><td data-label="Detail"><button className="icon-button" type="button" onClick={()=>void open(row)} aria-label={`Lihat detail ${row.mentee_name}`}><Eye aria-hidden="true"/></button></td></tr>)}</tbody></table>{!loading&&visibleRows.length===0?<p className="calendar-empty">Tidak ada enrollment yang cocok.</p>:null}{loading?<p className="calendar-loading">Memuat…</p>:null}</div>
      <TablePagination page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} disabled={loading} label="Pagination enrollment Private Mentoring"/>
    </section>

    <dialog ref={dialogRef} className="calendar-dialog mentoring-session-dialog-flow" onCancel={event=>{event.preventDefault();setSelected(null)}} onClose={()=>setSelected(null)}>
      {selected?<>
        <div className="calendar-dialog__head"><div><p className="kicker">Kelola sesi</p><h3>{selected.mentee_name} · {selected.package_name}</h3><p>{selected.mentee_email} · {selected.mentor_tier_name}</p></div><button type="button" className="icon-button dialog-close-button" onClick={()=>setSelected(null)} aria-label="Tutup detail"><X aria-hidden="true"/></button></div>

        <AdminCompetitionEditor enrollmentId={selected.enrollment_id}/>

        {selected.purchased_sessions>=5?<section className="schedule-day admin-editable-section">
          <div className="admin-editable-section__head"><div><p className="kicker">Mentor utama paket</p><h4>{currentPrimaryName}</h4><p>Paket {selected.purchased_sessions} sesi memakai mentor default untuk penjadwalan baru.</p></div><div className="button-row"><span className="ops-status ops-status--info">Dedicated mentor</span>{!editingPrimaryMentor?<button className="button button-outline button-compact" type="button" onClick={()=>setEditingPrimaryMentor(true)}><Pencil aria-hidden="true"/>{currentPrimary?'Ganti mentor':'Tetapkan mentor'}</button>:null}</div></div>
          {!editingPrimaryMentor?<div className="admin-readonly-grid"><div><span>Mentor utama</span><strong>{currentPrimaryName}</strong></div><div><span>Aturan</span><strong>Default untuk sesi baru pada paket ini</strong></div></div>:<div className="ops-form-stack admin-edit-form">
            <label className="ops-field"><span>{currentPrimary?'Ganti mentor':'Set mentor utama'}</span><select value={primaryMentorId} onChange={event=>setPrimaryMentorId(event.target.value)}><option value="">Pilih mentor sesuai tier</option>{eligibleMentors.map(mentor=><option key={mentor.mentor_id} value={mentor.mentor_id}>{mentor.mentor_name}</option>)}</select></label>
            {currentPrimary&&primaryMentorId&&primaryMentorId!==currentPrimary?<label className="ops-field"><span>Alasan perubahan</span><textarea rows={2} value={mentorReason} onChange={event=>setMentorReason(event.target.value)} placeholder="Alasan operasional perubahan mentor"/></label>:null}
            <div className="button-row"><button className="button button-primary" type="button" disabled={!primaryMentorId||busyId===`mentor:${selected.enrollment_id}`} onClick={()=>void setPrimaryMentor()}>{currentPrimary?'Simpan pergantian mentor':'Simpan mentor utama'}</button><button className="button button-outline" type="button" onClick={()=>{setEditingPrimaryMentor(false);setPrimaryMentorId(currentPrimary??'');setMentorReason('')}}>Batal</button></div>
          </div>}
        </section>:<section className="schedule-day"><p className="kicker">Mentor per sesi</p><p>Paket di bawah 5 sesi tetap fleksibel; mentor dipilih per sesi dari tier paket saat penjadwalan.</p></section>}

        <div className="schedule-slot-list">{sessions.map(session=>{
          const draft=topicDrafts[session.session_id]??topicDraft(session)
          const locked=session.status==='completed'||session.status==='cancelled'
          const editing=editingTopics.has(session.session_id)
          const canSchedule=session.topic_status==='confirmed'&&(session.status==='awaiting_scheduling'||session.status==='scheduled')
          const calendarError=session.google_sync_error?humanizeProviderError('calendar',session.google_sync_error):null
          return <article className="schedule-day admin-session-card" id={`admin-session-${session.session_id}`} key={session.session_id}>
            <div className="mentoring-session-detail-row"><div><p className="kicker">Sesi {session.session_number}/{session.purchased_sessions} · {topicStatus(session.topic_status)}</p><h4>{session.resolved_topic||session.focus_name||session.mentee_topic_request||'Topik belum diajukan'}</h4><div className="session-id-cell session-id-cell--admin"><code>{session.session_id}</code><CopyTextButton value={session.session_id} label="Salin Session ID" copiedLabel="ID disalin"/></div><p>{session.mentor_name||session.primary_mentor_name||'Mentor belum ditetapkan'} · {session.scheduled_start_at?DATE_TIME.format(new Date(session.scheduled_start_at)):'Belum terjadwal'}</p>{session.status==='cancelled'&&session.google_sync_status==='failed'?<small className="form-error">{calendarError||'Pembatalan Calendar belum tersinkron.'}</small>:null}</div><span className="ops-status ops-status--info">{sessionStatus(session.status)}</span></div>

            {!editing?<div className="admin-topic-readonly">
              <div className="admin-editable-section__head"><div><p className="kicker">Topic / scope</p><h4>{session.resolved_topic||'Belum dikonfirmasi'}</h4></div>{!locked?<button className="button button-outline button-compact" type="button" onClick={()=>setEditingTopics(current=>new Set(current).add(session.session_id))}><Pencil aria-hidden="true"/>Edit</button>:null}</div>
              <div className="admin-readonly-grid admin-readonly-grid--topic"><div><span>Focus taxonomy final</span><strong>{session.focus_name||'Belum ditetapkan'}</strong></div><div><span>Request mentee</span><strong>{session.mentee_topic_request||'Tidak ada'}</strong></div><div><span>Kategori yang diminta</span><strong>{session.requested_focus_name||'Tidak ada'}</strong></div><div><span>Catatan untuk mentor</span><strong>{session.mentor_scope_notes||'Tidak ada catatan'}</strong></div></div>
            </div>:<div className="ops-form-stack admin-edit-form">
              <label className="ops-field"><span>Focus taxonomy final</span><select value={draft.focusId} onChange={event=>patchTopic(session.session_id,{focusId:event.target.value})}><option value="">Pilih focus</option>{focuses.map(focus=><option key={focus.id} value={focus.id}>{focus.name}</option>)}</select></label>
              <label className="ops-field"><span>Topik / scope final</span><textarea rows={3} value={draft.resolvedTopic} onChange={event=>patchTopic(session.session_id,{resolvedTopic:event.target.value})}/></label>
              <label className="ops-field"><span>Catatan untuk mentor (opsional)</span><textarea rows={2} value={draft.mentorNotes} onChange={event=>patchTopic(session.session_id,{mentorNotes:event.target.value})}/></label>
              <div className="button-row"><button className="button button-primary" type="button" disabled={busyId===`topic:${session.session_id}`} onClick={()=>void resolveTopic(session)}>Simpan topik/scope</button><button className="button button-outline" type="button" onClick={()=>cancelTopicEdit(session)}>Batal</button></div>
            </div>}

            <div className="button-row session-primary-actions">
              {canSchedule?<button className="button button-primary" type="button" onClick={()=>setScheduleId(session.session_id)}><CalendarDays aria-hidden="true"/>{session.status==='scheduled'?'Ubah jadwal':'Jadwalkan sesi'}</button>:null}
              {session.status==='scheduled'?<button className="button button-outline mentoring-session-cancel-trigger" type="button" disabled={busyId===session.session_id} onClick={()=>setCancelTarget(session)}><X aria-hidden="true"/>Batalkan sesi</button>:null}
              {session.status==='cancelled'&&session.google_sync_status==='failed'?<button className="button button-outline" type="button" disabled={busyId===session.session_id} onClick={()=>void retryCancellation(session)}><RefreshCw aria-hidden="true"/>Sinkronkan pembatalan</button>:null}
            </div>

            <AdminSessionOperations sessionId={session.session_id} status={session.status} menteeName={selected.mentee_name} sessionNumber={session.session_number} mentorName={session.mentor_name||session.primary_mentor_name} scheduledStartAt={session.scheduled_start_at} onChanged={refresh}/>
          </article>
        })}</div>

        {error?<p className="form-error" role="alert">{error}</p>:null}
        {warning?<p className="calendar-warning" role="status">{warning}</p>:null}
        {message?<p className="form-success" role="status">{message}</p>:null}
      </>:null}
    </dialog>

    <dialog ref={cancelDialogRef} className="calendar-dialog mentoring-cancel-dialog compact-confirm-dialog" onCancel={event=>{event.preventDefault();setCancelTarget(null)}} onClose={()=>setCancelTarget(null)}>
      {cancelTarget?<>
        <div className="calendar-dialog__head"><div><p className="kicker">Konfirmasi pembatalan</p><h3>Batalkan sesi {cancelTarget.session_number}?</h3></div><button type="button" className="icon-button dialog-close-button" onClick={()=>setCancelTarget(null)} aria-label="Tutup konfirmasi"><X aria-hidden="true"/></button></div>
        <div className="compact-confirm-dialog__body"><p>Pembatalan akan menjalankan lifecycle berikut:</p><ul className="cancellation-consequences"><li>Sesi dibatalkan di Strativate.</li><li>Zoom meeting akan dihentikan sesuai lifecycle bila sudah tersedia.</li><li>undangan Google Calendar terkait akan dibatalkan atau direconcile.</li><li>Participant tidak dapat menggunakan sesi yang sudah dibatalkan.</li></ul><div className="button-row compact-confirm-dialog__actions"><button className="button button-outline" type="button" onClick={()=>setCancelTarget(null)}>Kembali</button><button className="button mentoring-session-cancel-confirm" type="button" disabled={busyId===cancelTarget.session_id} onClick={()=>void cancelSession(cancelTarget)}>Ya, batalkan sesi</button></div></div>
      </>:null}
    </dialog>

    <AdminScheduleDialog sessionId={scheduleId} onClose={()=>setScheduleId(null)} onScheduled={()=>{setScheduleId(null);void refresh()}}/>
  </div>
}
