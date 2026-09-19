export type TestimonialDragIntent = 'pending' | 'horizontal' | 'vertical'

export function resolveTestimonialDragIntent(deltaX: number, deltaY: number, threshold = 7): TestimonialDragIntent {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return 'pending'
  return Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
}

export function getTestimonialHorizontalWheelDelta(deltaX: number, deltaY: number) {
  if (Math.abs(deltaX) < 2 || Math.abs(deltaX) <= Math.abs(deltaY)) return 0
  return deltaX
}
