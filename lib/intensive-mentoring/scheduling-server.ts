import 'server-only'
import { adminFormError } from '@/lib/auth/errors'

import {buildBookableSlots,type SlotMentor,type TimeInterval} from '@/lib/calendar/slot-engine'
import {getGoogleConnectionStatus,getGoogleFreeBusy} from '@/lib/google-calendar/server'
import {syncIntensiveMentoringSession} from '@/lib/intensive-mentoring/calendar-server'
import {createClient} from '@/lib/supabase/server'
import {resolveGoogleCalendarBusy,type GoogleCalendarAvailabilityStatus} from '@/lib/private-mentoring/scheduling-availability'
import {availableManagedZoomRooms,getManagedZoomRoomPool} from '@/lib/zoom-rooms/server'

type SlotContext={
 sessionId:string;status:string;focusName:string|null;durationMinutes:number;menteeId:string;purchasedSessions:number|null;sessionNumber:number;primaryMentorId:string|null;
 mentors:Array<{mentorId:string;mentorName:string;tierId:string|null;active:boolean;timezone:string;availability:TimeInterval[];strativate_busy:TimeInterval[]}>
}
type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}
function overlap(start:string,end:string,busy:TimeInterval){return new Date(start).getTime()<new Date(busy.end).getTime()&&new Date(end).getTime()>new Date(busy.start).getTime()}

export async function getAdminIntensiveBookableSlots(sessionId:string){
 const supabase=await createClient(),rpc=supabase as unknown as RpcClient
 const{data,error}=await rpc.rpc<SlotContext>('admin_get_intensive_mentoring_slot_context',{p_session_id:sessionId})
 if(error||!data)throw new Error(adminFormError(error,'Unable to load session scheduling details.'))
 const context=data
 if(context.status==='completed'||context.status==='cancelled')return{context:{...context,requiredTierName:null},slots:[],mentorWarnings:[],message:'Completed or cancelled sessions cannot be rescheduled.'}
 if(!context.mentors.length)return{context:{...context,requiredTierName:null},slots:[],mentorWarnings:[],message:'No active mentors available for scheduling.'}
 const availability=context.mentors.flatMap(mentor=>mentor.availability)
 if(!availability.length)return{context:{...context,requiredTierName:null},slots:[],mentorWarnings:[],message:'Active mentors have not set availability for this week or next week.'}
 const horizonStart=availability.reduce((min,r)=>r.start<min?r.start:min,availability[0].start)
 const horizonEnd=availability.reduce((max,r)=>r.end>max?r.end:max,availability[0].end)
 const mentorWarnings:string[]=[],mentors:SlotMentor[]=[],mentorCalendarStatus=new Map<string,GoogleCalendarAvailabilityStatus>()
 for(const mentor of context.mentors){
  const connection=await getGoogleConnectionStatus(mentor.mentorId)
  let googleBusy:TimeInterval[]|null=[]
  if(connection.connected){
   try{googleBusy=await getGoogleFreeBusy(mentor.mentorId,horizonStart,horizonEnd)}
   catch{googleBusy=null;mentorWarnings.push(mentor.mentorName+': Google Calendar could not be verified; check the mentor calendar before confirming.')}
  }
  const calendar=resolveGoogleCalendarBusy({connected:connection.connected,busy:googleBusy})
  mentorCalendarStatus.set(mentor.mentorId,calendar.status)
  mentors.push({mentorId:mentor.mentorId,mentorName:mentor.mentorName,tierId:mentor.tierId,active:mentor.active,timezone:mentor.timezone,availability:mentor.availability,strativateBusy:mentor.strativate_busy??[],googleBusy:calendar.googleBusy})
 }
 const baseSlots=buildBookableSlots({now:new Date().toISOString(),durationMinutes:context.durationMinutes,requiredTierId:null,stepMinutes:15,mentors})
 const zoomRooms=await getManagedZoomRoomPool({from:horizonStart,to:horizonEnd,sessionId,mentoringKind:'intensive'})
 if(!zoomRooms.length)return{context:{...context,requiredTierName:null},slots:[],mentorWarnings,message:'No active Zoom rooms. Add a link from Admin → Zoom.'}
 let menteeBusy:TimeInterval[]=[]
 try{if((await getGoogleConnectionStatus(context.menteeId)).connected)menteeBusy=await getGoogleFreeBusy(context.menteeId,horizonStart,horizonEnd)}catch{}
 const slots=baseSlots.flatMap(slot=>{const availableZoomRooms=availableManagedZoomRooms(zoomRooms,slot.start,slot.end);return availableZoomRooms.length?[{...slot,availableZoomRooms,zoomRoomCount:availableZoomRooms.length,menteeConflict:menteeBusy.some(busy=>overlap(slot.start,slot.end,busy)),googleCalendarStatus:mentorCalendarStatus.get(slot.mentorId)??'not_connected'}]:[]})
 return{context:{...context,requiredTierName:null,mentors:context.mentors.map(mentor=>({...mentor,googleCalendarStatus:mentorCalendarStatus.get(mentor.mentorId)??'not_connected'}))},slots,mentorWarnings,message:slots.length?'':baseSlots.length?'All Zoom rooms are reserved at the available times. Choose another time or add a room from Admin → Zoom.':'No bookable slots remain after accounting for availability, existing Strativate sessions, and Google Calendar.'}
}

export async function scheduleAdminIntensiveMentoringSession(sessionId:string,mentorId:string,start:string,zoomRoomId:string|null,currentAdminId:string){
 const available=await getAdminIntensiveBookableSlots(sessionId),normalized=new Date(start).toISOString()
 if(!available.slots.some(slot=>slot.mentorId===mentorId&&slot.start===normalized))throw new Error('This slot is no longer available. Refresh the schedule options.')
 const supabase=await createClient(),rpc=supabase as unknown as RpcClient
 const{data,error}=await rpc.rpc('admin_schedule_intensive_mentoring_session',{p_session_id:sessionId,p_mentor_id:mentorId,p_scheduled_start_at:normalized,p_zoom_room_id:zoomRoomId})
 if(error)throw new Error(adminFormError(error,'Unable to update the session. Please refresh and try again.'))
 const sync=await syncIntensiveMentoringSession(sessionId,currentAdminId)
 return{session:data,sync}
}

export async function cancelAdminIntensiveMentoringSession(sessionId:string,currentAdminId:string){
 const supabase=await createClient(),rpc=supabase as unknown as RpcClient
 const{data,error}=await rpc.rpc('admin_cancel_intensive_mentoring_session',{p_session_id:sessionId})
 if(error)throw new Error(adminFormError(error,'Unable to update the session. Please refresh and try again.'))
 try{return{session:data,sync:await syncIntensiveMentoringSession(sessionId,currentAdminId)}}
 catch(syncError){return{session:data,sync:{status:'failed' as const,meetingUrl:null,eventId:null,error:syncError instanceof Error?syncError.message:'Google Calendar cancellation could not be synchronized.'}}}
}
