'use client'

import { ExternalLink, Pencil, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CopyTextButton } from '@/components/dashboard/copy-text-button'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { humanizeProviderError, humanizeSyncStatus } from '@/lib/operations/provider-errors'
import { createClient } from '@/lib/supabase/client'

type Competition={enrollment_id:string;competition_category_id:string|null;competition_category_name:string|null;competition_name:string|null;competition_updated_at:string|null}
type Category={id:string;name:string}
export type AdminMeetingState={
  sessionId:string
  status:string
  assignedZoomRoomId:string|null
  assignedZoomRoomName:string|null
  managedMeetingUrl:string|null
  manualMeetingUrl:string|null
  effectiveMeetingUrl:string|null
  calendarSyncStatus:string
  calendarSyncError:string|null
  availableZoomRooms:Array<{id:string;name:string;meetingUrl:string}>
}
type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}

function effectiveMeetingLabel(state:AdminMeetingState){
  if(!state.effectiveMeetingUrl)return'Belum tersedia'
  return state.manualMeetingUrl?'Link manual':'Zoom terkelola'
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
  sessionId,
  status,
  menteeName,
  sessionNumber,
  mentorName,
  scheduledStartAt,
  onChanged,
  mentoringKind='private',
  showSessionReference=true,
  showCompletionActions=true,
  showContextSummary=true,
  onStateChange,
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
  showCompletionActions?:boolean
  showContextSummary?:boolean
  onStateChange?:(state:AdminMeetingState|null)=>void
}){
  const supabase=useMemo(()=>createClient(),[])
  const rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
  const[state,setState]=useState<AdminMeetingState|null>(null)
  const[manualUrl,setManualUrl]=useState('')
  const[zoomRoomId,setZoomRoomId]=useState('')
  const[editingRoom,setEditingRoom]=useState(false)
  const[editingOverride,setEditingOverride]=useState(false)
  const[busy,setBusy]=useState('')
  const[message,setMessage]=useState('')
  const confirmRef=useRef<HTMLDialogElement>(null)

  const publishState=useCallback((next:AdminMeetingState|null)=>{
    setState(next)
    onStateChange?.(next)
  },[onStateChange])

  const load=useCallback(async()=>{
    try{
      const response=await fetch('/api/admin/'+mentoringKind+'-mentoring/sessions/'+sessionId+'/meeting',{cache:'no-store'})
      const body=await response.json() as AdminMeetingState&{error?:string}
      if(response.ok){
        publishState(body)
        setManualUrl(body.manualMeetingUrl??'')
        setZoomRoomId(body.assignedZoomRoomId??'')
        return
      }
      publishState(null)
      setMessage(body.error||'Status meeting belum dapat dimuat.')
    }catch{
      publishState(null)
      setMessage('Status meeting belum dapat dimuat.')
    }
  },[mentoringKind,publishState,sessionId])

  useEffect(()=>{void load()},[load])
  useOperationalInvalidation(['provider','calendar'],()=>void load())

  async function assignRoom(){
    if(!zoomRoomId)return
    setBusy('room');setMessage('')
    try{
      const response=await fetch('/api/admin/'+mentoringKind+'-mentoring/sessions/'+sessionId+'/meeting',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({zoomRoomId})})
      const body=await response.json() as AdminMeetingState&{error?:string}
      if(!response.ok)throw new Error(body.error||'Zoom room belum dapat diganti.')
      publishState(body)
      setEditingRoom(false)
      setMessage(body.calendarSyncStatus==='failed'?'Zoom room diperbarui, tetapi Google Calendar perlu disinkronkan ulang.':'Zoom room dan Google Calendar diperbarui.')
      await onChanged()
    }catch(error){
      setMessage(error instanceof Error?error.message:'Zoom room belum dapat diganti.')
    }finally{
      setBusy('')
    }
  }

  async function saveOverride(){
    const trimmed=manualUrl.trim()
    if(!/^https:\/\//i.test(trimmed)){setMessage('Gunakan URL meeting HTTPS yang valid.');return}
    setBusy('meeting');setMessage('')
    const response=await fetch('/api/admin/'+mentoringKind+'-mentoring/sessions/'+sessionId+'/meeting',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({url:trimmed})})
    const body=await response.json() as AdminMeetingState&{error?:string}
    setBusy('')
    if(!response.ok){setMessage(body.error||'Meeting override belum dapat disimpan.');return}
    publishState(body)
    setManualUrl(body.manualMeetingUrl??'')
    setEditingOverride(false)
    setMessage(body.calendarSyncStatus==='failed'?'Manual override aktif, tetapi Google Calendar perlu disinkronkan ulang.':'Manual override aktif. Calendar menggunakan link efektif; reservasi Zoom room tetap berlaku.')
    await onChanged()
  }

  async function restoreZoom(){
    setBusy('restore');setMessage('')
    const response=await fetch('/api/admin/'+mentoringKind+'-mentoring/sessions/'+sessionId+'/meeting',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({url:null})})
    const body=await response.json() as AdminMeetingState&{error?:string}
    setBusy('')
    if(!response.ok){setMessage(body.error||'Link Zoom belum dapat dipulihkan.');return}
    publishState(body)
    setManualUrl('')
    setEditingOverride(false)
    setMessage(body.calendarSyncStatus==='failed'?'Link Zoom terkelola aktif, tetapi Google Calendar perlu disinkronkan ulang.':'Link efektif kembali menggunakan Zoom room terkelola dan Calendar sudah diperbarui.')
    await onChanged()
  }

  async function retrySync(){
    setBusy('sync');setMessage('')
    const response=await fetch('/api/admin/'+mentoringKind+'-mentoring/sessions/'+sessionId+'/sync',{method:'POST'})
    const body=await response.json() as{error?:string;status?:string}
    setBusy('')
    if(!response.ok&&response.status!==202){setMessage(body.error||'Google Calendar belum berhasil disinkronkan.');return}
    setMessage(body.status==='failed'?'Google Calendar masih perlu perhatian. Coba lagi setelah koneksi diperbaiki.':'Google Calendar sudah diperbarui menggunakan link meeting efektif.')
    await load()
    await onChanged()
  }

  async function setStatus(next:'completed'|'scheduled'){
    setBusy(next);setMessage('')
    const result=await rpc.rpc(mentoringKind==='private'?'admin_set_private_mentoring_session_status':'admin_set_intensive_session_status',{p_session_id:sessionId,p_status:next})
    setBusy('')
    if(result.error){setMessage('Status sesi belum dapat diperbarui. Coba lagi.');return}
    if(confirmRef.current?.open)confirmRef.current.close()
    setMessage(next==='completed'?'Sesi ditandai selesai.':mentoringKind==='private'?'Tanda selesai dibatalkan dan enrollment dihitung ulang.':'Tanda selesai dibatalkan; engagement tetap aktif.')
    await onChanged()
    await load()
  }

  const calendarError=state?.calendarSyncError?humanizeProviderError('calendar',state.calendarSyncError):null
  const isClosed=status==='completed'||status==='cancelled'

  return <section className="meeting-override admin-session-operations" data-testid="admin-session-operations">
    <div className="meeting-calendar-heading"><div><h4>Meeting &amp; Calendar</h4>{showContextSummary?<p>{menteeName} · Sesi {sessionNumber}{mentorName?' · '+mentorName:''}{scheduledStartAt?' · '+new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(scheduledStartAt)):''}</p>:null}</div></div>

    {showSessionReference?<div className="session-reference-row"><div><span>Session ID</span><strong>{sessionId}</strong></div><CopyTextButton value={sessionId} label="Salin Session ID" copiedLabel="ID disalin"/></div>:null}

    {state?<div className="provider-status-grid meeting-calendar-grid">
      <div><span>Zoom Room</span><strong>{state.assignedZoomRoomName??(state.manualMeetingUrl?'Menggunakan link manual':'Belum ditetapkan')}</strong></div>
      <div className={state.calendarSyncStatus==='failed'?'is-warning':state.calendarSyncStatus==='ready'||state.calendarSyncStatus==='synced'?'is-success':''}><span>Calendar</span><strong>{humanizeSyncStatus(state.calendarSyncStatus)}</strong>{calendarError?<small role="status">{calendarError}</small>:null}</div>
      <div><span>Meeting Link</span><strong>{effectiveMeetingLabel(state)}</strong></div>
    </div>:<p className="muted">Memuat status meeting…</p>}

    {state?.effectiveMeetingUrl?<div className="effective-meeting-row">
      <div><span>Meeting link efektif</span><code className="meeting-link-value">{state.effectiveMeetingUrl}</code></div>
      {!isClosed?<div className="table-action-group"><a className="button button-primary button-compact" href={state.effectiveMeetingUrl} target="_blank" rel="noopener noreferrer">Buka Zoom <ExternalLink aria-hidden="true"/></a><CopyTextButton value={state.effectiveMeetingUrl} label="Salin link meeting" copiedLabel="Link disalin"/></div>:null}
    </div>:null}

    {status==='scheduled'?<div className="provider-action-stack">
      <div className="button-row">
        {!editingOverride?<button className="button button-outline" type="button" onClick={()=>{setManualUrl(state?.manualMeetingUrl??'');setEditingOverride(true)}}><Pencil aria-hidden="true"/>Override link meeting</button>:null}
        <button className="button button-outline" type="button" onClick={()=>{setZoomRoomId(state?.assignedZoomRoomId??'');setEditingRoom(value=>!value)}}><Pencil aria-hidden="true"/>Ganti Zoom room</button>
        {state?.manualMeetingUrl&&state.assignedZoomRoomId?<button className="button button-outline" type="button" disabled={busy==='restore'} onClick={()=>void restoreZoom()}><RotateCcw aria-hidden="true"/>Kembali ke link Zoom terkelola</button>:null}
        <button className="button button-outline" type="button" disabled={busy==='sync'} onClick={()=>void retrySync()}><RefreshCw aria-hidden="true"/>Sinkronkan ulang Kalender</button>
      </div>
      {editingRoom?<div className="override-editor"><label className="ops-field"><span>Zoom room tersedia</span><select value={zoomRoomId} onChange={event=>setZoomRoomId(event.target.value)}><option value="">Pilih Zoom room</option>{state?.availableZoomRooms.map(room=><option key={room.id} value={room.id}>{room.name}</option>)}</select></label><p className="muted">Room lain yang sedang dipakai pada jam sesi ini tidak ditampilkan.</p><div className="button-row"><button className="button button-primary" type="button" disabled={!zoomRoomId||busy==='room'} onClick={()=>void assignRoom()}><Save aria-hidden="true"/>Simpan Zoom room</button><button className="button button-outline" type="button" onClick={()=>setEditingRoom(false)}>Batal</button></div></div>:null}
      {editingOverride?<div className="override-editor"><label className="ops-field"><span>Manual meeting URL</span><input type="url" value={manualUrl} onChange={event=>setManualUrl(event.target.value)} placeholder="https://…"/></label><p className="muted">Override mengubah link efektif di Calendar. Zoom room tetap terreservasi untuk sesi ini.</p><div className="button-row"><button className="button button-primary" type="button" disabled={busy==='meeting'} onClick={()=>void saveOverride()}><Save aria-hidden="true"/>Simpan Override</button><button className="button button-outline" type="button" disabled={busy==='meeting'} onClick={()=>{setEditingOverride(false);setManualUrl(state?.manualMeetingUrl??'')}}>Batal</button></div></div>:null}
    </div>:null}

    {showCompletionActions?<div className="completion-actions">
      <span>Lifecycle</span>
      {status==='scheduled'?<button className="button button-primary" type="button" onClick={()=>confirmRef.current?.showModal()}>Tandai selesai</button>:null}
      {status==='completed'?<button className="button button-outline" type="button" disabled={busy==='scheduled'} onClick={()=>void setStatus('scheduled')}><RotateCcw aria-hidden="true"/>Batalkan tanda selesai</button>:null}
    </div>:null}

    {message?<p className="muted" role="status">{message}</p>:null}
    {showCompletionActions?<dialog ref={confirmRef} className="calendar-dialog compact-confirm-dialog" aria-labelledby="complete-session-title">
      <div className="compact-confirm-dialog__header"><p className="kicker">Konfirmasi selesai</p><h3 id="complete-session-title">Tandai sesi {sessionNumber} selesai?</h3></div>
      <div className="compact-confirm-dialog__body"><p>{mentoringKind==='private'?'Progress enrollment akan dihitung ulang. Jika salah, admin masih dapat membatalkan tanda selesai dan transisi tetap diaudit.':'Status sesi akan dicatat ke audit Intensive Mentoring. Jika salah, admin masih dapat membatalkan tanda selesai sesuai lifecycle yang tersedia.'}</p></div>
      <div className="compact-confirm-dialog__footer"><button className="button button-outline" type="button" onClick={()=>confirmRef.current?.close()}>Kembali</button><button className="button button-primary" type="button" disabled={busy==='completed'} onClick={()=>void setStatus('completed')}>Ya, tandai selesai</button></div>
    </dialog>:null}
  </section>
}
