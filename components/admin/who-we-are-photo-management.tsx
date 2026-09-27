'use client'

import { CircleAlert, ImageIcon, Images, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import {
  buildWhoWeArePhotoPayload,
  isWhoWeArePhotoSetupRequired,
  validateWhoWeArePhotoDraft,
  type WhoWeArePhotoDraftErrors,
} from '@/lib/marketing/who-we-are-photo-admin'
import {
  WHO_WE_ARE_PHOTO_BUCKET,
  WHO_WE_ARE_PHOTO_MAX_ZOOM,
  WHO_WE_ARE_PHOTO_MIN_ZOOM,
  WHO_WE_ARE_PHOTO_ROLES,
  WHO_WE_ARE_PHOTO_TARGETS,
  whoWeArePhotoPathPrefix,
  type WhoWeArePhotoRole,
} from '@/lib/marketing/who-we-are-photo-config'
import {
  calculateWhoWeArePreviewPlacement,
  cropWhoWeArePhoto,
  DEFAULT_WHO_WE_ARE_CROP,
  normalizeWhoWeAreCrop,
  type WhoWeArePhotoCrop,
} from '@/lib/marketing/who-we-are-photo-image'
import { createClient } from '@/lib/supabase/client'
import type { HomepageWhoWeArePhoto } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './who-we-are-photo-management.module.css'

const migrationName = '202609280001_homepage_who_we_are_photos.sql'

type Draft = { altText: string; badgeText: string; removeImage: boolean }
const emptyDraft: Draft = { altText: '', badgeText: '', removeImage: false }

export function WhoWeArePhotoManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [photos, setPhotos] = useState<HomepageWhoWeArePhoto[]>([])
  const [activeRole, setActiveRole] = useState<WhoWeArePhotoRole | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sourceDimensions, setSourceDimensions] = useState<{ width: number; height: number } | null>(null)
  const [crop, setCrop] = useState<WhoWeArePhotoCrop>({ ...DEFAULT_WHO_WE_ARE_CROP })
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
    const { data, error: loadError } = await supabase
      .from('homepage_who_we_are_photos')
      .select('*')

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
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

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
    setSourceDimensions(null)
    setCrop({ ...DEFAULT_WHO_WE_ARE_CROP })
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
    setSourceDimensions(null)
    setCrop({ ...DEFAULT_WHO_WE_ARE_CROP })
    setFieldErrors({})
    setError('')
    setNotice('')
    setActiveRole(role)
  }

  function updateCrop(next: Partial<WhoWeArePhotoCrop>) {
    setCrop(current => normalizeWhoWeAreCrop({ ...current, ...next }))
  }

  const previewPlacement = useMemo(() => {
    if (!selectedFile || !sourceDimensions || !activeRole) return null
    return calculateWhoWeArePreviewPlacement(
      sourceDimensions.width,
      sourceDimensions.height,
      activeRole,
      crop,
    )
  }, [activeRole, crop, selectedFile, sourceDimensions])

  async function completePersistedSave(storedPath: string | null, nextPath: string | null) {
    let warning = ''
    if (storedPath && storedPath !== nextPath) {
      const { error: cleanupError } = await supabase.storage
        .from(WHO_WE_ARE_PHOTO_BUCKET)
        .remove([storedPath])
      if (cleanupError) warning = ' The old photo still needs manual Storage cleanup.'
    }
    closeEditor()
    setNotice('Who We Are photo slot updated.' + warning)
    await load()
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

    let uploadedPath: string | null = null
    let intendedPayload: ReturnType<typeof buildWhoWeArePhotoPayload> | null = null
    let persistAttempted = false
    setBusy(true)
    try {
      if (selectedFile) {
        const normalizedPhoto = await cropWhoWeArePhoto(selectedFile, activeRole, crop)
        uploadedPath = whoWeArePhotoPathPrefix(activeRole) + crypto.randomUUID() + '.webp'
        const { error: uploadError } = await supabase.storage
          .from(WHO_WE_ARE_PHOTO_BUCKET)
          .upload(uploadedPath, normalizedPhoto, {
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
      intendedPayload = payload
      persistAttempted = true
      const { error: persistError } = await supabase
        .from('homepage_who_we_are_photos')
        .upsert({ role: activeRole, ...payload }, { onConflict: 'role' })
      if (persistError) throw persistError

      await completePersistedSave(storedPath, payload.image_path)
    } catch (caught) {
      let cleanupWarning = ''
      let databaseStatusUnknown = false
      if (persistAttempted && intendedPayload) {
        const { data: persisted, error: reconciliationError } = await supabase
          .from('homepage_who_we_are_photos')
          .select('image_path,alt_text,badge_text')
          .eq('role', activeRole)
          .maybeSingle()

        const persistedMatchesPayload = Boolean(persisted)
          && persisted?.image_path === intendedPayload.image_path
          && persisted.alt_text === intendedPayload.alt_text
          && persisted.badge_text === intendedPayload.badge_text
        if (persistedMatchesPayload) {
          await completePersistedSave(storedPath, intendedPayload.image_path)
          return
        }
        if (reconciliationError) {
          databaseStatusUnknown = true
          cleanupWarning = uploadedPath
            ? ' The new file was not removed because its database status could not be confirmed. Review the slot list and Storage before retrying.'
            : ' The database status could not be confirmed. Review the slot list before retrying.'
        }
      }
      if (uploadedPath && !databaseStatusUnknown) {
        const { error: cleanupError } = await supabase.storage
          .from(WHO_WE_ARE_PHOTO_BUCKET)
          .remove([uploadedPath])
        if (cleanupError) {
          cleanupWarning = ' The new file also needs manual Storage cleanup.'
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
                    onChange={event => { setSelectedFile(event.target.files?.[0] ?? null); setSourceDimensions(null); setCrop({ ...DEFAULT_WHO_WE_ARE_CROP }); setFieldErrors(current => ({ ...current, file: undefined })) }}
                  />
                </label>
                <p id="who-we-are-file-help" className={styles.help}>{selected?.image_path ? 'Leave empty to keep the existing photo. ' : ''}JPG, PNG, or WebP · maximum 8 MB. Replacements are normalized to the role’s WebP frame.</p>
                {fieldErrors.file ? <small id="who-we-are-file-error" className="form-error">{fieldErrors.file}</small> : null}

                {selectedFile ? (
                  <div className={styles.cropControls}>
                    <label>Horizontal position<input type="range" min="0" max="100" value={crop.x} onChange={event => updateCrop({ x: Number(event.target.value) })} /></label>
                    <label>Vertical position<input type="range" min="0" max="100" value={crop.y} onChange={event => updateCrop({ y: Number(event.target.value) })} /></label>
                    <label>Zoom<input type="range" min={WHO_WE_ARE_PHOTO_MIN_ZOOM} max={WHO_WE_ARE_PHOTO_MAX_ZOOM} step=".05" value={crop.zoom} onChange={event => updateCrop({ zoom: Number(event.target.value) })} /></label>
                    <button type="button" className="button button-outline" onClick={() => setCrop({ ...DEFAULT_WHO_WE_ARE_CROP })}>Reset crop</button>
                  </div>
                ) : null}

                {selected?.image_path ? <button type="button" className={styles.removeButton} aria-pressed={draft.removeImage} onClick={() => { setDraft(current => ({ ...current, removeImage: !current.removeImage })); setSelectedFile(null); setFieldErrors({}) }}>{draft.removeImage ? 'Keep current photo' : 'Remove photo'}</button> : null}
              </div>

              <div className={styles.previewColumn}>
                <div className={`${styles.preview} ${activeRole ? styles[activeRole] : ''}`}>
                  {!draft.removeImage && (previewUrl || selected?.image_path) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl ?? publicUrl(selected!.image_path!)}
                      alt=""
                      draggable={false}
                      onLoad={event => {
                        if (!selectedFile) return
                        const image = event.currentTarget
                        setSourceDimensions({ width: image.naturalWidth, height: image.naturalHeight })
                      }}
                      style={selectedFile && previewPlacement ? {
                        position: 'absolute',
                        left: previewPlacement.left + '%',
                        top: previewPlacement.top + '%',
                        width: previewPlacement.width + '%',
                        height: previewPlacement.height + '%',
                        maxWidth: 'none',
                      } : undefined}
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
    </section>
  )
}
