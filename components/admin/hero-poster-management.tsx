'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowDown, ArrowUp, ArrowUpRight, CircleAlert, Eye, ImagePlus, Images, Pencil, RefreshCw, Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { adminFormError as formError } from '@/lib/auth/errors'
import {
  buildHeroPosterPayload,
  getHeroPosterSummary,
  getNextHeroPosterSortOrder,
  isHeroPosterSetupRequired,
  moveHeroPosterIdToPosition,
  reorderHeroPosterIds,
  safeHeroPosterFileName,
  validateHeroPosterDraft,
  type HeroPosterDraftErrors,
} from '@/lib/marketing/hero-poster-admin'
import { HERO_POSTER_BUCKET } from '@/lib/marketing/hero-poster-config'
import { createClient } from '@/lib/supabase/client'
import type { MarketingHeroPoster } from '@/lib/supabase/database.types'

const migrationName = '202609120001_marketing_hero_posters.sql'

export function HeroPosterManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [posters, setPosters] = useState<MarketingHeroPoster[]>([])
  const [editing, setEditing] = useState<MarketingHeroPoster | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<HeroPosterDraftErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const hasLoaded = useRef(false)
  const loadSequence = useRef(0)
  const busy = busyAction !== null
  const summary = useMemo(() => getHeroPosterSummary(posters), [posters])

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)
    try {
      const { data, error: loadError } = await supabase
        .from('marketing_hero_posters')
        .select('*')
        .order('sort_order')
        .order('created_at')

      if (sequence !== loadSequence.current) return
      if (loadError) {
        if (!hasLoaded.current && isHeroPosterSetupRequired(loadError)) {
          setSetupRequired(true)
        } else {
          setLoadFailed(!hasLoaded.current)
          setError(formError(loadError, 'Hero posters could not be loaded. Check your connection and try again.'))
        }
      } else {
        hasLoaded.current = true
        setPosters(data ?? [])
      }
    } catch (caught) {
      if (sequence !== loadSequence.current) return
      setLoadFailed(!hasLoaded.current)
      setError(formError(caught, 'Hero posters could not be loaded. Check your connection and try again.'))
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [supabase])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!dirty) return
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [dirty])

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(selectedFile)
    setLocalPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

  function resetEditor() {
    setEditing(null)
    setSelectedFile(null)
    setFieldErrors({})
    setDirty(false)
  }

  function cancelEditor() {
    if (busy || (dirty && !window.confirm('Discard unsaved poster changes?'))) return
    resetEditor()
    formRef.current?.reset()
  }

  function beginEditing(poster: MarketingHeroPoster) {
    if (busy || editing?.id === poster.id || (dirty && !window.confirm('Discard unsaved poster changes?'))) return
    setEditing(poster)
    setSelectedFile(null)
    setFieldErrors({})
    setError('')
    setNotice('')
    setDirty(false)
  }

  async function reorderEditedPoster(posterId: string, position: number) {
    const ids = moveHeroPosterIdToPosition(posters, posterId, position)
    if (ids.every((id, index) => id === posters[index]?.id)) return null
    const { error: reorderError } = await supabase.rpc('reorder_marketing_hero_posters', { p_ids: ids })
    return reorderError
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    const altText = String(values.get('alt_text'))
    const url = String(values.get('url'))
    const position = editing ? String(values.get('position')) : undefined
    const validation = validateHeroPosterDraft({
      altText,
      url,
      position,
      posterCount: editing ? posters.length : undefined,
      file: selectedFile,
      hasStoredImage: Boolean(editing?.image_path),
    })
    setFieldErrors(validation)
    setError('')
    setNotice('')
    if (Object.keys(validation).length > 0) return

    const wasEditing = Boolean(editing)
    const requestedPosition = editing && position !== undefined ? Number(position) : null
    setBusyAction('save')
    let uploadedPath: string | null = null

    try {
      if (selectedFile) {
        uploadedPath = `posters/${crypto.randomUUID()}-${safeHeroPosterFileName(selectedFile.name)}`
        const { error: uploadError } = await supabase.storage.from(HERO_POSTER_BUCKET).upload(uploadedPath, selectedFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
      }

      const payload = buildHeroPosterPayload({
        imagePath: uploadedPath,
        storedImagePath: editing?.image_path ?? null,
        altText,
        title: String(values.get('title')),
        url,
        isActive: values.get('is_active') === 'on',
      })
      const result = editing
        ? await supabase.from('marketing_hero_posters').update(payload).eq('id', editing.id)
        : await supabase.from('marketing_hero_posters').insert({ ...payload, sort_order: getNextHeroPosterSortOrder(posters) })
      if (result.error) throw result.error

      let cleanupWarning = ''
      let orderingWarning = ''
      if (editing && requestedPosition !== null) {
        const reorderError = await reorderEditedPoster(editing.id, requestedPosition)
        if (reorderError) orderingWarning = ' The content was saved, but its position could not be updated. Refresh and try again.'
      }
      if (editing && uploadedPath && editing.image_path !== uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from(HERO_POSTER_BUCKET).remove([editing.image_path])
        if (cleanupError) cleanupWarning = ' The old poster file still needs to be reviewed and removed from storage manually.'
      }

      resetEditor()
      form.reset()
      setNotice(`${wasEditing ? 'Poster updated.' : 'Poster added.'}${orderingWarning}${cleanupWarning}`)
      await load()
    } catch (caught) {
      let cleanupWarning = ''
      if (uploadedPath) {
        const { data: persisted, error: reconciliationError } = await supabase
          .from('marketing_hero_posters')
          .select('id,image_path')
          .eq('image_path', uploadedPath)
          .maybeSingle()

        if (persisted) {
          let orderingWarning = ''
          if (editing && requestedPosition !== null) {
            const reorderError = await reorderEditedPoster(editing.id, requestedPosition)
            if (reorderError) orderingWarning = ' The content was saved, but its position could not be updated. Refresh and try again.'
          }
          if (editing && editing.image_path !== uploadedPath) {
            const { error: cleanupError } = await supabase.storage.from(HERO_POSTER_BUCKET).remove([editing.image_path])
            if (cleanupError) cleanupWarning = ' The old poster file still needs to be reviewed and removed from storage manually.'
          }
          resetEditor()
          form.reset()
          setNotice(`${wasEditing ? 'Poster updated.' : 'Poster added.'}${orderingWarning}${cleanupWarning}`)
          await load()
          return
        }

        if (reconciliationError) {
          cleanupWarning = ' The new file was kept because the database save could not be confirmed. Review the poster list and storage before trying again.'
        } else {
          const { error: cleanupError } = await supabase.storage.from(HERO_POSTER_BUCKET).remove([uploadedPath])
          if (cleanupError) cleanupWarning = ' The new file also needs to be reviewed in storage manually.'
        }
      }
      setError(`${formError(caught)}${cleanupWarning}`)
    } finally {
      setBusyAction(null)
    }
  }

  async function remove(poster: MarketingHeroPoster) {
    const name = poster.title ?? poster.alt_text
    if (busy || !window.confirm(`Delete poster “${name}”? The poster record and its stored image will be permanently removed.`)) return
    setBusyAction(`delete-${poster.id}`)
    setError('')
    setNotice('')
    try {
      const { error: rowError } = await supabase.from('marketing_hero_posters').delete().eq('id', poster.id)
      if (rowError) throw rowError

      let orderingWarning = ''
      const remainingIds = posters.filter(item => item.id !== poster.id).map(item => item.id)
      if (remainingIds.length) {
        const { error: reorderError } = await supabase.rpc('reorder_marketing_hero_posters', { p_ids: remainingIds })
        if (reorderError) orderingWarning = ' The remaining poster order could not be updated. Refresh and try again.'
      }

      const { error: storageError } = await supabase.storage.from(HERO_POSTER_BUCKET).remove([poster.image_path])
      if (storageError) setNotice(`The poster was removed from the list, but its stored file needs to be reviewed manually.${orderingWarning}`)
      else setNotice(`Poster deleted.${orderingWarning}`)
      if (editing?.id === poster.id) resetEditor()
      await load()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setBusyAction(null)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (busy) return
    const ids = reorderHeroPosterIds(posters, index, direction)
    if (ids.every((id, position) => id === posters[position]?.id)) return
    setBusyAction(`move-${posters[index].id}`)
    setError('')
    setNotice('')
    try {
      const { error: reorderError } = await supabase.rpc('reorder_marketing_hero_posters', { p_ids: ids })
      if (reorderError) throw reorderError
      setNotice('Poster order updated.')
      await load()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setBusyAction(null)
    }
  }

  async function toggleActive(poster: MarketingHeroPoster) {
    if (busy) return
    setBusyAction(`toggle-${poster.id}`)
    setError('')
    setNotice('')
    try {
      const { error: updateError } = await supabase.from('marketing_hero_posters').update({ is_active: !poster.is_active }).eq('id', poster.id)
      if (updateError) throw updateError
      setNotice(poster.is_active ? 'Poster deactivated.' : 'Poster activated.')
      await load()
    } catch (caught) {
      await load()
      setError(formError(caught))
    } finally {
      setBusyAction(null)
    }
  }

  const previewUrl = useCallback((path: string) => supabase.storage.from(HERO_POSTER_BUCKET).getPublicUrl(path).data.publicUrl, [supabase])
  const storedPreviewUrl = editing ? previewUrl(editing.image_path) : null
  const editorPreviewUrl = localPreviewUrl ?? storedPreviewUrl
  const editorPreviewSource = localPreviewUrl ? 'local' : storedPreviewUrl ? 'stored' : 'empty'
  const editingPosition = editing ? posters.findIndex(poster => poster.id === editing.id) + 1 : null

  return (
    <section className="hero-poster-admin" data-testid="hero-poster-admin-section" aria-busy={busy || loading}>
      <header className="hero-poster-admin__heading">
        <div className="role-page-title">
          <h1 data-testid="hero-poster-admin-title">Hero Posters</h1>
        </div>
        <Link className="button button-outline hero-poster-admin__home-link" href="/" target="_blank" rel="noreferrer">
          <Eye aria-hidden="true" size={16} /> View homepage <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </header>

      {loading ? <div className="role-card hero-poster-loading" role="status" data-testid="hero-poster-loading-status"><RefreshCw aria-hidden="true" /> Loading hero posters…</div> : null}

      {!loading && setupRequired ? (
        <section className="role-card hero-poster-setup" role="alert" data-testid="hero-poster-setup-required">
          <CircleAlert aria-hidden="true" />
          <div>
            <span className="hero-poster-status hero-poster-status--warning">Database setup required</span>
            <h2>Hero Posters is not configured.</h2>
            <p>Apply migration <code>{migrationName}</code> to the Supabase project used by this deployment to manage posters.</p>
          </div>
          <button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" size={15} /> Try again</button>
        </section>
      ) : null}

      {!loading && loadFailed ? (
        <section className="role-card hero-poster-load-error" role="alert" data-testid="hero-poster-error-message">
          <CircleAlert aria-hidden="true" />
          <div>
            <span className="hero-poster-status hero-poster-status--danger">Loading failed</span>
            <h2>Hero posters could not be loaded.</h2>
            <p>{error}</p>
          </div>
          <button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" size={15} /> Try again</button>
        </section>
      ) : null}

      {(!loading || hasLoaded.current) && !setupRequired && !loadFailed ? <>
        <section className={`role-card hero-poster-summary hero-poster-summary--${summary.tone}`} aria-labelledby="hero-poster-summary-heading">
          <div className="hero-poster-summary__lead">
            <span className={`hero-poster-status hero-poster-status--${summary.tone}`}>Carousel status</span>
            <h2 id="hero-poster-summary-heading">{summary.label}</h2>
            <p>{summary.message}</p>
          </div>
          <dl className="hero-poster-summary__counts">
            <div><dt>Total posters</dt><dd data-testid="hero-poster-total-count">{summary.total}</dd></div>
            <div><dt>Active</dt><dd data-testid="hero-poster-active-count">{summary.active}</dd></div>
            <div><dt>Inactive</dt><dd data-testid="hero-poster-inactive-count">{summary.inactive}</dd></div>
          </dl>
        </section>

        <div className="hero-poster-admin__layout">
          <form ref={formRef} className="role-card hero-poster-form" onSubmit={save} onChange={event => setDirty(Array.from(event.currentTarget.elements).some(element => element instanceof HTMLInputElement && (element.type === 'file' ? Boolean(element.files?.length) : element.type === 'checkbox' ? element.checked !== element.defaultChecked : element.value !== element.defaultValue)))} key={editing?.id ?? 'new'} noValidate data-testid="hero-poster-form" aria-busy={busyAction === 'save'}>
            <div className="role-card-heading">
              <div>
                <p className="kicker">{editing ? 'Edit poster' : 'New poster'}</p>
                <h2>{editing?.title ?? 'Add hero poster'}</h2>
                {editing
                  ? <p className="hero-poster-form__editing">Editing {editing.title ?? editing.alt_text}</p>
                  : <p className="hero-poster-form__editing">New posters are added at the end of the list.</p>}
              </div>
              <ImagePlus aria-hidden="true" size={24} />
            </div>

            <div className="hero-poster-form__field">
              <label htmlFor="hero-poster-image">Image <span>{editing ? 'Optional replacement' : 'Required'}</span></label>
              <input disabled={busy} id="hero-poster-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!editing} onChange={event => setSelectedFile(event.target.files?.[0] ?? null)} aria-invalid={Boolean(fieldErrors.file)} aria-describedby={`hero-poster-image-help${fieldErrors.file ? ' hero-poster-image-error' : ''}`} data-testid="hero-poster-file-input" />
              <small id="hero-poster-image-help">JPG, PNG, or WebP · maximum 5 MB.</small>
              {fieldErrors.file ? <p id="hero-poster-image-error" className="hero-poster-field-error">{fieldErrors.file}</p> : null}
            </div>

            <section className="hero-poster-preview" data-testid="hero-poster-preview" data-preview-source={editorPreviewSource} aria-label="Poster preview">
              <div className="hero-poster-preview__canvas">
                {editorPreviewUrl ? <Image src={editorPreviewUrl} alt={editing?.alt_text || 'New poster preview'} fill sizes="(max-width: 800px) 90vw, 420px" unoptimized={Boolean(localPreviewUrl)} /> : <div className="hero-poster-preview__empty"><Images aria-hidden="true" /><span>Choose an image to preview.</span></div>}
              </div>
              <p>The full poster image remains visible in the preview.</p>
            </section>

            <PosterField id="hero-poster-alt" label="Alternative text" requirement="Required" help="Describe the image for people using screen readers." error={fieldErrors.altText}>
              <input disabled={busy} id="hero-poster-alt" name="alt_text" required maxLength={240} defaultValue={editing?.alt_text ?? ''} aria-invalid={Boolean(fieldErrors.altText)} aria-describedby={`hero-poster-alt-help${fieldErrors.altText ? ' hero-poster-alt-error' : ''}`} data-testid="hero-poster-alt-input" />
            </PosterField>
            <PosterField id="hero-poster-title" label="Title" requirement="Optional" help="Used as the poster caption.">
              <input disabled={busy} id="hero-poster-title" name="title" maxLength={160} defaultValue={editing?.title ?? ''} data-testid="hero-poster-title-input" />
            </PosterField>
            <PosterField id="hero-poster-url" label="Internal link" requirement="Optional" help="Use an internal path such as /program. Links beginning with // are not allowed." error={fieldErrors.url}>
              <input disabled={busy} id="hero-poster-url" name="url" placeholder="/program" defaultValue={editing?.url ?? ''} aria-invalid={Boolean(fieldErrors.url)} aria-describedby={`hero-poster-url-help${fieldErrors.url ? ' hero-poster-url-error' : ''}`} data-testid="hero-poster-url-input" />
            </PosterField>
            {editing ? <PosterField id="hero-poster-position" label="Position" requirement="Required" help={`Choose a position from 1 to ${posters.length}. Other posters move automatically.`} error={fieldErrors.position}>
              <input disabled={busy} id="hero-poster-position" name="position" type="number" required min={1} max={posters.length} step={1} defaultValue={editingPosition ?? 1} aria-invalid={Boolean(fieldErrors.position)} aria-describedby={`hero-poster-position-help${fieldErrors.position ? ' hero-poster-position-error' : ''}`} data-testid="hero-poster-position-input" />
            </PosterField> : null}

            <label className="hero-poster-form__active"><input disabled={busy} name="is_active" type="checkbox" defaultChecked={editing?.is_active ?? true} data-testid="hero-poster-active-checkbox" /> <span><strong>Active</strong><small>Active posters are included in the carousel.</small></span></label>
            <div className="button-row hero-poster-form__actions">
              <button className="button button-primary" disabled={busy} data-testid="hero-poster-save-button">{busyAction === 'save' ? 'Saving…' : editing ? 'Save changes' : 'Add poster'}</button>
              {editing ? <button type="button" className="button button-outline" onClick={cancelEditor} disabled={busy} data-testid="hero-poster-cancel-button">Cancel</button> : null}
            </div>
          </form>

          <section className="role-card hero-poster-list" data-testid="hero-poster-list">
            <div className="role-card-heading">
              <div><p className="kicker">Carousel order</p><h2>{posters.length} {posters.length === 1 ? 'poster' : 'posters'}</h2><p>Change status and order from the list.</p></div>
              <button type="button" className="button button-outline" onClick={() => void load()} disabled={loading || busy} data-testid="hero-poster-refresh-button"><RefreshCw aria-hidden="true" size={15} /> Refresh</button>
            </div>
            {!posters.length ? <div className="empty-state hero-poster-empty" data-testid="hero-poster-empty-state"><Images aria-hidden="true" /><h3>No posters yet.</h3><p>Add a poster to start managing this collection.</p></div> : null}
            <div className="hero-poster-list__items">
              {posters.map((poster, index) => <PosterRow key={poster.id} poster={poster} index={index} count={posters.length} busy={busy} busyAction={busyAction} previewUrl={previewUrl} onToggle={toggleActive} onMove={move} onEdit={beginEditing} onDelete={remove} />)}
            </div>
          </section>
        </div>
      </> : null}

      {error && !loadFailed ? <p className="form-error hero-poster-feedback" role="alert" data-testid="hero-poster-error-message">{error}</p> : null}
      {notice ? <p className="form-success hero-poster-feedback" role="status" aria-live="polite" data-testid="hero-poster-success-message">{notice}</p> : null}
    </section>
  )
}

function PosterField({ id, label, requirement, help, error, children }: { id: string; label: string; requirement: string; help: string; error?: string; children: React.ReactNode }) {
  return <div className="hero-poster-form__field">
    <label htmlFor={id}>{label} <span>{requirement}</span></label>
    {children}
    <small id={`${id}-help`}>{help}</small>
    {error ? <p id={`${id}-error`} className="hero-poster-field-error">{error}</p> : null}
  </div>
}

function PosterRow({ poster, index, count, busy, busyAction, previewUrl, onToggle, onMove, onEdit, onDelete }: {
  poster: MarketingHeroPoster
  index: number
  count: number
  busy: boolean
  busyAction: string | null
  previewUrl: (path: string) => string
  onToggle: (poster: MarketingHeroPoster) => Promise<void>
  onMove: (index: number, direction: -1 | 1) => Promise<void>
  onEdit: (poster: MarketingHeroPoster) => void
  onDelete: (poster: MarketingHeroPoster) => Promise<void>
}) {
  const name = poster.title ?? poster.alt_text
  return <article className="hero-poster-row" data-testid={`hero-poster-row-${poster.id}`} aria-busy={busyAction?.endsWith(poster.id)}>
    <div className="hero-poster-row__image"><Image src={previewUrl(poster.image_path)} alt={poster.alt_text} fill sizes="(max-width: 520px) 100vw, 180px" /></div>
    <div className="hero-poster-row__copy">
      <div className="hero-poster-row__title"><strong>{poster.title ?? 'Untitled'}</strong><span className={`hero-poster-status hero-poster-status--${poster.is_active ? 'active' : 'inactive'}`}>{poster.is_active ? 'Active' : 'Inactive'}</span></div>
      <p>{poster.alt_text}</p>
      <dl><div><dt>Destination</dt><dd>{poster.url ?? 'No link'}</dd></div><div><dt>Position</dt><dd>{index + 1}</dd></div></dl>
    </div>
    <div className="hero-poster-row__actions">
      <button type="button" onClick={() => void onToggle(poster)} disabled={busy} role="switch" aria-checked={poster.is_active} aria-label={`${poster.is_active ? 'Deactivate' : 'Activate'} ${name}`} className="hero-poster-row__toggle">{busyAction === `toggle-${poster.id}` ? 'Saving…' : poster.is_active ? 'Active' : 'Inactive'}</button>
      <button type="button" onClick={() => void onMove(index, -1)} disabled={busy || index === 0} aria-label={`Move ${name} up`} data-testid={`hero-poster-${poster.id}-move-up-button`}><ArrowUp aria-hidden="true" size={15} /><span>Up</span></button>
      <button type="button" onClick={() => void onMove(index, 1)} disabled={busy || index === count - 1} aria-label={`Move ${name} down`} data-testid={`hero-poster-${poster.id}-move-down-button`}><ArrowDown aria-hidden="true" size={15} /><span>Down</span></button>
      <button type="button" onClick={() => onEdit(poster)} disabled={busy} aria-label={`Edit ${name}`} data-testid={`hero-poster-${poster.id}-edit-button`}><Pencil aria-hidden="true" size={15} /><span>Edit</span></button>
      <button type="button" onClick={() => void onDelete(poster)} disabled={busy} aria-label={`Delete ${name}`} data-testid={`hero-poster-${poster.id}-delete-button`} className="hero-poster-row__delete"><Trash2 aria-hidden="true" size={15} /><span>Delete</span></button>
    </div>
  </article>
}
