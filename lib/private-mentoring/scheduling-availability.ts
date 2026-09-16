export type TimeIntervalLike = { start:string; end:string }
export type GoogleCalendarAvailabilityStatus = 'verified' | 'not_connected' | 'unavailable'
export type SchedulingWeekFilter = 'all' | 'current' | 'next'

export function resolveGoogleCalendarBusy({ connected, busy }: { connected:boolean; busy:TimeIntervalLike[]|null }) {
  if (!connected) return { googleBusy:[] as TimeIntervalLike[], status:'not_connected' as const }
  if (busy === null) return { googleBusy:[] as TimeIntervalLike[], status:'unavailable' as const }
  return { googleBusy:busy, status:'verified' as const }
}

function dateKeyInTimeZone(value: Date | string, timezone: string) {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:timezone,
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

function addIsoDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0,10)
}

function weekStart(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  const isoDay = date.getUTCDay() || 7
  return addIsoDays(value, -(isoDay - 1))
}

function isoWeekday(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getUTCDay() || 7
}

export function availabilityWeekKind(value: string, timezone: string, now: Date): 'current' | 'next' | 'other' {
  const localDate = dateKeyInTimeZone(value, timezone)
  const currentWeekStart = weekStart(dateKeyInTimeZone(now, timezone))
  const nextWeekStart = addIsoDays(currentWeekStart, 7)
  if (localDate >= currentWeekStart && localDate <= addIsoDays(currentWeekStart, 6)) return 'current'
  if (localDate >= nextWeekStart && localDate <= addIsoDays(nextWeekStart, 6)) return 'next'
  return 'other'
}

export function availabilityMatchesFilters(
  range: TimeIntervalLike,
  timezone: string,
  now: Date,
  weekFilter: SchedulingWeekFilter,
  dayFilter: number | null,
) {
  const end = new Date(range.end).getTime()
  if (!Number.isFinite(end) || end <= now.getTime()) return false
  const localDate = dateKeyInTimeZone(range.start, timezone)
  const currentWeekStart = weekStart(dateKeyInTimeZone(now, timezone))
  const nextWeekStart = addIsoDays(currentWeekStart, 7)
  const currentWeekEnd = addIsoDays(currentWeekStart, 6)
  const nextWeekEnd = addIsoDays(nextWeekStart, 6)
  if (weekFilter === 'current' && (localDate < currentWeekStart || localDate > currentWeekEnd)) return false
  if (weekFilter === 'next' && (localDate < nextWeekStart || localDate > nextWeekEnd)) return false
  if (dayFilter !== null && isoWeekday(localDate) !== dayFilter) return false
  return true
}

export type SchedulingSlotLike = TimeIntervalLike & {
  mentorId:string
  mentorName:string
  timezone:string
}
export type SchedulingMentorLike = {
  mentorId:string
  mentorName:string
  timezone:string
  availability:TimeIntervalLike[]
}
export type SchedulingFilters = {
  mentorQuery:string
  date:string
  timeStart:string
  timeEnd:string
}
export type BookableMentorDay<TSlot extends SchedulingSlotLike = SchedulingSlotLike> = {
  mentorId:string
  mentorName:string
  timezone:string
  dateKey:string
  ranges:TimeIntervalLike[]
  slots:TSlot[]
}

function localClockMinutes(value:string,timezone:string){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value))
  const byType=Object.fromEntries(parts.map(part=>[part.type,part.value]))
  return Number(byType.hour)*60+Number(byType.minute)
}

function parseClock(value:string){
  if(!value)return null
  const match=/^(\d{2}):(\d{2})$/.exec(value)
  if(!match)return null
  const hours=Number(match[1]);const minutes=Number(match[2])
  if(hours>23||minutes>59)return null
  return hours*60+minutes
}

export function slotMatchesTimeRange(slot:SchedulingSlotLike,timeStart:string,timeEnd:string){
  const startFilter=parseClock(timeStart)
  const endFilter=parseClock(timeEnd)
  if(startFilter!==null&&endFilter!==null&&startFilter>endFilter)return false
  const slotStart=localClockMinutes(slot.start,slot.timezone)
  const slotEnd=localClockMinutes(slot.end,slot.timezone)
  if(startFilter!==null&&slotStart<startFilter)return false
  if(endFilter!==null&&slotEnd>endFilter)return false
  return true
}

function slotInsideRange(slot:TimeIntervalLike,range:TimeIntervalLike){
  return new Date(slot.start).getTime()>=new Date(range.start).getTime()&&new Date(slot.end).getTime()<=new Date(range.end).getTime()
}

function mergeRanges(ranges:TimeIntervalLike[]){
  const sorted=[...ranges].sort((a,b)=>new Date(a.start).getTime()-new Date(b.start).getTime()||new Date(a.end).getTime()-new Date(b.end).getTime())
  const merged:TimeIntervalLike[]=[]
  for(const range of sorted){
    const start=new Date(range.start).getTime();const end=new Date(range.end).getTime()
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue
    const previous=merged.at(-1)
    if(previous&&start<=new Date(previous.end).getTime()){
      if(end>new Date(previous.end).getTime())previous.end=range.end
      continue
    }
    merged.push({...range})
  }
  return merged
}

export function buildBookableMentorDays<TSlot extends SchedulingSlotLike>({mentors,slots,filters}:{mentors:SchedulingMentorLike[];slots:TSlot[];filters:SchedulingFilters}){
  const query=filters.mentorQuery.trim().toLocaleLowerCase('id-ID')
  const mentorById=new Map(mentors.map(mentor=>[mentor.mentorId,mentor]))
  const groups=new Map<string,BookableMentorDay<TSlot>>()
  const seenSlots=new Set<string>()

  for(const slot of slots){
    const mentor=mentorById.get(slot.mentorId)
    if(!mentor)continue
    if(query&&!mentor.mentorName.toLocaleLowerCase('id-ID').includes(query))continue
    const dateKey=dateKeyInTimeZone(slot.start,slot.timezone)
    if(filters.date&&dateKey!==filters.date)continue
    if(!slotMatchesTimeRange(slot,filters.timeStart,filters.timeEnd))continue
    const slotKey=`${slot.mentorId}:${slot.start}:${slot.end}`
    if(seenSlots.has(slotKey))continue
    seenSlots.add(slotKey)
    const key=`${slot.mentorId}:${dateKey}`
    const group=groups.get(key)
    if(group)group.slots.push(slot)
    else groups.set(key,{mentorId:slot.mentorId,mentorName:slot.mentorName,timezone:slot.timezone,dateKey,ranges:[],slots:[slot]})
  }

  for(const group of groups.values()){
    group.slots.sort((a,b)=>new Date(a.start).getTime()-new Date(b.start).getTime())
    const mentor=mentorById.get(group.mentorId)
    if(!mentor)continue
    group.ranges=mergeRanges(mentor.availability.filter(range=>
      dateKeyInTimeZone(range.start,group.timezone)===group.dateKey&&group.slots.some(slot=>slotInsideRange(slot,range))
    ))
  }

  return [...groups.values()].sort((a,b)=>new Date(a.slots[0].start).getTime()-new Date(b.slots[0].start).getTime()||a.mentorName.localeCompare(b.mentorName,'id-ID')||a.mentorId.localeCompare(b.mentorId))
}
