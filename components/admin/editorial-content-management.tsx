'use client'

import { ImagePlus, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Competition, CompetitionCategory, Publication } from '@/lib/supabase/database.types'

export type EditorialKind = 'publications' | 'competitions'
type StatusFilter = 'all' | 'published' | 'draft'
type Draft = {
  slug: string
  title: string
  excerpt: string
  body: string
  coverPath: string
  coverAltText: string
  publicationCategory: string
  publishedAt: string
  isPublished: boolean
  isFeatured: boolean
  sortOrder: number
  categoryId: string
  rulesUrl: string
  registrationUrl: string
  registrationDeadline: string
  status: Competition['status']
}

const emptyDraft: Draft = {
  slug: '', title: '', excerpt: '', body: '', coverPath: '', coverAltText: '',
  publicationCategory: '', publishedAt: '', isPublished: false, isFeatured: false,
  sortOrder: 0, categoryId: '', rulesUrl: '', registrationUrl: '',
  registrationDeadline: '', status: 'upcoming',
}

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxCoverBytes = 5 * 1024 * 1024

export function EditorialContentManagement({ initialKind = 'publications' }: { initialKind?: EditorialKind }) {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previewObjectUrlRef = useRef<string | null>(null)
  const [kind, setKind] = useState<EditorialKind>(initialKind)
  const [publications, setPublications] = useState<Publication[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [categories, setCategories] = useState<CompetitionCategory[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [originalCoverPath, setOriginalCoverPath] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const clearPreviewObjectUrl = useCallback(() => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
    previewObjectUrlRef.current = null
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [publicationResult, competitionResult, categoryResult] = await Promise.all([
      supabase.from('publications').select('*').order('sort_order').order('created_at', { ascending: false }),
      supabase.from('competitions').select('*').order('sort_order').order('created_at', { ascending: false }),
      supabase.from('competition_categories').select('*').eq('is_active', true).order('sort_order').order('name'),
    ])
    const loadError = publicationResult.error ?? competitionResult.error ?? categoryResult.error
    if (loadError) setError(loadError.message)
    setPublications(publicationResult.data ?? [])
    setCompetitions(competitionResult.data ?? [])
    setCategories(categoryResult.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    setKind(initialKind)
    setEditingId(null)
    setDraft(emptyDraft)
    setQuery('')
    setStatusFilter('all')
  }, [initialKind])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editingId && !dialog.open) dialog.showModal()
    if (!editingId && dialog.open) dialog.close()
  }, [editingId])
  useEffect(() => () => clearPreviewObjectUrl(), [clearPreviewObjectUrl])

  const rows = kind === 'publications' ? publications : competitions
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en')
    return (rows as Array<Publication | Competition>).filter(item => {
      const title = 'title' in item ? item.title : item.name
      const description = 'excerpt' in item ? item.excerpt : item.description
      const matchesQuery = !needle || `${title} ${description} ${item.slug}`.toLocaleLowerCase('en').includes(needle)
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'published' ? item.is_published : !item.is_published)
      return matchesQuery && matchesStatus
    })
  }, [query, rows, statusFilter])

  const currentCoverUrl = coverPreview || (draft.coverPath ? supabase.storage.from('marketing-editorial').getPublicUrl(draft.coverPath).data.publicUrl : '')

  function resetCoverState() {
    clearPreviewObjectUrl()
    setCoverFile(null)
    setCoverPreview('')
    setOriginalCoverPath('')
  }

  function beginCreate() {
    resetCoverState()
    setDraft(emptyDraft)
    setError('')
    setNotice('')
    setEditingId('new')
  }

  function beginEdit(item: Publication | Competition) {
    resetCoverState()
    const publication = kind === 'publications' ? item as Publication : null
    const competition = kind === 'competitions' ? item as Competition : null
    const coverPath = item.cover_path ?? ''
    setDraft({
      slug: item.slug,
      title: publication?.title ?? competition?.name ?? '',
      excerpt: publication?.excerpt ?? competition?.description ?? '',
      body: publication?.body ?? '',
      coverPath,
      coverAltText: item.cover_alt_text ?? '',
      publicationCategory: publication?.category ?? '',
      publishedAt: publication?.published_at ?? '',
      isPublished: item.is_published,
      isFeatured: item.is_featured,
      sortOrder: item.sort_order,
      categoryId: competition?.category_id ?? '',
      rulesUrl: competition?.rules_url ?? '',
      registrationUrl: competition?.registration_url ?? '',
      registrationDeadline: competition?.registration_deadline ?? '',
      status: competition?.status ?? 'upcoming',
    })
    setOriginalCoverPath(coverPath)
    setError('')
    setNotice('')
    setEditingId(item.id)
  }

  function closeEditor() {
    setEditingId(null)
    setDraft(emptyDraft)
    resetCoverState()
  }

  function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    clearPreviewObjectUrl()
    setCoverFile(null)
    setCoverPreview('')
    if (!file) return
    if (!allowedImageTypes.has(file.type)) {
      setError('Cover must be a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }
    if (file.size > maxCoverBytes) {
      setError('Cover image must be 5 MB or smaller.')
      event.target.value = ''
      return
    }
    const preview = URL.createObjectURL(file)
    previewObjectUrlRef.current = preview
    setCoverFile(file)
    setCoverPreview(preview)
    setError('')
  }

  async function uploadCover() {
    if (!coverFile) return draft.coverPath || null
    const extension = coverFile.type === 'image/png' ? 'png' : coverFile.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${kind}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('marketing-editorial').upload(path, coverFile, { contentType: coverFile.type, upsert: false })
    if (uploadError) throw new Error(uploadError.message)
    return path
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingId) return
    setBusy(true)
    setError('')
    let uploadedPath: string | null = null
    try {
      uploadedPath = await uploadCover()
      const common = {
        slug: draft.slug.trim(),
        cover_path: uploadedPath,
        cover_alt_text: draft.coverAltText.trim() || null,
        is_published: draft.isPublished,
        is_featured: draft.isFeatured,
        sort_order: draft.sortOrder,
      }
      const result = kind === 'publications'
        ? (editingId === 'new'
          ? await supabase.from('publications').insert({ ...common, title: draft.title.trim(), excerpt: draft.excerpt.trim(), body: draft.body.trim(), category: draft.publicationCategory.trim() || null, published_at: draft.publishedAt || null })
          : await supabase.from('publications').update({ ...common, title: draft.title.trim(), excerpt: draft.excerpt.trim(), body: draft.body.trim(), category: draft.publicationCategory.trim() || null, published_at: draft.publishedAt || null }).eq('id', editingId))
        : (editingId === 'new'
          ? await supabase.from('competitions').insert({ ...common, name: draft.title.trim(), description: draft.excerpt.trim(), category_id: draft.categoryId || null, rules_url: draft.rulesUrl.trim() || null, registration_url: draft.registrationUrl.trim() || null, registration_deadline: draft.registrationDeadline || null, status: draft.status })
          : await supabase.from('competitions').update({ ...common, name: draft.title.trim(), description: draft.excerpt.trim(), category_id: draft.categoryId || null, rules_url: draft.rulesUrl.trim() || null, registration_url: draft.registrationUrl.trim() || null, registration_deadline: draft.registrationDeadline || null, status: draft.status }).eq('id', editingId))

      if (result.error) throw new Error(result.error.message)

      if (coverFile && originalCoverPath && originalCoverPath !== uploadedPath && originalCoverPath.startsWith(`${kind}/`)) {
        await supabase.storage.from('marketing-editorial').remove([originalCoverPath])
      }
      setNotice(`${kind === 'publications' ? 'Publication' : 'Competition'} saved.`)
      closeEditor()
      await load()
    } catch (saveError) {
      if (coverFile && uploadedPath && uploadedPath !== originalCoverPath) {
        await supabase.storage.from('marketing-editorial').remove([uploadedPath])
      }
      setError(saveError instanceof Error ? saveError.message : 'Content could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: Publication | Competition) {
    if (!window.confirm(`Delete ${kind === 'publications' ? 'publication' : 'competition'} “${'title' in item ? item.title : item.name}”?`)) return
    setBusy(true)
    const result = kind === 'publications'
      ? await supabase.from('publications').delete().eq('id', item.id)
      : await supabase.from('competitions').delete().eq('id', item.id)
    if (result.error) setError(result.error.message)
    else {
      if (item.cover_path?.startsWith(`${kind}/`)) await supabase.storage.from('marketing-editorial').remove([item.cover_path])
      await load()
    }
    setBusy(false)
  }

  function switchKind(next: EditorialKind) {
    if (next === kind) return
    closeEditor()
    setKind(next)
    setQuery('')
    setStatusFilter('all')
  }

  return <section className="editorial-admin" data-testid="admin-editorial-content-section">
    <div className="role-page-title"><p className="kicker">Editorial CMS</p><h2>Publications and Competitions</h2><p>Manage approved content, publication state, categories, ordering, links, and cover images.</p></div>
    <div className="editorial-admin__toolbar"><div role="tablist" aria-label="Editorial content type"><button className={kind === 'publications' ? 'active' : ''} type="button" onClick={() => switchKind('publications')} aria-selected={kind === 'publications'}>Publications</button><button className={kind === 'competitions' ? 'active' : ''} type="button" onClick={() => switchKind('competitions')} aria-selected={kind === 'competitions'}>Competitions</button></div><button className="button button-primary" type="button" onClick={beginCreate}><Plus aria-hidden="true" size={16}/> Add {kind === 'publications' ? 'publication' : 'competition'}</button></div>
    <div className="editorial-admin__filters"><label><Search aria-hidden="true" size={16}/><span className="sr-only">Search editorial content</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${kind}`}/></label><label><span className="sr-only">Publication state</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}><option value="all">All states</option><option value="published">Published</option><option value="draft">Draft</option></select></label></div>
    {notice ? <p className="admin-notice">{notice}</p> : null}{error ? <p className="form-error">{error}</p> : null}
    {loading ? <p>Loading editorial content…</p> : <div className="editorial-admin__list">{filteredRows.length ? filteredRows.map(item => <article key={item.id}><div>{item.cover_path ? <img className="editorial-admin__thumb" src={supabase.storage.from('marketing-editorial').getPublicUrl(item.cover_path).data.publicUrl} alt={item.cover_alt_text ?? ''}/> : null}<span className={item.is_published ? 'status-pill status-pill--success' : 'status-pill'}>{item.is_published ? 'Published' : 'Draft'}</span><h3>{'title' in item ? item.title : item.name}</h3><p>{'excerpt' in item ? item.excerpt : item.description}</p></div><div className="editorial-admin__actions"><button className="button button-outline button-compact" type="button" onClick={() => beginEdit(item)}><Pencil aria-hidden="true" size={14}/> Edit</button><button className="button button-danger button-compact" type="button" onClick={() => void remove(item)} disabled={busy}><Trash2 aria-hidden="true" size={14}/> Delete</button></div></article>) : <div className="editorial-empty"><strong>No matching {kind}.</strong><span>Adjust the filters or add approved content.</span></div>}</div>}

    <dialog ref={dialogRef} className="editorial-admin__dialog" data-testid="editorial-content-dialog" onClose={closeEditor}>
      <form onSubmit={save}>
        <button className="dialog-close" type="button" onClick={closeEditor} aria-label="Close editor"><X aria-hidden="true"/></button>
        <p className="kicker">{editingId === 'new' ? 'New' : 'Edit'} {kind === 'publications' ? 'publication' : 'competition'}</p><h3>{draft.title || 'Editorial content'}</h3>
        <label>Title / name<input required maxLength={180} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })}/></label>
        <label>Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={120} value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })}/></label>
        <label>{kind === 'publications' ? 'Excerpt' : 'Description'}<textarea required rows={4} value={draft.excerpt} onChange={event => setDraft({ ...draft, excerpt: event.target.value })}/></label>

        {kind === 'publications' ? <>
          <label>Category<input maxLength={80} value={draft.publicationCategory} onChange={event => setDraft({ ...draft, publicationCategory: event.target.value })} placeholder="e.g. Insights"/></label>
          <label>Body<textarea required rows={10} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })}/></label>
          <label>Published date<input type="date" value={draft.publishedAt} onChange={event => setDraft({ ...draft, publishedAt: event.target.value })}/></label>
        </> : <>
          <label>Competition category<select value={draft.categoryId} onChange={event => setDraft({ ...draft, categoryId: event.target.value })} data-testid="editorial-competition-category-select"><option value="">No category</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>Registration URL<input type="url" value={draft.registrationUrl} onChange={event => setDraft({ ...draft, registrationUrl: event.target.value })} placeholder="https://…"/></label>
          <label>Rules URL<input type="url" value={draft.rulesUrl} onChange={event => setDraft({ ...draft, rulesUrl: event.target.value })} placeholder="https://…"/></label>
          <label>Registration deadline<input type="date" value={draft.registrationDeadline} onChange={event => setDraft({ ...draft, registrationDeadline: event.target.value })}/></label>
          <label>Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Competition['status'] })}><option value="upcoming">Upcoming</option><option value="open">Open</option><option value="closed">Closed</option><option value="archived">Archived</option></select></label>
        </>}

        <div className="editorial-admin__cover-field"><div><label htmlFor="editorial-cover-file">Cover image</label><p>JPG, PNG, or WebP. Maximum 5 MB.</p><label className="button button-outline button-compact" htmlFor="editorial-cover-file"><ImagePlus aria-hidden="true" size={16}/> Choose image</label><input id="editorial-cover-file" data-testid="editorial-cover-file-input" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseCover}/></div>{currentCoverUrl ? <img src={currentCoverUrl} alt={draft.coverAltText || 'Cover preview'} data-testid="editorial-cover-preview"/> : <div className="editorial-admin__cover-empty">No cover selected</div>}</div>
        <label>Cover alt text<input maxLength={220} value={draft.coverAltText} onChange={event => setDraft({ ...draft, coverAltText: event.target.value })} placeholder="Describe meaningful cover content"/></label>
        <label>Sort order<input type="number" min="0" max="100000" value={draft.sortOrder} onChange={event => setDraft({ ...draft, sortOrder: Number(event.target.value) })}/></label>
        <label className="checkbox-label"><input type="checkbox" checked={draft.isFeatured} onChange={event => setDraft({ ...draft, isFeatured: event.target.checked })}/> Featured</label>
        <label className="checkbox-label"><input type="checkbox" checked={draft.isPublished} onChange={event => setDraft({ ...draft, isPublished: event.target.checked })}/> Published</label>
        <button className="button button-primary" type="submit" disabled={busy}><Save aria-hidden="true" size={16}/> {busy ? 'Saving…' : 'Save content'}</button>
      </form>
    </dialog>
  </section>
}
