'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MentorInviteSummary } from '@/lib/supabase/database.types'
import { formError } from '@/lib/auth/errors'

const statuses = { pending: 'Sedang dikirim', sent: 'Terkirim', failed: 'Gagal dikirim' }

export function MentorInvitations({ refreshKey, onDeleted }: { refreshKey: number; onDeleted: () => void }) {
  const [invitations, setInvitations] = useState<MentorInviteSummary[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await createClient().rpc('list_mentor_invites', { p_offset: page * 25 })
      if (error) throw error
      if (!data?.length && page > 0) { setPage(value => value - 1); return }
      setInvitations(data || [])
    } catch (error) {
      setError(formError(error, 'Daftar undangan belum dapat dimuat. Coba muat ulang.'))
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { void load() }, [load, refreshKey])

  async function remove(invitation: MentorInviteSummary) {
    if (!window.confirm(`Hapus undangan untuk ${invitation.email}? Akun undangan yang belum aktif juga akan dihapus dan tautan lamanya tidak berlaku. Email ini dapat diundang kembali.`)) return
    setRemoving(invitation.email)
    setError('')
    setMessage('')
    try {
      const { error } = await createClient().rpc('delete_mentor_invite', { p_email: invitation.email })
      if (error) throw error
      setMessage(`Undangan untuk ${invitation.email} telah dihapus.`)
      await load()
      onDeleted()
    } catch (error) {
      setError(formError(error, 'Undangan belum dapat dihapus. Muat ulang daftar dan coba lagi.'))
    } finally { setRemoving(null) }
  }

  return <section className="mentor-invitations" aria-label="Daftar undangan mentor">
    <h3>Undangan mentor</h3>
    <p>Hapus undangan gagal atau salah email sebelum akun diaktifkan.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {loading ? <p role="status">Memuat undangan…</p> : invitations.map(invitation =>
      <div className="admin-record" key={invitation.email}>
        <div><strong className="invitation-email">{invitation.email}</strong>
          <small>{new Date(invitation.created_at).toLocaleString('id-ID')}</small>
          {!invitation.can_delete && <small>{invitation.status === 'pending' ? 'Tunggu hingga pengiriman selesai.' : 'Akun sudah aktif atau perlu diperiksa administrator.'}</small>}
        </div>
        <span className="status-pill">{statuses[invitation.status]}</span>
        <button type="button" className="button button-outline" aria-label={`Hapus undangan ${invitation.email}`}
          disabled={!invitation.can_delete || removing !== null} onClick={() => void remove(invitation)}>
          <Trash2 size={16} aria-hidden="true" />{removing === invitation.email ? 'Menghapus…' : 'Hapus'}
        </button>
      </div>)}
    {!loading && !error && invitations.length === 0 && <p>Belum ada undangan.</p>}
    <div className="button-row">
      <button type="button" className="button button-outline" disabled={page === 0 || loading || removing !== null} onClick={() => setPage(value => value - 1)}>Undangan sebelumnya</button>
      <button type="button" className="button button-outline" disabled={invitations.length < 25 || loading || removing !== null} onClick={() => setPage(value => value + 1)}>Undangan berikutnya</button>
      <button type="button" className="text-link" disabled={loading || removing !== null} onClick={() => void load()}>Muat ulang undangan</button>
    </div>
  </section>
}
