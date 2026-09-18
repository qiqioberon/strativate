import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import type { AppRole } from '@/lib/supabase/database.types'
import { decryptGoogleCredential, encryptGoogleCredential } from './crypto'
import {
  googleEventDeleteUrl,
  isGoogleEventAlreadyAbsent,
  reconcileSessionEvent,
  type CalendarProvider,
  type DeleteEventInput,
  type UpsertEventInput,
} from './sync'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const BASE_SCOPES = ['openid', 'email']

export type GoogleConnectionStatus = {
  connected: boolean
  accountEmail: string | null
  status: 'connected' | 'invalid' | 'disconnected' | 'not_connected'
  scopes: string[]
  lastError: string | null
}

type ConnectionRow = {
  user_id: string; account_email: string; calendar_id: string; granted_scopes: string[];
  encrypted_refresh_token: string | null; status: 'connected'|'invalid'|'disconnected'; last_error: string|null
}
type GoogleTokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }
type GoogleEventApi = {
  id: string; iCalUID?: string; summary?: string; htmlLink?: string; hangoutLink?: string;
  start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }>; createRequest?: { status?: { statusCode?: string } } };
  extendedProperties?: { private?: Record<string,string> }
}

function config() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Google Calendar OAuth is not configured on the server.')
  return { clientId, clientSecret, redirectUri }
}
function safeReturnPath(value: string | null | undefined) { return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/' }
function sha256(value: string) { return createHash('sha256').update(value).digest('hex') }
function base64UrlSha256(value: string) { return createHash('sha256').update(value).digest('base64url') }
function db() { return createAdminClient() as any }
function scopesForRole(role: AppRole) {
  if (role === 'admin') return [...BASE_SCOPES, 'https://www.googleapis.com/auth/calendar.events']
  if (role === 'mentor') return [...BASE_SCOPES, 'https://www.googleapis.com/auth/calendar.events.readonly', 'https://www.googleapis.com/auth/calendar.freebusy']
  return [...BASE_SCOPES, 'https://www.googleapis.com/auth/calendar.events.readonly', 'https://www.googleapis.com/auth/calendar.freebusy']
}
async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  const parsed = text ? JSON.parse(text) : {}
  if (!response.ok) {
    const detail = parsed.error_description || parsed.error?.message || parsed.error || 'Google request failed'
    throw new Error(`${detail} (status ${response.status})`)
  }
  return parsed as T
}
async function connectionRow(userId: string): Promise<ConnectionRow | null> {
  const { data, error } = await db().from('google_calendar_connections').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error('Google Calendar connection could not be loaded.')
  return data as ConnectionRow | null
}

export async function getGoogleConnectionStatus(userId: string): Promise<GoogleConnectionStatus> {
  const row = await connectionRow(userId)
  if (!row) return { connected:false, accountEmail:null, status:'not_connected', scopes:[], lastError:null }
  return { connected:row.status === 'connected' && Boolean(row.encrypted_refresh_token), accountEmail:row.account_email, status:row.status, scopes:row.granted_scopes ?? [], lastError:row.last_error }
}

export async function beginGoogleCalendarOAuth(userId: string, role: AppRole, returnPath?: string | null) {
  const { clientId, redirectUri } = config()
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const challenge = base64UrlSha256(verifier)
  const { error } = await db().from('google_calendar_oauth_states').insert({ state_hash:sha256(state), user_id:userId, role, code_verifier:verifier, return_path:safeReturnPath(returnPath), expires_at:new Date(Date.now()+10*60_000).toISOString() })
  if (error) throw new Error('Google Calendar authorization state could not be created.')
  const params = new URLSearchParams({ client_id:clientId, redirect_uri:redirectUri, response_type:'code', scope:scopesForRole(role).join(' '), access_type:'offline', include_granted_scopes:'true', prompt:'consent', state, code_challenge:challenge, code_challenge_method:'S256' })
  return `${AUTH_URL}?${params.toString()}`
}

export async function googleCalendarOAuthReturnPath(userId: string, state: string | null) {
  if (!state) return null
  const { data } = await db().from('google_calendar_oauth_states').select('return_path,expires_at').eq('state_hash', sha256(state)).eq('user_id', userId).maybeSingle()
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null
  return safeReturnPath(data.return_path)
}

export async function completeGoogleCalendarOAuth(userId: string, state: string, code: string) {
  const stateHash = sha256(state)
  const admin = db()
  const { data: oauthState, error: stateError } = await admin.from('google_calendar_oauth_states').select('*').eq('state_hash', stateHash).eq('user_id', userId).maybeSingle()
  if (stateError || !oauthState || oauthState.used_at || new Date(oauthState.expires_at).getTime() <= Date.now()) throw new Error('Google Calendar authorization state is invalid or expired.')
  const { data: claimedState, error: claimError } = await admin.from('google_calendar_oauth_states').update({ used_at:new Date().toISOString() }).eq('state_hash', stateHash).is('used_at', null).select('state_hash').maybeSingle()
  if (claimError || !claimedState) throw new Error('Google Calendar authorization state has already been used.')

  const { clientId, clientSecret, redirectUri } = config()
  const tokenResponse = await fetch(TOKEN_URL, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({ client_id:clientId, client_secret:clientSecret, code, code_verifier:oauthState.code_verifier, grant_type:'authorization_code', redirect_uri:redirectUri }) })
  const tokens = await responseJson<GoogleTokenResponse>(tokenResponse)
  if (!tokens.access_token) throw new Error('Google did not return an access token.')
  const userInfo = await responseJson<{email?:string}>(await fetch(USERINFO_URL, { headers:{authorization:`Bearer ${tokens.access_token}`} }))
  if (!userInfo.email) throw new Error('Google account email could not be read.')
  const previous = await connectionRow(userId)
  const refreshToken = tokens.refresh_token || (previous?.encrypted_refresh_token ? decryptGoogleCredential(previous.encrypted_refresh_token) : null)
  if (!refreshToken) throw new Error('Google did not return a refresh token. Disconnect access in your Google Account, then reconnect.')
  const scopes = (tokens.scope || scopesForRole(oauthState.role as AppRole).join(' ')).split(/\s+/).filter(Boolean)
  const now = new Date().toISOString()
  const payload = { user_id:userId, account_email:userInfo.email.toLowerCase(), calendar_id:'primary', granted_scopes:scopes, encrypted_refresh_token:encryptGoogleCredential(refreshToken), status:'connected', connected_at:now, refreshed_at:now, revoked_at:null, last_error:null }
  const { error: saveError } = await admin.from('google_calendar_connections').upsert(payload, { onConflict:'user_id' })
  if (saveError) throw new Error('Google Calendar connection could not be saved.')
  return safeReturnPath(oauthState.return_path)
}

async function markConnectionInvalid(userId: string, message: string) {
  await db().from('google_calendar_connections').update({ status:'invalid', encrypted_refresh_token:null, last_error:message, refreshed_at:new Date().toISOString() }).eq('user_id', userId)
}

async function accessToken(userId: string) {
  const row = await connectionRow(userId)
  if (!row || row.status !== 'connected' || !row.encrypted_refresh_token) throw new Error('Google Calendar is not connected.')
  const { clientId, clientSecret } = config()
  const response = await fetch(TOKEN_URL, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({ client_id:clientId, client_secret:clientSecret, grant_type:'refresh_token', refresh_token:decryptGoogleCredential(row.encrypted_refresh_token) }) })
  try {
    const tokens = await responseJson<GoogleTokenResponse>(response)
    if (!tokens.access_token) throw new Error('Google access token was not returned.')
    await db().from('google_calendar_connections').update({ refreshed_at:new Date().toISOString(), last_error:null }).eq('user_id', userId)
    return { token:tokens.access_token, calendarId:row.calendar_id }
  } catch (error) {
    if (response.status === 400 || response.status === 401) await markConnectionInvalid(userId, 'Google authorization expired or was revoked. Please reconnect.')
    throw error
  }
}

export async function disconnectGoogleCalendar(userId: string) {
  const row = await connectionRow(userId)
  if (row?.encrypted_refresh_token) {
    try { await fetch(REVOKE_URL, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({ token:decryptGoogleCredential(row.encrypted_refresh_token) }) }) } catch { /* local disconnect still proceeds */ }
  }
  if (row) await db().from('google_calendar_connections').update({ status:'disconnected', encrypted_refresh_token:null, revoked_at:new Date().toISOString(), last_error:null }).eq('user_id', userId)
}

async function googleFetch<T>(userId: string, url: string, init?: RequestInit): Promise<T> {
  const { token } = await accessToken(userId)
  const headers = new Headers(init?.headers); headers.set('authorization', `Bearer ${token}`); if (init?.body) headers.set('content-type','application/json')
  return responseJson<T>(await fetch(url, { ...init, headers }))
}

export async function listPersonalGoogleEvents(userId: string, start: string, end: string) {
  const status = await getGoogleConnectionStatus(userId)
  if (!status.connected) return []
  const row = await connectionRow(userId); if (!row) return []
  const params = new URLSearchParams({ timeMin:new Date(start).toISOString(), timeMax:new Date(end).toISOString(), singleEvents:'true', orderBy:'startTime', maxResults:'2500' })
  const result = await googleFetch<{items?:GoogleEventApi[]}>(userId, `${CALENDAR_API}/calendars/${encodeURIComponent(row.calendar_id)}/events?${params}`)
  return (result.items ?? []).flatMap(event => {
    const eventStart = event.start?.dateTime || (event.start?.date ? `${event.start.date}T00:00:00.000Z` : null)
    const eventEnd = event.end?.dateTime || (event.end?.date ? `${event.end.date}T00:00:00.000Z` : null)
    if (!eventStart || !eventEnd) return []
    return [{ id:event.id, source:'google' as const, title:event.summary || '(Tanpa judul)', start:eventStart, end:eventEnd, iCalUID:event.iCalUID ?? null, htmlLink:event.htmlLink ?? null, strativateSessionId:event.extendedProperties?.private?.strativateSessionId ?? null }]
  })
}

export async function getGoogleFreeBusy(userId: string, start: string, end: string) {
  const status = await getGoogleConnectionStatus(userId)
  if (!status.connected) return []
  const row = await connectionRow(userId); if (!row) return []
  const result = await googleFetch<{calendars?:Record<string,{busy?:Array<{start:string;end:string}>}>}>(userId, `${CALENDAR_API}/freeBusy`, { method:'POST', body:JSON.stringify({timeMin:new Date(start).toISOString(),timeMax:new Date(end).toISOString(),items:[{id:row.calendar_id}]}) })
  return result.calendars?.[row.calendar_id]?.busy ?? []
}

function meetingUrl(event: GoogleEventApi) {
  return event.hangoutLink || event.conferenceData?.entryPoints?.find(entry => entry.entryPointType === 'video')?.uri || null
}

export class GoogleCalendarRestProvider implements CalendarProvider {
  constructor(private organizerUserId: string) {}
  async upsertEvent(input: UpsertEventInput) {
    const body: Record<string,unknown> = {
      id: input.eventId,
      summary: input.summary,
      description: input.description,
      start: { dateTime:input.start }, end:{ dateTime:input.end },
      attendees: input.attendees.map(email => ({email})),
      extendedProperties:{ private:{ strativateSessionId:input.sessionId } },
    }
    if (input.createConference) body.conferenceData = { createRequest:{ requestId:`strativate-${input.sessionId}-${Date.now()}`, conferenceSolutionKey:{type:'hangoutsMeet'} } }
    const query = new URLSearchParams({ conferenceDataVersion:'1', sendUpdates:'all' })
    const base = `${CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events`
    if (input.createEvent) {
      try {
        const created = await googleFetch<GoogleEventApi>(this.organizerUserId, `${base}?${query}`, {method:'POST',body:JSON.stringify(body)})
        return {eventId:created.id,iCalUID:created.iCalUID ?? null,meetingUrl:meetingUrl(created)}
      } catch (error) {
        if (!(error instanceof Error) || !/409|already exists|duplicate/i.test(error.message)) throw error
      }
    }
    const { id: _id, ...patchBody } = body
    const updated = await googleFetch<GoogleEventApi>(this.organizerUserId, `${base}/${encodeURIComponent(input.eventId)}?${query}`, {method:'PATCH',body:JSON.stringify(patchBody)})
    return {eventId:updated.id,iCalUID:updated.iCalUID ?? null,meetingUrl:meetingUrl(updated)}
  }
  async deleteEvent(input: DeleteEventInput) {
    try {
      await googleFetch<void>(this.organizerUserId, googleEventDeleteUrl(CALENDAR_API, input), { method:'DELETE' })
    } catch (error) {
      if (isGoogleEventAlreadyAbsent(error)) return
      throw error
    }
  }
}

type SyncContext = {sessionId:string;sessionNumber:number;purchasedSessions:number;status:string;focusName:string|null;start:string|null;end:string|null;menteeEmail:string;mentorEmail:string|null;organizerUserId:string|null;calendarId:string;eventId:string|null;iCalUID:string|null;providerMeetingUrl:string|null;manualMeetingUrl:string|null}
export async function syncPrivateMentoringSession(sessionId: string, currentAdminId?: string | null) {
  const admin = db()
  const { data, error } = await admin.rpc('service_get_private_mentoring_sync_context', {p_session_id:sessionId})
  if (error || !data) throw new Error(error?.message || 'Session sync context could not be loaded.')
  const context = data as SyncContext
  const organizerUserId = context.organizerUserId || currentAdminId
  if (!organizerUserId) throw new Error('Google Calendar organizer is not available.')
  const cancelled = context.status === 'cancelled'
  if (!cancelled && (!context.start || !context.end || !context.mentorEmail)) throw new Error('Session is not fully scheduled.')
  const integration = admin.from('private_mentoring_session_calendar_integrations')
  await integration.upsert({session_id:sessionId,organizer_user_id:organizerUserId,google_calendar_id:context.calendarId||'primary',sync_status:'pending',sync_error:null},{onConflict:'session_id'})
  try {
    const result = await reconcileSessionEvent(context.status, {
      sessionId,
      calendarId:context.calendarId||'primary',
      eventId:context.eventId,
      summary:`Strativate Private Mentoring — ${context.focusName || 'Mentoring Session'}`,
      description:`Session ${context.sessionNumber}/${context.purchasedSessions}\nStrativate Private Mentoring\nMeeting: ${context.manualMeetingUrl || context.providerMeetingUrl || 'pending'}\nSession reference: ${sessionId}`,
      start:context.start || '',
      end:context.end || '',
      attendees:[context.menteeEmail, context.mentorEmail || ''],
      manualMeetingUrl:context.manualMeetingUrl,
      providerMeetingUrl:context.providerMeetingUrl,
    }, new GoogleCalendarRestProvider(organizerUserId))
    if (result.kind === 'cancelled') {
      await integration.update({organizer_user_id:organizerUserId,sync_status:'cancelled',sync_error:null,last_synced_at:new Date().toISOString()}).eq('session_id',sessionId)
      return {status:'cancelled' as const,meetingUrl:null,eventId:context.eventId}
    }
    const persistedProviderMeetingUrl = result.meetingUrl || context.providerMeetingUrl
    const effectiveMeetingUrl = context.manualMeetingUrl || persistedProviderMeetingUrl
    const syncStatus = effectiveMeetingUrl ? 'synced' : 'pending'
    await integration.update({organizer_user_id:organizerUserId,google_event_id:result.eventId,google_ical_uid:result.iCalUID,provider_meeting_url:persistedProviderMeetingUrl,sync_status:syncStatus,sync_error:null,last_synced_at:new Date().toISOString()}).eq('session_id',sessionId)
    return {status:syncStatus,meetingUrl:result.effectiveMeetingUrl,eventId:result.eventId}
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Calendar synchronization failed.'
    await integration.update({sync_status:'failed',sync_error:message,last_synced_at:new Date().toISOString()}).eq('session_id',sessionId)
    return {status:'failed' as const,meetingUrl:cancelled ? null : context.manualMeetingUrl || context.providerMeetingUrl,error:message,eventId:context.eventId}
  }
}

export async function setManualMeetingUrl(sessionId: string, url: string | null) {
  if (url) {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') throw new Error('Meeting link must use HTTPS.')
  }
  const { error } = await db().from('private_mentoring_session_calendar_integrations').update({manual_meeting_url:url}).eq('session_id',sessionId)
  if (error) throw new Error('Meeting link could not be updated.')
}
