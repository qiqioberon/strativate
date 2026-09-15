import assert from 'node:assert/strict'
import test from 'node:test'
const load = async () => import('../lib/calendar/merge.ts').catch(() => null)

test('calendar merge keeps Strativate canonical and deduplicates the mirrored Google event', async () => {
 const mod=await load(); assert.ok(mod,'calendar merge module must exist')
 const result=mod.mergeCalendarEvents([{id:'session-1',source:'strativate',title:'Private Mentoring',start:'2026-09-20T02:00:00Z',end:'2026-09-20T03:15:00Z',googleEventId:'abc123',googleICalUid:'uid@google'}],[{id:'abc123',source:'google',title:'Strativate Private Mentoring',start:'2026-09-20T02:00:00Z',end:'2026-09-20T03:15:00Z',iCalUID:'uid@google',strativateSessionId:'session-1'}])
 assert.equal(result.length,1); assert.equal(result[0].source,'strativate')
})

test('calendar merge preserves unrelated personal Google events', async () => {
 const mod=await load(); assert.ok(mod,'calendar merge module must exist')
 const result=mod.mergeCalendarEvents([], [{id:'personal',source:'google',title:'Personal',start:'2026-09-20T05:00:00Z',end:'2026-09-20T06:00:00Z'}])
 assert.equal(result.length,1); assert.equal(result[0].id,'personal')
})
