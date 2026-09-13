'use client'

import { useCallback, useEffect, useState } from 'react'

import { formError } from '@/lib/auth/errors'
import { displayName } from '@/lib/auth/rules'
import { displayLabel } from '@/lib/labels'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/database.types'

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

  return <section className="role-card admin-data-panel">
    <h2>Peserta</h2>
    {error && <p role="alert" className="form-error">{error}</p>}
    <label className="search-field">Cari pada halaman ini<input value={query} onChange={event => setQuery(event.target.value)} /></label>
    {loading ? <p role="status">Memuat akun…</p> : visiblePeople.map(person => <div className="admin-record" key={person.id}>
      <div><strong>{displayName(person)}</strong><small>@{person.username || 'belum-diatur'} · {person.id}</small><small>{new Date(person.created_at).toLocaleDateString('id-ID')}</small></div>
      <span className="status-pill">{displayLabel(person.role)}</span>
    </div>)}
    {!loading && people.length === 0 && <p>Belum ada akun pada halaman ini.</p>}
    <div className="button-row">
      <button type="button" className="button button-outline" onClick={() => setPage(value => value - 1)} disabled={page === 0 || loading}>Sebelumnya</button>
      <button type="button" className="button button-outline" onClick={() => setPage(value => value + 1)} disabled={people.length < 25 || loading}>Berikutnya</button>
      <button type="button" className="text-link" onClick={() => void load()} disabled={loading}>Muat ulang</button>
    </div>
  </section>
}
