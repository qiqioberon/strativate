'use client'

import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Crop,
  Eye,
  FileText,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Select } from '@base-ui/react/select'

import { EditorialCoverCropper } from '@/components/admin/editorial-cover-cropper'
import { useAdminImageUpload } from '@/components/admin/use-admin-image-upload'
import { PublicationCategoryManager } from '@/components/admin/publication-category-manager'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import {
  emptyRichTextDocument,
  parseRichTextDocument,
  richTextHasContent,
  richTextToPlainText,
  type RichTextDocument,
} from '@/lib/content/rich-text'
import dataStyles from './data-management.module.css'
import { adminFormError as formError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import { PHOTO_SOURCE_BUCKET, cropRectFromJson, sourceExtension, type NormalizedCropRect } from '@/lib/media/image-crop'
import type {
  Competition,
  CompetitionCategory,
  Json,
  Publication,
  PublicationCategory,
} from '@/lib/supabase/database.types'

export type EditorialKind = 'publications' | 'competitions'
type StatusFilter = 'all' | 'published' | 'draft'
type EditorialRow = Publication | Competition
type Draft = {
  slug: string
  title: string
  summary: string
  bodyDocument: RichTextDocument
  coverPath: string
  coverSourcePath: string
  coverCrop: NormalizedCropRect | null
  coverAltText: string
  publicationCategoryId: string
  publishedAt: string
  isPublished: boolean
  isFeatured: boolean
  competitionCategoryId: string
  rulesUrl: string
  registrationUrl: string
  registrationDeadline: string
  status: Competition['status']
}

const statusFilterItems = {
  all: 'All states',
  published: 'Published',
  draft: 'Draft',
} as const

function emptyDraft(): Draft {
  return {
    slug: '',
    title: '',
    summary: '',
    bodyDocument: emptyRichTextDocument(),
    coverPath: '',
    coverSourcePath: '',
    coverCrop: null,
    coverAltText: '',
    publicationCategoryId: '',
    publishedAt: '',
    isPublished: false,
    isFeatured: false,
    competitionCategoryId: '',
    rulesUrl: '',
    registrationUrl: '',
    registrationDeadline: '',
    status: 'upcoming',
  }
}

function itemTitle(item: EditorialRow) {
  return 'title' in item ? item.title : item.name
}

function itemSummary(item: EditorialRow) {
  return 'excerpt' in item ? item.excerpt : item.description
}

function validHttpUrl(value: string) {
  if (!value.trim()) return false
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Cover preview could not be prepared.'))
    reader.readAsDataURL(file)
  })
}

function formatShortDate(value: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

export function EditorialContentManagement({ initialKind = 'publications' }: { initialKind?: EditorialKind }) {
  const supabase = useMemo(() => createClient(), [])
  const editorDialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const discardDialogRef = useRef<HTMLDialogElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const kind = initialKind

  const [publications, setPublications] = useState<Publication[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [publicationCategories, setPublicationCategories] = useState<PublicationCategory[]>([])
  const [competitionCategories, setCompetitionCategories] = useState<CompetitionCategory[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorVersion, setEditorVersion] = useState(0)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft())
  const [originalCoverPath, setOriginalCoverPath] = useState('')
  const [originalCoverSourcePath, setOriginalCoverSourcePath] = useState('')
  const [initialDraftSignature, setInitialDraftSignature] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EditorialRow | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [publishErrors, setPublishErrors] = useState<string[]>([])

  const coverImage = useAdminImageUpload({ supabase, target: {
    width: 1600, height: 900, maxBytes: 5 * 1024 * 1024, title: 'Adjust cover crop',
  }, onError: setError })
  const { processedFile: coverFile, originalFile: coverOriginalFile, previewUrl: coverPreview } = coverImage
  const busy = saving || coverImage.loadingSource

  const load = useCallback(async () => {
    setLoading(true)
    const [publicationResult, competitionResult, publicationCategoryResult, competitionCategoryResult] = await Promise.all([
      supabase.rpc('admin_list_publications'),
      supabase.rpc('admin_list_competitions'),
      supabase.from('publication_categories').select('*').order('sort_order').order('name'),
      supabase.from('competition_categories').select('*').eq('is_active', true).order('sort_order').order('name'),
    ])
    const loadError = publicationResult.error
      ?? competitionResult.error
      ?? publicationCategoryResult.error
      ?? competitionCategoryResult.error
    if (loadError) setError(formError(loadError, 'Unable to load editorial content.'))
    setPublications(publicationResult.data ?? [])
    setCompetitions(competitionResult.data ?? [])
    setPublicationCategories(publicationCategoryResult.data ?? [])
    setCompetitionCategories(competitionCategoryResult.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    setEditingId(null)
    setDraft(emptyDraft())
    setQuery('')
    setStatusFilter('all')
    setPublishErrors([])
    setDeleteTarget(null)
    setCategoryManagerOpen(false)
  }, [initialKind])

  useEffect(() => {
    const dialog = editorDialogRef.current
    if (!dialog) return
    if (editingId && !dialog.open) dialog.showModal()
    if (!editingId && dialog.open) dialog.close()
  }, [editingId])

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!dialog) return
    if (deleteTarget && !dialog.open) dialog.showModal()
    if (!deleteTarget && dialog.open) dialog.close()
  }, [deleteTarget])

  useEffect(() => {
    const dialog = discardDialogRef.current
    if (!dialog) return
    if (discardOpen && !dialog.open) dialog.showModal()
    if (!discardOpen && dialog.open) dialog.close()
  }, [discardOpen])


  const rows = kind === 'publications' ? publications : competitions
  const publicationCategoryNames = useMemo(
    () => new Map(publicationCategories.map(category => [category.id, category.name])),
    [publicationCategories],
  )
  const competitionCategoryNames = useMemo(
    () => new Map(competitionCategories.map(category => [category.id, category.name])),
    [competitionCategories],
  )

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en')
    return (rows as EditorialRow[]).filter(item => {
      const category = 'title' in item
        ? publicationCategoryNames.get(item.category_id ?? '') ?? item.category ?? ''
        : competitionCategoryNames.get(item.category_id ?? '') ?? ''
      const matchesQuery = !needle || `${itemTitle(item)} ${itemSummary(item)} ${category}`.toLocaleLowerCase('en').includes(needle)
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'published' ? item.is_published : !item.is_published)
      return matchesQuery && matchesStatus
    })
  }, [competitionCategoryNames, publicationCategoryNames, query, rows, statusFilter])

  const currentCoverUrl = coverPreview || (draft.coverPath
    ? supabase.storage.from('marketing-editorial').getPublicUrl(draft.coverPath).data.publicUrl
    : '')
  const selectedPublicationCategory = publicationCategoryNames.get(draft.publicationCategoryId) ?? ''
  const selectedCompetitionCategory = competitionCategoryNames.get(draft.competitionCategoryId) ?? ''
  const isDirty = Boolean(editingId) && (
    JSON.stringify(draft) !== initialDraftSignature || Boolean(coverFile || coverOriginalFile)
  )

  function resetCoverState() {
    coverImage.reset()
    setOriginalCoverPath('')
    setOriginalCoverSourcePath('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function beginCreate() {
    resetCoverState()
    const nextDraft = emptyDraft()
    setDraft(nextDraft)
    setInitialDraftSignature(JSON.stringify(nextDraft))
    setEditorVersion(version => version + 1)
    setError('')
    setNotice('')
    setPublishErrors([])
    setEditingId('new')
  }

  function beginEdit(item: EditorialRow) {
    resetCoverState()
    const publication = kind === 'publications' ? item as Publication : null
    const competition = kind === 'competitions' ? item as Competition : null
    const coverPath = item.cover_path ?? ''
    const nextDraft: Draft = {
      slug: item.slug,
      title: publication?.title ?? competition?.name ?? '',
      summary: publication?.excerpt ?? competition?.description ?? '',
      bodyDocument: publication ? parseRichTextDocument(publication.body_json, publication.body) : emptyRichTextDocument(),
      coverPath,
      coverSourcePath: item.cover_source_path ?? '',
      coverCrop: cropRectFromJson(item.cover_crop),
      coverAltText: item.cover_alt_text ?? '',
      publicationCategoryId: publication?.category_id ?? '',
      publishedAt: publication?.published_at ?? '',
      isPublished: item.is_published,
      isFeatured: item.is_featured,
      competitionCategoryId: competition?.category_id ?? '',
      rulesUrl: competition?.rules_url ?? '',
      registrationUrl: competition?.registration_url ?? '',
      registrationDeadline: competition?.registration_deadline ?? '',
      status: competition?.status ?? 'upcoming',
    }
    setDraft(nextDraft)
    setInitialDraftSignature(JSON.stringify(nextDraft))
    setOriginalCoverPath(coverPath)
    coverImage.reset(nextDraft.coverCrop)
    setOriginalCoverSourcePath(item.cover_source_path ?? '')
    setEditorVersion(version => version + 1)
    setError('')
    setNotice('')
    setPublishErrors([])
    setEditingId(item.id)
  }

  function closeEditor() {
    setEditingId(null)
    setDraft(emptyDraft())
    setPublishErrors([])
    setCategoryManagerOpen(false)
    setDiscardOpen(false)
    setInitialDraftSignature('')
    resetCoverState()
  }

  function requestCloseEditor() {
    if (busy) return
    if (isDirty) setDiscardOpen(true)
    else closeEditor()
  }

  function removeCover() {
    coverImage.reset()
    setDraft(current => ({ ...current, coverPath: '', coverSourcePath: '', coverCrop: null, coverAltText: '' }))
  }

  function validatePublished(candidate: Draft) {
    const missing: string[] = []
    const hasCover = Boolean(coverFile || candidate.coverPath)
    if (kind === 'publications') {
      if (!candidate.title.trim()) missing.push('Title')
      if (!candidate.summary.trim()) missing.push('Summary')
      if (!richTextHasContent(candidate.bodyDocument)) missing.push('Article content')
      if (!candidate.publicationCategoryId) missing.push('Publication category')
      if (!hasCover) missing.push('Cover')
      if (hasCover && !candidate.coverAltText.trim()) missing.push('Cover Alt Text')
      if (!candidate.publishedAt) missing.push('Publication date')
    } else {
      if (!candidate.title.trim()) missing.push('Competition name')
      if (!candidate.summary.trim()) missing.push('Description')
      if (!candidate.competitionCategoryId) missing.push('Competition category')
      if (!hasCover) missing.push('Cover')
      if (hasCover && !candidate.coverAltText.trim()) missing.push('Cover Alt Text')
      if (!['upcoming', 'open', 'closed', 'archived'].includes(candidate.status)) missing.push('Competition status')
      if (candidate.status === 'open' && !validHttpUrl(candidate.registrationUrl)) missing.push('Registration URL for an open competition')
    }
    return missing
  }

  function choosePublishingState(published: boolean) {
    if (!published) {
      setDraft(current => ({ ...current, isPublished: false }))
      setPublishErrors([])
      return
    }
    const missing = validatePublished(draft)
    if (missing.length) {
      setPublishErrors(missing)
      return
    }
    setDraft(current => ({ ...current, isPublished: true }))
    setPublishErrors([])
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingId) return
    if (draft.isPublished) {
      const missing = validatePublished(draft)
      if (missing.length) {
        setPublishErrors(missing)
        setError('Complete the required publishing fields, or switch back to Draft.')
        return
      }
    }

    setBusy(true)
    setError('')
    setNotice('')
    let uploadedPath: string | null = null
    let uploadedSourcePath: string | null = null

    try {
      let nextCoverPath = draft.coverPath || null
      let nextSourcePath = draft.coverSourcePath || null
      if (coverOriginalFile) {
        uploadedSourcePath = `${kind}/${crypto.randomUUID()}.${sourceExtension(coverOriginalFile)}`
        const sourceUpload = await supabase.storage.from(PHOTO_SOURCE_BUCKET).upload(uploadedSourcePath, coverOriginalFile, {
          contentType: coverOriginalFile.type,
          upsert: false,
        })
        if (sourceUpload.error) throw new Error(sourceUpload.error.message)
        nextSourcePath = uploadedSourcePath
      }
      if (coverFile) {
        uploadedPath = `${kind}/${crypto.randomUUID()}.webp`
        const derivativeUpload = await supabase.storage.from('marketing-editorial').upload(uploadedPath, coverFile, {
          contentType: 'image/webp',
          upsert: false,
        })
        if (derivativeUpload.error) throw new Error(derivativeUpload.error.message)
        nextCoverPath = uploadedPath
      }
      const nextSortOrder = rows.length + 1
      const common = {
        slug: editingId === 'new' ? '' : draft.slug.trim(),
        cover_path: nextCoverPath,
        cover_source_path: nextCoverPath ? nextSourcePath : null,
        cover_crop: nextCoverPath ? draft.coverCrop as unknown as Json : null,
        cover_alt_text: nextCoverPath ? draft.coverAltText.trim() || null : null,
        is_published: draft.isPublished,
        is_featured: draft.isFeatured,
        ...(editingId === 'new' ? { sort_order: nextSortOrder } : {}),
      }

      const result = kind === 'publications'
        ? (editingId === 'new'
          ? await supabase.from('publications').insert({
              ...common,
              title: draft.title.trim(),
              excerpt: draft.summary.trim(),
              body: richTextToPlainText(draft.bodyDocument),
              body_json: draft.bodyDocument as unknown as Json,
              category_id: draft.publicationCategoryId || null,
              category: selectedPublicationCategory || null,
              published_at: draft.publishedAt || null,
            })
          : await supabase.from('publications').update({
              ...common,
              title: draft.title.trim(),
              excerpt: draft.summary.trim(),
              body: richTextToPlainText(draft.bodyDocument),
              body_json: draft.bodyDocument as unknown as Json,
              category_id: draft.publicationCategoryId || null,
              category: selectedPublicationCategory || null,
              published_at: draft.publishedAt || null,
            }).eq('id', editingId))
        : (editingId === 'new'
          ? await supabase.from('competitions').insert({
              ...common,
              name: draft.title.trim(),
              description: draft.summary.trim(),
              category_id: draft.competitionCategoryId || null,
              rules_url: draft.rulesUrl.trim() || null,
              registration_url: draft.registrationUrl.trim() || null,
              registration_deadline: draft.registrationDeadline || null,
              status: draft.status,
            })
          : await supabase.from('competitions').update({
              ...common,
              name: draft.title.trim(),
              description: draft.summary.trim(),
              category_id: draft.competitionCategoryId || null,
              rules_url: draft.rulesUrl.trim() || null,
              registration_url: draft.registrationUrl.trim() || null,
              registration_deadline: draft.registrationDeadline || null,
              status: draft.status,
            }).eq('id', editingId))

      if (result.error) throw new Error(result.error.message)

      let savedNotice = `${kind === 'publications' ? 'Publication' : 'Competition'} saved.`
      if (originalCoverPath && originalCoverPath !== nextCoverPath && originalCoverPath.startsWith(`${kind}/`)) {
        const cleanup = await supabase.storage.from('marketing-editorial').remove([originalCoverPath])
        if (cleanup.error) savedNotice += ` Old cover cleanup needs attention: ${formError(cleanup.error, 'Review the stored file manually.')}`
      }
      if (originalCoverSourcePath && originalCoverSourcePath !== nextSourcePath && originalCoverSourcePath.startsWith(`${kind}/`)) {
        const cleanup = await supabase.storage.from(PHOTO_SOURCE_BUCKET).remove([originalCoverSourcePath])
        if (cleanup.error) savedNotice += ` Old original cleanup needs attention: ${formError(cleanup.error, 'Review the stored file manually.')}`
      }

      setNotice(savedNotice)
      closeEditor()
      await load()
    } catch (saveError) {
      let cleanupWarning = ''
      let persisted: { cover_path: string | null; cover_source_path: string | null } | null = null
      let reconciliationError: { message: string } | null = null
      if (uploadedPath || uploadedSourcePath) {
        const reconciliation = kind === 'publications'
          ? await supabase.rpc('admin_list_publications')
          : await supabase.rpc('admin_list_competitions')
        persisted = (reconciliation.data ?? []).find(item => (
          (uploadedPath && item.cover_path === uploadedPath)
          || (uploadedSourcePath && item.cover_source_path === uploadedSourcePath)
        )) ?? null
        reconciliationError = reconciliation.error
      }
      const savedDespiteResponse = Boolean(persisted) && (
        (!uploadedPath || persisted?.cover_path === uploadedPath)
        && (!uploadedSourcePath || persisted?.cover_source_path === uploadedSourcePath)
      )
      if (savedDespiteResponse) {
        setNotice(`${kind === 'publications' ? 'Publication' : 'Competition'} saved. Refreshing the list confirmed the stored record.`)
        closeEditor()
        await load()
        return
      }
      if (reconciliationError) {
        cleanupWarning = ' New files were preserved because database status could not be confirmed. Review Storage before retrying.'
      } else {
        if (coverFile && uploadedPath && uploadedPath !== originalCoverPath) await supabase.storage.from('marketing-editorial').remove([uploadedPath])
        if (uploadedSourcePath && uploadedSourcePath !== originalCoverSourcePath) await supabase.storage.from(PHOTO_SOURCE_BUCKET).remove([uploadedSourcePath])
      }
      setError(formError(saveError, 'Content could not be saved. Check the required fields and try again.') + cleanupWarning)
    } finally {
      setBusy(false)
    }
  }

  async function persistOrder(next: EditorialRow[]) {
    setBusy(true)
    setError('')
    try {
      for (let index = 0; index < next.length; index += 1) {
        const result = kind === 'publications'
          ? await supabase.from('publications').update({ sort_order: index + 1 }).eq('id', next[index].id)
          : await supabase.from('competitions').update({ sort_order: index + 1 }).eq('id', next[index].id)
        if (result.error) throw new Error(result.error.message)
      }
      await load()
    } catch (orderError) {
      setError(formError(orderError, 'Editorial order could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  function moveItem(id: string, delta: number) {
    const source = [...rows] as EditorialRow[]
    const from = source.findIndex(item => item.id === id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= source.length) return
    const moved = source.splice(from, 1)[0]
    source.splice(to, 0, moved)
    void persistOrder(source)
  }

  function dropItem(targetId: string) {
    if (!draggingId || draggingId === targetId) return
    const source = [...rows] as EditorialRow[]
    const from = source.findIndex(item => item.id === draggingId)
    const to = source.findIndex(item => item.id === targetId)
    if (from < 0 || to < 0) return
    const moved = source.splice(from, 1)[0]
    source.splice(to, 0, moved)
    setDraggingId(null)
    void persistOrder(source)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setBusy(true)
    setError('')
    const result = kind === 'publications'
      ? await supabase.from('publications').delete().eq('id', target.id)
      : await supabase.from('competitions').delete().eq('id', target.id)

    if (result.error) {
      setError(formError(result.error, 'Content could not be deleted.'))
      setBusy(false)
      return
    }

    let cleanupWarning = ''
    if (target.cover_path?.startsWith(`${kind}/`)) {
      const cleanup = await supabase.storage.from('marketing-editorial').remove([target.cover_path])
      if (cleanup.error) cleanupWarning = ` Cover cleanup needs attention: ${formError(cleanup.error, 'Review the stored file manually.')}`
    }
    if (target.cover_source_path?.startsWith(`${kind}/`)) {
      const cleanup = await supabase.storage.from(PHOTO_SOURCE_BUCKET).remove([target.cover_source_path])
      if (cleanup.error) cleanupWarning += ` Original source cleanup needs attention: ${formError(cleanup.error, 'Review the stored file manually.')}`
    }

    const remaining = (rows as EditorialRow[]).filter(item => item.id !== target.id)
    setDeleteTarget(null)
    await persistOrder(remaining)
    setNotice(`${kind === 'publications' ? 'Publication' : 'Competition'} deleted permanently.${cleanupWarning}`)
    setBusy(false)
  }

  async function openPreview() {
    if (!editingId) return
    const previewWindow = window.open('about:blank', '_blank')
    const previewKey = crypto.randomUUID()

    try {
      const coverUrl = coverFile ? await fileToDataUrl(coverFile) : currentCoverUrl || null
      const payload = kind === 'publications'
        ? {
            createdAt: Date.now(),
            kind: 'publication' as const,
            data: {
              id: editingId,
              slug: draft.slug || 'preview',
              title: draft.title || 'Untitled publication',
              summary: draft.summary,
              category: selectedPublicationCategory || null,
              publicationDate: draft.publishedAt || null,
              coverUrl,
              coverAltText: draft.coverAltText || null,
              body: draft.bodyDocument,
            },
          }
        : {
            createdAt: Date.now(),
            kind: 'competition' as const,
            data: {
              id: editingId,
              slug: draft.slug || 'preview',
              name: draft.title || 'Untitled competition',
              description: draft.summary,
              category: selectedCompetitionCategory || null,
              status: draft.status,
              registrationDeadline: draft.registrationDeadline || null,
              registrationUrl: draft.registrationUrl.trim() || null,
              rulesUrl: draft.rulesUrl.trim() || null,
              coverUrl,
              coverAltText: draft.coverAltText || null,
            },
          }

      window.localStorage.setItem(`strativate-editorial-preview:${previewKey}`, JSON.stringify(payload))
      const url = `/editorial-preview/${kind === 'publications' ? 'publication' : 'competition'}?key=${encodeURIComponent(previewKey)}`
      if (previewWindow) {
        previewWindow.opener = null
        previewWindow.location.href = url
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch (previewError) {
      previewWindow?.close()
      setError(formError(previewError, 'Preview could not be prepared.'))
    }
  }

  const singular = kind === 'publications' ? 'publication' : 'competition'
  const countLabel = `${filteredRows.length} ${singular}${filteredRows.length === 1 ? '' : 's'}`
  const datasetEmpty = !loading && rows.length === 0

  return <section className="editorial-admin" data-testid="admin-editorial-content-section">
    <div className="editorial-admin__heading">
      <div className="role-page-title">
        <h2>{kind === 'publications' ? 'Publications' : 'Competitions'}</h2>

      </div>
      <button className="button button-primary" type="button" onClick={beginCreate}><Plus aria-hidden="true" size={16} /> Add {singular}</button>
    </div>

    <div className="editorial-admin__managementbar">
      <p className="editorial-admin__count">{countLabel}</p>
      <div className="editorial-admin__filters">
        <label className="editorial-admin__search">
          <Search aria-hidden="true" size={16} />
          <span className="sr-only">Search editorial content</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${kind}`} />
        </label>
        <Select.Root items={statusFilterItems} value={statusFilter} onValueChange={value => setStatusFilter(value as StatusFilter)}>
          <Select.Trigger className="editorial-admin__state-trigger" aria-label={`${singular} state`}>
            <Select.Value />
            <Select.Icon className="editorial-admin__state-trigger-icon"><ChevronDown aria-hidden="true" /></Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner className="editorial-admin__state-positioner" side="bottom" align="start" sideOffset={6} alignItemWithTrigger={false}>
              <Select.Popup className="editorial-admin__state-popup">
                <Select.List className="editorial-admin__state-list">
                  {(Object.entries(statusFilterItems) as [StatusFilter, string][]).map(([value, label]) => <Select.Item className="editorial-admin__state-option" value={value} key={value}>
                    <Select.ItemIndicator className="editorial-admin__state-indicator"><Check aria-hidden="true" /></Select.ItemIndicator>
                    <Select.ItemText>{label}</Select.ItemText>
                  </Select.Item>)}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>
    </div>

    {notice ? <p className="admin-notice">{notice}</p> : null}
    {error ? <p className="form-error">{error}</p> : null}

    {loading ? <div className="editorial-compact-empty"><FileText aria-hidden="true" /><strong>Loading editorial content…</strong></div> : null}

    {!loading ? <div className="editorial-admin__list">
      {filteredRows.map(item => {
        const index = (rows as EditorialRow[]).findIndex(row => row.id === item.id)
        const publication = 'title' in item ? item : null
        const competition = 'name' in item ? item : null
        const categoryName = publication
          ? publicationCategoryNames.get(publication.category_id ?? '') ?? publication.category ?? 'Uncategorized'
          : competitionCategoryNames.get(competition?.category_id ?? '') ?? 'Uncategorized'
        const metadata = publication
          ? formatShortDate(publication.published_at)
          : competition?.registration_deadline ? `Deadline ${formatShortDate(competition.registration_deadline)}` : 'No deadline'

        return <article
          className="editorial-admin-row"
          key={item.id}
          draggable={!busy}
          onDragStart={() => setDraggingId(item.id)}
          onDragEnd={() => setDraggingId(null)}
          onDragOver={event => event.preventDefault()}
          onDrop={() => dropItem(item.id)}
        >
          <div className="editorial-admin-row__order">
            <button className="editorial-drag-handle" type="button" title="Drag to reorder" aria-label={`Drag ${itemTitle(item)} to reorder`}><GripVertical aria-hidden="true" /></button>
            <span className="editorial-position">#{String(index + 1).padStart(2, '0')}</span>
          </div>
          <div className="editorial-admin-row__thumb">
            {item.cover_path
              ? <img src={supabase.storage.from('marketing-editorial').getPublicUrl(item.cover_path).data.publicUrl} alt={item.cover_alt_text ?? ''} />
              : <span aria-hidden="true"><ImagePlus /></span>}
          </div>
          <div className="editorial-admin-row__copy">
            <div className="editorial-admin-row__title">
              <h3>{itemTitle(item) || `Untitled ${singular}`}</h3>
              <div className="editorial-admin-row__badges">
                <span className={item.is_published ? 'editorial-badge editorial-badge--published' : 'editorial-badge'}>{item.is_published ? 'Published' : 'Draft'}</span>
                {item.is_featured ? <span className="editorial-badge editorial-badge--featured"><Sparkles aria-hidden="true" /> Featured</span> : null}
                {competition ? <span className="editorial-badge editorial-badge--business">{competition.status}</span> : null}
              </div>
            </div>
            <p className="editorial-admin-row__category">{categoryName}</p>
            <p className="editorial-admin-row__summary">{itemSummary(item) || 'No summary yet.'}</p>
          </div>
          <div className="editorial-admin-row__meta">
            <CalendarDays aria-hidden="true" />
            <span>{metadata}</span>
          </div>
          <div className="editorial-admin-row__actions">
            <div className="editorial-admin-row__move">
              <button type="button" className="editorial-icon-button" onClick={() => moveItem(item.id, -1)} disabled={busy || index === 0} aria-label={`Move ${itemTitle(item)} up`} title="Move up"><ArrowUp aria-hidden="true" /></button>
              <button type="button" className="editorial-icon-button" onClick={() => moveItem(item.id, 1)} disabled={busy || index === rows.length - 1} aria-label={`Move ${itemTitle(item)} down`} title="Move down"><ArrowDown aria-hidden="true" /></button>
            </div>
            <button className="editorial-icon-button" type="button" onClick={() => beginEdit(item)} aria-label={`Edit ${itemTitle(item)}`} title="Edit"><Pencil aria-hidden="true" /></button>
            <button className="editorial-icon-button editorial-icon-button--danger" type="button" onClick={() => setDeleteTarget(item)} disabled={busy} aria-label={`Delete ${itemTitle(item)}`} title="Delete"><Trash2 aria-hidden="true" /></button>
          </div>
        </article>
      })}

      {!filteredRows.length ? <div className="editorial-compact-empty">
        <FileText aria-hidden="true" />
        <strong>{datasetEmpty ? `No ${kind} yet.` : `No ${kind} match these filters.`}</strong>
        <span>{datasetEmpty ? `Create the first approved ${singular} when the content is ready.` : 'Adjust the search or state filter.'}</span>
        {datasetEmpty ? <button className="button button-primary button-compact" type="button" onClick={beginCreate}><Plus aria-hidden="true" /> Add {singular}</button> : null}
      </div> : null}
    </div> : null}

    <dialog ref={editorDialogRef} className="editorial-admin__dialog" data-testid="editorial-content-dialog" onCancel={event => { event.preventDefault(); requestCloseEditor() }}>
      <form onSubmit={save} className="editorial-editor"><fieldset className={dataStyles.editableFields} disabled={busy}>
        <header className="editorial-editor__header">
          <div>

            <h3>{editingId === 'new' ? `Create ${singular}` : `Edit ${singular}`}</h3>
            {editingId !== 'new' && draft.title ? <p>{draft.title}</p> : null}
          </div>
          <button className="editorial-icon-button" type="button" onClick={requestCloseEditor} aria-label="Close editor" title="Close"><X aria-hidden="true" /></button>
        </header>

        <div className="editorial-editor__body">
          <section className="editorial-editor-section">
            <div className="editorial-editor-section__heading"><span>01</span><div><h4>Basic information</h4><p>Core public-facing identity and listing copy.</p></div></div>
            <div className="editorial-field-grid">
              <label className="editorial-field editorial-field--wide">
                <span>{kind === 'publications' ? 'Title' : 'Competition name'}</span>
                <input maxLength={180} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder={kind === 'publications' ? 'Publication title' : 'Competition name'} />
                <small>{draft.title.length} / 180</small>
              </label>
              <label className="editorial-field editorial-field--wide">
                <span>{kind === 'publications' ? 'Summary' : 'Description'}</span>
                <textarea
                  rows={4}
                  maxLength={kind === 'publications' ? 500 : 5000}
                  value={draft.summary}
                  onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))}
                  placeholder={kind === 'publications' ? 'Short listing/card summary' : 'Concise public competition description'}
                />
                <small>{kind === 'publications' ? 'Appears on listing cards. ' : 'Keep the opportunity clear and scannable. '}{draft.summary.length} / {kind === 'publications' ? '500' : '5000'}</small>
              </label>
              {kind === 'publications' ? <div className="editorial-field editorial-field--wide">
                <span>Publication category</span>
                <div className="editorial-category-control">
                  <select value={draft.publicationCategoryId} onChange={event => setDraft(current => ({ ...current, publicationCategoryId: event.target.value }))}>
                    <option value="">Select category</option>
                    {publicationCategories.filter(category => category.is_active).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <button type="button" className="editorial-gear-button" onClick={() => setCategoryManagerOpen(true)} aria-label="Manage publication categories" title="Manage publication categories"><Settings aria-hidden="true" /></button>
                </div>
              </div> : <label className="editorial-field editorial-field--wide">
                <span>Competition category</span>
                <select value={draft.competitionCategoryId} onChange={event => setDraft(current => ({ ...current, competitionCategoryId: event.target.value }))} data-testid="editorial-competition-category-select">
                  <option value="">Select category</option>
                  {competitionCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>}
            </div>
          </section>

          {kind === 'publications' ? <section className="editorial-editor-section">
            <div className="editorial-editor-section__heading"><span>02</span><div><h4>Article content</h4><p>Structured article body. The page title remains the only H1.</p></div></div>
            <RichTextEditor disabled={busy} key={editorVersion} initialValue={draft.bodyDocument} onChange={bodyDocument => setDraft(current => ({ ...current, bodyDocument }))} />
          </section> : <section className="editorial-editor-section">
            <div className="editorial-editor-section__heading"><span>02</span><div><h4>Competition information</h4><p>Optional URLs and timing used by the public opportunity page.</p></div></div>
            <div className="editorial-field-grid">
              <label className="editorial-field"><span>Registration URL</span><input type="url" value={draft.registrationUrl} onChange={event => setDraft(current => ({ ...current, registrationUrl: event.target.value }))} placeholder="https://…" /></label>
              <label className="editorial-field"><span>Rules URL</span><input type="url" value={draft.rulesUrl} onChange={event => setDraft(current => ({ ...current, rulesUrl: event.target.value }))} placeholder="https://…" /></label>
              <label className="editorial-field"><span>Registration deadline</span><input type="date" value={draft.registrationDeadline} onChange={event => setDraft(current => ({ ...current, registrationDeadline: event.target.value }))} /></label>
            </div>
          </section>}

          <section className="editorial-editor-section">
            <div className="editorial-editor-section__heading"><span>03</span><div><h4>Cover</h4><p>Use a consistent 16:9 crop for admin rows, cards, previews, and public detail pages.</p></div></div>
            <div className="editorial-cover-editor">
              {currentCoverUrl ? <div className="editorial-cover-preview">
                <img src={currentCoverUrl} alt={draft.coverAltText || 'Cover preview'} data-testid="editorial-cover-preview" />
                <div className="editorial-cover-preview__actions">
                  <label className="button button-outline button-compact" htmlFor={`editorial-cover-file-${kind}`}><ImagePlus aria-hidden="true" /> Replace</label>
                  <button className="button button-outline button-compact" type="button" onClick={() => void coverImage.adjust(draft.coverSourcePath)} disabled={busy || (!coverOriginalFile && !draft.coverSourcePath)} title={draft.coverSourcePath || coverOriginalFile ? 'Adjust crop' : 'Original source unavailable'}><Crop aria-hidden="true" /> Adjust crop</button>
                  <button className="button button-danger button-compact" type="button" onClick={removeCover}><Trash2 aria-hidden="true" /> Remove</button>
                </div>
                {!coverOriginalFile && draft.coverPath && !draft.coverSourcePath ? <p className="editorial-cover-legacy-note">Original source is unavailable for this existing image. Replace the image once to enable future crop adjustments.</p> : null}
              </div> : <label
                className="editorial-cover-dropzone"
                htmlFor={`editorial-cover-file-${kind}`}
                onDragOver={event => event.preventDefault()}
                onDrop={event => { event.preventDefault(); if (!busy) coverImage.choose(event.dataTransfer.files[0] ?? null) }}
              >
                <UploadCloud aria-hidden="true" />
                <strong>Drop a cover here or click to upload</strong>
                <span>JPG / PNG / WebP · max 5 MB · final ratio 16:9</span>
              </label>}
              <input
                ref={fileInputRef}
                id={`editorial-cover-file-${kind}`}
                data-testid="editorial-cover-file-input"
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={event => { coverImage.choose(event.target.files?.[0] ?? null); event.target.value = '' }}
              />
              <label className="editorial-field">
                <span>Cover Alt Text</span>
                <input maxLength={220} value={draft.coverAltText} onChange={event => setDraft(current => ({ ...current, coverAltText: event.target.value }))} placeholder="Describe meaningful cover content" />
                <small>{draft.coverAltText.length} / 220 · Required when publishing with a cover.</small>
              </label>
            </div>
          </section>

          <section className="editorial-editor-section">
            <div className="editorial-editor-section__heading"><span>04</span><div><h4>Publishing</h4><p>Drafts can stay incomplete. Published content must pass public-facing requirements.</p></div></div>
            <div className="editorial-publishing-grid">
              <div className="editorial-status-control" role="group" aria-label="Publishing status">
                <button type="button" className={!draft.isPublished ? 'active' : ''} aria-pressed={!draft.isPublished} onClick={() => choosePublishingState(false)}><span className="editorial-status-dot" /> Draft</button>
                <button type="button" className={draft.isPublished ? 'active editorial-status-published' : ''} aria-pressed={draft.isPublished} onClick={() => choosePublishingState(true)}><span className="editorial-status-dot" /> Published</button>
              </div>
              {kind === 'publications' ? <label className="editorial-field"><span>Publication date</span><input type="date" value={draft.publishedAt} onChange={event => setDraft(current => ({ ...current, publishedAt: event.target.value }))} /></label> : null}
              {kind === 'competitions' ? <label className="editorial-field"><span>Competition status</span><select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as Competition['status'] }))}><option value="upcoming">Upcoming</option><option value="open">Open</option><option value="closed">Closed</option><option value="archived">Archived</option></select><small>Open competitions require a Registration URL before publishing.</small></label> : null}
              <button type="button" className={draft.isFeatured ? 'editorial-feature-toggle active' : 'editorial-feature-toggle'} aria-pressed={draft.isFeatured} onClick={() => setDraft(current => ({ ...current, isFeatured: !current.isFeatured }))}>
                <Sparkles aria-hidden="true" /><span><strong>Featured</strong><small>{kind === 'publications' ? 'Prioritize this story for the Featured Stories selection.' : 'Mark this opportunity for subtle editorial prominence.'}</small></span><b>{draft.isFeatured ? 'On' : 'Off'}</b>
              </button>
            </div>
            {publishErrors.length ? <div className="editorial-publish-warning" role="alert"><strong>Complete these fields before publishing:</strong><ul>{publishErrors.map(item => <li key={item}>{item}</li>)}</ul><p>You can still save the item as Draft.</p></div> : null}
          </section>
        </div>

        <footer className="editorial-editor__footer">
          <div className="editorial-editor__action-group">
            <button className="button button-outline editorial-editor__cancel" type="button" onClick={requestCloseEditor} disabled={busy}><X aria-hidden="true" /> Cancel</button>
            <button className="button button-outline" type="button" onClick={() => void openPreview()} disabled={busy}><Eye aria-hidden="true" /> Preview</button>
            <button className="button button-primary" type="submit" disabled={busy}><Save aria-hidden="true" /> {busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </footer>
      </fieldset></form>
    </dialog>

    <EditorialCoverCropper {...coverImage.cropperProps} onApply={result => {
      coverImage.cropperProps.onApply(result)
      setDraft(current => ({ ...current, coverCrop: result.crop }))
    }} />

    {kind === 'publications' ? <PublicationCategoryManager
      open={categoryManagerOpen}
      categories={publicationCategories}
      publications={publications}
      onClose={() => setCategoryManagerOpen(false)}
      onChanged={load}
    /> : null}

    <dialog ref={discardDialogRef} className="editorial-discard-dialog" aria-labelledby="editorial-discard-title" onCancel={event => { event.preventDefault(); setDiscardOpen(false) }}>
      <h3 id="editorial-discard-title">Discard unsaved changes?</h3>
      <p>Your unsaved changes will be lost.</p>
      <div>
        <button type="button" className="button button-outline button-compact" onClick={() => setDiscardOpen(false)}>Keep editing</button>
        <button type="button" className="button button-danger button-compact" onClick={closeEditor}>Discard changes</button>
      </div>
    </dialog>

    <dialog ref={deleteDialogRef} className="editorial-delete-dialog" aria-labelledby="editorial-delete-title" onCancel={event => { event.preventDefault(); setDeleteTarget(null) }}>
      {deleteTarget ? <>
        <div className="editorial-delete-dialog__icon"><Trash2 aria-hidden="true" /></div>
        <h3 id="editorial-delete-title">Delete “{itemTitle(deleteTarget)}”?</h3>
        <p>This permanently deletes the {singular}. {deleteTarget.cover_path ? 'Its stored cover file will also be removed after the record is deleted.' : 'This action cannot be undone.'}</p>
        <div>
          <button type="button" className="button button-outline" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</button>
          <button type="button" className="button button-danger" onClick={() => void confirmDelete()} disabled={busy}><Trash2 aria-hidden="true" /> {busy ? 'Deleting…' : 'Delete permanently'}</button>
        </div>
      </> : null}
    </dialog>
  </section>
}
