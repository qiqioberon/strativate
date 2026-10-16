import { ArrowRight, Check, Clock3 } from 'lucide-react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

export type MarketingProgram = {
  id: string
  number: string
  title: string
  kicker: string
  description: string
  highlights: readonly string[]
  href?: string
  assetKey: 'programs.private.cover' | 'programs.intensive.cover' | 'programs.bigClass.cover'
  status: 'information' | 'overview'
  tone: 'orange' | 'red' | 'yellow'
}

export function ProgramCard({ program }: { program: MarketingProgram }) {
  const isPlaceholder = program.status === 'overview'

  const content = (
    <div className="marketing-program-card__body">
      <h3>{program.title}</h3>
      <p className="marketing-program-card__tag">{isPlaceholder ? 'Details coming soon' : program.kicker}</p>
      <p className="marketing-program-card__summary">{program.description}</p>

      {program.highlights.length > 0 && (
        <ul>
          {program.highlights.map((highlight) => (
            <li key={highlight}><Check aria-hidden="true" size={15} strokeWidth={2.2} />{highlight}</li>
          ))}
        </ul>
      )}

      <div className="marketing-program-card__bottom">
        <div>
          <strong>{isPlaceholder ? 'Coming soon' : 'Program information'}</strong>
          <small>{isPlaceholder ? 'Commercial details are not available yet' : 'Commercial details are being updated'}</small>
        </div>
        {program.href ? (
          <span className="marketing-program-card__arrow" aria-hidden="true">
            <ArrowRight aria-hidden="true" size={18} />
          </span>
        ) : (
          <span className="marketing-program-card__pending" aria-label="Program not available yet">
            <Clock3 aria-hidden="true" size={17} />
          </span>
        )}
      </div>
    </div>
  )

  const className = cn('marketing-program-card', `is-${program.tone}`, isPlaceholder && 'is-placeholder')
  return program.href ? (
    <Link href={program.href} className={className} aria-label={`View ${program.title}`} data-testid={`program-card-${program.id}-link`}>{content}</Link>
  ) : (
    <article className={className} data-testid={`program-card-${program.id}`}>{content}</article>
  )
}
