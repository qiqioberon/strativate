'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { DigitalProductCard } from './digital-product-card'

type Sort = 'newest' | 'name' | 'price-low' | 'price-high'
type FormatFilter = 'all' | 'pdf' | 'video'

const typeSections = [
  { type: 'pdf', label: 'PDF' },
  { type: 'video', label: 'Video' },
  { type: 'other', label: 'Other' },
] as const

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

    <p className="digital-product-directory__count" aria-live="polite" data-testid="digital-product-count">
      Showing <strong>{filtered.length}</strong> {filtered.length === 1 ? 'product' : 'products'}
    </p>

    {filtered.length === 0 ? (
      <div className="digital-products-empty">
        <h2>No products match your filters.</h2>
        <p>Try another keyword or format, or check back when more products are published.</p>
      </div>
    ) : (
      <div className="digital-product-directory__sections">
        {typeSections.map(section => {
          const items = filtered.filter(product => (product.content_type ?? 'other') === section.type)
          if (items.length === 0) return null
          return <section className={`digital-product-directory__section digital-product-directory__section--${section.type}`} key={section.type} aria-labelledby={`digital-product-section-${section.type}`}>
            <h2 className="digital-product-directory__section-title" id={`digital-product-section-${section.type}`}>{section.label}</h2>
            <div className="marketing-products-directory digital-products-directory">
              {items.map(product => <DigitalProductCard key={product.id} product={product} headingLevel="h3" />)}
            </div>
          </section>
        })}
      </div>
    )}
  </div>
}
