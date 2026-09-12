'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react'
import { sortCatalogProducts, type CatalogSort } from '@/lib/catalog/assemble'
import { catalogPriceLabel, catalogProductTypeLabels } from '@/lib/catalog/presentation'
import type { CatalogProductSummary, CatalogProductType } from '@/lib/catalog/types'
import { featureFlags } from '@/lib/features'

const categories: Array<{ value: 'all' | CatalogProductType; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'private_mentoring', label: 'Private Mentoring' },
  { value: 'intensive_mentoring', label: 'Intensive Mentoring' },
  { value: 'big_class', label: 'Kelas Besar' },
  ...(featureFlags.digitalProducts ? [{ value: 'digital_product' as const, label: 'Produk Digital' }] : []),
]

export function CatalogBrowser({ products }: { products: CatalogProductSummary[] }) {
  const [category, setCategory] = useState<'all' | CatalogProductType>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<CatalogSort>('featured')
  const visibleProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('id')
    return sortCatalogProducts(products.filter((product) =>
      (featureFlags.digitalProducts || product.productType !== 'digital_product')
      &&
      (category === 'all' || product.productType === category)
      && (!term || `${product.title} ${product.shortDescription}`.toLocaleLowerCase('id').includes(term)),
    ), sort)
  }, [category, products, query, sort])

  return <>
    <section className="catalog-toolbar"><div className="category-pills">{categories.map((item) => <button key={item.value} className={category === item.value ? 'active' : ''} onClick={() => setCategory(item.value)} data-testid={`catalog-category-${item.value}-button`}>{item.label}</button>)}</div><div className="catalog-actions"><label className="search-control"><Search size={15} /><input aria-label="Cari program" placeholder="Cari program" value={query} onChange={(event) => setQuery(event.target.value)} data-testid="catalog-search-input" /></label><label className="sort-control"><SlidersHorizontal size={15} /><select aria-label="Urutkan program" value={sort} onChange={(event) => setSort(event.target.value as CatalogSort)} data-testid="catalog-sort-select"><option value="featured">Unggulan</option><option value="price_asc">Harga terendah</option><option value="price_desc">Harga tertinggi</option><option value="title">Nama A–Z</option></select></label></div></section>
    <section className="catalog-grid">{visibleProducts.map((product) => <article className="catalog-card" key={product.id}><div className="catalog-card-top"><span>Program Strativate</span><span>{catalogProductTypeLabels[product.productType]}</span></div><div><h2>{product.title}</h2><p>{product.shortDescription}</p></div><div className="catalog-card-meta"><span>{product.defaultPurchaseFlow === 'consultation_offer' ? 'Konsultasi bersama tim' : 'Pembelian langsung'}</span><strong>{catalogPriceLabel(product)}</strong></div><Link href={`/program/${product.slug}`} className="catalog-card-link">Lihat program <ArrowRight size={15} /></Link></article>)}</section>
    {!visibleProducts.length && <div className="empty-state"><h2>{products.length ? 'Tidak ada program yang sesuai dengan pencarianmu.' : 'Program sedang disiapkan.'}</h2><p>{products.length ? 'Coba kategori atau kata pencarian lain.' : 'Belum ada program yang dipublikasikan. Silakan kembali lagi nanti.'}</p></div>}
  </>
}
