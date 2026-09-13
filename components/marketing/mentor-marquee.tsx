import { Award } from 'lucide-react'
import Link from 'next/link'

import { AssetMedia } from './asset-media'
import type { Mentor } from '@/lib/content/mentors'

function MentorMarqueeGroup({ mentors, duplicate = false }: { mentors: Mentor[]; duplicate?: boolean }) {
  return (
    <div className="marketing-mentor-marquee__group" aria-hidden={duplicate || undefined}>
      {mentors.map((mentor) => (
        <Link className="marketing-mentor-marquee__card" href={`/mentor#mentor-${mentor.slug}`} key={`${duplicate ? 'copy-' : ''}${mentor.slug}`} tabIndex={duplicate ? -1 : undefined} data-testid={duplicate ? undefined : `mentor-marquee-card-${mentor.slug}`}>
          <div className="marketing-mentor-marquee__portrait"><AssetMedia assetKey={mentor.portrait} sizes="72px" /></div>
          <div>
            <span>{mentor.tier ?? 'Mentor Strativate'}</span>
            <strong>{mentor.name}</strong>
            {mentor.title ? <small className="marketing-mentor-marquee__title">{mentor.title}</small> : null}
            <ul className="marketing-mentor-marquee__credentials">
              {mentor.credentials.slice(0, 2).map((credential) => <li key={credential}><Award aria-hidden="true" size={12} /> {credential}</li>)}
            </ul>
            {mentor.expertise.length ? <div className="marketing-mentor-marquee__expertise">{mentor.expertise.slice(0, 2).map((expertise) => <span key={expertise}>{expertise}</span>)}</div> : null}
          </div>
        </Link>
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
