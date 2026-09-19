import assert from 'node:assert/strict'
import test from 'node:test'
const load=async()=>import('../lib/google-calendar/sync.ts').catch(()=>null)

function fixture(overrides:any={}) {
 return {
  sessionId:'123e4567-e89b-12d3-a456-426614174000',
  calendarId:'primary',
  eventId:null,
  summary:'Strativate Private Mentoring — Business Analysis & Case Structuring',
  description:'Session 3/10',
  start:'2026-09-22T06:00:00.000Z',
  end:'2026-09-22T07:15:00.000Z',
  attendees:['mentee@example.com','mentor@example.com'],
  manualMeetingUrl:null,
  providerMeetingUrl:'https://zoom.us/j/123456789',
  ...overrides,
 }
}

test('first sync creates one deterministic Calendar event without conference creation and retry updates the same event',async()=>{
 const mod=await load();assert.ok(mod)
 const calls:any[]=[]
 const provider={upsertEvent:async(input:any)=>{calls.push(input);return{eventId:input.eventId,iCalUID:'ical-1',meetingUrl:null}}}
 const first=await mod.syncSessionEvent(fixture(),provider)
 const second=await mod.syncSessionEvent(fixture({eventId:first.eventId}),provider)
 assert.equal(first.eventId,second.eventId)
 assert.equal(first.meetingUrl,'https://zoom.us/j/123456789')
 assert.equal(first.effectiveMeetingUrl,'https://zoom.us/j/123456789')
 assert.equal(calls.length,2)
 assert.equal(calls[0].createEvent,true)
 assert.equal(calls[1].createEvent,false)
 assert.equal('createConference' in calls[0],false)
 assert.equal('createConference' in calls[1],false)
})

test('reschedule and mentor change patch same Calendar event identity and preserve Zoom URL',async()=>{
 const mod=await load();assert.ok(mod)
 const calls:any[]=[]
 const provider={upsertEvent:async(input:any)=>{calls.push(input);return{eventId:input.eventId,iCalUID:'ical-1',meetingUrl:null}}}
 const result=await mod.syncSessionEvent(fixture({eventId:'fixed123',start:'2026-09-23T07:00:00.000Z',end:'2026-09-23T08:15:00.000Z',attendees:['mentee@example.com','mentor2@example.com']}),provider)
 assert.equal(calls[0].eventId,'fixed123')
 assert.equal(calls[0].createEvent,false)
 assert.equal('createConference' in calls[0],false)
 assert.deepEqual(calls[0].attendees,['mentee@example.com','mentor2@example.com'])
 assert.equal(result.effectiveMeetingUrl,'https://zoom.us/j/123456789')
})

test('manual meeting override wins without replacing provider identity',async()=>{
 const mod=await load();assert.ok(mod)
 assert.equal(mod.resolveMeetingUrl('https://zoom.us/j/provider','https://custom.example/room'),'https://custom.example/room')
 assert.equal(mod.resolveMeetingUrl('https://zoom.us/j/provider',null),'https://zoom.us/j/provider')
})

test('Calendar response cannot resurrect a Google Meet URL over the Zoom provider URL',async()=>{
 const mod=await load();assert.ok(mod)
 const provider={upsertEvent:async(input:any)=>({eventId:input.eventId,iCalUID:'ical-legacy',meetingUrl:'https://meet.google.com/legacy-only'})}
 const result=await mod.syncSessionEvent(fixture({eventId:'legacy123'}),provider)
 assert.equal(result.meetingUrl,'https://zoom.us/j/123456789')
 assert.equal(result.effectiveMeetingUrl,'https://zoom.us/j/123456789')
})

test('provider errors surface for caller to persist failed sync state',async()=>{
 const mod=await load();assert.ok(mod)
 const provider={upsertEvent:async()=>{throw new Error('calendar unavailable')}}
 await assert.rejects(()=>mod.syncSessionEvent(fixture(),provider),/calendar unavailable/)
})

test('scheduled retry never asks Google to generate a conference when Zoom URL is temporarily missing',async()=>{
 const mod=await load();assert.ok(mod)
 const calls:any[]=[]
 const provider={upsertEvent:async(input:any)=>{calls.push(input);return{eventId:input.eventId,iCalUID:'ical-pending',meetingUrl:null}}}
 const result=await mod.syncSessionEvent(fixture({eventId:'fixed123',providerMeetingUrl:null}),provider)
 assert.equal(calls[0].createEvent,false)
 assert.equal('createConference' in calls[0],false)
 assert.equal(result.meetingUrl,null)
})

test('Google cancellation URL targets exact calendar/event and sends attendee updates',async()=>{
 const mod=await load();assert.ok(mod)
 assert.equal(mod.googleEventDeleteUrl('https://www.googleapis.com/calendar/v3',{calendarId:'team/calendar@example.com',eventId:'event id'}),'https://www.googleapis.com/calendar/v3/calendars/team%2Fcalendar%40example.com/events/event%20id?sendUpdates=all')
})

test('404 and 410 deletion responses are recognized as already absent while unrelated failures are not hidden',async()=>{
 const mod=await load();assert.ok(mod)
 assert.equal(mod.isGoogleEventAlreadyAbsent(new Error('gone (status 404)')),true)
 assert.equal(mod.isGoogleEventAlreadyAbsent(new Error('gone (status 410)')),true)
 assert.equal(mod.isGoogleEventAlreadyAbsent(new Error('forbidden (status 403)')),false)
})

test('cancelling a synced session deletes existing Calendar event identity',async()=>{
 const mod=await load();assert.ok(mod)
 const calls:any[]=[];const provider={deleteEvent:async(input:any)=>{calls.push(input)}}
 const result=await mod.cancelSessionEvent({calendarId:'primary',eventId:'existing-event'},provider)
 assert.deepEqual(calls,[{calendarId:'primary',eventId:'existing-event'}])
 assert.deepEqual(result,{eventId:'existing-event',alreadyAbsent:false})
})

test('cancelling without Calendar event id converges without calling provider',async()=>{
 const mod=await load();assert.ok(mod)
 let deletes=0;const provider={deleteEvent:async()=>{deletes++}}
 const result=await mod.cancelSessionEvent({calendarId:'primary',eventId:null},provider)
 assert.equal(deletes,0);assert.deepEqual(result,{eventId:null,alreadyAbsent:true})
})

test('cancelled retry only reconciles deletion and never recreates event',async()=>{
 const mod=await load();assert.ok(mod)
 let upserts=0;const deletes:any[]=[]
 const provider={upsertEvent:async()=>{upserts++;throw new Error('must not upsert')},deleteEvent:async(input:any)=>{deletes.push(input)}}
 const result=await mod.reconcileSessionEvent('cancelled',fixture({eventId:'fixed123'}),provider)
 assert.equal(result.kind,'cancelled');assert.equal(upserts,0);assert.deepEqual(deletes,[{calendarId:'primary',eventId:'fixed123'}])
})
