'use client'

import { CircleAlert, Crop, ImageIcon, Images, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import { DirectImageCropper } from '@/components/admin/direct-image-cropper'
import {
  buildWhoWeArePhotoPayload,
  isWhoWeArePhotoSetupRequired,
  validateWhoWeArePhotoDraft,
  type WhoWeArePhotoDraftErrors,
} from '@/lib/marketing/who-we-are-photo-admin'
import {
  WHO_WE_ARE_PHOTO_BUCKET,
  WHO_WE_ARE_PHOTO_ROLES,
  WHO_WE_ARE_PHOTO_TARGETS,
  whoWeArePhotoPathPrefix,
  type WhoWeArePhotoRole,
} from '@/lib/marketing/who-we-are-photo-config'
import { PHOTO_SOURCE_BUCKET, cropRectFromJson, sourceExtension, type CropOutput, type NormalizedCropRect } from '@/lib/media/image-crop'
import { createClient } from '@/lib/supabase/client'
import type { HomepageWhoWeArePhoto, Json } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './who-we-are-photo-management.module.css'

const migrationName = '202610040009_photo_crop_sources.sql'

type Draft = { altText: string; badgeText: string; removeImage: boolean }
const emptyDraft: Draft = { altText: '', badgeText: '', removeImage: false }

export function WhoWeArePhotoManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [photos, setPhotos] = useState<HomepageWhoWeArePhoto[]>([])
  const [activeRole, setActiveRole] = useState<WhoWeArePhotoRole | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processedFile, setProcessedFile] = useState<File | null>(null)
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null)
  const [cropUsesStoredSource, setCropUsesStoredSource] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<NormalizedCropRect | null>(null)
  const [cropInitial, setCropInitial] = useState<NormalizedCropRect | null>(null)
  const [fieldErrors, setFieldErrors] = useState<WhoWeArePhotoDraftErrors>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selected = useMemo(
    () => photos.find(photo => photo.role === activeRole) ?? null,
    [activeRole, photos],
  )

  const publicUrl = useCallback((path: string) => (
    supabase.storage.from(WHO_WE_ARE_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
  ), [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)
    const { data, error: loadError } = await supabase.rpc('admin_list_homepage_who_we_are_photos')

    if (loadError) {
      setPhotos([])
      if (isWhoWeArePhotoSetupRequired(loadError)) setSetupRequired(true)
      else {
        setLoadFailed(true)
        setError(formError(loadError, 'Who We Are photos could not be loaded. Check the connection and try again.'))
      }
    } else setPhotos(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!processedFile) {
      setPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(processedFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [processedFile])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (activeRole && !dialog.open) dialog.showModal()
    if (!activeRole && dialog.open) dialog.close()
  }, [activeRole])

  function closeEditor() {
    setActiveRole(null)
    setDraft(emptyDraft)
    setSelectedFile(null)
    setProcessedFile(null)
    setCropSourceFile(null)
    setCropUsesStoredSource(false)
    setCrop(null)
    setCropInitial(null)
    setFieldErrors({})
  }

  function beginManage(role: WhoWeArePhotoRole) {
    const photo = photos.find(item => item.role === role)
    setDraft({
      altText: photo?.alt_text ?? '',
      badgeText: photo?.badge_text ?? '',
      removeImage: false,
    })
    setSelectedFile(null)
    setProcessedFile(null)
    setCropSourceFile(null)
    setCropUsesStoredSource(false)
    setCrop(cropRectFromJson(photo?.image_crop))
    setCropInitial(null)
    setFieldErrors({})
    setError('')
    setNotice('')
    setActiveRole(role)
  }


  function choosePhoto(file: File | null) {
    if (!file) return
    const validation = validateWhoWeArePhotoDraft({ altText: draft.altText || 'Temporary', file, hasStoredImage: true, removeImage: false })
    if (validation.file) {
      setFieldErrors(current => ({ ...current, file: validation.file }))
      return
    }
    setCropUsesStoredSource(false)
    setCropInitial(null)
    setCropSourceFile(file)
    setFieldErrors(current => ({ ...current, file: undefined }))
  }

  function applyPhotoCrop(result: CropOutput) {
    if (!cropUsesStoredSource) setSelectedFile(cropSourceFile)
    setProcessedFile(result.file)
    setCrop(result.crop)
    setCropInitial(null)
    setCropSourceFile(null)
    setCropUsesStoredSource(false)
    setDraft(current => ({ ...current, removeImage: false }))
  }

  async function adjustStoredCrop() {
    if (!selected?.source_image_path) return
    setBusy(true)
    setError('')
    try {
      const { data, error: downloadError } = await supabase.storage.from(PHOTO_SOURCE_BUCKET).download(selected.source_image_path)
      if (downloadError || !data) throw downloadError ?? new Error('Original source is unavailable.')
      setCropUsesStoredSource(true)
      setCropInitial(cropRectFromJson(selected.image_crop))
      setCropSourceFile(new File([data], 'who-we-are-source', { type: data.type || 'image/jpeg' }))
    } catch (caught) {
      setError(formError(caught, 'Original source could not be loaded.'))
    } finally {
      setBusy(false)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !activeRole) return

    const storedPath = selected?.image_path ?? null
    const validation = validateWhoWeArePhotoDraft({
      altText: draft.altText,
      file: selectedFile,
      hasStoredImage: Boolean(storedPath),
      removeImage: draft.removeImage,
    })
    setFieldErrors(validation)
    setError('')
    setNotice('')
    if (Object.keys(validation).length) return

    if (selectedFile && (!processedFile || !crop)) {
      setFieldErrors(current => ({ ...current, file: 'Apply the crop before saving.' }))
      return
    }

    let uploadedPath: string | null = null
    let uploadedSourcePath: string | null = null
    setBusy(true)
    try {
      let nextSourcePath = selected?.source_image_path ?? null
      if (selectedFile) {
        uploadedSourcePath = `who-we-are/${activeRole}/${crypto.randomUUID()}.${sourceExtension(selectedFile)}`
        const { error: sourceUploadError } = await supabase.storage.from(PHOTO_SOURCE_BUCKET).upload(uploadedSourcePath, selectedFile, {
          cacheControl: '3600',
          contentType: selectedFile.type,
          upsert: false,
        })
        if (sourceUploadError) throw sourceUploadError
        nextSourcePath = uploadedSourcePath
      }
      if (processedFile) {
        uploadedPath = whoWeArePhotoPathPrefix(activeRole) + crypto.randomUUID() + '.webp'
        const { error: uploadError } = await supabase.storage
          .from(WHO_WE_ARE_PHOTO_BUCKET)
          .upload(uploadedPath, processedFile, {
            cacheControl: '3600',
            contentType: 'image/webp',
            upsert: false,
          })
        if (uploadError) throw uploadError
      }

      const payload = buildWhoWeArePhotoPayload({
        altText: draft.altText,
        badgeText: draft.badgeText,
        uploadedPath,
        storedImagePath: storedPath,
        removeImage: draft.removeImage,
      })
      const imagePayload = {
        ...payload,
        source_image_path: payload.image_path ? nextSourcePath : null,
        image_crop: payload.image_path ? crop as unknown as Json : null,
      }
      const persistResult = selected
        ? await supabase
            .from('homepage_who_we_are_photos')
            .update(imagePayload)
            .eq('role', activeRole)
        : await supabase
            .from('homepage_who_we_are_photos')
            .insert({ role: activeRole, ...imagePayload })
      if (persistResult.error) throw persistResult.error

      let warning = ''
      if (storedPath && storedPath !== imagePayload.image_path) {
        const { error: cleanupError } = await supabase.storage.from(WHO_WE_ARE_PHOTO_BUCKET).remove([storedPath])
        if (cleanupError) warning = ' The old derivative still needs manual Storage cleanup.'
      }
      if (selected?.source_image_path && selected.source_image_path !== imagePayload.source_image_path) {
        const { error: cleanupError } = await supabase.storage.from(PHOTO_SOURCE_BUCKET).remove([selected.source_image_path])
        if (cleanupError) warning += ' The old original still needs manual Storage cleanup.'
      }
      closeEditor()
      setNotice('Who We Are photo slot updated.' + warning)
      await load()
    } catch (caught) {
      let cleanupWarning = ''
      const { data: persistedRows, error: reconciliationError } = await supabase.rpc('admin_list_homepage_who_we_are_photos')
      const persisted = persistedRows?.find(row => row.role === activeRole) ?? null
      if (reconciliationError) {
        cleanupWarning = ' New files were preserved because database status could not be confirmed. Review Storage before retrying.'
      } else {
        if (uploadedPath && persisted?.image_path !== uploadedPath) {
          const { error: cleanupError } = await supabase.storage.from(WHO_WE_ARE_PHOTO_BUCKET).remove([uploadedPath])
          if (cleanupError) cleanupWarning = ' The new derivative also needs manual Storage cleanup.'
        }
        if (uploadedSourcePath && persisted?.source_image_path !== uploadedSourcePath) {
          const { error: cleanupError } = await supabase.storage.from(PHOTO_SOURCE_BUCKET).remove([uploadedSourcePath])
          if (cleanupError) cleanupWarning += ' The new original also needs manual Storage cleanup.'
        }
      }
      setError(formError(caught, 'Who We Are photo could not be saved.') + cleanupWarning)
    } finally {
      setBusy(false)
    }
  }

  const pageHeader = (
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>
        <p className="kicker">Content · Homepage</p>
        <h2>Who We Are Photos</h2>
        <p>Manage the three fixed editorial photo roles. Homepage copy remains source-controlled.</p>
      </div>
      <span className={dataStyles.countPill}><Images aria-hidden="true" />3 fixed slots</span>
    </header>
  )

  if (loading) return <section className={dataStyles.page} aria-busy="true">{pageHeader}<div className={styles.stateCard} role="status"><RefreshCw aria-hidden="true" /> Loading photo slots…</div></section>
  if (setupRequired) return <section className={dataStyles.page}>{pageHeader}<div className={styles.stateCard} role="alert"><CircleAlert aria-hidden="true" /><strong>Database setup required.</strong><p>Apply migration <code>{migrationName}</code> before managing these photos.</p><button type="button" className="button button-outline" onClick={() => void load()}>Try again</button></div></section>
  if (loadFailed) return <section className={dataStyles.page}>{pageHeader}<div className={styles.stateCard} role="alert"><CircleAlert aria-hidden="true" /><strong>Who We Are photos could not be loaded.</strong><p>{error}</p><button type="button" className="button button-outline" onClick={() => void load()}>Try again</button></div></section>

  return (
    <section className={dataStyles.page} data-testid="who-we-are-photo-admin-section" aria-busy={busy}>
      {pageHeader}
      {error ? <p className={dataStyles.feedback + ' ' + dataStyles.errorFeedback} role="alert">{error}</p> : null}
      {notice ? <p className={dataStyles.feedback + ' ' + dataStyles.successFeedback} role="status">{notice}</p> : null}
      <div className={dataStyles.surface}>
        <div className={dataStyles.surfaceHeader}>
          <div className={dataStyles.surfaceHeaderCopy}>
            <p className="kicker">Editorial collage</p>
            <h3>Fixed photo slots</h3>
            <p>Empty slots are omitted gracefully from the public homepage.</p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Thumbnail</th><th>Role</th><th>Badge</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {WHO_WE_ARE_PHOTO_ROLES.map(role => {
                const photo = photos.find(item => item.role === role)
                const target = WHO_WE_ARE_PHOTO_TARGETS[role]
                return (
                  <tr key={role} data-testid="who-we-are-photo-admin-row">
                    <td data-label="Thumbnail">
                      <span className={`${styles.thumbnail} ${styles[role]}`}>
                        {photo?.image_path ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={publicUrl(photo.image_path)} alt="" />
                          </>
                        ) : <ImageIcon aria-hidden="true" />}
                      </span>
                    </td>
                    <td data-label="Role"><strong className={styles.roleName}>{target.label}</strong><small className={styles.roleMeta}>{target.width} × {target.height} px</small></td>
                    <td data-label="Badge"><span className={photo?.badge_text ? styles.badge : styles.noBadge}>{photo?.badge_text || 'No badge'}</span></td>
                    <td data-label="Status"><span className={dataStyles.badge + ' ' + (photo?.image_path ? dataStyles.successBadge : dataStyles.mutedBadge)}>{photo?.image_path ? 'Ready' : 'Empty'}</span></td>
                    <td data-label="Actions"><button type="button" className={styles.manageButton} onClick={() => beginManage(role)} disabled={busy}>Manage</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className={dialogStyles.dialog}
        aria-labelledby="who-we-are-photo-editor-heading"
        data-testid="who-we-are-photo-editor-dialog"
        onCancel={event => { if (busy) event.preventDefault(); else closeEditor() }}
        onClose={() => { if (!busy && activeRole) closeEditor() }}
        onClick={event => { if (event.target === event.currentTarget && !busy) closeEditor() }}
      >
        <div className={dialogStyles.panel}>
          <header className={dialogStyles.header}>
            <div><p className="kicker">Manage fixed slot</p><h2 id="who-we-are-photo-editor-heading">{activeRole ? WHO_WE_ARE_PHOTO_TARGETS[activeRole].label : 'Photo slot'}</h2></div>
            <button type="button" className={'role-close ' + dialogStyles.closeButton} onClick={closeEditor} disabled={busy} aria-label="Close photo editor"><X aria-hidden="true" /></button>
          </header>
          <div className={dialogStyles.body}>
            <form className={styles.form} key={activeRole ?? 'idle'} onSubmit={save} noValidate>
              <div className={styles.fields}>
                <label>
                  Alt text
                  <input
                    type="text"
                    value={draft.altText}
                    maxLength={300}
                    disabled={draft.removeImage}
                    aria-invalid={Boolean(fieldErrors.altText)}
                    aria-describedby={fieldErrors.altText ? 'who-we-are-alt-error' : undefined}
                    onChange={event => { setDraft(current => ({ ...current, altText: event.target.value })); setFieldErrors(current => ({ ...current, altText: undefined })) }}
                  />
                  {fieldErrors.altText ? <small id="who-we-are-alt-error" className="form-error">{fieldErrors.altText}</small> : null}
                </label>
                <label>Badge text (optional)<input type="text" value={draft.badgeText} maxLength={120} disabled={draft.removeImage} onChange={event => setDraft(current => ({ ...current, badgeText: event.target.value }))} /></label>
                <label>
                  Photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={draft.removeImage}
                    aria-invalid={Boolean(fieldErrors.file)}
                    aria-describedby={fieldErrors.file ? 'who-we-are-file-help who-we-are-file-error' : 'who-we-are-file-help'}
                    onChange={event => { choosePhoto(event.target.files?.[0] ?? null); event.target.value = '' }}
                  />
                </label>
                <p id="who-we-are-file-help" className={styles.help}>{selected?.image_path ? 'Leave empty to keep the existing photo. ' : ''}JPG, PNG, or WebP · maximum 8 MB. Replacements are normalized to the role’s WebP frame.</p>
                {fieldErrors.file ? <small id="who-we-are-file-error" className="form-error">{fieldErrors.file}</small> : null}

                <div className={styles.cropControls}>
                  {selectedFile ? <button type="button" className="button button-outline button-compact" onClick={() => { setCropUsesStoredSource(false); setCropInitial(crop); setCropSourceFile(selectedFile) }}><Crop aria-hidden="true" /> Adjust crop</button> : null}
                  {!selectedFile && selected?.source_image_path ? <button type="button" className="button button-outline button-compact" onClick={() => void adjustStoredCrop()} disabled={busy}><Crop aria-hidden="true" /> Adjust crop</button> : null}
                  {selected?.image_path && !selected.source_image_path ? <small>Original source is unavailable for this existing image. Replace the image once to enable future crop adjustments.</small> : null}
                </div>

                {selected?.image_path ? <button type="button" className={styles.removeButton} aria-pressed={draft.removeImage} onClick={() => { const removing = !draft.removeImage; setDraft(current => ({ ...current, removeImage: removing })); setSelectedFile(null); setProcessedFile(null); setCrop(removing ? null : cropRectFromJson(selected.image_crop)); setFieldErrors({}) }}>{draft.removeImage ? 'Keep current photo' : 'Remove photo'}</button> : null}
              </div>

              <div className={styles.previewColumn}>
                <div className={`${styles.preview} ${activeRole ? styles[activeRole] : ''}`}>
                  {!draft.removeImage && (previewUrl || selected?.image_path) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl ?? publicUrl(selected!.image_path!)}
                      alt=""
                      draggable={false}
                    />
                  ) : <span><ImageIcon aria-hidden="true" />No photo selected</span>}
                </div>
                <p className={styles.help}>Preview uses the saved role aspect ratio. Crop controls appear only for a new replacement file.</p>
              </div>

              <div className={styles.formActions}>
                <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
                <button type="button" className="button button-outline" onClick={closeEditor} disabled={busy}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
      {activeRole ? <DirectImageCropper
        sourceFile={cropSourceFile}
        initialCrop={cropInitial}
        aspectRatio={WHO_WE_ARE_PHOTO_TARGETS[activeRole].width / WHO_WE_ARE_PHOTO_TARGETS[activeRole].height}
        outputWidth={WHO_WE_ARE_PHOTO_TARGETS[activeRole].width}
        outputHeight={WHO_WE_ARE_PHOTO_TARGETS[activeRole].height}
        title={`Adjust ${WHO_WE_ARE_PHOTO_TARGETS[activeRole].label.toLowerCase()} crop`}
        description="Drag the crop rectangle or its corner handles. The slot aspect ratio stays locked."
        onCancel={() => { setCropSourceFile(null); setCropInitial(null); setCropUsesStoredSource(false) }}
        onApply={applyPhotoCrop}
      /> : null}
    </section>
  )
}
