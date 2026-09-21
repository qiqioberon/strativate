'use client'

import { CheckCircle2, ExternalLink, Pencil, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CopyTextButton } from '@/components/dashboard/copy-text-button'
import { humanizeProviderError, humanizeSyncStatus } from '@/lib/operations/provider-errors'
import { createClient } from '@/lib/supabase/client'

type Competition={enrollment_id:string;competition_category_id:string|null;competition_category_name:string|null;competition_name:string|null;competition_updated_at:string|null}
type Category={id:string;name:string}
type MeetingState={
  sessionId:string
  status:string
  meetingProvider:string|null
  providerMeetingId:string|null
  providerMeetingUrl:string|null
  manualMeetingUrl:string|null
  effectiveMeetingUrl:string|null
  providerSyncStatus:string
  providerSyncError:string|null
  calendarSyncStatus:string
  calendarSyncError:string|null
  recordingStatus:string
  recordingError:string|null
}
type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}

function providerLabel(state:MeetingState){
  if(state.status==='completed'||state.status==='cancelled')return'Tidak aktif'
  return state.meetingProvider==='zoom'?'Zoom':'Zoom · menunggu sinkronisasi'
}
function recordingLabel(state:MeetingState){
  if(state.recordingStatus==='expected')return'Recording otomatis diminta'
  if(state.recordingStatus==='processing')return'Recording sedang diproses'
  if(state.recordingStatus==='available')return'Recording tersedia'
  if(state.recordingStatus==='unavailable')return'Recording tidak tersedia'
  if(state.recordingStatus==='failed')return'Recording gagal'
  if(state.recordingStatus==='not_applicable')return'Tidak berlaku'
  return humanizeSyncStatus(state.recordingStatus)
}
function effectiveMeetingLabel(state:MeetingState){
  if(!state.effectiveMeetingUrl)return'Belum tersedia'
  return state.manualMeetingUrl?'Manual override':'Zoom'
}

export function AdminCompetitionEditor({enrollmentId}:{enrollmentId:string}){
  const supabase=useMemo(()=>createClient(),[])
  const rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
  const[categories,setCategories]=useState<Category[]>([])
  const[categoryId,setCategoryId]=useState('')
  const[name,setName]=useState('')
  const[saved,setSaved]=useState<Competition|null>(null)
  const[editing,setEditing]=useState(false)
  const[busy,setBusy]=useState(false)
  const[message,setMessage]=useState('')

  const load=useCallback(async()=>{
    const [competition,catalog]=await Promise.all([
      rpc.rpc<Competition[]>('get_admin_private_mentoring_competition',{p_enrollment_id:enrollmentId}),
      supabase.from('competition_categories').select('id,name').eq('is_active',true).order('sort_order'),
    ])
    const row=competition.data?.[0]??null
    setSaved(row)
    setCategoryId(row?.competition_category_id??'')
    setName(row?.competition_name??'')
    setCategories((catalog.data??[]) as Category[])
    setEditing(!row?.competition_name)
  },[enrollmentId,rpc,supabase])

  useEffect(()=>{void load()},[load])

  function cancel(){
    setCategoryId(saved?.competition_category_id??'')
    setName(saved?.competition_name??'')
    setMessage('')
    setEditing(!saved?.competition_name)
  }

  async function save(){
    if(name.trim().length<2){setMessage('Competition / bidang lomba wajib diisi minimal 2 karakter.');return}
    setBusy(true);setMessage('')
    const result=await rpc.rpc('admin_set_private_mentoring_competition',{p_enrollment_id:enrollmentId,p_competition_category_id:categoryId||null,p_competition_name:name.trim()})
    setBusy(false)
    if(result.error){setMessage('Competition belum dapat disimpan. Periksa input lalu coba lagi.');return}
    await load()
    setEditing(false)
    setMessage('Competition / bidang lomba tersimpan.')
  }

  return <section className="schedule-day admin-editable-section" data-testid="admin-competition-section">
    <div className="admin-editable-section__head">
      <div><p className="kicker">Competition / bidang lomba</p><h4>{saved?.competition_name||'Belum dilengkapi'}</h4><p>Enrollment-wide dan terpisah dari topic/scope setiap sesi.</p></div>
      {!editing&&saved?.competition_name?<button className="button button-outline button-compact" type="button" onClick={()=>setEditing(true)}><Pencil aria-hidden="true"/>Edit</button>:null}
    </div>
    {!editing&&saved?.competition_name?<div className="admin-readonly-grid"><div><span>Nama lomba</span><strong>{saved.competition_name}</strong></div><div><span>Kategori</span><strong>{saved.competition_category_name||'Tanpa kategori'}</strong></div></div>:null}
    {editing?<div className="ops-form-stack admin-edit-form">
      <label className="ops-field"><span>Kategori (opsional)</span><select value={categoryId} onChange={event=>setCategoryId(event.target.value)}><option value="">Tanpa kategori</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="ops-field"><span>Nama lomba / bidang lomba</span><input value={name} maxLength={300} onChange={event=>setName(event.target.value)} placeholder="Contoh: Business Case Competition"/></label>
      <div className="button-row"><button className="button competition-save-button" type="button" disabled={busy} onClick={()=>void save()}><Save aria-hidden="true"/>{busy?'Menyimpan…':'Simpan lomba'}</button>{saved?.competition_name?<button className="button button-outline" type="button" disabled={busy} onClick={cancel}>Batal</button>:null}</div>
    </div>:null}
    {message?<p className="muted" role="status">{message}</p>:null}
  </section>
}

export function AdminSessionOperations({
  sessionId,status,menteeName,sessionNumber,mentorName,scheduledStartAt,onChanged,mentoringKind='private',showSessionReference=true,
}:{
  sessionId:string
  status:string
  menteeName:string
  sessionNumber:number
  mentorName:string|null
  scheduledStartAt:string|null
  onChanged:()=>void|Promise<void>
  mentoringKind?:'private'|'intensive'
  showSessionReference?:boolean
}){
  const supabase=useMemo(()=>createClient(),[])
  const rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
  const[state,setState]=useState<MeetingState|null>(null)
  const[manualUrl,setManualUrl]=useState('')
  const[editingOverride,setEditingOverride]=useState(false)
  const[busy,setBusy]=useState('')
  const[message,setMessage]=useState('')
  const confirmRef=useRef<HTMLDialogElement>(null)

  const load=useCallback(async()=>{
    try{
      const response=await fetch(`/api/admin/${mentoringKind}-mentoring/sessions/${sessionId}/meeting`,{cache:'no-store'})
      const body=await response.json() as MeetingState&{error?:string}
      if(response.ok){setState(body);setManualUrl(body.manualMeetingUrl??'');return}
      setMessage(body.error||'Status meeting belum dapat dimuat.')
    }catch{
      setMessage('Status meeting belum dapat dimuat.')
    }
  },[mentoringKind,sessionId])
  useEffect(()=>{void load()},[load])

  async function saveOverride(){
    const trimmed=manualUrl.trim()
    if(!/^https:\/\//i.test(trimmed)){setMessage('Gunakan URL meeting HTTPS yang valid.');return}
    setBusy('meeting');setMessage('')
    const response=await fetch(`/api/admin/${mentoringKind}-mentoring/sessions/${sessionId}/meeting`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({url:trimmed})})
    const body=await response.json() as MeetingState&{error?:string}
    setBusy('')
    if(!response.ok){setMessage(body.error||'Meeting override belum dapat disimpan.');return}
    setState(body);setManualUrl(body.manualMeetingUrl??'');setEditingOverride(false);setMessage('Manual override aktif dan Calendar telah direconcile menggunakan link efektif.')
    await onChanged()
  }

  async function restoreZoom(){
    setBusy('restore');setMessage('')
    const response=await fetch(`/api/admin/${mentoringKind}-mentoring/sessions/${sessionId}/meeting`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({url:null})})
    const body=await response.json() as MeetingState&{error?:string}
    setBusy('')
    if(!response.ok){setMessage(body.error||'Link Zoom belum dapat dipulihkan.');return}
    setState(body);setManualUrl('');setEditingOverride(false);setMessage('Manual override dihapus. Link efektif kembali menggunakan Zoom dan Calendar sudah direconcile.')
    await onChanged()
  }

  async function retrySync(){
    setBusy('sync');setMessage('')
    const response=await fetch(`/api/admin/${mentoringKind}-mentoring/sessions/${sessionId}/sync`,{method:'POST'})
    const body=await response.json() as{error?:string;status?:string}
    setBusy('')
    if(!response.ok&&response.status!==202){setMessage(body.error||'Zoom dan Calendar belum berhasil disinkronkan.');return}
    setMessage(body.status==='provider_pending'?'Zoom sedang diproses. Manual override, bila aktif, tetap dipertahankan sebagai link efektif.':'Zoom dan Google Calendar sudah direconcile tanpa mengubah manual override.')
    await load();await onChanged()
  }

  async function setStatus(next:'completed'|'scheduled'){
    setBusy(next);setMessage('')
    const result=await rpc.rpc(mentoringKind==='private'?'admin_set_private_mentoring_session_status':'admin_set_intensive_session_status',{p_session_id:sessionId,p_status:next})
    setBusy('')
    if(result.error){setMessage('Status sesi belum dapat diperbarui. Coba lagi.');return}
    if(confirmRef.current?.open)confirmRef.current.close()
    setMessage(next==='completed'?'Sesi ditandai selesai.':mentoringKind==='private'?'Tanda selesai dibatalkan dan enrollment dihitung ulang.':'Tanda selesai dibatalkan; engagement tetap aktif.')
    await onChanged()
  }

  const zoomError=state?.providerSyncError?humanizeProviderError('zoom',state.providerSyncError):null
  const calendarError=state?.calendarSyncError?humanizeProviderError('calendar',state.calendarSyncError):null
  const recordingError=state?.recordingError?humanizeProviderError('recording',state.recordingError):null

  return <section className="meeting-override admin-session-operations" data-testid="admin-session-operations">
    <div className="ops-section-heading"><div><p className="kicker">Operasi sesi</p><h4>Meeting, recording & completion</h4><p>{menteeName} · Sesi {sessionNumber}{mentorName?' · '+mentorName:''}{scheduledStartAt?' · '+new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(scheduledStartAt)):''}</p></div></div>

    {showSessionReference?<div className="session-reference-row"><div><span>Session ID</span><strong>{sessionId}</strong></div><CopyTextButton value={sessionId} label="Salin Session ID" copiedLabel="ID disalin"/></div>:null}

    {state?<div className="provider-status-grid">
      <div><span>Meeting provider</span><strong>{providerLabel(state)}</strong></div>
      <div><span>Zoom meeting ID</span><strong>{state.providerMeetingId??'Belum tersedia'}</strong></div>
      <div><span>Zoom sync</span><strong>{humanizeSyncStatus(state.providerSyncStatus)}</strong>{zoomError?<small role="status">{zoomError}</small>:null}</div>
      <div><span>Calendar sync</span><strong>{humanizeSyncStatus(state.calendarSyncStatus)}</strong>{calendarError?<small role="status">{calendarError}</small>:null}</div>
      <div><span>Recording</span><strong>{recordingLabel(state)}</strong>{recordingError?<small role="status">{recordingError}</small>:null}</div>
      <div><span>Session status</span><strong>{status==='scheduled'?'Terjadwal':status==='completed'?'Selesai':status==='cancelled'?'Dibatalkan':status.replaceAll('_',' ')}</strong></div>
    </div>:<p className="muted">Memuat status meeting…</p>}

    {state?.effectiveMeetingUrl?<div className="effective-meeting-row"><div><span>Meeting link efektif</span><strong>{effectiveMeetingLabel(state)}</strong></div><div className="table-action-group"><a className="button button-primary button-compact" href={state.effectiveMeetingUrl} target="_blank" rel="noopener noreferrer">Buka Zoom <ExternalLink aria-hidden="true"/></a><CopyTextButton value={state.effectiveMeetingUrl} label="Salin link meeting" copiedLabel="Link disalin"/></div></div>:null}

    {status==='scheduled'?<div className="provider-action-stack">
      <div className="button-row">
        {!editingOverride?<button className="button button-outline" type="button" onClick={()=>{setManualUrl(state?.manualMeetingUrl??'');setEditingOverride(true)}}><Pencil aria-hidden="true"/>Override link meeting</button>:null}
        {state?.manualMeetingUrl?<button className="button button-outline" type="button" disabled={busy==='restore'} onClick={()=>void restoreZoom()}><RotateCcw aria-hidden="true"/>Kembalikan ke Zoom</button>:null}
        <button className="button button-outline" type="button" disabled={busy==='sync'} onClick={()=>void retrySync()}><RefreshCw aria-hidden="true"/>Sinkronkan ulang Zoom + Kalender</button>
      </div>
      {editingOverride?<div className="override-editor"><label className="ops-field"><span>Manual meeting URL</span><input type="url" value={manualUrl} onChange={event=>setManualUrl(event.target.value)} placeholder="https://…"/></label><p className="muted">Override hanya mengganti link efektif dan Calendar event. Canonical Zoom meeting tidak dihapus.</p><div className="button-row"><button className="button button-primary" type="button" disabled={busy==='meeting'} onClick={()=>void saveOverride()}><Save aria-hidden="true"/>Simpan Override</button><button className="button button-outline" type="button" disabled={busy==='meeting'} onClick={()=>{setEditingOverride(false);setManualUrl(state?.manualMeetingUrl??'')}}>Batal</button></div></div>:null}
      {state?.manualMeetingUrl?<p className="calendar-warning" role="status">Manual override sedang aktif. Retry sync akan mempertahankan override sebagai meeting link efektif.</p>:null}
    </div>:null}

    <div className="completion-actions">
      <span>Completion</span>
      {status==='scheduled'?<button className="button button-primary" type="button" onClick={()=>confirmRef.current?.showModal()}><CheckCircle2 aria-hidden="true"/>Tandai selesai</button>:null}
      {status==='completed'?<button className="button button-outline" type="button" disabled={busy==='scheduled'} onClick={()=>void setStatus('scheduled')}><RotateCcw aria-hidden="true"/>Batalkan tanda selesai</button>:null}
    </div>

    {message?<p className="muted" role="status">{message}</p>:null}
    <dialog ref={confirmRef} className="calendar-dialog compact-confirm-dialog" aria-labelledby="complete-session-title">
      <div className="compact-confirm-dialog__header"><p className="kicker">Konfirmasi selesai</p><h3 id="complete-session-title">Tandai sesi {sessionNumber} selesai?</h3></div>
      <div className="compact-confirm-dialog__body"><p>{mentoringKind==='private'?'Progress enrollment akan dihitung ulang. Jika salah, admin masih dapat membatalkan tanda selesai dan transisi tetap diaudit.':'Status sesi akan dicatat ke audit Intensive Mentoring. Jika salah, admin masih dapat membatalkan tanda selesai sesuai lifecycle yang tersedia.'}</p></div>
      <div className="compact-confirm-dialog__footer"><button className="button button-outline" type="button" onClick={()=>confirmRef.current?.close()}>Batal</button><button className="button button-primary" type="button" disabled={busy==='completed'} onClick={()=>void setStatus('completed')}>Ya, tandai selesai</button></div>
    </dialog>
  </section>
}
