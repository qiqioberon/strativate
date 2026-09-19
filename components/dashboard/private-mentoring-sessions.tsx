'use client'

import { CalendarDays, CheckCircle2, Clock3, ExternalLink, Eye, MessageCircle, Pencil, Save, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { publicContact } from '@/lib/content/brand'
import { createClient } from '@/lib/supabase/client'
import type { PrivateMentoringSessionFocusView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'

type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}
type Draft={topic:string;focusId:string}
type Competition={enrollment_id:string;competition_category_id:string|null;competition_category_name:string|null;competition_name:string|null;competition_updated_at:string|null}
type Category={id:string;name:string}
type CompetitionDraft={categoryId:string;name:string}

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
  return publicContact.whatsapp+'?text='+encodeURIComponent('Halo admin Strativate, mau diskusi terkait jadwal mentoring sesi '+session.sessionNumber+' pada '+when+'.')
}
function canEditTopic(session:PrivateMentoringSessionView){
  if(session.status==='completed'||session.status==='cancelled')return false
  if(session.status==='scheduled'&&session.scheduledStartAt)return new Date(session.scheduledStartAt).getTime()>Date.now()
  return true
}

export function PrivateMentoringSessions({sessions,sessionFocuses}:{sessions:PrivateMentoringSessionView[];sessionFocuses:PrivateMentoringSessionFocusView[]}){
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
  const[editingCompetitions,setEditingCompetitions]=useState<Set<string>>(()=>new Set())
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

  return <div className="engagement-list mentoring-groups">
    {enrollmentIds.map(enrollmentId=>{
      const rows=sessions.filter(session=>session.enrollmentId===enrollmentId)
      const purchased=rows[0]?.purchasedSessions??rows.length
      const used=rows.filter(session=>session.status==='completed').length
      const remaining=Math.max(0,purchased-used)
      const primaryMentor=rows[0]?.primaryMentorName
      const comp=competitions[enrollmentId]
      const compDraft=competitionDraft(enrollmentId)
      return <section className="workspace-card mentoring-group" key={enrollmentId}>
        <div className="mentoring-group__header"><div><p className="kicker">Private Mentoring · {rows[0]?.mentorTierName}</p><h3>{purchased} sesi mentoring</h3><p>{used} selesai · {remaining} tersisa{purchased>=5?' · Mentor utama: '+(primaryMentor||'menunggu penetapan admin'):''}</p></div><span className="ops-status ops-status--info">{rows[0]?.mentorTierName}</span></div>

        <section className="schedule-day mentoring-competition-section">
          <div><p className="kicker">Competition / bidang lomba</p><h4>{comp?.competition_name||'Wajib dilengkapi sebelum scheduling'}</h4><p className="muted">Informasi ini berlaku untuk enrollment Private Mentoring ini dan berbeda dari topik/scope tiap sesi.</p></div>
          {comp?.competition_name&&!editingCompetitions.has(enrollmentId)?<div className="competition-readonly">
            <div><span>Kategori</span><strong>{comp.competition_category_name||'Tanpa kategori'}</strong></div>
            <div><span>Nama lomba / bidang lomba</span><strong>{comp.competition_name}</strong></div>
            <button className="button button-outline" type="button" onClick={()=>setEditingCompetitions(current=>new Set(current).add(enrollmentId))}><Pencil aria-hidden="true"/>Edit</button>
          </div>:<div className="ops-form-stack competition-edit-form">
            <label className="ops-field"><span>Kategori (opsional)</span><select value={compDraft.categoryId} onChange={event=>setCompetitionDrafts(current=>({...current,[enrollmentId]:{...compDraft,categoryId:event.target.value}}))}><option value="">Tanpa kategori</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="ops-field"><span>Nama lomba / bidang lomba</span><input value={compDraft.name} maxLength={300} onChange={event=>setCompetitionDrafts(current=>({...current,[enrollmentId]:{...compDraft,name:event.target.value}}))} placeholder="Contoh: Business Case Competition"/></label>
            <div className="button-row">
              <button className="button competition-save-button" type="button" disabled={busyId==='competition:'+enrollmentId} onClick={()=>void saveCompetition(enrollmentId)}><Save aria-hidden="true"/>{busyId==='competition:'+enrollmentId?'Menyimpan…':'Simpan lomba'}</button>
              {comp?.competition_name?<button className="button button-ghost" type="button" onClick={()=>{setCompetitionDrafts(current=>({...current,[enrollmentId]:{categoryId:comp.competition_category_id??'',name:comp.competition_name??''}}));setEditingCompetitions(current=>{const next=new Set(current);next.delete(enrollmentId);return next})}}>Batal</button>:null}
            </div>
          </div>}
        </section>

        <div className="mentoring-session-list">{rows.map(session=>{
          const editable=canEditTopic(session)
          const status=sessionStatus(session.status)
          const draft=draftFor(session)
          return <article className="mentoring-session-card" key={session.sessionId}>
            <div className="mentoring-session-card__number"><span>Sesi</span><strong>{session.sessionNumber}</strong></div>
            <div className="mentoring-session-card__body">
              <div className="mentoring-session-card__top"><div><h4>{session.resolvedTopic??session.focusName??'Topik belum dikonfirmasi'}</h4><small className="muted">{topicStatus(session.topicStatus)}</small></div><span className={'ops-status ops-status--'+status.tone}>{status.label}</span></div>
              {session.menteeTopicRequest?<p><strong>Permintaan kamu:</strong> {session.menteeTopicRequest}</p>:null}
              {editable?<div className="ops-form-stack">
                <label className="ops-field"><span>Apa yang ingin kamu bahas di sesi ini?</span><textarea rows={4} disabled={busyId===session.sessionId} value={draft.topic} onChange={event=>patchDraft(session,{topic:event.target.value})} placeholder="Ceritakan tujuan, masalah, atau scope yang ingin dibahas."/></label>
                <label className="ops-field"><span>Kategori fokus (opsional)</span><select disabled={busyId===session.sessionId} value={draft.focusId} onChange={event=>patchDraft(session,{focusId:event.target.value})}><option value="">Biarkan admin membantu mengelompokkan</option>{sessionFocuses.map(focus=><option value={focus.id} key={focus.id}>{focus.name}</option>)}</select></label>
                <button className="button button-outline" type="button" disabled={busyId===session.sessionId} onClick={()=>void submitTopic(session)}>{session.topicStatus==='confirmed'?'Ajukan perubahan topik':'Kirim untuk review'}</button>
              </div>:null}
              <div className="mentoring-session-card__meta"><span><UserRound aria-hidden="true"/>{session.mentorName??(session.primaryMentorName?'Mentor utama: '+session.primaryMentorName:'Mentor menunggu penugasan admin')}</span><span><CalendarDays aria-hidden="true"/>{session.scheduledStartAt?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:session.mentorTimezone||undefined}).format(new Date(session.scheduledStartAt)):'Jadwal menunggu admin'}</span><span>{session.status==='completed'?<CheckCircle2 aria-hidden="true"/>:<Clock3 aria-hidden="true"/>}{status.label}</span></div>
              <div className="button-row mentoring-session-card__actions"><button className="button button-outline" type="button" onClick={()=>setSelected(session)}><Eye aria-hidden="true"/>Lihat detail</button>{session.scheduledStartAt&&session.status==='scheduled'&&session.meetingUrl?<a className="button button-primary" href={session.meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true"/>Join Meeting</a>:null}<a className="button button-outline" href={supportHref(session)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true"/>Hubungi Admin</a></div>
            </div>
          </article>
        })}</div>
      </section>
    })}
    {message?<p className="muted" role="status">{message}</p>:null}

    <dialog ref={detailRef} className="calendar-dialog" onCancel={event=>{event.preventDefault();setSelected(null)}} onClose={()=>setSelected(null)}>
      {selected?<>
        <div className="calendar-dialog__head"><div><p className="kicker">Mentoring Saya</p><h3>Private Mentoring · Sesi {selected.sessionNumber}/{selected.purchasedSessions}</h3></div><button type="button" className="icon-button" onClick={()=>setSelected(null)} aria-label="Tutup detail"><X/></button></div>
        <dl className="calendar-detail-list">
          <div><dt>Jenis mentoring</dt><dd>Private Mentoring</dd></div>
          <div><dt>Package / tier</dt><dd>{selected.mentorTierName} · {selected.purchasedSessions} sesi</dd></div>
          <div><dt>Competition / bidang lomba</dt><dd>{competitions[selected.enrollmentId]?.competition_name||'Belum dilengkapi'}</dd></div>
          <div><dt>Topic / scope</dt><dd>{selected.resolvedTopic||selected.menteeTopicRequest||'Belum dikonfirmasi'}</dd></div>
          <div><dt>Mentor</dt><dd>{selected.mentorName||selected.primaryMentorName||'Menunggu admin'}</dd></div>
          <div><dt>Status</dt><dd>{sessionStatus(selected.status).label}</dd></div>
          <div><dt>Jadwal</dt><dd>{selected.scheduledStartAt?new Intl.DateTimeFormat('id-ID',{dateStyle:'full',timeStyle:'short',timeZone:selected.mentorTimezone||undefined}).format(new Date(selected.scheduledStartAt)):'Belum terjadwal'}</dd></div>
          <div><dt>Timezone</dt><dd>{selected.mentorTimezone||'Timezone lokal'}</dd></div>
          <div><dt>Meeting provider</dt><dd>{meetingProvider(selected.meetingUrl)}</dd></div>
        </dl>
        <div className="calendar-dialog__actions calendar-dialog__actions--wrap">{selected.status==='scheduled'&&selected.meetingUrl?<a className="button button-primary" href={selected.meetingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink/>Join Meeting</a>:null}<a className="button button-outline" href={supportHref(selected)} target="_blank" rel="noopener noreferrer"><MessageCircle/>Hubungi Admin</a></div>
      </>:null}
    </dialog>
  </div>
}
