import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

import { formatRupiah } from '@/lib/commerce/money'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { AggregateRating } from './aggregate-rating'

export function DigitalProductCard({ product, headingLevel = 'h2', linkTestId }: { product: PublicDigitalProduct; headingLevel?: 'h2' | 'h3'; linkTestId?: string }) {
  const Heading = headingLevel
  const ratingCount = product.ratingCount ?? 0

  return <article className="digital-product-card">
    <Link className="digital-product-card__link" href={`/digital-products/${product.slug}`} aria-label={`View details for ${product.name}`} data-testid={linkTestId}>
      <div className="digital-product-card__cover">
        {product.imageUrl ? (
          // Public product covers are marketing assets served by Supabase Storage.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" loading="lazy" />
        ) : (
          <div className="digital-product-card__fallback" aria-hidden="true"><span>Digital Product</span><strong>{product.name}</strong></div>
        )}
      </div>
      <div className="digital-product-card__overlay" aria-hidden="true">
        <span className="digital-product-card__format">{product.content_type ? product.content_type.toUpperCase() : 'Digital Product'}</span>
        <div className="digital-product-card__heading"><Heading>{product.name}</Heading><ArrowUpRight size={20} strokeWidth={2} /></div>
        <p className="digital-product-card__description-preview">{product.description}</p>
        {ratingCount > 0 && product.averageRating != null ? <AggregateRating averageRating={product.averageRating} ratingCount={ratingCount} /> : null}
        <div className="digital-product-card__meta">
          <div className="digital-product-card__price-preview">{product.reference_price_amount != null ? <del>{formatRupiah(product.reference_price_amount)}</del> : null}<strong>{formatRupiah(product.price_amount)}</strong></div>
          <span>View details</span>
        </div>
      </div>
    </Link>
  </article>
}
