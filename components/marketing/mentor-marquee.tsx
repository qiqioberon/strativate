import { Award } from 'lucide-react'

import { AssetMedia } from './asset-media'
import type { Mentor } from '@/lib/content/mentors'

function MentorMarqueeGroup({ mentors, duplicate = false }: { mentors: Mentor[]; duplicate?: boolean }) {
  return (
    <div className="marketing-mentor-marquee__group" aria-hidden={duplicate || undefined}>
      {mentors.map((mentor) => (
        <article className="marketing-mentor-marquee__card" key={`${duplicate ? 'copy-' : ''}${mentor.slug}`} data-testid={duplicate ? undefined : `mentor-marquee-card-${mentor.slug}`}>
          <div className="marketing-mentor-marquee__portrait"><AssetMedia assetKey={mentor.portrait} sizes="72px" /></div>
          <div>
            <span>{mentor.tier ?? 'Mentor Strativate'}</span>
            <strong>{mentor.name}</strong>
            <small><Award aria-hidden="true" size={12} /> {mentor.expertise[0] ?? 'Pendampingan kompetisi'}</small>
          </div>
        </article>
      ))}
    </div>
  )
}

export function MentorMarquee({ mentors }: { mentors: Mentor[] }) {
  return (
    <div className="marketing-mentor-marquee" data-testid="mentor-infinite-marquee">
      <div className="marketing-mentor-marquee__track">
        <MentorMarqueeGroup mentors={mentors} />
        <MentorMarqueeGroup mentors={mentors} duplicate />
      </div>
    </div>
  )
}
