export const CAROUSEL_AUTOPLAY_DELAY = 5000
export const CAROUSEL_SWIPE_DISTANCE = 45

export type CarouselSelection = {
  index: number
  scheduleVersion: number
}

export type CarouselPointer = {
  isActive: boolean
  startX: number | null
}

export type CarouselManualAction = 'previous' | 'next' | 'dot' | 'keyboard-previous' | 'keyboard-next' | 'swipe-previous' | 'swipe-next'

export function getNextCarouselIndex(currentIndex: number, posterCount: number) {
  return posterCount > 0 ? (currentIndex + 1) % posterCount : 0
}

export function getPreviousCarouselIndex(currentIndex: number, posterCount: number) {
  return posterCount > 0 ? (currentIndex + posterCount - 1) % posterCount : 0
}

export function hasCarouselControls(posterCount: number) {
  return posterCount > 1
}

export function selectCarouselIndex(selection: CarouselSelection, index: number, posterCount: number): CarouselSelection {
  return {
    index: posterCount > 0 ? ((index % posterCount) + posterCount) % posterCount : 0,
    scheduleVersion: selection.scheduleVersion + 1,
  }
}

export function selectCarouselForAction(selection: CarouselSelection, action: CarouselManualAction, posterCount: number, dotIndex = selection.index) {
  const index = action === 'dot'
    ? dotIndex
    : action === 'previous' || action === 'keyboard-previous' || action === 'swipe-previous'
      ? getPreviousCarouselIndex(selection.index, posterCount)
      : getNextCarouselIndex(selection.index, posterCount)
  return selectCarouselIndex(selection, index, posterCount)
}

export function beginCarouselPointer(pointerType: string, clientX: number): CarouselPointer {
  return { isActive: true, startX: pointerType === 'touch' ? clientX : null }
}

export function finishCarouselPointer(pointer: CarouselPointer, clientX: number | null, posterCount: number) {
  const distance = pointer.startX === null || clientX === null ? 0 : clientX - pointer.startX
  return {
    isActive: false,
    direction: posterCount > 1 && Math.abs(distance) > CAROUSEL_SWIPE_DISTANCE
      ? distance < 0 ? 'next' as const : 'previous' as const
      : null,
  }
}

export function shouldScheduleCarousel({ posterCount, paused, reducedMotion }: {
  posterCount: number
  paused: boolean
  reducedMotion: boolean
}) {
  return posterCount > 1 && !paused && !reducedMotion
}
