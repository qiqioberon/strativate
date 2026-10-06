'use client'

import { ArrowRight, CalendarDays, Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { PublicCompetition } from '@/lib/content/editorial'
import { filterCompetitions, type CompetitionSort } from '@/lib/content/editorial-filters'
import { CompetitionBadges } from './competition-badges'

export function CompetitionDirectory({ competitions }: { competitions: PublicCompetition[] }) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<CompetitionSort>('deadline')

  const categories = useMemo(
    () => Array.from(new Map(competitions.filter(item => item.category_id && item.categoryName).map(item => [item.category_id!, item.categoryName!])).entries()),
    [competitions],
  )
  const filtered = useMemo(
    () => filterCompetitions(competitions, { query, categoryId, status, sort }),
    [competitions, query, categoryId, status, sort],
  )

  return <div className="editorial-directory editorial-directory--competitions" data-testid="competition-directory">
    <div className="editorial-filterbar">
      <label>
        <Search aria-hidden="true" size={17} />
        <span className="sr-only">Search competitions</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search competitions" data-testid="competition-search" />
      </label>
      <label>
        <span className="sr-only">Competition category</span>
        <select value={categoryId} onChange={event => setCategoryId(event.target.value)} data-testid="competition-category-filter">
          <option value="all">All categories</option>
          {categories.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
        </select>
      </label>
      <label>
        <span className="sr-only">Competition status</span>
        <select value={status} onChange={event => setStatus(event.target.value)} data-testid="competition-status-filter">
          <option value="all">All statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label>
        <SlidersHorizontal aria-hidden="true" size={17} />
        <span className="sr-only">Sort competitions</span>
        <select value={sort} onChange={event => setSort(event.target.value as CompetitionSort)} data-testid="competition-sort">
          <option value="deadline">Nearest deadline</option>
          <option value="newest">Newest</option>
          <option value="name">Name A–Z</option>
        </select>
      </label>
    </div>
    <p className="editorial-result" aria-live="polite">{filtered.length} competition{filtered.length === 1 ? '' : 's'}</p>
    {filtered.length
      ? <div className="editorial-grid editorial-grid--competitions">
        {filtered.map(item => <Link
          className={item.is_featured ? 'editorial-card editorial-card--competition editorial-card--featured-subtle' : 'editorial-card editorial-card--competition'}
          href={`/competitions/${item.slug}`}
          key={item.id}
          aria-label={`View competition ${item.name}`}
        >
          <div className="editorial-card__media">
            {item.coverUrl
              ? <img src={item.coverUrl} alt={item.cover_alt_text ?? ''} />
              : <div className="editorial-card__cover-fallback" aria-hidden="true">Strativate</div>}
          </div>
          <div className="editorial-card__content">
            <CompetitionBadges status={item.status} category={item.categoryName} />
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            {item.registration_deadline ? <div className="editorial-competition-card__deadline">
              <CalendarDays aria-hidden="true" size={16} />
              <div>
                <span>Registration deadline</span>
                <time dateTime={item.registration_deadline}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(`${item.registration_deadline}T00:00:00`))}</time>
              </div>
            </div> : null}
            <span className="editorial-competition-card__action">View competition <ArrowRight aria-hidden="true" size={16} /></span>
          </div>
        </Link>)}
      </div>
      : <div className="editorial-empty"><strong>No competitions match these filters.</strong><span>Try a different search, category, or status.</span></div>}
  </div>
}
