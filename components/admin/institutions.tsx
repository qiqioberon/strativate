'use client'

import { Archive, Check, Copy, Pencil, Plus, Search, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import { formError } from '@/lib/auth/errors'
import { displayLabel } from '@/lib/labels'
import { createClient } from '@/lib/supabase/client'
import type { ApprovalStatus, Institution, InstitutionType } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'

const types: { value: InstitutionType; label: string }[] = [{ value: 'university', label: 'Universitas' }, { value: 'sma', label: 'SMA' }, { value: 'smk', label: 'SMK' }]
const statuses: { value: ApprovalStatus; label: string }[] = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'archived', label: 'Diarsipkan' },
]
type InstitutionSortKey = 'name' | 'type' | 'location' | 'status' | 'source'

function statusLabel(value: ApprovalStatus) {
  return statuses.find(item => item.value === value)?.label ?? displayLabel(value)
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
      setError(formError(caught, 'Institusi belum dapat dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, query, sortDirection, sortKey, status, type])

  useEffect(() => { const timer = setTimeout(() => { void load() }, 250); return () => clearTimeout(timer) }, [load])
  useEffect(() => {
    const dialog = editorDialogRef.current
    if (!dialog) return
    if (editing && !dialog.open) dialog.showModal()
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
        if (active) setError(formError(caught, 'Institusi tujuan belum dapat dicari.'))
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
    if (!busy) setEditing(null)
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
      setMessage(wasEditing ? 'Institusi berhasil diperbarui.' : 'Institusi berhasil ditambahkan.')
      await load()
    } catch (caught) {
      setError(formError(caught, 'Institusi belum dapat disimpan.'))
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
      setMessage(`Status ${record.name} diperbarui menjadi ${statusLabel(approval_status).toLocaleLowerCase('id-ID')}.`)
      await load()
    } catch (caught) {
      setError(formError(caught, 'Status institusi belum dapat diperbarui.'))
    } finally {
      setBusy(false)
    }
  }

  async function merge() {
    if (!merging || !mergeTarget) return
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
      setMessage(`${sourceName} berhasil digabungkan ke ${targetName}.`)
      await load()
    } catch (caught) {
      setError(formError(caught, 'Duplikat institusi belum dapat diselesaikan.'))
    } finally {
      setBusy(false)
    }
  }

  const draft = editing && editing !== 'new' ? editing : null

  return <section className={dataStyles.page}>
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}><p className="kicker">Data master</p><h2>Institusi</h2><p>Kelola data institusi, moderasi pengajuan, dan selesaikan duplikat.</p></div>
      <button type="button" className={`button button-primary ${dataStyles.pageAction}`} onClick={() => openEditor('new')}><Plus aria-hidden="true" size={16} />Tambah institusi</button>
    </header>

    <section className={`${dataStyles.surface} ${dataStyles.masterSurface}`}>
      <div className={dataStyles.surfaceHeader}><div className={dataStyles.surfaceHeaderCopy}><h3>Daftar institusi</h3><p>{total} institusi</p></div></div>
      <div className={dataStyles.toolbar}>
        <label className={dataStyles.searchField}>Cari institusi<span className={dataStyles.searchControl}><Search aria-hidden="true" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Nama institusi" /></span></label>
        <label className={dataStyles.filterField}>Tipe<select value={type} onChange={event => { setType(event.target.value); setPage(0) }}><option value="">Semua tipe</option>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label className={dataStyles.filterField}>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}><option value="">Semua status</option>{statuses.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label className={dataStyles.filterField}>Per halaman<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5, 10, 20].map(size => <option value={size} key={size}>{size}</option>)}</select></label>
      </div>

      {!editing && !merging && error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
      {message ? <p className={`${dataStyles.feedback} ${dataStyles.successFeedback}`} role="status">{message}</p> : null}

      <div className={dataStyles.tableScroll}>
        <table className={`${dataStyles.table} ${dataStyles.institutionTable} ${dataStyles.compactMasterTable}`}>
          <colgroup><col /><col className={dataStyles.institutionTypeColumn} /><col className={dataStyles.institutionLocationColumn} /><col className={dataStyles.institutionStatusColumn} /><col className={dataStyles.institutionSourceColumn} /><col className={dataStyles.institutionActionColumn} /></colgroup>
          <thead><tr><SortableTableHeader label="Institusi" sortKey="name" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Tipe" sortKey="type" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Lokasi" sortKey="location" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Sumber" sortKey="source" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th className={dataStyles.masterActionCell}>Aksi</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={6}><div className={dataStyles.empty}>Memuat institusi…</div></td></tr> : records.length === 0 ? <tr><td colSpan={6}><div className={dataStyles.empty}>Institusi tidak ditemukan.</div></td></tr> : records.map(record => <tr key={record.id}>
            <td><span className={dataStyles.primaryName}>{record.name}</span></td>
            <td>{types.find(item => item.value === record.type)?.label}</td>
            <td>{[record.city, record.province].filter(Boolean).join(', ') || '—'}</td>
            <td><span className={`${dataStyles.badge} ${statusClass(record.approval_status)}`}>{statusLabel(record.approval_status)}</span></td>
            <td>{displayLabel(record.source)}</td>
            <td className={dataStyles.masterActionCell}><div className={dataStyles.masterActionGroup}>
              <button type="button" className={`button button-outline ${dataStyles.actionButton}`} disabled={busy} onClick={() => openEditor(record)}><Pencil aria-hidden="true" size={14} />Ubah</button>
              {record.approval_status === 'pending' ? <><button type="button" className={`button button-outline ${dataStyles.actionButton} ${dataStyles.positiveAction}`} disabled={busy} onClick={() => void moderate(record, 'approved')}><Check aria-hidden="true" size={14} />Setujui</button><button type="button" className={`button button-outline ${dataStyles.actionButton} ${dataStyles.dangerAction}`} disabled={busy} onClick={() => void moderate(record, 'rejected')}><XCircle aria-hidden="true" size={14} />Tolak</button></> : null}
              {record.approval_status !== 'archived' ? <button type="button" className={`button button-outline ${dataStyles.actionButton} ${dataStyles.warningAction}`} disabled={busy} onClick={() => void moderate(record, 'archived')}><Archive aria-hidden="true" size={14} />Arsipkan</button> : null}
              <button type="button" className={`button button-outline ${dataStyles.actionButton}`} disabled={busy} onClick={() => openMerge(record)}><Copy aria-hidden="true" size={14} />Duplikat</button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      <TablePagination page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} disabled={loading || busy} label="Paginasi institusi" />
    </section>

    <dialog ref={editorDialogRef} className={dataStyles.dialog} onClose={() => setEditing(null)} onCancel={event => { event.preventDefault(); closeEditor() }} aria-labelledby="institution-editor-title">
      <form key={draft?.id || 'new'} className={dataStyles.dialogPanel} onSubmit={save}>
        <header className={dataStyles.dialogHeader}><div><p className="kicker">Data master</p><h2 id="institution-editor-title">{draft ? 'Ubah institusi' : 'Tambah institusi'}</h2></div><button type="button" className={dataStyles.closeButton} onClick={closeEditor} aria-label="Tutup dialog"><X aria-hidden="true" size={18} /></button></header>
        <div className={dataStyles.dialogBody}>
          {error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
          <div className={dataStyles.formGrid}>
            <label className={`${dataStyles.field} ${dataStyles.fullField}`}>Nama<input name="name" autoFocus required minLength={2} maxLength={250} defaultValue={draft?.name || ''} /></label>
            <label className={dataStyles.field}>Tipe<select name="type" defaultValue={draft?.type || 'university'}>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label className={dataStyles.field}>Status institusi<input name="institution_status" maxLength={100} defaultValue={draft?.institution_status || ''} placeholder="Negeri / Swasta" /></label>
            <label className={dataStyles.field}>Provinsi<input name="province" maxLength={150} defaultValue={draft?.province || ''} /></label>
            <label className={dataStyles.field}>Kota/Kabupaten<input name="city" maxLength={150} defaultValue={draft?.city || ''} /></label>
          </div>
        </div>
        <footer className={dataStyles.dialogFooter}><button className="button button-outline" type="button" onClick={closeEditor} disabled={busy}>Batal</button><button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></footer>
      </form>
    </dialog>

    <dialog ref={mergeDialogRef} className={dataStyles.dialog} onClose={closeMerge} onCancel={event => { event.preventDefault(); closeMerge() }} aria-labelledby="institution-merge-title">
      <div className={dataStyles.dialogPanel}>
        <header className={dataStyles.dialogHeader}><div><p className="kicker">Resolusi duplikat</p><h2 id="institution-merge-title">Selesaikan duplikat</h2></div><button type="button" className={dataStyles.closeButton} onClick={closeMerge} aria-label="Tutup dialog"><X aria-hidden="true" size={18} /></button></header>
        <div className={dataStyles.dialogBody}>
          <p className={dataStyles.dialogHint}>Pilih institusi tujuan yang telah disetujui. Referensi peserta dipindahkan ke tujuan, lalu institusi asal diarsipkan.</p>
          {error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
          <label className={`${dataStyles.field} ${dataStyles.fullField}`}>Cari institusi tujuan<input autoFocus value={mergeQuery} onChange={event => { setMergeQuery(event.target.value); setMergeTarget(null) }} placeholder="Ketik minimal 2 karakter" /></label>
          <div className={dataStyles.resultList}>{mergeResults.map(item => <button type="button" className={dataStyles.resultOption} key={item.id} onClick={() => setMergeTarget(item)} data-selected={mergeTarget?.id === item.id}><strong>{item.name}</strong><small>{types.find(typeItem => typeItem.value === item.type)?.label} · {item.city || 'Lokasi tidak tersedia'} · {item.external_id || item.id}</small></button>)}</div>
          {merging && mergeTarget ? <p className={dataStyles.mergeSummary}><strong>{merging.name}</strong> → <strong>{mergeTarget.name}</strong><br />Semua referensi peserta akan dipindahkan ke institusi tujuan.</p> : null}
        </div>
        <footer className={dataStyles.dialogFooter}><button type="button" className="button button-outline" onClick={closeMerge} disabled={busy}>Batal</button><button type="button" className="button button-primary" disabled={busy || !mergeTarget} onClick={() => void merge()}>{busy ? 'Menggabungkan…' : 'Konfirmasi penggabungan'}</button></footer>
      </div>
    </dialog>
  </section>
}
