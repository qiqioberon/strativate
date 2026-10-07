import { ArrowLeft, ArrowRight, CalendarDays, FileText, Tag, UserRound } from 'lucide-react'
import Link from 'next/link'

import type { RichTextDocument } from '@/lib/content/rich-text'

import { CompetitionBadges, competitionStatusIcons } from './competition-badges'
import { RichTextRenderer } from './rich-text-renderer'
import { PublicationCard } from './publication-card'

export type PublicationDetailViewModel = {
  id: string
  slug: string
  title: string
  summary: string
  category: string | null
  publicationDate: string | null
  coverUrl: string | null
  coverAltText: string | null
  body: RichTextDocument
}

export type RelatedPublicationViewModel = Pick<PublicationDetailViewModel, 'id' | 'slug' | 'title' | 'summary' | 'category' | 'coverUrl' | 'coverAltText'>

export type CompetitionDetailViewModel = {
  id: string
  slug: string
  name: string
  description: string
  category: string | null
  status: 'upcoming' | 'open' | 'closed' | 'archived'
  registrationDeadline: string | null
  registrationUrl: string | null
  rulesUrl: string | null
  coverUrl: string | null
  coverAltText: string | null
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(`${value}T00:00:00`))
}

export function PublicationDetailView({
  item,
  related = [],
  preview = false,
}: {
  item: PublicationDetailViewModel
  related?: RelatedPublicationViewModel[]
  preview?: boolean
}) {
  const publishedDate = formatDate(item.publicationDate)
  return <main className="editorial-detail editorial-detail--article">
    {preview ? <div className="editorial-preview-banner">Admin preview · unsaved changes are visible only in this browser.</div> : null}
    <article className="marketing-container editorial-article">
      <Link className="editorial-back-link" href="/publications"><ArrowLeft aria-hidden="true" /> Back to Publications</Link>
      <header className="editorial-article__header">
        <p className="marketing-kicker">{item.category ?? 'Publication'}</p>
        <h1>{item.title}</h1>
        <p className="editorial-detail__excerpt">{item.summary}</p>
        <div className="editorial-article__meta">
          {item.category ? <span><Tag aria-hidden="true" /> {item.category}</span> : null}
          {publishedDate ? <span><CalendarDays aria-hidden="true" /> {publishedDate}</span> : null}
          <span><UserRound aria-hidden="true" /> Strativate</span>
        </div>
      </header>
      {item.coverUrl ? <div className="editorial-detail__cover-wrap"><img className="editorial-detail__cover" src={item.coverUrl} alt={item.coverAltText ?? ''} /></div> : null}
      <RichTextRenderer document={item.body} />
    </article>
    {related.length ? <section className="editorial-related marketing-section">
      <div className="marketing-container">
        <div className="marketing-section-head"><div><p className="marketing-kicker">Keep reading</p><h2>Related Publications</h2></div></div>
        <div className="editorial-related__grid">
          {related.slice(0, 3).map(relatedItem => <PublicationCard
            key={relatedItem.id}
            slug={relatedItem.slug}
            title={relatedItem.title}
            excerpt={relatedItem.summary}
            category={relatedItem.category}
            coverUrl={relatedItem.coverUrl}
            coverAltText={relatedItem.coverAltText}
          />)}
        </div>
      </div>
    </section> : null}
  </main>
}

export function CompetitionDetailView({
  item,
  preview = false,
}: {
  item: CompetitionDetailViewModel
  preview?: boolean
}) {
  const deadline = formatDate(item.registrationDeadline)
  const canRegister = item.status === 'open' && Boolean(item.registrationUrl)
  const StatusIcon = competitionStatusIcons[item.status]
  return <main className="editorial-detail editorial-detail--competition">
    {preview ? <div className="editorial-preview-banner">Admin preview · unsaved changes are visible only in this browser.</div> : null}
    <article className="marketing-container editorial-competition-detail">
      <Link className="editorial-back-link" href="/competitions"><ArrowLeft aria-hidden="true" /> Back to Competitions</Link>
      <div className="editorial-competition-detail__grid">
        <div className="editorial-competition-detail__copy">
          <p className="marketing-kicker">Competition</p>
          <CompetitionBadges status={item.status} category={item.category} />
          <h1>{item.name}</h1>
          <p className="editorial-detail__excerpt">{item.description}</p>
          <dl className="editorial-competition-detail__facts">
            <div>
              <dt><StatusIcon aria-hidden="true" size={16} /> Status</dt>
              <dd className="editorial-competition-detail__status">{item.status.replace('_', ' ')}</dd>
            </div>
            {item.category ? <div>
              <dt><Tag aria-hidden="true" size={16} /> Category</dt>
              <dd>{item.category}</dd>
            </div> : null}
            {deadline ? <div>
              <dt><CalendarDays aria-hidden="true" size={16} /> Registration deadline</dt>
              <dd><time dateTime={item.registrationDeadline!}>{deadline}</time></dd>
            </div> : null}
          </dl>
          <div className="editorial-detail__actions editorial-competition-detail__actions">
            {canRegister ? <a className="button button-primary" href={item.registrationUrl!} target="_blank" rel="noreferrer">Register <ArrowRight aria-hidden="true" /></a> : null}
            {item.rulesUrl ? <a className="button button-outline" href={item.rulesUrl} target="_blank" rel="noreferrer">Read rules <FileText aria-hidden="true" /></a> : null}
          </div>
        </div>
        <div className="editorial-competition-detail__media">
          {item.coverUrl ? <img src={item.coverUrl} alt={item.coverAltText ?? ''} /> : <div className="editorial-card__cover-fallback" aria-hidden="true">Strativate</div>}
        </div>
      </div>
    </article>
  </main>
}
