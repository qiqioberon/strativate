import { ArrowRight, Check, Clock3, Layers3, Sparkles, UsersRound } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import type { CatalogMarketingProgram } from '@/lib/catalog/presentation'
import { cn } from '@/lib/utils'

export type MarketingProgram = CatalogMarketingProgram | {
  id: string
  number: string
  title: string
  kicker: string
  description: string
  highlights: readonly string[]
  priceLabel?: string
  priceContext?: string
  href?: string
  assetKey: 'programs.bigClass.cover'
  status: 'overview'
  tone: 'yellow'
}

const programIcons = {
  orange: UsersRound,
  red: Layers3,
  yellow: Sparkles,
}

export function ProgramCard({ program }: { program: MarketingProgram }) {
  const Icon = programIcons[program.tone]
  const isPlaceholder = false

  return (
    <article className={cn('marketing-program-card', `is-${program.tone}`, isPlaceholder && 'is-placeholder')}>
      <div className="marketing-program-card__rail" aria-hidden="true">
        <span>{program.number}</span>
        <i />
      </div>
      <div className="marketing-program-card__body">
        <div className="marketing-program-card__top">
          <span className="marketing-program-card__icon"><Icon size={20} strokeWidth={1.8} /></span>
          <span className="marketing-program-card__tag">{isPlaceholder ? 'Informasi menyusul' : program.kicker}</span>
        </div>

        <h3>{program.title}</h3>
        <p>{program.description}</p>

        {program.highlights.length > 0 && (
          <ul>
            {program.highlights.map((highlight) => (
              <li key={highlight}><Check aria-hidden="true" size={15} />{highlight}</li>
            ))}
          </ul>
        )}

        <div className="marketing-program-card__bottom">
          <div>
            {program.priceLabel ? <strong>{program.priceLabel}</strong> : <strong>Belum dipublikasikan</strong>}
            <small>{program.priceContext ?? 'Menunggu master program dari Strativate'}</small>
          </div>
          {program.href ? (
            <Link
              href={program.href}
              className={cn(buttonVariants({ variant: 'dark', size: 'icon' }), 'marketing-program-card__action')}
              aria-label={`Lihat ${program.title}`}
            >
              <ArrowRight data-icon="arrow" aria-hidden="true" size={18} />
            </Link>
          ) : (
            <span className="marketing-program-card__pending" aria-label="Program belum tersedia">
              <Clock3 aria-hidden="true" size={17} />
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
