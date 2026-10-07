import { CalendarDays } from 'lucide-react'
import Link from 'next/link'

type Props = {
  slug: string
  title: string
  excerpt: string
  category: string | null
  publicationDate?: string | null
  coverUrl: string | null
  coverAltText: string | null
  featured?: boolean
}

function categoryTone(category: string) {
  switch (category.trim().toLocaleLowerCase('en')) {
    case 'partnership': return 'partnership'
    case 'achievement': return 'achievement'
    case 'news': return 'news'
    case 'event': return 'event'
    case 'announcement': return 'announcement'
    default: return 'generic'
  }
}

export function PublicationCard({ slug, title, excerpt, category, publicationDate, coverUrl, coverAltText, featured = false }: Props) {
  return <Link
    className={featured ? 'editorial-card editorial-card--publication editorial-card--featured' : 'editorial-card editorial-card--publication'}
    href={`/publications/${slug}`}
    aria-label={`Read ${title}`}
  >
    <div className="editorial-card__media">
      {coverUrl
        ? <img src={coverUrl} alt={coverAltText ?? ''} />
        : <div className="editorial-card__cover-fallback" aria-hidden="true">Strativate</div>}
      {category ? <span className="editorial-card__category" data-tone={categoryTone(category)}>{category}</span> : null}
    </div>
    <div className="editorial-card__content">
      {publicationDate !== undefined ? <div className="editorial-card__date">
        <CalendarDays aria-hidden="true" size={14} />
        {publicationDate
          ? <time dateTime={publicationDate}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(`${publicationDate}T00:00:00`))}</time>
          : <small>Published by Strativate</small>}
      </div> : null}
      <h3>{title}</h3>
      <p>{excerpt}</p>
      <span className="marketing-text-link">Read more <span aria-hidden="true">→</span></span>
    </div>
  </Link>
}
