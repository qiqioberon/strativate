'use client'

import { ExternalLink, Pencil, Plus, Save, Send, Trash2, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MentoringCompetitionEditor } from '@/components/mentoring/mentoring-competition-editor'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { createClient } from '@/lib/supabase/client'

type Preference={
  sessionId:string
  parentId:string
  kind:'private'|'intensive'
  status:'awaiting_focus'|'awaiting_scheduling'|'scheduled'|'completed'|'cancelled'
  topicStatus:'needs_input'|'pending_review'|'confirmed'
  requestedFocusId:string|null
  requestedFocusName:string|null
  requestedCustomFocus:string|null
  requestedTopic:string|null
  focusId:string|null
  focusName:string|null
  customFocus:string|null
  topic:string|null
  supportingMaterials:string[]
  mentorNotes:string|null
  competitionNames:string[]
}
type Focus={id:string;name:string}
type RpcClient={rpc:<T>(name:string,args:Record<string,unknown>)=>PromiseLike<{data:T|null;error:{message:string}|null}>}

type MentoringSessionPreferencesProps={
  kind:'private'|'intensive'
  sessionId:string
  role:'mentee'|'admin'|'mentor'
  title?:string|null
  showCompetitionContext?:boolean
  showReviewStatus?:boolean
  auditMode?:'full'|'request-only'|'none'
  hideEditButton?:boolean
  editRequestKey?:number
  onChanged?:()=>void|Promise<void>
}

const isUrl=(value:string)=>/^https?:\/\/\S+$/i.test(value)
const reviewLabel=(status:Preference['topicStatus'])=>status==='confirmed'?'Sudah ditinjau':status==='pending_review'?'Menunggu review admin':'Belum ditinjau'

export function MentoringSessionPreferences({
  kind,
  sessionId,
  role,
  title=null,
  showCompetitionContext=true,
  showReviewStatus=true,
  auditMode='full',
  hideEditButton=false,
  editRequestKey=0,
  onChanged,
}:MentoringSessionPreferencesProps){
  const supabase=useMemo(()=>createClient(),[])
  const rpc=supabase as unknown as RpcClient
  const[data,setData]=useState<Preference|null>(null)
  const[focuses,setFocuses]=useState<Focus[]>([])
  const[editing,setEditing]=useState(false)
  const[focusChoice,setFocusChoice]=useState('')
  const[customFocus,setCustomFocus]=useState('')
  const[topic,setTopic]=useState('')
  const[materials,setMaterials]=useState<string[]>([])
  const[notes,setNotes]=useState('')
  const[busy,setBusy]=useState(false)
  const[message,setMessage]=useState('')
  const lastEditRequest=useRef(editRequestKey)
  const loadSequence=useRef(0)

  const readOnly=role==='mentor'
  const closed=data?.status==='completed'||data?.status==='cancelled'

  const hydrate=useCallback((next:Preference)=>{
    setData(next)
    const focusId=role==='mentee'?next.requestedFocusId:next.focusId
    const custom=role==='mentee'?next.requestedCustomFocus:next.customFocus
    setFocusChoice(focusId??(custom?'custom':''))
    setCustomFocus(custom??'')
    setTopic((role==='mentee'?next.requestedTopic:next.topic)??'')
    setMaterials(next.supportingMaterials??[])
    setNotes(next.mentorNotes??'')
  },[role])

  const load=useCallback(async()=>{
    const sequence=++loadSequence.current
    const[result,catalog]=await Promise.all([
      rpc.rpc<Preference>('get_mentoring_session_preferences',{p_kind:kind,p_session_id:sessionId}),
      supabase.from('private_mentoring_session_focuses').select('id,name').eq('is_active',true).order('sort_order'),
    ])
    if(sequence!==loadSequence.current)return
    if(!result.error&&result.data)hydrate(result.data)
    if(!catalog.error)setFocuses((catalog.data??[]) as Focus[])
  },[hydrate,kind,rpc,sessionId,supabase])

  useEffect(()=>{void load();return()=>{loadSequence.current+=1}},[load])
  useEffect(()=>{setEditing(false);setMessage('')},[sessionId])
  useOperationalInvalidation(['mentoring','admin-overview'],()=>{void load()})

  useEffect(()=>{
    if(editRequestKey===lastEditRequest.current)return
    lastEditRequest.current=editRequestKey
    if(!readOnly&&!closed)setEditing(true)
  },[closed,editRequestKey,readOnly])

  async function save({handOff=false}:{handOff?:boolean}={}){
    setBusy(true)
    setMessage('')
    const payload=handOff
      ?{p_focus_id:null,p_custom_focus:null,p_topic:null,p_supporting_materials:[],p_mentor_notes:null}
      :{
        p_focus_id:focusChoice&&focusChoice!=='custom'?focusChoice:null,
        p_custom_focus:focusChoice==='custom'?customFocus.trim()||null:null,
        p_topic:topic.trim()||null,
        p_supporting_materials:materials.map(item=>item.trim()).filter(Boolean),
        p_mentor_notes:role==='admin'?notes.trim()||null:null,
      }
    const result=await rpc.rpc<Preference>('save_mentoring_session_preferences',{p_kind:kind,p_session_id:sessionId,...payload})
    setBusy(false)
    if(result.error||!result.data){
      setMessage(result.error?.message||'Preferensi sesi belum dapat disimpan.')
      return
    }
    hydrate(result.data)
    setEditing(false)
    setMessage(role==='admin'?'Sesi sudah ditinjau dan preferensi tersimpan.':handOff?'Sesi diserahkan ke Admin tanpa preferensi opsional.':'Preferensi sesi dikirim ke Admin.')
    await onChanged?.()
  }

  function patchMaterial(index:number,value:string){
    setMaterials(current=>current.map((item,itemIndex)=>itemIndex===index?value:item))
  }

  const finalFocus=data?.focusName||data?.customFocus||null
  const requestedFocus=data?.requestedFocusName||data?.requestedCustomFocus||null

  if(!data||data.sessionId!==sessionId)return <section className="mentoring-preference-card"><p className="muted">Memuat preferensi sesi…</p></section>

  if(!editing||closed)return <section className="mentoring-preference-card">
    {title?<div className="mentoring-preference-section-title"><h4>{title}</h4></div>:null}
    <div className="mentoring-preference-card__head">
      <div><span>Fokus sesi (opsional)</span><strong>{finalFocus||requestedFocus||'Belum ditentukan'}</strong></div>
      {!readOnly&&!closed&&!hideEditButton?<button className="button button-outline button-compact" type="button" onClick={()=>setEditing(true)}><Pencil aria-hidden="true"/>Edit preferensi</button>:null}
    </div>
    {showCompetitionContext?<MentoringCompetitionEditor key={data.parentId} kind={kind} parentId={data.parentId} readOnly compact/>:null}
    <div className="mentoring-preference-grid">
      <div><span>Topik / scope (opsional)</span><strong>{data.topic||data.requestedTopic||'Belum ditentukan'}</strong></div>
      <div><span>File pendukung (opsional)</span>{data.supportingMaterials.length?<ul className="mentoring-material-list">{data.supportingMaterials.map((item,index)=><li key={item+'-'+index}>{isUrl(item)?<a href={item} target="_blank" rel="noopener noreferrer">Buka file <ExternalLink aria-hidden="true"/></a>:item}</li>)}</ul>:<strong>Belum ada</strong>}</div>
    </div>
    {data.mentorNotes?<div className="mentoring-session-note"><span>Catatan untuk mentor</span><p>{data.mentorNotes}</p></div>:null}
    {showReviewStatus?<div className="mentoring-preference-review"><span>Status review</span><strong>{reviewLabel(data.topicStatus)}</strong></div>:null}
    {closed?<small className="muted">Sesi yang sudah selesai atau dibatalkan disimpan sebagai riwayat dan tidak dapat diubah.</small>:null}
    {role==='admin'&&auditMode==='request-only'?<details className="mentoring-audit-details"><summary>Permintaan awal</summary>{requestedFocus||data.requestedTopic?<dl><div><dt>Fokus yang diajukan</dt><dd>{requestedFocus||'Tidak ada'}</dd></div><div><dt>Topik / scope yang diajukan</dt><dd>{data.requestedTopic||'Tidak ada'}</dd></div></dl>:<p className="muted">Tidak ada preferensi awal yang diajukan.</p>}</details>:null}
    {role==='admin'&&auditMode==='full'?<details className="mentoring-audit-details"><summary>Permintaan awal & detail teknis</summary><dl><div><dt>Fokus yang diajukan</dt><dd>{requestedFocus||'Tidak ada'}</dd></div><div><dt>Topik yang diajukan</dt><dd>{data.requestedTopic||'Tidak ada'}</dd></div><div><dt>Status review</dt><dd>{reviewLabel(data.topicStatus)}</dd></div><div><dt>Session ID</dt><dd><code>{data.sessionId}</code></dd></div><div><dt>Catatan mentor</dt><dd>{data.mentorNotes||'Tidak ada'}</dd></div></dl></details>:null}
    {message?<small role="status">{message}</small>:null}
  </section>

  return <section className="mentoring-preference-card is-editing">
    {title?<div className="mentoring-preference-section-title"><h4>{title}</h4></div>:null}
    <div className="ops-form-stack mentoring-preference-form">
      <label className="ops-field"><span>Fokus sesi (opsional)</span><select value={focusChoice} onChange={event=>setFocusChoice(event.target.value)}><option value="">Belum ditentukan</option>{focuses.map(focus=><option value={focus.id} key={focus.id}>{focus.name}</option>)}<option value="custom">Fokus lain</option></select></label>
      {focusChoice==='custom'?<label className="ops-field"><span>Fokus lain</span><input value={customFocus} maxLength={300} onChange={event=>setCustomFocus(event.target.value)} placeholder="Tulis fokus khusus untuk sesi ini"/></label>:null}
      <div className={'mentoring-preference-edit-grid'+(role==='admin'?' has-mentor-notes':'')}>
        <label className="ops-field"><span>Topik / scope (opsional)</span><textarea rows={3} value={topic} maxLength={3000} onChange={event=>setTopic(event.target.value)} placeholder="Topik atau tujuan sesi"/></label>
        {role==='admin'?<label className="ops-field"><span>Catatan untuk mentor (opsional)</span><textarea rows={3} maxLength={3000} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Konteks tambahan untuk mentor"/></label>:null}
      </div>
      <section className="mentoring-material-editor" aria-label="File pendukung (opsional)"><div className="mentoring-material-editor__head"><h5>File pendukung (opsional)</h5><p>Link dokumen, deck, atau materi sesi. Maksimal 20 file.</p></div>{materials.map((item,index)=><div className="mentoring-material-row" key={index}><input aria-label={'File pendukung '+(index+1)} value={item} maxLength={1000} onChange={event=>patchMaterial(index,event.target.value)} placeholder="https://… atau catatan materi"/><button type="button" className="ops-icon-button" onClick={()=>setMaterials(current=>current.filter((_,itemIndex)=>itemIndex!==index))} aria-label={'Hapus file pendukung '+(index+1)}><Trash2 aria-hidden="true"/></button></div>)}<button className="button button-outline button-compact" type="button" disabled={materials.length>=20} onClick={()=>setMaterials(current=>[...current,''])}><Plus aria-hidden="true"/>Tambah file pendukung</button></section>
      <div className="button-row"><button className="button button-primary" type="button" disabled={busy} onClick={()=>void save()}>{role==='admin'?<Save aria-hidden="true"/>:<Send aria-hidden="true"/>}{busy?'Menyimpan…':role==='admin'?'Simpan & tandai ditinjau':'Kirim preferensi'}</button>{role==='mentee'?<button className="button button-outline" type="button" disabled={busy} onClick={()=>void save({handOff:true})}><UserRound aria-hidden="true"/>Serahkan ke Admin</button>:null}<button className="button button-outline" type="button" disabled={busy} onClick={()=>{hydrate(data);setEditing(false)}}><X aria-hidden="true"/>Batal</button></div>
      {role==='mentee'?<small className="muted">Pilih “Serahkan ke Admin” jika ingin melanjutkan tanpa fokus, topik, maupun file pendukung.</small>:null}
      {message?<small className="form-error" role="alert">{message}</small>:null}
    </div>
  </section>
}
