'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DigitalProductCard } from '@/components/digital-products/digital-product-card'
import { formatRupiah } from '@/lib/commerce/money'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { Card, CardSwap } from './card-swap'

export function DigitalProductCardSwap({
  products,
  decor,
}: {
  products: PublicDigitalProduct[]
  /** Optional decoration anchored to the stack; rendered inside the scene, after the cards. */
  decor?: ReactNode
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [requestedIndex, setRequestedState] = useState(0)
  const requestedRef = useRef(0)
  // The card GSAP has brought to the front. It changes as soon as a swap promotes the next card, while
  // activeIndex only commits once the swap animation has finished, so the caption and controls follow it.
  const [frontIndex, setFrontIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  // CardSwap navigates when its activeIndex prop changes. A control can ask for the index that is already
  // requested (e.g. "previous" while a swap is still settling), so a repeat request is re-issued next frame.
  const setRequestedIndex = useCallback((index: number) => {
    if (index === requestedRef.current) {
      setRequestedState(-1)
      window.requestAnimationFrame(() => setRequestedState(index))
    } else {
      setRequestedState(index)
    }
    requestedRef.current = index
  }, [])

  // Stable callback and children: re-rendering (for the caption) must not restart CardSwap's GSAP effect,
  // which would cut a swap off mid-animation.
  const handleActiveIndexChange = useCallback((index: number) => {
    setActiveIndex(index)
    requestedRef.current = index
    setRequestedState(index)
  }, [])
  const cards = useMemo(() => products.map(product => (
    <Card key={product.id} customClass="digital-product-swap-card">
      <DigitalProductCard product={product} headingLevel="h3" linkTestId={`digital-product-detail-link-${product.slug}`} />
    </Card>
  )), [products])

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof MutationObserver === 'undefined') return
    const cardElements = Array.from(root.querySelectorAll<HTMLElement>('.digital-product-swap-card'))
    if (cardElements.length < 2) return

    // GSAP writes each card's stacking order inline; the highest z-index is the card in front.
    const syncFront = () => {
      let front = 0
      let frontZ = Number.NEGATIVE_INFINITY
      cardElements.forEach((card, index) => {
        const z = Number.parseInt(card.style.zIndex, 10)
        if (!Number.isNaN(z) && z > frontZ) {
          frontZ = z
          front = index
        }
      })
      setFrontIndex(front)
    }
    const observer = new MutationObserver(syncFront)
    cardElements.forEach(card => observer.observe(card, { attributes: true, attributeFilter: ['style'] }))
    syncFront()
    return () => observer.disconnect()
  }, [products])

  if (products.length === 0) {
    return <p className="marketing-products__empty">No featured digital products are available yet.</p>
  }

  const previousIndex = (frontIndex - 1 + products.length) % products.length
  const nextIndex = (frontIndex + 1) % products.length
  const frontProduct = products[frontIndex] ?? products[0]

  return (
    <div
      ref={rootRef}
      className="digital-product-card-swap"
      data-testid="digital-product-card-swap"
      data-product-count={products.length}
    >
      <div className="digital-product-card-swap__stage">
        <div className="digital-product-card-swap__scene">
          <CardSwap
            width={480}
            height={600}
            cardDistance={24}
            verticalDistance={34}
            delay={3200}
            skewAmount={4}
            easing="elastic"
            pauseOnHover
            activeIndex={requestedIndex}
            onActiveIndexChange={handleActiveIndexChange}
            ariaLabel="Featured digital products"
          >
            {cards}
          </CardSwap>
          {decor}
        </div>
      </div>

      <div className="digital-product-card-swap__footer">
        {/* The card overlay only appears on hover or focus, so the front product's name and price also stay
            visible here for touch screens. Not a live region: it changes with autoplay. */}
        <p className="digital-product-card-swap__caption" key={frontProduct.id}>
          <strong>{frontProduct.name}</strong>
          <span>{formatRupiah(frontProduct.price_amount)}</span>
        </p>

        {products.length > 1 ? (
          <div className="digital-product-card-swap__controls" role="group" aria-label="Digital product navigation">
            <button
              type="button"
              className="digital-product-card-swap__arrow digital-product-card-swap__arrow--previous"
              aria-label="Previous digital product"
              onClick={() => setRequestedIndex(previousIndex)}
            >
              <ChevronLeft aria-hidden="true" size={22} />
            </button>
            <div className="digital-product-card-swap__dots" role="group" aria-label="Choose a featured digital product">
              {products.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  className={frontIndex === index ? 'is-active' : undefined}
                  aria-label={`Show ${product.name}`}
                  aria-current={activeIndex === index ? 'true' : undefined}
                  onClick={() => setRequestedIndex(index)}
                  data-testid={`digital-product-card-dot-${index}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="digital-product-card-swap__arrow digital-product-card-swap__arrow--next"
              aria-label="Next digital product"
              onClick={() => setRequestedIndex(nextIndex)}
            >
              <ChevronRight aria-hidden="true" size={22} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
