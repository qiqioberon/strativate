export type IntensiveMentoringFeatureView = { id:string; text:string; sortOrder:number }
export type IntensiveMentoringPackageView = { id:string; code:string; slug:string; name:string; description:string; competitionScope:'national'|'international'; sessionsPerMonth:number|null; pricingMode:'fixed'|'consultation'; priceAmount:number|null; referencePriceAmount:number|null; sortOrder:number; features:IntensiveMentoringFeatureView[] }
export type IntensiveMentoringAddOnView = { id:string; code:string; slug:string; name:string; description:string; priceAmount:number; termsNote:string|null; sortOrder:number; features:IntensiveMentoringFeatureView[] }
export type IntensiveMentoringBundleItemView = { id:string; itemType:'package'|'add_on'|'feature'; label:string; sortOrder:number }
export type IntensiveMentoringBundleView = { id:string; code:string; slug:string; name:string; description:string; priceAmount:number; badgeText:string|null; sortOrder:number; items:IntensiveMentoringBundleItemView[] }
export type IntensiveMentoringCompetitionCategoryView = { id:string; code:string; slug:string; name:string; sortOrder:number }
export type IntensiveMentoringCatalogView = { packages:IntensiveMentoringPackageView[]; addOns:IntensiveMentoringAddOnView[]; bundles:IntensiveMentoringBundleView[]; competitionCategories:IntensiveMentoringCompetitionCategoryView[] }
