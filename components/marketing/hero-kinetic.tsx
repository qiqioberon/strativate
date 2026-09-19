'use client'

import Link from 'next/link'
import { type PointerEvent as ReactPointerEvent, type ReactNode, useRef } from 'react'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function setCssVariable(element: HTMLElement, name: string, value: string) {
  element.style.setProperty(name, value)
}

export function HeroKineticSurface({ children }: { children: ReactNode }) {
  const surfaceRef = useRef<HTMLDivElement>(null)

  function updateSpotlight(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch' || prefersReducedMotion()) return
    const surface = surfaceRef.current
    if (!surface) return
    const bounds = surface.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100
    setCssVariable(surface, '--hero-spot-x', `${Math.max(0, Math.min(100, x))}%`)
    setCssVariable(surface, '--hero-spot-y', `${Math.max(0, Math.min(100, y))}%`)
  }

  function resetSpotlight() {
    const surface = surfaceRef.current
    if (!surface) return
    setCssVariable(surface, '--hero-spot-x', '72%')
    setCssVariable(surface, '--hero-spot-y', '31%')
  }

  return (
    <div
      ref={surfaceRef}
      className="marketing-hero__kinetic-surface"
      onPointerMove={updateSpotlight}
      onPointerLeave={resetSpotlight}
      data-testid="hero-kinetic-surface"
    >
      {children}
    </div>
  )
}

export function HeroVisualStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null)

  function updateTilt(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch' || prefersReducedMotion()) return
    const stage = stageRef.current
    if (!stage) return
    const bounds = stage.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    setCssVariable(stage, '--hero-tilt-x', `${((0.5 - y) * 3.4).toFixed(2)}deg`)
    setCssVariable(stage, '--hero-tilt-y', `${((x - 0.5) * 4.2).toFixed(2)}deg`)
    setCssVariable(stage, '--hero-glow-x', `${(x * 100).toFixed(1)}%`)
    setCssVariable(stage, '--hero-glow-y', `${(y * 100).toFixed(1)}%`)
  }

  function resetTilt() {
    const stage = stageRef.current
    if (!stage) return
    setCssVariable(stage, '--hero-tilt-x', '0deg')
    setCssVariable(stage, '--hero-tilt-y', '0deg')
    setCssVariable(stage, '--hero-glow-x', '50%')
    setCssVariable(stage, '--hero-glow-y', '45%')
  }

  return (
    <div
      ref={stageRef}
      className="marketing-hero-stage"
      onPointerMove={updateTilt}
      onPointerLeave={resetTilt}
      data-testid="hero-kinetic-stage"
    >
      <div className="marketing-hero-stage__node marketing-hero-stage__node--one" aria-hidden="true">
        <span>01</span><strong>Tentukan target</strong>
      </div>
      <div className="marketing-hero-stage__node marketing-hero-stage__node--two" aria-hidden="true">
        <span>02</span><strong>Susun strategi</strong>
      </div>
      <div className="marketing-hero-stage__node marketing-hero-stage__node--three" aria-hidden="true">
        <span>03</span><strong>Ambil langkah</strong>
      </div>
      <div className="marketing-hero-stage__card">{children}</div>
    </div>
  )
}

type MagneticActionProps = {
  href: string
  className: string
  children: ReactNode
  testId: string
  external?: boolean
  ariaLabel?: string
}

export function MagneticAction({ href, className, children, testId, external = false, ariaLabel }: MagneticActionProps) {
  const linkRef = useRef<HTMLAnchorElement>(null)

  function updateMagnet(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (event.pointerType === 'touch' || prefersReducedMotion()) return
    const link = linkRef.current
    if (!link) return
    const bounds = link.getBoundingClientRect()
    const x = event.clientX - (bounds.left + bounds.width / 2)
    const y = event.clientY - (bounds.top + bounds.height / 2)
    setCssVariable(link, '--magnet-x', `${(x * 0.14).toFixed(1)}px`)
    setCssVariable(link, '--magnet-y', `${(y * 0.18).toFixed(1)}px`)
  }

  function resetMagnet() {
    const link = linkRef.current
    if (!link) return
    setCssVariable(link, '--magnet-x', '0px')
    setCssVariable(link, '--magnet-y', '0px')
  }

  const sharedProps = {
    ref: linkRef,
    className: `marketing-hero__magnetic ${className}`,
    onPointerMove: updateMagnet,
    onPointerLeave: resetMagnet,
    'data-testid': testId,
    'data-magnetic-action': 'true',
    'aria-label': ariaLabel,
  }

  if (external) {
    return (
      <a {...sharedProps} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    )
  }

  return (
    <Link {...sharedProps} href={href}>
      {children}
    </Link>
  )
}
