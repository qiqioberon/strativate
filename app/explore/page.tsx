'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react'
import { catalogItems, categories } from '@/lib/catalog'
import { displayLabel } from '@/lib/labels'
import { ProgramComparison } from '@/components/programs/program-comparison'

export default function ExplorePage() {
  const [category, setCategory] = useState<(typeof categories)[number]>('All')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('Featured')
  const items = useMemo(() => catalogItems.filter((item) => (category === 'All' || item.category === category) && `${item.title} ${item.description} ${item.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'Price low to high' ? a.price - b.price : sort === 'Price high to low' ? b.price - a.price : Number(Boolean(b.featured)) - Number(Boolean(a.featured))), [category, query, sort])
  return <main className="catalog-page">
    <header className="catalog-hero"><div><p className="kicker">STRATIVATE / PILIH PROGRAM</p><h1>Temukan dukungan<br /><em>untuk targetmu.</em></h1><p className="catalog-lede">Bandingkan mentoring, kelas, dan materi belajar yang membantumu menyusun strategi, melatih ide, dan tampil lebih siap.</p></div><div className="catalog-hero-note"><span>04</span><p>cara belajar<br />bersama Strativate</p></div></header>
    <section className="catalog-toolbar"><div className="category-pills">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{displayLabel(item)}</button>)}</div><div className="catalog-actions"><label className="search-control"><Search size={15} /><input aria-label="Cari program" placeholder="Cari program" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="sort-control"><SlidersHorizontal size={15} /><select aria-label="Urutkan program" value={sort} onChange={(event) => setSort(event.target.value)}><option value="Featured">Unggulan</option><option value="Price low to high">Harga terendah</option><option value="Price high to low">Harga tertinggi</option></select></label></div></section>
    <section className="catalog-grid">{items.map((item) => <article className="catalog-card" key={item.id}><div className="catalog-card-top"><span>{item.kicker}</span><span>{displayLabel(item.category)}</span></div><div><h2>{item.title}</h2><p>{item.description}</p></div><div className="catalog-card-meta"><span>{item.format}</span><strong>{item.priceLabel}</strong></div><div className="tag-row">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><Link href={`/program/${item.slug}`} className="catalog-card-link">Lihat program <ArrowRight size={15} /></Link></article>)}</section>
    {!items.length && <div className="empty-state"><h2>Tidak ada program yang sesuai dengan pencarianmu.</h2><p>Coba kategori atau kata pencarian lain.</p></div>}
    <ProgramComparison />
  </main>
}
