import assert from 'node:assert/strict'
import test from 'node:test'

const load = async () => import('../lib/calendar/slot-engine.ts').catch(() => null)

test('slot engine returns only same-tier active mentors and respects duration inside declared availability', async () => {
  const mod = await load(); assert.ok(mod, 'slot engine module must exist')
  const slots = mod.buildBookableSlots({
    now: '2026-09-15T01:00:00.000Z', durationMinutes: 75, requiredTierId: 'tier-a', stepMinutes: 15,
    mentors: [
      { mentorId:'a', mentorName:'Mentor A', tierId:'tier-a', active:true, timezone:'Asia/Jakarta', availability:[{start:'2026-09-15T02:00:00.000Z',end:'2026-09-15T05:00:00.000Z'}], strativateBusy:[], googleBusy:[] },
      { mentorId:'b', mentorName:'Mentor B', tierId:'tier-b', active:true, timezone:'Asia/Jakarta', availability:[{start:'2026-09-15T02:00:00.000Z',end:'2026-09-15T05:00:00.000Z'}], strativateBusy:[], googleBusy:[] },
      { mentorId:'c', mentorName:'Mentor C', tierId:'tier-a', active:false, timezone:'Asia/Jakarta', availability:[{start:'2026-09-15T02:00:00.000Z',end:'2026-09-15T05:00:00.000Z'}], strativateBusy:[], googleBusy:[] },
    ]
  })
  assert.ok(slots.length > 0)
  assert.deepEqual([...new Set(slots.map((slot:any) => slot.mentorId))], ['a'])
  assert.equal(new Date(slots[0].end).getTime() - new Date(slots[0].start).getTime(), 75 * 60_000)
})

test('slot engine excludes Strativate and Google busy overlaps while keeping touching boundaries bookable', async () => {
  const mod = await load(); assert.ok(mod, 'slot engine module must exist')
  const slots = mod.buildBookableSlots({
    now:'2026-09-15T00:00:00.000Z', durationMinutes:60, requiredTierId:'tier-a', stepMinutes:60,
    mentors:[{mentorId:'a',mentorName:'A',tierId:'tier-a',active:true,timezone:'Asia/Jakarta',availability:[{start:'2026-09-15T01:00:00.000Z',end:'2026-09-15T06:00:00.000Z'}],strativateBusy:[{start:'2026-09-15T02:00:00.000Z',end:'2026-09-15T03:00:00.000Z'}],googleBusy:[{start:'2026-09-15T04:00:00.000Z',end:'2026-09-15T05:00:00.000Z'}]}]
  })
  assert.deepEqual(slots.map((slot:any) => slot.start), ['2026-09-15T01:00:00.000Z','2026-09-15T03:00:00.000Z','2026-09-15T05:00:00.000Z'])
})

test('slot engine never emits a slot in the past', async () => {
  const mod = await load(); assert.ok(mod, 'slot engine module must exist')
  const slots = mod.buildBookableSlots({now:'2026-09-15T03:30:00.000Z',durationMinutes:60,requiredTierId:'tier-a',stepMinutes:30,mentors:[{mentorId:'a',mentorName:'A',tierId:'tier-a',active:true,timezone:'Asia/Jakarta',availability:[{start:'2026-09-15T01:00:00.000Z',end:'2026-09-15T06:00:00.000Z'}],strativateBusy:[],googleBusy:[]}]})
  assert.ok(slots.every((slot:any) => new Date(slot.start).getTime() >= new Date('2026-09-15T03:30:00.000Z').getTime()))
})

test('slot stepping is anchored to the mentor declared availability start', async () => {
  const mod = await load(); assert.ok(mod, 'slot engine module must exist')
  const slots = mod.buildBookableSlots({
    now: '2026-09-22T02:11:00.000Z', durationMinutes: 60, requiredTierId: 'tier-a', stepMinutes: 15,
    mentors: [{ mentorId:'m1', mentorName:'Mentor A', tierId:'tier-a', active:true, timezone:'Asia/Jakarta', availability:[{start:'2026-09-22T02:10:00.000Z',end:'2026-09-22T04:25:00.000Z'}], strativateBusy:[], googleBusy:[] }]
  })
  assert.equal(slots[0]?.start, '2026-09-22T02:25:00.000Z')
})

test('calendar date keys respect the mentor timezone instead of UTC date boundaries', async () => {
  const mod = await load(); assert.ok(mod, 'slot engine module must exist')
  assert.equal(mod.dateKeyInTimeZone('2026-09-21T17:30:00.000Z', 'Asia/Jakarta'), '2026-09-22')
})
