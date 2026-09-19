import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read=(path:string)=>readFileSync(path,'utf8')

test('notification bell is unread-only while history keeps read filters and structured deep-links',()=>{
  const bell=read('components/dashboard/dashboard-topbar-actions.tsx')
  const history=read('components/dashboard/notification-center.tsx')
  const mentee=read('app/dashboard/dashboard-client.tsx')
  const mentor=read('components/mentor/mentor-dashboard-client.tsx')
  const admin=read('app/admin/page.tsx')
  assert.match(bell,/\.is\('read_at',null\)/)
  assert.match(bell,/setNotifications\(current=>current\.filter/)
  assert.match(bell,/Tidak ada notifikasi baru/)
  assert.match(history,/type ReadFilter = 'all' \| 'unread' \| 'read'/)
  assert.match(history,/CATEGORY_TYPES/)
  assert.match(history,/\.not\('read_at','is',null\)/)
  assert.match(history,/Muat lebih banyak/)
  for(const source of [mentee,mentor,admin])assert.match(source,/related_entity_id|relatedTarget|focusSessionId/)
})

test('user order history is a compact searchable filterable paginated table with pending checkout',()=>{
  const source=read('components/commerce/user-order-history.tsx')
  assert.match(source,/data-testid="user-order-table"/)
  assert.match(source,/type="search"/)
  assert.match(source,/pending_payment/)
  assert.match(source,/item_kind_snapshot/)
  assert.match(source,/TablePagination/)
  assert.match(source,/pageSize/)
  assert.match(source,/Lanjutkan Pembayaran/)
  assert.match(source,/Lihat Detail/)
})

test('mentee mentoring is table-centric with session IDs, Zoom actions, detail and explicit edit state',()=>{
  const source=read('components/dashboard/private-mentoring-sessions.tsx')
  assert.match(source,/data-testid="mentee-mentoring-session-table"/)
  assert.match(source,/Session ID/)
  assert.match(source,/CopyTextButton/)
  assert.match(source,/Join Zoom/)
  assert.match(source,/editingTopic/)
  assert.match(source,/Edit topik sesi/)
  assert.match(source,/Ajukan perubahan topik/)
  assert.match(source,/TablePagination/)
})

test('mentee sidebar removes support and credit card while retaining canonical WhatsApp contact',()=>{
  const source=read('app/dashboard/dashboard-client.tsx')
  assert.doesNotMatch(source,/id: 'support'|section==='support'|>Dukungan</)
  assert.doesNotMatch(source,/credit-box/)
  assert.match(source,/publicContact\.whatsapp/)
  assert.match(source,/dashboard-whatsapp-fab/)
})

test('mentor assignments expose canonical Session ID search and direct Zoom copy actions',()=>{
  const source=read('components/mentor/dashboard/mentor-assignments.tsx')
  const detail=read('components/mentor/dashboard/mentor-detail-dialogs.tsx')
  assert.match(source,/session\.session_id/)
  assert.match(source,/placeholder="Session ID/)
  assert.match(source,/Join|>Zoom</)
  assert.match(source,/CopyTextButton/)
  assert.match(detail,/Session ID/)
  assert.match(detail,/Join Zoom/)
})

test('admin mentoring defaults to read-only sections and uses explicit edit save cancel states',()=>{
  const management=read('components/admin/private-mentoring-enrollment-management.tsx')
  const operations=read('components/admin/private-mentoring-session-operations.tsx')
  assert.match(operations,/admin-readonly-grid/)
  assert.match(operations,/editing/)
  assert.match(management,/editingPrimaryMentor/)
  assert.match(management,/editingTopics/)
  assert.match(management,/Simpan topik\/scope/)
  assert.match(management,/ops-reset-action/)
  assert.match(management,/Session ID/)
})

test('meeting override semantics are explicit and retry preserves override',()=>{
  const source=read('components/admin/private-mentoring-session-operations.tsx')
  assert.match(source,/Override link meeting/)
  assert.match(source,/Simpan Override/)
  assert.match(source,/Kembalikan ke Zoom/)
  assert.match(source,/Sinkronkan ulang Zoom \+ Kalender/)
  assert.match(source,/JSON\.stringify\(\{url:null\}\)/)
  assert.match(source,/Retry sync akan mempertahankan override/)
})

test('provider errors are humanized while routes keep server-side diagnostic logs',()=>{
  const helper=read('lib/operations/provider-errors.ts')
  const sync=read('app/api/admin/private-mentoring/sessions/[id]/sync/route.ts')
  const meeting=read('app/api/admin/private-mentoring/sessions/[id]/meeting/route.ts')
  assert.match(helper,/Konfigurasi Zoom belum tersedia/)
  assert.match(helper,/Cloud recording Zoom tidak tersedia/)
  assert.match(helper,/Google Calendar belum berhasil disinkronkan/)
  assert.match(sync,/console\.error/)
  assert.match(meeting,/console\.error/)
  assert.match(sync,/humanizeProviderError/)
})

test('Zoom creation explicitly requests cloud recording and PATCH does not rewrite auto recording',()=>{
  const source=read('lib/zoom/server.ts')
  assert.match(source,/meetingBody\(value,'cloud'\)/)
  assert.match(source,/auto_recording:autoRecording/)
  assert.match(source,/meetingUpdateBody\(value\)/)
  const update=source.slice(source.indexOf('function meetingUpdateBody'),source.indexOf('async function mark'))
  assert.doesNotMatch(update,/auto_recording/)
  assert.match(source,/recordingStatus='unavailable'/)
})

test('Google Calendar remains event synchronization only and includes mentee plus mentor attendees',()=>{
  const source=read('lib/google-calendar/server.ts')
  assert.match(source,/attendees:\[context\.menteeEmail, context\.mentorEmail/)
  assert.doesNotMatch(source,/createConference|conferenceData|hangoutLink|hangoutsMeet/)
})

test('admin Session ID search stays canonical and admin-only',()=>{
  const migration=read('supabase/migrations/202609200001_admin_session_tracking_search.sql')
  assert.match(migration,/search_session\.id::text ilike/)
  assert.match(migration,/search_session\.enrollment_id = e\.id/)
  assert.match(migration,/if not public\.is_admin\(\)/)
  assert.doesNotMatch(migration,/create table/)
})
