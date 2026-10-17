import { ArrowRight, CalendarDays, UserRound } from 'lucide-react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

export type MarketingProgram = {
  id: string
  title: string
  tagline: string
  description: string
  sessionRhythm: string
  mentorSupport: string
  href: string
  tone: 'orange' | 'red'
}

export function ProgramCard({ program }: { program: MarketingProgram }) {
  return (
    <Link
      href={program.href}
      className={cn('marketing-program-card', `is-${program.tone}`)}
      aria-label={`View ${program.title}`}
      data-testid={`program-card-${program.id}-link`}
    >
      <div className="marketing-program-card__body">
        <h3>{program.title}</h3>
        <p className="marketing-program-card__tagline">{program.tagline}</p>
        <p className="marketing-program-card__summary">{program.description}</p>

        <dl className="marketing-program-card__facts">
          <div>
            <dt><CalendarDays aria-hidden="true" size={17} strokeWidth={1.9} />Session rhythm</dt>
            <dd>{program.sessionRhythm}</dd>
          </div>
          <div>
            <dt><UserRound aria-hidden="true" size={17} strokeWidth={1.9} />Mentor support</dt>
            <dd>{program.mentorSupport}</dd>
          </div>
        </dl>

        <span className="marketing-program-card__cta">
          Explore {program.title} <ArrowRight aria-hidden="true" size={17} />
        </span>
      </div>
    </Link>
  )
}
