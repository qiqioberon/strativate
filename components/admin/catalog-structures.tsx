import type { ReactNode } from 'react'

export function CatalogStructures({ title, description, children }: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return <section className="catalog-structures">
    <div className="role-card-heading">
      <div>
        <p className="kicker">Struktur</p>
        <h2>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
      </div>
    </div>
    {children}
  </section>
}
