import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import type { ConnectedServiceOverview } from '@/lib/content/services'

export function ServiceCard({ service, index }: { service: ConnectedServiceOverview; index: number }) {
  const Icon = service.icon
  return (
    <article className="marketing-service-card">
      <div className="marketing-service-card__top">
        <span className="marketing-service-card__icon"><Icon aria-hidden="true" size={22} /></span>
        <span className="marketing-service-card__number">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <h2>{service.name}</h2>
      <p>{service.description}</p>
      {service.href ? <Link href={service.href}>{service.detailLabel ?? 'Lihat detail'} <ArrowRight aria-hidden="true" size={15} /></Link> : <span className="marketing-service-card__overview">Gambaran layanan</span>}
    </article>
  )
}
