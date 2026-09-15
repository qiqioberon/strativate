import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path:string) => { assert.equal(existsSync(path), true, `${path} must exist`); return readFileSync(path,'utf8') }
const migrationPath='supabase/migrations/202609160001_private_mentoring_session_cancellation.sql'

test('cancellation uses a forward-only migration with admin-only idempotent row-locked transition',()=>{
  const sql=read(migrationPath)
  assert.match(sql,/cancelled/i)
  assert.match(sql,/admin_cancel_private_mentoring_session/i)
  assert.match(sql,/for update/i)
  assert.match(sql,/if v_session\.status = 'cancelled'[\s\S]*return v_session/i)
  assert.match(sql,/completed sessions cannot be cancelled/i)
  assert.match(sql,/only a scheduled session can be cancelled/i)
  assert.match(sql,/if not public\.is_admin\(\)/i)
  assert.match(sql,/sync_status in \('pending', 'synced', 'failed', 'cancelled'\)/i)
})

test('cancelled sessions stay historical but disappear from active calendar and meeting projections',()=>{
  const sql=read(migrationPath)
  assert.match(sql,/case when s\.status = 'cancelled' then null else coalesce\(ci\.manual_meeting_url, ci\.provider_meeting_url\) end/i)
  assert.match(sql,/where s\.status <> 'cancelled'/i)
  const calendar=read('lib/calendar/server.ts')
  assert.match(calendar,/row\.status !== 'cancelled'/)
  const dashboard=read('components/dashboard/private-mentoring-sessions.tsx')
  assert.match(dashboard,/status === 'cancelled'.*Dibatalkan/)
  assert.match(dashboard,/scheduledStartAt && session\.status !== 'cancelled'/)
})

test('Google provider deletes with sendUpdates all, treats 404 and 410 as converged, and retry dispatches on canonical status',()=>{
  const sync=read('lib/google-calendar/sync.ts')
  const server=read('lib/google-calendar/server.ts')
  assert.match(sync,/sendUpdates:'all'/)
  assert.match(sync,/status \(\?:404\|410\)/)
  assert.match(sync,/if \(status === 'cancelled'\)[\s\S]*return \{ kind:'cancelled'/)
  assert.match(server,/method:'DELETE'/)
  assert.match(server,/sync_status:'cancelled'/)
  assert.match(server,/sync_status:'failed'/)
  assert.match(server,/meetingUrl:null/)
})

test('admin cancellation route and UI require confirmation and preserve honest partial-failure UX',()=>{
  const route=read('app/api/admin/private-mentoring/sessions/[id]/cancel/route.ts')
  const ui=read('components/admin/private-mentoring-enrollment-management.tsx')
  assert.match(route,/profile\.role!=='admin'/)
  assert.match(route,/cancelAdminPrivateMentoringSession/)
  assert.match(ui,/Batalkan sesi/)
  assert.match(ui,/Konfirmasi pembatalan/)
  assert.match(ui,/undangan Google Calendar terkait akan dibatalkan/)
  assert.match(ui,/Mentor dan mentee mungkin menerima update pembatalan dari Google/)
  assert.match(ui,/Sesi sudah dibatalkan di Strativate, tetapi Google Calendar belum berhasil disinkronkan\. Coba ulangi sinkronisasi\./)
  assert.match(ui,/Sinkronkan pembatalan/)
  assert.doesNotMatch(ui,/window\.confirm/)
})

test('cancelled sessions cannot be scheduled again and generated types include cancellation states',()=>{
  const scheduling=read('lib/private-mentoring/scheduling-server.ts')
  const databaseTypes=read('lib/supabase/database.types.ts')
  const domainTypes=read('lib/private-mentoring/types.ts')
  assert.match(scheduling,/context\.status==='cancelled'/)
  assert.match(databaseTypes,/PrivateMentoringSessionStatus = 'awaiting_focus'\|'awaiting_scheduling'\|'scheduled'\|'completed'\|'cancelled'/)
  assert.match(databaseTypes,/admin_cancel_private_mentoring_session/)
  assert.match(domainTypes,/\|'cancelled'/)
})

test('database regression suite exercises authorization, idempotency, nonblocking slots, overlap protection and meeting hiding',()=>{
  const sql=read('supabase/tests/private_mentoring_cancellation.sql')
  for(const phrase of [
    'non-admin cannot cancel a scheduled session',
    'repeated cancellation is idempotent',
    'cancelled sessions no longer block mentor Strativate availability',
    'scheduled/completed overlap protection still rejects active mentor conflicts',
    'completed sessions cannot be cancelled',
    'cancelled mentee history does not expose an active meeting URL',
  ]) assert.match(sql,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'))
})
