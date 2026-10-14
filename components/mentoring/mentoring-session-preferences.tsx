'use client'

import { Check, Clock3, ExternalLink, Pencil, Plus, Save, Send, Trash2, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MentoringCompetitionEditor } from '@/components/mentoring/mentoring-competition-editor'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { createClient } from '@/lib/supabase/client'
import { adminFormError } from '@/lib/auth/errors'
import { menteeMentoringError, menteeReviewStatus } from '@/lib/mentoring-presentation'
import {
  isHttpMaterialLink,
  MAX_SUPPORTING_MATERIAL_LENGTH,
  MAX_SUPPORTING_MATERIALS,
  readSupportingMaterials,
  supportingMaterialInput,
  validateSupportingMaterials,
  type MentoringSessionPreference as Preference,
  type SupportingMaterialCategory,
  type SupportingMaterialEntry,
} from '@/lib/mentoring/supporting-materials'
import styles from '@/components/dashboard/mentee-mentoring.module.css'
import materialStyles from './mentoring-session-preferences.module.css'

type Focus={id:string;name:string}

type MentoringSessionPreferencesProps={
  kind:'private'|'intensive'
  sessionId:string
  role:'mentee'|'admin'|'mentor'
  language?:'en'|'id'
  title?:string|null
  showCompetitionContext?:boolean
  showReviewStatus?:boolean
  auditMode?:'full'|'request-only'|'none'
  hideEditButton?:boolean
  editRequestKey?:number
  onChanged?:()=>void|Promise<void>
}

const reviewLabel=(status:Preference['topicStatus'],language:'en'|'id'='id')=>language==='en'?(status==='confirmed'?'Reviewed':status==='pending_review'?'Awaiting admin review':'Not reviewed'):(status==='confirmed'?'Sudah ditinjau':status==='pending_review'?'Menunggu review admin':'Belum ditinjau')

function MaterialReference({item}: {item:SupportingMaterialEntry}) {
  return item.kind==='link'&&isHttpMaterialLink(item.value)
    ?<a className={materialStyles.reference} href={item.value} target="_blank" rel="noopener noreferrer">{item.value}<ExternalLink aria-hidden="true"/></a>
    :<span>{item.value}</span>
}

export function MentoringSessionPreferences({
  kind,
  sessionId,
  role,
  language,
  title=null,
  showCompetitionContext=true,
  showReviewStatus=true,
  auditMode='full',
  hideEditButton=false,
  editRequestKey=0,
  onChanged,
}:MentoringSessionPreferencesProps){
  const supabase=useMemo(()=>createClient(),[])
  const mentee=role==='mentee'
  const english=language?language==='en':role!=='admin'
  const copy=(englishCopy:string,indonesian:string)=>english?englishCopy:indonesian
  const[data,setData]=useState<Preference|null>(null)
  const[focuses,setFocuses]=useState<Focus[]>([])
  const[editing,setEditing]=useState(false)
  const editingRef=useRef(false)
  editingRef.current=editing
  const[focusChoice,setFocusChoice]=useState('')
  const[customFocus,setCustomFocus]=useState('')
  const[topic,setTopic]=useState('')
  const[materials,setMaterials]=useState<SupportingMaterialEntry[]>([])
  const[notes,setNotes]=useState('')
  const[busy,setBusy]=useState(false)
  const[message,setMessage]=useState('')
  const[loadError,setLoadError]=useState(false)
  const lastEditRequest=useRef(editRequestKey)
  const loadSequence=useRef(0)

  const readOnly=role==='mentor'
  const closed=data?.status==='completed'||data?.status==='cancelled'
  const pastScheduled=data?.status==='scheduled'&&Boolean(data.scheduledStartAt&&Date.parse(data.scheduledStartAt)<=Date.now())
  const editUnavailable=closed||pastScheduled

  const hydrate=useCallback((next:Preference)=>{
    setData(next)
    const focusId=role==='mentee'?next.requestedFocusId:next.focusId
    const custom=role==='mentee'?next.requestedCustomFocus:next.customFocus
    setFocusChoice(focusId??(custom?'custom':''))
    setCustomFocus(custom??'')
    setTopic((role==='mentee'?next.requestedTopic:next.topic)??'')
    setMaterials(readSupportingMaterials(next.supportingMaterialEntries,next.supportingMaterials))
    setNotes(next.mentorNotes??'')
  },[role])

  const load=useCallback(async()=>{
    const sequence=++loadSequence.current
    setLoadError(false)
    try {
      const[result,catalog]=await Promise.all([
        supabase.rpc('get_mentoring_session_preferences',{p_kind:kind,p_session_id:sessionId}),
        supabase.from('private_mentoring_session_focuses').select('id,name').eq('is_active',true).order('sort_order'),
      ])
      if(sequence!==loadSequence.current)return
      setLoadError(Boolean(result.error||!result.data))
      if(!result.error&&result.data&&!editingRef.current)hydrate(result.data)
      if(!catalog.error)setFocuses((catalog.data??[]) as Focus[])
    } catch {
      if(sequence===loadSequence.current)setLoadError(true)
    }
  },[hydrate,kind,sessionId,supabase])

  useEffect(()=>{void load();return()=>{loadSequence.current+=1}},[load])
  useEffect(()=>{setEditing(false);setMessage('')},[sessionId])
  useOperationalInvalidation(['mentoring','admin-overview'],()=>{void load()})

  useEffect(()=>{
    if(editRequestKey===lastEditRequest.current)return
    lastEditRequest.current=editRequestKey
    if(!readOnly&&!editUnavailable)setEditing(true)
  },[editUnavailable,editRequestKey,readOnly])

  async function save({handOff=false}:{handOff?:boolean}={}){
    if(busy||readOnly||editUnavailable)return
    const entries=handOff?[]:materials.map(item=>({...item,value:item.value.trim()})).filter(item=>item.category==='additional'||Boolean(item.value))
    const materialError=validateSupportingMaterials(entries)
    if(materialError){setMessage(english?materialError:'Periksa materi: maksimal 20 item, tanpa duplikat atau isian kosong, dan gunakan tautan http:// atau https://.');return}
    setBusy(true)
    setMessage('')
    const payload=handOff
      ?{p_focus_id:null,p_custom_focus:null,p_topic:null,p_supporting_material_entries:[],p_mentor_notes:null}
      :{
        p_focus_id:focusChoice&&focusChoice!=='custom'?focusChoice:null,
        p_custom_focus:focusChoice==='custom'?customFocus.trim()||null:null,
        p_topic:topic.trim()||null,
        p_supporting_material_entries:entries,
        p_mentor_notes:role==='admin'?notes.trim()||null:null,
      }
    let result:{data:Preference|null;error:{message:string}|null}
    try {
      result=await supabase.rpc('save_mentoring_session_preferences_v2',{p_kind:kind,p_session_id:sessionId,...payload})
    } catch {
      setBusy(false)
      setMessage(copy('Unable to save session preferences. Please try again.','Preferensi sesi belum dapat disimpan.'))
      return
    }
    setBusy(false)
    if(result.error||!result.data){
      setMessage(english?(role==='admin'?adminFormError(result.error,'Unable to save session preferences. Please try again.'):menteeMentoringError(result.error?.message,'Unable to save session preferences. Please try again.')):result.error?.message||'Preferensi sesi belum dapat disimpan.')
      return
    }
    hydrate(result.data)
    setEditing(false)
    setMessage(role==='admin'?copy('Session reviewed and preferences saved.','Sesi sudah ditinjau dan preferensi tersimpan.'):handOff?copy('Admin will arrange your session.','Sesi diserahkan ke Admin tanpa preferensi opsional.'):copy('Preferences submitted.','Preferensi sesi dikirim ke Admin.'))
    await onChanged?.()
  }

  function patchMaterial(index:number,value:string){
    setMaterials(current=>current.map((item,itemIndex)=>itemIndex===index?supportingMaterialInput(value,'additional'):item))
  }

  function patchPrimaryMaterial(category:SupportingMaterialCategory,value:string){
    setMaterials(current=>{
      const index=current.findIndex(item=>item.category===category)
      if(!value)return current.filter(item=>item.category!==category)
      const next=supportingMaterialInput(value,category)
      if(index<0)return current.length<MAX_SUPPORTING_MATERIALS?[...current,next]:current
      return current.map((item,itemIndex)=>itemIndex===index?next:item)
    })
  }

  const finalFocus=data?.focusName||data?.customFocus||null
  const requestedFocus=data?.requestedFocusName||data?.requestedCustomFocus||null

  const cardClass='mentoring-preference-card'+(mentee?' '+styles.preferences:'')
  if(!data||data.sessionId!==sessionId)return <section className={cardClass} aria-busy={!loadError}><p className="muted" role={loadError?'alert':'status'}>{loadError?copy('Unable to load session preferences.','Preferensi sesi belum dapat dimuat.'):copy('Loading session preferences…','Memuat preferensi sesi…')}</p>{loadError?<button className="button button-outline button-compact" type="button" onClick={()=>void load()}>{copy('Try again','Coba lagi')}</button>:null}</section>

  const savedMaterials=readSupportingMaterials(data.supportingMaterialEntries,data.supportingMaterials)
  if(!editing||editUnavailable)return <section className={cardClass}>
    {title?<div className="mentoring-preference-section-title"><h4>{title}</h4></div>:null}
    <div className="mentoring-preference-card__head">
      <div><span>{copy('Session focus (optional)','Fokus sesi (opsional)')}</span><strong>{finalFocus||requestedFocus||copy('Not selected','Belum ditentukan')}</strong></div>
      {!readOnly&&!editUnavailable&&!hideEditButton?<button className="button button-outline button-compact" type="button" onClick={()=>setEditing(true)}><Pencil aria-hidden="true"/>{copy('Edit preferences','Edit preferensi')}</button>:null}
    </div>
    {showCompetitionContext?<MentoringCompetitionEditor confirmDiscard={role==='admin'} key={data.parentId} kind={kind} parentId={data.parentId} readOnly compact language={english?'en':'id'}/>:null}
    <div className="mentoring-preference-grid">
      <div><span>{copy('Topic / scope (optional)','Topik / scope (opsional)')}</span><strong>{data.topic||data.requestedTopic||copy('Not provided','Belum ditentukan')}</strong></div>
      <div className={materialStyles.summary}><dl className={materialStyles.categories}>{(['guidebook','pitch_deck','additional'] as const).map(category=>{
        const items=savedMaterials.filter(item=>item.category===category)
        const label=category==='guidebook'?'Guidebook':category==='pitch_deck'?'Pitch Deck':copy('Additional Materials','Materi Tambahan')
        return <div key={category}><dt>{label}</dt><dd>{items.length?<ul className="mentoring-material-list">{items.map((item,index)=><li key={category+'-'+index}><MaterialReference item={item}/></li>)}</ul>:copy('Not provided','Belum ditambahkan')}</dd></div>
      })}</dl></div>
    </div>
    {data.mentorNotes?<div className="mentoring-session-note"><span>{copy('Mentor notes','Catatan untuk mentor')}</span><p>{data.mentorNotes}</p></div>:null}
    {showReviewStatus?<div className="mentoring-preference-review"><span>{copy('Review status','Status review')}</span><span className={`ops-status ops-status--${data.topicStatus==='confirmed'?'positive':data.topicStatus==='pending_review'?'warning':'neutral'}`}>{data.topicStatus==='confirmed'?<Check aria-hidden="true" size={13}/>:<Clock3 aria-hidden="true" size={13}/>}<strong>{mentee?menteeReviewStatus(data.topicStatus):reviewLabel(data.topicStatus,english?'en':'id')}</strong></span></div>:null}
    {closed?<small className="muted">{copy('This session is closed. Preferences cannot be edited.','Sesi yang sudah selesai atau dibatalkan disimpan sebagai riwayat dan tidak dapat diubah.')}</small>:null}
    {pastScheduled?<small className="muted">{copy('Preferences can only be changed before the scheduled session.','Preferensi hanya dapat diubah sebelum jadwal sesi dimulai.')}</small>:null}
    {role==='admin'&&auditMode==='request-only'?<details className="mentoring-audit-details"><summary>{copy('Initial request','Permintaan awal')}</summary>{requestedFocus||data.requestedTopic?<dl><div><dt>{copy('Requested focus','Fokus yang diajukan')}</dt><dd>{requestedFocus||copy('None','Tidak ada')}</dd></div><div><dt>{copy('Requested topic / scope','Topik / scope yang diajukan')}</dt><dd>{data.requestedTopic||copy('None','Tidak ada')}</dd></div></dl>:<p className="muted">{copy('No initial preferences submitted.','Tidak ada preferensi awal yang diajukan.')}</p>}</details>:null}
    {role==='admin'&&auditMode==='full'?<details className="mentoring-audit-details"><summary>{copy('Initial request & session details','Permintaan awal & detail teknis')}</summary><dl><div><dt>{copy('Requested focus','Fokus yang diajukan')}</dt><dd>{requestedFocus||copy('None','Tidak ada')}</dd></div><div><dt>{copy('Requested topic','Topik yang diajukan')}</dt><dd>{data.requestedTopic||copy('None','Tidak ada')}</dd></div><div><dt>{copy('Review status','Status review')}</dt><dd>{reviewLabel(data.topicStatus,english?'en':'id')}</dd></div><div><dt>Session ID</dt><dd><code>{data.sessionId}</code></dd></div><div><dt>{copy('Mentor notes','Catatan mentor')}</dt><dd>{data.mentorNotes||copy('None','Tidak ada')}</dd></div></dl></details>:null}
    {message?<small role="status">{message}</small>:null}
  </section>

  const initialFocus=mentee?data.requestedFocusId:data.focusId
  const initialCustom=mentee?data.requestedCustomFocus:data.customFocus
  const dirty=focusChoice!==(initialFocus??(initialCustom?'custom':''))||customFocus!==(initialCustom??'')||topic!==((mentee?data.requestedTopic:data.topic)??'')||JSON.stringify(materials)!==JSON.stringify(savedMaterials)||notes!==(data.mentorNotes??'')
  function cancelEdit(){if(busy)return;if(role==='admin'&&dirty&&!window.confirm(copy('Discard unsaved session preferences?','Batalkan perubahan preferensi sesi?')))return;hydrate(data!);setEditing(false);setMessage('')}
  return <section className={cardClass+' is-editing'} data-unsaved={dirty?'true':undefined} data-saving={busy?'true':undefined}>
    {title?<div className="mentoring-preference-section-title"><h4>{title}</h4></div>:null}
    <fieldset className="ops-form-stack mentoring-preference-form" disabled={busy} style={{border:0,margin:0,padding:0,minWidth:0}}>
      <label className="ops-field"><span>{copy('Session focus (optional)','Fokus sesi (opsional)')}</span><select value={focusChoice} onChange={event=>setFocusChoice(event.target.value)}><option value="">{copy('Not selected','Belum ditentukan')}</option>{focuses.map(focus=><option value={focus.id} key={focus.id}>{focus.name}</option>)}<option value="custom">{copy('Other focus','Fokus lain')}</option></select></label>
      {focusChoice==='custom'?<label className="ops-field"><span>{copy('Other focus','Fokus lain')}</span><input value={customFocus} maxLength={300} onChange={event=>setCustomFocus(event.target.value)} placeholder={copy('Add a focus for this session','Tulis fokus khusus untuk sesi ini')}/></label>:null}
      <div className={'mentoring-preference-edit-grid'+(role==='admin'?' has-mentor-notes':'')}>
        <label className="ops-field"><span>{copy('Topic / scope (optional)','Topik / scope (opsional)')}</span><textarea rows={3} value={topic} maxLength={3000} onChange={event=>setTopic(event.target.value)} placeholder={copy('Session topic or goal','Topik atau tujuan sesi')}/></label>
        {role==='admin'?<label className="ops-field"><span>{copy('Mentor notes (optional)','Catatan untuk mentor (opsional)')}</span><textarea rows={3} maxLength={3000} value={notes} onChange={event=>setNotes(event.target.value)} placeholder={copy('Additional context for the mentor','Konteks tambahan untuk mentor')}/></label>:null}
      </div>
      <section className={materialStyles.editor} aria-label={copy('Supporting materials','Materi pendukung')}>
        <div className={materialStyles.primaryLinks}>{(['guidebook','pitch_deck'] as const).map(category=>{
          const item=materials.find(entry=>entry.category===category)
          return <label className="ops-field" key={category}><span>{category==='guidebook'?'Guidebook':'Pitch Deck'}</span><input type="url" inputMode="url" value={item?.value??''} maxLength={MAX_SUPPORTING_MATERIAL_LENGTH} disabled={!item&&materials.length>=MAX_SUPPORTING_MATERIALS} onChange={event=>patchPrimaryMaterial(category,event.target.value)} placeholder="https://…"/></label>
        })}</div>
        <div className={materialStyles.additional}>
          <div className={materialStyles.additionalHeader}><h5>{copy('Additional Materials','Materi Tambahan')}</h5><small>{materials.length}/{MAX_SUPPORTING_MATERIALS} {copy('materials','materi')}</small></div>
          {materials.map((item,index)=>item.category==='additional'?<div className={materialStyles.materialRow} key={index}><label className="ops-field"><span className="sr-only">{copy('Additional material ','Materi tambahan ')+(index+1)}</span><input value={item.value} maxLength={MAX_SUPPORTING_MATERIAL_LENGTH} onChange={event=>patchMaterial(index,event.target.value)} placeholder={copy('https://… or a short note','https://… atau catatan singkat')}/></label><button type="button" className="ops-icon-button" onClick={()=>setMaterials(current=>current.filter((_,itemIndex)=>itemIndex!==index))} aria-label={copy('Remove additional material ','Hapus materi tambahan ')+(index+1)}><Trash2 aria-hidden="true"/></button></div>:null)}
          <button className={'button button-outline button-compact '+materialStyles.addButton} type="button" disabled={materials.length>=MAX_SUPPORTING_MATERIALS} onClick={()=>setMaterials(current=>[...current,{category:'additional',kind:'note',value:''}])}><Plus aria-hidden="true"/>{copy('Add Material','Tambah Materi')}</button>
        </div>
      </section>
      <div className="button-row"><button className="button button-primary" type="button" disabled={busy} onClick={()=>void save()}>{role==='admin'?<Save aria-hidden="true"/>:<Send aria-hidden="true"/>}{busy?copy('Saving…','Menyimpan…'):role==='admin'?copy('Save & mark reviewed','Simpan & tandai ditinjau'):copy('Submit preferences','Kirim preferensi')}</button>{mentee?<button className="button button-outline" type="button" disabled={busy} onClick={()=>void save({handOff:true})}><UserRound aria-hidden="true"/>Let admin decide</button>:null}<button className="button button-outline" type="button" disabled={busy} onClick={cancelEdit}><X aria-hidden="true"/>{copy('Cancel','Batal')}</button></div>
      {message?<small className="form-error" role="alert">{message}</small>:null}
    </fieldset>
  </section>
}
