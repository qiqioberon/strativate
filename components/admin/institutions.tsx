'use client'

import { Archive, Check, Copy, Pencil, Plus, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import { formError } from '@/lib/auth/errors'
import { displayLabel } from '@/lib/labels'
import { createClient } from '@/lib/supabase/client'
import type { ApprovalStatus, Institution, InstitutionType } from '@/lib/supabase/database.types'

const types: { value: InstitutionType; label: string }[] = [{ value: 'university', label: 'Universitas' }, { value: 'sma', label: 'SMA' }, { value: 'smk', label: 'SMK' }]
type InstitutionSortKey = 'name' | 'type' | 'location' | 'status' | 'source'

export function InstitutionManagement() {
  const [records, setRecords] = useState<Institution[]>([])
  const [query, setQuery] = useState(''), [type, setType] = useState(''), [status, setStatus] = useState('')
  const [page, setPage] = useState(0), [pageSize, setPageSize] = useState(10), [total, setTotal] = useState(0)
  const [sortKey, setSortKey] = useState<InstitutionSortKey | null>(null), [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [editing, setEditing] = useState<Institution | 'new' | null>(null), [merging, setMerging] = useState<Institution | null>(null)
  const [mergeQuery, setMergeQuery] = useState(''), [mergeResults, setMergeResults] = useState<Institution[]>([]), [mergeTarget, setMergeTarget] = useState<Institution | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
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
      setRecords(data || []); setTotal(nextTotal)
    } catch (caught) { setError(formError(caught)) } finally { setLoading(false) }
  }, [page, pageSize, query, sortDirection, sortKey, status, type])

  useEffect(() => { const timer = setTimeout(() => { void load() }, 250); return () => clearTimeout(timer) }, [load])
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      if (mergeQuery.trim().length < 2) { setMergeResults([]); return }
      try {
        const { data, error: searchError } = await createClient().rpc('search_institutions', { p_query: mergeQuery })
        if (searchError) throw searchError
        if (active) setMergeResults((data || []).filter(i => i.approval_status === 'approved' && i.id !== merging?.id))
      } catch (caught) { if (active) setError(formError(caught)) }
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [mergeQuery, merging?.id])

  function changeSort(key: string | null, direction: SortDirection) {
    setSortKey(key as InstitutionSortKey | null); setSortDirection(direction); setPage(0)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    const values = { name: String(data.get('name')).trim(), type: String(data.get('type')) as InstitutionType, province: String(data.get('province') || '').trim() || null, city: String(data.get('city') || '').trim() || null, institution_status: String(data.get('institution_status') || '').trim() || null }
    try {
      const db = createClient()
      const { error: saveError } = editing && editing !== 'new' ? await db.from('institutions').update(values).eq('id', editing.id) : await db.from('institutions').insert({ ...values, source: 'admin_manual', approval_status: 'approved' })
      if (saveError) throw saveError
      setEditing(null); await load()
    } catch (caught) { setError(formError(caught)) } finally { setBusy(false) }
  }

  async function moderate(record: Institution, approval_status: ApprovalStatus) {
    setBusy(true); setError('')
    try {
      const { error: moderateError } = await createClient().from('institutions').update({ approval_status }).eq('id', record.id)
      if (moderateError) throw moderateError
      await load()
    } catch (caught) { setError(formError(caught)) } finally { setBusy(false) }
  }

  async function merge() {
    if (!merging || !mergeTarget) return
    setBusy(true); setError('')
    try {
      const { error: mergeError } = await createClient().rpc('merge_institutions', { p_from: merging.id, p_into: mergeTarget.id })
      if (mergeError) throw mergeError
      setMerging(null); setMergeTarget(null); setMergeQuery(''); await load()
    } catch (caught) { setError(formError(caught)) } finally { setBusy(false) }
  }

  const draft = editing && editing !== 'new' ? editing : null
  return <section className="role-card admin-data-panel institution-page">
    <div className="role-card-heading"><div><p className="kicker">Data master</p><h2>Institusi</h2><p>Kelola data institusi, moderasi submission, dan selesaikan duplikat.</p></div><button className="button button-primary" onClick={() => setEditing('new')}><Plus aria-hidden="true" size={16} />Tambah Institusi</button></div>
    <div className="ops-filter-bar institution-filters"><label className="ops-field ops-field--wide"><span>Cari Institusi</span><input value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Nama institusi" /></label><label className="ops-field"><span>Tipe</span><select value={type} onChange={event => { setType(event.target.value); setPage(0) }}><option value="">Semua tipe</option>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label className="ops-field"><span>Status</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}><option value="">Semua status</option>{['pending', 'approved', 'rejected', 'archived'].map(item => <option value={item} key={item}>{displayLabel(item)}</option>)}</select></label><label className="ops-field"><span>Per halaman</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5,10,20].map(size => <option value={size} key={size}>{size}</option>)}</select></label></div>

    {editing && <form key={draft?.id || 'new'} className="auth-form editor-panel institution-editor" onSubmit={save}><h3>{draft ? 'Ubah institusi' : 'Institusi baru'}</h3><div className="mentoring-form-grid"><label>Nama<input name="name" required minLength={2} maxLength={250} defaultValue={draft?.name || ''} /></label><label>Tipe<select name="type" defaultValue={draft?.type || 'university'}>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label>Provinsi<input name="province" maxLength={150} defaultValue={draft?.province || ''} /></label><label>Kota/Kabupaten<input name="city" maxLength={150} defaultValue={draft?.city || ''} /></label><label>Status institusi<input name="institution_status" maxLength={100} defaultValue={draft?.institution_status || ''} placeholder="Negeri / Swasta" /></label></div><div className="button-row"><button className="button button-primary" disabled={busy}>Simpan</button><button className="button button-outline" type="button" onClick={() => setEditing(null)}>Batal</button></div></form>}

    {merging && <div className="editor-panel auth-form institution-editor"><h3>Selesaikan duplikat: {merging.name}</h3><p>Pilih institusi tujuan yang benar. Referensi peserta dipindahkan ke tujuan, lalu institusi asal diarsipkan.</p><label>Cari tujuan<input value={mergeQuery} onChange={event => { setMergeQuery(event.target.value); setMergeTarget(null) }} /></label><div className="institution-results">{mergeResults.map(item => <button type="button" key={item.id} onClick={() => setMergeTarget(item)} aria-pressed={mergeTarget?.id === item.id}>{item.name}<small>{displayLabel(item.type)} · {item.city || 'Lokasi tidak tersedia'} · {item.external_id || item.id}</small></button>)}</div>{mergeTarget && <p>Konfirmasi pemindahan <strong>{merging.name}</strong> → <strong>{mergeTarget.name}</strong> ({mergeTarget.city || mergeTarget.id}).</p>}<div className="button-row"><button type="button" className="button button-primary" disabled={busy || !mergeTarget} onClick={() => void merge()}>Konfirmasi penggabungan</button><button type="button" className="button button-outline" onClick={() => { setMerging(null); setMergeTarget(null) }}>Batal</button></div></div>}

    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="ops-table-wrap"><table className="ops-table institution-table"><thead><tr><SortableTableHeader label="Institusi" sortKey="name" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Tipe" sortKey="type" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Lokasi" sortKey="location" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Sumber" sortKey="source" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>Memuat institusi…</td></tr> : records.length === 0 ? <tr><td colSpan={6}>Institusi tidak ditemukan.</td></tr> : records.map(record => <tr key={record.id}><td><strong>{record.name}</strong><small>{record.external_id || record.id}</small></td><td>{types.find(item => item.value === record.type)?.label}</td><td>{[record.city, record.province].filter(Boolean).join(', ') || '—'}</td><td><span className={`ops-status ops-status--${record.approval_status === 'approved' ? 'positive' : record.approval_status === 'pending' ? 'warning' : record.approval_status === 'rejected' ? 'danger' : 'neutral'}`}>{displayLabel(record.approval_status)}</span></td><td>{displayLabel(record.source)}</td><td><div className="institution-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => setEditing(record)}><Pencil aria-hidden="true" size={14} />Ubah</button>{record.approval_status === 'pending' ? <><button type="button" className="button institution-action--approve" disabled={busy} onClick={() => void moderate(record, 'approved')}><Check aria-hidden="true" size={14} />Setujui</button><button type="button" className="button institution-action--reject" disabled={busy} onClick={() => void moderate(record, 'rejected')}><XCircle aria-hidden="true" size={14} />Tolak</button></> : null}{record.approval_status !== 'archived' ? <button type="button" className="button button-outline" disabled={busy} onClick={() => void moderate(record, 'archived')}><Archive aria-hidden="true" size={14} />Arsipkan</button> : null}<button type="button" className="button button-outline" disabled={busy} onClick={() => { setMerging(record); setMergeTarget(null); setMergeQuery('') }}><Copy aria-hidden="true" size={14} />Duplikat</button></div></td></tr>)}</tbody></table></div>
    <TablePagination page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} disabled={loading} label="Pagination institusi" />
  </section>
}
