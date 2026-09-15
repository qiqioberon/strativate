export type StrativateCalendarEvent = {
  id: string
  source: 'strativate'
  title: string
  start: string
  end: string
  googleEventId?: string | null
  googleICalUid?: string | null
  [key: string]: unknown
}
export type GoogleCalendarEvent = {
  id: string
  source: 'google'
  title: string
  start: string
  end: string
  iCalUID?: string | null
  strativateSessionId?: string | null
  [key: string]: unknown
}
export type CalendarEvent = StrativateCalendarEvent | GoogleCalendarEvent

export function mergeCalendarEvents(strativate: StrativateCalendarEvent[], google: GoogleCalendarEvent[]): CalendarEvent[] {
  const sessionIds = new Set(strativate.map(event => event.id))
  const googleIds = new Set(strativate.flatMap(event => event.googleEventId ? [event.googleEventId] : []))
  const iCalUids = new Set(strativate.flatMap(event => event.googleICalUid ? [event.googleICalUid] : []))
  const personal = google.filter(event => {
    if (event.strativateSessionId && sessionIds.has(event.strativateSessionId)) return false
    if (googleIds.has(event.id)) return false
    if (event.iCalUID && iCalUids.has(event.iCalUID)) return false
    return true
  })
  return [...strativate, ...personal].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}
