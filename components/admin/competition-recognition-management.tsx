'use client'

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  ImagePlus,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { formError } from '@/lib/auth/errors'
import {
  buildCompetitionRecognitionPayload,
  getNextCompetitionRecognitionOrder,
  isCompetitionRecognitionSetupRequired,
  reorderCompetitionRecognitionIds,
  safeCompetitionLogoFileName,
  validateCompetitionRecognitionDraft,
  type CompetitionRecognitionDraftErrors,
} from '@/lib/marketing/competition-recognition-admin'
import {
  COMPETITION_RECOGNITION_LOGO_BUCKET,
  COMPETITION_RECOGNITION_LOGO_HEIGHT,
  COMPETITION_RECOGNITION_LOGO_MAX_ZOOM,
  COMPETITION_RECOGNITION_LOGO_MIN_ZOOM,
  COMPETITION_RECOGNITION_LOGO_WIDTH,
} from '@/lib/marketing/competition-recognition-config'
import {
  calculateCompetitionRecognitionLogoPlacement,
  DEFAULT_COMPETITION_RECOGNITION_LOGO_FIT,
  fitCompetitionRecognitionLogo,
  normalizeCompetitionRecognitionLogoFit,
  type CompetitionRecognitionLogoFit,
} from '@/lib/marketing/competition-recognition-image'
import { createClient } from '@/lib/supabase/client'
import type { CompetitionRecognition } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './competition-recognition-management.module.css'

const migrationName = '202609270001_competition_recognitions.sql'

type Draft = {
  competitionName: string
  isActive: boolean
}

const emptyDraft: Draft = {
  competitionName: '',
  isActive: true,
}

function draftFromRecognition(recognition: CompetitionRecognition): Draft {
  return {
    competitionName: recognition.competition_name,
    isActive: recognition.is_active,
  }
}

function outputFileBase(file: File) {
  return safeCompetitionLogoFileName(file.name, file.type)
    .replace(/\.(jpe?g|png|webp)$/i, '')
    .slice(0, 80) || 'logo'
}

export function CompetitionRecognitionManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    startX: number
    startY: number
  } | null>(null)

  const [recognitions, setRecognitions] = useState<CompetitionRecognition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sourceDimensions, setSourceDimensions] = useState<{ width: number; height: number } | null>(null)
  const [fit, setFit] = useState<CompetitionRecognitionLogoFit>({ ...DEFAULT_COMPETITION_RECOGNITION_LOGO_FIT })
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<CompetitionRecognitionDraftErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selected = useMemo(
    () => recognitions.find(recognition => recognition.id === selectedId) ?? null,
    [recognitions, selectedId],
  )
  const busy = busyAction !== null
  const editorOpen = creating || Boolean(selected)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)
    const { data, error: loadError } = await supabase
      .from('competition_recognitions')
      .select('*')
      .order('display_order')
      .order('created_at')

    if (loadError) {
      setRecognitions([])
      if (isCompetitionRecognitionSetupRequired(loadError)) setSetupRequired(true)
      else {
        setLoadFailed(true)
        setError(formError(loadError, 'Competition recognitions could not be loaded. Check the connection and try again.'))
      }
    } else {
      setRecognitions(data ?? [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      setSourceDimensions(null)
      return
    }
    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editorOpen && !dialog.open) dialog.showModal()
    if (!editorOpen && dialog.open) dialog.close()
  }, [editorOpen])

  const publicUrl = useCallback((path: string) => (
    supabase.storage.from(COMPETITION_RECOGNITION_LOGO_BUCKET).getPublicUrl(path).data.publicUrl
  ), [supabase])

  const editorPreviewUrl = previewUrl ?? (selected ? publicUrl(selected.logo_path) : null)
  const placement = useMemo(() => {
    if (!selectedFile || !sourceDimensions) return null
    return calculateCompetitionRecognitionLogoPlacement(
      sourceDimensions.width,
      sourceDimensions.height,
      fit,
    )
  }, [fit, selectedFile, sourceDimensions])

  function resetEditor() {
    setCreating(false)
    setSelectedId(null)
    setDraft(emptyDraft)
    setSelectedFile(null)
    setSourceDimensions(null)
    setFit({ ...DEFAULT_COMPETITION_RECOGNITION_LOGO_FIT })
    setFieldErrors({})
    dragRef.current = null
  }

  function beginCreate() {
    setCreating(true)
    setSelectedId(null)
    setDraft(emptyDraft)
    setSelectedFile(null)
    setSourceDimensions(null)
    setFit({ ...DEFAULT_COMPETITION_RECOGNITION_LOGO_FIT })
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  function beginEdit(recognition: CompetitionRecognition) {
    setCreating(false)
    setSelectedId(recognition.id)
    setDraft(draftFromRecognition(recognition))
    setSelectedFile(null)
    setSourceDimensions(null)
    setFit({ ...DEFAULT_COMPETITION_RECOGNITION_LOGO_FIT })
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  function updateFit(next: Partial<CompetitionRecognitionLogoFit>) {
    setFit(current => normalizeCompetitionRecognitionLogoFit({ ...current, ...next }))
  }

  function handlePreviewPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!selectedFile) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startX: fit.x,
      startY: fit.y,
    }
  }

  function handlePreviewPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!selectedFile || !drag || drag.pointerId !== event.pointerId) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    updateFit({
      x: drag.startX + ((event.clientX - drag.clientX) / bounds.width) * 100,
      y: drag.startY + ((event.clientY - drag.clientY) / bounds.height) * 100,
    })
  }

  function handlePreviewPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const validation = validateCompetitionRecognitionDraft({
      competitionName: draft.competitionName,
      file: selectedFile,
      hasStoredLogo: Boolean(selected?.logo_path),
    })
    setFieldErrors(validation)
    setError('')
    setNotice('')
    if (Object.keys(validation).length) return

    let uploadedPath: string | null = null
    setBusyAction(selectedFile ? 'processing' : 'save')

    try {
      if (selectedFile) {
        const normalizedLogo = await fitCompetitionRecognitionLogo(selectedFile, fit)
        setBusyAction('save')
        uploadedPath = 'recognition-logos/' + crypto.randomUUID() + '-' + outputFileBase(selectedFile) + '.webp'
        const { error: uploadError } = await supabase.storage
          .from(COMPETITION_RECOGNITION_LOGO_BUCKET)
          .upload(uploadedPath, normalizedLogo, {
            cacheControl: '3600',
            contentType: 'image/webp',
            upsert: false,
          })
        if (uploadError) throw uploadError
      }

      const payload = buildCompetitionRecognitionPayload({
        competitionName: draft.competitionName,
        logoPath: uploadedPath,
        storedLogoPath: selected?.logo_path ?? null,
        isActive: draft.isActive,
      })
      const result = selected
        ? await supabase.from('competition_recognitions').update(payload).eq('id', selected.id)
        : await supabase.from('competition_recognitions').insert({
          ...payload,
          display_order: getNextCompetitionRecognitionOrder(recognitions),
        })
      if (result.error) throw result.error

      let warning = ''
      if (selected && uploadedPath && selected.logo_path !== uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from(COMPETITION_RECOGNITION_LOGO_BUCKET)
          .remove([selected.logo_path])
        if (cleanupError) warning = ' The old logo still needs manual Storage cleanup.'
      }

      const wasEditing = Boolean(selected)
      resetEditor()
      setNotice((wasEditing ? 'Recognition updated.' : 'Recognition added.') + warning)
      await load()
    } catch (caught) {
      let cleanupWarning = ''
      if (uploadedPath) {
        const { data: persisted, error: reconciliationError } = await supabase
          .from('competition_recognitions')
          .select('id,logo_path')
          .eq('logo_path', uploadedPath)
          .maybeSingle()

        if (persisted) {
          let warning = ''
          if (selected && selected.logo_path !== uploadedPath) {
            const { error: cleanupError } = await supabase.storage
              .from(COMPETITION_RECOGNITION_LOGO_BUCKET)
              .remove([selected.logo_path])
            if (cleanupError) warning = ' The old logo still needs manual Storage cleanup.'
          }
          const wasEditing = Boolean(selected)
          resetEditor()
          setNotice((wasEditing ? 'Recognition updated.' : 'Recognition added.') + warning)
          await load()
          return
        }

        if (reconciliationError) {
          cleanupWarning = ' The new file was not removed because its database status could not be confirmed. Review the recognition list and Storage before retrying.'
        } else {
          const { error: cleanupError } = await supabase.storage
            .from(COMPETITION_RECOGNITION_LOGO_BUCKET)
            .remove([uploadedPath])
          if (cleanupError) cleanupWarning = ' The new file also needs manual Storage cleanup.'
        }
      }
      setError(formError(caught, 'Recognition could not be saved.') + cleanupWarning)
    } finally {
      setBusyAction(null)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (busy) return
    const ids = reorderCompetitionRecognitionIds(recognitions, index, direction)
    if (ids.every((id, position) => id === recognitions[position]?.id)) return

    setBusyAction('move-' + recognitions[index].id)
    setError('')
    setNotice('')
    const { error: reorderError } = await supabase.rpc('reorder_competition_recognitions', { p_ids: ids })
    if (reorderError) setError(formError(reorderError))
    else {
      setNotice('Recognition order updated.')
      await load()
    }
    setBusyAction(null)
  }

  async function toggleActive(recognition: CompetitionRecognition) {
    if (busy) return
    setBusyAction('toggle-' + recognition.id)
    setError('')
    setNotice('')
    const { error: updateError } = await supabase
      .from('competition_recognitions')
      .update({ is_active: !recognition.is_active })
      .eq('id', recognition.id)

    if (updateError) setError(formError(updateError))
    else {
      setNotice(recognition.is_active ? 'Recognition hidden from the homepage.' : 'Recognition shown on the homepage.')
      await load()
    }
    setBusyAction(null)
  }

  async function remove(recognition: CompetitionRecognition) {
    if (busy || !window.confirm('Delete recognition “' + recognition.competition_name + '” and its logo?')) return
    setBusyAction('delete-' + recognition.id)
    setError('')
    setNotice('')

    const { error: rowError } = await supabase
      .from('competition_recognitions')
      .delete()
      .eq('id', recognition.id)

    if (rowError) setError(formError(rowError))
    else {
      let warning = ''
      const remainingIds = recognitions
        .filter(item => item.id !== recognition.id)
        .map(item => item.id)

      if (remainingIds.length) {
        const { error: reorderError } = await supabase
          .rpc('reorder_competition_recognitions', { p_ids: remainingIds })
        if (reorderError) warning += ' Remaining positions need review.'
      }

      const { error: storageError } = await supabase.storage
        .from(COMPETITION_RECOGNITION_LOGO_BUCKET)
        .remove([recognition.logo_path])
      if (storageError) warning += ' The logo still needs manual Storage cleanup.'

      if (selectedId === recognition.id) resetEditor()
      setNotice('Recognition deleted.' + warning)
      await load()
    }
    setBusyAction(null)
  }

  const pageHeader = (
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>
        <p className="kicker">Content · Homepage</p>
        <h2>Competition Recognition</h2>
        <p>Manage approved competition-finalist logos, homepage visibility, and display order.</p>
      </div>
      <span className={dataStyles.countPill}><Trophy aria-hidden="true" />{recognitions.length} recognitions</span>
    </header>
  )

  if (loading) {
    return (
      <section className={dataStyles.page} data-testid="competition-recognition-admin-section" aria-busy="true">
        {pageHeader}
        <div className={styles.stateCard} role="status"><RefreshCw aria-hidden="true" /> Loading competition recognitions…</div>
      </section>
    )
  }

  if (setupRequired) {
    return (
      <section className={dataStyles.page} data-testid="competition-recognition-admin-section">
        {pageHeader}
        <div className={styles.stateCard} role="alert">
          <CircleAlert aria-hidden="true" />
          <strong>Database setup required.</strong>
          <p>Apply migration <code>{migrationName}</code> before managing recognition logos.</p>
          <button type="button" className="button button-outline" onClick={() => void load()}>Try again</button>
        </div>
      </section>
    )
  }

  if (loadFailed) {
    return (
      <section className={dataStyles.page} data-testid="competition-recognition-admin-section">
        {pageHeader}
        <div className={styles.stateCard} role="alert">
          <CircleAlert aria-hidden="true" />
          <strong>Competition recognitions could not be loaded.</strong>
          <p>{error}</p>
          <button type="button" className="button button-outline" onClick={() => void load()}>Try again</button>
        </div>
      </section>
    )
  }

  return (
    <section className={dataStyles.page} data-testid="competition-recognition-admin-section" aria-busy={busy}>
      {pageHeader}
      {error ? <p className={dataStyles.feedback + ' ' + dataStyles.errorFeedback} role="alert">{error}</p> : null}
      {notice ? <p className={dataStyles.feedback + ' ' + dataStyles.successFeedback} role="status">{notice}</p> : null}

      <div className={dataStyles.surface}>
        <div className={dataStyles.surfaceHeader}>
          <div className={dataStyles.surfaceHeaderCopy}>
            <p className="kicker">Homepage order</p>
            <h3>{recognitions.length} recognitions</h3>
            <p>New and replacement logos are normalized to the homepage 5:2 frame before upload.</p>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={beginCreate}
            disabled={busy}
            data-testid="competition-recognition-add-button"
          >
            <Plus aria-hidden="true" /> Add Recognition
          </button>
        </div>

        {!recognitions.length ? (
          <div className={dataStyles.empty}>
            No recognition logos yet. The public statement remains visible without an empty logo wall.
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Logo</th>
                  <th>Competition</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th className={styles.actionCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recognitions.map((recognition, index) => (
                  <tr key={recognition.id} data-testid="competition-recognition-admin-row">
                    <td className={styles.logoCell} data-label="Logo">
                      <span className={styles.logoPreview}>
                        <img src={publicUrl(recognition.logo_path)} alt={recognition.competition_name} />
                      </span>
                    </td>
                    <td className={styles.nameCell} data-label="Competition">
                      <strong>{recognition.competition_name}</strong>
                      <small>{recognition.logo_path}</small>
                    </td>
                    <td className={styles.orderCell} data-label="Position">
                      <span className={styles.orderControls}>
                        <span className={styles.orderNumber}>{index + 1}</span>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => void move(index, -1)}
                          disabled={busy || index === 0}
                          data-testid={'competition-recognition-' + recognition.id + '-move-up-button'}
                          aria-label={'Move ' + recognition.competition_name + ' up'}
                        >
                          <ArrowUp aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => void move(index, 1)}
                          disabled={busy || index === recognitions.length - 1}
                          data-testid={'competition-recognition-' + recognition.id + '-move-down-button'}
                          aria-label={'Move ' + recognition.competition_name + ' down'}
                        >
                          <ArrowDown aria-hidden="true" size={15} />
                        </button>
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={styles.statusStack}>
                        <span className={dataStyles.badge + ' ' + (recognition.is_active ? dataStyles.successBadge : dataStyles.mutedBadge)}>
                          {recognition.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          type="button"
                          className={styles.statusButton}
                          role="switch"
                          aria-checked={recognition.is_active}
                          onClick={() => void toggleActive(recognition)}
                          disabled={busy}
                        >
                          {recognition.is_active ? 'Hide' : 'Show'}
                        </button>
                      </span>
                    </td>
                    <td className={styles.actionCell} data-label="Actions">
                      <span className={styles.actions}>
                        <button
                          type="button"
                          className={styles.manageButton}
                          onClick={() => beginEdit(recognition)}
                          disabled={busy}
                          data-testid={'competition-recognition-' + recognition.id + '-edit-button'}
                        >
                          Manage
                        </button>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => void remove(recognition)}
                          disabled={busy}
                          data-testid={'competition-recognition-' + recognition.id + '-delete-button'}
                          aria-label={'Delete ' + recognition.competition_name}
                        >
                          <Trash2 aria-hidden="true" size={15} /> Delete
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className={dialogStyles.dialog}
        aria-labelledby="competition-recognition-editor-heading"
        data-testid="competition-recognition-editor-dialog"
        onCancel={event => {
          if (busy) event.preventDefault()
          else resetEditor()
        }}
        onClose={() => {
          if (!busy && editorOpen) resetEditor()
        }}
        onClick={event => {
          if (event.target === event.currentTarget && !busy) resetEditor()
        }}
      >
        <div className={dialogStyles.panel}>
          <header className={dialogStyles.header}>
            <div>
              <p className="kicker">{creating ? 'New recognition' : 'Manage recognition'}</p>
              <h2 id="competition-recognition-editor-heading">
                {creating ? 'Add competition recognition' : selected?.competition_name}
              </h2>
            </div>
            <button
              type="button"
              className={'role-close ' + dialogStyles.closeButton}
              onClick={resetEditor}
              disabled={busy}
              aria-label="Close recognition editor"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className={dialogStyles.body}>
            <form className={styles.form} key={creating ? 'create' : selected?.id ?? 'idle'} onSubmit={save} noValidate>
              <div className={styles.formGrid}>
                <label>
                  Competition name
                  <input
                    type="text"
                    value={draft.competitionName}
                    maxLength={180}
                    onChange={event => {
                      setDraft(current => ({ ...current, competitionName: event.target.value }))
                      setFieldErrors(current => ({ ...current, competitionName: undefined }))
                    }}
                    aria-invalid={Boolean(fieldErrors.competitionName)}
                  />
                  {fieldErrors.competitionName ? <small className="form-error">{fieldErrors.competitionName}</small> : null}
                </label>
                <label className={styles.activeToggle}>
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={event => setDraft(current => ({ ...current, isActive: event.target.checked }))}
                  />
                  <span>Active on homepage</span>
                </label>
              </div>

              <section className={styles.mediaSection}>
                <div className={styles.mediaCopy}>
                  <label>
                    Logo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={event => {
                        const file = event.target.files?.[0] ?? null
                        setSelectedFile(file)
                        setSourceDimensions(null)
                        setFit({ ...DEFAULT_COMPETITION_RECOGNITION_LOGO_FIT })
                        setFieldErrors(current => ({ ...current, file: undefined }))
                      }}
                    />
                  </label>
                  <p className={styles.help}>
                    {selected?.logo_path ? 'Leave empty to keep the existing logo. ' : ''}
                    JPG, PNG, or WebP · maximum 5 MB. New files are saved as a transparent 5:2 WebP canvas.
                  </p>
                  {fieldErrors.file ? <small className="form-error">{fieldErrors.file}</small> : null}

                  {selectedFile ? (
                    <div className={styles.fitControls} data-testid="competition-recognition-fit-controls">
                      <div className={styles.fitMeta}>
                        <span>Fit the complete logo inside the homepage frame. Drag the preview or use the sliders.</span>
                        <strong>{COMPETITION_RECOGNITION_LOGO_WIDTH} × {COMPETITION_RECOGNITION_LOGO_HEIGHT} px · 5:2</strong>
                      </div>
                      <label>
                        Horizontal position
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={fit.x}
                          onChange={event => updateFit({ x: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        Vertical position
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={fit.y}
                          onChange={event => updateFit({ y: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        Zoom
                        <input
                          type="range"
                          min={COMPETITION_RECOGNITION_LOGO_MIN_ZOOM}
                          max={COMPETITION_RECOGNITION_LOGO_MAX_ZOOM}
                          step=".05"
                          value={fit.zoom}
                          onChange={event => updateFit({ zoom: Number(event.target.value) })}
                        />
                      </label>
                      <button
                        type="button"
                        className={'button button-outline ' + styles.resetFit}
                        onClick={() => setFit({ ...DEFAULT_COMPETITION_RECOGNITION_LOGO_FIT })}
                      >
                        Reset to Fit
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className={styles.previewColumn}>
                  <div
                    className={styles.previewFrame}
                    data-testid="competition-recognition-fit-preview"
                    data-draggable={selectedFile ? 'true' : 'false'}
                    onPointerDown={handlePreviewPointerDown}
                    onPointerMove={handlePreviewPointerMove}
                    onPointerUp={handlePreviewPointerEnd}
                    onPointerCancel={handlePreviewPointerEnd}
                  >
                    {editorPreviewUrl ? (
                      <img
                        src={editorPreviewUrl}
                        alt={draft.competitionName ? draft.competitionName + ' preview' : 'Competition logo preview'}
                        draggable={false}
                        onLoad={event => {
                          if (!selectedFile) return
                          const image = event.currentTarget
                          setSourceDimensions({ width: image.naturalWidth, height: image.naturalHeight })
                        }}
                        style={selectedFile && placement ? {
                          position: 'absolute',
                          left: (placement.x / COMPETITION_RECOGNITION_LOGO_WIDTH) * 100 + '%',
                          top: (placement.y / COMPETITION_RECOGNITION_LOGO_HEIGHT) * 100 + '%',
                          width: (placement.width / COMPETITION_RECOGNITION_LOGO_WIDTH) * 100 + '%',
                          height: (placement.height / COMPETITION_RECOGNITION_LOGO_HEIGHT) * 100 + '%',
                          objectFit: 'contain',
                        } : {
                          width: '100%',
                          height: '100%',
                          padding: '8%',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <div className={styles.previewPlaceholder}>
                        <ImagePlus aria-hidden="true" />
                        <span>Select a logo to preview its homepage frame.</span>
                      </div>
                    )}
                  </div>
                  <p className={styles.previewCaption}>
                    Transparent surrounding space is preserved in the saved file. The white frame mirrors the homepage background.
                  </p>
                </div>
              </section>

              <div className={styles.formActions}>
                <button className="button button-primary" disabled={busy}>
                  {busyAction === 'processing'
                    ? 'Processing logo…'
                    : busyAction === 'save'
                      ? 'Saving…'
                      : creating
                        ? 'Add recognition'
                        : 'Save changes'}
                </button>
                <button type="button" className="button button-outline" onClick={resetEditor} disabled={busy}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
    </section>
  )
}
