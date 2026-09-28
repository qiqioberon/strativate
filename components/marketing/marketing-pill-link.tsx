'use client'

import { gsap } from 'gsap'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

type MarketingPillLinkProps = {
  href: string
  children: ReactNode
  className?: string
  active?: boolean
  testId?: string
  prefetch?: boolean
}

export function MarketingPillLink({
  href,
  children,
  className,
  active = false,
  testId,
  prefetch = true,
}: MarketingPillLinkProps) {
  const linkRef = useRef<HTMLAnchorElement | null>(null)
  const circleRef = useRef<HTMLSpanElement | null>(null)
  const labelRef = useRef<HTMLSpanElement | null>(null)
  const hoverLabelRef = useRef<HTMLSpanElement | null>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const reducedMotionRef = useRef(false)

  const layout = useCallback(() => {
    const link = linkRef.current
    const circle = circleRef.current
    const label = labelRef.current
    const hoverLabel = hoverLabelRef.current
    if (!link || !circle || !label || !hoverLabel) return

    tweenRef.current?.kill()
    timelineRef.current?.kill()

    const { width, height } = link.getBoundingClientRect()
    if (!width || !height) return

    const radius = ((width * width) / 4 + height * height) / (2 * height)
    const diameter = Math.ceil(radius * 2) + 2
    const delta =
      Math.ceil(
        radius -
          Math.sqrt(Math.max(0, radius * radius - (width * width) / 4)),
      ) + 1
    const originY = diameter - delta

    circle.style.width = `${diameter}px`
    circle.style.height = `${diameter}px`
    circle.style.bottom = `-${delta}px`

    gsap.set(circle, {
      xPercent: -50,
      scale: 0,
      transformOrigin: `50% ${originY}px`,
    })
    gsap.set(label, { y: 0 })
    gsap.set(hoverLabel, { y: height + 12, opacity: 0 })

    if (reducedMotionRef.current) return

    const timeline = gsap.timeline({ paused: true })
    timeline.to(
      circle,
      {
        scale: 1.2,
        xPercent: -50,
        duration: 1,
        ease: 'power3.out',
        overwrite: 'auto',
      },
      0,
    )
    timeline.to(
      label,
      {
        y: -(height + 8),
        duration: 1,
        ease: 'power3.out',
        overwrite: 'auto',
      },
      0,
    )
    timeline.to(
      hoverLabel,
      {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: 'power3.out',
        overwrite: 'auto',
      },
      0,
    )
    timelineRef.current = timeline
  }, [])

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let cancelled = false

    const syncMotion = () => {
      reducedMotionRef.current = motionQuery.matches
      layout()
    }

    syncMotion()
    window.addEventListener('resize', layout)
    motionQuery.addEventListener('change', syncMotion)

    document.fonts?.ready
      .then(() => {
        if (!cancelled) layout()
      })
      .catch(() => {})

    return () => {
      cancelled = true
      window.removeEventListener('resize', layout)
      motionQuery.removeEventListener('change', syncMotion)
      tweenRef.current?.kill()
      timelineRef.current?.kill()
    }
  }, [layout])

  const animateTo = (progress: 'end' | 'start') => {
    if (reducedMotionRef.current) return

    const timeline = timelineRef.current
    if (!timeline) return

    tweenRef.current?.kill()
    tweenRef.current = timeline.tweenTo(
      progress === 'end' ? timeline.duration() : 0,
      {
        duration: progress === 'end' ? 0.32 : 0.22,
        ease: 'power3.out',
        overwrite: 'auto',
      },
    )
  }

  return (
    <Link
      ref={linkRef}
      href={href}
      prefetch={prefetch}
      className={cn('marketing-pill-link', className, active && 'is-active')}
      aria-current={active ? 'page' : undefined}
      data-testid={testId}
      onMouseEnter={() => animateTo('end')}
      onMouseLeave={() => animateTo('start')}
      onFocus={() => animateTo('end')}
      onBlur={() => animateTo('start')}
    >
      <span
        ref={circleRef}
        className="marketing-pill-link__circle"
        aria-hidden="true"
      />
      <span className="marketing-pill-link__stack">
        <span ref={labelRef} className="marketing-pill-link__label">
          {children}
        </span>
        <span
          ref={hoverLabelRef}
          className="marketing-pill-link__label marketing-pill-link__label--hover"
          aria-hidden="true"
        >
          {children}
        </span>
      </span>
    </Link>
  )
}
