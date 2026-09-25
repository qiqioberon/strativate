'use client'

import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Compass } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { BrandLogo } from '@/components/brand/brand-logo'
import type { MarketingHeroPosterView } from '@/lib/marketing/hero-posters'
import {
  CAROUSEL_AUTOPLAY_DELAY,
  beginCarouselPointer,
  finishCarouselPointer,
  getNextCarouselIndex,
  hasCarouselControls,
  selectCarouselForAction,
  shouldScheduleCarousel,
  type CarouselManualAction,
  type CarouselPointer,
} from '@/lib/marketing/carousel'

export function HeroCarousel({ posters }: { posters: MarketingHeroPosterView[] }) {
  const [selection, setSelection] = useState({ index: 0, scheduleVersion: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [isFocusWithin, setIsFocusWithin] = useState(false)
  const [isPointerActive, setIsPointerActive] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const pointer = useRef<CarouselPointer>({ isActive: false, startX: null })
  const paused = isHovering || isFocusWithin || isPointerActive
  const active = selection.index

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateReducedMotion = () => setReducedMotion(motionQuery.matches)
    updateReducedMotion()
    motionQuery.addEventListener('change', updateReducedMotion)
    return () => motionQuery.removeEventListener('change', updateReducedMotion)
  }, [])

  useEffect(() => {
    if (!shouldScheduleCarousel({ posterCount: posters.length, paused, reducedMotion })) return
    const timer = window.setTimeout(() => setSelection((current) => ({ ...current, index: getNextCarouselIndex(current.index, posters.length) })), CAROUSEL_AUTOPLAY_DELAY)
    return () => window.clearTimeout(timer)
  }, [active, paused, posters.length, reducedMotion, selection.scheduleVersion])

  useEffect(() => {
    setSelection((current) => current.index >= posters.length ? { ...current, index: 0 } : current)
  }, [posters.length])

  function selectCarousel(action: CarouselManualAction, dotIndex?: number) {
    setSelection((current) => selectCarouselForAction(current, action, posters.length, dotIndex))
  }

  function selectPoster(index: number) {
    selectCarousel('dot', index)
  }

  function selectNextPoster() {
    selectCarousel('next')
  }

  function selectPreviousPoster() {
    selectCarousel('previous')
  }

  useEffect(() => {
    const finishPointer = (clientX: number | null) => {
      if (!pointer.current.isActive) return
      const result = finishCarouselPointer(pointer.current, clientX, posters.length)
      pointer.current = { isActive: false, startX: null }
      setIsPointerActive(result.isActive)
      if (result.direction === 'next') setSelection((current) => selectCarouselForAction(current, 'swipe-next', posters.length))
      if (result.direction === 'previous') setSelection((current) => selectCarouselForAction(current, 'swipe-previous', posters.length))
    }
    const onPointerUp = (event: PointerEvent) => finishPointer(event.clientX)
    const onPointerCancel = () => finishPointer(null)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    return () => {
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [posters.length])

  if (!posters.length) {
    return (
      <div className="marketing-hero__visual marketing-hero__fallback" aria-label="Strativate visual identity" data-testid="hero-poster-fallback">
        <div className="marketing-hero__visual-head" data-testid="hero-fallback-label">
          <span>STRATIVATE / 01</span>
          <Compass aria-hidden="true" size={22} />
        </div>
        <div className="marketing-hero__brand-art"><BrandLogo variant="mark" priority /></div>
        <div className="marketing-hero__visual-foot">
          <strong data-testid="hero-fallback-title">Space to<br />grow.</strong>
          <p data-testid="hero-fallback-description">Practical business training, mentoring, and competition preparation.</p>
          <ArrowDownRight aria-hidden="true" size={28} />
        </div>
      </div>
    )
  }

  const current = posters[active]
  const poster = (
    <div className="marketing-hero-carousel__media" data-testid="hero-poster-media">
      <Image src={current.imageUrl} alt={current.alt_text} fill priority sizes="(max-width: 880px) 90vw, 46vw" />
      <div className="marketing-hero-carousel__scrim" />
      <div className="marketing-hero-carousel__caption" aria-live="polite">
        <span data-testid="hero-poster-counter">{String(active + 1).padStart(2, '0')} / {String(posters.length).padStart(2, '0')}</span>
        {current.title ? <strong data-testid="hero-poster-title">{current.title}</strong> : null}
        {current.url ? <span className="marketing-hero-carousel__link">Buka informasi <ArrowUpRight aria-hidden="true" size={17} /></span> : null}
      </div>
    </div>
  )

  return (
    <div
      className="marketing-hero__visual marketing-hero-carousel"
      aria-roledescription="carousel"
      aria-label="Strativate information posters"
      data-testid="hero-poster-carousel"
      tabIndex={0}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocusCapture={() => setIsFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusWithin(false)
      }}
      onPointerDown={(event) => {
        pointer.current = beginCarouselPointer(event.pointerType, event.clientX)
        setIsPointerActive(pointer.current.isActive)
      }}
      onKeyDown={(event) => {
        if (posters.length < 2) return
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          selectCarousel('keyboard-previous')
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          selectCarousel('keyboard-next')
        }
      }}
    >
      {current.url ? <Link href={current.url} data-testid="hero-poster-link">{poster}</Link> : poster}
      {hasCarouselControls(posters.length) ? (
        <div className="marketing-hero-carousel__controls" aria-label="Choose a poster">
          <button type="button" className="marketing-hero-carousel__arrow" aria-label="Previous poster" onClick={selectPreviousPoster} data-testid="hero-poster-previous-button">
            <ArrowLeft aria-hidden="true" size={17} />
          </button>
          {posters.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Show poster ${index + 1}`}
              aria-current={index === active ? 'true' : undefined}
              data-testid={`hero-poster-indicator-${index + 1}`}
              onClick={() => selectPoster(index)}
            />
          ))}
          <button type="button" className="marketing-hero-carousel__arrow" aria-label="Next poster" onClick={selectNextPoster} data-testid="hero-poster-next-button">
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
