'use client'

import { ChevronLeft, ChevronRight, RefreshCw, Search, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { formError } from '@/lib/auth/errors'
import { displayName } from '@/lib/auth/rules'
import { displayLabel } from '@/lib/labels'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/database.types'
import dataStyles from './data-management.module.css'

export function MenteeManagement() {
  const [people, setPeople] = useState<Profile[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await createClient().from('profiles').select('*').eq('role', 'mentee').order('created_at', { ascending: false }).range(page * 25, page * 25 + 24)
      if (error) throw error
      setPeople(data || [])
    } catch (error) {
      setError(formError(error))
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { void load() }, [load])

  const visiblePeople = people.filter(person =>
    `${displayName(person)} ${person.username || ''}`.toLowerCase().includes(query.toLowerCase()),
  )

  return <section className={dataStyles.page} data-testid="participant-management">
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>
        <p className="kicker">Pengguna · peserta</p>
        <h2>Peserta</h2>
        <p>Cari dan pantau akun peserta dalam tampilan data yang lebih mudah dipindai.</p>
      </div>
      <span className={dataStyles.countPill}><UsersRound aria-hidden="true" />{people.length} pada halaman ini</span>
    </header>

    <div className={dataStyles.surface}>
      <div className={dataStyles.surfaceHeader}>
        <div className={dataStyles.surfaceHeaderCopy}>
          <p className="kicker">Akun peserta</p>
          <h3>Daftar peserta</h3>
          <p>Data berasal dari profil peserta yang tersedia pada halaman aktif.</p>
        </div>
      </div>

      <div className={dataStyles.toolbar} data-testid="participant-management-toolbar">
        <label className={dataStyles.searchField}>Cari pada halaman ini
          <span className={dataStyles.searchControl}><Search aria-hidden="true" /><input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Cari nama atau username"
          /></span>
        </label>
      </div>

      {error && <p role="alert" className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`}>{error}</p>}
      {loading && <p role="status">Memuat akun…</p>}
      {!loading && people.length === 0 && <div className={dataStyles.empty}>Belum ada akun pada halaman ini.</div>}
      {!loading && people.length > 0 && visiblePeople.length === 0 && <div className={dataStyles.empty}>Tidak ada peserta yang sesuai dengan pencarian pada halaman ini.</div>}

      {!loading && visiblePeople.length > 0 && <div className={dataStyles.tableScroll} data-testid="participant-table-scroll">
        <table className={`${dataStyles.table} ${dataStyles.peopleTable}`} data-testid="participant-table">
          <thead>
            <tr>
              <th scope="col">Peserta</th>
              <th scope="col">Username</th>
              <th scope="col">ID akun</th>
              <th scope="col">Bergabung</th>
              <th scope="col">Peran</th>
            </tr>
          </thead>
          <tbody>
            {visiblePeople.map(person => {
              const name = displayName(person)
              return <tr key={person.id}>
                <td><div className={dataStyles.identity}>
                  <span className={dataStyles.avatar}>{name.slice(0, 2).toUpperCase()}</span>
                  <div className={dataStyles.identityText}><strong className={dataStyles.primaryText}>{name}</strong></div>
                </div></td>
                <td><span className={dataStyles.secondaryText}>@{person.username || 'belum-diatur'}</span></td>
                <td><span className={dataStyles.mono} title={person.id}>{person.id}</span></td>
                <td><time className={dataStyles.dateCell} dateTime={person.created_at}>{new Date(person.created_at).toLocaleDateString('id-ID')}</time></td>
                <td><span className={`${dataStyles.badge} ${dataStyles.warningBadge}`}>{displayLabel(person.role)}</span></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>}

      <div className={dataStyles.pagination}>
        <button type="button" className="button button-outline" onClick={() => setPage(value => value - 1)} disabled={page === 0 || loading}><ChevronLeft size={14} aria-hidden="true" />Sebelumnya</button>
        <button type="button" className="button button-outline" onClick={() => setPage(value => value + 1)} disabled={people.length < 25 || loading}>Berikutnya<ChevronRight size={14} aria-hidden="true" /></button>
        <button type="button" className={`text-link ${dataStyles.reload}`} onClick={() => void load()} disabled={loading}><RefreshCw size={14} aria-hidden="true" />Muat ulang</button>
      </div>
    </div>
  </section>
}
