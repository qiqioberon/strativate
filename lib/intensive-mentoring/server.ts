/* eslint-disable @typescript-eslint/no-explicit-any -- Catalog tables/RPCs are intentionally accessed through the existing ungenerated Supabase boundary. */
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { IntensiveEngagementView, IntensiveMentoringCatalogView } from './types'

export async function getPublicIntensiveMentoringCatalog(): Promise<IntensiveMentoringCatalogView | null> {
  const supabase = await createClient() as any
  const [packagesResult, packageFeaturesResult, addOnsResult, addOnFeaturesResult, bundlesResult, bundleItemsResult, categoriesResult] = await Promise.all([
    supabase.from('intensive_mentoring_packages').select('*').eq('is_active', true).order('sort_order').order('id'),
    supabase.from('intensive_mentoring_package_features').select('*').eq('is_active', true).order('sort_order').order('id'),
    supabase.from('intensive_mentoring_add_ons').select('*').eq('is_active', true).order('sort_order').order('id'),
    supabase.from('intensive_mentoring_add_on_features').select('*').eq('is_active', true).order('sort_order').order('id'),
    supabase.from('intensive_mentoring_bundles').select('*').eq('is_active', true).order('sort_order').order('id'),
    supabase.from('intensive_mentoring_bundle_items').select('*').eq('is_active', true).order('sort_order').order('id'),
    supabase.from('competition_categories').select('*').eq('is_active', true).order('sort_order').order('id'),
  ])

  const results = [packagesResult, packageFeaturesResult, addOnsResult, addOnFeaturesResult, bundlesResult, bundleItemsResult, categoriesResult]
  const failed = results.find(result => result.error)
  if (failed?.error) {
    console.error('Intensive Mentoring catalog unavailable', failed.error.message)
    return null
  }

  const packageRows = packagesResult.data ?? []
  const addOnRows = addOnsResult.data ?? []
  const packageById = new Map(packageRows.map((row:any) => [row.id, row]))
  const addOnById = new Map(addOnRows.map((row:any) => [row.id, row]))
  const packageFeatures = packageFeaturesResult.data ?? []
  const addOnFeatures = addOnFeaturesResult.data ?? []
  const bundleItems = bundleItemsResult.data ?? []

  const packages = packageRows.map((row:any) => ({
    id: row.id,
    code: row.code,
    slug: row.slug,
    name: row.name,
    description: row.description,
    competitionScope: row.competition_scope as 'national'|'international',
    sessionsPerMonth: row.sessions_per_month,
    pricingMode: row.pricing_mode as 'fixed'|'consultation',
    priceAmount: row.price_amount === null ? null : Number(row.price_amount),
    referencePriceAmount: row.reference_price_amount === null ? null : Number(row.reference_price_amount),
    sortOrder: row.sort_order,
    features: packageFeatures.filter((feature:any) => feature.package_id === row.id).map((feature:any) => ({ id: feature.id, text: feature.text, sortOrder: feature.sort_order })),
  }))

  const addOns = addOnRows.map((row:any) => ({
    id: row.id,
    code: row.code,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceAmount: Number(row.price_amount),
    termsNote: row.terms_note,
    sortOrder: row.sort_order,
    features: addOnFeatures.filter((feature:any) => feature.add_on_id === row.id).map((feature:any) => ({ id: feature.id, text: feature.text, sortOrder: feature.sort_order })),
  }))

  const bundles = (bundlesResult.data ?? []).map((row:any) => ({
    id: row.id,
    code: row.code,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceAmount: Number(row.price_amount),
    badgeText: row.badge_text,
    sortOrder: row.sort_order,
    items: bundleItems.flatMap((item:any) => {
      if (item.bundle_id !== row.id) return []
      if (item.item_type === 'package') {
        const linked = packageById.get(item.package_id) as any
        return linked ? [{ id: item.id, itemType: 'package' as const, label: linked.name, sortOrder: item.sort_order }] : []
      }
      if (item.item_type === 'add_on') {
        const linked = addOnById.get(item.add_on_id) as any
        return linked ? [{ id: item.id, itemType: 'add_on' as const, label: linked.name, sortOrder: item.sort_order }] : []
      }
      const label = String(item.feature_text ?? '').trim()
      return label ? [{ id: item.id, itemType: 'feature' as const, label, sortOrder: item.sort_order }] : []
    }),
  }))

  return {
    packages,
    addOns,
    bundles,
    competitionCategories: (categoriesResult.data ?? []).map((row:any) => ({ id: row.id, code: row.code, slug: row.slug, name: row.name, sortOrder: row.sort_order })),
  }
}


type EngagementRow={
 engagement_id:string;base_entitlement_id:string;base_kind:'package'|'bundle'|'custom_offer';program_name:string;status:'active'|'completed'|'cancelled';
 baseline_sessions_per_month:number|null;primary_mentor_id:string|null;primary_mentor_name:string|null;competition_name:string|null;
 program_stage:IntensiveEngagementView['programStage'];current_activity:string|null;progress_summary:string|null;started_at:string;add_ons:IntensiveEngagementView['addOns'];sessions:IntensiveEngagementView['sessions']
}

export async function listMyIntensiveMentoringEngagements():Promise<IntensiveEngagementView[]>{
 const supabase=await createClient() as any
 const{data,error}=await supabase.rpc('list_my_intensive_mentoring_engagements')
 if(error){console.error('Intensive Mentoring engagements unavailable',error.message);return[]}
 return ((data??[]) as EngagementRow[]).map(row=>({
  engagementId:row.engagement_id,
  baseEntitlementId:row.base_entitlement_id,
  baseKind:row.base_kind,
  programName:row.program_name,
  status:row.status,
  baselineSessionsPerMonth:row.baseline_sessions_per_month,
  primaryMentorId:row.primary_mentor_id,
  primaryMentorName:row.primary_mentor_name,
  competitionName:row.competition_name,
  programStage:row.program_stage,
  currentActivity:row.current_activity,
  progressSummary:row.progress_summary,
  startedAt:row.started_at,
  addOns:Array.isArray(row.add_ons)?row.add_ons:[],
  sessions:Array.isArray(row.sessions)?row.sessions:[],
 }))
}
