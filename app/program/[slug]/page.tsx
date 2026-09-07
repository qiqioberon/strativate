import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, Check, Clock3, Layers3, Video } from 'lucide-react'
import { getCatalogItem, catalogItems } from '@/lib/catalog'
import { getProgramInformation } from '@/lib/program-information'
import { resolveMentoringSlug } from '@/lib/program-routes'
import { ProgramInformationDetail } from '@/components/programs/program-detail'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const item = getCatalogItem(resolveMentoringSlug(slug) || slug)
  return item ? { title: `${item.title} | Strativate`, description: item.description } : {}
}

export function generateStaticParams() { return catalogItems.map((item) => ({ slug: item.slug })) }
export default async function ProgramDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const canonical = resolveMentoringSlug(slug)
  if (canonical && canonical !== slug) permanentRedirect(`/program/${canonical}`)
  const information = getProgramInformation(slug)
  if (information) return <ProgramInformationDetail program={information} />
  const item = getCatalogItem(slug); if (!item) notFound()
  return <main className="detail-page"><Link href="/explore" className="back-link"><ArrowLeft size={15} /> Back to Explore Programs</Link><section className="detail-hero"><div><p className="kicker">{item.category} / {item.kicker}</p><h1>{item.title}</h1><p className="detail-lede">{item.detail}</p><div className="detail-price"><strong>{item.priceLabel}</strong><span>one-time purchase</span></div><Link href={`/checkout/${item.slug}`} className="primary-cta">Configure this program <ArrowRight size={16} /></Link></div><aside className="detail-summary"><p className="kicker">At a glance</p><div><Clock3 size={17} /><span>{item.duration}</span></div><div><Video size={17} /><span>{item.format}</span></div><div><Layers3 size={17} /><span>{item.sessions ? `${item.sessions} guided sessions` : 'Instant digital access'}</span></div></aside></section><section className="detail-sections"><div><p className="kicker">What you will work on</p><h2>A practical path from where you are to what is next.</h2></div><ul>{item.outcomes.map((outcome) => <li key={outcome}><Check size={17} />{outcome}</li>)}</ul></section></main>
}
