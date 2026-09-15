'use client'

import { Eye, RefreshCw, Search, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { formError } from '@/lib/auth/errors'
import { displayLabel } from '@/lib/labels'
import { createClient } from '@/lib/supabase/client'
import dataStyles from './data-management.module.css'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'

const PAGE_SIZE = 25
const DATE = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })

type MenteeSortKey = 'name' | 'email' | 'whatsapp' | 'institution' | 'created_at'
type MenteeRow = {
  total_count: number
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  username: string | null
  whatsapp_number: string | null
  registration_method: string
  created_at: string
  institution_name: string | null
  institution_type: string | null
  institution_city: string | null
  institution_province: string | null
  major_or_faculty: string | null
  cohort_year: number | null
  referral_source_name: string | null
  referral_other_text: string | null
  other_interest_text: string | null
  onboarding_step: number
  onboarding_completed_at: string | null
  interests: string[]
}
type RpcError = { message: string }
type RpcClient = { rpc<T>(name: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }> }

function menteeName(row: MenteeRow) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ') || row.username || row.email || row.user_id
}

function institutionLabel(row: MenteeRow) {
  if (!row.institution_name) return 'Belum diisi'
  const location = [row.institution_city, row.institution_province].filter(Boolean).join(', ')
  return location ? `${row.institution_name} · ${location}` : row.institution_name
}

export function MenteeManagement() {
  const supabase = useMemo(() => createClient(), [])
  const rpcClient = useMemo(() => supabase as unknown as RpcClient, [supabase])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [people, setPeople] = useState<MenteeRow[]>([])
  const [totalPeople, setTotalPeople] = useState(0)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<MenteeSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<MenteeRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: loadError } = await rpcClient.rpc<MenteeRow[]>('list_admin_mentees_page', {
        p_query: query.trim(),
        p_sort_key: sortKey ?? 'created_at',
        p_sort_direction: sortDirection ?? 'desc',
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      })
      if (loadError) throw loadError
      const rows = data ?? []
      const nextTotal = Number(rows[0]?.total_count ?? 0)
      const lastPage = Math.max(0, Math.ceil(nextTotal / PAGE_SIZE) - 1)
      if (page > lastPage) {
        setPage(lastPage)
        return
      }
      setPeople(rows)
      setTotalPeople(nextTotal)
    } catch (caught) {
      setError(formError(caught, 'Daftar mentee belum dapat dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [page, query, rpcClient, sortDirection, sortKey])

  useEffect(() => {
    const timer = setTimeout(() => { void load() }, 250)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selected && !dialog.open) dialog.showModal()
    if (!selected && dialog.open) dialog.close()
  }, [selected])

  function changeSort(key: string | null, direction: SortDirection) {
    setSortKey(key as MenteeSortKey | null)
    setSortDirection(direction)
    setPage(0)
  }

  return <section className={dataStyles.page} data-testid="participant-management">
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>
        <p className="kicker">Pengguna · mentee</p>
        <h2>Mentee</h2>
        <p>Cari akun mentee, lihat kontak, dan buka detail onboarding tanpa memberi akses edit kepada admin.</p>
      </div>
      <span className={dataStyles.countPill}><UsersRound aria-hidden="true" />{totalPeople} mentee</span>
    </header>

    <div className={dataStyles.surface}>
      <div className={dataStyles.surfaceHeader}>
        <div className={dataStyles.surfaceHeaderCopy}>
          <p className="kicker">Akun mentee</p>
          <h3>Daftar mentee</h3>
          <p>Email berasal dari Auth; profil, WhatsApp, dan data onboarding tetap dibaca dari source of truth masing-masing.</p>
        </div>
      </div>

      <div className={dataStyles.toolbar} data-testid="participant-management-toolbar">
        <label className={dataStyles.searchField}>Cari mentee
          <span className={dataStyles.searchControl}><Search aria-hidden="true" /><input
            type="search"
            value={query}
            onChange={event => { setQuery(event.target.value); setPage(0) }}
            placeholder="Nama, username, email, WhatsApp, atau institusi"
          /></span>
        </label>
      </div>

      {error && <p role="alert" className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`}>{error}</p>}
      {loading && <p role="status">Memuat akun…</p>}
      {!loading && !error && people.length === 0 && <div className={dataStyles.empty}>Tidak ada mentee yang sesuai dengan pencarian.</div>}

      {!loading && people.length > 0 && <div className={dataStyles.tableScroll} data-testid="participant-table-scroll">
        <table className={`${dataStyles.table} ${dataStyles.peopleTable}`} data-testid="participant-table">
          <thead><tr>
            <SortableTableHeader label="Mentee" sortKey="name" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} />
            <SortableTableHeader label="Email" sortKey="email" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} />
            <SortableTableHeader label="WhatsApp" sortKey="whatsapp" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} />
            <SortableTableHeader label="Institusi" sortKey="institution" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} />
            <SortableTableHeader label="Bergabung" sortKey="created_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} />
            <th scope="col" className={dataStyles.actionCell}>Aksi</th>
          </tr></thead>
          <tbody>{people.map(person => {
            const name = menteeName(person)
            return <tr key={person.user_id}>
              <td><div className={dataStyles.identity}><span className={dataStyles.avatar}>{name.slice(0, 2).toUpperCase()}</span><div className={dataStyles.identityText}><strong className={dataStyles.primaryText}>{name}</strong><span className={dataStyles.secondaryText}>@{person.username || 'belum-diatur'}</span></div></div></td>
              <td><span className={dataStyles.secondaryText}>{person.email || '—'}</span></td>
              <td><span className={dataStyles.secondaryText}>{person.whatsapp_number || 'Belum diisi'}</span></td>
              <td><span className={dataStyles.descriptionText}>{institutionLabel(person)}</span></td>
              <td><time className={dataStyles.dateCell} dateTime={person.created_at}>{DATE.format(new Date(person.created_at))}</time></td>
              <td className={dataStyles.actionCell}><button type="button" className="ops-icon-button" onClick={() => setSelected(person)} aria-label={`Lihat detail ${name}`} title="Lihat detail"><Eye aria-hidden="true" size={16} /></button></td>
            </tr>
          })}</tbody>
        </table>
      </div>}

      <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={totalPeople} onPageChange={setPage} disabled={loading} label="Pagination mentee" />
      <div className={dataStyles.pagination}><button type="button" className={`text-link ${dataStyles.reload}`} onClick={() => void load()} disabled={loading}><RefreshCw size={14} aria-hidden="true" />Muat ulang</button></div>
    </div>

    <dialog ref={dialogRef} className="ops-dialog mentee-detail-dialog" aria-labelledby="mentee-detail-title" onClose={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}>
      {selected ? <div className="ops-dialog__surface">
        <header className="ops-dialog__header"><div><p className="kicker">Detail mentee · read-only</p><h2 id="mentee-detail-title">{menteeName(selected)}</h2><p>@{selected.username || 'belum-diatur'} · {selected.email}</p></div><button type="button" className="ops-icon-button" onClick={() => dialogRef.current?.close()} aria-label="Tutup detail mentee"><X aria-hidden="true" /></button></header>
        <div className="ops-detail-grid">
          <div><span>Email</span><strong>{selected.email || '—'}</strong></div>
          <div><span>WhatsApp</span><strong>{selected.whatsapp_number || 'Belum diisi'}</strong></div>
          <div><span>Metode registrasi</span><strong>{displayLabel(selected.registration_method)}</strong></div>
          <div><span>Bergabung</span><strong>{DATE.format(new Date(selected.created_at))}</strong></div>
          <div><span>Status onboarding</span><strong>{selected.onboarding_completed_at ? 'Selesai' : `Langkah ${selected.onboarding_step} dari 4`}</strong></div>
          <div><span>Institusi</span><strong>{selected.institution_name || 'Belum diisi'}</strong></div>
          <div><span>Jurusan / fakultas</span><strong>{selected.major_or_faculty || 'Belum diisi'}</strong></div>
          <div><span>Angkatan</span><strong>{selected.cohort_year ?? 'Belum diisi'}</strong></div>
        </div>
        <section className="ops-dialog__section"><h3>Institusi</h3><p>{institutionLabel(selected)}{selected.institution_type ? ` · ${displayLabel(selected.institution_type)}` : ''}</p></section>
        <section className="ops-dialog__section"><h3>Sumber informasi</h3><p>{selected.referral_source_name || selected.referral_other_text || 'Belum diisi'}</p></section>
        <section className="ops-dialog__section"><h3>Minat kompetisi</h3><p>{selected.interests.length ? selected.interests.join(', ') : 'Belum ada minat yang dipilih.'}</p>{selected.other_interest_text ? <p className="muted">Lainnya: {selected.other_interest_text}</p> : null}</section>
      </div> : null}
    </dialog>
  </section>
}
