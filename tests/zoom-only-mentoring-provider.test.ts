import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { verifyZoomWebhook, zoomValidationToken } from '../lib/zoom/webhook'

const read=(path:string)=>readFileSync(path,'utf8')
const migrationPath='supabase/migrations/202609190002_zoom_only_mentoring_provider.sql'

test('forward migration converts active legacy rows to Zoom and makes the provider constraint Zoom-only',()=>{
 const sql=read(migrationPath)
 assert.match(sql,/s\.status not in \('completed','cancelled'\)/)
 assert.match(sql,/meeting_provider='zoom'/)
 for(const field of ['provider_meeting_id=null','provider_meeting_url=null','provider_host_id=null',"provider_sync_status='pending'",'provider_sync_error=null','provider_sync_started_at=null',"recording_status='expected'"]) assert.ok(sql.includes(field),field)
 const constraint=sql.match(/add constraint private_mentoring_meeting_provider_check[\s\S]*?;/i)?.[0]??''
 assert.match(constraint,/meeting_provider is null or meeting_provider='zoom'/)
 assert.doesNotMatch(constraint,/google_meet|manual/)
})

test('historical completed or cancelled legacy sessions are inactive without destroying audit provider URLs',()=>{
 const sql=read(migrationPath)
 const marker=sql.indexOf("s.status in ('completed','cancelled')")
 const historical=sql.slice(sql.lastIndexOf('update public.private_mentoring_session_calendar_integrations ci',marker),sql.indexOf('alter table public.private_mentoring_session_calendar_integrations',marker))
 assert.ok(marker>=0&&historical)
 assert.match(historical,/meeting_provider=null/)
 assert.doesNotMatch(historical,/provider_meeting_url=null/)
 assert.match(sql,/if v_status in \('completed','cancelled'\) then[\s\S]*?return 'inactive'/)
 const zoom=read('lib/zoom/server.ts')
 assert.ok(zoom.indexOf("value.status==='completed'") < zoom.indexOf('service_claim_zoom_meeting_creation'))
})

test('Zoom reconciliation is mandatory, idempotent, and reschedule reuses the same meeting',()=>{
 const zoom=read('lib/zoom/server.ts')
 const scheduling=read('lib/private-mentoring/scheduling-server.ts')
 const migration=read(migrationPath)
 assert.doesNotMatch(zoom,/google_meet|return \{status:'ready'.*legacy/)
 assert.doesNotMatch(migration,/return 'legacy'/)
 assert.ok(scheduling.indexOf('reconcileZoomMeeting(sessionId)') < scheduling.indexOf('syncPrivateMentoringSession(sessionId,currentAdminId)'))
 assert.match(zoom,/claim\.data==='update'&&value\.providerMeetingId/)
 assert.match(zoom,/\/meetings\/\$\{encodeURIComponent\(value\.providerMeetingId\)\}[\s\S]*?method:'PATCH'/)
 assert.match(migration,/if v_row\.provider_meeting_id is not null and v_row\.meeting_provider='zoom' then[\s\S]*?return 'update'/)
})

test('Google Calendar sync never creates conferencing and cannot replace the Zoom URL',()=>{
 const sync=read('lib/google-calendar/sync.ts')
 const server=read('lib/google-calendar/server.ts')
 assert.doesNotMatch(sync,/createConference|conferenceData|hangoutsMeet/)
 assert.doesNotMatch(server,/createConference|conferenceData|hangoutLink|hangoutsMeet/)
 assert.match(sync,/const providerMeetingUrl = input\.providerMeetingUrl \|\| null/)
 assert.match(server,/const persistedProviderMeetingUrl = context\.providerMeetingUrl/)
 assert.match(server,/Meeting:/)
})

test('Zoom webhook validation runs before signature verification and database access with correct HMAC',()=>{
 process.env.ZOOM_WEBHOOK_SECRET_TOKEN='zoom-only-test-secret'
 assert.equal(zoomValidationToken('plain-token'),createHmac('sha256','zoom-only-test-secret').update('plain-token').digest('hex'))
 const route=read('app/api/webhooks/zoom/route.ts')
 assert.match(route,/export const runtime = 'nodejs'/)
 const validation=route.indexOf("body?.event==='endpoint.url_validation'")
 const signature=route.indexOf('verifyZoomWebhook',route.indexOf('export async function POST'))
 const database=route.indexOf('createAdminClient()',route.indexOf('export async function POST'))
 assert.ok(validation>=0&&signature>validation&&database>signature)
 assert.match(route,/x-zm-request-timestamp/)
 assert.match(route,/x-zm-signature/)
})

test('normal Zoom webhook signature remains authenticated and rejects stale events',()=>{
 process.env.ZOOM_WEBHOOK_SECRET_TOKEN='zoom-only-test-secret'
 const raw=JSON.stringify({event:'meeting.started',payload:{object:{id:123}}})
 const timestamp=Math.floor(Date.now()/1000).toString()
 const signature='v0='+createHmac('sha256','zoom-only-test-secret').update('v0:'+timestamp+':'+raw).digest('hex')
 assert.equal(verifyZoomWebhook(raw,timestamp,signature),true)
 const stale=(Math.floor(Date.now()/1000)-301).toString()
 const staleSignature='v0='+createHmac('sha256','zoom-only-test-secret').update('v0:'+stale+':'+raw).digest('hex')
 assert.equal(verifyZoomWebhook(raw,stale,staleSignature),false)
})

test('meeting and recording lifecycle events remain handled with webhook deduplication',()=>{
 const route=read('app/api/webhooks/zoom/route.ts')
 for(const event of ["meeting.started","meeting.ended","recording.completed","recording.failed","recording.processing_failed"]) assert.ok(route.includes(event),event)
 assert.match(route,/zoom_webhook_events/)
 assert.match(route,/deduplicated:true/)
 assert.match(route,/recording_status:'processing'/)
 assert.match(route,/recording_status:'available'/)
 assert.match(route,/recording_status:'failed'/)
})

test('admin UI labels Zoom states human-readably and manual reset returns to Zoom',()=>{
 const ui=read('components/admin/private-mentoring-session-operations.tsx')
 const labels=ui+read('lib/operations/provider-errors.ts')
 const sync=read('lib/google-calendar/sync.ts')
 assert.match(ui,/state\.meetingProvider==='zoom'\?'Zoom':'Zoom · menunggu sinkronisasi'/)
 for(const label of ['Siap','Sedang diproses','Recording otomatis diminta','Recording tersedia','Recording tidak tersedia']) assert.ok(labels.includes(label),label)
 assert.match(ui,/Sinkronkan ulang Zoom \+ Kalender/)
 assert.match(ui,/Kembalikan ke Zoom/)
 assert.match(ui,/Override link meeting/)
 assert.match(sync,/return manualMeetingUrl \|\| providerMeetingUrl/)
})

test('server-only Zoom configuration names missing variables without exposing NEXT_PUBLIC credentials',()=>{
 const zoom=read('lib/zoom/server.ts')
 const env=read('.env.example')
 for(const name of ['ZOOM_ACCOUNT_ID','ZOOM_CLIENT_ID','ZOOM_CLIENT_SECRET','ZOOM_DEFAULT_HOST_USER_ID']) assert.ok(zoom.includes(name),name)
 assert.ok(env.includes('ZOOM_WEBHOOK_SECRET_TOKEN'))
 assert.match(zoom,/Missing: \$\{missing\.join\(', '\)\}/)
 assert.doesNotMatch(zoom,/NEXT_PUBLIC_ZOOM/)
 assert.doesNotMatch(env,/NEXT_PUBLIC_ZOOM/)
})

test('historical runtime surfaces do not expose active meeting links',()=>{
 const mentee=read('lib/private-mentoring/server.ts')
 const calendar=read('lib/calendar/server.ts')
 const mentor=read('lib/mentor/dashboard-server.ts')
 const meetingRoute=read('app/api/admin/private-mentoring/sessions/[id]/meeting/route.ts')
 assert.match(mentee,/row\.status==='scheduled'\?row\.meeting_url:null/)
 assert.match(calendar,/row\.status === 'scheduled' \? row\.meeting_url/)
 assert.match(mentor,/meeting_url:session\.status==='scheduled'\?session\.meeting_url:null/)
 assert.match(meetingRoute,/const historical=status==='completed'\|\|status==='cancelled'/)
})
