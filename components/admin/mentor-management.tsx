'use client'

import { Power, RefreshCw, Search, Trash2, UserRoundCheck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MentorAvailabilityEditor } from '@/components/mentor/availability-editor'
import { formError } from '@/lib/auth/errors'
import {
  managedMentorAccountStatus,
  managedMentorAvailability,
  managedMentorName,
  managedMentorSetup,
  managedMentorTier,
} from '@/lib/mentor/admin'
import { createClient } from '@/lib/supabase/client'
import type { ManagedMentor, MentorTier } from '@/lib/supabase/database.types'
import dataStyles from './data-management.module.css'
import mentorStyles from './mentor-management.module.css'
import { MentorInviteForm } from './mentor-invite-form'
import { MentorInvitations } from './mentor-invitations'
import { MentorTierSelect } from './mentor-tier-select'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'

const PAGE_SIZE = 25
type MentorSortKey = 'mentor' | 'tier' | 'account' | 'setup' | 'availability'

export function MentorManagement() {
  const [mentors, setMentors] = useState<ManagedMentor[]>([])
  const [totalMentors, setTotalMentors] = useState(0)
  const [tiers, setTiers] = useState<MentorTier[]>([])
  const [query, setQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [setupFilter, setSetupFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<MentorSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [accountAction, setAccountAction] = useState<'status' | 'delete' | null>(null)
  const [invitationRefresh, setInvitationRefresh] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const loadMentors = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const filters = { p_query: query.trim(), p_tier_id: tierFilter || null, p_account_status: accountFilter, p_setup_status: setupFilter }
      const [listResult, countResult] = await Promise.all([
        supabase.rpc('list_managed_mentors', { p_offset: page * PAGE_SIZE, ...filters }),
        supabase.rpc('count_managed_mentors', filters),
      ])
      if (listResult.error) throw listResult.error
      if (countResult.error) throw countResult.error
      const nextTotal = Number(countResult.data ?? 0)
      const lastPage = Math.max(0, Math.ceil(nextTotal / PAGE_SIZE) - 1)
      if (page > lastPage) { setPage(lastPage); return }
      setMentors(listResult.data || [])
      setTotalMentors(nextTotal)
    } catch (error) {
      setError(formError(error, 'Daftar mentor belum dapat dimuat. Coba lagi.'))
    } finally { setLoading(false) }
  }, [accountFilter, page, query, setupFilter, tierFilter])

  const loadTiers = useCallback(async () => {
    try {
      const { data, error } = await createClient().from('mentor_tiers').select('*').eq('is_active', true).order('sort_order').order('name')
      if (error) throw error
      setTiers(data || [])
    } catch (error) { setError(formError(error, 'Daftar tier mentor belum dapat dimuat.')) }
  }, [])

  useEffect(() => { void loadTiers() }, [loadTiers])
  useEffect(() => { const timer = setTimeout(() => { void loadMentors() }, 250); return () => clearTimeout(timer) }, [loadMentors])

  const selectedMentor = useMemo(() => mentors.find(mentor => mentor.user_id === selectedId) || null, [mentors, selectedId])
  const visibleMentors = useMemo(() => {
    if (!sortKey || !sortDirection) return mentors
    const sign = sortDirection === 'asc' ? 1 : -1
    return [...mentors].sort((a, b) => {
      const value = (mentor: ManagedMentor) => {
        if (sortKey === 'tier') return managedMentorTier(mentor)
        if (sortKey === 'account') return managedMentorAccountStatus(mentor).label
        if (sortKey === 'setup') return managedMentorSetup(mentor).label
        if (sortKey === 'availability') return managedMentorAvailability(mentor)
        return managedMentorName(mentor)
      }
      return value(a).localeCompare(value(b), 'id-ID') * sign
    })
  }, [mentors, sortDirection, sortKey])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selectedMentor && !dialog.open) dialog.showModal()
    if (!selectedMentor && dialog.open) dialog.close()
  }, [selectedMentor])

  useEffect(() => {
    if (!selectedMentor) return
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    return () => { document.body.style.overflow = previousOverflow; document.body.style.paddingRight = previousPaddingRight }
  }, [selectedMentor])

  function changeSort(key: string | null, direction: SortDirection) { setSortKey(key as MentorSortKey | null); setSortDirection(direction) }
  async function invitationChanged() { setInvitationRefresh(value => value + 1); await loadMentors() }

  function tierSaved(mentorId: string, tierId: string) {
    const tier = tiers.find(item => item.id === tierId)
    const mentor = mentors.find(item => item.user_id === mentorId)
    setMentors(records => records.map(record => record.user_id === mentorId ? { ...record, tier_id: tierId, tier_code: tier?.code || null, tier_name: tier?.name || null } : record))
    setMessage(`Tier ${mentor ? managedMentorName(mentor) : 'mentor'} telah diperbarui.`); setError('')
    if (tierFilter && tierFilter !== tierId) void loadMentors()
  }

  async function setMentorActive(mentor: ManagedMentor, isActive: boolean) {
    setAccountAction('status'); setMessage(''); setError('')
    try {
      const { error } = await createClient().rpc('set_mentor_active', { p_mentor_id: mentor.user_id, p_is_active: isActive })
      if (error) throw error
      setMentors(records => records.map(record => record.user_id === mentor.user_id ? { ...record, is_active: isActive } : record))
      setMessage(`Akun ${managedMentorName(mentor)} telah ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`)
      if (accountFilter !== 'all') await loadMentors()
    } catch (error) { setError(formError(error, 'Status akun mentor belum dapat diperbarui.')) } finally { setAccountAction(null) }
  }

  async function deleteMentor(mentor: ManagedMentor) {
    const name = managedMentorName(mentor)
    const confirmed = window.confirm(`Hapus akun mentor ${name} (${mentor.email}) secara permanen? Identitas login, profil mentor, ketersediaan, dan undangan terkait akun ini akan dihapus. Tindakan ini tidak dapat dibatalkan.`)
    if (!confirmed) return
    setAccountAction('delete'); setMessage(''); setError('')
    try {
      const { error } = await createClient().rpc('delete_mentor_account', { p_mentor_id: mentor.user_id })
      if (error) throw error
      const remainingOnPage = mentors.length - 1
      setMentors(records => records.filter(record => record.user_id !== mentor.user_id))
      setTotalMentors(value => Math.max(0, value - 1)); setSelectedId(null); setInvitationRefresh(value => value + 1)
      setMessage(`Akun mentor ${name} telah dihapus permanen.`)
      if (remainingOnPage === 0 && page > 0) setPage(value => value - 1)
    } catch (error) { setError(formError(error, 'Akun mentor belum dapat dihapus. Tidak ada perubahan yang diklaim berhasil.')) } finally { setAccountAction(null) }
  }

  return <div className={`${dataStyles.page} mentor-management mentor-management-root`}>
    <header className={dataStyles.pageHeader}><div className={dataStyles.pageHeaderCopy}><p className="kicker">Pengguna · mentor</p><h2>Manajemen Mentor</h2><p>Kelola akun, tier operasional, dan ketersediaan mentor dari satu tempat.</p></div><span className={dataStyles.countPill}><UserRoundCheck aria-hidden="true" />{totalMentors} mentor</span></header>

    <section className="role-card mentor-management-section mentor-management-surface" aria-labelledby="invite-mentor-heading">
      <div className="role-card-heading mentor-section-heading"><div><p className="kicker">Akses mentor</p><h2 id="invite-mentor-heading">Kelola akses mentor</h2><p>Undang mentor baru dan pantau undangan yang masih memerlukan tindak lanjut.</p></div></div>
      <div className="mentor-invite-layout"><div className="mentor-invite-pane"><div className="mentor-pane-heading"><h3>Undang mentor baru</h3><p>Kirim undangan ke email mentor dan pilih tier yang sesuai.</p></div><MentorInviteForm onInvited={invitationChanged} /></div><div className="mentor-invitations-pane"><MentorInvitations refreshKey={invitationRefresh} onDeleted={invitationChanged} /></div></div>
    </section>

    <section className={`${dataStyles.surface} mentor-management-section mentor-management-surface`} aria-labelledby="active-mentors-heading">
      <div className={dataStyles.surfaceHeader}><div className={dataStyles.surfaceHeaderCopy}><p className="kicker">Akun mentor</p><h3 id="active-mentors-heading">Daftar akun mentor</h3><p>Cari, saring, ubah tier, dan buka pengelolaan detail tanpa meninggalkan daftar.</p></div></div>
      <div className={dataStyles.toolbar} data-testid="mentor-management-toolbar">
        <label className={dataStyles.searchField}>Cari mentor<span className={dataStyles.searchControl}><Search aria-hidden="true" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Cari nama, username, atau email" /></span></label>
        <label className={dataStyles.filterField}>Tier<select value={tierFilter} onChange={event => { setTierFilter(event.target.value); setPage(0) }}><option value="">Semua tier</option>{tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
        <label className={dataStyles.filterField}>Status akun<select value={accountFilter} onChange={event => { setAccountFilter(event.target.value); setPage(0) }}><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
        <label className={dataStyles.filterField}>Setup akun<select value={setupFilter} onChange={event => { setSetupFilter(event.target.value); setPage(0) }}><option value="all">Semua setup</option><option value="complete">Selesai</option><option value="pending">Belum selesai</option></select></label>
      </div>
      {error && <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p>}{message && <p className={`${dataStyles.feedback} ${dataStyles.successFeedback}`} role="status">{message}</p>}{loading && <p role="status">Memuat akun mentor…</p>}{!loading && !error && mentors.length === 0 && <div className={dataStyles.empty}><p>Mentor tidak ditemukan untuk filter ini.</p></div>}

      {!loading && mentors.length > 0 && <div className={dataStyles.tableScroll} data-testid="mentor-management-table-scroll"><table className={`${dataStyles.table} ${dataStyles.mentorTable} ${mentorStyles.table}`} data-testid="mentor-management-table">
        <thead><tr><SortableTableHeader label="Mentor" sortKey="mentor" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Tier" sortKey="tier" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status akun" sortKey="account" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Setup akun" sortKey="setup" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Ketersediaan" sortKey="availability" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th scope="col" className={dataStyles.actionCell}>Aksi</th></tr></thead>
        <tbody>{visibleMentors.map(mentor => {
          const name = managedMentorName(mentor); const account = managedMentorAccountStatus(mentor); const setup = managedMentorSetup(mentor); const availability = managedMentorAvailability(mentor)
          return <tr key={mentor.user_id}>
            <td><div className={dataStyles.identity}><span className={dataStyles.avatar}>{name.slice(0, 2).toUpperCase()}</span><div className={dataStyles.identityText}><strong className={dataStyles.primaryText}>{name}</strong><span className={dataStyles.secondaryText}>{mentor.email}</span><span className={dataStyles.secondaryText}>@{mentor.username || 'belum-diatur'}</span></div></div></td>
            <td><MentorTierSelect mentorId={mentor.user_id} mentorName={name} value={mentor.tier_id} currentTierName={mentor.tier_name} tiers={tiers} onSaved={tierId => tierSaved(mentor.user_id, tierId)} onFailure={async failure => { setMessage(''); setError(failure); await loadMentors() }} /></td>
            <td><span className={`${dataStyles.badge} ${account.tone === 'active' ? dataStyles.successBadge : dataStyles.mutedBadge}`}>{account.label}</span></td><td><span className={`${dataStyles.badge} ${setup.tone === 'active' ? dataStyles.successBadge : dataStyles.warningBadge}`}>{setup.label}</span></td><td><span className={`${dataStyles.badge} ${mentor.availability_configured ? dataStyles.successBadge : dataStyles.warningBadge}`}>{availability}</span></td><td className={dataStyles.actionCell}><button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={() => setSelectedId(mentor.user_id)}>Kelola</button></td>
          </tr>
        })}</tbody>
      </table></div>}
      <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={totalMentors} onPageChange={setPage} disabled={loading} label="Pagination mentor" />
      <div className={dataStyles.pagination}><button type="button" className={`text-link ${dataStyles.reload}`} disabled={loading} onClick={() => void loadMentors()}><RefreshCw size={14} aria-hidden="true" />Muat ulang</button></div>
    </section>

    <dialog ref={dialogRef} className={mentorStyles.dialog} aria-labelledby="mentor-manage-heading" data-testid="mentor-management-dialog" onClose={() => setSelectedId(null)} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}>
      {selectedMentor ? <div className={mentorStyles.dialogPanel}>
        <header className={mentorStyles.dialogHeader}><div><p className="kicker">Detail mentor</p><h2 id="mentor-manage-heading">{managedMentorName(selectedMentor)}</h2></div><button type="button" className={`role-close mentor-manage-close ${mentorStyles.closeButton}`} onClick={() => dialogRef.current?.close()} aria-label="Tutup detail mentor" data-testid="mentor-management-dialog-close" autoFocus><X aria-hidden="true" /></button></header>
        <div className={mentorStyles.dialogBody}>
          <dl className="mentor-detail-summary mentor-detail-summary-responsive"><div><dt>Email</dt><dd>{selectedMentor.email}</dd></div><div><dt>Tier</dt><dd>{managedMentorTier(selectedMentor)}</dd></div><div><dt>Zona waktu</dt><dd>{selectedMentor.timezone}</dd></div><div><dt>Status akun</dt><dd>{managedMentorAccountStatus(selectedMentor).label}</dd></div><div><dt>Setup akun</dt><dd>{managedMentorSetup(selectedMentor).label}</dd></div></dl>
          <div className="mentor-account-lifecycle-actions"><div><p className="kicker">Kontrol akun</p><h3>{selectedMentor.is_active ? 'Akun mentor sedang aktif.' : 'Akun mentor sedang nonaktif.'}</h3><p>Mentor nonaktif tetap tersimpan, tetapi tidak dapat masuk ke dashboard mentor sampai admin mengaktifkannya kembali.</p></div><div className="button-row mentor-account-lifecycle-buttons"><button type="button" className="button button-outline" disabled={accountAction !== null} onClick={() => void setMentorActive(selectedMentor, !selectedMentor.is_active)}><Power size={15} aria-hidden="true" />{accountAction === 'status' ? 'Menyimpan…' : selectedMentor.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}</button><button type="button" className="button button-outline mentor-delete-button" disabled={accountAction !== null} onClick={() => void deleteMentor(selectedMentor)}><Trash2 size={15} aria-hidden="true" />{accountAction === 'delete' ? 'Menghapus…' : 'Hapus akun mentor'}</button></div></div>
          <div className="mentor-manage-availability"><div><p className="kicker">Ketersediaan minggu ini & depan</p><h3>Atur waktu operasional mentor.</h3><p>Masing-masing minggu disimpan terpisah. Mengubah satu minggu tidak menghapus jadwal minggu lainnya.</p></div><MentorAvailabilityEditor key={selectedMentor.user_id} mentorId={selectedMentor.user_id} mode="admin" onSaved={configured => setMentors(records => records.map(record => record.user_id === selectedMentor.user_id ? { ...record, availability_current_week_configured: configured.current, availability_next_week_configured: configured.next, availability_configured: configured.current || configured.next } : record))} /></div>
        </div>
      </div> : null}
    </dialog>
  </div>
}
