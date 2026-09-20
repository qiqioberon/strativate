'use client'

import { CalendarDays, Check, Clock3, Loader2, Search, TriangleAlert, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import {
  buildBookableMentorDays,
  type BookableMentorDay,
  type GoogleCalendarAvailabilityStatus,
} from '@/lib/private-mentoring/scheduling-availability'

type AvailabilityRange={start:string;end:string}
type EligibleMentor={mentorId:string;mentorName:string;timezone:string;availability:AvailabilityRange[];googleCalendarStatus?:GoogleCalendarAvailabilityStatus}
type Slot={mentorId:string;mentorName:string;timezone:string;start:string;end:string;menteeConflict:boolean;googleCalendarStatus?:GoogleCalendarAvailabilityStatus}
type SlotPayload={
  context:{
    sessionId:string
    focusName:string|null
    durationMinutes:number
    sessionNumber:number
    purchasedSessions:number|null
    requiredTierName?:string|null
    mentors?:EligibleMentor[]
  }
  slots:Slot[]
  mentorWarnings:string[]
  message:string
}

type MentorDayGroup={mentor:EligibleMentor;days:BookableMentorDay<Slot>[];slotCount:number}

function availabilityDate(start:string,timezone:string){return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'short',timeZone:timezone}).format(new Date(start))}
function availabilityFullDate(start:string,timezone:string){return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',timeZone:timezone}).format(new Date(start))}
function availabilityTime(start:string,end:string,timezone:string){const formatter=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:timezone});return`${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`}
function calendarStatusLabel(status:GoogleCalendarAvailabilityStatus){if(status==='verified')return'Google terverifikasi';if(status==='unavailable')return'Google belum terverifikasi';return'Google tidak terhubung'}
function calendarStatusClass(status:GoogleCalendarAvailabilityStatus){if(status==='verified')return'is-verified';if(status==='unavailable')return'is-warning';return'is-neutral'}
function daySelectionKey(day:{mentorId:string;dateKey:string}){return`${day.mentorId}:${day.dateKey}`}
export function retainSelectedScheduleSlot<T extends {mentorId:string;start:string}>(current:T|null,slots:readonly {mentorId:string;start:string}[]){
  return current&&slots.some(slot=>slot.mentorId===current.mentorId&&slot.start===current.start)?current:null
}

export function AdminScheduleDialog({sessionId,onClose,onScheduled,mentoringKind='private'}:{sessionId:string|null;onClose:()=>void;onScheduled?:()=>void;mentoringKind?:'private'|'intensive'}){
  const ref=useRef<HTMLDialogElement>(null)
  const [payload,setPayload]=useState<SlotPayload|null>(null)
  const [selectedDayKey,setSelectedDayKey]=useState<string|null>(null)
  const [selected,setSelected]=useState<Slot|null>(null)
  const [loading,setLoading]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [mentorQuery,setMentorQuery]=useState('')
  const [dateFilter,setDateFilter]=useState('')
  const [timeStart,setTimeStart]=useState('')
  const [timeEnd,setTimeEnd]=useState('')
  const loadSequenceRef=useRef(0)

  useEffect(()=>{const dialog=ref.current;if(!dialog)return;if(sessionId&&!dialog.open)dialog.showModal();if(!sessionId&&dialog.open)dialog.close()},[sessionId])
  const loadSlots=useCallback(async(resetForNewSession:boolean)=>{
    if(!sessionId)return
    const requestId=++loadSequenceRef.current
    setLoading(true);setError('')
    if(resetForNewSession){setNotice('');setMentorQuery('');setDateFilter('');setTimeStart('');setTimeEnd('');setSelectedDayKey(null);setSelected(null)}
    try{
      const response=await fetch(`/api/admin/${mentoringKind}-mentoring/sessions/${sessionId}/slots`,{cache:'no-store'})
      const data=await response.json() as SlotPayload&{error?:string}
      if(!response.ok)throw new Error(data.error||'Slot belum dapat dimuat.')
      if(requestId!==loadSequenceRef.current)return
      setPayload(data)
      setSelected(current=>retainSelectedScheduleSlot(current,data.slots))
    }catch(err){if(requestId===loadSequenceRef.current)setError(err instanceof Error?err.message:'Slot belum dapat dimuat.')}
    finally{if(requestId===loadSequenceRef.current)setLoading(false)}
  },[mentoringKind,sessionId])
  useEffect(()=>{
    if(!sessionId){loadSequenceRef.current+=1;setPayload(null);setSelectedDayKey(null);setSelected(null);return}
    void loadSlots(true)
    return()=>{loadSequenceRef.current+=1}
  },[loadSlots,sessionId])
  useOperationalInvalidation(['calendar', 'availability', 'provider'],()=>{if(sessionId)void loadSlots(false)})

  const eligibleMentors=useMemo(()=>payload?.context.mentors??[],[payload])
  const filters=useMemo(()=>({mentorQuery,date:dateFilter,timeStart,timeEnd}),[dateFilter,mentorQuery,timeEnd,timeStart])
  const bookableDays=useMemo(()=>buildBookableMentorDays({mentors:eligibleMentors,slots:payload?.slots??[],filters}),[eligibleMentors,filters,payload])
  const mentorGroups=useMemo(()=>{
    const mentorById=new Map(eligibleMentors.map(mentor=>[mentor.mentorId,mentor]))
    const groups=new Map<string,MentorDayGroup>()
    for(const day of bookableDays){
      const mentor=mentorById.get(day.mentorId)
      if(!mentor)continue
      const existing=groups.get(day.mentorId)
      if(existing){existing.days.push(day);existing.slotCount+=day.slots.length}
      else groups.set(day.mentorId,{mentor,days:[day],slotCount:day.slots.length})
    }
    return[...groups.values()]
  },[bookableDays,eligibleMentors])
  const selectedDay=useMemo(()=>selectedDayKey?bookableDays.find(day=>daySelectionKey(day)===selectedDayKey)??null:null,[bookableDays,selectedDayKey])
  const visibleSlotCount=useMemo(()=>bookableDays.reduce((total,day)=>total+day.slots.length,0),[bookableDays])
  const activeFilterCount=[mentorQuery.trim(),dateFilter,timeStart,timeEnd].filter(Boolean).length
  const hasFilters=activeFilterCount>0
  const invalidTimeRange=Boolean(timeStart&&timeEnd&&timeStart>timeEnd)

  useEffect(()=>{
    if(selectedDayKey&&!bookableDays.some(day=>daySelectionKey(day)===selectedDayKey)){setSelectedDayKey(null);setSelected(null)}
  },[bookableDays,selectedDayKey])
  useEffect(()=>{
    if(selected&&(!selectedDay||!selectedDay.slots.some(slot=>slot.mentorId===selected.mentorId&&slot.start===selected.start)))setSelected(null)
  },[selected,selectedDay])

  function resetFilters(){setMentorQuery('');setDateFilter('');setTimeStart('');setTimeEnd('')}
  function chooseDay(day:BookableMentorDay<Slot>){const key=daySelectionKey(day);if(selectedDayKey!==key)setSelected(null);setSelectedDayKey(key)}

  const emptyMessage=payload&&bookableDays.length===0
    ?invalidTimeRange
      ?'Jam selesai harus sama dengan atau setelah jam mulai.'
      :payload.slots.length>0&&hasFilters
        ?'Tidak ada mentor dengan slot tersedia yang cocok dengan filter yang dipilih.'
        :payload.message
    :''

  async function confirm(){
    if(!sessionId||!selected)return
    setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch(`/api/admin/${mentoringKind}-mentoring/sessions/${sessionId}/schedule`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mentorId:selected.mentorId,start:selected.start})})
      const data=await response.json()
      if(!response.ok)throw new Error(data.error||'Jadwal belum dapat disimpan.')
      if(data.sync?.status==='provider_failed') setNotice('Jadwal tersimpan di Strativate, tetapi Zoom belum berhasil dibuat atau diperbarui. Gunakan Retry sync dari detail sesi.')
      else if(data.sync?.status==='provider_pending') setNotice('Jadwal tersimpan. Zoom sedang direconcile; Calendar akan dibuat setelah meeting siap.')
      else if(data.sync?.status==='failed') setNotice('Zoom siap, tetapi sinkronisasi Google Calendar gagal. Coba Retry sync dari detail sesi.')
      else setNotice('Jadwal tersimpan. Zoom dan Google Calendar sudah direconcile.')
      onScheduled?.()
    }catch(err){setError(err instanceof Error?err.message:'Jadwal belum dapat disimpan.')}
    finally{setBusy(false)}
  }

  return <dialog ref={ref} className="calendar-dialog schedule-dialog" onCancel={event=>{event.preventDefault();onClose()}} onClose={onClose} aria-labelledby="schedule-dialog-title">
    <div className="calendar-dialog__head"><div><p className="kicker">Penjadwalan berbasis availability</p><h3 id="schedule-dialog-title">Jadwalkan {mentoringKind==='private'?'Private':'Intensive'} Mentoring</h3><p>Pilih mentor, tanggal, lalu waktu yang tersedia. Pilihan dihitung dari availability mentor, sesi Strativate, dan Google Calendar bila dapat diverifikasi.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Tutup penjadwalan"><X/></button></div>
    <div className="schedule-dialog__body">
      {payload?<div className="schedule-dialog__summary" aria-label="Ringkasan sesi"><div><span>Fokus sesi</span><strong>{payload.context.focusName||'Belum dipilih'}</strong></div><div><span>Mentor</span><strong>{payload.context.requiredTierName||(mentoringKind==='private'?'Sesuai tier paket':'Semua mentor aktif')}</strong></div><div><span>Durasi</span><strong>{payload.context.durationMinutes} menit</strong></div><div><span>Urutan sesi</span><strong>{payload.context.sessionNumber}{payload.context.purchasedSessions?'/'+payload.context.purchasedSessions:''}</strong></div></div>:null}

      {loading?<p className="calendar-loading"><Loader2 className="spin"/>Menghitung slot tersedia…</p>:null}

      {!loading&&payload?<div className="schedule-filter-bar" aria-label="Filter slot tersedia">
        <div className="schedule-filter-copy"><strong>Temukan jadwal</strong><small>Filter hanya diterapkan pada slot yang saat ini bisa dijadwalkan.</small></div>
        <label className="schedule-filter-field schedule-filter-field--mentor"><span>Mentor</span><div className="schedule-filter-input"><Search aria-hidden="true"/><input type="search" value={mentorQuery} onChange={event=>setMentorQuery(event.target.value)} placeholder="Cari nama mentor"/></div></label>
        <label className="schedule-filter-field"><span>Tanggal</span><input type="date" value={dateFilter} onChange={event=>setDateFilter(event.target.value)}/></label>
        <div className="schedule-filter-field"><span>Rentang waktu</span><div className="schedule-filter-time"><input type="time" aria-label="Jam mulai" value={timeStart} onChange={event=>setTimeStart(event.target.value)}/><span>–</span><input type="time" aria-label="Jam selesai" value={timeEnd} onChange={event=>setTimeEnd(event.target.value)}/></div></div>
        <div className="schedule-filter-actions"><small>{hasFilters?`${activeFilterCount} filter aktif`:'Semua slot tersedia'}</small>{hasFilters?<button type="button" onClick={resetFilters}><X aria-hidden="true"/>Reset</button>:null}</div>
      </div>:null}

      {!loading&&payload?<section className="schedule-availability-panel" aria-labelledby="eligible-mentor-heading"><div className="schedule-section-heading"><div><p className="kicker">Ketersediaan mentor</p><h4 id="eligible-mentor-heading">{mentoringKind==='private'?'Mentor sesuai tier':'Mentor aktif tersedia'}</h4></div><span>{mentorGroups.length} mentor · {visibleSlotCount} slot</span></div>{mentorGroups.length?<div className="schedule-mentor-grid">{mentorGroups.map(({mentor,days,slotCount})=><article className="schedule-mentor-card" key={mentor.mentorId}><div className="schedule-mentor-card__head"><div className="schedule-mentor-identity"><span className="schedule-mentor-avatar" aria-hidden="true"><UserRound/></span><div><strong>{mentor.mentorName}</strong><small>{mentor.timezone}</small></div></div><div className="schedule-mentor-card__badges"><span className="schedule-ready-badge">{slotCount} slot</span>{mentor.googleCalendarStatus?<span className={`schedule-calendar-badge ${calendarStatusClass(mentor.googleCalendarStatus)}`}>{calendarStatusLabel(mentor.googleCalendarStatus)}</span>:null}</div></div><div className="schedule-mentor-days">{days.map(day=>{const key=daySelectionKey(day);const isSelected=selectedDayKey===key;return <button type="button" className={`schedule-day-card${isSelected?' is-selected':''}`} aria-pressed={isSelected} key={key} onClick={()=>chooseDay(day)}><span className="schedule-day-card__title"><CalendarDays aria-hidden="true"/><strong>{availabilityDate(day.slots[0].start,day.timezone)}</strong></span><span className="schedule-day-card__ranges">{day.ranges.map(range=><span key={`${range.start}-${range.end}`}>{availabilityTime(range.start,range.end,day.timezone)}</span>)}</span><span className="schedule-day-card__meta">{day.slots.length} slot</span></button>})}</div></article>)}</div>:<div className="schedule-empty-state"><Clock3 aria-hidden="true"/><div><strong>{hasFilters?'Tidak ada slot yang cocok dengan filter.':'Belum ada slot yang bisa dijadwalkan.'}</strong><p>{emptyMessage||'Tidak ada mentor dengan slot tersedia untuk sesi ini.'}</p></div></div>}</section>:null}

      {payload?.mentorWarnings?.length?<div className="calendar-warning" role="status"><TriangleAlert/><div><strong>Beberapa Google Calendar belum dapat diverifikasi.</strong>{payload.mentorWarnings.map(item=><span key={item}>{item}</span>)}</div></div>:null}

      {!loading&&selectedDay?<section className="schedule-slot-panel" aria-labelledby="available-slot-heading"><div className="schedule-section-heading"><div><p className="kicker">Slot tersedia</p><h4 id="available-slot-heading">Pilih waktu tersedia</h4></div><span>{selectedDay.slots.length} pilihan</span></div><div className="schedule-selected-day"><CalendarDays aria-hidden="true"/><div><strong>{availabilityFullDate(selectedDay.slots[0].start,selectedDay.timezone)}</strong><span>{selectedDay.mentorName} · {selectedDay.timezone}</span></div></div><div className="schedule-slots schedule-slots--selected-day">{selectedDay.slots.map(slot=><button type="button" key={`${slot.mentorId}-${slot.start}`} aria-pressed={selected?.mentorId===slot.mentorId&&selected?.start===slot.start} className={selected?.mentorId===slot.mentorId&&selected?.start===slot.start?'is-selected':''} onClick={()=>setSelected(slot)}><Clock3/>{availabilityTime(slot.start,slot.end,slot.timezone)}{slot.menteeConflict?<small>⚠ Bentrok agenda mentee</small>:null}{slot.googleCalendarStatus==='unavailable'?<small>⚠ Google mentor belum terverifikasi</small>:null}</button>)}</div></section>:null}

      {error?<p className="form-error schedule-dialog__feedback" role="alert">{error}</p>:null}{notice?<p className="form-success schedule-dialog__feedback" role="status">{notice}</p>:null}
    </div>
    <div className="calendar-dialog__actions"><button type="button" className="button button-outline" onClick={onClose}>Batal</button><button type="button" className="button button-primary" disabled={!selected||busy} onClick={()=>void confirm()}>{busy?<Loader2 className="spin"/>:<Check/>}{busy?'Menyimpan…':'Konfirmasi slot'}</button></div>
  </dialog>
}
