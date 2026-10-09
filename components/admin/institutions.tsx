'use client'

import { Archive, Check, Copy, Pencil, Plus, Search, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import { adminFormError as formError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import type { ApprovalStatus, Institution, InstitutionType } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'

const types: { value: InstitutionType; label: string }[] = [{ value: 'university', label: 'University' }, { value: 'sma', label: 'High school (SMA)' }, { value: 'smk', label: 'Vocational high school (SMK)' }]
const statuses: { value: ApprovalStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
]
type InstitutionSortKey = 'name' | 'type' | 'location' | 'status' | 'source'

function statusLabel(value: ApprovalStatus) {
  return statuses.find(item => item.value === value)?.label ?? value.replaceAll('_', ' ')
}

function statusClass(value: ApprovalStatus) {
  if (value === 'approved') return dataStyles.successBadge
  if (value === 'pending') return dataStyles.warningBadge
  if (value === 'rejected') return dataStyles.dangerBadge
  return dataStyles.mutedBadge
}

export function InstitutionManagement() {
  const [records, setRecords] = useState<Institution[]>([])
  const [query, setQuery] = useState(''), [type, setType] = useState(''), [status, setStatus] = useState('')
  const [page, setPage] = useState(0), [pageSize, setPageSize] = useState(10), [total, setTotal] = useState(0)
  const [sortKey, setSortKey] = useState<InstitutionSortKey | null>(null), [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [editing, setEditing] = useState<Institution | 'new' | null>(null), [merging, setMerging] = useState<Institution | null>(null)
  const [mergeQuery, setMergeQuery] = useState(''), [mergeResults, setMergeResults] = useState<Institution[]>([]), [mergeTarget, setMergeTarget] = useState<Institution | null>(null)
  const editorDialogRef = useRef<HTMLDialogElement>(null)
  const initialFormRef = useRef('')
  const mergeDialogRef = useRef<HTMLDialogElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let request = createClient().from('institutions').select('*', { count: 'exact' })
      if (query.trim()) request = request.ilike('normalized_name', `%${query.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[\\%_]/g, '\\$&')}%`)
      if (type) request = request.eq('type', type as InstitutionType)
      if (status) request = request.eq('approval_status', status as ApprovalStatus)
      if (sortKey && sortDirection) {
        const column = sortKey === 'location' ? 'city' : sortKey === 'status' ? 'approval_status' : sortKey
        request = request.order(column, { ascending: sortDirection === 'asc', nullsFirst: false }).order('id')
      } else {
        request = request.order('created_at', { ascending: false }).order('id')
      }
      const { data, error: loadError, count } = await request.range(page * pageSize, page * pageSize + pageSize - 1)
      if (loadError) throw loadError
      const nextTotal = Number(count ?? 0)
      const lastPage = Math.max(0, Math.ceil(nextTotal / pageSize) - 1)
      if (page > lastPage) { setPage(lastPage); return }
      setRecords(data || [])
      setTotal(nextTotal)
    } catch (caught) {
      setError(formError(caught, 'Unable to load institutions.'))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, query, sortDirection, sortKey, status, type])

  useEffect(() => { const timer = setTimeout(() => { void load() }, 250); return () => clearTimeout(timer) }, [load])
  useEffect(() => {
    const dialog = editorDialogRef.current
    if (!dialog) return
    if (editing && !dialog.open) {
      dialog.showModal()
      const form = dialog.querySelector('form')
      initialFormRef.current = form ? JSON.stringify(Array.from(new FormData(form).entries())) : ''
    }
    if (!editing && dialog.open) dialog.close()
  }, [editing])
  useEffect(() => {
    const dialog = mergeDialogRef.current
    if (!dialog) return
    if (merging && !dialog.open) dialog.showModal()
    if (!merging && dialog.open) dialog.close()
  }, [merging])
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      if (!merging || mergeQuery.trim().length < 2) { setMergeResults([]); return }
      try {
        const { data, error: searchError } = await createClient().rpc('search_institutions', { p_query: mergeQuery })
        if (searchError) throw searchError
        if (active) setMergeResults((data || []).filter(item => item.approval_status === 'approved' && item.id !== merging.id))
      } catch (caught) {
        if (active) setError(formError(caught, 'Unable to search destination institutions.'))
      }
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [mergeQuery, merging])

  function changeSort(key: string | null, direction: SortDirection) {
    setSortKey(key as InstitutionSortKey | null)
    setSortDirection(direction)
    setPage(0)
  }

  function openEditor(record: Institution | 'new') {
    setError('')
    setMessage('')
    setEditing(record)
  }

  function closeEditor() {
    if (busy) return
    const form = editorDialogRef.current?.querySelector('form')
    const dirty = form && JSON.stringify(Array.from(new FormData(form).entries())) !== initialFormRef.current
    if (dirty && !window.confirm('Discard unsaved institution changes?')) return
    setEditing(null)
  }

  function openMerge(record: Institution) {
    setError('')
    setMessage('')
    setMerging(record)
    setMergeTarget(null)
    setMergeQuery('')
    setMergeResults([])
  }

  function closeMerge() {
    if (busy) return
    setMerging(null)
    setMergeTarget(null)
    setMergeQuery('')
    setMergeResults([])
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    const data = new FormData(event.currentTarget)
    const values = { name: String(data.get('name')).trim(), type: String(data.get('type')) as InstitutionType, province: String(data.get('province') || '').trim() || null, city: String(data.get('city') || '').trim() || null, institution_status: String(data.get('institution_status') || '').trim() || null }
    try {
      const db = createClient()
      const { error: saveError } = editing && editing !== 'new' ? await db.from('institutions').update(values).eq('id', editing.id) : await db.from('institutions').insert({ ...values, source: 'admin_manual', approval_status: 'approved' })
      if (saveError) throw saveError
      const wasEditing = editing !== 'new'
      setEditing(null)
      setMessage(wasEditing ? 'Institution updated.' : 'Institution added.')
      await load()
    } catch (caught) {
      setError(formError(caught, 'Unable to save the institution.'))
    } finally {
      setBusy(false)
    }
  }

  async function moderate(record: Institution, approval_status: ApprovalStatus) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: moderateError } = await createClient().from('institutions').update({ approval_status }).eq('id', record.id)
      if (moderateError) throw moderateError
      setMessage(`${record.name} is now ${statusLabel(approval_status).toLowerCase()}.`)
      await load()
    } catch (caught) {
      setError(formError(caught, 'Unable to update the institution status.'))
    } finally {
      setBusy(false)
    }
  }

  async function merge() {
    if (busy || !merging || !mergeTarget) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const sourceName = merging.name
      const targetName = mergeTarget.name
      const { error: mergeError } = await createClient().rpc('merge_institutions', { p_from: merging.id, p_into: mergeTarget.id })
      if (mergeError) throw mergeError
      setMerging(null)
      setMergeTarget(null)
      setMergeQuery('')
      setMergeResults([])
      setMessage(`${sourceName} merged into ${targetName}.`)
      await load()
    } catch (caught) {
      setError(formError(caught, 'Unable to resolve the duplicate institution.'))
    } finally {
      setBusy(false)
    }
  }

  const draft = editing && editing !== 'new' ? editing : null

  return <section className={dataStyles.page}>
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}><h2>Institutions</h2></div>
      <button type="button" className={`button button-primary ${dataStyles.pageAction}`} onClick={() => openEditor('new')}><Plus aria-hidden="true" size={16} />Add institution</button>
    </header>

    <section className={`${dataStyles.surface} ${dataStyles.masterSurface}`}>
      <div className={dataStyles.surfaceHeader}><div className={dataStyles.surfaceHeaderCopy}><h3>Institution list</h3><p>{total} institutions</p></div></div>
      <div className={dataStyles.toolbar}>
        <label className={dataStyles.searchField}>Search institutions<span className={dataStyles.searchControl}><Search aria-hidden="true" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Institution name" /></span></label>
        <label className={dataStyles.filterField}>Type<select value={type} onChange={event => { setType(event.target.value); setPage(0) }}><option value="">All types</option>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label className={dataStyles.filterField}>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}><option value="">All statuses</option>{statuses.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label className={dataStyles.filterField}>Per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5, 10, 20].map(size => <option value={size} key={size}>{size}</option>)}</select></label>
      </div>

      {!editing && !merging && error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
      {message ? <p className={`${dataStyles.feedback} ${dataStyles.successFeedback}`} role="status">{message}</p> : null}

      <div className={dataStyles.tableScroll}>
        <table className={`${dataStyles.table} ${dataStyles.institutionTable} ${dataStyles.compactMasterTable}`}>
          <colgroup><col /><col className={dataStyles.institutionTypeColumn} /><col className={dataStyles.institutionLocationColumn} /><col className={dataStyles.institutionStatusColumn} /><col className={dataStyles.institutionSourceColumn} /><col className={dataStyles.institutionActionColumn} /></colgroup>
          <thead><tr><SortableTableHeader label="Institution" sortKey="name" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Type" sortKey="type" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Location" sortKey="location" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Source" sortKey="source" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th className={dataStyles.masterActionCell}>Actions</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={6}><div className={dataStyles.empty}>Loading institutions…</div></td></tr> : records.length === 0 ? <tr><td colSpan={6}><div className={dataStyles.empty}>No institutions found.</div></td></tr> : records.map(record => <tr key={record.id}>
            <td><span className={dataStyles.primaryName}>{record.name}</span></td>
            <td>{types.find(item => item.value === record.type)?.label}</td>
            <td>{[record.city, record.province].filter(Boolean).join(', ') || '—'}</td>
            <td><span className={`${dataStyles.badge} ${statusClass(record.approval_status)}`}>{statusLabel(record.approval_status)}</span></td>
            <td>{record.source === 'admin_manual' ? 'Added by admin' : record.source === 'user_submitted' ? 'User submitted' : record.source === 'import' ? 'Imported' : record.source === 'bima_kemdiktisaintek' ? 'BIMA Kemdiktisaintek' : record.source === 'school_pdf' ? 'School directory' : record.source.replaceAll('_', ' ')}</td>
            <td className={dataStyles.masterActionCell}><div className={dataStyles.masterActionGroup}>
              <button type="button" className={`button button-outline ${dataStyles.actionButton}`} disabled={busy} onClick={() => openEditor(record)}><Pencil aria-hidden="true" size={14} />Edit</button>
              {record.approval_status === 'pending' ? <><button type="button" className={`button button-outline ${dataStyles.actionButton} ${dataStyles.positiveAction}`} disabled={busy} onClick={() => void moderate(record, 'approved')}><Check aria-hidden="true" size={14} />Approve</button><button type="button" className={`button button-outline ${dataStyles.actionButton} ${dataStyles.dangerAction}`} disabled={busy} onClick={() => void moderate(record, 'rejected')}><XCircle aria-hidden="true" size={14} />Reject</button></> : null}
              {record.approval_status !== 'archived' ? <button type="button" className={`button button-outline ${dataStyles.actionButton} ${dataStyles.warningAction}`} disabled={busy} onClick={() => void moderate(record, 'archived')}><Archive aria-hidden="true" size={14} />Archive</button> : null}
              <button type="button" className={`button button-outline ${dataStyles.actionButton}`} disabled={busy} onClick={() => openMerge(record)}><Copy aria-hidden="true" size={14} />Merge duplicate</button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      <TablePagination language="en" page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} disabled={loading || busy} label="Institution pagination" />
    </section>

    <dialog ref={editorDialogRef} className={dataStyles.dialog} onClose={() => setEditing(null)} onCancel={event => { event.preventDefault(); closeEditor() }} aria-labelledby="institution-editor-title">
      <form key={draft?.id || 'new'} className={dataStyles.dialogPanel} onSubmit={save}><fieldset className={dataStyles.editableFields} disabled={busy}>
        <header className={dataStyles.dialogHeader}><div><h2 id="institution-editor-title">{draft ? 'Edit institution' : 'Add institution'}</h2></div><button type="button" className={dataStyles.closeButton} onClick={closeEditor} aria-label="Close dialog"><X aria-hidden="true" size={18} /></button></header>
        <div className={dataStyles.dialogBody}>
          {error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
          <div className={dataStyles.formGrid}>
            <label className={`${dataStyles.field} ${dataStyles.fullField}`}>Name<input name="name" autoFocus required minLength={2} maxLength={250} defaultValue={draft?.name || ''} /></label>
            <label className={dataStyles.field}>Type<select name="type" defaultValue={draft?.type || 'university'}>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label className={dataStyles.field}>Institution status<input name="institution_status" maxLength={100} defaultValue={draft?.institution_status || ''} placeholder="Public / Private" /></label>
            <label className={dataStyles.field}>Province<input name="province" maxLength={150} defaultValue={draft?.province || ''} /></label>
            <label className={dataStyles.field}>City / Regency<input name="city" maxLength={150} defaultValue={draft?.city || ''} /></label>
          </div>
        </div>
        <footer className={dataStyles.dialogFooter}><button className="button button-outline" type="button" onClick={closeEditor} disabled={busy}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></footer>
      </fieldset></form>
    </dialog>

    <dialog ref={mergeDialogRef} className={dataStyles.dialog} onClose={closeMerge} onCancel={event => { event.preventDefault(); closeMerge() }} aria-labelledby="institution-merge-title">
      <div className={dataStyles.dialogPanel}>
        <header className={dataStyles.dialogHeader}><div><h2 id="institution-merge-title">Merge duplicate</h2></div><button type="button" className={dataStyles.closeButton} onClick={closeMerge} aria-label="Close dialog"><X aria-hidden="true" size={18} /></button></header>
        <div className={dataStyles.dialogBody}>
          <p className={dataStyles.dialogHint}>Select an approved destination institution. Mentee references will move to it, and the source institution will be archived.</p>
          {error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
          <label className={`${dataStyles.field} ${dataStyles.fullField}`}>Search destination institutions<input autoFocus value={mergeQuery} onChange={event => { setMergeQuery(event.target.value); setMergeTarget(null) }} placeholder="Enter at least 2 characters" /></label>
          <div className={dataStyles.resultList}>{mergeResults.map(item => <button type="button" className={dataStyles.resultOption} key={item.id} onClick={() => setMergeTarget(item)} data-selected={mergeTarget?.id === item.id}><strong>{item.name}</strong><small>{types.find(typeItem => typeItem.value === item.type)?.label} · {item.city || 'Location unavailable'} · {item.external_id || item.id}</small></button>)}</div>
          {merging && mergeTarget ? <p className={dataStyles.mergeSummary}><strong>{merging.name}</strong> → <strong>{mergeTarget.name}</strong><br />All mentee references will move to the destination institution.</p> : null}
        </div>
        <footer className={dataStyles.dialogFooter}><button type="button" className="button button-outline" onClick={closeMerge} disabled={busy}>Cancel</button><button type="button" className="button button-primary" disabled={busy || !mergeTarget} onClick={() => void merge()}>{busy ? 'Merging…' : 'Confirm merge'}</button></footer>
      </div>
    </dialog>
  </section>
}
