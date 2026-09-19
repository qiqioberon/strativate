'use client'

import { ArrowUpRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { formatRupiah } from '@/lib/commerce/money'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { Card, CardSwap } from './card-swap'

export function DigitalProductCardSwap({ products }: { products: PublicDigitalProduct[] }) {
  if (products.length === 0) {
    return <p className="marketing-products__empty">Belum ada Produk Digital pilihan untuk beranda.</p>
  }

  return (
    <div className="digital-product-card-swap" data-testid="digital-product-card-swap">
      <CardSwap
        width={480}
        height={570}
        cardDistance={46}
        verticalDistance={50}
        delay={5000}
        skewAmount={4}
        easing="elastic"
        pauseOnHover
        ariaLabel="Produk Digital pilihan di beranda"
      >
        {products.map(product => (
          <Card key={product.id} customClass="digital-product-swap-card">
            <Link
              href={`/produk-digital/${product.slug}`}
              data-testid={`digital-product-detail-link-${product.slug}`}
              aria-label={`Lihat detail ${product.name}`}
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
                <span>Produk Digital · {formatRupiah(product.price_amount)}</span>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <strong>Lihat detail <ArrowUpRight aria-hidden="true" size={17} /></strong>
              </div>
            </Link>
          </Card>
        ))}
      </CardSwap>
    </div>
  )
}
