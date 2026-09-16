import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path:string) => readFileSync(path,'utf8')

test('admin scheduling explains mentor eligibility and renders only final bookable day cards',()=>{
  const server=read('lib/private-mentoring/scheduling-server.ts')
  const dialog=read('components/admin/admin-schedule-dialog.tsx')
  assert.match(server,/requiredTierName/)
  assert.match(server,/Belum ada mentor aktif dengan tier/)
  assert.match(server,/belum memasang availability/)
  assert.match(server,/Availability ditemukan, tetapi belum ada slot/)
  assert.match(dialog,/Mentor sesuai tier/)
  assert.match(dialog,/buildBookableMentorDays/)
  assert.match(dialog,/schedule-mentor-card/)
  assert.match(dialog,/schedule-day-card/)
  assert.match(dialog,/day\.ranges\.map/)
  assert.doesNotMatch(dialog,/datetime-local/)
  assert.doesNotMatch(dialog,/slot aktual|belum ada slot aktual|slot siap/i)
})

test('Google verification failure does not discard mentor availability',()=>{
  const server=read('lib/private-mentoring/scheduling-server.ts')
  assert.match(server,/resolveGoogleCalendarBusy/)
  assert.match(server,/Slot tetap dihitung dari availability mentor dan sesi Strativate/)
  assert.doesNotMatch(server,/Google Calendar belum dapat diverifikasi[\s\S]{0,300}continue/)
})

test('schedule dialog filters final bookable slots and gates exact slots behind mentor-day selection',()=>{
  const dialog=read('components/admin/admin-schedule-dialog.tsx')
  assert.match(dialog,/schedule-filter-bar/)
  assert.match(dialog,/type="search"[\s\S]*type="date"[\s\S]*type="time"/)
  assert.match(dialog,/buildBookableMentorDays/)
  assert.match(dialog,/googleCalendarStatus/)
  assert.match(dialog,/selectedDay\?<section className="schedule-slot-panel"/)
  assert.match(dialog,/selectedDay\.slots\.map/)
  assert.match(dialog,/selectedDayKey&&!bookableDays\.some[\s\S]*setSelectedDayKey\(null\)[\s\S]*setSelected\(null\)/)
  assert.match(dialog,/function resetFilters\(\)\{setMentorQuery\(''\);setDateFilter\(''\);setTimeStart\(''\);setTimeEnd\(''\)\}/)
  assert.doesNotMatch(dialog,/Minggu ini & depan|Semua hari/)
})

test('mentoring session and scheduling dialogs have dedicated responsive polish loaded after calendar styles',()=>{
  const layout=read('app/layout.tsx')
  const browserFixtureLayout=read('tests/fixtures/carousel-interaction/app/layout.tsx')
  assert.equal(existsSync('app/admin-mentoring-scheduling.css'),true)
  const css=read('app/admin-mentoring-scheduling.css')
  assert.match(layout,/calendar-integration\.css[\s\S]*admin-mentoring-scheduling\.css/)
  assert.match(browserFixtureLayout,/calendar-integration\.css[\s\S]*admin-mentoring-scheduling\.css/)
  assert.match(css,/\.mentoring-enrollment-page\s*>\s*dialog\.calendar-dialog:not\(\.schedule-dialog\)/)
  assert.match(css,/\.schedule-dialog__summary/)
  assert.match(css,/\.schedule-filter-bar/)
  assert.match(css,/\.schedule-mentor-card/)
  assert.match(css,/\.schedule-day-card/)
  assert.match(css,/@media\s*\(max-width:\s*760px\)/)
})

test('schedule dialog keeps one primary vertical scroll surface while day cards and session actions stay compact',()=>{
  const css=read('app/admin-mentoring-scheduling.css')
  assert.match(css,/\.schedule-dialog\{[^}]*max-height:min\(calc\(100dvh - 28px\),920px\);[^}]*overflow:hidden/)
  assert.match(css,/\.schedule-dialog__body\{[^}]*overflow-x:hidden;overflow-y:auto;[^}]*overscroll-behavior:contain/)
  assert.match(css,/\.schedule-dialog__body\{[^}]*grid-auto-rows:max-content;align-content:start/)
  assert.match(css,/\.schedule-availability-panel,\.schedule-slot-panel\{min-height:max-content;[^}]*overflow:hidden/)
  assert.match(css,/\.schedule-mentor-grid\{[^}]*align-items:start/)
  assert.doesNotMatch(css,/\.schedule-mentor-grid\{[^}]*max-height:/)
  assert.match(css,/\.schedule-mentor-days\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(css,/\.schedule-day-card__ranges\{[^}]*display:flex;flex-wrap:wrap/)
  assert.match(css,/\.schedule-slots--selected-day\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/)
  assert.match(css,/\.schedule-mentor-identity strong,\.schedule-mentor-identity small\{display:block;overflow-wrap:anywhere\}/)
  assert.doesNotMatch(css,/\.schedule-mentor-identity strong,\.schedule-mentor-identity small\{[^}]*text-overflow:ellipsis/)
  assert.match(css,/button-row \.button\{[\s\S]*?min-height:34px[\s\S]*?padding:7px 11px/)
  assert.match(css,/mentoring-session-detail-row>\.ops-status\{[\s\S]*?align-self:start/)
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.schedule-mentor-days\{grid-template-columns:minmax\(0,1fr\)\}[\s\S]*?\.schedule-slots--selected-day\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
})
