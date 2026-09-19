'use client'

import { MentoringWorkspace } from '@/components/dashboard/mentoring-workspace'
import type { PrivateMentoringSessionFocusView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'
import type { IntensiveEngagementView } from '@/lib/intensive-mentoring/types'

const focuses: PrivateMentoringSessionFocusView[] = [
  {
    id: '81000000-0000-0000-0000-000000000001',
    code: 'IDEA_PROBLEM_FRAMING',
    slug: 'idea-problem-framing',
    name: 'Idea & Problem Framing',
    description: 'Fixture focus',
    sortOrder: 10,
  },
]

const sessions: PrivateMentoringSessionView[] = [
  {
    sessionId: '82000000-0000-0000-0000-000000000001',
    enrollmentId: '83000000-0000-0000-0000-000000000001',
    sessionNumber: 1,
    status: 'completed',
    sessionFocusId: focuses[0].id,
    focusName: focuses[0].name,
    requestedFocusId: focuses[0].id,
    menteeTopicRequest: 'Validasi problem dan target pengguna.',
    topicStatus: 'confirmed',
    resolvedTopic: 'Idea & Problem Framing',
    mentorId: '84000000-0000-0000-0000-000000000001',
    mentorName: 'Mentor Fixture',
    primaryMentorId: null,
    primaryMentorName: null,
    scheduledStartAt: '2026-09-10T02:00:00.000Z',
    scheduledEndAt: '2026-09-10T03:15:00.000Z',
    mentorTierCode: 'TOP_STUDENT',
    mentorTierName: 'Top Student',
    packageId: '85000000-0000-0000-0000-000000000001',
    purchasedSessions: 3,
    mentorTimezone: 'Asia/Jakarta',
    durationMinutes: 75,
    meetingUrl: null,
    googleEventId: 'event-1',
    googleICalUid: 'ical-1',
    googleSyncStatus: 'synced',
  },
  {
    sessionId: '82000000-0000-0000-0000-000000000002',
    enrollmentId: '83000000-0000-0000-0000-000000000001',
    sessionNumber: 2,
    status: 'scheduled',
    sessionFocusId: focuses[0].id,
    focusName: focuses[0].name,
    requestedFocusId: focuses[0].id,
    menteeTopicRequest: 'Review hipotesis utama.',
    topicStatus: 'confirmed',
    resolvedTopic: 'Review hipotesis utama',
    mentorId: '84000000-0000-0000-0000-000000000001',
    mentorName: 'Mentor Fixture',
    primaryMentorId: null,
    primaryMentorName: null,
    scheduledStartAt: '2026-09-24T02:00:00.000Z',
    scheduledEndAt: '2026-09-24T03:15:00.000Z',
    mentorTierCode: 'TOP_STUDENT',
    mentorTierName: 'Top Student',
    packageId: '85000000-0000-0000-0000-000000000001',
    purchasedSessions: 3,
    mentorTimezone: 'Asia/Jakarta',
    durationMinutes: 75,
    meetingUrl: 'https://zoom.us/j/fixture',
    googleEventId: 'event-2',
    googleICalUid: 'ical-2',
    googleSyncStatus: 'synced',
  },
  {
    sessionId: '82000000-0000-0000-0000-000000000003',
    enrollmentId: '83000000-0000-0000-0000-000000000001',
    sessionNumber: 3,
    status: 'awaiting_focus',
    sessionFocusId: null,
    focusName: null,
    requestedFocusId: null,
    menteeTopicRequest: null,
    topicStatus: 'needs_input',
    resolvedTopic: null,
    mentorId: null,
    mentorName: null,
    primaryMentorId: null,
    primaryMentorName: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    mentorTierCode: 'TOP_STUDENT',
    mentorTierName: 'Top Student',
    packageId: '85000000-0000-0000-0000-000000000001',
    purchasedSessions: 3,
    mentorTimezone: null,
    durationMinutes: 75,
    meetingUrl: null,
    googleEventId: null,
    googleICalUid: null,
    googleSyncStatus: 'pending',
  },
]


sessions.push({
  ...sessions[2],
  sessionId:'82000000-0000-0000-0000-000000000004',
  enrollmentId:'83000000-0000-0000-0000-000000000002',
  sessionNumber:1,
  purchasedSessions:1,
  mentorTierCode:'SEMI_PRO',
  mentorTierName:'Semi Pro',
})

const intensiveEngagements: IntensiveEngagementView[] = [{
  engagementId:'93000000-0000-0000-0000-000000000001',
  baseEntitlementId:'93000000-0000-0000-0000-000000000002',
  baseKind:'bundle',
  programName:'Bundel Competition Ready',
  status:'active',
  baselineSessionsPerMonth:8,
  primaryMentorId:'84000000-0000-0000-0000-000000000001',
  primaryMentorName:'Mentor Fixture',
  competitionName:'National Business Case Competition',
  programStage:'review_refinement',
  progressSummary:'Fokus minggu ini adalah penyempurnaan storyline dan kesiapan Q&A.',
  startedAt:'2026-09-01T00:00:00.000Z',
  addOns:[
    {entitlementId:null,name:'Laporan Performa Terperinci',code:'DETAILED_PERFORMANCE_REPORT',status:'included',source:'bundle'},
    {entitlementId:null,name:'Simulasi Penjurian',code:'JUDGING_SIMULATION',status:'included',source:'bundle'},
  ],
  sessions:[{
    sessionId:'94000000-0000-0000-0000-000000000001',sessionNumber:1,durationMinutes:60,status:'scheduled',
    focusId:focuses[0].id,focusName:focuses[0].name,menteeTopicRequest:'Review final storyline dan anticipated Q&A.',topicStatus:'confirmed',resolvedTopic:'Final storyline & Q&A',mentorId:'84000000-0000-0000-0000-000000000001',mentorName:'Mentor Fixture',scheduledStartAt:'2026-09-26T02:00:00.000Z',scheduledEndAt:'2026-09-26T03:00:00.000Z',meetingUrl:'https://zoom.us/j/intensive-fixture',googleSyncStatus:'synced',recordingStatus:'expected',creationSource:'admin_added'
  }]
}]

export default function MentoringProfessionalizationFixture() {
  return <main style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}><MentoringWorkspace privateSessions={sessions} intensiveEngagements={intensiveEngagements} sessionFocuses={focuses}/></main>
}
