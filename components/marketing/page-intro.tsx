import type { ReactNode } from 'react'

export function PageIntro({ eyebrow, title, description, aside }: { eyebrow: string; title: ReactNode; description: string; aside?: ReactNode }) {
  return (
    <section className="marketing-page-intro">
      <div className="marketing-container marketing-page-intro__grid">
        <div>
          <p className="marketing-kicker">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="marketing-page-intro__aside">
          <p>{description}</p>
          {aside}
        </div>
      </div>
    </section>
  )
}
