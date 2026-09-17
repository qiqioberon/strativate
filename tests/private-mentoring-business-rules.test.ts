import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root=process.cwd()
const read=(path:string)=>readFileSync(join(root,path),'utf8')
const migrationPath='supabase/migrations/202609170003_private_mentoring_stakeholder_rules.sql'

test('forward migration separates topic review from lifecycle and preserves audit history',()=>{
  const sql=read(migrationPath)
  assert.match(sql,/topic_status[\s\S]{0,240}needs_input[\s\S]{0,240}pending_review[\s\S]{0,240}confirmed/i)
  assert.match(sql,/private_mentoring_session_topic_events/i)
  assert.match(sql,/submit_private_mentoring_topic_request/i)
  assert.match(sql,/admin_resolve_private_mentoring_session_topic/i)
  assert.match(sql,/Session topic must be confirmed before scheduling/i)
  assert.match(sql,/Completed and cancelled session topics are immutable/i)
})

test('five-or-more-session enrollments use an audited primary mentor while smaller packages remain flexible',()=>{
  const sql=read(migrationPath)
  assert.match(sql,/primary_mentor_id/i)
  assert.match(sql,/private_mentoring_primary_mentor_changes/i)
  assert.match(sql,/purchased_sessions\s*>=\s*5/i)
  assert.match(sql,/admin_set_private_mentoring_primary_mentor/i)
  assert.match(sql,/Mentor tier does not match purchased package/i)
  assert.match(sql,/purchased_sessions\s*<\s*5/i)
})

test('Intensive fixed catalog participates in Shared Commerce and paid fulfillment',()=>{
  const sql=read(migrationPath)
  assert.match(sql,/intensive_mentoring_entitlements/i)
  assert.match(sql,/intensive_mentoring_package/i)
  assert.match(sql,/intensive_mentoring_bundle/i)
  assert.match(sql,/intensive_mentoring_add_on/i)
  assert.match(sql,/pricing_mode='fixed'/i)
  assert.match(sql,/fulfill_paid_intensive_mentoring_order/i)
  assert.match(sql,/order_item_id uuid not null unique/i)
})

test('mentee and admin UIs expose request-review-resolve flow and dedicated mentor control',()=>{
  const mentee=read('components/dashboard/private-mentoring-sessions.tsx')
  const admin=read('components/admin/private-mentoring-enrollment-management.tsx')
  assert.match(mentee,/Apa yang ingin kamu bahas/i)
  assert.match(mentee,/submit_private_mentoring_topic_request/i)
  assert.match(mentee,/opsional/i)
  assert.match(admin,/admin_resolve_private_mentoring_session_topic/i)
  assert.match(admin,/admin_set_private_mentoring_primary_mentor/i)
  assert.match(admin,/Ganti mentor/i)
})

test('Calendar sync context uses resolved topic and existing sync implementation PATCHes the same event identity',()=>{
  const sql=read(migrationPath)
  const sync=read('lib/google-calendar/sync.ts')
  assert.match(sql,/'focusName',coalesce\(s\.resolved_topic,f\.name\)/i)
  assert.match(sql,/'eventId',ci\.google_event_id/i)
  assert.match(sync,/method:\s*'PATCH'/)
  assert.match(sync,/eventId/i)
})

test('mentor projection includes resolved topic and mentor-visible scope notes without exposing audit tables',()=>{
  const sql=read(migrationPath)
  const detail=read('components/mentor/dashboard/mentor-detail-dialogs.tsx')
  const mentorProjection=sql.match(/create function public\.list_my_mentor_private_mentoring_sessions\(\)[\s\S]*?\$\$;/i)?.[0]??''
  assert.match(mentorProjection,/resolved_topic/i)
  assert.match(mentorProjection,/mentor_scope_notes/i)
  assert.doesNotMatch(mentorProjection,/private_mentoring_session_topic_events/i)
  assert.match(detail,/Catatan scope dari admin/i)
})
