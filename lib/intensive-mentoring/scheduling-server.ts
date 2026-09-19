import 'server-only'

import {buildBookableSlots,type SlotMentor,type TimeInterval} from '@/lib/calendar/slot-engine'
import {getGoogleConnectionStatus,getGoogleFreeBusy} from '@/lib/google-calendar/server'
import {syncIntensiveMentoringSession} from '@/lib/intensive-mentoring/calendar-server'
import {createClient} from '@/lib/supabase/server'
import {reconcileZoomMeeting,cancelZoomMeeting} from '@/lib/zoom/server'
import {resolveGoogleCalendarBusy,type GoogleCalendarAvailabilityStatus} from '@/lib/private-mentoring/scheduling-availability'

type SlotContext={
 sessionId:string;status:string;focusName:string|null;durationMinutes:number;menteeId:string;purchasedSessions:number|null;sessionNumber:number;primaryMentorId:string|null;
 mentors:Array<{mentorId:string;mentorName:string;tierId:string|null;active:boolean;timezone:string;availability:TimeInterval[];strativate_busy:TimeInterval[]}>
}
type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}
function overlap(start:string,end:string,busy:TimeInterval){return new Date(start).getTime()<new Date(busy.end).getTime()&&new Date(end).getTime()>new Date(busy.start).getTime()}

export async function getAdminIntensiveBookableSlots(sessionId:string){
 const supabase=await createClient(),rpc=supabase as unknown as RpcClient
 const{data,error}=await rpc.rpc<SlotContext>('admin_get_intensive_mentoring_slot_context',{p_session_id:sessionId})
 if(error||!data)throw new Error(error?.message||'Slot context belum dapat dimuat.')
 const context=data
 if(!context.focusName)return{context:{...context,requiredTierName:null},slots:[],mentorWarnings:[],message:'Topik sesi belum dikonfirmasi admin.'}
 if(context.status==='completed'||context.status==='cancelled')return{context:{...context,requiredTierName:null},slots:[],mentorWarnings:[],message:'Sesi historis tidak dapat dijadwalkan ulang.'}
 if(!context.mentors.length)return{context:{...context,requiredTierName:null},slots:[],mentorWarnings:[],message:'Belum ada mentor aktif untuk dijadwalkan.'}
 const availability=context.mentors.flatMap(mentor=>mentor.availability)
 if(!availability.length)return{context:{...context,requiredTierName:null},slots:[],mentorWarnings:[],message:'Mentor aktif belum memasang availability untuk minggu ini atau minggu depan.'}
 const horizonStart=availability.reduce((min,r)=>r.start<min?r.start:min,availability[0].start)
 const horizonEnd=availability.reduce((max,r)=>r.end>max?r.end:max,availability[0].end)
 const mentorWarnings:string[]=[],mentors:SlotMentor[]=[],mentorCalendarStatus=new Map<string,GoogleCalendarAvailabilityStatus>()
 for(const mentor of context.mentors){
  const connection=await getGoogleConnectionStatus(mentor.mentorId)
  let googleBusy:TimeInterval[]|null=[]
  if(connection.connected){
   try{googleBusy=await getGoogleFreeBusy(mentor.mentorId,horizonStart,horizonEnd)}
   catch{googleBusy=null;mentorWarnings.push(mentor.mentorName+': Google Calendar belum dapat diverifikasi; periksa agenda mentor sebelum konfirmasi.')}
  }
  const calendar=resolveGoogleCalendarBusy({connected:connection.connected,busy:googleBusy})
  mentorCalendarStatus.set(mentor.mentorId,calendar.status)
  mentors.push({mentorId:mentor.mentorId,mentorName:mentor.mentorName,tierId:mentor.tierId,active:mentor.active,timezone:mentor.timezone,availability:mentor.availability,strativateBusy:mentor.strativate_busy??[],googleBusy:calendar.googleBusy})
 }
 const baseSlots=buildBookableSlots({now:new Date().toISOString(),durationMinutes:context.durationMinutes,requiredTierId:null,stepMinutes:15,mentors})
 let menteeBusy:TimeInterval[]=[]
 try{if((await getGoogleConnectionStatus(context.menteeId)).connected)menteeBusy=await getGoogleFreeBusy(context.menteeId,horizonStart,horizonEnd)}catch{}
 const slots=baseSlots.map(slot=>({...slot,menteeConflict:menteeBusy.some(busy=>overlap(slot.start,slot.end,busy)),googleCalendarStatus:mentorCalendarStatus.get(slot.mentorId)??'not_connected'}))
 return{context:{...context,requiredTierName:null,mentors:context.mentors.map(mentor=>({...mentor,googleCalendarStatus:mentorCalendarStatus.get(mentor.mentorId)??'not_connected'}))},slots,mentorWarnings,message:slots.length?'':'Belum ada slot yang dapat dipilih setelah availability, sesi Strativate lain, dan Google Calendar diperhitungkan.'}
}

export async function scheduleAdminIntensiveMentoringSession(sessionId:string,mentorId:string,start:string,currentAdminId:string){
 const available=await getAdminIntensiveBookableSlots(sessionId),normalized=new Date(start).toISOString()
 if(!available.slots.some(slot=>slot.mentorId===mentorId&&slot.start===normalized))throw new Error('Slot sudah tidak tersedia. Muat ulang pilihan jadwal.')
 const supabase=await createClient(),rpc=supabase as unknown as RpcClient
 const{data,error}=await rpc.rpc('admin_schedule_intensive_mentoring_session',{p_session_id:sessionId,p_mentor_id:mentorId,p_scheduled_start_at:normalized})
 if(error)throw new Error(error.message)
 const zoom=await reconcileZoomMeeting(sessionId)
 if(zoom.status==='failed')return{session:data,sync:{status:'provider_failed' as const,error:zoom.error,meetingUrl:null,eventId:null},zoom}
 if(zoom.status==='pending')return{session:data,sync:{status:'provider_pending' as const,meetingUrl:zoom.meetingUrl??null,eventId:null},zoom}
 const sync=await syncIntensiveMentoringSession(sessionId,currentAdminId)
 return{session:data,sync,zoom}
}

export async function cancelAdminIntensiveMentoringSession(sessionId:string,currentAdminId:string){
 const supabase=await createClient(),rpc=supabase as unknown as RpcClient
 const{data,error}=await rpc.rpc('admin_cancel_intensive_mentoring_session',{p_session_id:sessionId})
 if(error)throw new Error(error.message)
 const zoom=await cancelZoomMeeting(sessionId)
 try{return{session:data,zoom,sync:await syncIntensiveMentoringSession(sessionId,currentAdminId)}}
 catch(syncError){return{session:data,zoom,sync:{status:'failed' as const,meetingUrl:null,eventId:null,error:syncError instanceof Error?syncError.message:'Google Calendar cancellation could not be synchronized.'}}}
}
