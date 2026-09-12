'use client'

import { Search } from 'lucide-react'
import { useState } from 'react'

import { MentorCard } from './mentor-card'
import type { Mentor, MentorTier } from '@/lib/content/mentors'
import { cn } from '@/lib/utils'
import { MentorDetailModal } from './mentor-detail-modal'

type TierFilter = 'Semua' | MentorTier

export function MentorDirectory({ mentors }: { mentors: Mentor[] }) {
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState<TierFilter>('Semua')
  const [selected, setSelected] = useState<Mentor | null>(null)
  const tiers: TierFilter[] = ['Semua', 'Young Professional', 'Top Student']
  const normalized = query.trim().toLocaleLowerCase('id')
  const filtered = mentors.filter((mentor) => {
    const matchesTier = tier === 'Semua' || mentor.tier === tier
    const haystack = [mentor.name, mentor.title, ...mentor.expertise, ...mentor.credentials].filter(Boolean).join(' ').toLocaleLowerCase('id')
    return matchesTier && (!normalized || haystack.includes(normalized))
  })

  return (
    <div>
      <div className="marketing-mentor-toolbar">
        <label className="marketing-mentor-search"><Search aria-hidden="true" size={17} /><span className="sr-only">Cari mentor</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau keahlian" data-testid="mentor-search-input" /></label>
        <div className="marketing-mentor-filters" aria-label="Filter kategori mentor" data-testid="mentor-tier-filter-group">
          {tiers.map((option) => <button aria-pressed={tier === option} className={cn(tier === option && 'is-active')} onClick={() => setTier(option)} type="button" key={option} data-testid={`mentor-tier-${option.toLowerCase().replaceAll(' ', '-')}-button`}>{option}</button>)}
        </div>
      </div>
      <p className="marketing-mentor-result" aria-live="polite" data-testid="mentor-result-count">Menampilkan {filtered.length} mentor</p>
      {filtered.length ? <div className="marketing-mentor-grid marketing-mentor-grid--directory" data-testid="mentor-directory-grid">{filtered.map((mentor, index) => <MentorCard mentor={mentor} index={index} onSelect={setSelected} key={mentor.slug} />)}</div> : <p className="marketing-mentor-empty" data-testid="mentor-empty-state">Belum ada mentor yang cocok dengan pencarian ini.</p>}
      <MentorDetailModal mentor={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
