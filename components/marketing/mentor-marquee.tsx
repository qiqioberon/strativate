'use client'

import { Award } from 'lucide-react'
import Link from 'next/link'
import { useState, type MouseEvent } from 'react'

import { AssetMedia } from './asset-media'
import { MentorDetailModal } from './mentor-detail-modal'
import type { Mentor } from '@/lib/content/mentors'

function MentorMarqueeGroup({ mentors, duplicate = false, onSelect }: { mentors: Mentor[]; duplicate?: boolean; onSelect: (mentor: Mentor) => void }) {
  function openMentor(event: MouseEvent<HTMLAnchorElement>, mentor: Mentor) {
    event.preventDefault()
    onSelect(mentor)
  }

  return (
    <div className="marketing-mentor-marquee__group" aria-hidden={duplicate || undefined}>
      {mentors.map((mentor) => (
        <Link
          className="marketing-mentor-marquee__card"
          href={`/mentor#mentor-${mentor.slug}`}
          key={`${duplicate ? 'copy-' : ''}${mentor.slug}`}
          tabIndex={duplicate ? -1 : undefined}
          data-testid={duplicate ? undefined : `mentor-marquee-card-${mentor.slug}`}
          aria-label={duplicate ? undefined : `Lihat detail ${mentor.name}`}
          onClick={(event) => openMentor(event, mentor)}
        >
          <div className="marketing-mentor-marquee__portrait"><AssetMedia assetKey={mentor.portrait} sizes="108px" /></div>
          <div className="marketing-mentor-marquee__content">
            <div className="marketing-mentor-marquee__identity">
              <span className="marketing-mentor-marquee__tier">{mentor.tier ?? 'Mentor Strativate'}</span>
              <strong className="marketing-mentor-marquee__name">{mentor.name}</strong>
            </div>
            <div className="marketing-mentor-marquee__details">
              {mentor.title ? <small className="marketing-mentor-marquee__title">{mentor.title}</small> : null}
              <ul className="marketing-mentor-marquee__credentials">
                {mentor.credentials.slice(0, 2).map((credential) => <li key={credential}><Award aria-hidden="true" size={12} /> {credential}</li>)}
              </ul>
              {mentor.expertise.length ? <div className="marketing-mentor-marquee__expertise">{mentor.expertise.slice(0, 2).map((expertise) => <span key={expertise}>{expertise}</span>)}</div> : null}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

export function MentorMarquee({ mentors }: { mentors: Mentor[] }) {
  const [selected, setSelected] = useState<Mentor | null>(null)

  return (
    <>
      <div className="marketing-mentor-marquee" data-testid="mentor-infinite-marquee">
        <div className="marketing-mentor-marquee__track">
          <MentorMarqueeGroup mentors={mentors} onSelect={setSelected} />
          <MentorMarqueeGroup mentors={mentors} duplicate onSelect={setSelected} />
        </div>
      </div>
      <MentorDetailModal mentor={selected} onClose={() => setSelected(null)} />
    </>
  )
}
