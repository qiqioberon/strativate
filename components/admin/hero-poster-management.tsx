'use client'

import Image from 'next/image'
import { ArrowDown, ArrowUp, ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import {
  HERO_POSTER_ALLOWED_TYPES,
  HERO_POSTER_BUCKET,
  HERO_POSTER_MAX_FILE_SIZE,
} from '@/lib/marketing/hero-poster-config'
import { createClient } from '@/lib/supabase/client'
import type { MarketingHeroPoster } from '@/lib/supabase/database.types'

function safeFileName(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'poster'
}

export function HeroPosterManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [posters, setPosters] = useState<MarketingHeroPoster[]>([])
  const [editing, setEditing] = useState<MarketingHeroPoster | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: loadError } = await supabase
      .from('marketing_hero_posters')
      .select('*')
      .order('sort_order')
      .order('created_at')
    if (loadError) setError(formError(loadError))
    else setPosters(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const form = event.currentTarget
    const values = new FormData(form)
    const file = values.get('image')
    const selectedFile = file instanceof File && file.size > 0 ? file : null
    let uploadedPath: string | null = null

    try {
      if (!editing && !selectedFile) throw new Error('Pilih gambar poster untuk membuat entri baru.')
      if (selectedFile && (!HERO_POSTER_ALLOWED_TYPES.has(selectedFile.type) || selectedFile.size > HERO_POSTER_MAX_FILE_SIZE)) {
        throw new Error('Gunakan gambar JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.')
      }

      if (selectedFile) {
        uploadedPath = `posters/${crypto.randomUUID()}-${safeFileName(selectedFile.name)}`
        const { error: uploadError } = await supabase.storage.from(HERO_POSTER_BUCKET).upload(uploadedPath, selectedFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
      }

      const altText = String(values.get('alt_text')).trim()
      const url = String(values.get('url')).trim()
      const sortOrder = Number(values.get('sort_order'))
      if (!altText) throw new Error('Teks alternatif wajib diisi.')
      if (url && (!url.startsWith('/') || url.startsWith('//'))) throw new Error('Tautan poster harus berupa path internal, misalnya /program.')
      if (!Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) throw new Error('Urutan poster harus berupa bilangan bulat antara -100000 dan 100000.')

      const payload = {
        image_path: uploadedPath ?? editing!.image_path,
        alt_text: altText,
        title: String(values.get('title')).trim() || null,
        url: url || null,
        sort_order: sortOrder,
        is_active: values.get('is_active') === 'on',
      }

      const result = editing
        ? await supabase.from('marketing_hero_posters').update(payload).eq('id', editing.id)
        : await supabase.from('marketing_hero_posters').insert(payload)
      if (result.error) throw result.error

      if (editing && uploadedPath && editing.image_path !== uploadedPath) {
        await supabase.storage.from(HERO_POSTER_BUCKET).remove([editing.image_path])
      }
      setEditing(null)
      form.reset()
      setNotice(editing ? 'Poster berhasil diperbarui.' : 'Poster berhasil ditambahkan.')
      await load()
    } catch (caught) {
      if (uploadedPath) await supabase.storage.from(HERO_POSTER_BUCKET).remove([uploadedPath])
      setError(formError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function remove(poster: MarketingHeroPoster) {
    if (!window.confirm(`Hapus poster “${poster.title ?? poster.alt_text}”?`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { error: rowError } = await supabase.from('marketing_hero_posters').delete().eq('id', poster.id)
      if (rowError) throw rowError
      const { error: storageError } = await supabase.storage.from(HERO_POSTER_BUCKET).remove([poster.image_path])
      if (storageError) setNotice('Poster dihapus dari daftar, tetapi berkas Storage perlu ditinjau manual.')
      else setNotice('Poster berhasil dihapus.')
      if (editing?.id === poster.id) setEditing(null)
      await load()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const destination = index + direction
    if (destination < 0 || destination >= posters.length) return
    const next = [...posters]
    ;[next[index], next[destination]] = [next[destination], next[index]]
    setBusy(true); setError(''); setNotice('')
    try {
      const { error: reorderError } = await supabase.rpc('reorder_marketing_hero_posters', { p_ids: next.map((poster) => poster.id) })
      if (reorderError) throw reorderError
      setNotice('Urutan poster diperbarui.')
      await load()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setBusy(false)
    }
  }

  const previewUrl = (path: string) => supabase.storage.from(HERO_POSTER_BUCKET).getPublicUrl(path).data.publicUrl

  return (
    <section className="hero-poster-admin" data-testid="hero-poster-admin-section">
      <div className="role-page-title">
        <p className="kicker" data-testid="hero-poster-admin-eyebrow">Konten · Beranda</p>
        <h1 data-testid="hero-poster-admin-title">Hero Posters</h1>
        <p data-testid="hero-poster-admin-description">Kelola gambar, urutan, status, dan tujuan poster carousel di halaman utama.</p>
      </div>

      <div className="hero-poster-admin__layout">
        <form className="role-card hero-poster-form" onSubmit={save} key={editing?.id ?? 'new'} data-testid="hero-poster-form">
          <div className="role-card-heading">
            <div><p className="kicker">{editing ? 'Ubah poster' : 'Poster baru'}</p><h2>{editing?.title ?? 'Tambahkan hero poster'}</h2></div>
            <ImagePlus aria-hidden="true" size={24} />
          </div>
          <label>Gambar {editing ? '(opsional untuk mengganti)' : ''}<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!editing} data-testid="hero-poster-file-input" /></label>
          <label>Teks alternatif<input name="alt_text" required maxLength={240} defaultValue={editing?.alt_text ?? ''} data-testid="hero-poster-alt-input" /></label>
          <label>Judul opsional<input name="title" maxLength={160} defaultValue={editing?.title ?? ''} data-testid="hero-poster-title-input" /></label>
          <label>Tautan internal opsional<input name="url" pattern="/(?!/).*" placeholder="/program" defaultValue={editing?.url ?? ''} data-testid="hero-poster-url-input" /></label>
          <label>Urutan<input name="sort_order" type="number" min={-100000} max={100000} step={1} required defaultValue={editing?.sort_order ?? (posters.length + 1) * 10} data-testid="hero-poster-order-input" /></label>
          <label className="option-label"><input name="is_active" type="checkbox" defaultChecked={editing?.is_active ?? true} data-testid="hero-poster-active-checkbox" />Aktif di beranda</label>
          <div className="button-row">
            <button className="button button-primary" disabled={busy} data-testid="hero-poster-save-button">{busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah poster'}</button>
            {editing ? <button type="button" className="button button-outline" onClick={() => setEditing(null)} data-testid="hero-poster-cancel-button">Batal</button> : null}
          </div>
        </form>

        <section className="role-card hero-poster-list" data-testid="hero-poster-list">
          <div className="role-card-heading">
            <div><p className="kicker">Urutan carousel</p><h2>{posters.length} poster</h2></div>
            <button type="button" className="button button-outline" onClick={() => void load()} disabled={loading} data-testid="hero-poster-refresh-button"><RefreshCw aria-hidden="true" size={15} /> Muat ulang</button>
          </div>
          {loading ? <p role="status" data-testid="hero-poster-loading-status">Memuat hero poster…</p> : null}
          {!loading && !posters.length ? <div className="empty-state" data-testid="hero-poster-empty-state"><h3>Belum ada poster.</h3><p>Beranda akan memakai komposisi brand bawaan sampai poster aktif ditambahkan.</p></div> : null}
          {posters.map((poster, index) => (
            <article className="hero-poster-row" key={poster.id} data-testid={`hero-poster-row-${poster.id}`}>
              <div className="hero-poster-row__image"><Image src={previewUrl(poster.image_path)} alt={poster.alt_text} fill sizes="120px" /></div>
              <div className="hero-poster-row__copy">
                <strong>{poster.title ?? 'Tanpa judul'}</strong>
                <span>{poster.alt_text}</span>
                <small>{poster.is_active ? 'Aktif' : 'Nonaktif'} · Urutan {poster.sort_order}</small>
              </div>
              <div className="hero-poster-row__actions">
                <button type="button" onClick={() => void move(index, -1)} disabled={busy || index === 0} aria-label="Naikkan urutan poster" data-testid={`hero-poster-${poster.id}-move-up-button`}><ArrowUp aria-hidden="true" size={15} /></button>
                <button type="button" onClick={() => void move(index, 1)} disabled={busy || index === posters.length - 1} aria-label="Turunkan urutan poster" data-testid={`hero-poster-${poster.id}-move-down-button`}><ArrowDown aria-hidden="true" size={15} /></button>
                <button type="button" onClick={() => setEditing(poster)} disabled={busy} data-testid={`hero-poster-${poster.id}-edit-button`}>Ubah</button>
                <button type="button" onClick={() => void remove(poster)} disabled={busy} aria-label="Hapus poster" data-testid={`hero-poster-${poster.id}-delete-button`}><Trash2 aria-hidden="true" size={15} /></button>
              </div>
            </article>
          ))}
        </section>
      </div>
      {error ? <p className="form-error" role="alert" data-testid="hero-poster-error-message">{error}</p> : null}
      {notice ? <p className="form-success" role="status" data-testid="hero-poster-success-message">{notice}</p> : null}
    </section>
  )
}
