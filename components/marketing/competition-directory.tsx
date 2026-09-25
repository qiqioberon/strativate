'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { PublicCompetition } from '@/lib/content/editorial'
import { filterCompetitions, type CompetitionSort } from '@/lib/content/editorial-filters'

export function CompetitionDirectory({ competitions }: { competitions: PublicCompetition[] }) {
  const [query,setQuery]=useState('')
  const [categoryId,setCategoryId]=useState('all')
  const [status,setStatus]=useState('all')
  const [sort,setSort]=useState<CompetitionSort>('deadline')
  const categories=useMemo(()=>Array.from(new Map(competitions.filter(item=>item.category_id&&item.categoryName).map(item=>[item.category_id!,item.categoryName!])).entries()),[competitions])
  const filtered=useMemo(()=>filterCompetitions(competitions,{query,categoryId,status,sort}),[competitions,query,categoryId,status,sort])
  return <div className="editorial-directory" data-testid="competition-directory">
    <div className="editorial-filterbar"><label><Search aria-hidden="true" size={17}/><span className="sr-only">Search competitions</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search competitions" data-testid="competition-search"/></label><label><span className="sr-only">Competition category</span><select value={categoryId} onChange={e=>setCategoryId(e.target.value)} data-testid="competition-category-filter"><option value="all">All categories</option>{categories.map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label><label><span className="sr-only">Competition status</span><select value={status} onChange={e=>setStatus(e.target.value)} data-testid="competition-status-filter"><option value="all">All statuses</option><option value="upcoming">Upcoming</option><option value="open">Open</option><option value="closed">Closed</option></select></label><label><SlidersHorizontal aria-hidden="true" size={17}/><span className="sr-only">Sort competitions</span><select value={sort} onChange={e=>setSort(e.target.value as CompetitionSort)} data-testid="competition-sort"><option value="deadline">Nearest deadline</option><option value="newest">Newest</option><option value="name">Name A–Z</option></select></label></div>
    <p className="editorial-result" aria-live="polite">{filtered.length} competition{filtered.length===1?'':'s'}</p>
    {filtered.length?<div className="editorial-grid">{filtered.map(item=><article className={item.is_featured?'editorial-card editorial-card--featured':'editorial-card'} key={item.id}>{item.coverUrl?<img src={item.coverUrl} alt={item.cover_alt_text??''}/>:<div className="editorial-card__cover-fallback" aria-hidden="true">Strativate</div>}<div><div className="editorial-card__badges"><span>{item.status.replace('_',' ')}</span>{item.categoryName?<span>{item.categoryName}</span>:null}</div><h2>{item.name}</h2><p>{item.description}</p>{item.registration_deadline?<small>Registration deadline: {new Intl.DateTimeFormat('en-US',{dateStyle:'medium'}).format(new Date(`${item.registration_deadline}T00:00:00`))}</small>:null}<Link className="marketing-text-link" href={`/competitions/${item.slug}`}>View competition <span aria-hidden="true">→</span></Link></div></article>)}</div>:<div className="editorial-empty"><strong>No competitions match these filters.</strong><span>Try a different search, category, or status.</span></div>}
  </div>
}
