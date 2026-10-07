import type { AboutFeaturedStory } from '@/lib/supabase/database.types'

import type { AboutFeaturedStorySlot } from './about-featured-story-config'

export type AboutFeaturedStoryDraftInput = {
  slot: AboutFeaturedStorySlot
  title: string
  quote: string
  attributionName: string
  attributionOrganization: string
  achievementText: string
  primaryAltText: string
  secondaryAltText: string
  hasPrimaryImage: boolean
  hasSecondaryImage: boolean
}

export type AboutFeaturedStoryDraftErrors = Partial<Record<
  'title' | 'quote' | 'attributionName' | 'attributionOrganization' | 'achievementText' |
  'primaryAltText' | 'secondaryAltText' | 'primaryImage' | 'secondaryImage',
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
  if (!input.hasPrimaryImage) errors.primaryImage = 'Choose and crop the primary story image.'

  if (input.slot === 'story_two') {
    requiredText(input.secondaryAltText, 'Secondary image alt text', 300, 'secondaryAltText', errors)
    if (!input.hasSecondaryImage) errors.secondaryImage = 'Choose and crop the secondary story image.'
  }

  return errors
}

export function isCompleteAboutFeaturedStory(story: AboutFeaturedStory) {
  const common = Boolean(
    story.title?.trim()
    && story.quote?.trim()
    && story.attribution_name?.trim()
    && story.attribution_organization?.trim()
    && story.achievement_text?.trim()
    && story.primary_image_path
    && story.primary_image_source_path
    && story.primary_image_crop
    && story.primary_image_alt_text?.trim(),
  )
  if (!common) return false
  if (story.slot === 'story_one') return true
  return Boolean(
    story.secondary_image_path
    && story.secondary_image_source_path
    && story.secondary_image_crop
    && story.secondary_image_alt_text?.trim(),
  )
}

export function isFixedAboutFeaturedStory(value: unknown): value is AboutFeaturedStory {
  if (!value || typeof value !== 'object') return false
  const slot = (value as { slot?: unknown }).slot
  return slot === 'story_one' || slot === 'story_two'
}

export function isAboutFeaturedStorySetupRequired(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  return code === 'PGRST205'
    || code === 'PGRST204'
    || code === '42P01'
    || code === '42703'
    || (message.includes('about_featured_stories') && (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
      || message.includes('slot')
    ))
}
