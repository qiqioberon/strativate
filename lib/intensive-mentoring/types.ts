export type IntensiveMentoringFeatureView={id:string;text:string;sortOrder:number}
export type IntensiveMentoringPackageView={id:string;code:string;slug:string;name:string;description:string;competitionScope:'national'|'international';sessionsPerMonth:number|null;pricingMode:'fixed'|'consultation';priceAmount:number|null;referencePriceAmount:number|null;sortOrder:number;features:IntensiveMentoringFeatureView[]}
export type IntensiveMentoringAddOnCatalogView={id:string;code:string;slug:string;name:string;description:string;priceAmount:number;termsNote:string|null;sortOrder:number;features:IntensiveMentoringFeatureView[]}
export type IntensiveMentoringBundleItemView={id:string;itemType:'package'|'add_on'|'feature';label:string;sortOrder:number}
export type IntensiveMentoringBundleView={id:string;code:string;slug:string;name:string;description:string;priceAmount:number;badgeText:string|null;sortOrder:number;items:IntensiveMentoringBundleItemView[]}
export type IntensiveMentoringCompetitionCategoryView={id:string;code:string;slug:string;name:string;sortOrder:number}
export type IntensiveMentoringCatalogView={packages:IntensiveMentoringPackageView[];addOns:IntensiveMentoringAddOnCatalogView[];bundles:IntensiveMentoringBundleView[];competitionCategories:IntensiveMentoringCompetitionCategoryView[]}

export type IntensiveProgramStage='goal_setting'|'initial_assessment'|'guided_development'|'practice_application'|'review_refinement'|'final_evaluation'
export const intensiveStageLabels:Record<IntensiveProgramStage,string>={
 goal_setting:'Penetapan Tujuan',
 initial_assessment:'Asesmen Awal',
 guided_development:'Pengembangan Terarah',
 practice_application:'Praktik dan Penerapan',
 review_refinement:'Review dan Penyempurnaan',
 final_evaluation:'Final Evaluation',
}
export type IntensiveAddOnView={entitlementId:string|null;name:string;code:string;status:string;source?:'attached'|'bundle';createdAt?:string}
export type IntensiveSessionView={
 sessionId:string;sessionNumber:number;durationMinutes:number;status:'awaiting_focus'|'awaiting_scheduling'|'scheduled'|'completed'|'cancelled';
 focusId:string|null;focusName:string|null;menteeTopicRequest:string|null;topicStatus:'needs_input'|'pending_review'|'confirmed';resolvedTopic:string|null;
 mentorId:string|null;mentorName:string|null;scheduledStartAt:string|null;scheduledEndAt:string|null;meetingUrl:string|null;
 providerSyncStatus?:string;googleSyncStatus:string;recordingStatus:string;creationSource:string;creationReason?:string|null
}
export type IntensiveEngagementView={
 engagementId:string;baseEntitlementId:string;baseKind:'package'|'bundle';programName:string;status:'active'|'completed'|'cancelled';
 baselineSessionsPerMonth:number|null;primaryMentorId:string|null;primaryMentorName:string|null;competitionName:string|null;
 programStage:IntensiveProgramStage;progressSummary:string|null;startedAt:string;addOns:IntensiveAddOnView[];sessions:IntensiveSessionView[]
}
