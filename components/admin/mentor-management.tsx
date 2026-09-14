'use client'

import { ChevronLeft, ChevronRight, Power, RefreshCw, Search, Trash2, UserRoundCheck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

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
import { MentorInviteForm } from './mentor-invite-form'
import { MentorInvitations } from './mentor-invitations'
import { MentorTierSelect } from './mentor-tier-select'

export function MentorManagement() {
  const [mentors, setMentors] = useState<ManagedMentor[]>([])
  const [tiers, setTiers] = useState<MentorTier[]>([])
  const [query, setQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [setupFilter, setSetupFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [accountAction, setAccountAction] = useState<'status' | 'delete' | null>(null)
  const [invitationRefresh, setInvitationRefresh] = useState(0)

  const loadMentors = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await createClient().rpc('list_managed_mentors', {
        p_offset: page * 25,
        p_query: query.trim(),
        p_tier_id: tierFilter || null,
        p_account_status: accountFilter,
        p_setup_status: setupFilter,
      })
      if (error) throw error
      if (!data?.length && page > 0) {
        setPage(value => value - 1)
        return
      }
      setMentors(data || [])
    } catch (error) {
      setError(formError(error, 'Daftar mentor belum dapat dimuat. Coba lagi.'))
    } finally {
      setLoading(false)
    }
  }, [accountFilter, page, query, setupFilter, tierFilter])

  const loadTiers = useCallback(async () => {
    try {
      const { data, error } = await createClient().from('mentor_tiers').select('*').eq('is_active', true).order('sort_order').order('name')
      if (error) throw error
      setTiers(data || [])
    } catch (error) {
      setError(formError(error, 'Daftar tier mentor belum dapat dimuat.'))
    }
  }, [])

  useEffect(() => { void loadTiers() }, [loadTiers])
  useEffect(() => {
    const timer = setTimeout(() => { void loadMentors() }, 250)
    return () => clearTimeout(timer)
  }, [loadMentors])

  const selectedMentor = useMemo(
    () => mentors.find(mentor => mentor.user_id === selectedId) || null,
    [mentors, selectedId],
  )

  async function invitationChanged() {
    setInvitationRefresh(value => value + 1)
    await loadMentors()
  }

  function tierSaved(mentorId: string, tierId: string) {
    const tier = tiers.find(item => item.id === tierId)
    const mentor = mentors.find(item => item.user_id === mentorId)
    setMentors(records => records.map(record => record.user_id === mentorId
      ? { ...record, tier_id: tierId, tier_code: tier?.code || null, tier_name: tier?.name || null }
      : record))
    setMessage(`Tier ${mentor ? managedMentorName(mentor) : 'mentor'} telah diperbarui.`)
    setError('')
  }

  async function setMentorActive(mentor: ManagedMentor, isActive: boolean) {
    setAccountAction('status')
    setMessage('')
    setError('')
    try {
      const { error } = await createClient().rpc('set_mentor_active', {
        p_mentor_id: mentor.user_id,
        p_is_active: isActive,
      })
      if (error) throw error
      setMentors(records => records.map(record => record.user_id === mentor.user_id
        ? { ...record, is_active: isActive }
        : record))
      setMessage(`Akun ${managedMentorName(mentor)} telah ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`)
    } catch (error) {
      setError(formError(error, 'Status akun mentor belum dapat diperbarui.'))
    } finally {
      setAccountAction(null)
    }
  }

  async function deleteMentor(mentor: ManagedMentor) {
    const name = managedMentorName(mentor)
    const confirmed = window.confirm(
      `Hapus akun mentor ${name} (${mentor.email}) secara permanen? Identitas login, profil mentor, ketersediaan, dan undangan terkait akun ini akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
    )
    if (!confirmed) return

    setAccountAction('delete')
    setMessage('')
    setError('')
    try {
      const { error } = await createClient().rpc('delete_mentor_account', {
        p_mentor_id: mentor.user_id,
      })
      if (error) throw error
      setMentors(records => records.filter(record => record.user_id !== mentor.user_id))
      setSelectedId(null)
      setInvitationRefresh(value => value + 1)
      setMessage(`Akun mentor ${name} telah dihapus permanen.`)
    } catch (error) {
      setError(formError(error, 'Akun mentor belum dapat dihapus. Tidak ada perubahan yang diklaim berhasil.'))
    } finally {
      setAccountAction(null)
    }
  }

  return <div className="mentor-management mentor-management-root">
    <header className="mentor-management-heading mentor-management-page-heading">
      <div>
        <p className="kicker">Pengguna · mentor</p>
        <h2>Manajemen Mentor</h2>
        <p>Kelola akun, tier operasional, dan ketersediaan mentor dari satu tempat.</p>
      </div>
      <span className="mentor-management-count"><UserRoundCheck aria-hidden="true" />{mentors.length} pada halaman ini</span>
    </header>

    <section className="role-card mentor-management-section mentor-management-surface" aria-labelledby="invite-mentor-heading">
      <div className="role-card-heading mentor-section-heading"><div>
        <p className="kicker">Akses mentor</p>
        <h2 id="invite-mentor-heading">Kelola akses mentor</h2>
        <p>Undang mentor baru dan pantau undangan yang masih memerlukan tindak lanjut.</p>
      </div></div>
      <div className="mentor-invite-layout">
        <div className="mentor-invite-pane">
          <div className="mentor-pane-heading">
            <h3>Undang mentor baru</h3>
            <p>Kirim undangan ke email mentor dan pilih tier yang sesuai.</p>
          </div>
          <MentorInviteForm onInvited={invitationChanged} />
        </div>
        <div className="mentor-invitations-pane">
          <MentorInvitations refreshKey={invitationRefresh} onDeleted={invitationChanged} />
        </div>
      </div>
    </section>

    <section className="role-card mentor-management-section mentor-management-surface" aria-labelledby="active-mentors-heading">
      <div className="role-card-heading"><div><p className="kicker">Akun mentor</p><h2 id="active-mentors-heading">Daftar akun mentor</h2></div></div>
      <div className="mentor-management-filters mentor-management-filter-surface">
        <label className="search-field"><Search aria-hidden="true" /><span className="sr-only">Cari mentor</span><input
          value={query}
          onChange={event => { setQuery(event.target.value); setPage(0) }}
          placeholder="Cari nama, username, atau email"
        /></label>
        <label>Tier<select value={tierFilter} onChange={event => { setTierFilter(event.target.value); setPage(0) }}>
          <option value="">Semua tier</option>
          {tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
        </select></label>
        <label>Status akun<select value={accountFilter} onChange={event => { setAccountFilter(event.target.value); setPage(0) }}>
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select></label>
        <label>Setup akun<select value={setupFilter} onChange={event => { setSetupFilter(event.target.value); setPage(0) }}>
          <option value="all">Semua setup</option>
          <option value="complete">Selesai</option>
          <option value="pending">Belum selesai</option>
        </select></label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {loading && <p role="status">Memuat akun mentor…</p>}
      {!loading && !error && mentors.length === 0 && <div className="mentor-management-empty"><UserRoundCheck aria-hidden="true" /><p>Mentor tidak ditemukan untuk filter ini.</p></div>}

      <div className="mentor-account-list mentor-account-list-surface">
        {mentors.map(mentor => {
          const name = managedMentorName(mentor)
          const account = managedMentorAccountStatus(mentor)
          const availability = managedMentorAvailability(mentor)
          const accountStatusClass = account.tone === 'active' ? 'status-pill green' : 'status-pill'
          const availabilityStatusClass = mentor.availability_configured ? 'status-pill green' : 'status-pill'
          return <article className="mentor-account-row mentor-account-row-responsive" key={mentor.user_id}>
            <div className="mentor-account-identity mentor-account-identity-responsive">
              <span className="role-avatar blue">{name.slice(0, 2).toUpperCase()}</span>
              <div><strong>{name}</strong><small>{mentor.email}</small><small>@{mentor.username || 'belum-diatur'}</small></div>
            </div>
            <MentorTierSelect
              mentorId={mentor.user_id}
              mentorName={name}
              value={mentor.tier_id}
              currentTierName={mentor.tier_name}
              tiers={tiers}
              onSaved={tierId => tierSaved(mentor.user_id, tierId)}
              onFailure={async failure => { setMessage(''); setError(failure); await loadMentors() }}
            />
            <div className="mentor-account-status mentor-account-status-block mentor-account-status--account"><span>Status akun</span><strong className={`${accountStatusClass} mentor-account-status-pill`}>{account.label}</strong></div>
            <div className="mentor-account-status mentor-account-status-block mentor-account-status--availability"><span>Ketersediaan</span><strong className={`${availabilityStatusClass} mentor-account-status-pill`}>{availability}</strong></div>
            <button type="button" className="button button-outline mentor-account-manage-button" onClick={() => setSelectedId(mentor.user_id)}>Kelola</button>
          </article>
        })}
      </div>

      <div className="button-row mentor-pagination mentor-pagination-wrap mentor-pagination-actions">
        <button type="button" className="button button-outline" disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}><ChevronLeft size={14} aria-hidden="true" />Sebelumnya</button>
        <button type="button" className="button button-outline" disabled={mentors.length < 25 || loading} onClick={() => setPage(value => value + 1)}>Berikutnya<ChevronRight size={14} aria-hidden="true" /></button>
        <button type="button" className="text-link mentor-pagination-reload" disabled={loading} onClick={() => void loadMentors()}><RefreshCw size={14} aria-hidden="true" />Muat ulang</button>
      </div>
    </section>

    {selectedMentor && <section className="role-card mentor-manage-panel mentor-manage-surface" aria-labelledby="mentor-manage-heading">
      <div className="role-card-heading">
        <div><p className="kicker">Detail mentor</p><h2 id="mentor-manage-heading">{managedMentorName(selectedMentor)}</h2></div>
        <button type="button" className="role-close mentor-manage-close" onClick={() => setSelectedId(null)} aria-label="Tutup detail mentor"><X /></button>
      </div>
      <dl className="mentor-detail-summary mentor-detail-summary-responsive">
        <div><dt>Email</dt><dd>{selectedMentor.email}</dd></div>
        <div><dt>Tier</dt><dd>{managedMentorTier(selectedMentor)}</dd></div>
        <div><dt>Zona waktu</dt><dd>{selectedMentor.timezone}</dd></div>
        <div><dt>Status akun</dt><dd>{managedMentorAccountStatus(selectedMentor).label}</dd></div>
        <div><dt>Setup akun</dt><dd>{managedMentorSetup(selectedMentor).label}</dd></div>
      </dl>

      <div className="mentor-account-lifecycle-actions">
        <div>
          <p className="kicker">Kontrol akun</p>
          <h3>{selectedMentor.is_active ? 'Akun mentor sedang aktif.' : 'Akun mentor sedang nonaktif.'}</h3>
          <p>Mentor nonaktif tetap tersimpan, tetapi tidak dapat masuk ke dashboard mentor sampai admin mengaktifkannya kembali.</p>
        </div>
        <div className="button-row mentor-account-lifecycle-buttons">
          <button
            type="button"
            className="button button-outline"
            disabled={accountAction !== null}
            onClick={() => void setMentorActive(selectedMentor, !selectedMentor.is_active)}
          ><Power size={15} aria-hidden="true" />{accountAction === 'status' ? 'Menyimpan…' : selectedMentor.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}</button>
          <button
            type="button"
            className="button button-outline mentor-delete-button"
            disabled={accountAction !== null}
            onClick={() => void deleteMentor(selectedMentor)}
          ><Trash2 size={15} aria-hidden="true" />{accountAction === 'delete' ? 'Menghapus…' : 'Hapus akun mentor'}</button>
        </div>
      </div>

      <div className="mentor-manage-availability">
        <div>
          <p className="kicker">Ketersediaan minggu ini & depan</p>
          <h3>Atur waktu operasional mentor.</h3>
          <p>Masing-masing minggu disimpan terpisah. Mengubah satu minggu tidak menghapus jadwal minggu lainnya.</p>
        </div>
        <MentorAvailabilityEditor
          key={selectedMentor.user_id}
          mentorId={selectedMentor.user_id}
          mode="admin"
          onSaved={configured => setMentors(records => records.map(record => record.user_id === selectedMentor.user_id
            ? {
              ...record,
              availability_current_week_configured: configured.current,
              availability_next_week_configured: configured.next,
              availability_configured: configured.current || configured.next,
            }
            : record))}
        />
      </div>
    </section>}
  </div>
}
