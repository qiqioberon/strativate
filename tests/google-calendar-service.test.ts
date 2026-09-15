import assert from 'node:assert/strict'
import test from 'node:test'
const load=async()=>import('../lib/google-calendar/sync.ts').catch(()=>null)

function fixture(overrides:any={}) { return {sessionId:'123e4567-e89b-12d3-a456-426614174000',calendarId:'primary',eventId:null,summary:'Strativate Private Mentoring — Business Analysis & Case Structuring',description:'Session 3/10',start:'2026-09-22T06:00:00.000Z',end:'2026-09-22T07:15:00.000Z',attendees:['mentee@example.com','mentor@example.com'],manualMeetingUrl:null,...overrides} }

test('first sync creates one deterministic event with Google Meet and retry updates the same event', async()=>{
 const mod=await load(); assert.ok(mod,'sync module must exist')
 const calls:any[]=[]; const provider={upsertEvent:async(input:any)=>{calls.push(input);return {eventId:input.eventId,iCalUID:'ical-1',meetingUrl:'https://meet.google.com/abc-defg-hij'}}}
 const first=await mod.syncSessionEvent(fixture(),provider)
 const second=await mod.syncSessionEvent(fixture({eventId:first.eventId,providerMeetingUrl:first.meetingUrl}),provider)
 assert.equal(first.eventId,second.eventId); assert.equal(calls.length,2); assert.equal(calls[0].createConference,true); assert.equal(calls[1].createConference,false)
})

test('reschedule and mentor change patch the same event identity with changed attendees', async()=>{
 const mod=await load(); assert.ok(mod,'sync module must exist')
 const calls:any[]=[]; const provider={upsertEvent:async(input:any)=>{calls.push(input);return {eventId:input.eventId,iCalUID:'ical-1',meetingUrl:'https://meet.google.com/abc-defg-hij'}}}
 await mod.syncSessionEvent(fixture({eventId:'fixed123',providerMeetingUrl:'https://meet.google.com/abc-defg-hij',start:'2026-09-23T07:00:00.000Z',end:'2026-09-23T08:15:00.000Z',attendees:['mentee@example.com','mentor2@example.com']}),provider)
 assert.equal(calls[0].eventId,'fixed123'); assert.deepEqual(calls[0].attendees,['mentee@example.com','mentor2@example.com']); assert.equal(calls[0].createConference,false)
})

test('manual meeting override wins without replacing provider Meet identity', async()=>{
 const mod=await load(); assert.ok(mod,'sync module must exist')
 assert.equal(mod.resolveMeetingUrl('https://meet.google.com/provider','https://zoom.us/j/123'),'https://zoom.us/j/123')
 assert.equal(mod.resolveMeetingUrl('https://meet.google.com/provider',null),'https://meet.google.com/provider')
})

test('provider errors surface for caller to persist failed sync state', async()=>{
 const mod=await load(); assert.ok(mod,'sync module must exist')
 const provider={upsertEvent:async()=>{throw new Error('calendar unavailable')}}
 await assert.rejects(()=>mod.syncSessionEvent(fixture(),provider),/calendar unavailable/)
})

test('reschedule preserves the existing generated Meet URL when Google omits conference data in the patch response', async()=>{
 const mod=await load(); assert.ok(mod,'sync module must exist')
 const provider={upsertEvent:async(input:any)=>({eventId:input.eventId,iCalUID:'ical-1',meetingUrl:null})}
 const result=await mod.syncSessionEvent(fixture({eventId:'fixed123',providerMeetingUrl:'https://meet.google.com/keep-this'}),provider)
 assert.equal(result.meetingUrl,'https://meet.google.com/keep-this')
 assert.equal(result.effectiveMeetingUrl,'https://meet.google.com/keep-this')
})


test('retry requests conference creation again when the event exists but Meet is still missing', async()=>{
 const mod=await load(); assert.ok(mod,'sync module must exist')
 const calls:any[]=[]; const provider={upsertEvent:async(input:any)=>{calls.push(input);return {eventId:input.eventId,iCalUID:'ical-pending',meetingUrl:null}}}
 await mod.syncSessionEvent(fixture({eventId:'fixed123',providerMeetingUrl:null}),provider)
 assert.equal(calls[0].eventId,'fixed123')
 assert.equal(calls[0].createConference,true)
})
