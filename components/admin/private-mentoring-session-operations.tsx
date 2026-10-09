'use client'

import { CheckCircle2, ExternalLink, Pencil, RefreshCw, RotateCcw, Save, X } from 'lucide-react'
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
  if(!state.effectiveMeetingUrl)return'Not available'
  return state.manualMeetingUrl?'Manual link':'Managed Zoom room'
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
    if(name.trim().length<2){setMessage('Competition name must contain at least 2 characters.');return}
    setBusy(true);setMessage('')
    const result=await rpc.rpc('admin_set_private_mentoring_competition',{p_enrollment_id:enrollmentId,p_competition_category_id:categoryId||null,p_competition_name:name.trim()})
    setBusy(false)
    if(result.error){setMessage('Unable to save the competition. Check your input and try again.');return}
    await load()
    setEditing(false)
    setMessage('Competition saved.')
  }

  return <section className="schedule-day admin-editable-section" data-testid="admin-competition-section">
    <div className="admin-editable-section__head">
      <div><h4>{saved?.competition_name||'Not provided'}</h4><p>Applies to the enrollment, separately from each session topic.</p></div>
      {!editing&&saved?.competition_name?<button className="button button-outline button-compact" type="button" onClick={()=>setEditing(true)}><Pencil aria-hidden="true"/>Edit</button>:null}
    </div>
    {!editing&&saved?.competition_name?<div className="admin-readonly-grid"><div><span>Competition name</span><strong>{saved.competition_name}</strong></div><div><span>Category</span><strong>{saved.competition_category_name||'No category'}</strong></div></div>:null}
    {editing?<div className="ops-form-stack admin-edit-form">
      <label className="ops-field"><span>Category (optional)</span><select value={categoryId} onChange={event=>setCategoryId(event.target.value)}><option value="">No category</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="ops-field"><span>Competition name / field</span><input value={name} maxLength={300} onChange={event=>setName(event.target.value)} placeholder="Example: Business Case Competition"/></label>
      <div className="button-row"><button className="button competition-save-button" type="button" disabled={busy} onClick={()=>void save()}><Save aria-hidden="true"/>{busy?'Saving…':'Save competition'}</button>{saved?.competition_name?<button className="button button-outline" type="button" disabled={busy} onClick={cancel}>Cancel</button>:null}</div>
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
  const editingRef=useRef(false)
  editingRef.current=editingRoom||editingOverride
  const loadSequence=useRef(0)
  const[busy,setBusy]=useState('')
  const[message,setMessage]=useState('')
  const confirmRef=useRef<HTMLDialogElement>(null)

  const publishState=useCallback((next:AdminMeetingState|null)=>{
    setState(next)
    onStateChange?.(next)
  },[onStateChange])

  const load=useCallback(async()=>{
    const sequence=++loadSequence.current
    try{
      const response=await fetch('/api/admin/'+mentoringKind+'-mentoring/sessions/'+sessionId+'/meeting',{cache:'no-store'})
      const body=await response.json() as AdminMeetingState&{error?:string}
      if(sequence!==loadSequence.current)return
      if(response.ok){
        publishState(body)
        if(!editingRef.current){setManualUrl(body.manualMeetingUrl??'');setZoomRoomId(body.assignedZoomRoomId??'')}
        return
      }
      publishState(null)
      setMessage(body.error||'Unable to load meeting status.')
    }catch{
      if(sequence!==loadSequence.current)return
      publishState(null)
      setMessage('Unable to load meeting status.')
    }
  },[mentoringKind,publishState,sessionId])

  useEffect(()=>{void load();return()=>{loadSequence.current+=1}},[load,status,scheduledStartAt])
  useOperationalInvalidation(['provider','calendar'],()=>void load())

  async function assignRoom(){
    if(!zoomRoomId||busy)return
    setBusy('room');setMessage('')
    try{
      const response=await fetch('/api/admin/'+mentoringKind+'-mentoring/sessions/'+sessionId+'/meeting',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({zoomRoomId})})
      const body=await response.json() as AdminMeetingState&{error?:string}
      if(!response.ok)throw new Error(body.error||'Unable to change the Zoom room.')
      publishState(body)
      setEditingRoom(false)
      setMessage(body.calendarSyncStatus==='failed'?'Zoom room updated. Google Calendar needs to be synced again.':'Zoom room and Google Calendar updated.')
      await onChanged()
    }catch(error){
      setMessage(error instanceof Error?error.message:'Unable to change the Zoom room.')
    }finally{
      setBusy('')
    }
  }

  async function saveOverride(){
    if(busy)return
    const trimmed=manualUrl.trim()
    if(!/^https:\/\//i.test(trimmed)){setMessage('Enter a valid HTTPS meeting URL.');return}
    setBusy('meeting');setMessage('')
    try{
    const response=await fetch('/api/admin/'+mentoringKind+'-mentoring/sessions/'+sessionId+'/meeting',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({url:trimmed})})
    const body=await response.json() as AdminMeetingState&{error?:string}
    setBusy('')
    if(!response.ok){setMessage(body.error||'Unable to save the meeting override.');return}
    publishState(body)
    setManualUrl(body.manualMeetingUrl??'')
    setEditingOverride(false)
    setMessage(body.calendarSyncStatus==='failed'?'Manual override active. Google Calendar needs to be synced again.':'Manual override active. Calendar uses the effective link; the Zoom room reservation remains in place.')
    await onChanged()
    }catch{setMessage('Unable to save the meeting override. Your changes are still in the form.')}
    finally{setBusy('')}
  }

  async function restoreZoom(){
    if(busy)return
    setBusy('restore');setMessage('')
    try{
    const response=await fetch('/api/admin/'+mentoringKind+'-mentoring/sessions/'+sessionId+'/meeting',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({url:null})})
    const body=await response.json() as AdminMeetingState&{error?:string}
    setBusy('')
    if(!response.ok){setMessage(body.error||'Unable to restore the Zoom link.');return}
    publishState(body)
    setManualUrl('')
    setEditingOverride(false)
    setMessage(body.calendarSyncStatus==='failed'?'Managed Zoom link active. Google Calendar needs to be synced again.':'The meeting uses the managed Zoom room link again, and Calendar has been updated.')
    await onChanged()
    }catch{setMessage('Unable to restore the Zoom link. Please try again.')}
    finally{setBusy('')}
  }

  async function retrySync(){
    if(busy)return
    setBusy('sync');setMessage('')
    try{
    const response=await fetch('/api/admin/'+mentoringKind+'-mentoring/sessions/'+sessionId+'/sync',{method:'POST'})
    const body=await response.json() as{error?:string;status?:string}
    setBusy('')
    if(!response.ok&&response.status!==202){setMessage(body.error||'Unable to sync Google Calendar.');return}
    setMessage(body.status==='failed'?'Google Calendar still needs attention. Reconnect and try again.':'Google Calendar updated with the effective meeting link.')
    await load()
    await onChanged()
    }catch{setMessage('Unable to sync Google Calendar. Please try again.')}
    finally{setBusy('')}
  }

  async function setStatus(next:'completed'|'scheduled'){
    if(busy)return
    setBusy(next);setMessage('')
    try{
    const result=await rpc.rpc(mentoringKind==='private'?'admin_set_private_mentoring_session_status':'admin_set_intensive_session_status',{p_session_id:sessionId,p_status:next})
    setBusy('')
    if(result.error){setMessage('Unable to update session status. Please try again.');return}
    if(confirmRef.current?.open)confirmRef.current.close()
    setMessage(next==='completed'?'Session marked as completed.':mentoringKind==='private'?'Session reopened and enrollment progress recalculated.':'Session reopened; engagement remains active.')
    await onChanged()
    await load()
    }catch{setMessage('Unable to update session status. Please try again.')}
    finally{setBusy('')}
  }

  const calendarError=state?.calendarSyncError?humanizeProviderError('calendar',state.calendarSyncError,'en'):null
  const isClosed=status==='completed'||status==='cancelled'

  return <section className="meeting-override admin-session-operations" data-testid="admin-session-operations" data-saving={busy?'true':undefined} data-unsaved={(editingRoom&&zoomRoomId!==(state?.assignedZoomRoomId??''))||(editingOverride&&manualUrl!==(state?.manualMeetingUrl??''))?'true':undefined}>
    <div className="meeting-calendar-heading"><div><h4>Meeting &amp; Calendar</h4>{showContextSummary?<p>{menteeName} · Session {sessionNumber}{mentorName?' · '+mentorName:''}{scheduledStartAt?' · '+new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(scheduledStartAt)):''}</p>:null}</div></div>

    {showSessionReference?<div className="session-reference-row"><div><span>Session ID</span><strong>{sessionId}</strong></div><CopyTextButton value={sessionId} label="Copy Session ID" copiedLabel="ID copied"/></div>:null}

    {state?<div className="provider-status-grid meeting-calendar-grid">
      <div><span>Zoom Room</span><strong>{state.assignedZoomRoomName??(state.manualMeetingUrl?'Using manual link':'Not assigned')}</strong></div>
      <div className={state.calendarSyncStatus==='failed'?'is-warning':state.calendarSyncStatus==='ready'||state.calendarSyncStatus==='synced'?'is-success':''}><span>Calendar</span><strong>{humanizeSyncStatus(state.calendarSyncStatus,'en')}</strong>{calendarError?<small role="status">{calendarError}</small>:null}</div>
      <div><span>Meeting Link</span><strong>{effectiveMeetingLabel(state)}</strong></div>
    </div>:<p className="muted">Loading meeting status…</p>}

    {state?.effectiveMeetingUrl?<div className="effective-meeting-row">
      <div><span>Effective meeting link</span><code className="meeting-link-value">{state.effectiveMeetingUrl}</code></div>
      {!isClosed?<div className="table-action-group"><a className="button button-primary button-compact" href={state.effectiveMeetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true"/>Open Zoom</a><CopyTextButton value={state.effectiveMeetingUrl} label="Copy meeting link" copiedLabel="Link copied"/></div>:null}
    </div>:null}

    {status==='scheduled'?<fieldset className="provider-action-stack" disabled={Boolean(busy)} style={{border:0,margin:0,padding:0,minWidth:0}}>
      <div className="button-row">
        {!editingOverride?<button className="button button-outline" type="button" onClick={()=>{setManualUrl(state?.manualMeetingUrl??'');setEditingOverride(true)}}><Pencil aria-hidden="true"/>Override meeting link</button>:null}
        <button className="button button-outline" type="button" onClick={()=>{setZoomRoomId(state?.assignedZoomRoomId??'');setEditingRoom(value=>!value)}}><Pencil aria-hidden="true"/>Change Zoom room</button>
        {state?.manualMeetingUrl&&state.assignedZoomRoomId?<button className="button button-outline" type="button" disabled={busy==='restore'} onClick={()=>void restoreZoom()}><RotateCcw aria-hidden="true"/>Restore managed Zoom link</button>:null}
        <button className="button button-outline" type="button" disabled={busy==='sync'} onClick={()=>void retrySync()}><RefreshCw aria-hidden="true"/>Sync Calendar again</button>
      </div>
      {editingRoom?<div className="override-editor"><label className="ops-field"><span>available Zoom rooms</span><select value={zoomRoomId} onChange={event=>setZoomRoomId(event.target.value)}><option value="">Select a Zoom room</option>{state?.availableZoomRooms.map(room=><option key={room.id} value={room.id}>{room.name}</option>)}</select></label><p className="muted">Rooms reserved at this session time are excluded.</p><div className="button-row"><button className="button button-primary" type="button" disabled={!zoomRoomId||busy==='room'} onClick={()=>void assignRoom()}><Save aria-hidden="true"/>Save Zoom room</button><button className="button button-outline" type="button" onClick={()=>setEditingRoom(false)}><X aria-hidden="true"/>Cancel</button></div></div>:null}
      {editingOverride?<div className="override-editor"><label className="ops-field"><span>Manual meeting URL</span><input type="url" value={manualUrl} onChange={event=>setManualUrl(event.target.value)} placeholder="https://…"/></label><p className="muted">An override changes the effective Calendar link. The Zoom room stays reserved for this session.</p><div className="button-row"><button className="button button-primary" type="button" disabled={busy==='meeting'} onClick={()=>void saveOverride()}><Save aria-hidden="true"/>Save override</button><button className="button button-outline" type="button" disabled={busy==='meeting'} onClick={()=>{setEditingOverride(false);setManualUrl(state?.manualMeetingUrl??'')}}><X aria-hidden="true"/>Cancel</button></div></div>:null}
    </fieldset>:null}

    {showCompletionActions?<div className="completion-actions">
      <span>Lifecycle</span>
      {status==='scheduled'?<button className="button button-primary" type="button" onClick={()=>confirmRef.current?.showModal()}><CheckCircle2 aria-hidden="true"/>Mark as completed</button>:null}
      {status==='completed'?<button className="button button-outline" type="button" disabled={busy==='scheduled'} onClick={()=>void setStatus('scheduled')}><RotateCcw aria-hidden="true"/>Reopen session</button>:null}
    </div>:null}

    {message?<p className="muted" role="status">{message}</p>:null}
    {showCompletionActions?<dialog ref={confirmRef} className="calendar-dialog compact-confirm-dialog" aria-labelledby="complete-session-title" onCancel={event=>{if(busy)event.preventDefault()}}>
      <div className="compact-confirm-dialog__header"><h3 id="complete-session-title">Mark session {sessionNumber} completed?</h3></div>
      <div className="compact-confirm-dialog__body"><p>{mentoringKind==='private'?'Enrollment progress will be recalculated. Admins can reopen the session if needed; changes remain in the audit history.':'The status change will be recorded in the Intensive Mentoring audit. Admins can reopen the session when its lifecycle allows.'}</p></div>
      <div className="compact-confirm-dialog__footer"><button className="button button-outline" type="button" disabled={Boolean(busy)} onClick={()=>confirmRef.current?.close()}><X aria-hidden="true"/>Back</button><button className="button button-primary" type="button" disabled={Boolean(busy)} onClick={()=>void setStatus('completed')}><CheckCircle2 aria-hidden="true"/>Yes, mark as completed</button></div>
    </dialog>:null}
  </section>
}
