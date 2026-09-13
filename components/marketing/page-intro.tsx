import type { ReactNode } from 'react'

export function PageIntro({ eyebrow, title, description, aside }: { eyebrow: string; title: ReactNode; description: string; aside?: ReactNode }) {
  return (
    <section className="marketing-page-intro" data-reveal>
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
