import assert from 'node:assert/strict'
import test from 'node:test'

const load = async () => import('../lib/private-mentoring/scheduling-availability.ts').catch(() => null)

test('Google FreeBusy failure keeps declared availability eligible with an explicit unavailable verification state', async () => {
  const mod = await load(); assert.ok(mod, 'scheduling availability helper must exist')
  assert.deepEqual(mod.resolveGoogleCalendarBusy({ connected:true, busy:null }), {
    googleBusy:[],
    status:'unavailable',
  })
  assert.deepEqual(mod.resolveGoogleCalendarBusy({ connected:false, busy:null }), {
    googleBusy:[],
    status:'not_connected',
  })
})

test('availability filters hide past windows and separate current versus next week and weekday', async () => {
  const mod = await load(); assert.ok(mod, 'scheduling availability helper must exist')
  const now = new Date('2026-09-16T05:00:00.000Z')
  const mondayPast = { start:'2026-09-14T01:00:00.000Z', end:'2026-09-14T05:00:00.000Z' }
  const thursday = { start:'2026-09-17T02:00:00.000Z', end:'2026-09-17T04:00:00.000Z' }
  const nextMonday = { start:'2026-09-21T02:00:00.000Z', end:'2026-09-21T04:00:00.000Z' }

  assert.equal(mod.availabilityMatchesFilters(mondayPast,'Asia/Jakarta',now,'all',null),false)
  assert.equal(mod.availabilityMatchesFilters(thursday,'Asia/Jakarta',now,'current',4),true)
  assert.equal(mod.availabilityMatchesFilters(thursday,'Asia/Jakarta',now,'next',4),false)
  assert.equal(mod.availabilityMatchesFilters(nextMonday,'Asia/Jakarta',now,'next',1),true)
  assert.equal(mod.availabilityMatchesFilters(nextMonday,'Asia/Jakarta',now,'next',2),false)
  assert.equal(mod.availabilityWeekKind(thursday.start,'Asia/Jakarta',now),'current')
  assert.equal(mod.availabilityWeekKind(nextMonday.start,'Asia/Jakarta',now),'next')
})
