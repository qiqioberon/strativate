import 'server-only'
import { buildBookableSlots, type SlotMentor, type TimeInterval } from '@/lib/calendar/slot-engine'
import { getGoogleConnectionStatus, getGoogleFreeBusy, syncPrivateMentoringSession } from '@/lib/google-calendar/server'
import { createClient } from '@/lib/supabase/server'

type SlotContext = {
  sessionId:string; status:string; focusName:string|null; requiredTierId:string; durationMinutes:number; menteeId:string;
  purchasedSessions:number; sessionNumber:number;
  mentors:Array<{mentorId:string;mentorName:string;tierId:string;active:boolean;timezone:string;availability:TimeInterval[];strativate_busy:TimeInterval[]}>
}
function overlap(start:string,end:string,busy:TimeInterval){return new Date(start).getTime()<new Date(busy.end).getTime() && new Date(end).getTime()>new Date(busy.start).getTime()}

export async function getAdminBookableSlots(sessionId:string) {
  const supabase = await createClient() as any
  const {data,error}=await supabase.rpc('admin_get_private_mentoring_slot_context',{p_session_id:sessionId})
  if(error||!data) throw new Error(error?.message||'Slot context belum dapat dimuat.')
  const context=data as SlotContext
  if(!context.focusName) return {context,slots:[],mentorWarnings:[],message:'Mentee perlu memilih fokus sebelum sesi dapat dijadwalkan.'}
  if(context.status==='completed') return {context,slots:[],mentorWarnings:[],message:'Sesi yang sudah selesai tidak dapat dijadwalkan ulang.'}
  const availability=context.mentors.flatMap(mentor=>mentor.availability)
  if(!availability.length) return {context,slots:[],mentorWarnings:[],message:'Belum ada availability mentor untuk minggu yang tersedia.'}
  const horizonStart=availability.reduce((min,r)=>r.start<min?r.start:min,availability[0].start)
  const horizonEnd=availability.reduce((max,r)=>r.end>max?r.end:max,availability[0].end)
  const mentorWarnings:string[]=[]
  const mentors:SlotMentor[]=[]
  for(const mentor of context.mentors){
    let googleBusy:TimeInterval[]=[]
    const connection=await getGoogleConnectionStatus(mentor.mentorId)
    if(connection.connected){
      try{googleBusy=await getGoogleFreeBusy(mentor.mentorId,horizonStart,horizonEnd)}
      catch{mentorWarnings.push(`${mentor.mentorName}: Google Calendar belum dapat diverifikasi.`);continue}
    }
    mentors.push({mentorId:mentor.mentorId,mentorName:mentor.mentorName,tierId:mentor.tierId,active:mentor.active,timezone:mentor.timezone,availability:mentor.availability,strativateBusy:mentor.strativate_busy??[],googleBusy})
  }
  const baseSlots=buildBookableSlots({now:new Date().toISOString(),durationMinutes:context.durationMinutes,requiredTierId:context.requiredTierId,stepMinutes:15,mentors})
  let menteeBusy:TimeInterval[]=[]
  try{if((await getGoogleConnectionStatus(context.menteeId)).connected) menteeBusy=await getGoogleFreeBusy(context.menteeId,horizonStart,horizonEnd)}catch{/* secondary indicator only */}
  const slots=baseSlots.map(slot=>({...slot,menteeConflict:menteeBusy.some(busy=>overlap(slot.start,slot.end,busy))}))
  return {context,slots,mentorWarnings,message:slots.length?'':'Tidak ada slot yang benar-benar tersedia pada availability minggu ini / minggu depan.'}
}

export async function scheduleAdminPrivateMentoringSession(sessionId:string,mentorId:string,start:string,currentAdminId:string){
  const available=await getAdminBookableSlots(sessionId)
  const normalized=new Date(start).toISOString()
  const chosen=available.slots.find(slot=>slot.mentorId===mentorId&&slot.start===normalized)
  if(!chosen) throw new Error('Slot sudah tidak tersedia. Muat ulang pilihan jadwal.')
  const supabase=await createClient() as any
  const {data,error}=await supabase.rpc('admin_schedule_private_mentoring_session',{p_session_id:sessionId,p_mentor_id:mentorId,p_scheduled_start_at:normalized})
  if(error) throw new Error(error.message)
  const sync=await syncPrivateMentoringSession(sessionId,currentAdminId)
  return {session:data,sync}
}
