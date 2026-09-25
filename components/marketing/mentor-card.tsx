import { Award, ExternalLink } from 'lucide-react'

import type { PublicMentor } from '@/lib/mentor/public-profile-types'

import { MentorPortraitMedia } from './mentor-portrait-media'

export function MentorCard({ mentor, index, onSelect }: { mentor: PublicMentor; index: number; onSelect?: (mentor: PublicMentor) => void }) {
  return (
    <article id={`mentor-${mentor.slug}`} className="marketing-mentor-card" data-testid={`mentor-card-${mentor.slug}`}>
      <div className="marketing-mentor-card__media">
        <MentorPortraitMedia mentor={mentor} sizes="(max-width: 760px) 88vw, 28vw" priority={index < 4} />
        <span className="marketing-mentor-card__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="marketing-mentor-card__content">
        <span className="marketing-mentor-card__status">{mentor.tier ?? 'Strativate Mentor'}</span>
        <h3>{mentor.name}</h3>
        {mentor.title && <p>{mentor.title}</p>}
        <div className="marketing-mentor-card__meta">
          {mentor.credentials.slice(0, 2).map((credential) => <span key={credential}><Award aria-hidden="true" size={14} />{credential}</span>)}
        </div>
        <div className="marketing-mentor-card__expertise">{mentor.expertise.map(item => <span key={item}>{item}</span>)}</div>
        <div className="marketing-mentor-card__actions">
          {onSelect ? <button type="button" onClick={() => onSelect(mentor)} aria-label={`View full profile for ${mentor.name}`} data-testid={`mentor-${mentor.slug}-detail-button`}>View full profile</button> : null}
          {mentor.linkedIn && <a className="marketing-mentor-card__linkedin" href={mentor.linkedIn} target="_blank" rel="noreferrer" aria-label={`LinkedIn ${mentor.name}`} data-testid={`mentor-${mentor.slug}-linkedin-link`}><ExternalLink aria-hidden="true" size={14} /> LinkedIn</a>}
        </div>
      </div>
    </article>
  )
}
