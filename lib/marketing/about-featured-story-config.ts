export const ABOUT_FEATURED_STORY_BUCKET = 'marketing-editorial'
export const ABOUT_FEATURED_STORY_PREFIX = 'about-featured-stories/'
export const ABOUT_FEATURED_STORY_SOURCE_PREFIX = 'about-featured-stories/'

export type AboutFeaturedStorySlot = 'story_one' | 'story_two'
export type AboutFeaturedStoryMediaLayout = 'single' | 'pair'

export const ABOUT_FEATURED_STORY_ONE_TARGET = {
  width: 1200,
  height: 900,
  maxBytes: 8 * 1024 * 1024,
  title: 'Adjust Featured Story 1 image crop',
  description: 'Featured Story 1 uses the locked 4:3 landscape crop from the approved reference.',
} as const

export const ABOUT_FEATURED_STORY_TWO_TARGET = {
  width: 900,
  height: 1200,
  maxBytes: 8 * 1024 * 1024,
  title: 'Adjust Featured Story 2 image crop',
  description: 'Featured Story 2 uses the locked 3:4 portrait crop from the approved reference.',
} as const

export const ABOUT_FEATURED_STORY_SLOTS: Array<{
  slot: AboutFeaturedStorySlot
  label: string
  layout: AboutFeaturedStoryMediaLayout
  layoutLabel: string
  imageCount: 1 | 2
}> = [
  {
    slot: 'story_one',
    label: 'Featured Story 1',
    layout: 'single',
    layoutLabel: 'Image left · quote right · 4:3',
    imageCount: 1,
  },
  {
    slot: 'story_two',
    label: 'Featured Story 2',
    layout: 'pair',
    layoutLabel: 'Quote left · 2 images right · 3:4',
    imageCount: 2,
  },
]
