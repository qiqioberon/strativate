import { notFound } from 'next/navigation'

import { EditorialPreviewClient } from '@/components/admin/editorial-preview-client'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { requireAccount } from '@/lib/auth/server'

export default async function EditorialPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>
  searchParams: Promise<{ key?: string | string[] }>
}) {
  await requireAccount('/admin')
  const { kind } = await params
  const { key } = await searchParams
  if ((kind !== 'publication' && kind !== 'competition') || typeof key !== 'string' || !key) notFound()

  return <MarketingShell>
    <EditorialPreviewClient kind={kind} previewKey={key} />
  </MarketingShell>
}
