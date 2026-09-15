import 'server-only'
import { buildBookableSlots, type SlotMentor, type TimeInterval } from '@/lib/calendar/slot-engine'
import { getGoogleConnectionStatus, getGoogleFreeBusy, syncPrivateMentoringSession } from '@/lib/google-calendar/server'
import { createClient } from '@/lib/supabase/server'
import { resolveGoogleCalendarBusy, type GoogleCalendarAvailabilityStatus } from './scheduling-availability'

type SlotContext = {
  sessionId:string
  status:string
  focusName:string|null
  requiredTierId:string
  durationMinutes:number
  menteeId:string
  purchasedSessions:number
  sessionNumber:number
  mentors:Array<{
    mentorId:string
    mentorName:string
    tierId:string
    active:boolean
    timezone:string
    availability:TimeInterval[]
    strativate_busy:TimeInterval[]
  }>
}

function overlap(start:string,end:string,busy:TimeInterval){
  return new Date(start).getTime()<new Date(busy.end).getTime() && new Date(end).getTime()>new Date(busy.start).getTime()
}

export async function getAdminBookableSlots(sessionId:string) {
  const supabase = await createClient() as any
  const {data,error}=await supabase.rpc('admin_get_private_mentoring_slot_context',{p_session_id:sessionId})
  if(error||!data) throw new Error(error?.message||'Slot context belum dapat dimuat.')

  const context=data as SlotContext
  const {data:tier}=await supabase.from('mentor_tiers').select('name').eq('id',context.requiredTierId).maybeSingle()
  const requiredTierName=typeof tier?.name==='string'?tier.name:null
  const resolvedContext={...context,requiredTierName}
  const tierLabel=requiredTierName||'tier paket ini'

  if(!context.focusName) return {context:resolvedContext,slots:[],mentorWarnings:[],message:'Mentee perlu memilih fokus sebelum sesi dapat dijadwalkan.'}
  if(context.status==='completed') return {context:resolvedContext,slots:[],mentorWarnings:[],message:'Sesi yang sudah selesai tidak dapat dijadwalkan ulang.'}
  if(context.status==='cancelled') return {context:resolvedContext,slots:[],mentorWarnings:[],message:'Sesi yang sudah dibatalkan tidak dapat dijadwalkan ulang.'}
  if(!context.mentors.length) return {context:resolvedContext,slots:[],mentorWarnings:[],message:`Belum ada mentor aktif dengan tier ${tierLabel}. Atur tier dan status mentor di Mentor Management sebelum menjadwalkan sesi.`}

  const availability=context.mentors.flatMap(mentor=>mentor.availability)
  if(!availability.length) return {context:resolvedContext,slots:[],mentorWarnings:[],message:`Mentor aktif dengan tier ${tierLabel} ditemukan, tetapi belum memasang availability untuk minggu ini atau minggu depan.`}

  const horizonStart=availability.reduce((min,r)=>r.start<min?r.start:min,availability[0].start)
  const horizonEnd=availability.reduce((max,r)=>r.end>max?r.end:max,availability[0].end)
  const mentorWarnings:string[]=[]
  const mentors:SlotMentor[]=[]
  const mentorCalendarStatus=new Map<string,GoogleCalendarAvailabilityStatus>()

  for(const mentor of context.mentors){
    const connection=await getGoogleConnectionStatus(mentor.mentorId)
    let googleBusy:TimeInterval[]|null=[]
    if(connection.connected){
      try{
        googleBusy=await getGoogleFreeBusy(mentor.mentorId,horizonStart,horizonEnd)
      }catch{
        googleBusy=null
        mentorWarnings.push(`${mentor.mentorName}: Google Calendar belum dapat diverifikasi. Slot tetap dihitung dari availability mentor dan sesi Strativate; periksa agenda Google mentor sebelum konfirmasi.`)
      }
    }
    const calendar=resolveGoogleCalendarBusy({connected:connection.connected,busy:googleBusy})
    mentorCalendarStatus.set(mentor.mentorId,calendar.status)
    mentors.push({
      mentorId:mentor.mentorId,
      mentorName:mentor.mentorName,
      tierId:mentor.tierId,
      active:mentor.active,
      timezone:mentor.timezone,
      availability:mentor.availability,
      strativateBusy:mentor.strativate_busy??[],
      googleBusy:calendar.googleBusy,
    })
  }

  const baseSlots=buildBookableSlots({
    now:new Date().toISOString(),
    durationMinutes:context.durationMinutes,
    requiredTierId:context.requiredTierId,
    stepMinutes:15,
    mentors,
  })
  let menteeBusy:TimeInterval[]=[]
  try{
    if((await getGoogleConnectionStatus(context.menteeId)).connected){
      menteeBusy=await getGoogleFreeBusy(context.menteeId,horizonStart,horizonEnd)
    }
  }catch{/* secondary indicator only */}
  const slots=baseSlots.map(slot=>({
    ...slot,
    menteeConflict:menteeBusy.some(busy=>overlap(slot.start,slot.end,busy)),
    googleCalendarStatus:mentorCalendarStatus.get(slot.mentorId)??'not_connected',
  }))
  const contextWithCalendarStatus={
    ...resolvedContext,
    mentors:context.mentors.map(mentor=>({
      ...mentor,
      googleCalendarStatus:mentorCalendarStatus.get(mentor.mentorId)??'not_connected',
    })),
  }
  return {
    context:contextWithCalendarStatus,
    slots,
    mentorWarnings,
    message:slots.length?'':'Availability ditemukan, tetapi belum ada slot yang dapat dipilih setelah mempertimbangkan durasi sesi, waktu yang sudah lewat, sesi Strativate lain, dan Google Calendar yang berhasil diverifikasi.',
  }
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

export async function cancelAdminPrivateMentoringSession(sessionId:string,currentAdminId:string){
  const supabase=await createClient() as any
  const {data,error}=await supabase.rpc('admin_cancel_private_mentoring_session',{p_session_id:sessionId})
  if(error) throw new Error(error.message)
  try {
    const sync=await syncPrivateMentoringSession(sessionId,currentAdminId)
    return {session:data,sync}
  } catch (syncError) {
    return {
      session:data,
      sync:{
        status:'failed' as const,
        meetingUrl:null,
        eventId:null,
        error:syncError instanceof Error ? syncError.message : 'Google Calendar cancellation could not be synchronized.',
      },
    }
  }
}
