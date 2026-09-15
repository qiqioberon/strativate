'use client'

import { CalendarDays, Check, Clock3, Loader2, TriangleAlert, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { dateKeyInTimeZone } from '@/lib/calendar/slot-engine'
import { availabilityWeekOptions, dateInTimeZone } from '@/lib/mentor/availability'

type AvailabilityRange={start:string;end:string}
type EligibleMentor={mentorId:string;mentorName:string;timezone:string;availability:AvailabilityRange[]}
type Slot={mentorId:string;mentorName:string;timezone:string;start:string;end:string;menteeConflict:boolean}
type SlotPayload={
  context:{
    sessionId:string
    focusName:string|null
    durationMinutes:number
    sessionNumber:number
    purchasedSessions:number
    requiredTierName?:string|null
    mentors?:EligibleMentor[]
  }
  slots:Slot[]
  mentorWarnings:string[]
  message:string
}

function availabilityWeekLabel(start:string,timezone:string){
  const day=dateKeyInTimeZone(start,timezone)
  const weeks=availabilityWeekOptions(dateInTimeZone(new Date(),timezone))
  const week=weeks.find(item=>day>=item.weekStartDate&&day<=item.weekEndDate)
  if(week?.kind==='current')return'Minggu ini'
  if(week?.kind==='next')return'Minggu depan'
  return 'Availability'
}
function availabilityDate(start:string,timezone:string){return new Intl.DateTimeFormat('id-ID',{weekday:'short',day:'numeric',month:'short',timeZone:timezone}).format(new Date(start))}
function availabilityTime(start:string,end:string,timezone:string){const formatter=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:timezone});return`${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`}

export function AdminScheduleDialog({sessionId,onClose,onScheduled}:{sessionId:string|null;onClose:()=>void;onScheduled?:()=>void}){
  const ref=useRef<HTMLDialogElement>(null)
  const [payload,setPayload]=useState<SlotPayload|null>(null)
  const [selected,setSelected]=useState<Slot|null>(null)
  const [loading,setLoading]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  useEffect(()=>{const dialog=ref.current;if(!dialog)return;if(sessionId&&!dialog.open)dialog.showModal();if(!sessionId&&dialog.open)dialog.close()},[sessionId])
  useEffect(()=>{
    if(!sessionId){setPayload(null);setSelected(null);return}
    let active=true
    setLoading(true);setError('');setNotice('')
    fetch(`/api/admin/private-mentoring/sessions/${sessionId}/slots`,{cache:'no-store'})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Slot belum dapat dimuat.');if(active){setPayload(data);setSelected(null)}})
      .catch(err=>{if(active)setError(err.message)})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[sessionId])

  const byDay=useMemo(()=>{
    const map=new Map<string,Map<string,Slot[]>>()
    for(const slot of payload?.slots??[]){
      const day=dateKeyInTimeZone(slot.start,slot.timezone)
      if(!map.has(day))map.set(day,new Map())
      const mentors=map.get(day)!
      if(!mentors.has(slot.mentorId))mentors.set(slot.mentorId,[])
      mentors.get(slot.mentorId)!.push(slot)
    }
    return[...map.entries()]
  },[payload])
  const eligibleMentors=payload?.context.mentors??[]

  async function confirm(){
    if(!sessionId||!selected)return
    setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch(`/api/admin/private-mentoring/sessions/${sessionId}/schedule`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mentorId:selected.mentorId,start:selected.start})})
      const data=await response.json()
      if(!response.ok)throw new Error(data.error||'Jadwal belum dapat disimpan.')
      setNotice(data.sync?.status==='failed'?'Jadwal tersimpan di Strativate, tetapi sinkronisasi Google gagal. Coba Retry dari detail kalender.':'Jadwal tersimpan dan sinkronisasi Google diproses.')
      onScheduled?.()
    }catch(err){setError(err instanceof Error?err.message:'Jadwal belum dapat disimpan.')}
    finally{setBusy(false)}
  }

  return <dialog ref={ref} className="calendar-dialog schedule-dialog" onCancel={event=>{event.preventDefault();onClose()}} onClose={onClose} aria-labelledby="schedule-dialog-title">
    <div className="calendar-dialog__head"><div><p className="kicker">Penjadwalan berbasis availability</p><h3 id="schedule-dialog-title">Jadwalkan Private Mentoring</h3><p>Pilih mentor dan jam yang benar-benar tersedia. Slot dihitung dari availability mentor, sesi Strativate, dan Google Calendar.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Tutup penjadwalan"><X/></button></div>
    <div className="schedule-dialog__body">
      {payload?<div className="schedule-dialog__summary" aria-label="Ringkasan sesi"><div><span>Fokus sesi</span><strong>{payload.context.focusName||'Belum dipilih'}</strong></div><div><span>Tier mentor</span><strong>{payload.context.requiredTierName||'Sesuai paket'}</strong></div><div><span>Durasi</span><strong>{payload.context.durationMinutes} menit</strong></div><div><span>Urutan sesi</span><strong>{payload.context.sessionNumber}/{payload.context.purchasedSessions}</strong></div></div>:null}

      {loading?<p className="calendar-loading"><Loader2 className="spin"/>Menghitung slot aktual…</p>:null}

      {!loading&&payload?<section className="schedule-availability-panel" aria-labelledby="eligible-mentor-heading"><div className="schedule-section-heading"><div><p className="kicker">Ketersediaan mentor</p><h4 id="eligible-mentor-heading">Mentor sesuai tier</h4></div><span>{eligibleMentors.length} mentor aktif</span></div>{eligibleMentors.length?<div className="schedule-mentor-grid">{eligibleMentors.map(mentor=>{const bookableCount=(payload.slots??[]).filter(slot=>slot.mentorId===mentor.mentorId).length;return <article className="schedule-mentor-card" key={mentor.mentorId}><div className="schedule-mentor-card__head"><div className="schedule-mentor-identity"><span className="schedule-mentor-avatar" aria-hidden="true"><UserRound/></span><div><strong>{mentor.mentorName}</strong><small>{mentor.timezone}</small></div></div><span className={bookableCount?'schedule-ready-badge':'schedule-ready-badge is-empty'}>{bookableCount} slot siap</span></div><div className="schedule-availability-chips">{mentor.availability.length?mentor.availability.map(range=><span className="schedule-availability-chip" key={`${mentor.mentorId}-${range.start}-${range.end}`}><CalendarDays aria-hidden="true"/><span><strong>{availabilityWeekLabel(range.start,mentor.timezone)}</strong><small>{availabilityDate(range.start,mentor.timezone)} · {availabilityTime(range.start,range.end,mentor.timezone)}</small></span></span>):<p className="schedule-mentor-empty">Belum ada availability untuk minggu ini atau minggu depan.</p>}</div></article>})}</div>:<div className="schedule-empty-state"><TriangleAlert aria-hidden="true"/><div><strong>Belum ada mentor aktif sesuai tier.</strong><p>Sesi ini membutuhkan mentor tier {payload.context.requiredTierName||'yang sesuai paket'}. Periksa tier dan status mentor di Mentor Management.</p></div></div>}</section>:null}

      {payload?.mentorWarnings?.length?<div className="calendar-warning" role="status"><TriangleAlert/><div><strong>Beberapa calendar belum dapat diverifikasi.</strong>{payload.mentorWarnings.map(item=><span key={item}>{item}</span>)}</div></div>:null}

      {!loading&&payload?<section className="schedule-slot-panel" aria-labelledby="available-slot-heading"><div className="schedule-section-heading"><div><p className="kicker">Slot aktual</p><h4 id="available-slot-heading">Pilih waktu tersedia</h4></div><span>{payload.slots.length} pilihan</span></div>{payload.message?<div className="schedule-empty-state"><Clock3 aria-hidden="true"/><div><strong>Belum ada slot yang bisa dikonfirmasi.</strong><p>{payload.message}</p></div></div>:null}<div className="schedule-slot-list">{byDay.map(([day,mentors])=><section key={day} className="schedule-day"><h4><CalendarDays/>{new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${day}T12:00:00Z`))}</h4>{[...mentors.entries()].map(([mentorId,slots])=><div className="schedule-mentor" key={mentorId}><div><strong>{slots[0].mentorName}</strong><small>{slots[0].timezone}</small></div><div className="schedule-slots">{slots.map(slot=><button type="button" key={`${slot.mentorId}-${slot.start}`} aria-pressed={selected?.mentorId===slot.mentorId&&selected?.start===slot.start} className={selected?.mentorId===slot.mentorId&&selected?.start===slot.start?'is-selected':''} onClick={()=>setSelected(slot)}><Clock3/>{availabilityTime(slot.start,slot.end,slot.timezone)}{slot.menteeConflict?<small>⚠ Bentrok agenda mentee</small>:null}</button>)}</div></div>)}</section>)}</div></section>:null}

      {error?<p className="form-error schedule-dialog__feedback" role="alert">{error}</p>:null}{notice?<p className="form-success schedule-dialog__feedback" role="status">{notice}</p>:null}
    </div>
    <div className="calendar-dialog__actions"><button type="button" className="button button-outline" onClick={onClose}>Batal</button><button type="button" className="button button-primary" disabled={!selected||busy} onClick={()=>void confirm()}>{busy?<Loader2 className="spin"/>:<Check/>}{busy?'Menyimpan…':'Konfirmasi slot'}</button></div>
  </dialog>
}
