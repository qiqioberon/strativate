import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicCatalogProduct, listPublicCatalog } from '@/lib/catalog/public'
import { resolveMentoringSlug } from '@/lib/program-routes'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { ProductDetail } from '@/components/programs/program-detail'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const canonical = resolveMentoringSlug(slug) ?? slug
  const product = await getPublicCatalogProduct(canonical)
  return product
    ? { title: product.title, description: product.shortDescription, alternates: { canonical: `/program/${canonical}` } }
    : {}
}

export default async function ProgramDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const canonical = resolveMentoringSlug(slug)
  if (canonical && canonical !== slug) permanentRedirect(`/program/${canonical}`)
  const [product, comparisons] = await Promise.all([getPublicCatalogProduct(slug), listPublicCatalog()])
  if (!product) notFound()
  return <MarketingShell><ProductDetail product={product} comparisons={comparisons} /></MarketingShell>
}
