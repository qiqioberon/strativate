import { ArrowRight, CalendarDays, UserRound } from 'lucide-react'
import Link from 'next/link'

import { DecorDisc, DecorRing } from '@/components/marketing/decor/decor-shapes'
import { FluentIcon, type FluentIconName } from '@/components/marketing/decor/fluent-icon'
import { TiltSurface } from '@/components/marketing/decor/tilt-surface'
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

// Decorative 3D accent per program: a target for focused help, a rising chart for the ongoing track.
const programAccentIcons: Record<string, FluentIconName> = {
  'private-mentoring': 'bullseye',
  'intensive-mentoring': 'chart',
}

export function ProgramCard({ program }: { program: MarketingProgram }) {
  // The editorial tone only picks the glass surface: 'orange' is the frosted white card, 'red' the deep ink one.
  const surface = program.tone === 'red' ? 'dark' : 'light'
  const accentIcon = programAccentIcons[program.id] ?? (surface === 'dark' ? 'chart' : 'bullseye')

  return (
    <TiltSurface className={cn('homepage-program-tilt', `is-${surface}`)} maxTilt={5}>
      <Link
        href={program.href}
        className={cn('marketing-program-card', `is-${program.tone}`)}
        data-surface={surface}
        aria-label={`View ${program.title}`}
        data-testid={`program-card-${program.id}-link`}
      >
        <span className="marketing-program-card__accent" aria-hidden="true">
          <DecorDisc className="marketing-program-card__accent-disc" />
          <DecorRing className="marketing-program-card__accent-ring" motion="spin" />
        </span>

        <div className="marketing-program-card__body">
          <h3>{program.title}</h3>
          <p className="marketing-program-card__tagline">{program.tagline}</p>
          <p className="marketing-program-card__summary">{program.description}</p>

          <dl className="marketing-program-card__facts">
            <div>
              <dt><span className="marketing-program-card__fact-icon" aria-hidden="true"><CalendarDays size={18} strokeWidth={2} /></span>Session rhythm</dt>
              <dd>{program.sessionRhythm}</dd>
            </div>
            <div>
              <dt><span className="marketing-program-card__fact-icon" aria-hidden="true"><UserRound size={18} strokeWidth={2} /></span>Mentor support</dt>
              <dd>{program.mentorSupport}</dd>
            </div>
          </dl>

          <span className="marketing-program-card__cta">
            <span className="marketing-program-card__cta-label">Explore {program.title}</span>
            <span className="marketing-program-card__cta-arrow" aria-hidden="true"><ArrowRight size={18} strokeWidth={2.2} /></span>
          </span>
        </div>
      </Link>

      {/* Outside the link on purpose: the card itself carries no images, the icon floats above its corner. */}
      <span className="homepage-program-tilt__float" data-icon={accentIcon} aria-hidden="true">
        <FluentIcon name={accentIcon} size={76} />
      </span>
    </TiltSurface>
  )
}
