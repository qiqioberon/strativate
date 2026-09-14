'use client'

import { Search, UserRoundCheck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { MentorAvailabilityEditor } from '@/components/mentor/availability-editor'
import { formError } from '@/lib/auth/errors'
import { managedMentorName, managedMentorSetup, managedMentorTier } from '@/lib/mentor/admin'
import { createClient } from '@/lib/supabase/client'
import type { ManagedMentor, MentorTier } from '@/lib/supabase/database.types'
import { MentorInviteForm } from './mentor-invite-form'
import { MentorInvitations } from './mentor-invitations'
import { MentorTierSelect } from './mentor-tier-select'
import styles from './mentor-management.module.css'

export function MentorManagement() {
  const [mentors, setMentors] = useState<ManagedMentor[]>([])
  const [tiers, setTiers] = useState<MentorTier[]>([])
  const [query, setQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [setupFilter, setSetupFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [invitationRefresh, setInvitationRefresh] = useState(0)

  const loadMentors = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await createClient().rpc('list_managed_mentors', {
        p_offset: page * 25,
        p_query: query.trim(),
        p_tier_id: tierFilter || null,
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
  }, [page, query, setupFilter, tierFilter])

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

  return <div className={`mentor-management ${styles.root}`}>
    <header className={`mentor-management-heading ${styles.heading}`}>
      <div>
        <p className="kicker">Pengguna · mentor</p>
        <h2>Mentor Management</h2>
        <p>Kelola akun, tier operasional, dan ketersediaan mentor dari satu tempat.</p>
      </div>
      <span className="mentor-management-count"><UserRoundCheck aria-hidden="true" />{mentors.length} pada halaman ini</span>
    </header>

    <section className={`role-card mentor-management-section ${styles.section}`} aria-labelledby="invite-mentor-heading">
      <div className="role-card-heading"><div><p className="kicker">Akses mentor</p><h2 id="invite-mentor-heading">Invite Mentor</h2></div></div>
      <div className={styles.inviteLayout}>
        <div className={styles.inviteFormPane}>
          <MentorInviteForm onInvited={invitationChanged} />
        </div>
        <div className={styles.invitationPane}>
          <MentorInvitations refreshKey={invitationRefresh} onDeleted={invitationChanged} />
        </div>
      </div>
    </section>

    <section className={`role-card mentor-management-section ${styles.section}`} aria-labelledby="active-mentors-heading">
      <div className="role-card-heading"><div><p className="kicker">Akun mentor</p><h2 id="active-mentors-heading">Active mentor accounts</h2></div></div>
      <div className={`mentor-management-filters ${styles.filters}`}>
        <label className="search-field"><Search aria-hidden="true" /><span className="sr-only">Cari mentor</span><input
          value={query}
          onChange={event => { setQuery(event.target.value); setPage(0) }}
          placeholder="Cari nama, username, atau email"
        /></label>
        <label>Tier<select value={tierFilter} onChange={event => { setTierFilter(event.target.value); setPage(0) }}>
          <option value="">Semua tier</option>
          {tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
        </select></label>
        <label>Status akun<select value={setupFilter} onChange={event => { setSetupFilter(event.target.value); setPage(0) }}>
          <option value="all">Semua status</option>
          <option value="complete">Aktif</option>
          <option value="pending">Menunggu pengaturan akun</option>
        </select></label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {loading && <p role="status">Memuat akun mentor…</p>}
      {!loading && !error && mentors.length === 0 && <div className="mentor-management-empty"><UserRoundCheck aria-hidden="true" /><p>Mentor tidak ditemukan untuk filter ini.</p></div>}

      <div className={`mentor-account-list ${styles.accountList}`}>
        {mentors.map(mentor => {
          const name = managedMentorName(mentor)
          const setup = managedMentorSetup(mentor)
          const accountStatusClass = setup.tone === 'active' ? 'status-pill green' : 'status-pill'
          const availabilityStatusClass = mentor.availability_configured ? 'status-pill green' : 'status-pill'
          return <article className={`mentor-account-row ${styles.accountRow}`} key={mentor.user_id}>
            <div className={`mentor-account-identity ${styles.identity}`}>
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
            <div className={`mentor-account-status ${styles.statusBlock} ${styles.accountStatus}`}><span>Status akun</span><strong className={`${accountStatusClass} ${styles.statusPill}`}>{setup.label}</strong></div>
            <div className={`mentor-account-status ${styles.statusBlock} ${styles.availabilityStatus}`}><span>Ketersediaan</span><strong className={`${availabilityStatusClass} ${styles.statusPill}`}>{mentor.availability_configured ? 'Sudah diatur' : 'Belum diatur'}</strong></div>
            <button type="button" className={`button button-outline ${styles.manageButton}`} onClick={() => setSelectedId(mentor.user_id)}>Manage</button>
          </article>
        })}
      </div>

      <div className={`button-row mentor-pagination ${styles.pagination}`}>
        <button type="button" className="button button-outline" disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>Sebelumnya</button>
        <button type="button" className="button button-outline" disabled={mentors.length < 25 || loading} onClick={() => setPage(value => value + 1)}>Berikutnya</button>
        <button type="button" className="text-link" disabled={loading} onClick={() => void loadMentors()}>Muat ulang</button>
      </div>
    </section>

    {selectedMentor && <section className={`role-card mentor-manage-panel ${styles.managePanel}`} aria-labelledby="mentor-manage-heading">
      <div className="role-card-heading">
        <div><p className="kicker">Mentor detail</p><h2 id="mentor-manage-heading">{managedMentorName(selectedMentor)}</h2></div>
        <button type="button" className="role-close mentor-manage-close" onClick={() => setSelectedId(null)} aria-label="Tutup detail mentor"><X /></button>
      </div>
      <dl className={`mentor-detail-summary ${styles.detailSummary}`}>
        <div><dt>Email</dt><dd>{selectedMentor.email}</dd></div>
        <div><dt>Tier</dt><dd>{managedMentorTier(selectedMentor)}</dd></div>
        <div><dt>Zona waktu</dt><dd>{selectedMentor.timezone}</dd></div>
        <div><dt>Status akun</dt><dd>{managedMentorSetup(selectedMentor).label}</dd></div>
      </dl>
      <div className="mentor-manage-availability">
        <div>
          <p className="kicker">Ketersediaan mingguan</p>
          <h3>Atur waktu operasional mentor.</h3>
          <p>Perubahan disimpan sebagai satu jadwal utuh agar rentang lama tidak tertinggal.</p>
        </div>
        <MentorAvailabilityEditor
          key={selectedMentor.user_id}
          mentorId={selectedMentor.user_id}
          mode="admin"
          onSaved={configured => setMentors(records => records.map(record => record.user_id === selectedMentor.user_id
            ? { ...record, availability_configured: configured }
            : record))}
        />
      </div>
    </section>}
  </div>
}
