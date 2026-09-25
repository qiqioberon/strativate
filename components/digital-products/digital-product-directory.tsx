'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { formatRupiah } from '@/lib/commerce/money'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import type { DigitalPurchaseMode } from '@/lib/commerce/purchase-mode'

import { AddToCartButton } from './add-to-cart-button'

type Sort = 'newest' | 'name' | 'price-low' | 'price-high'
type FormatFilter = 'all' | 'pdf' | 'video'

export function DigitalProductDirectory({ products, purchaseMode }: { products: PublicDigitalProduct[]; purchaseMode: DigitalPurchaseMode }) {
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
    {filtered.length === 0 ? <div className="digital-products-empty"><h2>No products match your filters.</h2><p>Try another keyword or format, or check back when more products are published.</p></div> : <div className="marketing-products-directory digital-products-directory">{filtered.map(product => <article key={product.id} className="digital-product-card"><Link className="digital-product-cover" href={`/produk-digital/${product.slug}`} aria-label={`View ${product.name}`}>{product.imageUrl ? <img src={product.imageUrl} alt={`Cover of ${product.name}`} loading="lazy"/> : <div className="digital-product-cover__fallback" aria-hidden="true">Strativate</div>}</Link><div className="digital-product-card__body"><span className="marketing-kicker">{product.content_type ? product.content_type.toUpperCase() : 'Digital Product'}</span><h2>{product.name}</h2><p className="digital-product-card__description">{product.description}</p><div className="digital-product-card__price"><span>Price</span><strong>{formatRupiah(product.price_amount)}</strong></div>{product.salesCount !== null ? <p className="digital-product-card__sales">{product.salesCount.toLocaleString('en-US')} sold</p> : null}<div className="digital-product-card__actions"><Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/produk-digital/${product.slug}`}>View details</Link><AddToCartButton commerceItemId={product.id} purchaseMode={purchaseMode} compact/></div></div></article>)}</div>}
  </div>
}
