'use client'

import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'

function resetInteractiveTarget(target: HTMLElement) {
  target.style.setProperty('--program-tilt-x', '0deg')
  target.style.setProperty('--program-tilt-y', '0deg')
}

export function ProgramKineticSurface({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const reduceMotionRef = useRef(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reduceMotionRef.current = query.matches
      if (query.matches) rootRef.current?.querySelectorAll<HTMLElement>('[data-program-card]').forEach(resetInteractiveTarget)
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    const root = rootRef.current
    if (!root || reduceMotionRef.current || event.pointerType === 'touch') return

    const rootRect = root.getBoundingClientRect()
    root.style.setProperty('--program-page-x', `${event.clientX - rootRect.left}px`)
    root.style.setProperty('--program-page-y', `${event.clientY - rootRect.top}px`)

    const target = (event.target as Element).closest<HTMLElement>('[data-program-card], [data-program-band]')
    root.querySelectorAll<HTMLElement>('[data-program-card]').forEach((card) => {
      if (card !== target) resetInteractiveTarget(card)
    })
    if (!target || !root.contains(target)) return

    const rect = target.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    target.style.setProperty('--program-card-x', `${x}px`)
    target.style.setProperty('--program-card-y', `${y}px`)

    if (target.hasAttribute('data-program-card')) {
      const normalizedX = (x / Math.max(rect.width, 1) - 0.5) * 2
      const normalizedY = (y / Math.max(rect.height, 1) - 0.5) * 2
      target.style.setProperty('--program-tilt-y', `${(normalizedX * 1.15).toFixed(2)}deg`)
      target.style.setProperty('--program-tilt-x', `${(normalizedY * -0.85).toFixed(2)}deg`)
    }
  }

  function resetPointer() {
    rootRef.current?.querySelectorAll<HTMLElement>('[data-program-card]').forEach(resetInteractiveTarget)
  }

  return (
    <div
      ref={rootRef}
      className="program-kinetic-surface"
      data-testid="program-kinetic-surface"
      onPointerMove={updatePointer}
      onPointerLeave={resetPointer}
    >
      {children}
    </div>
  )
}
