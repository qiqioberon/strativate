'use client'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Institution, InstitutionType, ApprovalStatus } from '@/lib/supabase/database.types'
import { formError } from '@/lib/auth/errors'

const types: { value: InstitutionType; label: string }[] = [{ value: 'university', label: 'Universitas' }, { value: 'sma', label: 'SMA' }, { value: 'smk', label: 'SMK' }]
export function InstitutionManagement() {
  const [records, setRecords] = useState<Institution[]>([]), [query, setQuery] = useState(''), [type, setType] = useState(''), [status, setStatus] = useState('')
  const [page, setPage] = useState(0), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [editing, setEditing] = useState<Institution | 'new' | null>(null), [merging, setMerging] = useState<Institution | null>(null)
  const [mergeQuery, setMergeQuery] = useState(''), [mergeResults, setMergeResults] = useState<Institution[]>([]), [mergeTarget, setMergeTarget] = useState<Institution | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      let request = createClient().from('institutions').select('*').order('created_at', { ascending: false }).order('id').range(page * 25, page * 25 + 24)
      if (query.trim()) request = request.ilike('normalized_name', `%${query.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[\\%_]/g, '\\$&')}%`)
      if (type) request = request.eq('type', type as InstitutionType)
      if (status) request = request.eq('approval_status', status as ApprovalStatus)
      const { data, error } = await request
      if (error) throw error
      setRecords(data || [])
    } catch (error) { setError(formError(error)) } finally { setLoading(false) }
  }, [query, type, status, page])
  useEffect(() => { const timer = setTimeout(load, 300); return () => clearTimeout(timer) }, [load])
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      if (mergeQuery.trim().length < 2) { setMergeResults([]); return }
      try {
        const { data, error } = await createClient().rpc('search_institutions', { p_query: mergeQuery })
        if (error) throw error
        if (active) setMergeResults((data || []).filter(i => i.approval_status === 'approved' && i.id !== merging?.id))
      } catch (error) { if (active) setError(formError(error)) }
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [mergeQuery, merging?.id])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    const values = { name: String(data.get('name')).trim(), type: String(data.get('type')) as InstitutionType, province: String(data.get('province') || '').trim() || null, city: String(data.get('city') || '').trim() || null, institution_status: String(data.get('institution_status') || '').trim() || null }
    try {
      const db = createClient()
      const { error } = editing && editing !== 'new' ? await db.from('institutions').update(values).eq('id', editing.id) : await db.from('institutions').insert({ ...values, source: 'admin_manual', approval_status: 'approved' })
      if (error) throw error
      setEditing(null); await load()
    } catch (error) { setError(formError(error)) } finally { setBusy(false) }
  }
  async function moderate(record: Institution, approval_status: ApprovalStatus) {
    setBusy(true); setError('')
    try {
      const { error } = await createClient().from('institutions').update({ approval_status }).eq('id', record.id)
      if (error) throw error
      await load()
    } catch (error) { setError(formError(error)) } finally { setBusy(false) }
  }
  async function merge() {
    if (!merging || !mergeTarget) return
    setBusy(true); setError('')
    try {
      const { error } = await createClient().rpc('merge_institutions', { p_from: merging.id, p_into: mergeTarget.id })
      if (error) throw error
      setMerging(null); setMergeTarget(null); setMergeQuery(''); await load()
    } catch (error) { setError(formError(error)) } finally { setBusy(false) }
  }
  const draft = editing && editing !== 'new' ? editing : null
  return <section className="role-card admin-data-panel"><div className="role-card-heading"><h2>Institusi</h2><button className="button button-primary" onClick={() => setEditing('new')}>Tambah institusi</button></div>
    <div className="table-controls"><label>Cari institusi<input value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} /></label><label>Tipe<select value={type} onChange={e => { setType(e.target.value); setPage(0) }}><option value="">Semua tipe</option>{types.map(t => <option value={t.value} key={t.value}>{t.label}</option>)}</select></label><label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}><option value="">Semua status</option>{['pending', 'approved', 'rejected', 'archived'].map(s => <option key={s}>{s}</option>)}</select></label></div>
    {editing && <form key={draft?.id || 'new'} className="auth-form editor-panel" onSubmit={save}><h3>{draft ? 'Edit institusi' : 'Institusi baru'}</h3><label>Nama<input name="name" required minLength={2} maxLength={250} defaultValue={draft?.name || ''} /></label><label>Tipe<select name="type" defaultValue={draft?.type || 'university'}>{types.map(t => <option value={t.value} key={t.value}>{t.label}</option>)}</select></label><label>Provinsi<input name="province" maxLength={150} defaultValue={draft?.province || ''} /></label><label>Kota/Kabupaten<input name="city" maxLength={150} defaultValue={draft?.city || ''} /></label><label>Status institusi<input name="institution_status" maxLength={100} defaultValue={draft?.institution_status || ''} placeholder="Negeri / Swasta" /></label><div className="button-row"><button className="button button-primary" disabled={busy}>Simpan</button><button className="button button-outline" type="button" onClick={() => setEditing(null)}>Batal</button></div></form>}
    {merging && <div className="editor-panel auth-form"><h3>Selesaikan duplikat: {merging.name}</h3><p>Pilih institusi tujuan yang benar. Referensi mentee dipindahkan ke tujuan, lalu institusi asal diarsipkan.</p><label>Cari tujuan<input value={mergeQuery} onChange={e => { setMergeQuery(e.target.value); setMergeTarget(null) }} /></label><div className="institution-results">{mergeResults.map(item => <button key={item.id} onClick={() => setMergeTarget(item)} aria-pressed={mergeTarget?.id === item.id}>{item.name}<small>{item.type} · {item.city || 'Lokasi tidak tersedia'} · {item.external_id || item.id}</small></button>)}</div>{mergeTarget && <p>Konfirmasi pemindahan <strong>{merging.name}</strong> → <strong>{mergeTarget.name}</strong> ({mergeTarget.city || mergeTarget.id}).</p>}<div className="button-row"><button className="button button-primary" disabled={busy || !mergeTarget} onClick={merge}>Konfirmasi penggabungan</button><button className="button button-outline" onClick={() => { setMerging(null); setMergeTarget(null) }}>Batal</button></div></div>}
    {error && <p className="form-error" role="alert">{error}</p>}{loading && <p role="status">Memuat institusi…</p>}
    {!loading && records.length === 0 && <p>Institusi tidak ditemukan.</p>}
    {records.map(record => <div className="admin-record" key={record.id}><div><strong>{record.name}</strong><small>{types.find(t => t.value === record.type)?.label} · {record.city || 'Lokasi belum tersedia'} · {record.approval_status}</small><small>{record.source} · {record.external_id || 'Tanpa ID eksternal'}</small>{record.submitted_by && <small>Diajukan oleh {record.submitted_by} · {new Date(record.created_at).toLocaleDateString('id-ID')}</small>}</div><div className="button-row"><button className="text-link" disabled={busy} onClick={() => setEditing(record)}>Edit</button>{record.approval_status === 'pending' && <><button className="text-link" disabled={busy} onClick={() => moderate(record, 'approved')}>Setujui</button><button className="text-link" disabled={busy} onClick={() => moderate(record, 'rejected')}>Tolak</button></>}{record.approval_status !== 'archived' && <button className="text-link" disabled={busy} onClick={() => moderate(record, 'archived')}>Arsipkan</button>}<button className="text-link" disabled={busy} onClick={() => { setMerging(record); setMergeTarget(null); setMergeQuery('') }}>Duplikat</button></div></div>)}
    <div className="button-row"><button className="button button-outline" onClick={() => setPage(p => p - 1)} disabled={page === 0 || loading}>Sebelumnya</button><button className="button button-outline" onClick={() => setPage(p => p + 1)} disabled={records.length < 25 || loading}>Berikutnya</button><button className="text-link" onClick={load} disabled={loading}>Muat ulang</button></div>
  </section>
}
