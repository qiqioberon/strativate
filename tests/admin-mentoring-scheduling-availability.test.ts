import assert from 'node:assert/strict'
import test from 'node:test'

const load = async () => import('../lib/private-mentoring/scheduling-availability.ts').catch(() => null)

const mentor={mentorId:'m1',mentorName:'Muhammad Aqil',timezone:'Asia/Jakarta',availability:[
  {start:'2026-09-17T02:00:00.000Z',end:'2026-09-17T04:00:00.000Z'},
  {start:'2026-09-18T02:00:00.000Z',end:'2026-09-18T04:00:00.000Z'},
  {start:'2026-09-18T05:00:00.000Z',end:'2026-09-18T06:00:00.000Z'},
  {start:'2026-09-18T07:00:00.000Z',end:'2026-09-18T09:00:00.000Z'},
  {start:'2026-09-19T02:00:00.000Z',end:'2026-09-19T03:00:00.000Z'},
]}
const slot=(start:string,end:string)=>({mentorId:'m1',mentorName:'Muhammad Aqil',timezone:'Asia/Jakarta',start,end})

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

test('bookable day groups omit zero-slot days and zero-slot availability ranges',async()=>{
  const mod=await load();assert.ok(mod)
  const days=mod.buildBookableMentorDays({
    mentors:[mentor],
    slots:[
      slot('2026-09-18T02:00:00.000Z','2026-09-18T03:15:00.000Z'),
      slot('2026-09-18T07:00:00.000Z','2026-09-18T08:15:00.000Z'),
    ],
    filters:{mentorQuery:'',date:'',timeStart:'',timeEnd:''},
  })
  assert.equal(days.length,1)
  assert.equal(days[0].dateKey,'2026-09-18')
  assert.deepEqual(days[0].ranges,[
    {start:'2026-09-18T02:00:00.000Z',end:'2026-09-18T04:00:00.000Z'},
    {start:'2026-09-18T07:00:00.000Z',end:'2026-09-18T09:00:00.000Z'},
  ])
  assert.equal(days[0].slots.length,2)
})

test('multiple valid ranges on the same mentor day stay in one day group',async()=>{
  const mod=await load();assert.ok(mod)
  const days=mod.buildBookableMentorDays({
    mentors:[mentor],
    slots:[slot('2026-09-18T02:00:00.000Z','2026-09-18T03:15:00.000Z'),slot('2026-09-18T07:00:00.000Z','2026-09-18T08:15:00.000Z')],
    filters:{mentorQuery:'',date:'',timeStart:'',timeEnd:''},
  })
  assert.equal(days.length,1)
  assert.equal(days[0].ranges.length,2)
})

test('mentor, local date, and time filters operate on final bookable slots',async()=>{
  const mod=await load();assert.ok(mod)
  const second={mentorId:'m2',mentorName:'Budi',timezone:'Asia/Jakarta',availability:[{start:'2026-09-18T01:00:00.000Z',end:'2026-09-18T06:00:00.000Z'}]}
  const days=mod.buildBookableMentorDays({
    mentors:[mentor,second],
    slots:[
      slot('2026-09-18T02:00:00.000Z','2026-09-18T03:15:00.000Z'),
      slot('2026-09-18T03:30:00.000Z','2026-09-18T04:45:00.000Z'),
      {mentorId:'m2',mentorName:'Budi',timezone:'Asia/Jakarta',start:'2026-09-18T02:00:00.000Z',end:'2026-09-18T03:15:00.000Z'},
    ],
    filters:{mentorQuery:'aqil',date:'2026-09-18',timeStart:'09:00',timeEnd:'11:00'},
  })
  assert.equal(days.length,1)
  assert.equal(days[0].mentorId,'m1')
  assert.deepEqual(days[0].slots.map((item:{start:string})=>item.start),['2026-09-18T02:00:00.000Z'])
})

test('time filter requires the full appointment duration to fit inside the requested range',async()=>{
  const mod=await load();assert.ok(mod)
  assert.equal(mod.slotMatchesTimeRange(slot('2026-09-18T04:30:00.000Z','2026-09-18T05:45:00.000Z'),'11:00','12:00'),false)
  assert.equal(mod.slotMatchesTimeRange(slot('2026-09-18T04:00:00.000Z','2026-09-18T05:00:00.000Z'),'11:00','12:00'),true)
})

test('overlapping contributing availability ranges are normalized',async()=>{
  const mod=await load();assert.ok(mod)
  const overlapMentor={...mentor,availability:[
    {start:'2026-09-18T02:00:00.000Z',end:'2026-09-18T05:00:00.000Z'},
    {start:'2026-09-18T04:00:00.000Z',end:'2026-09-18T07:00:00.000Z'},
  ]}
  const days=mod.buildBookableMentorDays({mentors:[overlapMentor],slots:[slot('2026-09-18T03:00:00.000Z','2026-09-18T04:15:00.000Z'),slot('2026-09-18T05:00:00.000Z','2026-09-18T06:15:00.000Z')],filters:{mentorQuery:'',date:'',timeStart:'',timeEnd:''}})
  assert.deepEqual(days[0].ranges,[{start:'2026-09-18T02:00:00.000Z',end:'2026-09-18T07:00:00.000Z'}])
})

test('overlapping availability does not duplicate identical bookable slots or inflate slot counts',async()=>{
  const mod=await load();assert.ok(mod)
  const overlapMentor={...mentor,availability:[
    {start:'2026-09-18T02:00:00.000Z',end:'2026-09-18T05:00:00.000Z'},
    {start:'2026-09-18T03:00:00.000Z',end:'2026-09-18T06:00:00.000Z'},
  ]}
  const duplicate=slot('2026-09-18T03:00:00.000Z','2026-09-18T04:15:00.000Z')
  const days=mod.buildBookableMentorDays({mentors:[overlapMentor],slots:[duplicate,{...duplicate}],filters:{mentorQuery:'',date:'',timeStart:'',timeEnd:''}})
  assert.equal(days[0].slots.length,1)
})
