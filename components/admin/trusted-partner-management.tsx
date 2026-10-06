'use client'

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Handshake,
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
} from 'react'

import { formError } from '@/lib/auth/errors'
import { AdminDeleteConfirmation } from '@/components/admin/admin-delete-confirmation'
import { AdminImageUploadField } from '@/components/admin/admin-image-upload-field'
import { useAdminImageUpload } from '@/components/admin/use-admin-image-upload'
import { cropRectFromJson, PHOTO_SOURCE_BUCKET } from '@/lib/media/image-crop'
import { persistAdminImage } from '@/lib/media/admin-image-storage'
import {
  buildTrustedPartnerPayload,
  getNextTrustedPartnerOrder,
  isTrustedPartnerSetupRequired,
  reorderTrustedPartnerIds,
  validateTrustedPartnerDraft,
  type TrustedPartnerDraftErrors,
} from '@/lib/marketing/trusted-partner-admin'
import {
  TRUSTED_PARTNER_LOGO_BUCKET,
  TRUSTED_PARTNER_LOGO_HEIGHT,
  TRUSTED_PARTNER_LOGO_PREFIX,
  TRUSTED_PARTNER_LOGO_WIDTH,
} from '@/lib/marketing/trusted-partner-config'
import { createClient } from '@/lib/supabase/client'
import type { TrustedPartner } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './trusted-partner-management.module.css'

const migrationName = '202610070001_marketing_logo_crop_sources.sql'
const imageTarget = {
  width: TRUSTED_PARTNER_LOGO_WIDTH,
  height: TRUSTED_PARTNER_LOGO_HEIGHT,
  maxBytes: 5 * 1024 * 1024,
  title: 'Adjust partner image crop',
}

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

export function TrustedPartnerManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [partners, setPartners] = useState<TrustedPartner[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TrustedPartner | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<TrustedPartnerDraftErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const image = useAdminImageUpload({ supabase, target: imageTarget, onError: setError })

  const selected = useMemo(
    () => partners.find(partner => partner.id === selectedId) ?? null,
    [partners, selectedId],
  )
  const busy = busyAction !== null || image.loadingSource
  const editorOpen = creating || Boolean(selected)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)
    const { data, error: loadError } = await supabase.rpc('admin_list_trusted_partners')

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

  const beginCreate = () => {
    setSelectedId(null)
    setDraft(emptyDraft)
    image.reset()
    setFieldErrors({})
    setError('')
    setNotice('')
    setCreating(true)
  }

  const beginEdit = (partner: TrustedPartner) => {
    setCreating(false)
    setSelectedId(partner.id)
    setDraft(draftFromPartner(partner))
    image.reset(cropRectFromJson(partner.logo_crop))
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  const resetEditor = () => {
    setCreating(false)
    setSelectedId(null)
    setDraft(emptyDraft)
    image.reset()
    setFieldErrors({})
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setNotice('')

    const errors = validateTrustedPartnerDraft({
      organizationName: draft.organizationName,
      file: image.originalFile,
      hasStoredLogo: Boolean(image.processedFile || selected?.logo_path),
    })
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setBusyAction('save')
    try {
      const saved = await persistAdminImage({
        original: image.originalFile,
        derivative: image.processedFile,
        sourcePrefix: 'trusted-partners/',
        derivativePrefix: TRUSTED_PARTNER_LOGO_PREFIX,
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
            ...buildTrustedPartnerPayload({ organizationName: draft.organizationName, logoPath: refs.path, storedLogoPath: selected?.logo_path ?? null, isActive: draft.isActive }),
            logo_source_path: refs.sourcePath,
            logo_crop: image.crop,
          }
          const result = selected
            ? await supabase.from('trusted_partners').update(payload).eq('id', selected.id)
            : await supabase.from('trusted_partners').insert({ ...payload, display_order: getNextTrustedPartnerOrder(partners) })
          if (result.error) throw new Error(result.error.message)
        },
        reconcile: async () => {
          const { data, error } = await supabase.rpc('admin_list_trusted_partners')
          if (error) throw new Error(error.message)
          return (data ?? []).map(row => ({ path: row.logo_path, sourcePath: row.logo_source_path }))
        },
      })

      const wasEditing = Boolean(selected)
      resetEditor()
      setNotice((wasEditing ? 'Partner updated.' : 'Partner added.') + saved.warning)
      await load()
    } catch (saveError) {
      setError(formError(saveError, 'The trusted partner could not be saved.'))
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
    if (busy) return
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
    if (partner.logo_source_path) {
      const { error: sourceError } = await supabase.storage.from(PHOTO_SOURCE_BUCKET).remove([partner.logo_source_path])
      if (sourceError) warning += ' The original still needs manual Storage cleanup.'
    }
    setNotice(`Deleted partner "${partner.organization_name}".` + warning)
    setDeleteTarget(null)
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
            <p>New and replacement images are cropped to the homepage 5:4 frame before upload.</p>
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
                          onClick={() => setDeleteTarget(partner)}
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
                <AdminImageUploadField image={image} target={imageTarget}
                  storedUrl={selected ? publicUrl(selected.logo_path) : null}
                  sourcePath={selected?.logo_source_path} alt={draft.organizationName || 'Partner image preview'}
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
                        ? 'Add partner'
                        : 'Save changes'}
                </button>
                <button type="button" className="button button-outline" onClick={resetEditor} disabled={busy}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
      <AdminDeleteConfirmation
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Delete partner "${deleteTarget.organization_name}"?` : 'Delete partner?'}
        description="The partner record and its stored logo will be deleted permanently."
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) void remove(deleteTarget) }}
      />
    </section>
  )
}
