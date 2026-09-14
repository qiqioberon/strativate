'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react'

export type CatalogBrowserItem = {
  id: string
  title: string
  description: string
  category: string
  categoryLabel: string
  eyebrow?: string
  meta?: string
  href?: string
  order?: number
}

export function CatalogBrowser({ items }: { items: readonly CatalogBrowserItem[] }) {
  const categories = useMemo(() => [
    { value: 'all', label: 'Semua' },
    ...Array.from(new Map(items.map(item => [item.category, item.categoryLabel])).entries()).map(([value, label]) => ({ value, label })),
  ], [items])
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'default' | 'title'>('default')

  const visibleItems = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('id')
    const filtered = items.filter(item =>
      (category === 'all' || item.category === category)
      && (!term || `${item.title} ${item.description} ${item.meta ?? ''}`.toLocaleLowerCase('id').includes(term)),
    )
    return [...filtered].sort((a, b) => sort === 'title'
      ? a.title.localeCompare(b.title, 'id')
      : (a.order ?? 0) - (b.order ?? 0))
  }, [category, items, query, sort])

  return <>
    <section className="catalog-toolbar">
      <div className="category-pills">{categories.map(item => <button type="button" key={item.value} className={category === item.value ? 'active' : ''} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div>
      <div className="catalog-actions">
        <label className="search-control"><Search size={15} /><input aria-label="Cari" placeholder="Cari" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="sort-control"><SlidersHorizontal size={15} /><select aria-label="Urutkan" value={sort} onChange={(event) => setSort(event.target.value as 'default' | 'title')}><option value="default">Urutan awal</option><option value="title">Nama A–Z</option></select></label>
      </div>
    </section>
    <section className="catalog-grid">{visibleItems.map(item => <article className="catalog-card" key={item.id}>
      <div className="catalog-card-top"><span>{item.eyebrow ?? 'Strativate'}</span><span>{item.categoryLabel}</span></div>
      <div><h2>{item.title}</h2><p>{item.description}</p></div>
      {item.meta ? <div className="catalog-card-meta"><span>{item.meta}</span></div> : null}
      {item.href ? <Link href={item.href} className="catalog-card-link">Lihat detail <ArrowRight size={15} /></Link> : <span className="catalog-card-link" aria-disabled="true">Informasi belum tersedia</span>}
    </article>)}</section>
    {!visibleItems.length && <div className="empty-state"><h2>{items.length ? 'Tidak ada item yang sesuai dengan pencarianmu.' : 'Konten sedang disiapkan.'}</h2><p>{items.length ? 'Coba kategori atau kata pencarian lain.' : 'Belum ada informasi yang tersedia untuk ditampilkan.'}</p></div>}
  </>
}
