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
type ZoomRoomOption={id:string;name:string;meetingUrl:string}
type Slot={mentorId:string;mentorName:string;timezone:string;start:string;end:string;menteeConflict:boolean;googleCalendarStatus?:GoogleCalendarAvailabilityStatus;availableZoomRooms:ZoomRoomOption[];zoomRoomCount:number}
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

function availabilityDate(start:string,timezone:string){return new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'short',timeZone:timezone}).format(new Date(start))}
function availabilityFullDate(start:string,timezone:string){return new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:timezone}).format(new Date(start))}
function availabilityTime(start:string,end:string,timezone:string){const formatter=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:timezone});return`${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`}
function calendarStatusLabel(status:GoogleCalendarAvailabilityStatus){if(status==='verified')return'Google verified';if(status==='unavailable')return'Google unverified';return'Google disconnected'}
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
  const [zoomRoomId,setZoomRoomId]=useState('')
  const loadSequenceRef=useRef(0)

  useEffect(()=>{const dialog=ref.current;if(!dialog)return;if(sessionId&&!dialog.open)dialog.showModal();if(!sessionId&&dialog.open)dialog.close()},[sessionId])
  const loadSlots=useCallback(async(resetForNewSession:boolean)=>{
    if(!sessionId)return
    const requestId=++loadSequenceRef.current
    setLoading(true);setError('')
    if(resetForNewSession){setNotice('');setMentorQuery('');setDateFilter('');setTimeStart('');setTimeEnd('');setZoomRoomId('');setSelectedDayKey(null);setSelected(null)}
    try{
      const response=await fetch(`/api/admin/${mentoringKind}-mentoring/sessions/${sessionId}/slots`,{cache:'no-store'})
      const data=await response.json() as SlotPayload&{error?:string}
      if(!response.ok)throw new Error(data.error||'Unable to load available slots.')
      if(requestId!==loadSequenceRef.current)return
      setPayload(data)
      setSelected(current=>current?data.slots.find(slot=>slot.mentorId===current.mentorId&&slot.start===current.start)??null:null)
    }catch(err){if(requestId===loadSequenceRef.current)setError(err instanceof Error?err.message:'Unable to load available slots.')}
    finally{if(requestId===loadSequenceRef.current)setLoading(false)}
  },[mentoringKind,sessionId])
  useEffect(()=>{
    if(!sessionId){loadSequenceRef.current+=1;setPayload(null);setSelectedDayKey(null);setSelected(null);setZoomRoomId('');return}
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
    if(selectedDayKey&&!bookableDays.some(day=>daySelectionKey(day)===selectedDayKey)){setSelectedDayKey(null);setSelected(null);setZoomRoomId('')}
  },[bookableDays,selectedDayKey])
  useEffect(()=>{
    if(selected&&(!selectedDay||!selectedDay.slots.some(slot=>slot.mentorId===selected.mentorId&&slot.start===selected.start))){setSelected(null);setZoomRoomId('')}
  },[selected,selectedDay])
  useEffect(()=>{
    if(zoomRoomId&&selected&&!selected.availableZoomRooms.some(room=>room.id===zoomRoomId))setZoomRoomId('')
  },[selected,zoomRoomId])

  function resetFilters(){setMentorQuery('');setDateFilter('');setTimeStart('');setTimeEnd('')}
  function chooseDay(day:BookableMentorDay<Slot>){const key=daySelectionKey(day);if(selectedDayKey!==key){setSelected(null);setZoomRoomId('')}setSelectedDayKey(key)}
  function chooseSlot(slot:Slot){setSelected(slot);setZoomRoomId('')}

  const emptyMessage=payload&&bookableDays.length===0
    ?invalidTimeRange
      ?'End time must be at or after start time.'
      :payload.slots.length>0&&hasFilters
        ?'No available mentor slots match these filters.'
        :payload.message
    :''

  async function confirm(){
    if(!sessionId||!selected||busy)return
    setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch(`/api/admin/${mentoringKind}-mentoring/sessions/${sessionId}/schedule`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mentorId:selected.mentorId,start:selected.start,zoomRoomId:zoomRoomId||null})})
      const data=await response.json()
      if(!response.ok)throw new Error(data.error||'Unable to save the schedule.')
      if(data.sync?.status==='failed') setNotice('Schedule and Zoom room saved, but Google Calendar sync failed. Sync again from session details.')
      else setNotice('Schedule, Zoom room, and Google Calendar updated.')
      onScheduled?.()
    }catch(err){setError(err instanceof Error?err.message:'Unable to save the schedule.')}
    finally{setBusy(false)}
  }

  return <dialog ref={ref} className="calendar-dialog schedule-dialog" onCancel={event=>{event.preventDefault();if(!busy)onClose()}} onClose={onClose} aria-labelledby="schedule-dialog-title">
    <div className="calendar-dialog__head"><div><h3 id="schedule-dialog-title">Schedule {mentoringKind==='private'?'Private':'Intensive'} Mentoring</h3><p>Choose a mentor, date, and available time. Slots account for mentor availability, Strativate sessions, and verified Google Calendar events.</p></div><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Close scheduling"><X/></button></div>
    <fieldset className="schedule-dialog__body" disabled={busy} style={{border:0,margin:0,minWidth:0}}>
      {payload?<div className="schedule-dialog__summary" aria-label="Session summary"><div><span>Session focus</span><strong>{payload.context.focusName||'Not selected'}</strong></div><div><span>Mentor</span><strong>{payload.context.requiredTierName||(mentoringKind==='private'?'Matching package tier':'All active mentors')}</strong></div><div><span>Duration</span><strong>{payload.context.durationMinutes} minutes</strong></div><div><span>Session number</span><strong>{payload.context.sessionNumber}{payload.context.purchasedSessions?'/'+payload.context.purchasedSessions:''}</strong></div></div>:null}

      {loading?<p className="calendar-loading"><Loader2 className="spin"/>Calculating available slots…</p>:null}

      {!loading&&payload?<div className="schedule-filter-bar" aria-label="Filter available slots">
        <div className="schedule-filter-copy"><strong>Find a time</strong><small>Filters apply to currently bookable slots.</small></div>
        <label className="schedule-filter-field schedule-filter-field--mentor"><span>Mentor</span><div className="schedule-filter-input"><Search aria-hidden="true"/><input type="search" value={mentorQuery} onChange={event=>setMentorQuery(event.target.value)} placeholder="Search mentor name"/></div></label>
        <label className="schedule-filter-field"><span>Date</span><input type="date" value={dateFilter} onChange={event=>setDateFilter(event.target.value)}/></label>
        <div className="schedule-filter-field"><span>Time range</span><div className="schedule-filter-time"><input type="time" aria-label="Start time" value={timeStart} onChange={event=>setTimeStart(event.target.value)}/><span>–</span><input type="time" aria-label="End time" value={timeEnd} onChange={event=>setTimeEnd(event.target.value)}/></div></div>
        <div className="schedule-filter-actions"><small>{hasFilters?`${activeFilterCount} active filters`:'All available slots'}</small>{hasFilters?<button type="button" onClick={resetFilters}><X aria-hidden="true"/>Reset</button>:null}</div>
      </div>:null}

      {!loading&&payload?<section className="schedule-availability-panel" aria-labelledby="eligible-mentor-heading"><div className="schedule-section-heading"><div><h4 id="eligible-mentor-heading">{mentoringKind==='private'?'Mentors in the required tier':'Available active mentors'}</h4></div><span>{mentorGroups.length} mentor · {visibleSlotCount} slot</span></div>{mentorGroups.length?<div className="schedule-mentor-grid">{mentorGroups.map(({mentor,days,slotCount})=><article className="schedule-mentor-card" key={mentor.mentorId}><div className="schedule-mentor-card__head"><div className="schedule-mentor-identity"><span className="schedule-mentor-avatar" aria-hidden="true"><UserRound/></span><div><strong>{mentor.mentorName}</strong><small>{mentor.timezone}</small></div></div><div className="schedule-mentor-card__badges"><span className="schedule-ready-badge">{slotCount} slot</span>{mentor.googleCalendarStatus?<span className={`schedule-calendar-badge ${calendarStatusClass(mentor.googleCalendarStatus)}`}>{calendarStatusLabel(mentor.googleCalendarStatus)}</span>:null}</div></div><div className="schedule-mentor-days">{days.map(day=>{const key=daySelectionKey(day);const isSelected=selectedDayKey===key;return <button type="button" className={`schedule-day-card${isSelected?' is-selected':''}`} aria-pressed={isSelected} key={key} onClick={()=>chooseDay(day)}><span className="schedule-day-card__title"><CalendarDays aria-hidden="true"/><strong>{availabilityDate(day.slots[0].start,day.timezone)}</strong></span><span className="schedule-day-card__ranges">{day.ranges.map(range=><span key={`${range.start}-${range.end}`}>{availabilityTime(range.start,range.end,day.timezone)}</span>)}</span><span className="schedule-day-card__meta">{day.slots.length} slot</span></button>})}</div></article>)}</div>:<div className="schedule-empty-state"><Clock3 aria-hidden="true"/><div><strong>{hasFilters?'No slots match these filters.':'No bookable slots available.'}</strong><p>{emptyMessage||'No mentors have available slots for this session.'}</p></div></div>}</section>:null}

      {payload?.mentorWarnings?.length?<div className="calendar-warning" role="status"><TriangleAlert/><div><strong>Some Google Calendars could not be verified.</strong>{payload.mentorWarnings.map(item=><span key={item}>{item}</span>)}</div></div>:null}

      {!loading&&selectedDay?<section className="schedule-slot-panel" aria-labelledby="available-slot-heading"><div className="schedule-section-heading"><div><h4 id="available-slot-heading">Select an available time</h4></div><span>{selectedDay.slots.length} choices</span></div><div className="schedule-selected-day"><CalendarDays aria-hidden="true"/><div><strong>{availabilityFullDate(selectedDay.slots[0].start,selectedDay.timezone)}</strong><span>{selectedDay.mentorName} · {selectedDay.timezone}</span></div></div><div className="schedule-slots schedule-slots--selected-day">{selectedDay.slots.map(slot=><button type="button" key={`${slot.mentorId}-${slot.start}`} aria-pressed={selected?.mentorId===slot.mentorId&&selected?.start===slot.start} className={selected?.mentorId===slot.mentorId&&selected?.start===slot.start?'is-selected':''} onClick={()=>chooseSlot(slot)}><Clock3/>{availabilityTime(slot.start,slot.end,slot.timezone)}<small>{slot.zoomRoomCount} available Zoom rooms</small>{slot.menteeConflict?<small>⚠ Mentee calendar conflict</small>:null}{slot.googleCalendarStatus==='unavailable'?<small>⚠ Mentor Google Calendar unverified</small>:null}</button>)}</div></section>:null}

      {selected?<label className="schedule-zoom-room-field"><span>Zoom room · {selected.zoomRoomCount} available</span><select value={zoomRoomId} onChange={event=>setZoomRoomId(event.target.value)}><option value="">Automatic — select an available room</option>{selected.availableZoomRooms.map(room=><option key={room.id} value={room.id}>{room.name}</option>)}</select><small>Rooms are shared by Private and Intensive Mentoring. Availability is checked again when you confirm.</small></label>:null}

      {error?<p className="form-error schedule-dialog__feedback" role="alert">{error}</p>:null}{notice?<p className="form-success schedule-dialog__feedback" role="status">{notice}</p>:null}
    </fieldset>
    <div className="calendar-dialog__actions"><button type="button" className="button button-outline" disabled={busy} onClick={onClose}><X aria-hidden="true"/>Cancel</button><button type="button" className="button button-primary" disabled={!selected||busy} onClick={()=>void confirm()}>{busy?<Loader2 className="spin"/>:<Check/>}{busy?'Saving…':'Confirm slot'}</button></div>
  </dialog>
}
