export type PrivateMentoringOrderedContent = {
  id: string
  name?: string
  title?: string
  text?: string
  description?: string
  sortOrder: number
}

export type PrivateMentoringPackageView = {
  id: string
  mentorTierId: string
  mentorTierCode: string
  mentorTierName: string
  sessionCount: number
  priceAmount: number
  referencePriceAmount: number | null
  pricePerSession: number
  durationMinutes: number
  maxParticipants: number
  sortOrder: number
}

export type PrivateMentoringPublicView = {
  id: string
  slug: 'private-mentoring'
  title: string
  shortDescription: string
  kicker: string
  detail: string
  audience: string
  highlights: Array<{ id: string; text: string; sortOrder: number }>
  journeySteps: Array<{ id: string; title: string; description: string; sortOrder: number }>
  learningPaths: Array<{ id: string; code: string; slug: string; name: string; description: string; sortOrder: number }>
  sessionFocuses: Array<{ id: string; code: string; slug: string; name: string; description: string; sortOrder: number }>
  competitionCategories: Array<{ id: string; code: string; slug: string; name: string; sortOrder: number }>
  packages: PrivateMentoringPackageView[]
}

export type PrivateMentoringSessionView = {
  sessionId: string
  enrollmentId: string
  sessionNumber: number
  status: 'awaiting_focus' | 'awaiting_scheduling' | 'scheduled' | 'completed'
  sessionFocusId: string | null
  focusName: string | null
  mentorId: string | null
  mentorName: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  mentorTierCode: string
  mentorTierName: string
  packageId: string
  purchasedSessions: number
}
