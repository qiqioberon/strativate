'use client'

import { AlertTriangle, CalendarDays, CheckCircle2, Eye, Pencil, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CopyTextButton } from '@/components/dashboard/copy-text-button'
import { MentoringSessionPreferences } from '@/components/mentoring/mentoring-session-preferences'
import { MentoringCompetitionEditor } from '@/components/mentoring/mentoring-competition-editor'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { createClient } from '@/lib/supabase/client'
import type { MentorTier, PrivateMentoringPackage } from '@/lib/supabase/database.types'
import { AdminScheduleDialog } from './admin-schedule-dialog'
import { AdminSessionOperations, type AdminMeetingState } from './private-mentoring-session-operations'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'

type EnrollmentRow={total_count:number;enrollment_id:string;mentee_id:string;mentee_email:string;mentee_username:string;mentee_name:string;package_id:string;package_name:string;mentor_tier_id:string;mentor_tier_name:string;purchased_sessions:number;awaiting_focus_sessions:number;awaiting_scheduling_sessions:number;scheduled_sessions:number;completed_sessions:number;configured_sessions:number;purchased_at:string}
type SessionRow={session_id:string;session_number:number;status:string;session_focus_id:string|null;focus_name:string|null;requested_focus_id:string|null;requested_focus_name:string|null;mentee_topic_request:string|null;topic_status:'needs_input'|'pending_review'|'confirmed';resolved_topic:string|null;mentor_scope_notes:string|null;mentor_id:string|null;mentor_name:string|null;primary_mentor_id:string|null;primary_mentor_name:string|null;scheduled_start_at:string|null;scheduled_end_at:string|null;purchased_sessions:number;google_sync_status:string;google_sync_error:string|null}
type EligibleMentor={mentor_id:string;mentor_name:string;tier_id:string;timezone:string}
type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}
type EnrollmentSortKey='user'|'email'|'package'|'purchased_at'|'progress'|'status'

const DATE=new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'})
const DATE_TIME=new Intl.DateTimeFormat('id-ID',{dateStyle:'full',timeStyle:'short'})
const SHORT_DATE_TIME=new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'})

function enrollmentStatus(row:EnrollmentRow){
  if(row.completed_sessions===row.purchased_sessions)return'Selesai'
  if(row.awaiting_focus_sessions>0)return'Menunggu review admin'
  if(row.awaiting_scheduling_sessions>0)return'Perlu dijadwalkan'
  if(row.configured_sessions===row.purchased_sessions)return'Semua sesi sudah diatur'
  return'Berjalan'
}
function enrollmentStatusClass(row:EnrollmentRow){
  if(row.completed_sessions===row.purchased_sessions)return'ops-status--success'
  if(row.awaiting_focus_sessions>0||row.awaiting_scheduling_sessions>0)return'ops-status--warning'
  if(row.configured_sessions===row.purchased_sessions)return'ops-status--positive'
  return'ops-status--info'
}
function sessionStatus(value:string){
  if(value==='awaiting_focus')return'Menunggu preferensi'
  if(value==='awaiting_scheduling')return'Belum dijadwalkan'
  if(value==='scheduled')return'Terjadwal'
  if(value==='completed')return'Selesai'
  if(value==='cancelled')return'Dibatalkan'
  return value.replaceAll('_',' ')
}
function sessionStatusClass(value:string){
  if(value==='completed')return'ops-status--success'
  if(value==='cancelled')return'ops-status--danger'
  if(value==='scheduled')return'mentoring-status--scheduled'
  if(value==='awaiting_scheduling')return'ops-status--neutral'
  return'ops-status--neutral'
}
function topicStatus(value:SessionRow['topic_status']){
  if(value==='pending_review')return'Belum ditinjau'
  if(value==='confirmed')return'Sudah ditinjau'
  return'Belum diajukan'
}
function preferenceActionLabel(value:SessionRow['topic_status']){
  if(value==='confirmed')return'Edit preferensi'
  if(value==='pending_review')return'Review preferensi'
  return'Lengkapi preferensi'
}
function topicStatusClass(value:SessionRow['topic_status']){
  if(value==='confirmed')return'ops-status--success'
  if(value==='pending_review')return'ops-status--warning'
  return'ops-status--neutral'
}
function packageLabel(pkg:PrivateMentoringPackage,tiers:MentorTier[]){
  const tier=tiers.find(item=>item.id===pkg.mentor_tier_id)
  return(tier?.name??'Private Mentoring')+' · '+pkg.session_count+' sesi'
}
function compactPackageName(row:EnrollmentRow){
  const withoutCount=row.package_name.replace(new RegExp('\\s*[–—-]\\s*'+row.purchased_sessions+'\\s*(?:sessions?|sesi)\\s*$','i'),'').trim()
  return(withoutCount||row.package_name).replace(/\s+[–—-]\s+/g,' · ')
}
function compactPackageMeta(row:EnrollmentRow){
  const label=compactPackageName(row).toLocaleLowerCase('id-ID')
  const tier=row.mentor_tier_name.trim()
  return tier&&!label.includes(tier.toLocaleLowerCase('id-ID'))?tier+' · '+row.purchased_sessions+' sesi':row.purchased_sessions+' sesi'
}
function sessionHeadline(session:SessionRow){
  return session.resolved_topic||session.focus_name||session.mentee_topic_request||'Preferensi opsional belum diisi'
}
function selectInitialSession(sessions:SessionRow[],preferredId?:string|null){
  if(preferredId&&sessions.some(session=>session.session_id===preferredId))return preferredId
  const actionable=sessions.filter(session=>session.status!=='completed'&&session.status!=='cancelled')
  const review=actionable.find(session=>session.topic_status==='pending_review')
  if(review)return review.session_id
  const scheduling=actionable.find(session=>session.topic_status==='confirmed'&&session.status==='awaiting_scheduling')
  if(scheduling)return scheduling.session_id
  const now=Date.now()
  const upcoming=actionable
    .filter(session=>session.scheduled_start_at&&new Date(session.scheduled_start_at).getTime()>=now)
    .sort((a,b)=>new Date(a.scheduled_start_at||0).getTime()-new Date(b.scheduled_start_at||0).getTime())[0]
  if(upcoming)return upcoming.session_id
  const latestScheduled=[...actionable]
    .filter(session=>session.scheduled_start_at)
    .sort((a,b)=>new Date(b.scheduled_start_at||0).getTime()-new Date(a.scheduled_start_at||0).getTime())[0]
  return latestScheduled?.session_id??actionable.at(-1)?.session_id??sessions.at(-1)?.session_id??null
}

export function PrivateMentoringSessionManagement({focusSessionId,focusEnrollmentId}:{focusSessionId?:string|null;focusEnrollmentId?:string|null}={}){
  const supabase=useMemo(()=>createClient(),[])
  const rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
  const dialogRef=useRef<HTMLDialogElement>(null)
  const cancelDialogRef=useRef<HTMLDialogElement>(null)
  const completeDialogRef=useRef<HTMLDialogElement>(null)
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
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  const[message,setMessage]=useState('')
  const[warning,setWarning]=useState('')
  const[selected,setSelected]=useState<EnrollmentRow|null>(null)
  const[sessions,setSessions]=useState<SessionRow[]>([])
  const[activeSessionId,setActiveSessionId]=useState<string|null>(null)
  const[meetingState,setMeetingState]=useState<AdminMeetingState|null>(null)
  const[preferenceEditRequest,setPreferenceEditRequest]=useState(0)
  const[eligibleMentors,setEligibleMentors]=useState<EligibleMentor[]>([])
  const[primaryMentorId,setPrimaryMentorId]=useState('')
  const[mentorReason,setMentorReason]=useState('')
  const[editingPrimaryMentor,setEditingPrimaryMentor]=useState(false)
  const[scheduleId,setScheduleId]=useState<string|null>(null)
  const[cancelTarget,setCancelTarget]=useState<SessionRow|null>(null)
  const[completeTarget,setCompleteTarget]=useState<SessionRow|null>(null)
  const[busyId,setBusyId]=useState<string|null>(null)

  const loadCatalog=useCallback(async()=>{
    const[p,t]=await Promise.all([
      supabase.from('private_mentoring_packages').select('*').order('sort_order').order('id'),
      supabase.from('mentor_tiers').select('*').eq('is_active',true).order('sort_order').order('name'),
    ])
    if(p.error||t.error){setError('Catalog Private Mentoring belum dapat dimuat.');return}
    setPackages(p.data??[])
    setTiers(t.data??[])
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
    setTotal(Number(next[0]?.total_count??0))
    setLoading(false)
  },[fromDate,packageId,page,pageSize,progress,query,rpc,tierId,toDate])

  const loadSessions=useCallback(async(enrollmentId:string)=>{
    const{data,error:e}=await rpc.rpc<SessionRow[]>('get_admin_private_mentoring_enrollment_sessions',{p_enrollment_id:enrollmentId})
    if(e){setError('Detail sesi belum dapat dimuat.');setSessions([]);setActiveSessionId(null);return}
    const next=[...(data??[])].sort((a,b)=>a.session_number-b.session_number)
    setSessions(next)
    setPrimaryMentorId(next[0]?.primary_mentor_id??'')
    setEditingPrimaryMentor(false)
    setActiveSessionId(current=>{
      if(focusSessionId&&next.some(session=>session.session_id===focusSessionId))return focusSessionId
      if(current&&next.some(session=>session.session_id===current))return current
      return selectInitialSession(next)
    })
  },[focusSessionId,rpc])

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
  useEffect(()=>{const dialog=completeDialogRef.current;if(!dialog)return;if(completeTarget&&!dialog.open)dialog.showModal();if(!completeTarget&&dialog.open)dialog.close()},[completeTarget])
  useEffect(()=>{setMeetingState(null)},[activeSessionId])
  useEffect(()=>{
    if(!activeSessionId)return
    const frame=requestAnimationFrame(()=>{
      document.getElementById('mentoring-session-tab-'+activeSessionId)?.scrollIntoView({block:'nearest',inline:'nearest'})
    })
    return()=>cancelAnimationFrame(frame)
  },[activeSessionId])

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
    setSelected(row);setSessions([]);setActiveSessionId(null);setMessage('');setWarning('');setError('');setMentorReason('')
    void Promise.all([loadSessions(row.enrollment_id),loadEligibleMentors(row.enrollment_id,row.purchased_sessions)])
  },[focusTarget,loadEligibleMentors,loadSessions,loading,rows])

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

  async function open(row:EnrollmentRow){
    setSelected(row);setSessions([]);setActiveSessionId(null);setMeetingState(null);setMessage('');setWarning('');setError('');setMentorReason('')
    await Promise.all([loadSessions(row.enrollment_id),loadEligibleMentors(row.enrollment_id,row.purchased_sessions)])
  }

  async function refresh(){
    if(selected)await Promise.all([loadSessions(selected.enrollment_id),loadEligibleMentors(selected.enrollment_id,selected.purchased_sessions)])
    await load()
  }

  useOperationalInvalidation(['mentoring','provider'],()=>{void refresh()})

  async function setPrimaryMentor(){
    if(!selected||selected.purchased_sessions<5||!primaryMentorId)return
    const current=sessions[0]?.primary_mentor_id??null
    if(current&&current!==primaryMentorId&&!mentorReason.trim()){setError('Alasan wajib diisi saat mengganti mentor utama.');return}
    setBusyId('mentor:'+selected.enrollment_id);setError('')
    const{error:e}=await rpc.rpc('admin_set_private_mentoring_primary_mentor',{p_enrollment_id:selected.enrollment_id,p_mentor_id:primaryMentorId,p_reason:mentorReason.trim()||null})
    if(e)setError('Mentor utama belum dapat disimpan. Coba lagi.')
    else{
      setMessage(current?'Mentor utama berhasil diganti dan riwayat perubahan disimpan.':'Mentor utama berhasil ditetapkan untuk enrollment ini.')
      setMentorReason('');setEditingPrimaryMentor(false);await refresh()
    }
    setBusyId(null)
  }

  async function cancelSession(session:SessionRow){
    setBusyId(session.session_id);setError('');setMessage('');setWarning('')
    try{
      const response=await fetch('/api/admin/private-mentoring/sessions/'+session.session_id+'/cancel',{method:'POST'})
      const result=await response.json() as{error?:string;sync?:{status?:string;error?:string}}
      if(!response.ok)throw new Error(result.error||'Sesi belum dapat dibatalkan.')
      setCancelTarget(null)
      if(result.sync?.status==='failed')setWarning(result.sync.error||'Sesi dibatalkan, tetapi Google Calendar belum berhasil disinkronkan.')
      else setMessage('Sesi dibatalkan, Zoom room dilepas, dan Google Calendar diperbarui.')
      await refresh()
    }catch{
      setError('Sesi belum dapat dibatalkan. Coba lagi beberapa saat kemudian.')
    }finally{
      setBusyId(null)
    }
  }

  async function completeSession(session:SessionRow){
    setBusyId(session.session_id);setError('');setMessage('')
    const{error:e}=await rpc.rpc('admin_set_private_mentoring_session_status',{p_session_id:session.session_id,p_status:'completed'})
    if(e)setError('Sesi belum dapat ditandai selesai. Coba lagi.')
    else{
      setCompleteTarget(null)
      setMessage('Sesi ditandai selesai dan progress enrollment diperbarui.')
      await refresh()
    }
    setBusyId(null)
  }

  async function retryCancellation(session:SessionRow){
    setBusyId(session.session_id);setError('');setWarning('')
    try{
      const response=await fetch('/api/admin/private-mentoring/sessions/'+session.session_id+'/sync',{method:'POST'})
      const result=await response.json() as{error?:string;status?:string}
      if(!response.ok)throw new Error(result.error||'Sinkronisasi belum berhasil.')
      if(result.status==='failed')setWarning('Google Calendar masih belum berhasil disinkronkan.')
      else setMessage('Pembatalan Google Calendar sudah disinkronkan.')
      await refresh()
    }catch{
      setError('Sinkronisasi pembatalan belum berhasil. Coba lagi.')
    }finally{
      setBusyId(null)
    }
  }

  const currentPrimary=sessions[0]?.primary_mentor_id??null
  const currentPrimaryName=sessions[0]?.primary_mentor_name??'Belum ditetapkan'
  const selectedSession=sessions.find(session=>session.session_id===activeSessionId)??sessions[0]??null
  const selectedClosed=selectedSession?.status==='completed'||selectedSession?.status==='cancelled'
  const selectedCanSchedule=Boolean(selectedSession&&selectedSession.topic_status==='confirmed'&&(selectedSession.status==='awaiting_scheduling'||selectedSession.status==='scheduled'))
  const selectedCalendarIssue=Boolean(selectedSession&&(selectedSession.google_sync_status==='failed'||meetingState?.calendarSyncStatus==='failed'))

  const handleMeetingState=useCallback((next:AdminMeetingState|null)=>{
    if(!next||next.sessionId===activeSessionId)setMeetingState(next)
  },[activeSessionId])

  return <div className="ops-page mentoring-enrollment-page">
    <div className="role-page-title"><p className="kicker">Operasional · Private Mentoring</p><h2>Mentoring Sessions</h2><p>Kelola enrollment, review preferensi sesi, mentor, jadwal, Zoom, dan Calendar dari satu workspace operasional.</p></div>

    <div className="ops-filter-bar mentoring-enrollment-filters">
      <label className="ops-field ops-field--wide"><span>Cari user / Session ID</span><div className="ops-input-with-icon"><Search size={15} aria-hidden="true"/><input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(0)}} placeholder="Nama, email, paket, atau full Session ID"/></div></label>
      <label className="ops-field"><span>Paket</span><select value={packageId} onChange={event=>{setPackageId(event.target.value);setPage(0)}}><option value="">Semua paket</option>{packages.map(pkg=><option value={pkg.id} key={pkg.id}>{packageLabel(pkg,tiers)}</option>)}</select></label>
      <label className="ops-field"><span>Tier</span><select value={tierId} onChange={event=>{setTierId(event.target.value);setPage(0)}}><option value="">Semua tier</option>{tiers.map(tier=><option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
      <label className="ops-field"><span>Progress</span><select value={progress} onChange={event=>{setProgress(event.target.value);setPage(0)}}><option value="all">Semua</option><option value="needs_focus">Menunggu review admin</option><option value="needs_scheduling">Perlu dijadwalkan</option><option value="configured">Semua sesi sudah diatur</option><option value="in_progress">Berjalan</option><option value="completed">Selesai</option></select></label>
      <label className="ops-field"><span>Dari tanggal beli</span><input type="date" value={fromDate} onChange={event=>{setFromDate(event.target.value);setPage(0)}}/></label>
      <label className="ops-field"><span>Sampai</span><input type="date" value={toDate} onChange={event=>{setToDate(event.target.value);setPage(0)}}/></label>
      <button className="button button-outline ops-reset-action" type="button" onClick={resetFilters}><RotateCcw aria-hidden="true"/>Reset</button>
    </div>

    {error&&!selected?<p className="form-error" role="alert">{error}</p>:null}
    <section className="role-card ops-table-section">
      <div className="ops-section-heading"><div><p className="kicker">Pesanan mentoring</p><h3>{total} paket</h3><p>Satu row mewakili satu enrollment. Search Session ID menemukan parent enrollment yang tepat.</p></div></div>
      <div className="ops-table-wrap"><table className="ops-table mentoring-enrollment-table"><thead><tr><SortableTableHeader label="User / Username" sortKey="user" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Email" sortKey="email" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Paket" sortKey="package" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Tanggal beli" sortKey="purchased_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Progress" sortKey="progress" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><th>Aksi</th></tr></thead><tbody>{visibleRows.map(row=><tr key={row.enrollment_id}>
        <td data-label="User"><strong>{row.mentee_name}</strong><small className="ops-table-secondary">@{row.mentee_username||'username-belum-diatur'}</small></td>
        <td data-label="Email">{row.mentee_email}</td>
        <td data-label="Paket" title={row.package_name}><strong>{compactPackageName(row)}</strong><small className="ops-table-secondary">{compactPackageMeta(row)}</small></td>
        <td data-label="Tanggal beli">{DATE.format(new Date(row.purchased_at))}</td>
        <td data-label="Progress"><strong>{row.configured_sessions}/{row.purchased_sessions} diatur</strong><small className="ops-table-secondary">{row.completed_sessions} selesai</small></td>
        <td data-label="Status"><span className={'ops-status '+enrollmentStatusClass(row)}>{enrollmentStatus(row)}</span></td>
        <td data-label="Aksi"><button className="icon-button mentoring-manage-session-button" type="button" onClick={()=>void open(row)} title="Kelola sesi" aria-label={'Kelola sesi '+row.mentee_name}><Eye aria-hidden="true"/></button></td>
      </tr>)}</tbody></table>{!loading&&visibleRows.length===0?<p className="calendar-empty">Tidak ada enrollment yang cocok.</p>:null}{loading?<p className="calendar-loading">Memuat…</p>:null}</div>
      <TablePagination page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} disabled={loading} label="Pagination enrollment Private Mentoring"/>
    </section>

    <dialog ref={dialogRef} className="calendar-dialog mentoring-session-workspace-dialog" onCancel={event=>{event.preventDefault();setSelected(null)}} onClose={()=>setSelected(null)} aria-labelledby="mentoring-enrollment-dialog-title">
      {selected?<div className="mentoring-workspace-shell">
        <header className="calendar-dialog__head mentoring-workspace-modal-head"><div><p className="kicker">Kelola enrollment</p><h3 id="mentoring-enrollment-dialog-title">{selected.mentee_name}</h3><p>{selected.mentee_email} · Private Mentoring</p></div><button type="button" className="icon-button dialog-close-button" onClick={()=>setSelected(null)} aria-label="Tutup detail enrollment"><X aria-hidden="true"/></button></header>

        <section className="mentoring-enrollment-summary-panel" aria-label="Ringkasan enrollment">
          <div className="mentoring-enrollment-summary-grid">
            <div><span>Paket</span><strong>{compactPackageName(selected)}</strong><small>{compactPackageMeta(selected)}</small></div>
            <div><span>Progress</span><strong>{selected.configured_sessions}/{selected.purchased_sessions} sesi diatur</strong><small>{selected.completed_sessions} selesai</small></div>
            {selected.purchased_sessions>=5?<div className="mentoring-summary-dedicated-mentor"><span>Dedicated Mentor</span><div className="mentoring-summary-inline-value"><strong>{currentPrimaryName}</strong>{!editingPrimaryMentor?<button className="mentoring-summary-icon-action" type="button" onClick={()=>setEditingPrimaryMentor(true)} aria-label={currentPrimary?'Ganti mentor':'Tetapkan mentor'} title={currentPrimary?'Ganti mentor':'Tetapkan mentor'}><Pencil aria-hidden="true"/></button>:null}</div></div>:null}
            <MentoringCompetitionEditor kind="private" parentId={selected.enrollment_id} compact summary/>
          </div>
          {selected.purchased_sessions>=5&&editingPrimaryMentor?<div className="mentoring-summary-mentor-editor">
            <label className="ops-field"><span>{currentPrimary?'Ganti mentor':'Set mentor utama'}</span><select value={primaryMentorId} onChange={event=>setPrimaryMentorId(event.target.value)}><option value="">Pilih mentor sesuai tier</option>{eligibleMentors.map(mentor=><option key={mentor.mentor_id} value={mentor.mentor_id}>{mentor.mentor_name}</option>)}</select></label>
            {currentPrimary&&primaryMentorId&&primaryMentorId!==currentPrimary?<label className="ops-field"><span>Alasan perubahan (wajib)</span><textarea rows={2} value={mentorReason} onChange={event=>setMentorReason(event.target.value)} placeholder="Alasan operasional perubahan mentor"/></label>:null}
            <div className="button-row"><button className="button button-primary" type="button" disabled={!primaryMentorId||busyId==='mentor:'+selected.enrollment_id} onClick={()=>void setPrimaryMentor()}>{currentPrimary?'Simpan pergantian mentor':'Simpan mentor utama'}</button><button className="button button-outline" type="button" onClick={()=>{setEditingPrimaryMentor(false);setPrimaryMentorId(currentPrimary??'');setMentorReason('')}}>Batal</button></div>
          </div>:null}
        </section>

        <div className="mentoring-workspace-main">
          <aside className="mentoring-session-navigator" aria-label="Navigasi sesi">
            <div className="mentoring-session-navigator__head"><strong>Sesi</strong><span>{sessions.length}</span></div>
            <div className="mentoring-session-navigator__list" role="tablist" aria-orientation="vertical">{sessions.map(session=>{
              const calendarIssue=session.google_sync_status==='failed'
              const muted=session.status==='completed'||session.status==='cancelled'
              return <button key={session.session_id} id={'mentoring-session-tab-'+session.session_id} aria-controls="mentoring-selected-session-panel" type="button" role="tab" aria-selected={session.session_id===selectedSession?.session_id} className={'mentoring-session-nav-item'+(session.session_id===selectedSession?.session_id?' is-active':'')+(muted?' is-muted':'')+(session.status==='cancelled'?' is-cancelled':'')} onClick={()=>setActiveSessionId(session.session_id)}>
                <span className="mentoring-session-nav-item__title"><strong>Sesi {session.session_number}</strong>{calendarIssue?<AlertTriangle aria-label="Calendar perlu perhatian"/>:null}</span>
                <span className="mentoring-session-nav-item__badges"><span className={'ops-status '+topicStatusClass(session.topic_status)}>{topicStatus(session.topic_status)}</span><span className={'ops-status '+sessionStatusClass(session.status)}>{sessionStatus(session.status)}</span></span>
                <small>{session.scheduled_start_at?SHORT_DATE_TIME.format(new Date(session.scheduled_start_at)):sessionHeadline(session)}</small>
              </button>
            })}</div>
          </aside>

          <label className="mentoring-session-mobile-select"><span>Pilih sesi</span><select value={selectedSession?.session_id??''} onChange={event=>setActiveSessionId(event.target.value)} aria-label="Pilih sesi">{sessions.map(session=><option key={session.session_id} value={session.session_id}>Sesi {session.session_number} · {topicStatus(session.topic_status)} · {sessionStatus(session.status)}</option>)}</select></label>

          <section id="mentoring-selected-session-panel" role="tabpanel" aria-labelledby={selectedSession?'mentoring-session-tab-'+selectedSession.session_id:undefined} className={'mentoring-selected-session-workspace'+(selectedSession?.status==='completed'?' is-completed':'')+(selectedSession?.status==='cancelled'?' is-cancelled':'')} aria-label="Workspace sesi terpilih">
            {selectedSession?<div className="mentoring-selected-session-inner">
              <div className="mentoring-selected-session-sticky">
                <div className="mentoring-selected-session-header">
                  <div className="mentoring-selected-session-header__copy"><p className="kicker">Sesi {selectedSession.session_number} / {selectedSession.purchased_sessions}</p><h3>{sessionHeadline(selectedSession)}</h3><p>{selectedSession.mentor_name||selectedSession.primary_mentor_name||'Mentor belum ditetapkan'} · {selectedSession.scheduled_start_at?DATE_TIME.format(new Date(selectedSession.scheduled_start_at)):'Belum terjadwal'}</p></div>
                  <div className="mentoring-selected-session-header__badges"><span className={'ops-status '+topicStatusClass(selectedSession.topic_status)}>{topicStatus(selectedSession.topic_status)}</span><span className={'ops-status '+sessionStatusClass(selectedSession.status)}>{sessionStatus(selectedSession.status)}</span>{meetingState?.manualMeetingUrl?<span className="ops-status mentoring-manual-override-badge"><Pencil aria-hidden="true"/>Manual override</span>:null}</div>
                </div>
                <div className="mentoring-selected-session-meta">
                  {meetingState?.assignedZoomRoomName?<span className="mentoring-session-meta-chip">{meetingState.assignedZoomRoomName}</span>:null}
                  {selectedCalendarIssue?<span className="mentoring-session-meta-chip is-warning"><AlertTriangle aria-hidden="true"/>Calendar perlu perhatian</span>:null}
                  <div className="mentoring-session-id-meta"><span>Session ID</span><code title={selectedSession.session_id}>{selectedSession.session_id}</code><CopyTextButton value={selectedSession.session_id} label="Salin ID" copiedLabel="ID disalin"/></div>
                </div>
                <div className="mentoring-session-action-bar">
                  <div className="mentoring-session-action-bar__primary">
                    {!selectedClosed?<button className="button button-outline" type="button" onClick={()=>setPreferenceEditRequest(value=>value+1)}><Pencil aria-hidden="true"/>{preferenceActionLabel(selectedSession.topic_status)}</button>:null}
                    {selectedCanSchedule?<button className={selectedSession.status==='scheduled'?'button button-outline':'button button-primary'} type="button" onClick={()=>setScheduleId(selectedSession.session_id)}><CalendarDays aria-hidden="true"/>{selectedSession.status==='scheduled'?'Ubah jadwal':'Jadwalkan sesi'}</button>:null}
                    {selectedSession.status==='scheduled'?<button className="button button-primary mentoring-complete-trigger" type="button" onClick={()=>setCompleteTarget(selectedSession)}><CheckCircle2 aria-hidden="true"/>Tandai selesai</button>:null}
                    {selectedSession.status==='cancelled'&&selectedSession.google_sync_status==='failed'?<button className="button button-outline" type="button" disabled={busyId===selectedSession.session_id} onClick={()=>void retryCancellation(selectedSession)}><RefreshCw aria-hidden="true"/>Sinkronkan pembatalan</button>:null}
                  </div>
                  {selectedSession.status==='scheduled'?<button className="button button-outline mentoring-session-cancel-trigger" type="button" disabled={busyId===selectedSession.session_id} onClick={()=>setCancelTarget(selectedSession)}><X aria-hidden="true"/>Batalkan sesi</button>:null}
                </div>
              </div>

              <div className="mentoring-selected-session-scroll">
                <MentoringSessionPreferences key={selectedSession.session_id} kind="private" sessionId={selectedSession.session_id} role="admin" title="Preferensi Sesi" showCompetitionContext={false} showReviewStatus={false} auditMode="request-only" hideEditButton editRequestKey={preferenceEditRequest} onChanged={refresh}/>

                <AdminSessionOperations key={'operations-'+selectedSession.session_id} sessionId={selectedSession.session_id} status={selectedSession.status} menteeName={selected.mentee_name} sessionNumber={selectedSession.session_number} mentorName={selectedSession.mentor_name||selectedSession.primary_mentor_name} scheduledStartAt={selectedSession.scheduled_start_at} onChanged={refresh} showSessionReference={false} showCompletionActions={false} showContextSummary={false} onStateChange={handleMeetingState}/>

                {error?<p className="form-error mentoring-workspace-feedback" role="alert">{error}</p>:null}
                {warning?<p className="calendar-warning mentoring-workspace-feedback" role="status">{warning}</p>:null}
                {message?<p className="form-success mentoring-workspace-feedback" role="status">{message}</p>:null}
              </div>
            </div>:<div className="calendar-empty">Belum ada sesi pada enrollment ini.</div>}
          </section>
        </div>
      </div>:null}
    </dialog>

    <dialog ref={completeDialogRef} className="calendar-dialog compact-confirm-dialog mentoring-complete-dialog" onCancel={event=>{event.preventDefault();setCompleteTarget(null)}} onClose={()=>setCompleteTarget(null)} aria-labelledby="complete-private-session-title">
      {completeTarget?<><div className="compact-confirm-dialog__header"><p className="kicker">Konfirmasi selesai</p><h3 id="complete-private-session-title">Tandai sesi {completeTarget.session_number} selesai?</h3></div><div className="compact-confirm-dialog__body"><p>Progress enrollment akan dihitung ulang dan sesi masuk ke riwayat selesai.</p><div className="button-row compact-confirm-dialog__actions"><button className="button button-outline" type="button" onClick={()=>setCompleteTarget(null)}>Kembali</button><button className="button button-primary" type="button" disabled={busyId===completeTarget.session_id} onClick={()=>void completeSession(completeTarget)}>Ya, tandai selesai</button></div></div></>:null}
    </dialog>

    <dialog ref={cancelDialogRef} className="calendar-dialog mentoring-cancel-dialog compact-confirm-dialog" onCancel={event=>{event.preventDefault();setCancelTarget(null)}} onClose={()=>setCancelTarget(null)} aria-labelledby="cancel-private-session-title">
      {cancelTarget?<><div className="calendar-dialog__head"><div><p className="kicker">Konfirmasi pembatalan</p><h3 id="cancel-private-session-title">Batalkan sesi {cancelTarget.session_number}?</h3></div><button type="button" className="icon-button dialog-close-button" onClick={()=>setCancelTarget(null)} aria-label="Tutup konfirmasi"><X aria-hidden="true"/></button></div><div className="compact-confirm-dialog__body"><p>Pembatalan akan menjalankan lifecycle berikut:</p><ul className="cancellation-consequences"><li>Sesi dibatalkan di Strativate.</li><li>Reservasi Zoom room dilepas.</li><li>Undangan Google Calendar terkait dibatalkan atau diperbarui.</li><li>Participant tidak dapat menggunakan sesi yang sudah dibatalkan.</li></ul><div className="button-row compact-confirm-dialog__actions"><button className="button button-outline" type="button" onClick={()=>setCancelTarget(null)}>Kembali</button><button className="button mentoring-session-cancel-confirm" type="button" disabled={busyId===cancelTarget.session_id} onClick={()=>void cancelSession(cancelTarget)}>Ya, batalkan sesi</button></div></div></>:null}
    </dialog>

    <AdminScheduleDialog sessionId={scheduleId} onClose={()=>setScheduleId(null)} onScheduled={()=>{setScheduleId(null);void refresh()}}/>
  </div>
}
