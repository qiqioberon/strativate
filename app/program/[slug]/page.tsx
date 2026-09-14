import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { ProgramDetail } from '@/components/programs/program-detail'
import { getProgramEditorialBySlug } from '@/lib/program-information'
import { getPublicPrivateMentoring } from '@/lib/private-mentoring/server'
import { resolveMentoringSlug } from '@/lib/program-routes'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const canonical = resolveMentoringSlug(slug)
  if (!canonical) return {}
  const program = canonical === 'private-mentoring'
    ? await getPublicPrivateMentoring()
    : getProgramEditorialBySlug(canonical)
  return program
    ? { title: program.title, description: program.shortDescription, alternates: { canonical: `/program/${canonical}` } }
    : {}
}

export default async function ProgramDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const canonical = resolveMentoringSlug(slug)
  if (!canonical) notFound()
  if (canonical !== slug) permanentRedirect(`/program/${canonical}`)

  const program = canonical === 'private-mentoring'
    ? await getPublicPrivateMentoring()
    : getProgramEditorialBySlug(canonical)
  if (!program) notFound()

  return <MarketingShell><ProgramDetail program={program} /></MarketingShell>
}
