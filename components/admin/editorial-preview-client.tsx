'use client'

import { useEffect, useState } from 'react'

import {
  CompetitionDetailView,
  PublicationDetailView,
  type CompetitionDetailViewModel,
  type PublicationDetailViewModel,
} from '@/components/marketing/editorial-detail-views'
import { parseRichTextDocument } from '@/lib/content/rich-text'

type PreviewPayload =
  | { createdAt: number; kind: 'publication'; data: Omit<PublicationDetailViewModel, 'body'> & { body: unknown } }
  | { createdAt: number; kind: 'competition'; data: CompetitionDetailViewModel }

export function EditorialPreviewClient({ kind, previewKey }: { kind: 'publication' | 'competition'; previewKey: string }) {
  const [payload, setPayload] = useState<PreviewPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`strativate-editorial-preview:${previewKey}`)
      if (!raw) {
        setError('Preview data is unavailable. Return to the editor and open Preview again.')
        return
      }
      const parsed = JSON.parse(raw) as PreviewPayload
      if (!parsed || parsed.kind !== kind || typeof parsed.createdAt !== 'number') {
        setError('Preview data is invalid. Return to the editor and open Preview again.')
        return
      }
      if (Date.now() - parsed.createdAt > 30 * 60 * 1000) {
        window.localStorage.removeItem(`strativate-editorial-preview:${previewKey}`)
        setError('This preview expired. Return to the editor and open a fresh preview.')
        return
      }
      setPayload(parsed)
    } catch {
      setError('Preview data could not be read. Return to the editor and try again.')
    }
  }, [kind, previewKey])

  if (error) return <main className="editorial-preview-state"><div><strong>Preview unavailable</strong><p>{error}</p></div></main>
  if (!payload) return <main className="editorial-preview-state"><div><strong>Loading preview…</strong></div></main>

  if (payload.kind === 'publication') {
    return <PublicationDetailView preview item={{ ...payload.data, body: parseRichTextDocument(payload.data.body) }} />
  }
  return <CompetitionDetailView preview item={payload.data} />
}
