'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { MentorCard } from './mentor-card'
import type { Mentor, MentorTier } from '@/lib/content/mentors'
import { cn } from '@/lib/utils'

type TierFilter = 'Semua' | MentorTier

export function MentorDirectory({ mentors }: { mentors: Mentor[] }) {
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState<TierFilter>('Semua')
  const tiers: TierFilter[] = ['Semua', 'Young Professional', 'Top Student']
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('id')
    return mentors.filter((mentor) => {
      const matchesTier = tier === 'Semua' || mentor.tier === tier
      const haystack = [mentor.name, mentor.title, ...mentor.expertise, ...mentor.credentials].filter(Boolean).join(' ').toLocaleLowerCase('id')
      return matchesTier && (!normalized || haystack.includes(normalized))
    })
  }, [mentors, query, tier])

  return (
    <div>
      <div className="marketing-mentor-toolbar">
        <label className="marketing-mentor-search"><Search aria-hidden="true" size={17} /><span className="sr-only">Cari mentor</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau keahlian" /></label>
        <div className="marketing-mentor-filters" aria-label="Filter kategori mentor">
          {tiers.map((option) => <button aria-pressed={tier === option} className={cn(tier === option && 'is-active')} onClick={() => setTier(option)} type="button" key={option}>{option}</button>)}
        </div>
      </div>
      <p className="marketing-mentor-result" aria-live="polite">Menampilkan {filtered.length} mentor</p>
      {filtered.length ? <div className="marketing-mentor-grid marketing-mentor-grid--directory">{filtered.map((mentor, index) => <MentorCard mentor={mentor} index={index} key={mentor.slug} />)}</div> : <p className="marketing-mentor-empty">Belum ada mentor yang cocok dengan pencarian ini.</p>}
    </div>
  )
}
