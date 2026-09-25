'use client'

import { RotateCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { PublicMentor } from '@/lib/mentor/public-profile-types'
import { cn } from '@/lib/utils'

import { MentorCard } from './mentor-card'
import { MentorDetailModal } from './mentor-detail-modal'

type TierFilter = 'All' | string

export function MentorDirectory({ mentors }: { mentors: PublicMentor[] }) {
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState<TierFilter>('All')
  const [selected, setSelected] = useState<PublicMentor | null>(null)
  const tiers = useMemo<TierFilter[]>(() => ['All', ...new Set(mentors.map(mentor => mentor.tier).filter((value): value is string => Boolean(value)))], [mentors])
  const normalized = query.trim().toLocaleLowerCase('en')
  const filtered = mentors.filter((mentor) => {
    const matchesTier = tier === 'All' || mentor.tier === tier
    const haystack = [mentor.name, mentor.title, ...mentor.expertise, ...mentor.credentials].filter(Boolean).join(' ').toLocaleLowerCase('en')
    return matchesTier && (!normalized || haystack.includes(normalized))
  })
  const hasActiveFilters = Boolean(normalized) || tier !== 'All'

  function resetFilters() {
    setQuery('')
    setTier('All')
  }

  return (
    <div>
      <div className="marketing-mentor-toolbar">
        <label className="marketing-mentor-search"><Search aria-hidden="true" size={17} /><span className="sr-only">Search mentors</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or expertise" data-testid="mentor-search-input" /></label>
        <div className="marketing-mentor-filters" aria-label="Filter mentors" data-testid="mentor-tier-filter-group">
          {tiers.map((option) => <button aria-pressed={tier === option} className={cn(tier === option && 'is-active')} onClick={() => setTier(option)} type="button" key={option} data-testid={`mentor-tier-${option.toLowerCase().replaceAll(' ', '-')}-button`}>{option}</button>)}
        </div>
        {hasActiveFilters ? <button className="marketing-mentor-reset" type="button" onClick={resetFilters} data-testid="mentor-reset-button"><RotateCcw aria-hidden="true" size={15} /> Reset filters</button> : null}
        <p className="marketing-mentor-result" aria-live="polite" data-testid="mentor-result-count">Showing {filtered.length} mentors</p>
      </div>
      {filtered.length ? <div className="marketing-mentor-grid marketing-mentor-grid--directory" data-testid="mentor-directory-grid">{filtered.map((mentor, index) => <MentorCard mentor={mentor} index={index} onSelect={setSelected} key={mentor.slug} />)}</div> : <p className="marketing-mentor-empty" data-testid="mentor-empty-state">No mentors match your search.</p>}
      <MentorDetailModal mentor={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
