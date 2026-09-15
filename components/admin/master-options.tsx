'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import { displayLabel } from '@/lib/labels'
import { createClient } from '@/lib/supabase/client'
import type { MasterOption } from '@/lib/supabase/database.types'
import dataStyles from './data-management.module.css'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'

type OptionSortKey = 'name' | 'sort_order' | 'status'

export function MasterOptions({ table }: { table: 'referral_sources' | 'interests' }) {
  const [options, setOptions] = useState<MasterOption[]>([])
  const [editing, setEditing] = useState<MasterOption | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<OptionSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: loadError } = await createClient().from(table).select('*').order('sort_order').order('name')
      if (loadError) throw loadError
      setOptions(data || [])
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setLoading(false)
    }
  }, [table])
  useEffect(() => { void load() }, [load])

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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = event.currentTarget, data = new FormData(form)
    const values = { name: String(data.get('name')).trim(), sort_order: Number(data.get('sort_order')), is_active: data.get('is_active') === 'on' }
    if (!values.name || !Number.isInteger(values.sort_order)) { setError('Isi nama dan urutan yang valid.'); setBusy(false); return }
    try {
      const db = createClient()
      const { error: saveError } = editing ? await db.from(table).update(values).eq('id', editing.id) : await db.from(table).insert(values)
      if (saveError) throw saveError
      setEditing(null); form.reset(); await load()
    } catch (caught) { setError(formError(caught)) } finally { setBusy(false) }
  }

  async function archive(option: MasterOption) {
    setBusy(true); setError('')
    try {
      const { error: archiveError } = await createClient().from(table).update({ is_active: !option.is_active }).eq('id', option.id)
      if (archiveError) throw archiveError
      await load()
    } catch (caught) { setError(formError(caught)) } finally { setBusy(false) }
  }

  const title = table === 'interests' ? 'Minat Kompetisi' : 'Sumber Informasi'
  return <section className="role-card admin-data-panel">
    <div className="role-card-heading"><div><p className="kicker">Data master</p><h2>{title}</h2><p>Kelola opsi dalam tabel yang dapat diurutkan tanpa mengubah source of truth.</p></div></div>
    <form key={editing?.id || 'new'} className="auth-form" onSubmit={save}><label>Nama<input name="name" required maxLength={100} defaultValue={editing?.name || ''} /></label><label>Urutan<input name="sort_order" type="number" required min={-10000} max={10000} defaultValue={editing?.sort_order ?? 0} /></label><label className="option-label"><input name="is_active" type="checkbox" defaultChecked={editing?.is_active ?? true} />Aktif</label><div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah opsi'}</button>{editing && <button className="button button-outline" type="button" onClick={() => setEditing(null)}>Batal</button>}</div></form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p role="status">Memuat opsi…</p> : <div className="ops-table-wrap"><table className="ops-table master-option-table"><thead><tr><SortableTableHeader label="Nama" sortKey="name" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Urutan" sortKey="sort_order" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th>Aksi</th></tr></thead><tbody>{sortedOptions.length ? sortedOptions.map(option => <tr key={option.id}><td><strong>{displayLabel(option.name)}</strong></td><td>{option.sort_order}</td><td><span className={`ops-status ops-status--${option.is_active ? 'positive' : 'neutral'}`}>{option.is_active ? 'Aktif' : 'Diarsipkan'}</span></td><td><div className="button-row"><button type="button" className="text-link" onClick={() => setEditing(option)} disabled={busy}>Ubah</button><button type="button" className="text-link" onClick={() => void archive(option)} disabled={busy}>{option.is_active ? 'Arsipkan' : 'Aktifkan'}</button></div></td></tr>) : <tr><td colSpan={4}>Belum ada opsi.</td></tr>}</tbody></table></div>}
  </section>
}
