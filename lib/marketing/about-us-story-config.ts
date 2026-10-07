export const ABOUT_US_STORY_MEDIA_ID = 'story'
export const ABOUT_US_STORY_IMAGE_BUCKET = 'marketing-editorial'
export const ABOUT_US_STORY_IMAGE_PREFIX = 'about-us/'
export const ABOUT_US_STORY_SOURCE_PREFIX = 'about-us/'
export const ABOUT_US_STORY_IMAGE_WIDTH = 1600
export const ABOUT_US_STORY_IMAGE_HEIGHT = 1200
export const ABOUT_US_STORY_IMAGE_ASPECT_RATIO = ABOUT_US_STORY_IMAGE_WIDTH / ABOUT_US_STORY_IMAGE_HEIGHT
export const ABOUT_US_STORY_IMAGE_MAX_FILE_SIZE = 8 * 1024 * 1024

export const ABOUT_US_STORY_IMAGE_TARGET = {
  width: ABOUT_US_STORY_IMAGE_WIDTH,
  height: ABOUT_US_STORY_IMAGE_HEIGHT,
  maxBytes: ABOUT_US_STORY_IMAGE_MAX_FILE_SIZE,
  title: 'Adjust About Us story crop',
  description: 'Choose the 4:3 crop used by the public About Us story section.',
} as const
