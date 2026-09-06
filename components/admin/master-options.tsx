'use client'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MasterOption } from '@/lib/supabase/database.types'
import { formError } from '@/lib/auth/errors'
export function MasterOptions({ table }: { table: 'referral_sources' | 'interests' }) {
  const [options, setOptions] = useState<MasterOption[]>([]), [editing, setEditing] = useState<MasterOption | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { const { data, error } = await createClient().from(table).select('*').order('sort_order').order('name'); if (error) throw error; setOptions(data || []) }
    catch (error) { setError(formError(error)) } finally { setLoading(false) }
  }, [table])
  useEffect(() => { void load() }, [load])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = event.currentTarget, data = new FormData(form)
    const values = { name: String(data.get('name')).trim(), sort_order: Number(data.get('sort_order')), is_active: data.get('is_active') === 'on' }
    if (!values.name || !Number.isInteger(values.sort_order)) { setError('Isi nama dan urutan yang valid.'); setBusy(false); return }
    try {
      const db = createClient()
      const { error } = editing ? await db.from(table).update(values).eq('id', editing.id) : await db.from(table).insert(values)
      if (error) throw error
      setEditing(null); form.reset(); await load()
    } catch (error) { setError(formError(error)) } finally { setBusy(false) }
  }
  async function archive(option: MasterOption) {
    setBusy(true); setError('')
    try { const { error } = await createClient().from(table).update({ is_active: !option.is_active }).eq('id', option.id); if (error) throw error; await load() }
    catch (error) { setError(formError(error)) } finally { setBusy(false) }
  }
  return <section className="role-card admin-data-panel"><h2>{table === 'interests' ? 'Minat Kompetisi' : 'Sumber Referral'}</h2>
    <form key={editing?.id || 'new'} className="auth-form" onSubmit={save}><label>Nama<input name="name" required maxLength={100} defaultValue={editing?.name || ''} /></label><label>Urutan<input name="sort_order" type="number" required min={-10000} max={10000} defaultValue={editing?.sort_order ?? 0} /></label><label className="option-label"><input name="is_active" type="checkbox" defaultChecked={editing?.is_active ?? true} />Aktif</label><div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah opsi'}</button>{editing && <button className="button button-outline" type="button" onClick={() => setEditing(null)}>Batal</button>}</div></form>
    {error && <p className="form-error" role="alert">{error}</p>}{loading && <p role="status">Memuat opsi…</p>}
    {options.map(option => <div className="admin-record" key={option.id}><div><strong>{option.name}</strong><small>Urutan {option.sort_order} · {option.is_active ? 'Aktif' : 'Diarsipkan'}</small></div><div className="button-row"><button className="text-link" onClick={() => setEditing(option)} disabled={busy}>Edit</button><button className="text-link" onClick={() => archive(option)} disabled={busy}>{option.is_active ? 'Arsipkan' : 'Aktifkan'}</button></div></div>)}
  </section>
}
