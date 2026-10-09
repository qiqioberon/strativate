'use client'

import Image from 'next/image'
import {
  ArrowDown,
  ArrowUp,
  Crop,
  ImagePlus,
  MessageSquareQuote,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { adminFormError as formError } from '@/lib/auth/errors'
import { DirectImageCropper } from '@/components/admin/direct-image-cropper'
import {
  buildTestimonialPayload,
  getNextTestimonialSortOrder,
  isTestimonialSetupRequired,
  normalizeTestimonialSlug,
  reorderTestimonialIds,
  validateTestimonialDraft,
  type TestimonialDraftErrors,
} from '@/lib/marketing/testimonial-admin'
import {
  TESTIMONIAL_IMAGE_BUCKET,
  TESTIMONIAL_IMAGE_HEIGHT,
  TESTIMONIAL_IMAGE_WIDTH,
} from '@/lib/marketing/testimonial-config'
import { PHOTO_SOURCE_BUCKET, cropRectFromJson, sourceExtension, type CropOutput, type NormalizedCropRect } from '@/lib/media/image-crop'
import { createClient } from '@/lib/supabase/client'
import type { Json, MarketingTestimonial } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './testimonial-management.module.css'

const migrationName = '202610040009_photo_crop_sources.sql'

type Draft = {
  slug: string
  competitionName: string
  achievement: string
  testimonial: string
  isPublished: boolean
}

const emptyDraft: Draft = {
  slug: '',
  competitionName: '',
  achievement: '',
  testimonial: '',
  isPublished: true,
}

function draftFromItem(item: MarketingTestimonial): Draft {
  return {
    slug: item.slug,
    competitionName: item.competition_name,
    achievement: item.achievement,
    testimonial: item.testimonial,
    isPublished: item.is_published,
  }
}

export function TestimonialManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const [items, setItems] = useState<MarketingTestimonial[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processedFile, setProcessedFile] = useState<File | null>(null)
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null)
  const [cropUsesStoredSource, setCropUsesStoredSource] = useState(false)
  const [crop, setCrop] = useState<NormalizedCropRect | null>(null)
  const [cropInitial, setCropInitial] = useState<NormalizedCropRect | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MarketingTestimonial | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<TestimonialDraftErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selected = useMemo(() => items.find(item => item.id === selectedId) ?? null, [items, selectedId])
  const busy = busyAction !== null
  const editorOpen = creating || Boolean(selected)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setLoadFailed(false)
    setSetupRequired(false)
    const { data, error: loadError } = await supabase.rpc('admin_list_marketing_testimonials')

    if (loadError) {
      setItems([])
      if (isTestimonialSetupRequired(loadError)) setSetupRequired(true)
      else {
        setLoadFailed(true)
        setError(formError(loadError, 'Unable to load testimonials. Check your connection and try again.'))
      }
    } else {
      setItems(data ?? [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!processedFile) {
      setLocalPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(processedFile)
    setLocalPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [processedFile])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editorOpen && !dialog.open) dialog.showModal()
    if (!editorOpen && dialog.open) dialog.close()
  }, [editorOpen])

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!dialog) return
    if (deleteTarget && !dialog.open) dialog.showModal()
    if (!deleteTarget && dialog.open) dialog.close()
  }, [deleteTarget])

  const publicImageUrl = useCallback((path: string) => (
    supabase.storage.from(TESTIMONIAL_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  ), [supabase])

  function resetEditor() {
    setCreating(false)
    setSelectedId(null)
    setDraft(emptyDraft)
    setSlugManuallyEdited(false)
    setSelectedFile(null)
    setProcessedFile(null)
    setCropSourceFile(null)
    setCropUsesStoredSource(false)
    setCrop(null)
    setCropInitial(null)
    setFieldErrors({})
  }

  function beginCreate() {
    setCreating(true)
    setSelectedId(null)
    setDraft(emptyDraft)
    setSlugManuallyEdited(false)
    setSelectedFile(null)
    setProcessedFile(null)
    setCropSourceFile(null)
    setCropUsesStoredSource(false)
    setCrop(null)
    setCropInitial(null)
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  function beginEdit(item: MarketingTestimonial) {
    setCreating(false)
    setSelectedId(item.id)
    setDraft(draftFromItem(item))
    setSlugManuallyEdited(true)
    setSelectedFile(null)
    setProcessedFile(null)
    setCropSourceFile(null)
    setCropUsesStoredSource(false)
    setCrop(cropRectFromJson(item.image_crop))
    setCropInitial(null)
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  function updateCompetitionName(value: string) {
    setDraft(current => ({
      ...current,
      competitionName: value,
      slug: slugManuallyEdited ? current.slug : normalizeTestimonialSlug(value),
    }))
    setFieldErrors(current => ({ ...current, competitionName: undefined, slug: undefined }))
  }

  function chooseImage(file: File | null) {
    if (!file) return
    const validation = validateTestimonialDraft({
      slug: draft.slug || 'temporary-slug',
      competitionName: draft.competitionName || 'Temporary',
      achievement: draft.achievement || 'Temporary',
      testimonial: draft.testimonial || 'Temporary',
      file,
    })
    if (validation.file) {
      setFieldErrors(current => ({ ...current, file: validation.file }))
      return
    }
    setCropUsesStoredSource(false)
    setCropInitial(null)
    setCropSourceFile(file)
    setFieldErrors(current => ({ ...current, file: undefined }))
  }

  function applyImageCrop(result: CropOutput) {
    if (!cropUsesStoredSource) setSelectedFile(cropSourceFile)
    setProcessedFile(result.file)
    setCrop(result.crop)
    setCropInitial(null)
    setCropSourceFile(null)
    setCropUsesStoredSource(false)
  }

  async function adjustStoredCrop() {
    if (!selected?.image_source_path) return
    setBusyAction('source')
    setError('')
    try {
      const { data, error: downloadError } = await supabase.storage.from(PHOTO_SOURCE_BUCKET).download(selected.image_source_path)
      if (downloadError || !data) throw downloadError ?? new Error('Original source is unavailable.')
      setCropUsesStoredSource(true)
      setCropInitial(cropRectFromJson(selected.image_crop))
      setCropSourceFile(new File([data], `testimonial-source.${data.type === 'image/png' ? 'png' : data.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: data.type || 'image/jpeg' }))
    } catch (caught) {
      setError(formError(caught, 'Original source could not be loaded.'))
    } finally {
      setBusyAction(null)
    }
  }

  function requestCloseEditor() {
    if (busy) return
    const dirty = JSON.stringify(draft) !== JSON.stringify(selected ? draftFromItem(selected) : emptyDraft) || Boolean(selectedFile || processedFile || cropSourceFile)
    if (dirty && !window.confirm('Discard unsaved changes? Your edits and selected images will be lost.')) return
    resetEditor()
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const validation = validateTestimonialDraft({
      slug: draft.slug,
      competitionName: draft.competitionName,
      achievement: draft.achievement,
      testimonial: draft.testimonial,
      file: selectedFile,
    })
    setFieldErrors(validation)
    setError('')
    setNotice('')
    if (Object.keys(validation).length > 0) return
    if (selectedFile && (!processedFile || !crop)) {
      setFieldErrors(current => ({ ...current, file: 'Apply the crop before saving.' }))
      return
    }

    setBusyAction('save')
    let uploadedPath: string | null = null
    let uploadedSourcePath: string | null = null

    try {
      let nextSourcePath = selected?.image_source_path ?? null
      if (selectedFile) {
        uploadedSourcePath = `testimonials/${crypto.randomUUID()}.${sourceExtension(selectedFile)}`
        const { error: sourceUploadError } = await supabase.storage
          .from(PHOTO_SOURCE_BUCKET)
          .upload(uploadedSourcePath, selectedFile, { cacheControl: '3600', contentType: selectedFile.type, upsert: false })
        if (sourceUploadError) throw sourceUploadError
        nextSourcePath = uploadedSourcePath
      }
      if (processedFile) {
        uploadedPath = `testimonials/${crypto.randomUUID()}-${draft.slug || 'testimonial'}.webp`
        const { error: uploadError } = await supabase.storage
          .from(TESTIMONIAL_IMAGE_BUCKET)
          .upload(uploadedPath, processedFile, {
            cacheControl: '3600',
            contentType: 'image/webp',
            upsert: false,
          })
        if (uploadError) throw uploadError
      }

      const payload = buildTestimonialPayload({
        slug: draft.slug,
        competitionName: draft.competitionName,
        achievement: draft.achievement,
        testimonial: draft.testimonial,
        imagePath: uploadedPath,
        storedImagePath: selected?.image_path ?? null,
        isPublished: draft.isPublished,
      })
      const imagePayload = {
        ...payload,
        image_source_path: payload.image_path ? nextSourcePath : null,
        image_crop: payload.image_path ? crop as unknown as Json : null,
      }

      const result = selected
        ? await supabase.from('marketing_testimonials').update(imagePayload).eq('id', selected.id)
        : await supabase.from('marketing_testimonials').insert({
          ...imagePayload,
          sort_order: getNextTestimonialSortOrder(items),
        })
      if (result.error) throw result.error

      let cleanupWarning = ''
      if (selected?.image_path && uploadedPath && selected.image_path !== uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from(TESTIMONIAL_IMAGE_BUCKET)
          .remove([selected.image_path])
        if (cleanupError) cleanupWarning = ' The old image requires manual storage cleanup.'
      }
      if (selected?.image_source_path && uploadedSourcePath && selected.image_source_path !== uploadedSourcePath) {
        const { error: cleanupError } = await supabase.storage.from(PHOTO_SOURCE_BUCKET).remove([selected.image_source_path])
        if (cleanupError) cleanupWarning += ' The old original source requires manual storage cleanup.'
      }

      const wasEditing = Boolean(selected)
      resetEditor()
      setNotice(`${wasEditing ? 'Testimonial updated.' : 'Testimonial added.'}${cleanupWarning}`)
      await load()
    } catch (caught) {
      let cleanupWarning = ''
      if (uploadedPath || uploadedSourcePath) {
        const { data: persistedRows, error: reconciliationError } = await supabase.rpc('admin_list_marketing_testimonials')
        if (reconciliationError) cleanupWarning = ' New files were retained because the database save status could not be confirmed.'
        else {
          if (uploadedPath && !persistedRows?.some(row => row.image_path === uploadedPath)) {
            await supabase.storage.from(TESTIMONIAL_IMAGE_BUCKET).remove([uploadedPath])
          }
          if (uploadedSourcePath && !persistedRows?.some(row => row.image_source_path === uploadedSourcePath)) {
            await supabase.storage.from(PHOTO_SOURCE_BUCKET).remove([uploadedSourcePath])
          }
        }
      }
      setError(`${formError(caught, 'Unable to save the testimonial.')}${cleanupWarning}`)
    } finally {
      setBusyAction(null)
    }
  }

  async function togglePublished(item: MarketingTestimonial) {
    if (busy) return
    setBusyAction(`publish-${item.id}`)
    setError('')
    setNotice('')
    try {
      const { error: updateError } = await supabase
        .from('marketing_testimonials')
        .update({ is_published: !item.is_published })
        .eq('id', item.id)
      if (updateError) throw updateError
      setNotice(item.is_published ? 'Testimonial moved to draft.' : 'Testimonial published.')
      await load()
    } catch (caught) {
      setError(formError(caught, 'Unable to update the testimonial status.'))
    } finally {
      setBusyAction(null)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (busy) return
    const ids = reorderTestimonialIds(items, index, direction)
    if (ids.every((id, position) => id === items[position]?.id)) return
    setBusyAction(`move-${items[index].id}`)
    setError('')
    setNotice('')
    try {
      const { error: reorderError } = await supabase.rpc('reorder_marketing_testimonials', { p_ids: ids })
      if (reorderError) throw reorderError
      setNotice('Testimonial order updated.')
      await load()
    } catch (caught) {
      setError(formError(caught, 'Unable to update the testimonial order.'))
    } finally {
      setBusyAction(null)
    }
  }

  async function remove(item: MarketingTestimonial) {
    if (busy) return
    setBusyAction(`delete-${item.id}`)
    setError('')
    setNotice('')
    try {
      const { error: rowError } = await supabase.from('marketing_testimonials').delete().eq('id', item.id)
      if (rowError) throw rowError

      let warning = ''
      if (item.image_path) {
        const { error: storageError } = await supabase.storage
          .from(TESTIMONIAL_IMAGE_BUCKET)
          .remove([item.image_path])
        if (storageError) warning = ' The stored image requires manual cleanup.'
      }
      if (item.image_source_path) {
        const { error: storageError } = await supabase.storage.from(PHOTO_SOURCE_BUCKET).remove([item.image_source_path])
        if (storageError) warning += ' The stored original source requires manual cleanup.'
      }

      const remainingIds = items.filter(candidate => candidate.id !== item.id).map(candidate => candidate.id)
      if (remainingIds.length) {
        const { error: reorderError } = await supabase.rpc('reorder_marketing_testimonials', { p_ids: remainingIds })
        if (reorderError) warning += ' Review the display order of the remaining items.'
      }

      if (selectedId === item.id) resetEditor()
      setDeleteTarget(null)
      setNotice(`Testimonial deleted.${warning}`)
      await load()
    } catch (caught) {
      setError(formError(caught, 'Unable to delete the testimonial.'))
    } finally {
      setBusyAction(null)
    }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('id-ID')
    if (!term) return items
    return items.filter(item => (
      `${item.competition_name} ${item.achievement} ${item.testimonial}`
        .toLocaleLowerCase('id-ID')
        .includes(term)
    ))
  }, [items, query])

  const storedPreviewUrl = selected?.image_path ? publicImageUrl(selected.image_path) : null
  const editorPreviewUrl = localPreviewUrl ?? storedPreviewUrl

  const pageHeader = (
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>

        <h2>Testimonials</h2>

      </div>
      <span className={dataStyles.countPill}><MessageSquareQuote aria-hidden="true" />{items.length} stories</span>
    </header>
  )

  if (loading) {
    return <section className={dataStyles.page} data-testid="testimonial-management" aria-busy="true">{pageHeader}<div className={styles.stateCard}><RefreshCw aria-hidden="true" /> Loading testimonials…</div></section>
  }

  if (setupRequired) {
    return <section className={dataStyles.page} data-testid="testimonial-management">{pageHeader}<div className={styles.stateCard} role="alert"><strong>Database setup required.</strong><p>Apply migration <code>{migrationName}</code>, then seed <code>supabase/seed/marketing_testimonials.sql</code>.</p><button type="button" className="button button-outline" onClick={() => void load()}>Try again</button></div></section>
  }

  if (loadFailed) {
    return <section className={dataStyles.page} data-testid="testimonial-management">{pageHeader}<div className={styles.stateCard} role="alert"><strong>Unable to load testimonials.</strong><p>{error}</p><button type="button" className="button button-outline" onClick={() => void load()}>Try again</button></div></section>
  }

  return (
    <section className={dataStyles.page} data-testid="testimonial-management" aria-busy={busy}>
      {pageHeader}
      {error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
      {notice ? <p className={`${dataStyles.feedback} ${dataStyles.successFeedback}`} role="status">{notice}</p> : null}

      <div className={dataStyles.surface}>
        <div className={dataStyles.surfaceHeader}>
          <div className={dataStyles.surfaceHeaderCopy}>
            <p className="kicker">Participant stories</p>
            <h3>{items.length} testimonials</h3>
            <p>Only published testimonials with an image appear on the homepage.</p>
          </div>
          <button type="button" className="button button-primary" onClick={beginCreate} disabled={busy}>
            <Plus aria-hidden="true" /> Add testimonial
          </button>
        </div>

        <div className={dataStyles.toolbar}>
          <label className={dataStyles.searchField}>
            Search testimonials
            <span className={dataStyles.searchControl}>
              <Search aria-hidden="true" />
              <input value={query} type="search" onChange={event => setQuery(event.target.value)} placeholder="Competition, achievement, or testimonial text" />
            </span>
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className={dataStyles.empty}>No testimonials match your search.</div>
        ) : (
          <div className={styles.list}>
            {filtered.map(item => {
              const sourceIndex = items.findIndex(candidate => candidate.id === item.id)
              const hasImage = Boolean(item.image_path)
              return (
                <article className={styles.row} key={item.id} data-testid="testimonial-admin-row">
                  <div className={styles.thumbnail}>
                    {item.image_path
                      ? <Image src={publicImageUrl(item.image_path)} alt="" fill sizes="90px" unoptimized />
                      : <ImagePlus aria-hidden="true" />}
                  </div>
                  <div className={styles.rowCopy}>
                    <div className={styles.rowTitle}>
                      <strong>{item.competition_name}</strong>
                      <span className={`${dataStyles.badge} ${item.is_published && hasImage ? dataStyles.successBadge : dataStyles.warningBadge}`}>
                        {item.is_published ? hasImage ? 'Published' : 'Awaiting image' : 'Draft'}
                      </span>
                    </div>
                    <span className={styles.achievement}>{item.achievement}</span>
                    <p>{item.testimonial}</p>
                  </div>
                  <div className={styles.rowActions}>
                    <button type="button" onClick={() => void move(sourceIndex, -1)} disabled={busy || sourceIndex === 0} aria-label={`Move ${item.competition_name} up`}><ArrowUp aria-hidden="true" size={15} /></button>
                    <button type="button" onClick={() => void move(sourceIndex, 1)} disabled={busy || sourceIndex === items.length - 1} aria-label={`Move ${item.competition_name} down`}><ArrowDown aria-hidden="true" size={15} /></button>
                    <button type="button" onClick={() => void togglePublished(item)} disabled={busy}>{item.is_published ? 'Draft' : 'Publish'}</button>
                    <button type="button" onClick={() => beginEdit(item)} disabled={busy}>Manage</button>
                    <button type="button" className={styles.deleteButton} onClick={() => setDeleteTarget(item)} disabled={busy} aria-label={`Delete ${item.competition_name}`}><Trash2 aria-hidden="true" size={15} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className={dialogStyles.dialog}
        aria-labelledby="testimonial-editor-heading"
        onCancel={event => {
          event.preventDefault()
          requestCloseEditor()
        }}
        onClose={() => {
          if (!busy && editorOpen) resetEditor()
        }}
        onClick={event => {
          if (event.target === event.currentTarget) requestCloseEditor()
        }}
      >
        <div className={dialogStyles.panel}>
          <header className={dialogStyles.header}>
            <div>

              <h2 id="testimonial-editor-heading">{creating ? 'Add testimonial' : selected?.competition_name}</h2>
            </div>
            <button type="button" className={`role-close ${dialogStyles.closeButton}`} onClick={requestCloseEditor} disabled={busy} aria-label="Close editor"><X aria-hidden="true" /></button>
          </header>
          <div className={dialogStyles.body}>
            <form className={styles.form} onSubmit={save} noValidate><fieldset className={dataStyles.editableFields} disabled={busy}>
              <div className={styles.formGrid}>
                <label>Competition name<input value={draft.competitionName} maxLength={180} onChange={event => updateCompetitionName(event.target.value)} aria-invalid={Boolean(fieldErrors.competitionName)} />{fieldErrors.competitionName ? <small className="form-error">{fieldErrors.competitionName}</small> : null}</label>
                <label>Achievement<input value={draft.achievement} maxLength={160} onChange={event => { setDraft(current => ({ ...current, achievement: event.target.value })); setFieldErrors(current => ({ ...current, achievement: undefined })) }} aria-invalid={Boolean(fieldErrors.achievement)} />{fieldErrors.achievement ? <small className="form-error">{fieldErrors.achievement}</small> : null}</label>
                <label className={styles.wideField}>Testimonial<textarea rows={8} maxLength={5000} value={draft.testimonial} onChange={event => { setDraft(current => ({ ...current, testimonial: event.target.value })); setFieldErrors(current => ({ ...current, testimonial: undefined })) }} aria-invalid={Boolean(fieldErrors.testimonial)} />{fieldErrors.testimonial ? <small className="form-error">{fieldErrors.testimonial}</small> : null}</label>
              </div>

              <section className={styles.mediaSection}>
                <div>
                  <label>Testimonial image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { chooseImage(event.target.files?.[0] ?? null); event.target.value = '' }} /></label>
                  <small>{selected?.image_path ? 'Leave empty to keep the current image. ' : ''}JPG, PNG, or WebP · maximum 5 MB. New files are saved in a 5:4 frame.</small>
                  {fieldErrors.file ? <small className="form-error">{fieldErrors.file}</small> : null}
                  <div className={styles.cropControls} data-testid="testimonial-crop-controls">
                    <div className={styles.cropMeta}><span>Direct crop</span><strong>{TESTIMONIAL_IMAGE_WIDTH} × {TESTIMONIAL_IMAGE_HEIGHT} px · 5:4</strong></div>
                    {selectedFile ? <button type="button" className="button button-outline button-compact" onClick={() => { setCropUsesStoredSource(false); setCropInitial(crop); setCropSourceFile(selectedFile) }}><Crop aria-hidden="true" /> Adjust crop</button> : null}
                    {!selectedFile && selected?.image_source_path ? <button type="button" className="button button-outline button-compact" onClick={() => void adjustStoredCrop()} disabled={busy}><Crop aria-hidden="true" /> Adjust crop</button> : null}
                    {selected?.image_path && !selected.image_source_path ? <small>Original source is unavailable for this existing image. Replace the image once to enable future crop adjustments.</small> : null}
                  </div>
                </div>
                <div className={styles.preview}>
                  {editorPreviewUrl
                    ? <Image
                        src={editorPreviewUrl}
                        alt={draft.competitionName ? `Participants in ${draft.competitionName}` : 'Testimonial image preview'}
                        fill
                        sizes="280px"
                        unoptimized
                      />
                    : <div><ImagePlus aria-hidden="true" /><span>No image yet. Upload an approved competition photo here.</span></div>}
                </div>
              </section>

              <label className={styles.publishToggle}>
                <input type="checkbox" checked={draft.isPublished} onChange={event => setDraft(current => ({ ...current, isPublished: event.target.checked }))} />
                <span><strong>Published</strong><small>Only published testimonials with an image appear on the homepage.</small></span>
              </label>

              <div className={styles.formActions}>
                <button className="button button-primary" disabled={busy}>{busyAction === 'save' ? 'Saving…' : creating ? 'Create testimonial' : 'Save changes'}</button>
                <button type="button" className="button button-outline" onClick={requestCloseEditor} disabled={busy}>Cancel</button>
              </div>
            </fieldset></form>
          </div>
        </div>
      </dialog>
      <DirectImageCropper
        sourceFile={cropSourceFile}
        initialCrop={cropInitial}
        aspectRatio={5 / 4}
        outputWidth={TESTIMONIAL_IMAGE_WIDTH}
        outputHeight={TESTIMONIAL_IMAGE_HEIGHT}
        title="Adjust testimonial crop"
        description="Drag the 5:4 crop rectangle or its corner handles."
        onCancel={() => { setCropSourceFile(null); setCropInitial(null); setCropUsesStoredSource(false) }}
        onApply={applyImageCrop}
      />
      <dialog ref={deleteDialogRef} className="editorial-delete-dialog" aria-labelledby="testimonial-delete-title" onCancel={event => { event.preventDefault(); if (!busy) setDeleteTarget(null) }}>
        {deleteTarget ? <><div className="editorial-delete-dialog__icon"><Trash2 aria-hidden="true" /></div><h3 id="testimonial-delete-title">Delete “{deleteTarget.competition_name}”?</h3><p>The testimonial and its image files will be permanently deleted.</p><div><button type="button" className="button button-outline" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</button><button type="button" className="button button-danger" onClick={() => void remove(deleteTarget)} disabled={busy}><Trash2 aria-hidden="true" />{busy ? 'Deleting…' : 'Delete permanently'}</button></div></> : null}
      </dialog>
    </section>
  )
}
