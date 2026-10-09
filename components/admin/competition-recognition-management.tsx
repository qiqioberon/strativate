'use client'

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
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
} from 'react'

import { adminFormError as formError } from '@/lib/auth/errors'
import { AdminDeleteConfirmation } from '@/components/admin/admin-delete-confirmation'
import { AdminImageUploadField } from '@/components/admin/admin-image-upload-field'
import { useAdminImageUpload } from '@/components/admin/use-admin-image-upload'
import { cropRectFromJson, PHOTO_SOURCE_BUCKET } from '@/lib/media/image-crop'
import { persistAdminImage } from '@/lib/media/admin-image-storage'
import {
  buildCompetitionRecognitionPayload,
  getNextCompetitionRecognitionOrder,
  isCompetitionRecognitionSetupRequired,
  reorderCompetitionRecognitionIds,
  validateCompetitionRecognitionDraft,
  type CompetitionRecognitionDraftErrors,
} from '@/lib/marketing/competition-recognition-admin'
import {
  COMPETITION_RECOGNITION_LOGO_BUCKET,
  COMPETITION_RECOGNITION_LOGO_HEIGHT,
  COMPETITION_RECOGNITION_LOGO_WIDTH,
} from '@/lib/marketing/competition-recognition-config'
import { createClient } from '@/lib/supabase/client'
import type { CompetitionRecognition } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './competition-recognition-management.module.css'

const migrationName = '202610070001_marketing_logo_crop_sources.sql'
const imageTarget = {
  width: COMPETITION_RECOGNITION_LOGO_WIDTH,
  height: COMPETITION_RECOGNITION_LOGO_HEIGHT,
  maxBytes: 5 * 1024 * 1024,
  title: 'Adjust recognition image crop',
}

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

export function CompetitionRecognitionManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [recognitions, setRecognitions] = useState<CompetitionRecognition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CompetitionRecognition | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<CompetitionRecognitionDraftErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const image = useAdminImageUpload({ supabase, target: imageTarget, onError: setError })

  const selected = useMemo(
    () => recognitions.find(recognition => recognition.id === selectedId) ?? null,
    [recognitions, selectedId],
  )
  const busy = busyAction !== null || image.loadingSource
  const editorOpen = creating || Boolean(selected)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)
    const { data, error: loadError } = await supabase.rpc('admin_list_competition_recognitions')

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
    const dialog = dialogRef.current
    if (!dialog) return
    if (editorOpen && !dialog.open) dialog.showModal()
    if (!editorOpen && dialog.open) dialog.close()
  }, [editorOpen])

  const publicUrl = useCallback((path: string) => (
    supabase.storage.from(COMPETITION_RECOGNITION_LOGO_BUCKET).getPublicUrl(path).data.publicUrl
  ), [supabase])

  function resetEditor() {
    setCreating(false)
    setSelectedId(null)
    setDraft(emptyDraft)
    image.reset()
    setFieldErrors({})
  }

  function beginCreate() {
    setCreating(true)
    setSelectedId(null)
    setDraft(emptyDraft)
    image.reset()
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  function beginEdit(recognition: CompetitionRecognition) {
    setCreating(false)
    setSelectedId(recognition.id)
    setDraft(draftFromRecognition(recognition))
    image.reset(cropRectFromJson(recognition.logo_crop))
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  function requestCloseEditor() {
    if (busy) return
    const dirty = JSON.stringify(draft) !== JSON.stringify(selected ? draftFromRecognition(selected) : emptyDraft) || Boolean(image.processedFile || image.cropperProps.sourceFile)
    if (dirty && !window.confirm('Discard unsaved changes? Your edits and selected images will be lost.')) return
    resetEditor()
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const validation = validateCompetitionRecognitionDraft({
      competitionName: draft.competitionName,
      file: image.originalFile,
      hasStoredLogo: Boolean(image.processedFile || selected?.logo_path),
    })
    setFieldErrors(validation)
    setError('')
    setNotice('')
    if (Object.keys(validation).length) return

    setBusyAction('save')

    try {
      const saved = await persistAdminImage({
        original: image.originalFile,
        derivative: image.processedFile,
        sourcePrefix: 'competition-recognitions/',
        derivativePrefix: 'recognition-logos/',
        previous: { path: selected?.logo_path ?? null, sourcePath: selected?.logo_source_path ?? null },
        upload: async (bucket, path, file) => {
          const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
          if (error) throw new Error(error.message)
        },
        remove: async (bucket, path) => {
          const { error } = await supabase.storage.from(bucket).remove([path])
          if (error) throw new Error(error.message)
        },
        persist: async refs => {
          const payload = {
            ...buildCompetitionRecognitionPayload({ competitionName: draft.competitionName, logoPath: refs.path, storedLogoPath: selected?.logo_path ?? null, isActive: draft.isActive }),
            logo_source_path: refs.sourcePath,
            logo_crop: image.crop,
          }
          const result = selected
            ? await supabase.from('competition_recognitions').update(payload).eq('id', selected.id)
            : await supabase.from('competition_recognitions').insert({ ...payload, display_order: getNextCompetitionRecognitionOrder(recognitions) })
          if (result.error) throw new Error(result.error.message)
        },
        reconcile: async () => {
          const { data, error } = await supabase.rpc('admin_list_competition_recognitions')
          if (error) throw new Error(error.message)
          return (data ?? []).map(row => ({ path: row.logo_path, sourcePath: row.logo_source_path }))
        },
      })

      const wasEditing = Boolean(selected)
      resetEditor()
      setNotice((wasEditing ? 'Recognition updated.' : 'Recognition added.') + saved.warning)
      await load()
    } catch (caught) {
      setError(formError(caught, 'Recognition could not be saved.'))
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
    if (busy) return
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
      if (recognition.logo_source_path) {
        const { error: sourceError } = await supabase.storage.from(PHOTO_SOURCE_BUCKET).remove([recognition.logo_source_path])
        if (sourceError) warning += ' The original still needs manual Storage cleanup.'
      }

      if (selectedId === recognition.id) resetEditor()
      setNotice('Recognition deleted.' + warning)
      setDeleteTarget(null)
      await load()
    }
    setBusyAction(null)
  }

  const pageHeader = (
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>
        <h2>Competition Recognition</h2>
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
            <p>New and replacement images are cropped to the homepage 5:4 frame before upload.</p>
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
                          onClick={() => setDeleteTarget(recognition)}
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

              <h2 id="competition-recognition-editor-heading">
                {creating ? 'Add competition recognition' : selected?.competition_name}
              </h2>
            </div>
            <button
              type="button"
              className={'role-close ' + dialogStyles.closeButton}
              onClick={requestCloseEditor}
              disabled={busy}
              aria-label="Close recognition editor"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className={dialogStyles.body}>
            <form className={styles.form} key={creating ? 'create' : selected?.id ?? 'idle'} onSubmit={save} noValidate><fieldset className={dataStyles.editableFields} disabled={busy}>
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
                <AdminImageUploadField image={image} target={imageTarget}
                  storedUrl={selected ? publicUrl(selected.logo_path) : null}
                  sourcePath={selected?.logo_source_path} alt={draft.competitionName || 'Recognition image preview'}
                  disabled={busy} onApplied={() => setFieldErrors(current => ({ ...current, file: undefined }))} />
                {fieldErrors.file ? <small className="form-error">{fieldErrors.file}</small> : null}
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
                <button type="button" className="button button-outline" onClick={requestCloseEditor} disabled={busy}>Cancel</button>
              </div>
            </fieldset></form>
          </div>
        </div>
      </dialog>
      <AdminDeleteConfirmation
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Delete recognition “${deleteTarget.competition_name}”?` : 'Delete recognition?'}
        description="The recognition record and its stored logo will be deleted permanently."
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) void remove(deleteTarget) }}
      />
    </section>
  )
}
