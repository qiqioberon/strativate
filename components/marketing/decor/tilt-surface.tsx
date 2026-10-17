'use client'

import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Pointer tilt with a soft glare, in the spirit of React Bits "Tilted Card" + "Spotlight Card" but written
 * for this codebase without extra dependencies. Wrap a card with it; the card keeps its own transforms.
 * Exposes --tilt-rx/--tilt-ry (deg), --tilt-px/--tilt-py (-1…1, unitless) for inner parallax, and
 * --glare-x/--glare-y/--glare-o for the glare layer. Disabled on touch and with reduced motion.
 */
export function TiltSurface({
  children,
  className,
  maxTilt = 7,
  glare = true,
  style,
}: {
  children: ReactNode
  className?: string
  /** Degrees at the card edge. */
  maxTilt?: number
  glare?: boolean
  style?: CSSProperties
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    if (!window.matchMedia(FINE_POINTER_QUERY).matches || window.matchMedia(REDUCED_MOTION_QUERY).matches) return

    let frame = 0
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let glareX = 50
    let glareY = 50
    let active = false

    const render = () => {
      currentX += (targetX - currentX) * 0.14
      currentY += (targetY - currentY) * 0.14
      surface.style.setProperty('--tilt-rx', `${(-currentY * maxTilt).toFixed(2)}deg`)
      surface.style.setProperty('--tilt-ry', `${(currentX * maxTilt).toFixed(2)}deg`)
      surface.style.setProperty('--tilt-px', currentX.toFixed(3))
      surface.style.setProperty('--tilt-py', currentY.toFixed(3))
      surface.style.setProperty('--glare-x', `${glareX.toFixed(1)}%`)
      surface.style.setProperty('--glare-y', `${glareY.toFixed(1)}%`)
      const settled = Math.abs(targetX - currentX) < 0.002 && Math.abs(targetY - currentY) < 0.002
      if (settled && !active) {
        frame = 0
        surface.removeAttribute('data-tilting')
        return
      }
      frame = window.requestAnimationFrame(render)
    }
    const start = () => {
      if (!frame) frame = window.requestAnimationFrame(render)
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      const bounds = surface.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
      const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
      targetX = x * 2 - 1
      targetY = y * 2 - 1
      glareX = x * 100
      glareY = y * 100
      active = true
      surface.setAttribute('data-tilting', '')
      start()
    }
    const onLeave = () => {
      targetX = 0
      targetY = 0
      active = false
      start()
    }

    surface.addEventListener('pointermove', onMove, { passive: true })
    surface.addEventListener('pointerleave', onLeave)
    return () => {
      surface.removeEventListener('pointermove', onMove)
      surface.removeEventListener('pointerleave', onLeave)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [maxTilt])

  return (
    <div ref={surfaceRef} className={cn('tilt-surface', className)} style={style}>
      {children}
      {glare ? <span className="tilt-surface__glare" aria-hidden="true" /> : null}
    </div>
  )
}
