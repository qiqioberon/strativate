import 'server-only'
import { adminFormError } from '@/lib/auth/errors'
import { buildBookableSlots, type SlotMentor, type TimeInterval } from '@/lib/calendar/slot-engine'
import { getGoogleConnectionStatus, getGoogleFreeBusy, syncPrivateMentoringSession } from '@/lib/google-calendar/server'
import { createClient } from '@/lib/supabase/server'
import { availableManagedZoomRooms, getManagedZoomRoomPool } from '@/lib/zoom-rooms/server'
import { resolveGoogleCalendarBusy, type GoogleCalendarAvailabilityStatus } from './scheduling-availability'

type SlotContext = {
  sessionId:string
  status:string
  topicStatus:'needs_input'|'pending_review'|'confirmed'
  focusName:string|null
  resolvedTopic:string|null
  requiredTierId:string
  durationMinutes:number
  menteeId:string
  purchasedSessions:number
  sessionNumber:number
  primaryMentorRequired:boolean
  primaryMentorId:string|null
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
type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}

function overlap(start:string,end:string,busy:TimeInterval){
  return new Date(start).getTime()<new Date(busy.end).getTime() && new Date(end).getTime()>new Date(busy.start).getTime()
}

export async function getAdminBookableSlots(sessionId:string) {
  const supabase = await createClient()
  const rpc=supabase as unknown as RpcClient
  const {data,error}=await rpc.rpc<SlotContext>('admin_get_private_mentoring_slot_context',{p_session_id:sessionId})
  if(error||!data) throw new Error(adminFormError(error,'Unable to load session scheduling details.'))

  const context=data
  const {data:tier}=await supabase.from('mentor_tiers').select('name').eq('id',context.requiredTierId).maybeSingle()
  const requiredTierName=typeof tier?.name==='string'?tier.name:null
  const resolvedContext={...context,requiredTierName}
  const tierLabel=requiredTierName||'the package tier'

  if(context.topicStatus!=='confirmed') return {context:resolvedContext,slots:[],mentorWarnings:[],message:'Session preferences await admin review. Mark the session as reviewed before scheduling.'}
  if(context.status==='completed') return {context:resolvedContext,slots:[],mentorWarnings:[],message:'Completed sessions cannot be rescheduled.'}
  if(context.status==='cancelled') return {context:resolvedContext,slots:[],mentorWarnings:[],message:'Cancelled sessions cannot be rescheduled.'}
  if(context.primaryMentorRequired&&!context.primaryMentorId) return {context:resolvedContext,slots:[],mentorWarnings:[],message:'Packages with 5 or more sessions require a dedicated mentor. Assign one in enrollment details before scheduling.'}
  if(!context.mentors.length) return {context:resolvedContext,slots:[],mentorWarnings:[],message:`No active mentors in ${tierLabel}. Set mentor tiers and account status in Mentors before scheduling.`}

  const availability=context.mentors.flatMap(mentor=>mentor.availability)
  if(!availability.length) return {context:resolvedContext,slots:[],mentorWarnings:[],message:`Active mentors in ${tierLabel} have not set availability for this week or next week.`}

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
        mentorWarnings.push(`${mentor.mentorName}: Google Calendar could not be verified. Slots use mentor availability and Strativate sessions; check the mentor calendar before confirming.`)
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
  const zoomRooms=await getManagedZoomRoomPool({from:horizonStart,to:horizonEnd,sessionId,mentoringKind:'private'})
  if(!zoomRooms.length)return{
    context:resolvedContext,
    slots:[],
    mentorWarnings,
    message:'No active Zoom rooms. Add a link from Admin → Zoom.',
  }
  let menteeBusy:TimeInterval[]=[]
  try{
    if((await getGoogleConnectionStatus(context.menteeId)).connected){
      menteeBusy=await getGoogleFreeBusy(context.menteeId,horizonStart,horizonEnd)
    }
  }catch{/* secondary indicator only */}
  const slots=baseSlots.flatMap(slot=>{
    const availableZoomRooms=availableManagedZoomRooms(zoomRooms,slot.start,slot.end)
    if(!availableZoomRooms.length)return[]
    return [{
      ...slot,
      availableZoomRooms,
      zoomRoomCount:availableZoomRooms.length,
      menteeConflict:menteeBusy.some(busy=>overlap(slot.start,slot.end,busy)),
      googleCalendarStatus:mentorCalendarStatus.get(slot.mentorId)??'not_connected',
    }]
  })
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
    message:slots.length?'':baseSlots.length?'All Zoom rooms are reserved at the available times. Choose another time or add a room from Admin → Zoom.':'No bookable slots remain after accounting for session duration, elapsed time, existing Strativate sessions, and verified Google Calendar events.',
  }
}

export async function scheduleAdminPrivateMentoringSession(sessionId:string,mentorId:string,start:string,zoomRoomId:string|null,currentAdminId:string){
  const available=await getAdminBookableSlots(sessionId)
  const normalized=new Date(start).toISOString()
  const chosen=available.slots.find(slot=>slot.mentorId===mentorId&&slot.start===normalized)
  if(!chosen) throw new Error('This slot is no longer available. Refresh the schedule options.')
  const supabase=await createClient();const rpc=supabase as unknown as RpcClient
  const {data,error}=await rpc.rpc('admin_schedule_private_mentoring_session',{p_session_id:sessionId,p_mentor_id:mentorId,p_scheduled_start_at:normalized,p_zoom_room_id:zoomRoomId})
  if(error) throw new Error(adminFormError(error,'Unable to update the session. Please refresh and try again.'))
  const sync=await syncPrivateMentoringSession(sessionId,currentAdminId)
  return {session:data,sync}
}

export async function cancelAdminPrivateMentoringSession(sessionId:string,currentAdminId:string){
  const supabase=await createClient();const rpc=supabase as unknown as RpcClient
  const {data,error}=await rpc.rpc('admin_cancel_private_mentoring_session',{p_session_id:sessionId})
  if(error) throw new Error(adminFormError(error,'Unable to update the session. Please refresh and try again.'))
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
