import { Star } from 'lucide-react'
import type { CSSProperties } from 'react'

type AggregateRatingVariant = 'catalogue' | 'detail' | 'admin'

type AggregateRatingProps = {
  averageRating: number
  ratingCount: number
  variant?: AggregateRatingVariant
}

export function AggregateRating({ averageRating, ratingCount, variant = 'catalogue' }: AggregateRatingProps) {
  const rating = Math.min(5, Math.max(0, averageRating))
  const label = `${rating.toFixed(1)} out of 5 stars from ${ratingCount.toLocaleString('en-US')} ratings`

  if (variant === 'detail') {
    return <span className="digital-product-rating-aggregate digital-product-rating-aggregate--detail" role="img" aria-label={label}>
      <span className="digital-product-rating-aggregate__stars" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => {
          const fill = Math.min(1, Math.max(0, rating - index)) * 100
          return <span className="digital-product-rating-aggregate__star" key={index} style={{ '--aggregate-star-fill': `${fill}%` } as CSSProperties}>{String.fromCodePoint(0x2605)}</span>
        })}
      </span>
      <strong>{rating.toFixed(1)}</strong>
      <span>({ratingCount.toLocaleString('en-US')})</span>
    </span>
  }

  return <span className={`digital-product-rating-aggregate digital-product-rating-aggregate--${variant}`} role="img" aria-label={label}>
    <Star aria-hidden="true" fill="currentColor" size={variant === 'admin' ? 17 : 14} strokeWidth={0} />
    <strong>{rating.toFixed(1)}</strong>
    {variant === 'catalogue' ? <span>&middot; {ratingCount.toLocaleString('en-US')} ratings</span> : null}
  </span>
}
