import type { AboutFeaturedStory } from '@/lib/supabase/database.types'

import type { AboutFeaturedStoryMediaLayout } from './about-featured-story-config'

export type AboutFeaturedStoryDraftInput = {
  title: string
  quote: string
  attributionName: string
  attributionOrganization: string
  achievementText: string
  mediaLayout: AboutFeaturedStoryMediaLayout
  primaryAltText: string
  secondaryAltText: string
  hasPrimaryImage: boolean
  hasSecondaryImage: boolean
}

export type AboutFeaturedStoryDraftErrors = Partial<Record<
  'title' | 'quote' | 'attributionName' | 'attributionOrganization' | 'achievementText' |
  'mediaLayout' | 'primaryAltText' | 'secondaryAltText' | 'primaryImage' | 'secondaryImage',
  string
>>

function requiredText(
  value: string,
  label: string,
  maximum: number,
  key: keyof AboutFeaturedStoryDraftErrors,
  errors: AboutFeaturedStoryDraftErrors,
) {
  const trimmed = value.trim()
  if (!trimmed) errors[key] = `${label} is required.`
  else if (trimmed.length > maximum) errors[key] = `${label} must be ${maximum} characters or fewer.`
}

export function validateAboutFeaturedStoryDraft(input: AboutFeaturedStoryDraftInput) {
  const errors: AboutFeaturedStoryDraftErrors = {}
  requiredText(input.title, 'Story title', 240, 'title', errors)
  requiredText(input.quote, 'Testimonial quote', 3000, 'quote', errors)
  requiredText(input.attributionName, 'Attribution name', 180, 'attributionName', errors)
  requiredText(input.attributionOrganization, 'Organization / institution', 240, 'attributionOrganization', errors)
  requiredText(input.achievementText, 'Achievement / result', 300, 'achievementText', errors)
  requiredText(input.primaryAltText, 'Primary image alt text', 300, 'primaryAltText', errors)

  if (input.mediaLayout !== 'single' && input.mediaLayout !== 'pair') {
    errors.mediaLayout = 'Choose a supported media layout.'
  }
  if (!input.hasPrimaryImage) errors.primaryImage = 'Choose and crop a primary story image.'
  if (input.mediaLayout === 'pair') {
    requiredText(input.secondaryAltText, 'Secondary image alt text', 300, 'secondaryAltText', errors)
    if (!input.hasSecondaryImage) errors.secondaryImage = 'Choose and crop a secondary story image.'
  }
  return errors
}

export function getNextAboutFeaturedStoryOrder(records: AboutFeaturedStory[]) {
  return records.length ? Math.max(...records.map(record => record.display_order)) + 1 : 1
}

export function reorderAboutFeaturedStoryIds(records: AboutFeaturedStory[], index: number, direction: -1 | 1) {
  const ids = records.map(record => record.id)
  const destination = index + direction
  if (index < 0 || index >= ids.length || destination < 0 || destination >= ids.length) return ids
  ;[ids[index], ids[destination]] = [ids[destination], ids[index]]
  return ids
}

export function isAboutFeaturedStorySetupRequired(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  return code === 'PGRST205'
    || code === '42P01'
    || (message.includes('about_featured_stories') && (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
    ))
}
