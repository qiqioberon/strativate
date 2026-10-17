'use client'

import { type ReactNode, useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Absolutely positioned decoration layer. On desktop it listens to the pointer over its parent section and
 * writes --decor-mx / --decor-my (-1…1) on itself, so ornaments inside drift by their own --orn-depth.
 * Only the layer's style changes, which keeps style recalculation off the section content.
 */
export function ParallaxLayer({ className, children }: { className?: string; children: ReactNode }) {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = layerRef.current
    const host = layer?.parentElement
    if (!layer || !host) return
    if (!window.matchMedia(FINE_POINTER_QUERY).matches || window.matchMedia(REDUCED_MOTION_QUERY).matches) return

    let frame = 0
    let nextX = 0
    let nextY = 0

    const apply = () => {
      frame = 0
      layer.style.setProperty('--decor-mx', nextX.toFixed(3))
      layer.style.setProperty('--decor-my', nextY.toFixed(3))
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply)
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      const bounds = host.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      nextX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1))
      nextY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1))
      schedule()
    }
    const onLeave = () => {
      nextX = 0
      nextY = 0
      schedule()
    }

    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', onLeave)
    return () => {
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={layerRef} className={cn('decor-layer', className)} aria-hidden="true">
      {children}
    </div>
  )
}
