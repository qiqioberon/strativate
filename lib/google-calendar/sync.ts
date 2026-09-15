export type SessionSyncInput = {
  sessionId: string
  calendarId: string
  eventId: string | null
  summary: string
  description: string
  start: string
  end: string
  attendees: string[]
  manualMeetingUrl: string | null
  providerMeetingUrl?: string | null
}
export type UpsertEventInput = Omit<SessionSyncInput, 'manualMeetingUrl' | 'providerMeetingUrl'> & { eventId: string; createConference: boolean }
export type DeleteEventInput = { calendarId: string; eventId: string }
export type ProviderEvent = { eventId: string; iCalUID: string | null; meetingUrl: string | null }
export type EventUpsertProvider = { upsertEvent(input: UpsertEventInput): Promise<ProviderEvent> }
export type EventDeleteProvider = { deleteEvent(input: DeleteEventInput): Promise<void> }
export type CalendarProvider = EventUpsertProvider & EventDeleteProvider

export function deterministicGoogleEventId(sessionId: string) {
  const normalized = sessionId.toLowerCase().replace(/[^0-9a-v]/g, '')
  if (normalized.length < 5) throw new Error('Session id cannot produce a valid Google Calendar event id.')
  return `strativate${normalized}`
}

export function resolveMeetingUrl(providerMeetingUrl: string | null, manualMeetingUrl: string | null) {
  return manualMeetingUrl || providerMeetingUrl
}

export function googleEventDeleteUrl(calendarApi: string, input: DeleteEventInput) {
  return `${calendarApi}/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}?${new URLSearchParams({ sendUpdates:'all' })}`
}

export function isGoogleEventAlreadyAbsent(error: unknown) {
  return error instanceof Error && /\(status (?:404|410)\)/.test(error.message)
}

export async function syncSessionEvent(input: SessionSyncInput, provider: EventUpsertProvider): Promise<ProviderEvent & { effectiveMeetingUrl: string | null }> {
  const eventId = input.eventId || deterministicGoogleEventId(input.sessionId)
  const result = await provider.upsertEvent({
    sessionId: input.sessionId,
    calendarId: input.calendarId,
    eventId,
    summary: input.summary,
    description: input.description,
    start: input.start,
    end: input.end,
    attendees: [...new Set(input.attendees.filter(Boolean))],
    createConference: !input.eventId || !input.providerMeetingUrl,
  })
  const providerMeetingUrl = result.meetingUrl || input.providerMeetingUrl || null
  return { ...result, meetingUrl: providerMeetingUrl, effectiveMeetingUrl: resolveMeetingUrl(providerMeetingUrl, input.manualMeetingUrl) }
}

export async function cancelSessionEvent(input: { calendarId:string; eventId:string|null }, provider: EventDeleteProvider) {
  if (!input.eventId) return { eventId:null, alreadyAbsent:true }
  await provider.deleteEvent({ calendarId:input.calendarId, eventId:input.eventId })
  return { eventId:input.eventId, alreadyAbsent:false }
}

export async function reconcileSessionEvent(status: string, input: SessionSyncInput, provider: CalendarProvider) {
  if (status === 'cancelled') {
    const cancelled = await cancelSessionEvent({ calendarId:input.calendarId, eventId:input.eventId }, provider)
    return { kind:'cancelled' as const, ...cancelled }
  }
  const synced = await syncSessionEvent(input, provider)
  return { kind:'upserted' as const, ...synced }
}
