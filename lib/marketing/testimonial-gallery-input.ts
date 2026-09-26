export type TestimonialDragIntent = 'pending' | 'horizontal' | 'vertical'
export type TestimonialPointerRelease = 'activate' | 'resume' | 'ignore'

export function getTestimonialGalleryGeometry(screenWidth: number) {
  if (screenWidth <= 600) {
    const cardWidth = Math.round(screenWidth * .646)
    return { cardWidth, cardHeight: cardWidth * 1.25, gap: 14, bend: 1.35 }
  }

  const cardWidth = Math.max(220, Math.min(300, screenWidth * .2))
  return {
    cardWidth,
    cardHeight: cardWidth * 1.25,
    gap: Math.max(18, Math.min(28, screenWidth * .018)),
    bend: 2.4,
  }
}

export function resolveTestimonialDragIntent(deltaX: number, deltaY: number, threshold = 7): TestimonialDragIntent {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return 'pending'
  return Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
}

export function getTestimonialHorizontalWheelDelta(deltaX: number, deltaY: number) {
  if (Math.abs(deltaX) < 2 || Math.abs(deltaX) <= Math.abs(deltaY)) return 0
  return deltaX
}

export function resolveTestimonialPointerRelease(
  pointerType: string,
  intent: TestimonialDragIntent,
  moved: boolean,
): TestimonialPointerRelease {
  if (intent === 'vertical') return 'ignore'
  if (intent === 'horizontal' || moved) return 'resume'
  return pointerType === 'touch' || pointerType === 'pen' || pointerType === 'mouse' ? 'activate' : 'ignore'
}
