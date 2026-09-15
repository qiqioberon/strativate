import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path:string) => readFileSync(path,'utf8')

test('admin scheduling explains mentor eligibility and keeps declared availability visible',()=>{
  const server=read('lib/private-mentoring/scheduling-server.ts')
  const dialog=read('components/admin/admin-schedule-dialog.tsx')
  assert.match(server,/requiredTierName/)
  assert.match(server,/Belum ada mentor aktif dengan tier/)
  assert.match(server,/belum memasang availability/)
  assert.match(server,/Availability ditemukan, tetapi belum ada slot/)
  assert.match(dialog,/Mentor sesuai tier/)
  assert.match(dialog,/schedule-mentor-card/)
  assert.match(dialog,/schedule-availability-chip/)
  assert.doesNotMatch(dialog,/datetime-local/)
})

test('Google verification failure does not discard mentor availability',()=>{
  const server=read('lib/private-mentoring/scheduling-server.ts')
  assert.match(server,/resolveGoogleCalendarBusy/)
  assert.match(server,/Slot tetap dihitung dari availability mentor dan sesi Strativate/)
  assert.doesNotMatch(server,/Google Calendar belum dapat diverifikasi[\s\S]{0,300}continue/)
})

test('schedule dialog filters future availability by week and day and exposes Google verification state',()=>{
  const dialog=read('components/admin/admin-schedule-dialog.tsx')
  assert.match(dialog,/schedule-filter-bar/)
  assert.match(dialog,/availabilityMatchesFilters/)
  assert.match(dialog,/Minggu ini & depan/)
  assert.match(dialog,/Semua hari/)
  assert.match(dialog,/googleCalendarStatus/)
  assert.match(dialog,/Availability yang sudah lewat disembunyikan otomatis/)
})

test('mentoring session and scheduling dialogs have dedicated responsive polish loaded after calendar styles',()=>{
  const layout=read('app/layout.tsx')
  assert.equal(existsSync('app/admin-mentoring-scheduling.css'),true)
  const css=read('app/admin-mentoring-scheduling.css')
  assert.match(layout,/calendar-integration\.css[\s\S]*admin-mentoring-scheduling\.css/)
  assert.match(css,/\.mentoring-enrollment-page\s*>\s*dialog\.calendar-dialog:not\(\.schedule-dialog\)/)
  assert.match(css,/\.schedule-dialog__summary/)
  assert.match(css,/\.schedule-mentor-card/)
  assert.match(css,/@media\s*\(max-width:\s*760px\)/)
})

test('mentor availability and session actions are compact and scrollable',()=>{
  const css=read('app/admin-mentoring-scheduling.css')
  assert.match(css,/schedule-availability-scroll[\s\S]*?max-height:[^;}]+;[\s\S]*?overflow-y:auto/)
  assert.match(css,/schedule-mentor-grid[\s\S]*?max-height:[^;}]+;[\s\S]*?overflow:auto/)
  assert.match(css,/button-row \.button\{[\s\S]*?min-height:34px[\s\S]*?padding:7px 11px/)
  assert.match(css,/mentoring-session-detail-row>\.ops-status\{[\s\S]*?align-self:start/)
})
