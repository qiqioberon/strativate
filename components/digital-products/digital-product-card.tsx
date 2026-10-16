import { FileText, Users, Video } from 'lucide-react'
import Link from 'next/link'

import { formatRupiah } from '@/lib/commerce/money'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { AggregateRating } from './aggregate-rating'

const contentTypeLabels = {
  pdf: { label: 'PDF', Icon: FileText },
  video: { label: 'Video', Icon: Video },
} as const

export function DigitalProductCard({ product, headingLevel = 'h2', linkTestId }: { product: PublicDigitalProduct; headingLevel?: 'h2' | 'h3'; linkTestId?: string }) {
  const Heading = headingLevel
  const ratingCount = product.ratingCount ?? 0
  const contentType = product.content_type ? contentTypeLabels[product.content_type] : null
  const referencePrice = product.reference_price_amount
  const discountPercent = referencePrice != null && referencePrice > product.price_amount
    ? Math.round(((referencePrice - product.price_amount) / referencePrice) * 100)
    : null

  return <article className={`digital-product-card${product.content_type ? ` digital-product-card--${product.content_type}` : ''}`}>
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
      <div className="digital-product-card__badges" aria-hidden="true">
        {contentType ? <span className="digital-product-card__type"><contentType.Icon size={15} strokeWidth={2.2} />{contentType.label}</span> : null}
        {discountPercent ? <span className="digital-product-card__discount">{discountPercent}% OFF</span> : null}
      </div>
      <div className="digital-product-card__overlay" aria-hidden="true">
        <div className="digital-product-card__stats">
          <AggregateRating averageRating={product.averageRating ?? 0} ratingCount={ratingCount} />
          {product.salesCount !== null ? <span className="digital-product-card__sales"><Users size={15} strokeWidth={2} />{product.salesCount.toLocaleString('en-US')} sold</span> : null}
        </div>
        <div className="digital-product-card__copy">
          <Heading className="digital-product-card__title">{product.name}</Heading>
          <p className="digital-product-card__description-preview">{product.description}</p>
        </div>
        <div className="digital-product-card__meta">
          <div className="digital-product-card__price-preview">{referencePrice != null ? <del>{formatRupiah(referencePrice)}</del> : null}<strong>{formatRupiah(product.price_amount)}</strong></div>
        </div>
      </div>
    </Link>
  </article>
}
