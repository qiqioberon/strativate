'use client'

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Handshake,
  ImagePlus,
  Plus,
  RefreshCw,
  Trash2,
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
  buildTrustedPartnerPayload,
  getNextTrustedPartnerOrder,
  isTrustedPartnerSetupRequired,
  reorderTrustedPartnerIds,
  safePartnerLogoFileName,
  validateTrustedPartnerDraft,
  type TrustedPartnerDraftErrors,
} from '@/lib/marketing/trusted-partner-admin'
import {
  TRUSTED_PARTNER_LOGO_BUCKET,
  TRUSTED_PARTNER_LOGO_HEIGHT,
  TRUSTED_PARTNER_LOGO_MAX_ZOOM,
  TRUSTED_PARTNER_LOGO_MIN_ZOOM,
  TRUSTED_PARTNER_LOGO_PREFIX,
  TRUSTED_PARTNER_LOGO_WIDTH,
} from '@/lib/marketing/trusted-partner-config'
import {
  calculateTrustedPartnerLogoPlacement,
  DEFAULT_TRUSTED_PARTNER_LOGO_FIT,
  fitTrustedPartnerLogo,
  normalizeTrustedPartnerLogoFit,
  type TrustedPartnerLogoFit,
} from '@/lib/marketing/trusted-partner-image'
import { createClient } from '@/lib/supabase/client'
import type { TrustedPartner } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './trusted-partner-management.module.css'

const migrationName = '202610020001_trusted_partners.sql'

type Draft = {
  organizationName: string
  isActive: boolean
}

const emptyDraft: Draft = {
  organizationName: '',
  isActive: true,
}

function draftFromPartner(partner: TrustedPartner): Draft {
  return {
    organizationName: partner.organization_name,
    isActive: partner.is_active,
  }
}

function outputFileBase(file: File) {
  return safePartnerLogoFileName(file.name, file.type)
    .replace(/\.(jpe?g|png|webp)$/i, '')
    .slice(0, 80) || 'logo'
}

export function TrustedPartnerManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    startX: number
    startY: number
  } | null>(null)

  const [partners, setPartners] = useState<TrustedPartner[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sourceDimensions, setSourceDimensions] = useState<{ width: number; height: number } | null>(null)
  const [fit, setFit] = useState<TrustedPartnerLogoFit>({ ...DEFAULT_TRUSTED_PARTNER_LOGO_FIT })
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<TrustedPartnerDraftErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selected = useMemo(
    () => partners.find(partner => partner.id === selectedId) ?? null,
    [partners, selectedId],
  )
  const busy = busyAction !== null
  const editorOpen = creating || Boolean(selected)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)
    const { data, error: loadError } = await supabase
      .from('trusted_partners')
      .select('*')
      .order('display_order')
      .order('created_at')

    if (loadError) {
      if (isTrustedPartnerSetupRequired(loadError)) {
        setSetupRequired(true)
      } else {
        setLoadFailed(true)
        setError(formError(loadError, 'Trusted partners could not be loaded. Check the connection and try again.'))
      }
      setPartners([])
      setLoading(false)
      return
    }

    setPartners(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      setSourceDimensions(null)
      return undefined
    }
    const nextUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [selectedFile])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editorOpen && !dialog.open) {
      dialog.showModal()
    } else if (!editorOpen && dialog.open) {
      dialog.close()
    }
  }, [editorOpen])

  const publicUrl = useCallback((path: string) => {
    return supabase.storage.from(TRUSTED_PARTNER_LOGO_BUCKET).getPublicUrl(path).data.publicUrl
  }, [supabase])

  const editorPreviewUrl = useMemo(() => {
    if (previewUrl) return previewUrl
    if (selected?.logo_path) return publicUrl(selected.logo_path)
    return null
  }, [previewUrl, publicUrl, selected])

  const updateFit = useCallback((partial: Partial<TrustedPartnerLogoFit>) => {
    setFit(current => normalizeTrustedPartnerLogoFit({ ...current, ...partial }))
  }, [])

  const placement = useMemo(() => {
    if (!sourceDimensions) return null
    return calculateTrustedPartnerLogoPlacement(
      sourceDimensions.width,
      sourceDimensions.height,
      fit,
    )
  }, [fit, sourceDimensions])

  const beginCreate = () => {
    setSelectedId(null)
    setDraft(emptyDraft)
    setSelectedFile(null)
    setSourceDimensions(null)
    setFit({ ...DEFAULT_TRUSTED_PARTNER_LOGO_FIT })
    setFieldErrors({})
    setError('')
    setNotice('')
    setCreating(true)
  }

  const beginEdit = (partner: TrustedPartner) => {
    setCreating(false)
    setSelectedId(partner.id)
    setDraft(draftFromPartner(partner))
    setSelectedFile(null)
    setSourceDimensions(null)
    setFit({ ...DEFAULT_TRUSTED_PARTNER_LOGO_FIT })
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  const resetEditor = () => {
    setCreating(false)
    setSelectedId(null)
    setDraft(emptyDraft)
    setSelectedFile(null)
    setSourceDimensions(null)
    setFit({ ...DEFAULT_TRUSTED_PARTNER_LOGO_FIT })
    setFieldErrors({})
    dragRef.current = null
  }

  const handlePreviewPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
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

  const handlePreviewPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const deltaX = ((event.clientX - drag.clientX) / rect.width) * 100
    const deltaY = ((event.clientY - drag.clientY) / rect.height) * 100
    updateFit({
      x: drag.startX + deltaX,
      y: drag.startY + deltaY,
    })
  }

  const handlePreviewPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (drag && drag.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      dragRef.current = null
    }
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setNotice('')

    const errors = validateTrustedPartnerDraft({
      organizationName: draft.organizationName,
      file: selectedFile,
      hasStoredLogo: Boolean(selected?.logo_path),
    })
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    let finalPath: string | null = null
    setBusyAction(selectedFile ? 'processing' : 'save')
    try {
      if (selectedFile) {
        const processedBlob = await fitTrustedPartnerLogo(selectedFile, fit)
        setBusyAction('save')
        finalPath = `${TRUSTED_PARTNER_LOGO_PREFIX}${crypto.randomUUID()}-${outputFileBase(selectedFile)}.webp`
        const { error: uploadError } = await supabase.storage
          .from(TRUSTED_PARTNER_LOGO_BUCKET)
          .upload(finalPath, processedBlob, { cacheControl: '3600', contentType: 'image/webp', upsert: false })
        if (uploadError) throw uploadError
      }

      const payload = buildTrustedPartnerPayload({
        organizationName: draft.organizationName,
        logoPath: finalPath,
        storedLogoPath: selected?.logo_path ?? null,
        isActive: draft.isActive,
      })

      const result = selected
        ? await supabase.from('trusted_partners').update(payload).eq('id', selected.id)
        : await supabase.from('trusted_partners').insert({
            ...payload,
            display_order: getNextTrustedPartnerOrder(partners),
          })
      if (result.error) throw result.error

      let cleanupWarning = ''
      if (selected && finalPath && selected.logo_path !== finalPath) {
        const { error: cleanupError } = await supabase.storage
          .from(TRUSTED_PARTNER_LOGO_BUCKET)
          .remove([selected.logo_path])
        if (cleanupError) cleanupWarning = ' The old logo still needs manual Storage cleanup.'
      }

      const wasEditing = Boolean(selected)
      resetEditor()
      setNotice((wasEditing ? 'Partner updated.' : 'Partner added.') + cleanupWarning)
      await load()
    } catch (saveError) {
      let cleanupWarning = ''
      if (finalPath) {
        const { data: persisted, error: reconciliationError } = await supabase
          .from('trusted_partners')
          .select('id,logo_path')
          .eq('logo_path', finalPath)
          .maybeSingle()

        if (persisted) {
          let cleanupWarning = ''
          if (selected && selected.logo_path !== finalPath) {
            const { error: cleanupError } = await supabase.storage
              .from(TRUSTED_PARTNER_LOGO_BUCKET)
              .remove([selected.logo_path])
            if (cleanupError) cleanupWarning = ' The old logo still needs manual Storage cleanup.'
          }
          resetEditor()
          setNotice((selected ? 'Partner updated.' : 'Partner added.') + cleanupWarning)
          await load()
          return
        }

        if (reconciliationError) {
          cleanupWarning = ' The new file was not removed because its database status could not be confirmed. Review the partner list and Storage before retrying.'
        } else {
          const { error: cleanupError } = await supabase.storage
            .from(TRUSTED_PARTNER_LOGO_BUCKET)
            .remove([finalPath])
          if (cleanupError) cleanupWarning = ' The new file also needs manual Storage cleanup.'
        }
      }
      setError(formError(saveError, 'The trusted partner could not be saved.') + cleanupWarning)
    } finally {
      setBusyAction(null)
    }
  }

  const toggleActive = async (partner: TrustedPartner) => {
    if (busy) return
    setError('')
    setNotice('')
    setBusyAction('toggle-' + partner.id)
    const { error: updateError } = await supabase
      .from('trusted_partners')
      .update({ is_active: !partner.is_active })
      .eq('id', partner.id)

    if (updateError) {
      setError(formError(updateError, 'The partner visibility could not be updated.'))
      setBusyAction(null)
      return
    }

    setNotice(partner.is_active ? 'Partner hidden from the homepage.' : 'Partner shown on the homepage.')
    await load()
    setBusyAction(null)
  }

  const move = async (index: number, direction: -1 | 1) => {
    if (busy) return
    const updatedIds = reorderTrustedPartnerIds(partners, index, direction)
    if (updatedIds.every((id, i) => id === partners[i]?.id)) return

    setError('')
    setNotice('')
    setBusyAction('move-' + partners[index].id)

    const { error: rpcError } = await supabase.rpc('reorder_trusted_partners', { p_ids: updatedIds })
    if (rpcError) {
      setError(formError(rpcError, 'The partner order could not be updated.'))
    } else {
      setNotice('Partner display order updated.')
      await load()
    }
    setBusyAction(null)
  }

  const remove = async (partner: TrustedPartner) => {
    if (busy || !window.confirm(`Delete partner "${partner.organization_name}" and its logo?`)) return
    setError('')
    setNotice('')
    setBusyAction('delete-' + partner.id)

    const { error: deleteError } = await supabase
      .from('trusted_partners')
      .delete()
      .eq('id', partner.id)

    if (deleteError) {
      setError(formError(deleteError, 'The trusted partner could not be deleted.'))
      setBusyAction(null)
      return
    }

    let warning = ''
    const remainingIds = partners.filter(item => item.id !== partner.id).map(item => item.id)
    if (remainingIds.length) {
      const { error: reorderError } = await supabase.rpc('reorder_trusted_partners', {
        p_ids: remainingIds,
      })
      if (reorderError) warning += ' Remaining positions need review.'
    }
    const { error: storageError } = await supabase.storage
      .from(TRUSTED_PARTNER_LOGO_BUCKET)
      .remove([partner.logo_path])
    if (storageError) warning += ' The logo still needs manual Storage cleanup.'
    setNotice(`Deleted partner "${partner.organization_name}".` + warning)
    await load()
    setBusyAction(null)
  }

  const pageHeader = (
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>
        <p className="kicker">Content · Homepage</p>
        <h2>Trusted Partners</h2>
        <p>Manage partner organizations displayed on the homepage floating constellation.</p>
      </div>
      <span className={dataStyles.countPill}><Handshake aria-hidden="true" />{partners.length} partners</span>
    </header>
  )

  if (loading) {
    return (
      <section className={dataStyles.page} data-testid="trusted-partner-admin-section" aria-busy="true">
        {pageHeader}
        <div className={styles.stateCard} role="status">
          <RefreshCw className="animate-spin" aria-hidden="true" />
          <p>Loading trusted partners…</p>
        </div>
      </section>
    )
  }

  if (setupRequired) {
    return (
      <section className={dataStyles.page} data-testid="trusted-partner-admin-section">
        {pageHeader}
        <div className={styles.stateCard} role="alert">
          <CircleAlert aria-hidden="true" />
          <strong>Database setup required</strong>
          <p>Database migration <code>{migrationName}</code> needs to be applied to manage trusted partners.</p>
          <button type="button" className="button button-outline" onClick={() => void load()}>Retry connection</button>
        </div>
      </section>
    )
  }

  if (loadFailed) {
    return (
      <section className={dataStyles.page} data-testid="trusted-partner-admin-section">
        {pageHeader}
        <div className={styles.stateCard} role="alert">
          <CircleAlert aria-hidden="true" />
          <strong>Trusted partners could not be loaded.</strong>
          <p>{error}</p>
          <button type="button" className="button button-outline" onClick={() => void load()}>Try again</button>
        </div>
      </section>
    )
  }

  return (
    <section className={dataStyles.page} data-testid="trusted-partner-admin-section" aria-busy={busy}>
      {pageHeader}
      {error ? <p className={dataStyles.feedback + ' ' + dataStyles.errorFeedback} role="alert">{error}</p> : null}
      {notice ? <p className={dataStyles.feedback + ' ' + dataStyles.successFeedback} role="status">{notice}</p> : null}

      <div className={dataStyles.surface}>
        <div className={dataStyles.surfaceHeader}>
          <div className={dataStyles.surfaceHeaderCopy}>
            <p className="kicker">Homepage constellation</p>
            <h3>{partners.length} partners</h3>
            <p>New and replacement logos are normalized to the 2:1 frame before upload.</p>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={beginCreate}
            disabled={busy}
            data-testid="trusted-partner-add-button"
          >
            <Plus aria-hidden="true" /> Add Partner
          </button>
        </div>

        {!partners.length ? (
          <div className={dataStyles.empty}>
            No partner logos yet. Add partner organizations to populate the homepage constellation.
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Logo</th>
                  <th>Organization</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th className={styles.actionCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner, index) => (
                  <tr key={partner.id} data-testid="trusted-partner-admin-row">
                    <td className={styles.logoCell} data-label="Logo">
                      <span className={styles.logoPreview}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={publicUrl(partner.logo_path)} alt={partner.organization_name} />
                      </span>
                    </td>
                    <td className={styles.nameCell} data-label="Organization">
                      <strong>{partner.organization_name}</strong>
                      <small>{partner.logo_path}</small>
                    </td>
                    <td className={styles.orderCell} data-label="Position">
                      <span className={styles.orderControls}>
                        <span className={styles.orderNumber}>{index + 1}</span>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => void move(index, -1)}
                          disabled={busy || index === 0}
                          data-testid={'trusted-partner-' + partner.id + '-move-up-button'}
                          aria-label={'Move ' + partner.organization_name + ' up'}
                        >
                          <ArrowUp aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => void move(index, 1)}
                          disabled={busy || index === partners.length - 1}
                          data-testid={'trusted-partner-' + partner.id + '-move-down-button'}
                          aria-label={'Move ' + partner.organization_name + ' down'}
                        >
                          <ArrowDown aria-hidden="true" size={15} />
                        </button>
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={styles.statusStack}>
                        <span className={dataStyles.badge + ' ' + (partner.is_active ? dataStyles.successBadge : dataStyles.mutedBadge)}>
                          {partner.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          type="button"
                          className={styles.statusButton}
                          role="switch"
                          aria-checked={partner.is_active}
                          onClick={() => void toggleActive(partner)}
                          disabled={busy}
                        >
                          {partner.is_active ? 'Hide' : 'Show'}
                        </button>
                      </span>
                    </td>
                    <td className={styles.actionCell} data-label="Actions">
                      <span className={styles.actions}>
                        <button
                          type="button"
                          className={styles.manageButton}
                          onClick={() => beginEdit(partner)}
                          disabled={busy}
                          data-testid={'trusted-partner-' + partner.id + '-edit-button'}
                        >
                          Manage
                        </button>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => void remove(partner)}
                          disabled={busy}
                          data-testid={'trusted-partner-' + partner.id + '-delete-button'}
                          aria-label={'Delete ' + partner.organization_name}
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
        aria-labelledby="trusted-partner-editor-heading"
        data-testid="trusted-partner-editor-dialog"
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
              <p className="kicker">{creating ? 'New partner' : 'Manage partner'}</p>
              <h2 id="trusted-partner-editor-heading">
                {creating ? 'Add trusted partner' : selected?.organization_name}
              </h2>
            </div>
            <button
              type="button"
              className={'role-close ' + dialogStyles.closeButton}
              onClick={resetEditor}
              disabled={busy}
              aria-label="Close partner editor"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className={dialogStyles.body}>
            <form className={styles.form} key={creating ? 'create' : selected?.id ?? 'idle'} onSubmit={save} noValidate>
              <div className={styles.formGrid}>
                <label>
                  Organization / Partner name
                  <input
                    type="text"
                    value={draft.organizationName}
                    maxLength={180}
                    onChange={event => {
                      setDraft(current => ({ ...current, organizationName: event.target.value }))
                      setFieldErrors(current => ({ ...current, organizationName: undefined }))
                    }}
                    aria-invalid={Boolean(fieldErrors.organizationName)}
                  />
                  {fieldErrors.organizationName ? <small className="form-error">{fieldErrors.organizationName}</small> : null}
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
                        setFit({ ...DEFAULT_TRUSTED_PARTNER_LOGO_FIT })
                        setFieldErrors(current => ({ ...current, file: undefined }))
                      }}
                    />
                  </label>
                  <p className={styles.help}>
                    {selected?.logo_path ? 'Leave empty to keep the existing logo. ' : ''}
                    JPG, PNG, or WebP · maximum 5 MB. New files are saved as a transparent 2:1 WebP canvas.
                  </p>
                  {fieldErrors.file ? <small className="form-error">{fieldErrors.file}</small> : null}

                  {selectedFile ? (
                    <div className={styles.fitControls} data-testid="trusted-partner-fit-controls">
                      <div className={styles.fitMeta}>
                        <span>Fit the complete logo inside the card frame. Drag the preview or use the sliders.</span>
                        <strong>{TRUSTED_PARTNER_LOGO_WIDTH} × {TRUSTED_PARTNER_LOGO_HEIGHT} px · 2:1</strong>
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
                          min={TRUSTED_PARTNER_LOGO_MIN_ZOOM}
                          max={TRUSTED_PARTNER_LOGO_MAX_ZOOM}
                          step=".05"
                          value={fit.zoom}
                          onChange={event => updateFit({ zoom: Number(event.target.value) })}
                        />
                      </label>
                      <button
                        type="button"
                        className={'button button-outline ' + styles.resetFit}
                        onClick={() => setFit({ ...DEFAULT_TRUSTED_PARTNER_LOGO_FIT })}
                      >
                        Reset to Fit
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className={styles.previewColumn}>
                  <div
                    className={styles.previewFrame}
                    data-testid="trusted-partner-fit-preview"
                    data-draggable={selectedFile ? 'true' : 'false'}
                    onPointerDown={handlePreviewPointerDown}
                    onPointerMove={handlePreviewPointerMove}
                    onPointerUp={handlePreviewPointerEnd}
                    onPointerCancel={handlePreviewPointerEnd}
                  >
                    {editorPreviewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={editorPreviewUrl}
                        alt={draft.organizationName ? draft.organizationName + ' preview' : 'Partner logo preview'}
                        draggable={false}
                        onLoad={event => {
                          if (!selectedFile) return
                          const image = event.currentTarget
                          setSourceDimensions({ width: image.naturalWidth, height: image.naturalHeight })
                        }}
                        style={selectedFile && placement ? {
                          position: 'absolute',
                          left: (placement.x / TRUSTED_PARTNER_LOGO_WIDTH) * 100 + '%',
                          top: (placement.y / TRUSTED_PARTNER_LOGO_HEIGHT) * 100 + '%',
                          width: (placement.width / TRUSTED_PARTNER_LOGO_WIDTH) * 100 + '%',
                          height: (placement.height / TRUSTED_PARTNER_LOGO_HEIGHT) * 100 + '%',
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
                        <span>Select a logo to preview its card frame.</span>
                      </div>
                    )}
                  </div>
                  <p className={styles.previewCaption}>
                    Transparent surrounding space is preserved in the saved file. The white frame mirrors the homepage card background.
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
                        ? 'Add partner'
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
