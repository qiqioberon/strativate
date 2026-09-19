/* eslint-disable @typescript-eslint/no-explicit-any -- Catalog tables/RPCs are intentionally accessed through the existing ungenerated Supabase boundary. */
'use client'

import { Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { validatePrivateMentoringPackageDraft } from '@/lib/private-mentoring/admin'
import { formError } from '@/lib/auth/errors'
import { formatRupiah } from '@/lib/commerce/money'
import { createClient } from '@/lib/supabase/client'
import dataStyles from './data-management.module.css'
import styles from './mentoring-catalog-management.module.css'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'

type Tab = 'learning-paths' | 'session-topics' | 'packages'
type MasterKind = 'learning-path' | 'session-topic'
type MasterRow = { id:string; code:string; slug:string; name:string; description:string; sort_order:number; is_active:boolean }
type TierRow = { id:string; name:string; code:string }
type PackageRow = { id:string; mentor_tier_id:string; session_count:number; price_amount:number; reference_price_amount:number|null; duration_minutes:number; max_participants:number; sort_order:number; is_active:boolean }
type Editing = { kind:MasterKind; row:MasterRow|null } | { kind:'package'; row:PackageRow }

const PAGE_SIZE = 8

function compareValues(a:string|number, b:string|number, direction:SortDirection) {
  if (!direction) return 0
  const base = typeof a === 'number' && typeof b === 'number' ? a-b : String(a).localeCompare(String(b),'id-ID')
  return direction === 'asc' ? base : -base
}

export function PrivateMentoringManagement() {
  const db = useMemo(() => createClient() as any, [])
  const [tab,setTab] = useState<Tab>('learning-paths')
  const [paths,setPaths] = useState<MasterRow[]>([]), [focuses,setFocuses] = useState<MasterRow[]>([])
  const [tiers,setTiers] = useState<TierRow[]>([]), [packages,setPackages] = useState<PackageRow[]>([])
  const [query,setQuery] = useState(''), [status,setStatus] = useState('all')
  const [page,setPage] = useState(0), [sortKey,setSortKey] = useState<string|null>(null), [sortDirection,setSortDirection] = useState<SortDirection>(null)
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [error,setError] = useState(''), [message,setMessage] = useState('')
  const [editing,setEditing] = useState<Editing|null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [pathResult, focusResult, tierResult, packageResult] = await Promise.all([
        db.from('private_mentoring_learning_paths').select('*').order('sort_order').order('id'),
        db.from('private_mentoring_session_focuses').select('*').order('sort_order').order('id'),
        db.from('mentor_tiers').select('id,name,code').order('sort_order').order('id'),
        db.from('private_mentoring_packages').select('*').order('sort_order').order('id'),
      ])
      const failed = [pathResult,focusResult,tierResult,packageResult].find(result => result.error)
      if (failed?.error) throw failed.error
      setPaths(pathResult.data ?? []); setFocuses(focusResult.data ?? []); setTiers(tierResult.data ?? []); setPackages(packageResult.data ?? [])
    } catch (caught) { setError(formError(caught,'Data katalog Private Mentoring belum dapat dimuat.')) } finally { setLoading(false) }
  }, [db])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(0); setQuery(''); setStatus('all'); setSortKey(null); setSortDirection(null) }, [tab])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editing && !dialog.open) dialog.showModal()
    if (!editing && dialog.open) dialog.close()
  }, [editing])

  const tierById = useMemo(() => new Map(tiers.map(tier => [tier.id,tier.name])), [tiers])
  const tierName = (id:string) => tierById.get(id) ?? 'Tier tidak ditemukan'
  const masters = tab === 'learning-paths' ? paths : focuses
  const visibleMasters = useMemo(() => {
    if (tab === 'packages') return []
    let rows = masters.filter(row => (!query.trim() || `${row.name} ${row.description}`.toLowerCase().includes(query.trim().toLowerCase())) && (status === 'all' || row.is_active === (status === 'active')))
    if (sortKey && sortDirection) rows = [...rows].sort((a,b) => compareValues(sortKey === 'name' ? a.name : sortKey === 'status' ? Number(a.is_active) : a.sort_order, sortKey === 'name' ? b.name : sortKey === 'status' ? Number(b.is_active) : b.sort_order, sortDirection))
    return rows
  }, [masters,query,sortDirection,sortKey,status,tab])
  const visiblePackages = useMemo(() => {
    let rows = packages.filter(row => (!query.trim() || `${tierById.get(row.mentor_tier_id) ?? ''} ${row.session_count}`.toLowerCase().includes(query.trim().toLowerCase())) && (status === 'all' || row.is_active === (status === 'active')))
    if (sortKey && sortDirection) rows = [...rows].sort((a,b) => {
      const value = (row:PackageRow) => sortKey === 'tier' ? (tierById.get(row.mentor_tier_id) ?? '') : sortKey === 'sessions' ? row.session_count : sortKey === 'price' ? row.price_amount : sortKey === 'status' ? Number(row.is_active) : row.sort_order
      return compareValues(value(a),value(b),sortDirection)
    })
    return rows
  }, [packages,query,sortDirection,sortKey,status,tierById])
  const source = tab === 'packages' ? visiblePackages : visibleMasters
  const total = source.length
  const pageRows = source.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE)

  function changeSort(key:string|null,direction:SortDirection){setSortKey(key);setSortDirection(direction);setPage(0)}
  function openCreate(){setEditing({kind:tab === 'learning-paths' ? 'learning-path' : 'session-topic',row:null})}

  async function saveMaster(event:FormEvent<HTMLFormElement>, kind:MasterKind, row:MasterRow|null) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = new FormData(event.currentTarget)
    const args = { p_id: row?.id ?? null, p_name:String(form.get('name')||'').trim(), p_description:String(form.get('description')||'').trim(), p_sort_order:Number(form.get('sort_order')), p_is_active:form.get('is_active') === 'on' }
    try {
      const fn = kind === 'learning-path' ? 'admin_upsert_private_mentoring_learning_path' : 'admin_upsert_private_mentoring_session_focus'
      const { error:saveError } = await db.rpc(fn,args)
      if (saveError) throw saveError
      setEditing(null); setMessage(`${kind === 'learning-path' ? 'Learning Path' : 'Session Topic'} tersimpan.`); await load()
    } catch (caught) { setError(formError(caught,'Data belum dapat disimpan.')) } finally { setBusy(false) }
  }

  async function savePackage(event:FormEvent<HTMLFormElement>, row:PackageRow) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = new FormData(event.currentTarget)
    const draft = {
      priceAmount:Number(form.get('price_amount')),
      referencePriceAmount:String(form.get('reference_price_amount')||'') === '' ? null : Number(form.get('reference_price_amount')),
      durationMinutes:Number(form.get('duration_minutes')),
      maxParticipants:Number(form.get('max_participants')),
      sortOrder:Number(form.get('sort_order')),
    }
    const validation = validatePrivateMentoringPackageDraft(draft)
    if (validation) { setError(validation); setBusy(false); return }
    try {
      const { error:saveError } = await db.from('private_mentoring_packages').update({ price_amount:draft.priceAmount,reference_price_amount:draft.referencePriceAmount,duration_minutes:draft.durationMinutes,max_participants:draft.maxParticipants,sort_order:draft.sortOrder,is_active:form.get('is_active') === 'on' }).eq('id',row.id)
      if (saveError) throw saveError
      setEditing(null); setMessage('Paket Private Mentoring tersimpan.'); await load()
    } catch (caught) { setError(formError(caught,'Paket belum dapat disimpan.')) } finally { setBusy(false) }
  }

  async function removeMaster(kind:MasterKind,row:MasterRow) {
    if (!window.confirm(`Hapus ${row.name}? Data yang sudah dipakai secara historis tidak akan dihapus.`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      const table = kind === 'learning-path' ? 'private_mentoring_learning_paths' : 'private_mentoring_session_focuses'
      const { data,error:deleteError } = await db.rpc('admin_delete_mentoring_master',{p_table:table,p_id:row.id})
      if (deleteError) throw deleteError
      if (data === 'deactivate_required') setMessage(`${row.name} sudah dipakai oleh data mentoring. Nonaktifkan melalui Kelola agar histori tetap aman.`)
      else if (data === 'deleted') setMessage(`${row.name} dihapus.`)
      else setMessage('Data sudah tidak ditemukan.')
      await load()
    } catch (caught) { setError(formError(caught,'Data belum dapat dihapus.')) } finally { setBusy(false) }
  }

  const masterTitle = tab === 'learning-paths' ? 'Learning Paths' : 'Session Topics'
  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.headerCopy}><p className="kicker">Produk · Private Mentoring</p><h2>Private Mentoring Catalog</h2><p>Kelola jalur belajar, topik sesi, dan paket komersial tanpa mengubah copy editorial website.</p></div></header>
    <div className={styles.tabs} role="tablist" aria-label="Private Mentoring catalog sections">
      {([['learning-paths','Learning Paths'],['session-topics','Session Topics'],['packages','Paket & Harga']] as const).map(([id,label]) => <button type="button" role="tab" aria-selected={tab===id} className={`${styles.tab} ${tab===id?styles.tabActive:''}`} key={id} onClick={()=>setTab(id)}>{label}</button>)}
    </div>
    <section className={dataStyles.surface}>
      <div className={styles.surfaceHeading}><div><p className="kicker">{tab === 'packages' ? 'Paket & harga' : masterTitle}</p><h3>{tab === 'packages' ? 'Daftar paket Private Mentoring' : `Kelola ${masterTitle}`}</h3><p>{tab === 'packages' ? 'Bandingkan harga dan buka detail untuk mengubah data paket.' : 'Cari, urutkan, tambah, ubah, nonaktifkan, atau hapus record yang belum dipakai.'}</p></div>{tab !== 'packages' ? <button type="button" className="button button-primary" onClick={openCreate}><Plus size={15} aria-hidden="true"/>Tambah {tab === 'learning-paths' ? 'Learning Path' : 'Session Topic'}</button> : null}</div>
      <div className={dataStyles.toolbar}><label className={dataStyles.searchField}>Cari<span className={dataStyles.searchControl}><Search aria-hidden="true"/><input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(0)}} placeholder={tab==='packages'?'Cari tier atau jumlah sesi':'Cari nama atau deskripsi'}/></span></label><label className={dataStyles.filterField}>Status<select value={status} onChange={event=>{setStatus(event.target.value);setPage(0)}}><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label></div>
      {error ? <p className={`${styles.feedback} ${styles.error}`} role="alert">{error}</p> : null}{message ? <p className={`${styles.feedback} ${styles.success}`} role="status">{message}</p> : null}
      <div className={dataStyles.tableScroll}><table className={`${dataStyles.table} ${tab==='packages'?dataStyles.productTable:''}`}>
        {tab === 'packages' ? <><thead><tr><SortableTableHeader label="Mentor Tier" sortKey="tier" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Sesi" sortKey="sessions" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Harga" sortKey="price" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><th>Harga Referensi</th><th>Durasi</th><th>Maks. Peserta</th><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><th className={dataStyles.actionCell}>Aksi</th></tr></thead><tbody>{loading?<tr><td colSpan={8}>Memuat paket…</td></tr>:pageRows.length===0?<tr><td colSpan={8}>Paket tidak ditemukan.</td></tr>:(pageRows as PackageRow[]).map(row=><tr key={row.id}><td><strong>{tierName(row.mentor_tier_id)}</strong></td><td>{row.session_count}</td><td className={styles.price}>{formatRupiah(row.price_amount)}</td><td>{row.reference_price_amount?formatRupiah(row.reference_price_amount):'—'}</td><td>{row.duration_minutes} menit</td><td>{row.max_participants}</td><td><span className={row.is_active?styles.statusActive:styles.statusInactive}>{row.is_active?'Aktif':'Nonaktif'}</span></td><td className={dataStyles.actionCell}><button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={()=>setEditing({kind:'package',row})}><Pencil size={14} aria-hidden="true"/>Kelola</button></td></tr>)}</tbody></> : <><thead><tr><SortableTableHeader label="Nama" sortKey="name" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><th>Deskripsi</th><SortableTableHeader label="Urutan" sortKey="sort" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/><th className={dataStyles.actionCell}>Aksi</th></tr></thead><tbody>{loading?<tr><td colSpan={5}>Memuat data…</td></tr>:pageRows.length===0?<tr><td colSpan={5}>Data tidak ditemukan.</td></tr>:(pageRows as MasterRow[]).map(row=>{const kind:MasterKind=tab==='learning-paths'?'learning-path':'session-topic';return <tr key={row.id}><td><strong>{row.name}</strong></td><td><span className={styles.description}>{row.description}</span></td><td>{row.sort_order}</td><td><span className={row.is_active?styles.statusActive:styles.statusInactive}>{row.is_active?'Aktif':'Nonaktif'}</span></td><td className={dataStyles.actionCell}><div className={styles.actions}><button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={()=>setEditing({kind,row})}><Pencil size={14} aria-hidden="true"/>Kelola</button><button type="button" className={`button button-outline ${dataStyles.actionButton} ${styles.danger}`} disabled={busy} onClick={()=>void removeMaster(kind,row)}><Trash2 size={14} aria-hidden="true"/>Hapus</button></div></td></tr>})}</tbody></>}
      </table></div>
      <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setPage} disabled={loading||busy} label={`Pagination ${tab}`}/>
    </section>

    <dialog ref={dialogRef} className={styles.dialog} onClose={()=>setEditing(null)} onClick={event=>{if(event.target===event.currentTarget) event.currentTarget.close()}}>
      {editing ? <div className={styles.dialogPanel}><header className={styles.dialogHeader}><div><p className="kicker">{editing.kind === 'package' ? 'Paket Private Mentoring' : editing.kind === 'learning-path' ? 'Learning Path' : 'Session Topic'}</p><h2>{editing.kind === 'package' ? `${tierName(editing.row.mentor_tier_id)} · ${editing.row.session_count} sesi` : editing.row ? `Edit ${editing.row.name}` : `Tambah ${editing.kind === 'learning-path' ? 'Learning Path' : 'Session Topic'}`}</h2></div><button type="button" className={styles.close} onClick={()=>dialogRef.current?.close()} aria-label="Tutup dialog"><X size={17}/></button></header>
        {editing.kind === 'package' ? <form className={styles.dialogBody} onSubmit={event=>void savePackage(event,editing.row)}><div className={styles.formGrid}><label className={styles.field}>Mentor Tier<input value={tierName(editing.row.mentor_tier_id)} readOnly/></label><label className={styles.field}>Jumlah sesi<input value={editing.row.session_count} readOnly/></label><label className={styles.field}>Harga<input name="price_amount" type="number" min="1" required defaultValue={editing.row.price_amount}/></label><label className={styles.field}>Harga referensi<input name="reference_price_amount" type="number" min="0" defaultValue={editing.row.reference_price_amount??''}/></label><label className={styles.field}>Durasi (menit)<input name="duration_minutes" type="number" min="1" required defaultValue={editing.row.duration_minutes}/></label><label className={styles.field}>Maks. peserta<input name="max_participants" type="number" min="1" required defaultValue={editing.row.max_participants}/></label><label className={styles.field}>Urutan<input name="sort_order" type="number" min="0" required defaultValue={editing.row.sort_order}/></label><label className={`${styles.field} ${styles.checkbox}`}><input name="is_active" type="checkbox" defaultChecked={editing.row.is_active}/> Aktif</label></div><div className={styles.actions}><button type="button" className="button button-outline" onClick={()=>dialogRef.current?.close()}>Batal</button><button className="button button-primary" disabled={busy}>Simpan</button></div></form> : <form className={styles.dialogBody} onSubmit={event=>void saveMaster(event,editing.kind,editing.row)}><div className={styles.formGrid}><label className={`${styles.field} ${styles.full}`}>Nama<input name="name" required maxLength={160} defaultValue={editing.row?.name??''}/></label><label className={`${styles.field} ${styles.full}`}>Deskripsi<textarea name="description" required maxLength={3000} defaultValue={editing.row?.description??''}/></label><label className={styles.field}>Urutan<input name="sort_order" type="number" min="0" required defaultValue={editing.row?.sort_order??0}/></label><label className={`${styles.field} ${styles.checkbox}`}><input name="is_active" type="checkbox" defaultChecked={editing.row?.is_active??true}/> Aktif</label></div><div className={styles.actions}><button type="button" className="button button-outline" onClick={()=>dialogRef.current?.close()}>Batal</button><button className="button button-primary" disabled={busy}>Simpan</button></div></form>}
      </div> : null}
    </dialog>
  </div>
}
