'use client'

import { ArrowDownRight, ArrowUpRight, Compass } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { BrandLogo } from '@/components/brand/brand-logo'
import type { MarketingHeroPosterView } from '@/lib/marketing/hero-posters'

export function HeroCarousel({ posters }: { posters: MarketingHeroPosterView[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStart = useRef<number | null>(null)

  useEffect(() => {
    if (paused || posters.length < 2) return
    const timer = window.setInterval(() => setActive((current) => (current + 1) % posters.length), 6000)
    return () => window.clearInterval(timer)
  }, [paused, posters.length])

  useEffect(() => {
    if (active >= posters.length) setActive(0)
  }, [active, posters.length])

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
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null }}
      onTouchEnd={(event) => {
        if (touchStart.current === null || posters.length < 2) return
        const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current
        if (Math.abs(distance) > 45) setActive((currentIndex) => (currentIndex + (distance < 0 ? 1 : posters.length - 1)) % posters.length)
        touchStart.current = null
      }}
    >
      {current.url ? <Link href={current.url} data-testid="hero-poster-link">{poster}</Link> : poster}
      {posters.length > 1 ? (
        <div className="marketing-hero-carousel__controls" aria-label="Pilih poster">
          {posters.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Tampilkan poster ${index + 1}`}
              aria-current={index === active ? 'true' : undefined}
              data-testid={`hero-poster-indicator-${index + 1}`}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
