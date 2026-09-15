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
export type ProviderEvent = { eventId: string; iCalUID: string | null; meetingUrl: string | null }
export type CalendarProvider = { upsertEvent(input: UpsertEventInput): Promise<ProviderEvent> }

export function deterministicGoogleEventId(sessionId: string) {
  const normalized = sessionId.toLowerCase().replace(/[^0-9a-v]/g, '')
  if (normalized.length < 5) throw new Error('Session id cannot produce a valid Google Calendar event id.')
  return `strativate${normalized}`
}

export function resolveMeetingUrl(providerMeetingUrl: string | null, manualMeetingUrl: string | null) {
  return manualMeetingUrl || providerMeetingUrl
}

export async function syncSessionEvent(input: SessionSyncInput, provider: CalendarProvider): Promise<ProviderEvent & { effectiveMeetingUrl: string | null }> {
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
