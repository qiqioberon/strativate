'use client'

import { ArrowDown, ArrowUp, Pencil, Plus, Power, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { adminFormError as formError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import type { MasterOption } from '@/lib/supabase/database.types'

import { AdminDeleteConfirmation } from './admin-delete-confirmation'
import dataStyles from './data-management.module.css'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'

type MasterOptionTable = 'referral_sources' | 'interests'
type OptionSortKey = 'name' | 'sort_order' | 'status'

const pageContent: Record<MasterOptionTable, { title: string; description: string; listTitle: string; countLabel: string; addLabel: string }> = {
  referral_sources: {
    title: 'Referral Sources',
    description: 'Manage the referral sources available during mentee onboarding.',
    listTitle: 'Referral source list',
    countLabel: 'referral sources',
    addLabel: 'Add source',
  },
  interests: {
    title: 'Competition Interests',
    description: 'Manage the competition interests available during mentee onboarding.',
    listTitle: 'Competition interest list',
    countLabel: 'competition interests',
    addLabel: 'Add interest',
  },
}

export function MasterOptions({ table }: { table: MasterOptionTable }) {
  const content = pageContent[table]
  const [options, setOptions] = useState<MasterOption[]>([])
  const [editing, setEditing] = useState<MasterOption | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MasterOption | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<OptionSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const initialFormRef = useRef('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: loadError } = await createClient().from(table).select('*').order('sort_order').order('name')
      if (loadError) throw loadError
      setOptions(data || [])
    } catch (caught) {
      setError(formError(caught, `Unable to load ${content.title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [content.title, table])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editing && !dialog.open) {
      dialog.showModal()
      const form = dialog.querySelector('form')
      initialFormRef.current = form ? JSON.stringify(Array.from(new FormData(form).entries())) : ''
    }
    if (!editing && dialog.open) dialog.close()
  }, [editing])

  const sortedOptions = useMemo(() => {
    if (!sortKey || !sortDirection) return options
    const direction = sortDirection === 'asc' ? 1 : -1
    return [...options].sort((a, b) => {
      if (sortKey === 'sort_order') return (a.sort_order - b.sort_order) * direction
      if (sortKey === 'status') return (Number(a.is_active) - Number(b.is_active)) * direction
      return a.name.localeCompare(b.name, 'id-ID') * direction
    })
  }, [options, sortDirection, sortKey])

  function changeSort(key: string | null, direction: SortDirection) {
    setSortKey(key as OptionSortKey | null)
    setSortDirection(direction)
  }

  function openCreate() {
    setError('')
    setMessage('')
    setEditing('new')
  }

  function openEdit(option: MasterOption) {
    setError('')
    setMessage('')
    setEditing(option)
  }

  function closeEditor() {
    if (busy) return
    const form = dialogRef.current?.querySelector('form')
    const dirty = form && JSON.stringify(Array.from(new FormData(form).entries())) !== initialFormRef.current
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setEditing(null)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    const form = event.currentTarget
    const data = new FormData(form)
    const values = { name: String(data.get('name')).trim(), sort_order: Number(data.get('sort_order')), is_active: data.get('is_active') === 'on' }
    if (!values.name || !Number.isInteger(values.sort_order) || values.sort_order < 1) {
      setError('Enter a valid name and display order.')
      setBusy(false)
      return
    }
    try {
      const db = createClient()
      const { error: saveError } = await db.rpc('admin_upsert_master_option', {
        p_table: table,
        p_name: values.name,
        p_id: editing && editing !== 'new' ? editing.id : null,
        p_sort_order: values.sort_order,
        p_is_active: values.is_active,
      })
      if (saveError) throw saveError
      setEditing(null)
      setMessage(editing === 'new' ? `${content.title} added.` : `${content.title} updated.`)
      await load()
    } catch (caught) {
      setError(formError(caught, `Unable to save ${content.title.toLowerCase()}.`))
    } finally {
      setBusy(false)
    }
  }

  async function setActive(option: MasterOption) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const nextActive = !option.is_active
      const { error: updateError } = await createClient().from(table).update({ is_active: nextActive }).eq('id', option.id)
      if (updateError) throw updateError
      setOptions(current => current.map(item => item.id === option.id ? { ...item, is_active: nextActive } : item))
      setMessage(`${option.name} ${nextActive ? 'activated' : 'deactivated'}.`)
    } catch (caught) {
      setError(formError(caught, `Unable to update the ${content.title.toLowerCase()} status.`))
    } finally {
      setBusy(false)
    }
  }

  async function move(option: MasterOption, direction: -1 | 1) {
    const currentIndex = options.findIndex(item => item.id === option.id)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= options.length) return
    const nextOptions = [...options]
    ;[nextOptions[currentIndex], nextOptions[nextIndex]] = [nextOptions[nextIndex], nextOptions[currentIndex]]
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: reorderError } = await createClient().rpc('admin_reorder_master_options', { p_table: table, p_ids: nextOptions.map(item => item.id) })
      if (reorderError) throw reorderError
      setOptions(nextOptions.map((item, index) => ({ ...item, sort_order: index + 1 })))
      setMessage(`${content.title} order updated.`)
    } catch (caught) {
      setError(formError(caught, `Unable to update the ${content.title.toLowerCase()} order.`))
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!deleteTarget || busy) return
    const target = deleteTarget
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data, error: deleteError } = await createClient().rpc('admin_delete_master_option', { p_table: table, p_id: target.id })
      if (deleteError) throw deleteError
      if (data === 'deactivate_required') {
        setMessage(`${target.name} is already used by mentees. Deactivate this option to preserve its history.`)
      } else if (data === 'deleted') {
        setMessage(`${target.name} deleted.`)
        await load()
      } else {
        setMessage(`${target.name} no longer exists.`)
        await load()
      }
      setDeleteTarget(null)
    } catch (caught) {
      setError(formError(caught, `Unable to delete ${content.title.toLowerCase()}.`))
    } finally {
      setBusy(false)
    }
  }

  const draft = editing && editing !== 'new' ? editing : null

  return <section className={dataStyles.page}>
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}><h2>{content.title}</h2></div>
      <button type="button" className={`button button-primary ${dataStyles.pageAction}`} onClick={openCreate} disabled={loading || busy}><Plus aria-hidden="true" size={16} />{content.addLabel}</button>
    </header>

    <section className={`${dataStyles.surface} ${dataStyles.masterSurface}`}>
      <div className={dataStyles.surfaceHeader}><div className={dataStyles.surfaceHeaderCopy}><h3>{content.listTitle}</h3><p>{options.length} {content.countLabel}</p></div></div>
      {!editing && error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
      {message ? <p className={`${dataStyles.feedback} ${dataStyles.successFeedback}`} role="status">{message}</p> : null}
      <div className={dataStyles.tableScroll}>
        <table className={`${dataStyles.table} ${dataStyles.masterTable} ${dataStyles.compactMasterTable}`}>
          <colgroup><col /><col className={dataStyles.masterOrderColumn} /><col className={dataStyles.masterStatusColumn} /><col className={dataStyles.masterActionColumn} /></colgroup>
          <thead><tr><SortableTableHeader label="Name" sortKey="name" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Display order" sortKey="sort_order" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th className={dataStyles.masterActionCell}>Actions</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={4}><div className={dataStyles.empty}>Loading {content.title.toLowerCase()}…</div></td></tr> : sortedOptions.length ? sortedOptions.map(option => {
            const canonicalIndex = options.findIndex(item => item.id === option.id)
            return <tr key={option.id}>
              <td><span className={dataStyles.primaryName}>{option.name}</span></td>
              <td><div className={dataStyles.orderControls}><span>{option.sort_order}</span><button type="button" className={dataStyles.iconButton} onClick={() => void move(option, -1)} disabled={busy || canonicalIndex <= 0} aria-label={`Move ${option.name} up`}><ArrowUp aria-hidden="true" size={14} /></button><button type="button" className={dataStyles.iconButton} onClick={() => void move(option, 1)} disabled={busy || canonicalIndex === options.length - 1} aria-label={`Move ${option.name} down`}><ArrowDown aria-hidden="true" size={14} /></button></div></td>
              <td><span className={`${dataStyles.badge} ${option.is_active ? dataStyles.successBadge : dataStyles.mutedBadge}`}>{option.is_active ? 'Active' : 'Inactive'}</span></td>
              <td className={dataStyles.masterActionCell}><div className={dataStyles.masterActionGroup}>
                <button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={() => openEdit(option)} disabled={busy}><Pencil aria-hidden="true" size={14} />Edit</button>
                <button type="button" className={`button button-outline ${dataStyles.actionButton} ${option.is_active ? dataStyles.warningAction : dataStyles.positiveAction}`} onClick={() => void setActive(option)} disabled={busy}><Power aria-hidden="true" size={14} />{option.is_active ? 'Deactivate' : 'Activate'}</button>
                <button type="button" className={`button button-outline ${dataStyles.actionButton} ${dataStyles.dangerAction}`} onClick={() => setDeleteTarget(option)} disabled={busy}><Trash2 aria-hidden="true" size={14} />Delete</button>
              </div></td>
            </tr>
          }) : <tr><td colSpan={4}><div className={dataStyles.empty}>No {content.countLabel} yet.</div></td></tr>}</tbody>
        </table>
      </div>
    </section>

    <dialog ref={dialogRef} className={`${dataStyles.dialog} ${dataStyles.compactDialog}`} onClose={() => setEditing(null)} onCancel={event => { event.preventDefault(); closeEditor() }} aria-labelledby="master-option-dialog-title">
      <form key={draft?.id || 'new'} className={dataStyles.dialogPanel} onSubmit={save}><fieldset className={dataStyles.editableFields} disabled={busy}>
        <header className={dataStyles.dialogHeader}><div><h2 id="master-option-dialog-title">{draft ? `Edit ${draft.name}` : content.addLabel}</h2></div><button type="button" className={dataStyles.closeButton} onClick={closeEditor} aria-label="Close dialog"><X aria-hidden="true" size={18} /></button></header>
        <div className={dataStyles.dialogBody}>
          {error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
          <div className={dataStyles.formGrid}>
            <label className={`${dataStyles.field} ${dataStyles.fullField}`}>Name<input name="name" autoFocus required maxLength={100} defaultValue={draft?.name || ''} /></label>
            <label className={dataStyles.field}>Display order<input name="sort_order" type="number" required min={1} step={1} defaultValue={draft?.sort_order ?? options.length + 1} /></label>
            <label className={dataStyles.switchField}><span>Active</span><span className={dataStyles.switchControl}><input name="is_active" type="checkbox" defaultChecked={draft?.is_active ?? true} /><span className={dataStyles.switchTrack} aria-hidden="true" /></span></label>
          </div>
        </div>
        <footer className={dataStyles.dialogFooter}><button className="button button-outline" type="button" onClick={closeEditor} disabled={busy}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></footer>
      </fieldset></form>
    </dialog>

    <AdminDeleteConfirmation
      open={deleteTarget !== null}
      title={deleteTarget ? `Delete “${deleteTarget.name}”?` : `Delete ${content.title.toLowerCase()}?`}
      description="Unused options are permanently deleted. Options linked to mentee data must be deactivated to preserve their history."
      busy={busy}
      cancelLabel="Cancel"
      confirmLabel="Delete permanently"
      busyLabel="Deleting…"
      onCancel={() => { if (!busy) setDeleteTarget(null) }}
      onConfirm={() => void remove()}
    />
  </section>
}
