import type { ReactNode } from 'react'

type PageIntroProps = {
  eyebrow: string
  title: ReactNode
  description: string
  aside?: ReactNode
  motif?: 'program' | 'mentor' | 'about' | 'faq'
}

export function PageIntro({ eyebrow, title, description, aside, motif = 'program' }: PageIntroProps) {
  return (
    <section className="marketing-page-intro" data-reveal>
      <div className="marketing-page-intro__motif" data-testid="marketing-page-intro-motif" data-motif={motif} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="marketing-container marketing-page-intro__grid">
        <div>
          <p className="marketing-kicker" data-testid="marketing-page-eyebrow">{eyebrow}</p>
          <h1 data-testid="marketing-page-title">{title}</h1>
        </div>
        <div className="marketing-page-intro__aside">
          <p data-testid="marketing-page-description">{description}</p>
          {aside}
        </div>
      </div>
    </section>
  )
}
