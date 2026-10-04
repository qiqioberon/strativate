import type { ReactNode } from 'react'

import { HeroShapeGrid } from './hero-shape-grid'

type PageIntroProps = {
  title: ReactNode
  description: string
  aside?: ReactNode
}

export function PageIntro({ title, description, aside }: PageIntroProps) {
  return (
    <section className="marketing-page-intro" data-reveal data-testid="marketing-page-intro">
      <HeroShapeGrid />
      <div className="marketing-container marketing-page-intro__grid">
        <h1 data-testid="marketing-page-title">{title}</h1>
        <p className="marketing-page-intro__description" data-testid="marketing-page-description">{description}</p>
        {aside ? <div className="marketing-page-intro__actions">{aside}</div> : null}
      </div>
    </section>
  )
}
