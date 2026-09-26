'use client'

import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

import { formatRupiah } from '@/lib/commerce/money'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { Card, CardSwap } from './card-swap'

export function DigitalProductCardSwap({ products }: { products: PublicDigitalProduct[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [requestedIndex, setRequestedIndex] = useState(0)

  if (products.length === 0) {
    return <p className="marketing-products__empty">No featured digital products are available yet.</p>
  }

  const previousIndex = (activeIndex - 1 + products.length) % products.length
  const nextIndex = (activeIndex + 1) % products.length

  return (
    <div
      className="digital-product-card-swap"
      data-testid="digital-product-card-swap"
      data-product-count={products.length}
    >
      <div className="digital-product-card-swap__scene">
        <CardSwap
          width={480}
          height={570}
          cardDistance={46}
          verticalDistance={50}
          delay={3200}
          skewAmount={4}
          easing="elastic"
          pauseOnHover
          activeIndex={requestedIndex}
          onActiveIndexChange={index => {
            setActiveIndex(index)
            setRequestedIndex(index)
          }}
          ariaLabel="Featured digital products"
        >
          {products.map(product => (
            <Card key={product.id} customClass="digital-product-swap-card">
              <Link
                href={`/produk-digital/${product.slug}`}
                data-testid={`digital-product-detail-link-${product.slug}`}
                aria-label={`View details for ${product.name}`}
              >
                <div className="digital-product-swap-card__media">
                  <Image
                    src={product.imageUrl}
                    alt={`Cover ${product.name}`}
                    fill
                    sizes="(max-width: 700px) 76vw, 480px"
                  />
                </div>
                <div className="digital-product-swap-card__copy">
                  <span>Digital Product · {formatRupiah(product.price_amount)}</span>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <strong>View details <ArrowUpRight aria-hidden="true" size={17} /></strong>
                </div>
              </Link>
            </Card>
          ))}
        </CardSwap>
      </div>

      {products.length > 1 ? (
        <div className="digital-product-card-swap__navigation" role="group" aria-label="Digital product navigation">
          <button
            type="button"
            className="digital-product-card-swap__arrow digital-product-card-swap__arrow--previous"
            aria-label="Previous digital product"
            onClick={() => setRequestedIndex(previousIndex)}
          >
            <ChevronLeft aria-hidden="true" size={22} />
          </button>
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

      {products.length > 1 ? (
        <div className="digital-product-card-swap__dots" role="group" aria-label="Choose a featured digital product">
          {products.map((product, index) => (
            <button
              key={product.id}
              type="button"
              className={activeIndex === index ? 'is-active' : undefined}
              aria-label={`Tampilkan ${product.name}`}
              aria-current={activeIndex === index ? 'true' : undefined}
              onClick={() => setRequestedIndex(index)}
              data-testid={`digital-product-card-dot-${index}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
