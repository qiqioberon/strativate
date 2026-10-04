'use client'

import { ArrowUpRight, Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { formatRupiah } from '@/lib/commerce/money'
import type { PublicDigitalProduct } from '@/lib/commerce/types'

type Sort = 'newest' | 'name' | 'price-low' | 'price-high'
type FormatFilter = 'all' | 'pdf' | 'video'

export function DigitalProductDirectory({ products }: { products: PublicDigitalProduct[] }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('newest')
  const [contentType, setContentType] = useState<FormatFilter>('all')

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en')
    return products
      .filter(product => (
        (contentType === 'all' || product.content_type === contentType)
        && (!needle || `${product.name} ${product.description}`.toLocaleLowerCase('en').includes(needle))
      ))
      .toSorted((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name)
        if (sort === 'price-low') return a.price_amount - b.price_amount
        if (sort === 'price-high') return b.price_amount - a.price_amount
        return b.created_at.localeCompare(a.created_at)
      })
  }, [contentType, products, query, sort])

  return <div data-testid="digital-product-directory">
    <div className="digital-product-directory__toolbar">
      <label><Search aria-hidden="true" size={17}/><span className="sr-only">Search products</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search digital products" data-testid="digital-product-search"/></label>
      <label><span className="sr-only">Filter by content type</span><select value={contentType} onChange={event => setContentType(event.target.value as FormatFilter)} data-testid="digital-product-content-type-filter"><option value="all">All formats</option><option value="pdf">PDF</option><option value="video">Video</option></select></label>
      <label><SlidersHorizontal aria-hidden="true" size={17}/><span className="sr-only">Sort products</span><select value={sort} onChange={event => setSort(event.target.value as Sort)} data-testid="digital-product-sort"><option value="newest">Newest</option><option value="name">Name</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
    </div>

    {filtered.length === 0 ? (
      <div className="digital-products-empty">
        <h2>No products match your filters.</h2>
        <p>Try another keyword or format, or check back when more products are published.</p>
      </div>
    ) : (
      <div className="marketing-products-directory digital-products-directory">
        {filtered.map(product => (
          <article key={product.id} className="digital-product-card">
            <Link
              className="digital-product-card__link"
              href={`/produk-digital/${product.slug}`}
              aria-label={`View details for ${product.name}`}
            >
              <div className="digital-product-card__cover">
                {product.imageUrl ? (
                  // Public product covers are marketing assets served by Supabase Storage.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt="" loading="lazy"/>
                ) : (
                  <div className="digital-product-card__fallback" aria-hidden="true">
                    <span>Digital Product</span>
                    <strong>{product.name}</strong>
                  </div>
                )}
              </div>

              <div className="digital-product-card__overlay" aria-hidden="true">
                <span className="digital-product-card__format">{product.content_type ? product.content_type.toUpperCase() : 'Digital Product'}</span>
                <div className="digital-product-card__heading">
                  <h2>{product.name}</h2>
                  <ArrowUpRight size={20} strokeWidth={2} />
                </div>
                <p className="digital-product-card__description-preview">{product.description}</p>
                <div className="digital-product-card__meta">
                  <div className="digital-product-card__price-preview">
                    {product.reference_price_amount != null ? <del>{formatRupiah(product.reference_price_amount)}</del> : null}
                    <strong>{formatRupiah(product.price_amount)}</strong>
                  </div>
                  <span>View details</span>
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>
    )}
  </div>
}
