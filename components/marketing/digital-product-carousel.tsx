'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { formatRupiah } from '@/lib/commerce/money'
import type { PublicDigitalProduct } from '@/lib/commerce/types'

const AUTOPLAY_MS = 5000

export function DigitalProductCarousel({ products }: { products: PublicDigitalProduct[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const hasMultiple = products.length > 1

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!hasMultiple || paused || reduceMotion) return
    const timer = window.setInterval(() => {
      setActiveIndex(current => (current + 1) % products.length)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [hasMultiple, paused, products.length, reduceMotion, activeIndex])

  if (products.length === 0) {
    return <p className="marketing-products__empty">Belum ada Produk Digital yang dipublikasikan.</p>
  }

  const select = (index: number) => setActiveIndex((index + products.length) % products.length)

  return (
    <div
      className="digital-product-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Preview Produk Digital"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      data-testid="digital-product-carousel"
    >
      <div className="digital-product-carousel__viewport" aria-live={paused ? 'polite' : 'off'}>
        {products.map((product, index) => (
          <article
            className="digital-product-carousel__slide"
            aria-hidden={index !== activeIndex}
            key={product.id}
            style={{ transform: `translateX(${(index - activeIndex) * 100}%)` }}
          >
            <Link
              href={`/produk-digital/${product.slug}`}
              tabIndex={index === activeIndex ? 0 : -1}
              data-testid={`digital-product-detail-link-${product.slug}`}
            >
              <div className="digital-product-carousel__media">
                <Image
                  src={product.imageUrl}
                  alt={`Sampul ${product.name}`}
                  fill
                  sizes="(max-width: 760px) 88vw, 42vw"
                  unoptimized
                />
              </div>
              <div className="digital-product-carousel__copy">
                <span>Produk Digital · {formatRupiah(product.price_amount)}</span>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
              </div>
            </Link>
          </article>
        ))}
      </div>

      <div className="digital-product-carousel__controls">
        {hasMultiple ? (
          <div className="digital-product-carousel__arrows">
            <button type="button" onClick={() => select(activeIndex - 1)} aria-label="Produk Digital sebelumnya">
              <ArrowLeft aria-hidden="true" size={17} />
            </button>
            <button type="button" onClick={() => select(activeIndex + 1)} aria-label="Produk Digital berikutnya">
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          </div>
        ) : <span />}
        <div className="digital-product-carousel__dots" aria-label="Pilih slide Produk Digital">
          {products.map((product, index) => (
            <button
              key={product.id}
              type="button"
              aria-label={`Tampilkan ${product.name}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              className={index === activeIndex ? 'is-active' : undefined}
              onClick={() => select(index)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
