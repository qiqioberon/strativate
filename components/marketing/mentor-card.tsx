import { Award, ExternalLink } from 'lucide-react'

import { AssetMedia } from './asset-media'
import type { Mentor } from '@/lib/content/mentors'

export function MentorCard({ mentor, index }: { mentor: Mentor; index: number }) {
  return (
    <article className="marketing-mentor-card">
      <div className="marketing-mentor-card__media">
        <AssetMedia assetKey={mentor.portrait} sizes="(max-width: 760px) 88vw, 28vw" priority={index < 4} />
        <span className="marketing-mentor-card__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="marketing-mentor-card__content">
        <span className="marketing-mentor-card__status">{mentor.tier ?? 'Mentor Strativate'}</span>
        <h3>{mentor.name}</h3>
        {mentor.title && <p>{mentor.title}</p>}
        <div className="marketing-mentor-card__meta">
          {mentor.credentials.slice(0, 2).map((credential) => <span key={credential}><Award aria-hidden="true" size={14} />{credential}</span>)}
        </div>
        <div className="marketing-mentor-card__expertise">{mentor.expertise.map(item => <span key={item}>{item}</span>)}</div>
        {mentor.linkedIn && <a className="marketing-mentor-card__linkedin" href={mentor.linkedIn} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" size={14} /> LinkedIn</a>}
      </div>
    </article>
  )
}
