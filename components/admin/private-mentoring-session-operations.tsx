'use client'

import { CheckCircle2, ExternalLink, RefreshCw, RotateCcw, Save, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

export function AdminCompetitionEditor({enrollmentId}:{enrollmentId:string}){
  const supabase=useMemo(()=>createClient(),[])
  const rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
  const[categories,setCategories]=useState<Category[]>([])
  const[categoryId,setCategoryId]=useState('')
  const[name,setName]=useState('')
  const[busy,setBusy]=useState(false)
  const[message,setMessage]=useState('')

  const load=useCallback(async()=>{
    const [competition,catalog]=await Promise.all([
      rpc.rpc<Competition[]>('get_admin_private_mentoring_competition',{p_enrollment_id:enrollmentId}),
      supabase.from('competition_categories').select('id,name').eq('is_active',true).order('sort_order'),
    ])
    const row=competition.data?.[0]
    setCategoryId(row?.competition_category_id??'')
    setName(row?.competition_name??'')
    setCategories((catalog.data??[]) as Category[])
  },[enrollmentId,rpc,supabase])

  useEffect(()=>{void load()},[load])

  async function save(){
    if(name.trim().length<2){setMessage('Competition / bidang lomba wajib diisi minimal 2 karakter.');return}
    setBusy(true);setMessage('')
    const result=await rpc.rpc('admin_set_private_mentoring_competition',{p_enrollment_id:enrollmentId,p_competition_category_id:categoryId||null,p_competition_name:name.trim()})
    setBusy(false)
    if(result.error){setMessage(result.error.message);return}
    setMessage('Competition / bidang lomba tersimpan.')
    await load()
  }

  return <section className="schedule-day">
    <div><p className="kicker">Competition / bidang lomba</p><h4>{name||'Belum dilengkapi'}</h4><p className="muted">Enrollment-wide dan terpisah dari topic/scope per sesi. Wajib ada sebelum sesi baru dijadwalkan.</p></div>
    <div className="ops-form-stack">
      <label className="ops-field"><span>Kategori (opsional)</span><select value={categoryId} onChange={event=>setCategoryId(event.target.value)}><option value="">Tanpa kategori</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="ops-field"><span>Nama lomba / bidang lomba</span><input value={name} maxLength={300} onChange={event=>setName(event.target.value)} placeholder="Contoh: Business Case Competition"/></label>
      <button className="button button-outline" type="button" disabled={busy} onClick={()=>void save()}><Save aria-hidden="true"/>{busy?'Menyimpan…':'Simpan competition'}</button>
      {message?<p className="muted" role="status">{message}</p>:null}
    </div>
  </section>
}

export function AdminSessionOperations({
  sessionId,status,menteeName,sessionNumber,mentorName,scheduledStartAt,onChanged,
}:{
  sessionId:string
  status:string
  menteeName:string
  sessionNumber:number
  mentorName:string|null
  scheduledStartAt:string|null
  onChanged:()=>void|Promise<void>
}){
  const supabase=useMemo(()=>createClient(),[])
  const rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
  const[state,setState]=useState<MeetingState|null>(null)
  const[manualUrl,setManualUrl]=useState('')
  const[busy,setBusy]=useState('')
  const[message,setMessage]=useState('')
  const confirmRef=useRef<HTMLDialogElement>(null)

  const load=useCallback(async()=>{
    const response=await fetch(`/api/admin/private-mentoring/sessions/${sessionId}/meeting`,{cache:'no-store'})
    const body=await response.json() as MeetingState&{error?:string}
    if(response.ok){setState(body);setManualUrl(body.manualMeetingUrl??'')}
  },[sessionId])
  useEffect(()=>{void load()},[load])

  async function updateMeeting(){
    setBusy('meeting');setMessage('')
    const response=await fetch(`/api/admin/private-mentoring/sessions/${sessionId}/meeting`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({url:manualUrl.trim()||null})})
    const body=await response.json() as MeetingState&{error?:string}
    setBusy('')
    if(!response.ok){setMessage(body.error||'Meeting link belum dapat diubah.');return}
    setState(body);setManualUrl(body.manualMeetingUrl??'');setMessage('Meeting override dan Calendar event sudah direconcile.')
    await onChanged()
  }

  async function retrySync(){
    setBusy('sync');setMessage('')
    const response=await fetch(`/api/admin/private-mentoring/sessions/${sessionId}/sync`,{method:'POST'})
    const body=await response.json() as{error?:string;status?:string}
    setBusy('')
    if(!response.ok&&response.status!==202){setMessage(body.error||'Provider sync belum berhasil.');return}
    setMessage(body.status==='provider_pending'?'Zoom sedang direconcile. Coba lagi setelah beberapa saat.':'Zoom dan Google Calendar sudah direconcile.')
    await load();await onChanged()
  }

  async function setStatus(next:'completed'|'scheduled'){
    setBusy(next);setMessage('')
    const result=await rpc.rpc('admin_set_private_mentoring_session_status',{p_session_id:sessionId,p_status:next})
    setBusy('')
    if(result.error){setMessage(result.error.message);return}
    if(confirmRef.current?.open)confirmRef.current.close()
    setMessage(next==='completed'?'Sesi ditandai selesai.':'Tanda selesai dibatalkan dan enrollment dihitung ulang.')
    await onChanged()
  }

  return <section className="meeting-override">
    <div className="ops-section-heading"><div><p className="kicker">Operasi sesi</p><h4>Meeting, provider, recording & completion</h4><p>{menteeName} · Sesi {sessionNumber}{mentorName?' · '+mentorName:''}{scheduledStartAt?' · '+new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(scheduledStartAt)):''}</p></div></div>
    {state?<dl className="calendar-detail-list">
      <div><dt>Provider</dt><dd>{state.meetingProvider??'Belum dibuat'}</dd></div>
      <div><dt>Provider meeting ID</dt><dd>{state.providerMeetingId??'—'}</dd></div>
      <div><dt>Provider sync</dt><dd>{state.providerSyncStatus}{state.providerSyncError?' · '+state.providerSyncError:''}</dd></div>
      <div><dt>Calendar sync</dt><dd>{state.calendarSyncStatus}{state.calendarSyncError?' · '+state.calendarSyncError:''}</dd></div>
      <div><dt>Recording</dt><dd>{state.recordingStatus}{state.recordingError?' · '+state.recordingError:''}</dd></div>
      <div><dt>Effective meeting link</dt><dd>{state.effectiveMeetingUrl?<a href={state.effectiveMeetingUrl} target="_blank" rel="noopener noreferrer">Buka meeting <ExternalLink aria-hidden="true"/></a>:'Belum tersedia'}</dd></div>
    </dl>:<p className="muted">Memuat meeting state…</p>}
    <label className="ops-field"><span>Manual meeting override</span><input type="url" value={manualUrl} onChange={event=>setManualUrl(event.target.value)} placeholder="https://…"/></label>
    <div className="button-row">
      <button className="button button-outline" type="button" disabled={busy==='meeting'} onClick={()=>void updateMeeting()}><Save aria-hidden="true"/>{manualUrl.trim()?'Simpan override':'Reset ke provider link'}</button>
      <button className="button button-outline" type="button" disabled={busy==='sync'} onClick={()=>void retrySync()}><RefreshCw aria-hidden="true"/>Retry Zoom + Calendar sync</button>
      {status==='scheduled'?<button className="button button-primary" type="button" onClick={()=>confirmRef.current?.showModal()}><CheckCircle2 aria-hidden="true"/>Tandai selesai</button>:null}
      {status==='completed'?<button className="button button-outline" type="button" disabled={busy==='scheduled'} onClick={()=>void setStatus('scheduled')}><RotateCcw aria-hidden="true"/>Batalkan tanda selesai</button>:null}
    </div>
    {message?<p className="muted" role="status">{message}</p>:null}
    <dialog ref={confirmRef} className="calendar-dialog">
      <div className="calendar-dialog__head"><div><p className="kicker">Konfirmasi selesai</p><h3>Tandai sesi {sessionNumber} selesai?</h3></div><button className="icon-button" type="button" onClick={()=>confirmRef.current?.close()} aria-label="Tutup konfirmasi"><X/></button></div>
      <p>Progress enrollment akan dihitung ulang. Jika salah, admin masih dapat membatalkan tanda selesai dan seluruh transisi tetap diaudit.</p>
      <div className="button-row"><button className="button button-outline" type="button" onClick={()=>confirmRef.current?.close()}>Kembali</button><button className="button button-primary" type="button" disabled={busy==='completed'} onClick={()=>void setStatus('completed')}>Ya, tandai selesai</button></div>
    </dialog>
  </section>
}
