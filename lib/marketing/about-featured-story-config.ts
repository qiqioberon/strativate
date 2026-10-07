export const ABOUT_FEATURED_STORY_BUCKET = 'marketing-editorial'
export const ABOUT_FEATURED_STORY_PREFIX = 'about-featured-stories/'
export const ABOUT_FEATURED_STORY_SOURCE_PREFIX = 'about-featured-stories/'

export type AboutFeaturedStoryMediaLayout = 'single' | 'pair'

export const ABOUT_FEATURED_STORY_SINGLE_TARGET = {
  width: 1200,
  height: 900,
  maxBytes: 8 * 1024 * 1024,
  title: 'Adjust featured story image crop',
  description: 'Single-image stories use a locked 4:3 editorial crop.',
} as const

export const ABOUT_FEATURED_STORY_PAIR_TARGET = {
  width: 1000,
  height: 1250,
  maxBytes: 8 * 1024 * 1024,
  title: 'Adjust featured story image crop',
  description: 'Paired story images use a locked 4:5 portrait crop.',
} as const
