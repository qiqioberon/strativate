import { notFound, permanentRedirect } from 'next/navigation'

import { resolveMentoringSlug } from '@/lib/program-routes'

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const mentoringSlug = resolveMentoringSlug(slug)
  if (mentoringSlug) permanentRedirect(`/program/${mentoringSlug}`)
  notFound()
}
