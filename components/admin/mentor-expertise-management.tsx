'use client'

import { ArrowDown, ArrowUp, Pencil, Plus, Power, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { adminFormError as formError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import type { MentorExpertise } from '@/lib/supabase/database.types'

import { AdminDeleteConfirmation } from './admin-delete-confirmation'
import dataStyles from './data-management.module.css'
import styles from './mentor-expertise-management.module.css'

type StatusFilter = 'all' | 'active' | 'inactive'

type EditorState = {
  id: string | null
  name: string
  isActive: boolean
  sortOrder: number | null
}

const emptyEditor: EditorState = { id: null, name: '', isActive: true, sortOrder: null }

export function MentorExpertiseManagement() {
  const [rows, setRows] = useState<MentorExpertise[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editor, setEditor] = useState<EditorState>(emptyEditor)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MentorExpertise | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const initialEditorRef = useRef<EditorState>(emptyEditor)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: loadError } = await createClient()
        .from('mentor_expertise')
        .select('*')
        .order('sort_order')
        .order('name')
      if (loadError) throw loadError
      setRows(data || [])
    } catch (caught) {
      setError(formError(caught, 'Unable to load mentor expertise.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editorOpen && !dialog.open) dialog.showModal()
    if (!editorOpen && dialog.open) dialog.close()
  }, [editorOpen])

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('id-ID')
    return rows.filter(row => {
      if (statusFilter === 'active' && !row.is_active) return false
      if (statusFilter === 'inactive' && row.is_active) return false
      return !normalized || row.name.toLocaleLowerCase('id-ID').includes(normalized)
    })
  }, [query, rows, statusFilter])

  function openCreate() {
    const next = { ...emptyEditor, sortOrder: rows.length + 1 }
    initialEditorRef.current = next
    setEditor(next)
    setError('')
    setMessage('')
    setEditorOpen(true)
  }

  function openEdit(row: MentorExpertise) {
    const next = { id: row.id, name: row.name, isActive: row.is_active, sortOrder: row.sort_order }
    initialEditorRef.current = next
    setEditor(next)
    setError('')
    setMessage('')
    setEditorOpen(true)
  }

  function closeEditor() {
    if (busyId !== null) return
    if (JSON.stringify(editor) !== JSON.stringify(initialEditorRef.current) && !window.confirm('Discard unsaved expertise changes?')) return
    setEditorOpen(false)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busyId !== null) return
    const name = editor.name.trim()
    if (!name) { setError('Expertise name is required.'); return }
    if (editor.sortOrder === null || !Number.isInteger(editor.sortOrder) || editor.sortOrder < 1) {
      setError('Display order must be a whole number of at least 1.')
      return
    }
    setBusyId(editor.id || 'new')
    setError('')
    setMessage('')
    try {
      const { data, error: saveError } = await createClient().rpc('admin_upsert_mentor_expertise', {
        p_name: name,
        p_id: editor.id,
        p_is_active: editor.isActive,
        p_sort_order: editor.sortOrder,
      })
      if (saveError) throw saveError
      if (!data) throw new Error('The saved expertise was not returned.')
      setEditorOpen(false)
      setMessage(editor.id ? 'Expertise updated.' : 'Expertise added.')
      await load()
    } catch (caught) {
      setError(formError(caught, 'Unable to save expertise.'))
    } finally {
      setBusyId(null)
    }
  }

  async function setActive(row: MentorExpertise, isActive: boolean) {
    setBusyId(row.id)
    setError('')
    setMessage('')
    try {
      const { error: saveError } = await createClient().rpc('admin_upsert_mentor_expertise', {
        p_name: row.name,
        p_id: row.id,
        p_is_active: isActive,
      })
      if (saveError) throw saveError
      setRows(current => current.map(item => item.id === row.id ? { ...item, is_active: isActive } : item))
      setMessage(`${row.name} ${isActive ? 'activated' : 'deactivated'}.`)
    } catch (caught) {
      setError(formError(caught, 'Unable to update expertise status.'))
    } finally {
      setBusyId(null)
    }
  }

  async function move(row: MentorExpertise, direction: -1 | 1) {
    const currentIndex = rows.findIndex(item => item.id === row.id)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= rows.length) return
    const nextRows = [...rows]
    ;[nextRows[currentIndex], nextRows[nextIndex]] = [nextRows[nextIndex], nextRows[currentIndex]]
    setBusyId(row.id)
    setError('')
    setMessage('')
    try {
      const { data, error: reorderError } = await createClient().rpc('admin_reorder_mentor_expertise', {
        p_ids: nextRows.map(item => item.id),
      })
      if (reorderError) throw reorderError
      setRows(data || nextRows.map((item, index) => ({ ...item, sort_order: index + 1 })))
      setMessage('Expertise display order updated.')
    } catch (caught) {
      setError(formError(caught, 'Unable to update expertise display order.'))
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function remove() {
    if (!deleteTarget) return
    const target = deleteTarget
    setBusyId(target.id)
    setError('')
    setMessage('')
    try {
      const { data, error: deleteError } = await createClient().rpc('admin_delete_mentor_expertise', { p_id: target.id })
      if (deleteError) throw deleteError
      if (data === 'deactivate_required') {
        setMessage(`${target.name} is used by mentor profiles. Deactivate it to prevent future selection.`)
      } else {
        setMessage(`${target.name} deleted.`)
        await load()
      }
      setDeleteTarget(null)
    } catch (caught) {
      setError(formError(caught, 'Unable to delete expertise.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className={dataStyles.page} data-testid="mentor-expertise-management">
      <header className={dataStyles.pageHeader}>
        <div className={dataStyles.pageHeaderCopy}>
          
          <h2>Mentor Expertise</h2>
          
        </div>
        <button type="button" className={`button button-primary ${dataStyles.pageAction}`} onClick={openCreate} disabled={loading || busyId !== null}><Plus aria-hidden="true" size={16} />Add expertise</button>
      </header>

      <section className={`${dataStyles.surface} ${dataStyles.masterSurface}`}>
        <div className={dataStyles.surfaceHeader}>
          <div className={dataStyles.surfaceHeaderCopy}>
            <h3>Expertise</h3>
            <p>{rows.length} expertise</p>
          </div>
        </div>

        <div className={dataStyles.toolbar}>
          <label className={dataStyles.searchField}>Search expertise<span className={dataStyles.searchControl}><Search aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search expertise name" /></span></label>
          <label className={dataStyles.filterField}>Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>

        {!editorOpen && error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
        {message ? <p className={`${dataStyles.feedback} ${dataStyles.successFeedback}`} role="status">{message}</p> : null}

        <div className={dataStyles.tableScroll}>
          <table className={`${dataStyles.table} ${dataStyles.masterTable} ${dataStyles.compactMasterTable}`}>
            <colgroup><col /><col className={dataStyles.masterOrderColumn} /><col className={dataStyles.masterStatusColumn} /><col className={dataStyles.masterActionColumn} /></colgroup>
            <thead><tr><th>Expertise</th><th>Display order</th><th>Status</th><th className={dataStyles.masterActionCell}>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4}><div className={dataStyles.empty}>Loading mentor expertise…</div></td></tr> : visibleRows.length === 0 ? <tr><td colSpan={4}><div className={dataStyles.empty}>{rows.length === 0 ? 'No expertise configured yet.' : 'No expertise matches these filters.'}</div></td></tr> : visibleRows.map(row => {
                const canonicalIndex = rows.findIndex(item => item.id === row.id)
                const busy = busyId !== null
                return <tr key={row.id} data-testid={`mentor-expertise-row-${row.slug}`}>
                  <td><span className={dataStyles.primaryName}>{row.name}</span></td>
                  <td><div className={dataStyles.orderControls}><span>{row.sort_order}</span><button type="button" className={dataStyles.iconButton} onClick={() => void move(row, -1)} disabled={busy || canonicalIndex <= 0} aria-label={`Move ${row.name} up`}><ArrowUp aria-hidden="true" size={14} /></button><button type="button" className={dataStyles.iconButton} onClick={() => void move(row, 1)} disabled={busy || canonicalIndex === rows.length - 1} aria-label={`Move ${row.name} down`}><ArrowDown aria-hidden="true" size={14} /></button></div></td>
                  <td><span className={`${dataStyles.badge} ${row.is_active ? dataStyles.successBadge : dataStyles.mutedBadge}`}>{row.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className={dataStyles.masterActionCell}><div className={dataStyles.masterActionGroup}>
                    <button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={() => openEdit(row)} disabled={busy}><Pencil aria-hidden="true" size={14} />Edit</button>
                    <button type="button" className={`button button-outline ${dataStyles.actionButton} ${row.is_active ? dataStyles.warningAction : dataStyles.positiveAction}`} onClick={() => void setActive(row, !row.is_active)} disabled={busy}><Power aria-hidden="true" size={14} />{row.is_active ? 'Deactivate' : 'Activate'}</button>
                    <button type="button" className={`button button-outline ${dataStyles.actionButton} ${dataStyles.dangerAction}`} onClick={() => setDeleteTarget(row)} disabled={busy}><Trash2 aria-hidden="true" size={14} />Delete</button>
                  </div></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={dialogRef} className={`${dataStyles.dialog} ${styles.dialog}`} onClose={() => { setEditorOpen(false); setEditor(emptyEditor) }} onCancel={event => { event.preventDefault(); closeEditor() }} aria-labelledby="mentor-expertise-dialog-title" data-testid="mentor-expertise-dialog">
        <form className={dataStyles.dialogPanel} onSubmit={save}>
          <header className={dataStyles.dialogHeader}><div><h2 id="mentor-expertise-dialog-title">{editor.id ? 'Edit expertise' : 'Add expertise'}</h2></div><button type="button" className={dataStyles.closeButton} onClick={closeEditor} aria-label="Close dialog"><X aria-hidden="true" size={18} /></button></header>
          <fieldset className={dataStyles.dialogBody} disabled={busyId !== null} style={{border:0,margin:0,minWidth:0}}>
            {error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
            <label className={`${dataStyles.field} ${dataStyles.fullField}`}>Expertise name<input autoFocus required maxLength={100} value={editor.name} onChange={event => setEditor(current => ({ ...current, name: event.target.value }))} /></label>
            <label className={dataStyles.field}>Display order<input type="number" required min={1} step={1} value={editor.sortOrder ?? ''} onChange={event => setEditor(current => ({ ...current, sortOrder: event.target.value === '' ? null : Number(event.target.value) }))} /></label>
            <label className={dataStyles.switchField}><span>Active</span><span className={dataStyles.switchControl}><input type="checkbox" checked={editor.isActive} onChange={event => setEditor(current => ({ ...current, isActive: event.target.checked }))} /><span className={dataStyles.switchTrack} aria-hidden="true" /></span></label>
          </fieldset>
          <footer className={dataStyles.dialogFooter}><button type="button" className="button button-outline" onClick={closeEditor} disabled={busyId !== null}>Cancel</button><button className="button button-primary" disabled={busyId !== null}>{busyId ? 'Saving…' : 'Save'}</button></footer>
        </form>
      </dialog>

      <AdminDeleteConfirmation
        open={deleteTarget !== null}
        title={deleteTarget ? `Delete “${deleteTarget.name}”?` : 'Delete expertise?'}
        description="Unused expertise will be permanently deleted. Expertise linked to mentor profiles must be deactivated instead."
        busy={Boolean(deleteTarget && busyId === deleteTarget.id)}
        cancelLabel="Cancel"
        confirmLabel="Delete permanently"
        busyLabel="Deleting…"
        onCancel={() => { if (!busyId) setDeleteTarget(null) }}
        onConfirm={() => void remove()}
      />
    </section>
  )
}
