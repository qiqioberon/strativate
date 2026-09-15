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
