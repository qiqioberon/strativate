'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowDown, ArrowUp, ArrowUpRight, CircleAlert, Eye, ImagePlus, Images, Pencil, RefreshCw, Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import {
  buildHeroPosterPayload,
  getHeroPosterSummary,
  getNextHeroPosterSortOrder,
  isHeroPosterSetupRequired,
  moveHeroPosterIdToPosition,
  reorderHeroPosterIds,
  safeHeroPosterFileName,
  validateHeroPosterDraft,
  type HeroPosterDraftErrors,
} from '@/lib/marketing/hero-poster-admin'
import { HERO_POSTER_BUCKET } from '@/lib/marketing/hero-poster-config'
import { createClient } from '@/lib/supabase/client'
import type { MarketingHeroPoster } from '@/lib/supabase/database.types'

const migrationName = '202609120001_marketing_hero_posters.sql'

export function HeroPosterManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [posters, setPosters] = useState<MarketingHeroPoster[]>([])
  const [editing, setEditing] = useState<MarketingHeroPoster | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<HeroPosterDraftErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const busy = busyAction !== null
  const summary = useMemo(() => getHeroPosterSummary(posters), [posters])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)
    const { data, error: loadError } = await supabase
      .from('marketing_hero_posters')
      .select('*')
      .order('sort_order')
      .order('created_at')

    if (loadError) {
      setPosters([])
      if (isHeroPosterSetupRequired(loadError)) {
        setSetupRequired(true)
      } else {
        setLoadFailed(true)
        setError(formError(loadError, 'Hero poster belum dapat dimuat. Periksa koneksi lalu coba lagi.'))
      }
    } else {
      setPosters(data ?? [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(selectedFile)
    setLocalPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

  function resetEditor() {
    setEditing(null)
    setSelectedFile(null)
    setFieldErrors({})
  }

  function beginEditing(poster: MarketingHeroPoster) {
    setEditing(poster)
    setSelectedFile(null)
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  async function reorderEditedPoster(posterId: string, position: number) {
    const ids = moveHeroPosterIdToPosition(posters, posterId, position)
    if (ids.every((id, index) => id === posters[index]?.id)) return null
    const { error: reorderError } = await supabase.rpc('reorder_marketing_hero_posters', { p_ids: ids })
    return reorderError
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    const altText = String(values.get('alt_text'))
    const url = String(values.get('url'))
    const position = editing ? String(values.get('position')) : undefined
    const validation = validateHeroPosterDraft({
      altText,
      url,
      position,
      posterCount: editing ? posters.length : undefined,
      file: selectedFile,
      hasStoredImage: Boolean(editing?.image_path),
    })
    setFieldErrors(validation)
    setError('')
    setNotice('')
    if (Object.keys(validation).length > 0) return

    const wasEditing = Boolean(editing)
    const requestedPosition = editing && position !== undefined ? Number(position) : null
    setBusyAction('save')
    let uploadedPath: string | null = null

    try {
      if (selectedFile) {
        uploadedPath = `posters/${crypto.randomUUID()}-${safeHeroPosterFileName(selectedFile.name)}`
        const { error: uploadError } = await supabase.storage.from(HERO_POSTER_BUCKET).upload(uploadedPath, selectedFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
      }

      const payload = buildHeroPosterPayload({
        imagePath: uploadedPath,
        storedImagePath: editing?.image_path ?? null,
        altText,
        title: String(values.get('title')),
        url,
        isActive: values.get('is_active') === 'on',
      })
      const result = editing
        ? await supabase.from('marketing_hero_posters').update(payload).eq('id', editing.id)
        : await supabase.from('marketing_hero_posters').insert({ ...payload, sort_order: getNextHeroPosterSortOrder(posters) })
      if (result.error) throw result.error

      let cleanupWarning = ''
      let orderingWarning = ''
      if (editing && requestedPosition !== null) {
        const reorderError = await reorderEditedPoster(editing.id, requestedPosition)
        if (reorderError) orderingWarning = ' Konten tersimpan, tetapi posisi belum diperbarui. Muat ulang lalu coba atur posisi lagi.'
      }
      if (editing && uploadedPath && editing.image_path !== uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from(HERO_POSTER_BUCKET).remove([editing.image_path])
        if (cleanupError) cleanupWarning = ' Poster lama masih perlu ditinjau dan dihapus manual dari Storage.'
      }

      resetEditor()
      form.reset()
      setNotice(`${wasEditing ? 'Poster berhasil diperbarui.' : 'Poster berhasil ditambahkan.'}${orderingWarning}${cleanupWarning}`)
      await load()
    } catch (caught) {
      let cleanupWarning = ''
      if (uploadedPath) {
        const { data: persisted, error: reconciliationError } = await supabase
          .from('marketing_hero_posters')
          .select('id,image_path')
          .eq('image_path', uploadedPath)
          .maybeSingle()

        if (persisted) {
          let orderingWarning = ''
          if (editing && requestedPosition !== null) {
            const reorderError = await reorderEditedPoster(editing.id, requestedPosition)
            if (reorderError) orderingWarning = ' Konten tersimpan, tetapi posisi belum diperbarui. Muat ulang lalu coba atur posisi lagi.'
          }
          if (editing && editing.image_path !== uploadedPath) {
            const { error: cleanupError } = await supabase.storage.from(HERO_POSTER_BUCKET).remove([editing.image_path])
            if (cleanupError) cleanupWarning = ' Poster lama masih perlu ditinjau dan dihapus manual dari Storage.'
          }
          resetEditor()
          form.reset()
          setNotice(`${wasEditing ? 'Poster berhasil diperbarui.' : 'Poster berhasil ditambahkan.'}${orderingWarning}${cleanupWarning}`)
          await load()
          return
        }

        if (reconciliationError) {
          cleanupWarning = ' Berkas baru tidak dihapus otomatis karena status penyimpanan database belum dapat dipastikan. Tinjau daftar poster dan Storage sebelum mencoba lagi.'
        } else {
          const { error: cleanupError } = await supabase.storage.from(HERO_POSTER_BUCKET).remove([uploadedPath])
          if (cleanupError) cleanupWarning = ' Berkas baru juga perlu ditinjau manual di Storage.'
        }
      }
      setError(`${formError(caught)}${cleanupWarning}`)
    } finally {
      setBusyAction(null)
    }
  }

  async function remove(poster: MarketingHeroPoster) {
    const name = poster.title ?? poster.alt_text
    if (busy || !window.confirm(`Hapus poster “${name}”? Poster akan hilang dari beranda dan berkas Storage akan dihapus.`)) return
    setBusyAction(`delete-${poster.id}`)
    setError('')
    setNotice('')
    try {
      const { error: rowError } = await supabase.from('marketing_hero_posters').delete().eq('id', poster.id)
      if (rowError) throw rowError

      let orderingWarning = ''
      const remainingIds = posters.filter(item => item.id !== poster.id).map(item => item.id)
      if (remainingIds.length) {
        const { error: reorderError } = await supabase.rpc('reorder_marketing_hero_posters', { p_ids: remainingIds })
        if (reorderError) orderingWarning = ' Urutan poster yang tersisa belum dapat dinormalisasi; coba muat ulang.'
      }

      const { error: storageError } = await supabase.storage.from(HERO_POSTER_BUCKET).remove([poster.image_path])
      if (storageError) setNotice(`Poster dihapus dari daftar, tetapi berkas Storage perlu ditinjau manual.${orderingWarning}`)
      else setNotice(`Poster berhasil dihapus.${orderingWarning}`)
      if (editing?.id === poster.id) resetEditor()
      await load()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setBusyAction(null)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (busy) return
    const ids = reorderHeroPosterIds(posters, index, direction)
    if (ids.every((id, position) => id === posters[position]?.id)) return
    setBusyAction(`move-${posters[index].id}`)
    setError('')
    setNotice('')
    try {
      const { error: reorderError } = await supabase.rpc('reorder_marketing_hero_posters', { p_ids: ids })
      if (reorderError) throw reorderError
      setNotice('Urutan poster diperbarui dan akan digunakan di beranda.')
      await load()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setBusyAction(null)
    }
  }

  async function toggleActive(poster: MarketingHeroPoster) {
    if (busy) return
    setBusyAction(`toggle-${poster.id}`)
    setError('')
    setNotice('')
    try {
      const { error: updateError } = await supabase.from('marketing_hero_posters').update({ is_active: !poster.is_active }).eq('id', poster.id)
      if (updateError) throw updateError
      setNotice(poster.is_active ? 'Poster dinonaktifkan dari beranda.' : 'Poster diaktifkan di beranda.')
      await load()
    } catch (caught) {
      await load()
      setError(formError(caught))
    } finally {
      setBusyAction(null)
    }
  }

  const previewUrl = useCallback((path: string) => supabase.storage.from(HERO_POSTER_BUCKET).getPublicUrl(path).data.publicUrl, [supabase])
  const storedPreviewUrl = editing ? previewUrl(editing.image_path) : null
  const editorPreviewUrl = localPreviewUrl ?? storedPreviewUrl
  const editorPreviewSource = localPreviewUrl ? 'local' : storedPreviewUrl ? 'stored' : 'empty'
  const editingPosition = editing ? posters.findIndex(poster => poster.id === editing.id) + 1 : null

  return (
    <section className="hero-poster-admin" data-testid="hero-poster-admin-section" aria-busy={busy || loading}>
      <header className="hero-poster-admin__heading">
        <div className="role-page-title">
          <p className="kicker" data-testid="hero-poster-admin-eyebrow">Konten · Beranda</p>
          <h1 data-testid="hero-poster-admin-title">Hero Posters</h1>
          <p data-testid="hero-poster-admin-description">Kelola gambar, urutan, status, dan tujuan poster carousel di halaman utama.</p>
        </div>
        <Link className="button button-outline hero-poster-admin__home-link" href="/" target="_blank" rel="noreferrer">
          <Eye aria-hidden="true" size={16} /> Lihat beranda <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </header>

      {loading ? <div className="role-card hero-poster-loading" role="status" data-testid="hero-poster-loading-status"><RefreshCw aria-hidden="true" /> Memuat hero poster…</div> : null}

      {!loading && setupRequired ? (
        <section className="role-card hero-poster-setup" role="alert" data-testid="hero-poster-setup-required">
          <CircleAlert aria-hidden="true" />
          <div>
            <span className="hero-poster-status hero-poster-status--warning">Setup database diperlukan</span>
            <h2>Hero Poster belum aktif di database.</h2>
            <p>Migration <code>{migrationName}</code> perlu diterapkan pada project Supabase yang digunakan deployment ini. Sementara itu, homepage tetap menggunakan fallback brand dengan aman.</p>
          </div>
          <button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" size={15} /> Coba lagi</button>
        </section>
      ) : null}

      {!loading && loadFailed ? (
        <section className="role-card hero-poster-load-error" role="alert" data-testid="hero-poster-error-message">
          <CircleAlert aria-hidden="true" />
          <div>
            <span className="hero-poster-status hero-poster-status--danger">Gagal memuat</span>
            <h2>Hero poster belum dapat dimuat.</h2>
            <p>{error}</p>
          </div>
          <button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" size={15} /> Coba lagi</button>
        </section>
      ) : null}

      {!loading && !setupRequired && !loadFailed ? <>
        <section className={`role-card hero-poster-summary hero-poster-summary--${summary.tone}`} aria-labelledby="hero-poster-summary-heading">
          <div className="hero-poster-summary__lead">
            <span className={`hero-poster-status hero-poster-status--${summary.tone}`}>Status carousel</span>
            <h2 id="hero-poster-summary-heading">{summary.label}</h2>
            <p>{summary.message}</p>
          </div>
          <dl className="hero-poster-summary__counts">
            <div><dt>Total poster</dt><dd data-testid="hero-poster-total-count">{summary.total}</dd></div>
            <div><dt>Aktif</dt><dd data-testid="hero-poster-active-count">{summary.active}</dd></div>
            <div><dt>Nonaktif</dt><dd data-testid="hero-poster-inactive-count">{summary.inactive}</dd></div>
          </dl>
        </section>

        <div className="hero-poster-admin__layout">
          <form className="role-card hero-poster-form" onSubmit={save} key={editing?.id ?? 'new'} noValidate data-testid="hero-poster-form" aria-busy={busyAction === 'save'}>
            <div className="role-card-heading">
              <div>
                <p className="kicker">{editing ? 'Ubah poster' : 'Poster baru'}</p>
                <h2>{editing?.title ?? 'Tambahkan hero poster'}</h2>
                {editing
                  ? <p className="hero-poster-form__editing">Sedang mengedit {editing.title ?? editing.alt_text}</p>
                  : <p className="hero-poster-form__editing">Poster baru otomatis ditempatkan di posisi terakhir.</p>}
              </div>
              <ImagePlus aria-hidden="true" size={24} />
            </div>

            <div className="hero-poster-form__field">
              <label htmlFor="hero-poster-image">Gambar <span>{editing ? 'Opsional untuk mengganti' : 'Wajib'}</span></label>
              <input id="hero-poster-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!editing} onChange={event => setSelectedFile(event.target.files?.[0] ?? null)} aria-invalid={Boolean(fieldErrors.file)} aria-describedby={`hero-poster-image-help${fieldErrors.file ? ' hero-poster-image-error' : ''}`} data-testid="hero-poster-file-input" />
              <small id="hero-poster-image-help">JPG, PNG, atau WebP. Maksimal 5 MB.</small>
              {fieldErrors.file ? <p id="hero-poster-image-error" className="hero-poster-field-error">{fieldErrors.file}</p> : null}
            </div>

            <section className="hero-poster-preview" data-testid="hero-poster-preview" data-preview-source={editorPreviewSource} aria-label="Preview poster">
              <div className="hero-poster-preview__canvas">
                {editorPreviewUrl ? <Image src={editorPreviewUrl} alt={editing?.alt_text || 'Preview poster baru'} fill sizes="(max-width: 800px) 90vw, 420px" unoptimized={Boolean(localPreviewUrl)} /> : <div className="hero-poster-preview__empty"><Images aria-hidden="true" /><span>Pilih gambar untuk melihat preview.</span></div>}
              </div>
              <p>Poster akan ditampilkan dengan mode contain agar seluruh desain tetap terlihat.</p>
            </section>

            <PosterField id="hero-poster-alt" label="Teks alternatif" requirement="Wajib" help="Jelaskan isi atau tujuan visual untuk pengguna pembaca layar." error={fieldErrors.altText}>
              <input id="hero-poster-alt" name="alt_text" required maxLength={240} defaultValue={editing?.alt_text ?? ''} aria-invalid={Boolean(fieldErrors.altText)} aria-describedby={`hero-poster-alt-help${fieldErrors.altText ? ' hero-poster-alt-error' : ''}`} data-testid="hero-poster-alt-input" />
            </PosterField>
            <PosterField id="hero-poster-title" label="Judul" requirement="Opsional" help="Ditampilkan sebagai caption poster di beranda.">
              <input id="hero-poster-title" name="title" maxLength={160} defaultValue={editing?.title ?? ''} data-testid="hero-poster-title-input" />
            </PosterField>
            <PosterField id="hero-poster-url" label="Tautan internal" requirement="Opsional" help="Gunakan path internal seperti /program. Tautan // tidak diizinkan." error={fieldErrors.url}>
              <input id="hero-poster-url" name="url" placeholder="/program" defaultValue={editing?.url ?? ''} aria-invalid={Boolean(fieldErrors.url)} aria-describedby={`hero-poster-url-help${fieldErrors.url ? ' hero-poster-url-error' : ''}`} data-testid="hero-poster-url-input" />
            </PosterField>
            {editing ? <PosterField id="hero-poster-position" label="Posisi" requirement="Wajib" help={`Pilih posisi 1 sampai ${posters.length}. Poster lain akan bergeser otomatis.`} error={fieldErrors.position}>
              <input id="hero-poster-position" name="position" type="number" required min={1} max={posters.length} step={1} defaultValue={editingPosition ?? 1} aria-invalid={Boolean(fieldErrors.position)} aria-describedby={`hero-poster-position-help${fieldErrors.position ? ' hero-poster-position-error' : ''}`} data-testid="hero-poster-position-input" />
            </PosterField> : null}

            <label className="hero-poster-form__active"><input name="is_active" type="checkbox" defaultChecked={editing?.is_active ?? true} data-testid="hero-poster-active-checkbox" /> <span><strong>Aktif di beranda</strong><small>Poster aktif ikut dihitung dalam kesiapan carousel.</small></span></label>
            <div className="button-row hero-poster-form__actions">
              <button className="button button-primary" disabled={busy} data-testid="hero-poster-save-button">{busyAction === 'save' ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah poster'}</button>
              {editing ? <button type="button" className="button button-outline" onClick={resetEditor} disabled={busy} data-testid="hero-poster-cancel-button">Batal</button> : null}
            </div>
          </form>

          <section className="role-card hero-poster-list" data-testid="hero-poster-list">
            <div className="role-card-heading">
              <div><p className="kicker">Urutan carousel</p><h2>{posters.length} poster</h2><p>Atur status dan urutan tanpa membuka editor.</p></div>
              <button type="button" className="button button-outline" onClick={() => void load()} disabled={loading || busy} data-testid="hero-poster-refresh-button"><RefreshCw aria-hidden="true" size={15} /> Muat ulang</button>
            </div>
            {!posters.length ? <div className="empty-state hero-poster-empty" data-testid="hero-poster-empty-state"><Images aria-hidden="true" /><h3>Belum ada poster.</h3><p>Beranda akan memakai komposisi brand bawaan sampai poster aktif ditambahkan.</p></div> : null}
            <div className="hero-poster-list__items">
              {posters.map((poster, index) => <PosterRow key={poster.id} poster={poster} index={index} count={posters.length} busy={busy} busyAction={busyAction} previewUrl={previewUrl} onToggle={toggleActive} onMove={move} onEdit={beginEditing} onDelete={remove} />)}
            </div>
          </section>
        </div>
      </> : null}

      {error && !loadFailed ? <p className="form-error hero-poster-feedback" role="alert" data-testid="hero-poster-error-message">{error}</p> : null}
      {notice ? <p className="form-success hero-poster-feedback" role="status" aria-live="polite" data-testid="hero-poster-success-message">{notice}</p> : null}
    </section>
  )
}

function PosterField({ id, label, requirement, help, error, children }: { id: string; label: string; requirement: string; help: string; error?: string; children: React.ReactNode }) {
  return <div className="hero-poster-form__field">
    <label htmlFor={id}>{label} <span>{requirement}</span></label>
    {children}
    <small id={`${id}-help`}>{help}</small>
    {error ? <p id={`${id}-error`} className="hero-poster-field-error">{error}</p> : null}
  </div>
}

function PosterRow({ poster, index, count, busy, busyAction, previewUrl, onToggle, onMove, onEdit, onDelete }: {
  poster: MarketingHeroPoster
  index: number
  count: number
  busy: boolean
  busyAction: string | null
  previewUrl: (path: string) => string
  onToggle: (poster: MarketingHeroPoster) => Promise<void>
  onMove: (index: number, direction: -1 | 1) => Promise<void>
  onEdit: (poster: MarketingHeroPoster) => void
  onDelete: (poster: MarketingHeroPoster) => Promise<void>
}) {
  const name = poster.title ?? poster.alt_text
  return <article className="hero-poster-row" data-testid={`hero-poster-row-${poster.id}`} aria-busy={busyAction?.endsWith(poster.id)}>
    <div className="hero-poster-row__image"><Image src={previewUrl(poster.image_path)} alt={poster.alt_text} fill sizes="(max-width: 520px) 100vw, 180px" /></div>
    <div className="hero-poster-row__copy">
      <div className="hero-poster-row__title"><strong>{poster.title ?? 'Tanpa judul'}</strong><span className={`hero-poster-status hero-poster-status--${poster.is_active ? 'active' : 'inactive'}`}>{poster.is_active ? 'Aktif' : 'Nonaktif'}</span></div>
      <p>{poster.alt_text}</p>
      <dl><div><dt>Tujuan</dt><dd>{poster.url ?? 'Tanpa tautan'}</dd></div><div><dt>Posisi</dt><dd>{index + 1}</dd></div></dl>
    </div>
    <div className="hero-poster-row__actions">
      <button type="button" onClick={() => void onToggle(poster)} disabled={busy} role="switch" aria-checked={poster.is_active} aria-label={`${poster.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${name}`} className="hero-poster-row__toggle">{busyAction === `toggle-${poster.id}` ? 'Menyimpan…' : poster.is_active ? 'Aktif' : 'Nonaktif'}</button>
      <button type="button" onClick={() => void onMove(index, -1)} disabled={busy || index === 0} aria-label={`Naikkan ${name}`} data-testid={`hero-poster-${poster.id}-move-up-button`}><ArrowUp aria-hidden="true" size={15} /><span>Naik</span></button>
      <button type="button" onClick={() => void onMove(index, 1)} disabled={busy || index === count - 1} aria-label={`Turunkan ${name}`} data-testid={`hero-poster-${poster.id}-move-down-button`}><ArrowDown aria-hidden="true" size={15} /><span>Turun</span></button>
      <button type="button" onClick={() => onEdit(poster)} disabled={busy} aria-label={`Ubah ${name}`} data-testid={`hero-poster-${poster.id}-edit-button`}><Pencil aria-hidden="true" size={15} /><span>Ubah</span></button>
      <button type="button" onClick={() => void onDelete(poster)} disabled={busy} aria-label={`Hapus ${name}`} data-testid={`hero-poster-${poster.id}-delete-button`} className="hero-poster-row__delete"><Trash2 aria-hidden="true" size={15} /><span>Hapus</span></button>
    </div>
  </article>
}
