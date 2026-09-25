'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { PublicPublication } from '@/lib/content/editorial'
import { filterPublications, type PublicationSort } from '@/lib/content/editorial-filters'

function PublicationCard({ item, featured = false }: { item: PublicPublication; featured?: boolean }) {
  return <article className={featured ? 'editorial-card editorial-card--featured' : 'editorial-card'}>{item.coverUrl ? <img src={item.coverUrl} alt={item.cover_alt_text ?? ''} /> : <div className="editorial-card__cover-fallback" aria-hidden="true">Strativate</div>}<div>{item.category ? <span className="editorial-card__category">{item.category}</span> : null}<small>{item.published_at ? new Intl.DateTimeFormat('en-US',{dateStyle:'medium'}).format(new Date(`${item.published_at}T00:00:00`)) : 'Published by Strativate'}</small><h3>{item.title}</h3><p>{item.excerpt}</p><Link className="marketing-text-link" href={`/publications/${item.slug}`}>Read more <span aria-hidden="true">→</span></Link></div></article>
}

export function PublicationDirectory({ publications }: { publications: PublicPublication[] }) {
  const [query,setQuery]=useState('')
  const [category,setCategory]=useState('all')
  const [sort,setSort]=useState<PublicationSort>('newest')
  const categories=useMemo(()=>Array.from(new Set(publications.map(item=>item.category).filter((value): value is string=>Boolean(value)))).sort(),[publications])
  const featured=publications.filter(item=>item.is_featured)
  const filtered=useMemo(()=>filterPublications(publications,{query,category,sort}),[publications,query,category,sort])
  return <div className="editorial-directory" data-testid="publication-directory">
    <section className="editorial-featured" data-testid="publication-featured-section"><div className="marketing-section-head"><div><p className="marketing-kicker">Featured</p><h2>Featured Stories</h2></div></div>{featured.length?<div className="editorial-featured__grid">{featured.map(item=><PublicationCard key={item.id} item={item} featured />)}</div>:<div className="editorial-empty"><strong>No featured stories yet.</strong><span>Featured publications will appear here after approval.</span></div>}</section>
    <section className="editorial-all" data-testid="publication-all-section"><div className="marketing-section-head"><div><p className="marketing-kicker">All Publications</p><h2>Explore Publications & News</h2></div></div>
      <div className="editorial-filterbar"><label><Search aria-hidden="true" size={17}/><span className="sr-only">Search publications</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search publications" data-testid="publication-search"/></label><label><span className="sr-only">Publication category</span><select value={category} onChange={e=>setCategory(e.target.value)} data-testid="publication-category-filter"><option value="all">All categories</option>{categories.map(value=><option value={value} key={value}>{value}</option>)}</select></label><label><SlidersHorizontal aria-hidden="true" size={17}/><span className="sr-only">Sort publications</span><select value={sort} onChange={e=>setSort(e.target.value as PublicationSort)} data-testid="publication-sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title A–Z</option></select></label></div>
      <p className="editorial-result" aria-live="polite">{filtered.length} publication{filtered.length===1?'':'s'}</p>
      {filtered.length?<div className="editorial-grid">{filtered.map(item=><PublicationCard key={item.id} item={item}/>)}</div>:<div className="editorial-empty"><strong>No publications match these filters.</strong><span>Try a different search or category.</span></div>}
    </section>
  </div>
}
