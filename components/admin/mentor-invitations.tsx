'use client'

import { RefreshCw, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { formError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import type { MentorTier } from '@/lib/supabase/database.types'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'

const statuses = { pending: 'Sedang dikirim', sent: 'Terkirim', failed: 'Gagal dikirim' } as const
const DATE_TIME = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
type InviteSortKey = 'email' | 'tier' | 'status' | 'created_at'

type InviteRow = {
  total_count: number
  email: string
  status: 'pending' | 'sent' | 'failed'
  tier_id: string | null
  tier_code: string | null
  tier_name: string | null
  created_at: string
  can_delete: boolean
}
type RpcError = { message: string }
type RpcClient = { rpc<T>(name: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }> }

export function MentorInvitations({ refreshKey, onDeleted }: { refreshKey: number; onDeleted: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const rpcClient = useMemo(() => supabase as unknown as RpcClient, [supabase])
  const [invitations, setInvitations] = useState<InviteRow[]>([])
  const [tiers, setTiers] = useState<MentorTier[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [tierId, setTierId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [sortKey, setSortKey] = useState<InviteSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadTiers = useCallback(async () => {
    const { data, error: tierError } = await supabase.from('mentor_tiers').select('*').eq('is_active', true).order('sort_order').order('name')
    if (tierError) return
    setTiers(data ?? [])
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: loadError } = await rpcClient.rpc<InviteRow[]>('list_admin_mentor_invites_page', {
      p_query: query.trim(), p_status: status, p_tier_id: tierId || null, p_from: fromDate || null, p_to: toDate || null,
      p_limit: pageSize, p_offset: page * pageSize,
    })
    if (loadError) {
      setError(formError(loadError, 'Daftar undangan belum dapat dimuat. Coba muat ulang.'))
      setLoading(false); return
    }
    const rows = data ?? []
    if (rows.length === 0 && page > 0) { setPage(value => Math.max(0, value - 1)); setLoading(false); return }
    setInvitations(rows); setTotal(Number(rows[0]?.total_count ?? 0)); setLoading(false)
  }, [fromDate, page, pageSize, query, rpcClient, status, tierId, toDate])

  useEffect(() => { void loadTiers() }, [loadTiers])
  useEffect(() => { const timer = setTimeout(() => { void load() }, 250); return () => clearTimeout(timer) }, [load, refreshKey])

  const visibleInvitations = useMemo(() => {
    if (!sortKey || !sortDirection) return invitations
    const sign = sortDirection === 'asc' ? 1 : -1
    return [...invitations].sort((a, b) => {
      if (sortKey === 'created_at') return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * sign
      const left = sortKey === 'tier' ? (a.tier_name ?? '') : sortKey === 'status' ? statuses[a.status] : a.email
      const right = sortKey === 'tier' ? (b.tier_name ?? '') : sortKey === 'status' ? statuses[b.status] : b.email
      return left.localeCompare(right, 'id-ID') * sign
    })
  }, [invitations, sortDirection, sortKey])

  function changeSort(key: string | null, direction: SortDirection) { setSortKey(key as InviteSortKey | null); setSortDirection(direction) }

  async function remove(invitation: InviteRow) {
    if (!window.confirm(`Hapus undangan untuk ${invitation.email}? Akun undangan yang belum aktif juga akan dihapus dan tautan lamanya tidak berlaku. Email ini dapat diundang kembali.`)) return
    setRemoving(invitation.email); setError(''); setMessage('')
    try {
      const { error: deleteError } = await rpcClient.rpc('delete_mentor_invite', { p_email: invitation.email })
      if (deleteError) throw deleteError
      setMessage(`Undangan untuk ${invitation.email} telah dihapus.`); await load(); onDeleted()
    } catch (deleteError) { setError(formError(deleteError, 'Undangan belum dapat dihapus. Muat ulang daftar dan coba lagi.')) } finally { setRemoving(null) }
  }

  function resetFilters() { setQuery(''); setStatus('all'); setTierId(''); setFromDate(''); setToDate(''); setPage(0) }

  return <section className="mentor-invitations" aria-label="Daftar undangan mentor">
    <div className="mentor-invitation-heading"><h3>Undangan mentor</h3><p>Kelola undangan dalam bentuk tabel, dengan filter dan pagination agar tetap rapi saat datanya bertambah.</p></div>
    <div className="ops-filter-bar mentor-invitation-filter-bar">
      <label className="ops-field ops-field--wide"><span>Cari email</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15} /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Email mentor" /></div></label>
      <label className="ops-field"><span>Status</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}><option value="all">Semua status</option><option value="pending">Sedang dikirim</option><option value="sent">Terkirim</option><option value="failed">Gagal dikirim</option></select></label>
      <label className="ops-field"><span>Tier</span><select value={tierId} onChange={event => { setTierId(event.target.value); setPage(0) }}><option value="">Semua tier</option>{tiers.map(tier => <option value={tier.id} key={tier.id}>{tier.name}</option>)}</select></label>
      <label className="ops-field"><span>Dari</span><input type="date" value={fromDate} onChange={event => { setFromDate(event.target.value); setPage(0) }} /></label>
      <label className="ops-field"><span>Sampai</span><input type="date" value={toDate} onChange={event => { setToDate(event.target.value); setPage(0) }} /></label>
      <label className="ops-field"><span>Per halaman</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
      <button type="button" className="button button-outline" onClick={resetFilters}>Reset</button>
      <button type="button" className="text-link" disabled={loading || removing !== null} onClick={() => void load()}><RefreshCw size={14} aria-hidden="true" />Muat ulang</button>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="ops-feedback ops-feedback--success">{message}</p>}
    <div className="ops-table-wrap mentor-invitation-table-wrap"><table className="ops-table mentor-invitation-table">
      <thead><tr><SortableTableHeader label="Email" sortKey="email" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Tier" sortKey="tier" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Tanggal" sortKey="created_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th>Aksi</th></tr></thead>
      <tbody>{visibleInvitations.map(invitation => <tr key={invitation.email}><td><strong>{invitation.email}</strong></td><td>{invitation.tier_name || 'Tier belum ditentukan (legacy)'}</td><td><span className={`ops-status ${invitation.status === 'sent' ? 'ops-status--positive' : invitation.status === 'failed' ? 'ops-status--danger' : 'ops-status--warning'}`}>{statuses[invitation.status]}</span></td><td>{DATE_TIME.format(new Date(invitation.created_at))}</td><td><button type="button" className="button button-outline mentor-invitation-delete-button" aria-label={`Hapus undangan ${invitation.email}`} disabled={!invitation.can_delete || removing !== null} onClick={() => void remove(invitation)}><Trash2 size={15} aria-hidden="true" />{removing === invitation.email ? 'Menghapus…' : 'Hapus'}</button></td></tr>)}{!loading && !error && invitations.length === 0 ? <tr><td colSpan={5}><p className="muted">Belum ada undangan yang cocok dengan filter.</p></td></tr> : null}</tbody>
    </table></div>
    {loading ? <p role="status" className="muted">Memuat undangan…</p> : null}
    <TablePagination page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} disabled={loading || removing !== null} label="Pagination undangan mentor" />
  </section>
}
