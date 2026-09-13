'use client'

import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Compass } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { BrandLogo } from '@/components/brand/brand-logo'
import type { MarketingHeroPosterView } from '@/lib/marketing/hero-posters'
import {
  CAROUSEL_AUTOPLAY_DELAY,
  getNextCarouselIndex,
  getPreviousCarouselIndex,
  hasCarouselControls,
  shouldScheduleCarousel,
} from '@/lib/marketing/carousel'

export function HeroCarousel({ posters }: { posters: MarketingHeroPosterView[] }) {
  const [active, setActive] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const [isFocusWithin, setIsFocusWithin] = useState(false)
  const [isPointerActive, setIsPointerActive] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [selectionVersion, setSelectionVersion] = useState(0)
  const touchStart = useRef<number | null>(null)
  const paused = isHovering || isFocusWithin || isPointerActive

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateReducedMotion = () => setReducedMotion(motionQuery.matches)
    updateReducedMotion()
    motionQuery.addEventListener('change', updateReducedMotion)
    return () => motionQuery.removeEventListener('change', updateReducedMotion)
  }, [])

  useEffect(() => {
    if (!shouldScheduleCarousel({ posterCount: posters.length, paused, reducedMotion })) return
    const timer = window.setTimeout(() => setActive((current) => getNextCarouselIndex(current, posters.length)), CAROUSEL_AUTOPLAY_DELAY)
    return () => window.clearTimeout(timer)
  }, [active, paused, posters.length, reducedMotion, selectionVersion])

  useEffect(() => {
    if (active >= posters.length) setActive(0)
  }, [active, posters.length])

  function selectPoster(index: number) {
    setActive(index)
    setSelectionVersion((version) => version + 1)
  }

  function selectNextPoster() {
    setActive((index) => getNextCarouselIndex(index, posters.length))
    setSelectionVersion((version) => version + 1)
  }

  function selectPreviousPoster() {
    setActive((index) => getPreviousCarouselIndex(index, posters.length))
    setSelectionVersion((version) => version + 1)
  }

  if (!posters.length) {
    return (
      <div className="marketing-hero__visual marketing-hero__fallback" aria-label="Identitas visual Strativate" data-testid="hero-poster-fallback">
        <div className="marketing-hero__visual-head" data-testid="hero-fallback-label">
          <span>STRATIVATE / 01</span>
          <Compass aria-hidden="true" size={22} />
        </div>
        <div className="marketing-hero__brand-art"><BrandLogo variant="mark" priority /></div>
        <div className="marketing-hero__visual-foot">
          <strong data-testid="hero-fallback-title">Ruang untuk<br />bertumbuh.</strong>
          <p data-testid="hero-fallback-description">Pelatihan bisnis, akuntansi, dan persiapan kompetisi dengan pendekatan praktis.</p>
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
      aria-label="Poster informasi Strativate"
      data-testid="hero-poster-carousel"
      tabIndex={0}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocusCapture={() => setIsFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusWithin(false)
      }}
      onPointerDown={(event) => {
        setIsPointerActive(true)
        touchStart.current = event.pointerType === 'touch' ? event.clientX : null
      }}
      onPointerUp={(event) => {
        setIsPointerActive(false)
        if (touchStart.current === null || posters.length < 2) return
        const distance = event.clientX - touchStart.current
        if (Math.abs(distance) > 45) {
          if (distance < 0) selectNextPoster()
          else selectPreviousPoster()
        }
        touchStart.current = null
      }}
      onPointerCancel={() => {
        setIsPointerActive(false)
        touchStart.current = null
      }}
      onKeyDown={(event) => {
        if (posters.length < 2) return
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          selectPreviousPoster()
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          selectNextPoster()
        }
      }}
    >
      {current.url ? <Link href={current.url} data-testid="hero-poster-link">{poster}</Link> : poster}
      {hasCarouselControls(posters.length) ? (
        <div className="marketing-hero-carousel__controls" aria-label="Pilih poster">
          <button type="button" className="marketing-hero-carousel__arrow" aria-label="Poster sebelumnya" onClick={selectPreviousPoster} data-testid="hero-poster-previous-button">
            <ArrowLeft aria-hidden="true" size={17} />
          </button>
          {posters.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Tampilkan poster ${index + 1}`}
              aria-current={index === active ? 'true' : undefined}
              data-testid={`hero-poster-indicator-${index + 1}`}
              onClick={() => selectPoster(index)}
            />
          ))}
          <button type="button" className="marketing-hero-carousel__arrow" aria-label="Poster berikutnya" onClick={selectNextPoster} data-testid="hero-poster-next-button">
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
