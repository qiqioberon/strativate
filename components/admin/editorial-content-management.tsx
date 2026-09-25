'use client'

import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Competition, Publication } from '@/lib/supabase/database.types'

type Kind = 'publications' | 'competitions'
type Draft = {
  slug: string
  title: string
  excerpt: string
  body: string
  coverPath: string
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

const emptyDraft: Draft = { slug: '', title: '', excerpt: '', body: '', coverPath: '', publishedAt: '', isPublished: false, isFeatured: false, sortOrder: 0, categoryId: '', rulesUrl: '', registrationUrl: '', registrationDeadline: '', status: 'upcoming' }

export function EditorialContentManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [kind, setKind] = useState<Kind>('publications')
  const [publications, setPublications] = useState<Publication[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [publicationResult, competitionResult] = await Promise.all([
      supabase.from('publications').select('*').order('sort_order').order('created_at', { ascending: false }),
      supabase.from('competitions').select('*').order('sort_order').order('created_at', { ascending: false }),
    ])
    if (publicationResult.error || competitionResult.error) setError(publicationResult.error?.message ?? competitionResult.error?.message ?? 'Content could not be loaded.')
    setPublications(publicationResult.data ?? [])
    setCompetitions(competitionResult.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editingId && !dialog.open) dialog.showModal()
    if (!editingId && dialog.open) dialog.close()
  }, [editingId])

  const rows = kind === 'publications' ? publications : competitions
  function beginCreate() {
    setDraft(emptyDraft)
    setError('')
    setNotice('')
    setEditingId('new')
  }

  function beginEdit(item: Publication | Competition) {
    const publication = kind === 'publications' ? item as Publication : null
    const competition = kind === 'competitions' ? item as Competition : null
    setDraft({
      slug: item.slug,
      title: publication?.title ?? competition?.name ?? '',
      excerpt: publication?.excerpt ?? competition?.description ?? '',
      body: publication?.body ?? '',
      coverPath: item.cover_path ?? '',
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
    setError('')
    setNotice('')
    setEditingId(item.id)
  }

  function closeEditor() { setEditingId(null); setDraft(emptyDraft) }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const common = { slug: draft.slug.trim(), cover_path: draft.coverPath.trim() || null, is_published: draft.isPublished, is_featured: draft.isFeatured, sort_order: draft.sortOrder }
    const result = kind === 'publications'
      ? (editingId === 'new' ? await supabase.from('publications').insert({ ...common, title: draft.title.trim(), excerpt: draft.excerpt.trim(), body: draft.body.trim(), published_at: draft.publishedAt || null }) : await supabase.from('publications').update({ ...common, title: draft.title.trim(), excerpt: draft.excerpt.trim(), body: draft.body.trim(), published_at: draft.publishedAt || null }).eq('id', editingId!))
      : (editingId === 'new' ? await supabase.from('competitions').insert({ ...common, name: draft.title.trim(), description: draft.excerpt.trim(), category_id: draft.categoryId || null, rules_url: draft.rulesUrl.trim() || null, registration_url: draft.registrationUrl.trim() || null, registration_deadline: draft.registrationDeadline || null, status: draft.status }) : await supabase.from('competitions').update({ ...common, name: draft.title.trim(), description: draft.excerpt.trim(), category_id: draft.categoryId || null, rules_url: draft.rulesUrl.trim() || null, registration_url: draft.registrationUrl.trim() || null, registration_deadline: draft.registrationDeadline || null, status: draft.status }).eq('id', editingId!))
    if (result.error) setError(result.error.message)
    else { setNotice(`${kind === 'publications' ? 'Publication' : 'Competition'} saved.`); closeEditor(); await load() }
    setBusy(false)
  }

  async function remove(item: Publication | Competition) {
    if (!window.confirm(`Delete ${kind === 'publications' ? 'publication' : 'competition'} “${'title' in item ? item.title : item.name}”?`)) return
    setBusy(true)
    const result = kind === 'publications' ? await supabase.from('publications').delete().eq('id', item.id) : await supabase.from('competitions').delete().eq('id', item.id)
    if (result.error) setError(result.error.message)
    else await load()
    setBusy(false)
  }

  return <section className="editorial-admin" data-testid="admin-editorial-content-section"><div className="role-page-title"><p className="kicker">Editorial CMS</p><h2>Publications and Competitions</h2><p>Manage approved content, publication state, ordering, and links for the public catalogue.</p></div><div className="editorial-admin__toolbar"><div role="tablist" aria-label="Editorial content type"><button className={kind === 'publications' ? 'active' : ''} type="button" onClick={() => setKind('publications')}>Publications</button><button className={kind === 'competitions' ? 'active' : ''} type="button" onClick={() => setKind('competitions')}>Competitions</button></div><button className="button button-primary" type="button" onClick={beginCreate}><Plus aria-hidden="true" size={16} /> Add {kind === 'publications' ? 'publication' : 'competition'}</button></div>{notice ? <p className="admin-notice">{notice}</p> : null}{error ? <p className="form-error">{error}</p> : null}{loading ? <p>Loading editorial content…</p> : <div className="editorial-admin__list">{rows.length ? rows.map(item => <article key={item.id}><div><span className={item.is_published ? 'status-pill status-pill--success' : 'status-pill'}>{item.is_published ? 'Published' : 'Draft'}</span><h3>{'title' in item ? item.title : item.name}</h3><p>{'excerpt' in item ? item.excerpt : item.description}</p></div><div className="editorial-admin__actions"><button className="button button-outline button-compact" type="button" onClick={() => beginEdit(item)}><Pencil aria-hidden="true" size={14} /> Edit</button><button className="button button-danger button-compact" type="button" onClick={() => void remove(item)} disabled={busy}><Trash2 aria-hidden="true" size={14} /> Delete</button></div></article>) : <div className="editorial-empty"><strong>No {kind} yet.</strong><span>Add approved content when the source material is ready.</span></div>}</div>}<dialog ref={dialogRef} className="editorial-admin__dialog" data-testid="editorial-content-dialog"><form onSubmit={save}><button className="dialog-close" type="button" onClick={closeEditor} aria-label="Close editor"><X aria-hidden="true" /></button><p className="kicker">{editingId === 'new' ? 'New' : 'Edit'} {kind === 'publications' ? 'publication' : 'competition'}</p><h3>{draft.title || 'Editorial content'}</h3><label>Title / name<input required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label><label>Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })} /></label><label>{kind === 'publications' ? 'Excerpt' : 'Description'}<textarea required rows={4} value={draft.excerpt} onChange={event => setDraft({ ...draft, excerpt: event.target.value })} /></label>{kind === 'publications' ? <><label>Body<textarea required rows={10} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} /></label><label>Published date<input type="date" value={draft.publishedAt} onChange={event => setDraft({ ...draft, publishedAt: event.target.value })} /></label></> : <><label>Registration URL<input type="url" value={draft.registrationUrl} onChange={event => setDraft({ ...draft, registrationUrl: event.target.value })} /></label><label>Rules URL<input type="url" value={draft.rulesUrl} onChange={event => setDraft({ ...draft, rulesUrl: event.target.value })} /></label><label>Registration deadline<input type="date" value={draft.registrationDeadline} onChange={event => setDraft({ ...draft, registrationDeadline: event.target.value })} /></label><label>Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Competition['status'] })}><option value="upcoming">Upcoming</option><option value="open">Open</option><option value="closed">Closed</option><option value="archived">Archived</option></select></label></>}<label>Cover path<input value={draft.coverPath} onChange={event => setDraft({ ...draft, coverPath: event.target.value })} placeholder="publications/example.webp" /></label><label>Sort order<input type="number" min="0" value={draft.sortOrder} onChange={event => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label><label className="checkbox-label"><input type="checkbox" checked={draft.isFeatured} onChange={event => setDraft({ ...draft, isFeatured: event.target.checked })} /> Featured</label><label className="checkbox-label"><input type="checkbox" checked={draft.isPublished} onChange={event => setDraft({ ...draft, isPublished: event.target.checked })} /> Published</label><button className="button button-primary" type="submit" disabled={busy}><Save aria-hidden="true" size={16} /> {busy ? 'Saving…' : 'Save content'}</button></form></dialog></section>
}
