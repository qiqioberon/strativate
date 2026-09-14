'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { validatePrivateMentoringPackageDraft } from '@/lib/private-mentoring/admin'
import { createClient } from '@/lib/supabase/client'

type TierRow = { id: string; name: string; code: string }
type PackageRow = { id: string; mentor_tier_id: string; session_count: number; price_amount: number; reference_price_amount: number | null; duration_minutes: number; max_participants: number; sort_order: number; is_active: boolean }
type CatalogTable = 'private_mentoring_learning_paths' | 'private_mentoring_session_focuses' | 'competition_categories'
type CatalogRow = { id: string; table: CatalogTable; label: string; description: string; sortOrder: number; isActive: boolean }

const catalogLabels: Record<CatalogTable, string> = {
  private_mentoring_learning_paths: 'Learning Paths',
  private_mentoring_session_focuses: 'Session Topics',
  competition_categories: 'Competition Categories',
}

export function PrivateMentoringManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [catalog, setCatalog] = useState<CatalogRow[]>([])
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const [tierResult, packageResult, pathResult, focusResult, categoryResult] = await Promise.all([
      supabase.from('mentor_tiers').select('id,name,code').order('sort_order'),
      supabase.from('private_mentoring_packages').select('*').order('sort_order').order('id'),
      supabase.from('private_mentoring_learning_paths').select('*').order('sort_order').order('id'),
      supabase.from('private_mentoring_session_focuses').select('*').order('sort_order').order('id'),
      supabase.from('competition_categories').select('*').order('sort_order').order('id'),
    ])
    const error = [tierResult, packageResult, pathResult, focusResult, categoryResult].find(result => result.error)?.error
    if (error) { setMessage('Data katalog Private Mentoring belum dapat dimuat. Pastikan migrasi terbaru sudah diterapkan.'); return }
    setTiers((tierResult.data ?? []) as TierRow[])
    setPackages((packageResult.data ?? []) as PackageRow[])
    setCatalog([
      ...(pathResult.data ?? []).map(row => ({ id: row.id, table: 'private_mentoring_learning_paths' as const, label: row.name, description: row.description, sortOrder: row.sort_order, isActive: row.is_active })),
      ...(focusResult.data ?? []).map(row => ({ id: row.id, table: 'private_mentoring_session_focuses' as const, label: row.name, description: row.description, sortOrder: row.sort_order, isActive: row.is_active })),
      ...(categoryResult.data ?? []).map(row => ({ id: row.id, table: 'competition_categories' as const, label: row.name, description: '', sortOrder: row.sort_order, isActive: row.is_active })),
    ])
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const tierName = (id: string) => tiers.find(tier => tier.id === id)?.name ?? id
  const updatePackage = (id: string, patch: Partial<PackageRow>) => setPackages(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row))
  const updateCatalog = (id: string, patch: Partial<CatalogRow>) => setCatalog(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row))

  async function savePackage(row: PackageRow) {
    const validation = validatePrivateMentoringPackageDraft({
      priceAmount: Number(row.price_amount),
      referencePriceAmount: row.reference_price_amount === null ? null : Number(row.reference_price_amount),
      durationMinutes: Number(row.duration_minutes),
      maxParticipants: Number(row.max_participants),
      sortOrder: Number(row.sort_order),
    })
    if (validation) { setMessage(validation); return }
    const { error } = await supabase.from('private_mentoring_packages').update({
      price_amount: Number(row.price_amount),
      reference_price_amount: row.reference_price_amount === null ? null : Number(row.reference_price_amount),
      duration_minutes: Number(row.duration_minutes),
      max_participants: Number(row.max_participants),
      sort_order: Number(row.sort_order),
      is_active: row.is_active,
    }).eq('id', row.id)
    setMessage(error ? error.message : `${tierName(row.mentor_tier_id)} · ${row.session_count} sesi tersimpan.`)
  }

  async function saveCatalog(row: CatalogRow) {
    const common = { sort_order: Number(row.sortOrder), is_active: row.isActive }
    let error: { message: string } | null = null
    if (row.table === 'private_mentoring_learning_paths') {
      ({ error } = await supabase.from('private_mentoring_learning_paths').update({ ...common, name: row.label, description: row.description }).eq('id', row.id))
    } else if (row.table === 'private_mentoring_session_focuses') {
      ({ error } = await supabase.from('private_mentoring_session_focuses').update({ ...common, name: row.label, description: row.description }).eq('id', row.id))
    } else {
      ({ error } = await supabase.from('competition_categories').update({ ...common, name: row.label }).eq('id', row.id))
    }
    setMessage(error ? error.message : `${catalogLabels[row.table]} tersimpan.`)
  }

  return <div className="private-mentoring-admin-page">
    <div className="role-page-title">
      <p className="kicker">Produk · domain Private Mentoring</p>
      <h2>Private Mentoring Catalog</h2>
      <p>Kelola data katalog yang memengaruhi pilihan layanan dan transaksi. Copy marketing website tetap dikelola di source code.</p>
    </div>

    {(['private_mentoring_learning_paths', 'private_mentoring_session_focuses', 'competition_categories'] as CatalogTable[]).map(table => (
      <section className="role-card" key={table}>
        <p className="kicker">{catalogLabels[table]}</p>
        {catalog.filter(row => row.table === table).map(row => <div className="unassigned-row private-mentoring-catalog-row" key={row.id}>
          <div style={{ flex: 1 }}>
            <input value={row.label} aria-label={`${catalogLabels[table]} name`} onChange={event => updateCatalog(row.id, { label: event.target.value })} />
            {row.description !== '' ? <textarea value={row.description} aria-label={`${catalogLabels[table]} description`} onChange={event => updateCatalog(row.id, { description: event.target.value })} /> : null}
          </div>
          <label>Urutan<input type="number" min="0" value={row.sortOrder} onChange={event => updateCatalog(row.id, { sortOrder: Number(event.target.value) })} /></label>
          <label><input type="checkbox" checked={row.isActive} onChange={event => updateCatalog(row.id, { isActive: event.target.checked })} /> Aktif</label>
          <button className="text-link" onClick={() => saveCatalog(row)}>Simpan</button>
        </div>)}
      </section>
    ))}

    <section className="role-card">
      <p className="kicker">Paket &amp; harga</p>
      {packages.map(row => <div className="unassigned-row private-mentoring-package-row" key={row.id}>
        <div><strong>{tierName(row.mentor_tier_id)} · {row.session_count} sesi</strong><small>Tier dan jumlah sesi terkunci</small></div>
        <label>Harga<input type="number" min="1" value={row.price_amount} onChange={event => updatePackage(row.id, { price_amount: Number(event.target.value) })} /></label>
        <label>Harga referensi<input type="number" min="0" value={row.reference_price_amount ?? ''} onChange={event => updatePackage(row.id, { reference_price_amount: event.target.value === '' ? null : Number(event.target.value) })} /></label>
        <label>Durasi<input type="number" min="1" value={row.duration_minutes} onChange={event => updatePackage(row.id, { duration_minutes: Number(event.target.value) })} /></label>
        <label>Maks. peserta<input type="number" min="1" value={row.max_participants} onChange={event => updatePackage(row.id, { max_participants: Number(event.target.value) })} /></label>
        <label>Urutan<input type="number" min="0" value={row.sort_order} onChange={event => updatePackage(row.id, { sort_order: Number(event.target.value) })} /></label>
        <label><input type="checkbox" checked={row.is_active} onChange={event => updatePackage(row.id, { is_active: event.target.checked })} /> Aktif</label>
        <button className="text-link" onClick={() => savePackage(row)}>Simpan</button>
      </div>)}
    </section>

    {message ? <p className="muted" role="status">{message}</p> : null}
  </div>
}
