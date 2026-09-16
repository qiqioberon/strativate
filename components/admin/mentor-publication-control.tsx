'use client'

import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { formError } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import type { MentorPublicProfile } from '@/lib/supabase/database.types'

type Summary = Pick<MentorPublicProfile, 'id' | 'public_slug' | 'display_name' | 'publication_status'>

export function MentorPublicationControl({ mentorId, mentorName }: { mentorId: string; mentorName: string }) {
  const [profile, setProfile] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: loadError } = await createClient()
        .from('mentor_public_profiles')
        .select('id,public_slug,display_name,publication_status')
        .eq('mentor_user_id', mentorId)
        .maybeSingle()
      if (loadError) throw loadError
      setProfile(data)
    } catch (caught) {
      setError(formError(caught, 'Status profil publik mentor belum dapat dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [mentorId])

  useEffect(() => { void load() }, [load])

  async function createDraft() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data, error: createError } = await createClient().rpc('admin_ensure_mentor_public_profile', { p_mentor_id: mentorId })
      if (createError) throw createError
      if (!data) throw new Error('Profil publik mentor tidak dikembalikan.')
      setProfile({ id: data.id, public_slug: data.public_slug, display_name: data.display_name, publication_status: data.publication_status })
      setMessage(`Draft profil publik ${mentorName} berhasil dibuat.`)
    } catch (caught) {
      setError(formError(caught, 'Draft profil publik belum dapat dibuat.'))
    } finally {
      setBusy(false)
    }
  }

  async function setPublication(status: 'draft' | 'published') {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data, error: publicationError } = await createClient().rpc('admin_set_mentor_publication', {
        p_mentor_id: mentorId,
        p_status: status,
      })
      if (publicationError) throw publicationError
      if (!data) throw new Error('Status profil publik mentor tidak dikembalikan.')
      setProfile({ id: data.id, public_slug: data.public_slug, display_name: data.display_name, publication_status: data.publication_status })
      setMessage(`Profil publik ${mentorName} sekarang berstatus ${status === 'published' ? 'Published' : 'Draft'}.`)
    } catch (caught) {
      setError(formError(caught, 'Status publikasi belum dapat diperbarui.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mentor-account-lifecycle-actions" data-testid="mentor-publication-control">
      <div>
        <p className="kicker">Profil publik mentor</p>
        {loading ? <><h3>Memuat profil publik…</h3><p>Memeriksa profil publik akun mentor ini.</p></> : profile ? <><h3>{profile.display_name}</h3><p>Slug: <strong>{profile.public_slug}</strong> · Status: <strong>{profile.publication_status === 'published' ? 'Published' : 'Draft'}</strong></p></> : <><h3>Belum memiliki profil publik</h3><p>Buat draft untuk mulai mengelola profil publik akun mentor ini.</p></>}
      </div>
      <div className="button-row mentor-account-lifecycle-buttons">
        {profile ? <>
          <button type="button" className="button button-outline" disabled={busy || profile.publication_status === 'draft'} onClick={() => void setPublication('draft')}>Draft</button>
          <button type="button" className="button button-primary" disabled={busy || profile.publication_status === 'published'} onClick={() => void setPublication('published')}>Published</button>
          <button type="button" className="button button-outline" disabled={busy} onClick={() => void load()} aria-label="Muat ulang status profil publik"><RefreshCw aria-hidden="true" size={14} />Muat ulang</button>
        </> : !loading ? <button type="button" className="button button-primary" disabled={busy} onClick={() => void createDraft()}>{busy ? 'Membuat…' : 'Buat draft'}</button> : null}
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  )
}
