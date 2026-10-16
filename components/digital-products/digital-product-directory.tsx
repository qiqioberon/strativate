'use client'

import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, LayoutGrid, Search, SlidersHorizontal, Video, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { formatRupiah } from '@/lib/commerce/money'
import type { PublicDigitalProduct } from '@/lib/commerce/types'
import { DigitalProductCard } from './digital-product-card'

type Sort = 'newest' | 'name' | 'price-low' | 'price-high'
type FormatFilter = 'all' | 'pdf' | 'video'

const formatOptions = [
  { value: 'all', label: 'All formats', Icon: LayoutGrid },
  { value: 'video', label: 'Video', Icon: Video },
  { value: 'pdf', label: 'PDF', Icon: FileText },
] as const

const sortOptions = [
  { value: 'newest', label: 'Newest', Icon: Clock },
  { value: 'name', label: 'Name (A–Z)', Icon: ArrowDownAZ },
  { value: 'price-low', label: 'Price: low to high', Icon: ArrowUpNarrowWide },
  { value: 'price-high', label: 'Price: high to low', Icon: ArrowDownWideNarrow },
] as const

const typeSections = [
  { type: 'pdf', label: 'PDF' },
  { type: 'video', label: 'Video' },
  { type: 'other', label: 'Other' },
] as const

const PRICE_STEP = 1000

export function DigitalProductDirectory({ products }: { products: PublicDigitalProduct[] }) {
  const priceCeiling = useMemo(() => Math.ceil(Math.max(0, ...products.map(product => product.price_amount)) / PRICE_STEP) * PRICE_STEP, [products])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('newest')
  const [contentType, setContentType] = useState<FormatFilter>('all')
  const [priceMin, setPriceMin] = useState(0)
  const [priceMax, setPriceMax] = useState(priceCeiling)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en')
    const low = Math.min(priceMin, priceMax)
    const high = Math.max(priceMin, priceMax)
    return products
      .filter(product => (
        (contentType === 'all' || product.content_type === contentType)
        && product.price_amount >= low && product.price_amount <= high
        && (!needle || `${product.name} ${product.description}`.toLocaleLowerCase('en').includes(needle))
      ))
      .toSorted((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name)
        if (sort === 'price-low') return a.price_amount - b.price_amount
        if (sort === 'price-high') return b.price_amount - a.price_amount
        return b.created_at.localeCompare(a.created_at)
      })
  }, [contentType, priceMax, priceMin, products, query, sort])

  const clampPrice = (value: number) => Math.min(priceCeiling, Math.max(0, Number.isFinite(value) ? Math.round(value) : 0))
  const rangeStyle = { '--range-start': `${priceCeiling ? (Math.min(priceMin, priceMax) / priceCeiling) * 100 : 0}%`, '--range-end': `${priceCeiling ? (Math.max(priceMin, priceMax) / priceCeiling) * 100 : 100}%` } as CSSProperties

  return <div className="digital-product-directory" data-testid="digital-product-directory">
    <label className="digital-product-directory__search">
      <Search aria-hidden="true" size={19}/>
      <span className="sr-only">Search products</span>
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search digital products" data-testid="digital-product-search"/>
      {query ? <button type="button" className="digital-product-directory__clear" onClick={() => setQuery('')} aria-label="Clear search"><X aria-hidden="true" size={15}/></button> : null}
    </label>

    <button type="button" className="digital-product-directory__filter-toggle" aria-expanded={filtersOpen} aria-controls="digital-product-filters" onClick={() => setFiltersOpen(open => !open)}>
      <SlidersHorizontal aria-hidden="true" size={17}/>Filter &amp; Sort<ChevronDown aria-hidden="true" size={16}/>
    </button>

    <div className="digital-product-directory__layout">
      <aside className="digital-product-directory__sidebar" id="digital-product-filters" data-open={filtersOpen}>
        <h2 className="digital-product-directory__sidebar-title"><SlidersHorizontal aria-hidden="true" size={18}/>Filter &amp; Sort</h2>

        <FilterPanel title="Product type">
          <div className="digital-product-directory__options" role="group" aria-label="Filter by content type" data-testid="digital-product-content-type-filter">
            {formatOptions.map(option => <OptionButton key={option.value} active={contentType === option.value} onClick={() => setContentType(option.value)} Icon={option.Icon} label={option.label}/>)}
          </div>
        </FilterPanel>

        <FilterPanel title="Price range">
          <div className="digital-product-directory__price" data-testid="digital-product-price-range">
            <div className="digital-product-directory__price-bounds"><span>{formatRupiah(0)}</span><span>{formatRupiah(priceCeiling)}</span></div>
            <div className="digital-product-directory__range" style={rangeStyle}>
              <input type="range" min={0} max={priceCeiling} step={PRICE_STEP} value={priceMin} disabled={!priceCeiling} onChange={event => setPriceMin(Math.min(Number(event.target.value), priceMax))} aria-label="Minimum price"/>
              <input type="range" min={0} max={priceCeiling} step={PRICE_STEP} value={priceMax} disabled={!priceCeiling} onChange={event => setPriceMax(Math.max(Number(event.target.value), priceMin))} aria-label="Maximum price"/>
            </div>
            <div className="digital-product-directory__price-inputs">
              <label><span>Rp</span><input type="number" inputMode="numeric" min={0} max={priceCeiling} step={PRICE_STEP} value={priceMin} onChange={event => setPriceMin(clampPrice(event.target.valueAsNumber))} aria-label="Minimum price in rupiah"/></label>
              <span aria-hidden="true">–</span>
              <label><span>Rp</span><input type="number" inputMode="numeric" min={0} max={priceCeiling} step={PRICE_STEP} value={priceMax} onChange={event => setPriceMax(clampPrice(event.target.valueAsNumber))} aria-label="Maximum price in rupiah"/></label>
            </div>
          </div>
        </FilterPanel>

        <FilterPanel title="Sort">
          <div className="digital-product-directory__options" role="group" aria-label="Sort products" data-testid="digital-product-sort">
            {sortOptions.map(option => <OptionButton key={option.value} active={sort === option.value} onClick={() => setSort(option.value)} Icon={option.Icon} label={option.label}/>)}
          </div>
        </FilterPanel>
      </aside>

      <div className="digital-product-directory__results">
        <p className="digital-product-directory__count" aria-live="polite" data-testid="digital-product-count">
          Showing <strong>{filtered.length}</strong> {filtered.length === 1 ? 'product' : 'products'}
        </p>

        {filtered.length === 0 ? (
          <div className="digital-products-empty">
            <h2>No products match your filters.</h2>
            <p>Try another keyword, format, or price range, or check back when more products are published.</p>
          </div>
        ) : (
          <div className="digital-product-directory__sections">
            {typeSections.map(section => {
              const items = filtered.filter(product => (product.content_type ?? 'other') === section.type)
              if (items.length === 0) return null
              return <section className={`digital-product-directory__section digital-product-directory__section--${section.type}`} key={section.type} aria-labelledby={`digital-product-section-${section.type}`}>
                <h2 className="digital-product-directory__section-title" id={`digital-product-section-${section.type}`}>{section.label}</h2>
                <ProductRow label={section.label} products={items}/>
              </section>
            })}
          </div>
        )}
      </div>
    </div>
  </div>
}

function FilterPanel({ title, children }: { title: string; children: ReactNode }) {
  return <details className="digital-product-directory__panel" open>
    <summary>{title}<ChevronDown aria-hidden="true" size={16}/></summary>
    {children}
  </details>
}

function OptionButton({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof Search; label: string }) {
  return <button type="button" className="digital-product-directory__option" aria-pressed={active} onClick={onClick}>
    <span className="digital-product-directory__option-icon"><Icon aria-hidden="true" size={15}/></span>
    {label}
  </button>
}

function ProductRow({ label, products }: { label: string; products: PublicDigitalProduct[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrevious, setCanPrevious] = useState(false)
  const [canNext, setCanNext] = useState(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const sync = () => {
      setCanPrevious(track.scrollLeft > 4)
      setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4)
    }
    sync()
    track.addEventListener('scroll', sync, { passive: true })
    const observer = new ResizeObserver(sync)
    observer.observe(track)
    return () => {
      track.removeEventListener('scroll', sync)
      observer.disconnect()
    }
  }, [products])

  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollBy({ left: direction * track.clientWidth * .8, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return <div className="digital-product-directory__row">
    <div className="digital-product-directory__track" ref={trackRef}>
      {products.map(product => <DigitalProductCard key={product.id} product={product} headingLevel="h3"/>)}
    </div>
    {canPrevious ? <button type="button" className="digital-product-directory__arrow digital-product-directory__arrow--previous" onClick={() => scroll(-1)} aria-label={`Previous ${label} products`}><ChevronLeft aria-hidden="true" size={20}/></button> : null}
    {canNext ? <button type="button" className="digital-product-directory__arrow digital-product-directory__arrow--next" onClick={() => scroll(1)} aria-label={`Next ${label} products`}><ChevronRight aria-hidden="true" size={20}/></button> : null}
  </div>
}
