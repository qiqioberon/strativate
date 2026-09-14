'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { validatePrivateMentoringPackageDraft } from '@/lib/private-mentoring/admin'
import { createClient } from '@/lib/supabase/client'

type ProgramRow = { id: string; title: string; short_description: string; kicker: string; detail: string; audience: string; is_active: boolean }
type TierRow = { id: string; name: string; code: string }
type PackageRow = { id: string; mentor_tier_id: string; session_count: number; price_amount: number; reference_price_amount: number | null; duration_minutes: number; max_participants: number; sort_order: number; is_active: boolean }
type EditorialTable = 'private_mentoring_highlights' | 'private_mentoring_journey_steps' | 'private_mentoring_learning_paths' | 'private_mentoring_session_focuses' | 'competition_categories'
type EditorialRow = { id: string; table: EditorialTable; label: string; description: string; sortOrder: number; isActive: boolean }

export function PrivateMentoringManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [program, setProgram] = useState<ProgramRow | null>(null)
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [editorial, setEditorial] = useState<EditorialRow[]>([])
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const [programResult, tierResult, packageResult, highlightResult, journeyResult, pathResult, focusResult, categoryResult] = await Promise.all([
      supabase.from('private_mentoring_programs').select('*').eq('slug', 'private-mentoring').maybeSingle(),
      supabase.from('mentor_tiers').select('id,name,code').order('sort_order'),
      supabase.from('private_mentoring_packages').select('*').order('sort_order').order('id'),
      supabase.from('private_mentoring_highlights').select('*').order('sort_order'),
      supabase.from('private_mentoring_journey_steps').select('*').order('sort_order'),
      supabase.from('private_mentoring_learning_paths').select('*').order('sort_order'),
      supabase.from('private_mentoring_session_focuses').select('*').order('sort_order'),
      supabase.from('competition_categories').select('*').order('sort_order'),
    ])
    const error = [programResult, tierResult, packageResult, highlightResult, journeyResult, pathResult, focusResult, categoryResult].find(result => result.error)?.error
    if (error) { setMessage('Data Private Mentoring belum dapat dimuat. Pastikan migrasi Phase 3 sudah diterapkan.'); return }
    setProgram(programResult.data as ProgramRow | null)
    setTiers((tierResult.data ?? []) as TierRow[])
    setPackages((packageResult.data ?? []) as PackageRow[])
    setEditorial([
      ...(highlightResult.data ?? []).map(row => ({ id: row.id, table: 'private_mentoring_highlights' as const, label: row.text, description: '', sortOrder: row.sort_order, isActive: row.is_active })),
      ...(journeyResult.data ?? []).map(row => ({ id: row.id, table: 'private_mentoring_journey_steps' as const, label: row.title, description: row.description, sortOrder: row.sort_order, isActive: row.is_active })),
      ...(pathResult.data ?? []).map(row => ({ id: row.id, table: 'private_mentoring_learning_paths' as const, label: row.name, description: row.description, sortOrder: row.sort_order, isActive: row.is_active })),
      ...(focusResult.data ?? []).map(row => ({ id: row.id, table: 'private_mentoring_session_focuses' as const, label: row.name, description: row.description, sortOrder: row.sort_order, isActive: row.is_active })),
      ...(categoryResult.data ?? []).map(row => ({ id: row.id, table: 'competition_categories' as const, label: row.name, description: '', sortOrder: row.sort_order, isActive: row.is_active })),
    ])
  }, [supabase])

  useEffect(() => { void load() }, [load])
  const tierName = (id: string) => tiers.find(tier => tier.id === id)?.name ?? id
  const updatePackage = (id: string, patch: Partial<PackageRow>) => setPackages(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row))
  const updateEditorial = (id: string, patch: Partial<EditorialRow>) => setEditorial(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row))

  async function saveProgram() {
    if (!program) return
    const { error } = await supabase.from('private_mentoring_programs').update({ title: program.title, short_description: program.short_description, kicker: program.kicker, detail: program.detail, audience: program.audience, is_active: program.is_active }).eq('id', program.id)
    setMessage(error ? error.message : 'Informasi program tersimpan.')
  }

  async function savePackage(row: PackageRow) {
    const validation = validatePrivateMentoringPackageDraft({ priceAmount: Number(row.price_amount), referencePriceAmount: row.reference_price_amount === null ? null : Number(row.reference_price_amount), durationMinutes: Number(row.duration_minutes), maxParticipants: Number(row.max_participants), sortOrder: Number(row.sort_order) })
    if (validation) { setMessage(validation); return }
    const { error } = await supabase.from('private_mentoring_packages').update({ price_amount: Number(row.price_amount), reference_price_amount: row.reference_price_amount === null ? null : Number(row.reference_price_amount), duration_minutes: Number(row.duration_minutes), max_participants: Number(row.max_participants), sort_order: Number(row.sort_order), is_active: row.is_active }).eq('id', row.id)
    setMessage(error ? error.message : `${tierName(row.mentor_tier_id)} · ${row.session_count} sesi tersimpan.`)
  }

  async function saveEditorial(row: EditorialRow) {
    const common = { sort_order: Number(row.sortOrder), is_active: row.isActive }
    let error: { message: string } | null = null
    if (row.table === 'private_mentoring_highlights') ({ error } = await supabase.from('private_mentoring_highlights').update({ ...common, text: row.label }).eq('id', row.id))
    else if (row.table === 'private_mentoring_journey_steps') ({ error } = await supabase.from('private_mentoring_journey_steps').update({ ...common, title: row.label, description: row.description }).eq('id', row.id))
    else if (row.table === 'private_mentoring_learning_paths') ({ error } = await supabase.from('private_mentoring_learning_paths').update({ ...common, name: row.label, description: row.description }).eq('id', row.id))
    else if (row.table === 'private_mentoring_session_focuses') ({ error } = await supabase.from('private_mentoring_session_focuses').update({ ...common, name: row.label, description: row.description }).eq('id', row.id))
    else ({ error } = await supabase.from('competition_categories').update({ ...common, name: row.label }).eq('id', row.id))
    setMessage(error ? error.message : 'Konten tersimpan.')
  }

  return <>
    <div className="role-page-title"><p className="kicker">Produk · domain Private Mentoring</p><h2>Private Mentoring</h2><p>Kelola copy publik, taxonomy, dan harga paket. Tier serta jumlah sesi adalah identitas paket dan tidak dapat diubah.</p></div>
    {program ? <section className="role-card"><p className="kicker">Informasi publik</p><label className="form-label">Judul<input value={program.title} onChange={event => setProgram({ ...program, title: event.target.value })} /></label><label className="form-label">Deskripsi singkat<textarea value={program.short_description} onChange={event => setProgram({ ...program, short_description: event.target.value })} /></label><label className="form-label">Kicker<input value={program.kicker} onChange={event => setProgram({ ...program, kicker: event.target.value })} /></label><label className="form-label">Detail<textarea value={program.detail} onChange={event => setProgram({ ...program, detail: event.target.value })} /></label><label className="form-label">Audiens<textarea value={program.audience} onChange={event => setProgram({ ...program, audience: event.target.value })} /></label><label><input type="checkbox" checked={program.is_active} onChange={event => setProgram({ ...program, is_active: event.target.checked })} /> Program aktif</label><div className="button-row"><button className="button button-primary" onClick={saveProgram}>Simpan informasi</button></div></section> : null}
    <section className="role-card"><p className="kicker">Taxonomy &amp; content</p>{editorial.map(row => <div className="unassigned-row" key={`${row.table}-${row.id}`}><div style={{ flex: 1 }}><small>{row.table.replaceAll('_', ' ')}</small><input value={row.label} onChange={event => updateEditorial(row.id, { label: event.target.value })} />{row.description !== '' ? <textarea value={row.description} onChange={event => updateEditorial(row.id, { description: event.target.value })} /> : null}</div><label>Urutan<input type="number" min="0" value={row.sortOrder} onChange={event => updateEditorial(row.id, { sortOrder: Number(event.target.value) })} /></label><label><input type="checkbox" checked={row.isActive} onChange={event => updateEditorial(row.id, { isActive: event.target.checked })} /> Aktif</label><button className="text-link" onClick={() => saveEditorial(row)}>Simpan</button></div>)}</section>
    <section className="role-card"><p className="kicker">Paket &amp; harga</p>{packages.map(row => <div className="unassigned-row" key={row.id}><div><strong>{tierName(row.mentor_tier_id)} · {row.session_count} sesi</strong><small>Tier dan jumlah sesi terkunci</small></div><label>Harga<input type="number" min="1" value={row.price_amount} onChange={event => updatePackage(row.id, { price_amount: Number(event.target.value) })} /></label><label>Harga referensi<input type="number" min="0" value={row.reference_price_amount ?? ''} onChange={event => updatePackage(row.id, { reference_price_amount: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Durasi<input type="number" min="1" value={row.duration_minutes} onChange={event => updatePackage(row.id, { duration_minutes: Number(event.target.value) })} /></label><label>Maks. peserta<input type="number" min="1" value={row.max_participants} onChange={event => updatePackage(row.id, { max_participants: Number(event.target.value) })} /></label><label><input type="checkbox" checked={row.is_active} onChange={event => updatePackage(row.id, { is_active: event.target.checked })} /> Aktif</label><button className="text-link" onClick={() => savePackage(row)}>Simpan</button></div>)}</section>
    {message ? <p className="muted" role="status">{message}</p> : null}
  </>
}
