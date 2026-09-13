export const CAROUSEL_AUTOPLAY_DELAY = 5000

export function getNextCarouselIndex(currentIndex: number, posterCount: number) {
  return posterCount > 0 ? (currentIndex + 1) % posterCount : 0
}

export function getPreviousCarouselIndex(currentIndex: number, posterCount: number) {
  return posterCount > 0 ? (currentIndex + posterCount - 1) % posterCount : 0
}

export function hasCarouselControls(posterCount: number) {
  return posterCount > 1
}

export function shouldScheduleCarousel({ posterCount, paused, reducedMotion }: {
  posterCount: number
  paused: boolean
  reducedMotion: boolean
}) {
  return posterCount > 1 && !paused && !reducedMotion
}
