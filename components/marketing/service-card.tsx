import Link from 'next/link'

import type { ServiceOverview } from '@/lib/content/services'

type ServiceCardVariant = 'primary' | 'secondary' | 'compact'

export function ServiceCard({ service, variant }: { service: ServiceOverview; variant: ServiceCardVariant }) {
  const Icon = service.icon
  return (
    <article
      className={`marketing-service-card marketing-service-card--${variant}`}
      data-testid={`service-card-${service.id}`}
      data-variant={variant}
      data-program-card
    >
      <span className="marketing-service-card__spotlight" aria-hidden="true" />
      <div className="marketing-service-card__top">
        <span className="marketing-service-card__icon"><Icon aria-hidden="true" size={22} /></span>
      </div>
      <div className="marketing-service-card__copy">
        <h2 data-testid={`service-${service.id}-title`}>{service.name}</h2>
        <p data-testid={`service-${service.id}-description`}>{service.description}</p>
      </div>
      {service.href ? (
        <Link className="marketing-service-card__action" href={service.href} data-testid={`service-${service.id}-link`}>
          <span>{service.detailLabel ?? 'View details'}</span>
        </Link>
      ) : (
        <span className="marketing-service-card__overview">Coming soon</span>
      )}
    </article>
  )
}
