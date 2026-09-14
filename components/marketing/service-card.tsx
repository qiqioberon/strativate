import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import type { ServiceOverview } from '@/lib/content/services'

type ServiceCardVariant = 'primary' | 'secondary' | 'compact'

export function ServiceCard({ service, index, variant }: { service: ServiceOverview; index: number; variant: ServiceCardVariant }) {
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
        <span className="marketing-service-card__number">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="marketing-service-card__copy">
        <h2 data-testid={`service-${service.id}-title`}>{service.name}</h2>
        <p data-testid={`service-${service.id}-description`}>{service.description}</p>
      </div>
      {service.href ? (
        <Link className="marketing-service-card__action" href={service.href} data-testid={`service-${service.id}-link`}>
          <span>{service.detailLabel ?? 'Lihat detail'}</span>
          <span className="marketing-service-card__action-icon" aria-hidden="true"><ArrowRight size={15} /></span>
        </Link>
      ) : (
        <span className="marketing-service-card__overview"><span>Gambaran layanan</span><i aria-hidden="true" /></span>
      )}
    </article>
  )
}
