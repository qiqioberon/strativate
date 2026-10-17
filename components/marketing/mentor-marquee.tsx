'use client'

import Link from 'next/link'
import { useRef, useState, type CSSProperties, type MouseEvent } from 'react'

import type { PublicMentor } from '@/lib/mentor/public-profile-types'

import { MentorDetailModal } from './mentor-detail-modal'
import { MentorMarqueeCardBody, hasPublishedPortrait, mentorInitials, mentorRole, mentorRoleIconSrc } from './mentor-marquee-card'
import { useMentorMarqueeExpansion } from './mentor-marquee-motion'

function MentorMarqueeGroup({ mentors, duplicate = false, onSelect }: { mentors: PublicMentor[]; duplicate?: boolean; onSelect: (mentor: PublicMentor) => void }) {
  function openMentor(event: MouseEvent<HTMLAnchorElement>, mentor: PublicMentor) {
    // Modified and middle clicks keep the link's own behaviour (open /mentor in a new tab or window).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    onSelect(mentor)
  }

  return (
    <div className="marketing-mentor-marquee__group" aria-hidden={duplicate || undefined}>
      {mentors.map((mentor, index) => (
        <Link
          className="marketing-mentor-marquee__card"
          href={`/mentor#mentor-${mentor.slug}`}
          key={`${duplicate ? 'copy-' : ''}${mentor.slug}`}
          tabIndex={duplicate ? -1 : undefined}
          data-testid={duplicate ? undefined : `mentor-marquee-card-${mentor.slug}`}
          data-role={mentorRole(mentor.tier)}
          aria-label={duplicate ? undefined : `View details for ${mentor.name}`}
          onClick={(event) => openMentor(event, mentor)}
        >
          <MentorMarqueeCardBody mentor={mentor} index={index} />
        </Link>
      ))}
    </div>
  )
}

export function MentorMarquee({ mentors }: { mentors: PublicMentor[] }) {
  const [selected, setSelected] = useState<PublicMentor | null>(null)
  const marqueeRef = useRef<HTMLDivElement>(null)
  useMentorMarqueeExpansion(marqueeRef, mentors.length)
  const selectedRole = selected ? mentorRole(selected.tier) : null
  const dialogStyle = selected && selectedRole
    ? ({
        '--role-icon': `url("${mentorRoleIconSrc(selectedRole)}")`,
        // Without an approved photo the dialog repeats the card's monogram instead of the shared fallback image.
        ...(hasPublishedPortrait(selected) ? null : { '--mentor-monogram': `"${mentorInitials(selected.name).replace(/["\\]/g, '')}"` }),
      } as CSSProperties)
    : undefined

  if (!mentors.length) return <p className="marketing-mentor-empty" data-testid="mentor-marquee-empty-state">Public mentor profiles are being prepared.</p>

  return (
    <>
      <div
        ref={marqueeRef}
        className="marketing-mentor-marquee"
        data-testid="mentor-infinite-marquee"
        data-paused={selected ? '' : undefined}
        style={{ '--mentor-count': mentors.length } as CSSProperties}
      >
        <div className="marketing-mentor-marquee__track">
          <MentorMarqueeGroup mentors={mentors} onSelect={setSelected} />
          <MentorMarqueeGroup mentors={mentors} duplicate onSelect={setSelected} />
        </div>
      </div>
      {/* Layout-free wrapper: lets the shared dialog's tier sticker match the card's role colours, icon and monogram. */}
      <div className="marketing-mentor-marquee__dialog" data-role={selectedRole ?? undefined} style={dialogStyle}>
        <MentorDetailModal mentor={selected} onClose={() => setSelected(null)} />
      </div>
    </>
  )
}
