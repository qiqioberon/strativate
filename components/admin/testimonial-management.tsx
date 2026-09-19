'use client'

import Image from 'next/image'
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  MessageSquareQuote,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import {
  buildTestimonialAltText,
  buildTestimonialPayload,
  getNextTestimonialSortOrder,
  isTestimonialSetupRequired,
  normalizeTestimonialSlug,
  reorderTestimonialIds,
  testimonialOriginalExtension,
  validateTestimonialDraft,
  type TestimonialDraftErrors,
} from '@/lib/marketing/testimonial-admin'
import {
  TESTIMONIAL_CROP_MAX_ZOOM,
  TESTIMONIAL_CROP_MIN_ZOOM,
  TESTIMONIAL_IMAGE_BUCKET,
  TESTIMONIAL_IMAGE_HEIGHT,
  TESTIMONIAL_IMAGE_WIDTH,
} from '@/lib/marketing/testimonial-config'
import {
  cropTestimonialImage,
  DEFAULT_TESTIMONIAL_CROP,
  type TestimonialCrop,
} from '@/lib/marketing/testimonial-image'
import { createClient } from '@/lib/supabase/client'
import type { MarketingTestimonial } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './testimonial-management.module.css'

const migrationName = '202609200002_marketing_testimonials.sql'

type Draft = {
  slug: string
  competitionName: string
  achievement: string
  testimonial: string
  isPublished: boolean
}

const emptyDraft: Draft = {
  slug: '',
  competitionName: '',
  achievement: '',
  testimonial: '',
  isPublished: true,
}

function draftFromItem(item: MarketingTestimonial): Draft {
  return {
    slug: item.slug,
    competitionName: item.competition_name,
    achievement: item.achievement,
    testimonial: item.testimonial,
    isPublished: item.is_published,
  }
}

export function TestimonialManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [items, setItems] = useState<MarketingTestimonial[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [crop, setCrop] = useState<TestimonialCrop>({ ...DEFAULT_TESTIMONIAL_CROP })
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<TestimonialDraftErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selected = useMemo(() => items.find(item => item.id === selectedId) ?? null, [items, selectedId])
  const busy = busyAction !== null
  const editorOpen = creating || Boolean(selected)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setLoadFailed(false)
    setSetupRequired(false)
    const { data, error: loadError } = await supabase
      .from('marketing_testimonials')
      .select('*')
      .order('sort_order')
      .order('created_at')

    if (loadError) {
      setItems([])
      if (isTestimonialSetupRequired(loadError)) setSetupRequired(true)
      else {
        setLoadFailed(true)
        setError(formError(loadError, 'Testimoni belum dapat dimuat. Periksa koneksi lalu coba lagi.'))
      }
    } else {
      setItems(data ?? [])
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

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editorOpen && !dialog.open) dialog.showModal()
    if (!editorOpen && dialog.open) dialog.close()
  }, [editorOpen])

  const publicImageUrl = useCallback((path: string) => (
    supabase.storage.from(TESTIMONIAL_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  ), [supabase])

  function resetEditor() {
    setCreating(false)
    setSelectedId(null)
    setDraft(emptyDraft)
    setSlugManuallyEdited(false)
    setSelectedFile(null)
    setCrop({ ...DEFAULT_TESTIMONIAL_CROP })
    setFieldErrors({})
  }

  function beginCreate() {
    setCreating(true)
    setSelectedId(null)
    setDraft(emptyDraft)
    setSlugManuallyEdited(false)
    setSelectedFile(null)
    setCrop({ ...DEFAULT_TESTIMONIAL_CROP })
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  function beginEdit(item: MarketingTestimonial) {
    setCreating(false)
    setSelectedId(item.id)
    setDraft(draftFromItem(item))
    setSlugManuallyEdited(true)
    setSelectedFile(null)
    setCrop({ ...DEFAULT_TESTIMONIAL_CROP })
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  function updateCompetitionName(value: string) {
    setDraft(current => ({
      ...current,
      competitionName: value,
      slug: slugManuallyEdited ? current.slug : normalizeTestimonialSlug(value),
    }))
    setFieldErrors(current => ({ ...current, competitionName: undefined, slug: undefined }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const validation = validateTestimonialDraft({
      slug: draft.slug,
      competitionName: draft.competitionName,
      achievement: draft.achievement,
      testimonial: draft.testimonial,
      file: selectedFile,
    })
    setFieldErrors(validation)
    setError('')
    setNotice('')
    if (Object.keys(validation).length > 0) return

    setBusyAction('save')
    let uploadedPath: string | null = null
    let uploadedOriginalPath: string | null = null

    try {
      if (selectedFile) {
        const uploadId = crypto.randomUUID()
        const extension = testimonialOriginalExtension(selectedFile.type)
        uploadedOriginalPath = `testimonials/original/${uploadId}-${draft.slug || 'testimonial'}.${extension}`
        const { error: originalUploadError } = await supabase.storage
          .from(TESTIMONIAL_IMAGE_BUCKET)
          .upload(uploadedOriginalPath, selectedFile, {
            cacheControl: '3600',
            contentType: selectedFile.type,
            upsert: false,
          })
        if (originalUploadError) throw originalUploadError

        const croppedImage = await cropTestimonialImage(selectedFile, crop)
        uploadedPath = `testimonials/gallery/${uploadId}-${draft.slug || 'testimonial'}.webp`
        const { error: uploadError } = await supabase.storage
          .from(TESTIMONIAL_IMAGE_BUCKET)
          .upload(uploadedPath, croppedImage, {
            cacheControl: '3600',
            contentType: 'image/webp',
            upsert: false,
          })
        if (uploadError) throw uploadError
      }

      const payload = buildTestimonialPayload({
        slug: draft.slug,
        competitionName: draft.competitionName,
        achievement: draft.achievement,
        testimonial: draft.testimonial,
        imagePath: uploadedPath,
        storedImagePath: selected?.image_path ?? null,
        originalImagePath: uploadedOriginalPath,
        storedOriginalImagePath: selected?.original_image_path ?? null,
        isPublished: draft.isPublished,
      })

      const result = selected
        ? await supabase.from('marketing_testimonials').update(payload).eq('id', selected.id)
        : await supabase.from('marketing_testimonials').insert({
          ...payload,
          sort_order: getNextTestimonialSortOrder(items),
        })
      if (result.error) throw result.error

      let cleanupWarning = ''
      if (selectedFile) {
        const oldPaths = [...new Set([
          selected?.image_path,
          selected?.original_image_path,
        ].filter((path): path is string => Boolean(path)))]
        if (oldPaths.length) {
          const { error: cleanupError } = await supabase.storage
            .from(TESTIMONIAL_IMAGE_BUCKET)
            .remove(oldPaths)
          if (cleanupError) cleanupWarning = ' Gambar lama masih perlu ditinjau manual di Storage.'
        }
      }

      const wasEditing = Boolean(selected)
      resetEditor()
      setNotice(`${wasEditing ? 'Testimoni berhasil diperbarui.' : 'Testimoni berhasil ditambahkan.'}${cleanupWarning}`)
      await load()
    } catch (caught) {
      const failedUploadPaths = [uploadedPath, uploadedOriginalPath]
        .filter((path): path is string => Boolean(path))
      if (failedUploadPaths.length) {
        await supabase.storage.from(TESTIMONIAL_IMAGE_BUCKET).remove(failedUploadPaths)
      }
      setError(formError(caught, 'Testimoni belum dapat disimpan.'))
    } finally {
      setBusyAction(null)
    }
  }

  async function togglePublished(item: MarketingTestimonial) {
    if (busy) return
    setBusyAction(`publish-${item.id}`)
    setError('')
    setNotice('')
    try {
      const { error: updateError } = await supabase
        .from('marketing_testimonials')
        .update({ is_published: !item.is_published })
        .eq('id', item.id)
      if (updateError) throw updateError
      setNotice(item.is_published ? 'Testimoni dipindahkan ke Draft.' : 'Testimoni dipublikasikan.')
      await load()
    } catch (caught) {
      setError(formError(caught, 'Status testimoni belum dapat diperbarui.'))
    } finally {
      setBusyAction(null)
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (busy) return
    const ids = reorderTestimonialIds(items, index, direction)
    if (ids.every((id, position) => id === items[position]?.id)) return
    setBusyAction(`move-${items[index].id}`)
    setError('')
    setNotice('')
    try {
      const { error: reorderError } = await supabase.rpc('reorder_marketing_testimonials', { p_ids: ids })
      if (reorderError) throw reorderError
      setNotice('Urutan testimonial berhasil diperbarui.')
      await load()
    } catch (caught) {
      setError(formError(caught, 'Urutan testimonial belum dapat diperbarui.'))
    } finally {
      setBusyAction(null)
    }
  }

  async function remove(item: MarketingTestimonial) {
    if (busy || !window.confirm(`Hapus testimoni “${item.competition_name}”?`)) return
    setBusyAction(`delete-${item.id}`)
    setError('')
    setNotice('')
    try {
      const { error: rowError } = await supabase.from('marketing_testimonials').delete().eq('id', item.id)
      if (rowError) throw rowError

      let warning = ''
      const storagePaths = [...new Set([
        item.image_path,
        item.original_image_path,
      ].filter((path): path is string => Boolean(path)))]
      if (storagePaths.length) {
        const { error: storageError } = await supabase.storage
          .from(TESTIMONIAL_IMAGE_BUCKET)
          .remove(storagePaths)
        if (storageError) warning = ' Gambar Storage perlu ditinjau manual.'
      }

      const remainingIds = items.filter(candidate => candidate.id !== item.id).map(candidate => candidate.id)
      if (remainingIds.length) {
        const { error: reorderError } = await supabase.rpc('reorder_marketing_testimonials', { p_ids: remainingIds })
        if (reorderError) warning += ' Urutan item yang tersisa perlu ditinjau.'
      }

      if (selectedId === item.id) resetEditor()
      setNotice(`Testimoni berhasil dihapus.${warning}`)
      await load()
    } catch (caught) {
      setError(formError(caught, 'Testimoni belum dapat dihapus.'))
    } finally {
      setBusyAction(null)
    }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('id-ID')
    if (!term) return items
    return items.filter(item => (
      `${item.competition_name} ${item.achievement} ${item.testimonial}`
        .toLocaleLowerCase('id-ID')
        .includes(term)
    ))
  }, [items, query])

  const storedPreviewUrl = selected?.image_path ? publicImageUrl(selected.image_path) : null
  const editorPreviewUrl = localPreviewUrl ?? storedPreviewUrl

  const pageHeader = (
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>
        <p className="kicker">Konten · Beranda</p>
        <h2>Testimonials</h2>
        <p>Kelola cerita peserta, pencapaian kompetisi, gambar galeri, urutan tampil, dan status publikasi.</p>
      </div>
      <span className={dataStyles.countPill}><MessageSquareQuote aria-hidden="true" />{items.length} cerita</span>
    </header>
  )

  if (loading) {
    return <section className={dataStyles.page} data-testid="testimonial-management" aria-busy="true">{pageHeader}<div className={styles.stateCard}><RefreshCw aria-hidden="true" /> Memuat testimonial…</div></section>
  }

  if (setupRequired) {
    return <section className={dataStyles.page} data-testid="testimonial-management">{pageHeader}<div className={styles.stateCard} role="alert"><strong>Setup database diperlukan.</strong><p>Jalankan migration <code>{migrationName}</code>, lalu seed <code>supabase/seed/marketing_testimonials.sql</code>.</p><button type="button" className="button button-outline" onClick={() => void load()}>Coba lagi</button></div></section>
  }

  if (loadFailed) {
    return <section className={dataStyles.page} data-testid="testimonial-management">{pageHeader}<div className={styles.stateCard} role="alert"><strong>Testimonial belum dapat dimuat.</strong><p>{error}</p><button type="button" className="button button-outline" onClick={() => void load()}>Coba lagi</button></div></section>
  }

  return (
    <section className={dataStyles.page} data-testid="testimonial-management" aria-busy={busy}>
      {pageHeader}
      {error ? <p className={`${dataStyles.feedback} ${dataStyles.errorFeedback}`} role="alert">{error}</p> : null}
      {notice ? <p className={`${dataStyles.feedback} ${dataStyles.successFeedback}`} role="status">{notice}</p> : null}

      <div className={dataStyles.surface}>
        <div className={dataStyles.surfaceHeader}>
          <div className={dataStyles.surfaceHeaderCopy}>
            <p className="kicker">Cerita peserta</p>
            <h3>{items.length} testimonial</h3>
            <p>Seed awal sudah mengisi copy. Item baru tampil di beranda setelah Published dan memiliki gambar.</p>
          </div>
          <button type="button" className="button button-primary" onClick={beginCreate} disabled={busy}>
            <Plus aria-hidden="true" /> Testimoni baru
          </button>
        </div>

        <div className={dataStyles.toolbar}>
          <label className={dataStyles.searchField}>
            Cari testimonial
            <span className={dataStyles.searchControl}>
              <Search aria-hidden="true" />
              <input value={query} type="search" onChange={event => setQuery(event.target.value)} placeholder="Cari kompetisi, pencapaian, atau isi testimoni" />
            </span>
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className={dataStyles.empty}>Tidak ada testimonial yang sesuai.</div>
        ) : (
          <div className={styles.list}>
            {filtered.map(item => {
              const sourceIndex = items.findIndex(candidate => candidate.id === item.id)
              const hasImage = Boolean(item.image_path)
              return (
                <article className={styles.row} key={item.id} data-testid="testimonial-admin-row">
                  <div className={styles.thumbnail}>
                    {item.image_path
                      ? <Image src={publicImageUrl(item.image_path)} alt="" fill sizes="90px" unoptimized />
                      : <ImagePlus aria-hidden="true" />}
                  </div>
                  <div className={styles.rowCopy}>
                    <div className={styles.rowTitle}>
                      <strong>{item.competition_name}</strong>
                      <span className={`${dataStyles.badge} ${item.is_published && hasImage ? dataStyles.successBadge : dataStyles.warningBadge}`}>
                        {item.is_published ? hasImage ? 'Published' : 'Menunggu gambar' : 'Draft'}
                      </span>
                    </div>
                    <span className={styles.achievement}>{item.achievement}</span>
                    <p>{item.testimonial}</p>
                  </div>
                  <div className={styles.rowActions}>
                    <button type="button" onClick={() => void move(sourceIndex, -1)} disabled={busy || sourceIndex === 0} aria-label={`Naikkan ${item.competition_name}`}><ArrowUp aria-hidden="true" size={15} /></button>
                    <button type="button" onClick={() => void move(sourceIndex, 1)} disabled={busy || sourceIndex === items.length - 1} aria-label={`Turunkan ${item.competition_name}`}><ArrowDown aria-hidden="true" size={15} /></button>
                    <button type="button" onClick={() => void togglePublished(item)} disabled={busy}>{item.is_published ? 'Draft' : 'Publish'}</button>
                    <button type="button" onClick={() => beginEdit(item)} disabled={busy}>Kelola</button>
                    <button type="button" className={styles.deleteButton} onClick={() => void remove(item)} disabled={busy} aria-label={`Hapus ${item.competition_name}`}><Trash2 aria-hidden="true" size={15} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className={dialogStyles.dialog}
        aria-labelledby="testimonial-editor-heading"
        onCancel={event => {
          if (busy) event.preventDefault()
          else resetEditor()
        }}
        onClose={() => {
          if (!busy && editorOpen) resetEditor()
        }}
        onClick={event => {
          if (event.target === event.currentTarget && !busy) resetEditor()
        }}
      >
        <div className={dialogStyles.panel}>
          <header className={dialogStyles.header}>
            <div>
              <p className="kicker">{creating ? 'Testimoni baru' : 'Kelola testimonial'}</p>
              <h2 id="testimonial-editor-heading">{creating ? 'Tambahkan cerita peserta' : selected?.competition_name}</h2>
            </div>
            <button type="button" className={`role-close ${dialogStyles.closeButton}`} onClick={resetEditor} disabled={busy} aria-label="Tutup editor"><X aria-hidden="true" /></button>
          </header>
          <div className={dialogStyles.body}>
            <form className={styles.form} onSubmit={save} noValidate>
              <div className={styles.formGrid}>
                <label>Nama kompetisi<input value={draft.competitionName} maxLength={180} onChange={event => updateCompetitionName(event.target.value)} aria-invalid={Boolean(fieldErrors.competitionName)} />{fieldErrors.competitionName ? <small className="form-error">{fieldErrors.competitionName}</small> : null}</label>
                <label>Pencapaian<input value={draft.achievement} maxLength={160} onChange={event => { setDraft(current => ({ ...current, achievement: event.target.value })); setFieldErrors(current => ({ ...current, achievement: undefined })) }} aria-invalid={Boolean(fieldErrors.achievement)} />{fieldErrors.achievement ? <small className="form-error">{fieldErrors.achievement}</small> : null}</label>
                <label>Slug<input value={draft.slug} maxLength={120} onChange={event => { setSlugManuallyEdited(true); setDraft(current => ({ ...current, slug: normalizeTestimonialSlug(event.target.value) })); setFieldErrors(current => ({ ...current, slug: undefined })) }} aria-invalid={Boolean(fieldErrors.slug)} />{fieldErrors.slug ? <small className="form-error">{fieldErrors.slug}</small> : null}</label>
                <label className={styles.wideField}>Isi testimoni<textarea rows={8} maxLength={5000} value={draft.testimonial} onChange={event => { setDraft(current => ({ ...current, testimonial: event.target.value })); setFieldErrors(current => ({ ...current, testimonial: undefined })) }} aria-invalid={Boolean(fieldErrors.testimonial)} />{fieldErrors.testimonial ? <small className="form-error">{fieldErrors.testimonial}</small> : null}</label>
              </div>

              <section className={styles.mediaSection}>
                <div>
                  <label>Gambar testimonial<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
                    const file = event.target.files?.[0] ?? null
                    setSelectedFile(file)
                    setCrop({ ...DEFAULT_TESTIMONIAL_CROP })
                    setFieldErrors(current => ({ ...current, file: undefined }))
                  }} /></label>
                  <small>{selected?.image_path ? 'Biarkan kosong jika tidak ingin mengganti gambar. ' : ''}JPG, PNG, atau WebP · maksimal 5 MB. File baru otomatis disimpan dalam format 4:5.</small>
                  {fieldErrors.file ? <small className="form-error">{fieldErrors.file}</small> : null}
                  {selectedFile ? (
                    <div className={styles.cropControls} data-testid="testimonial-crop-controls">
                      <div className={styles.cropMeta}>
                        <span>Crop standar</span>
                        <strong>{TESTIMONIAL_IMAGE_WIDTH} × {TESTIMONIAL_IMAGE_HEIGHT} px · 4:5</strong>
                      </div>
                      <label>
                        Posisi horizontal
                        <input type="range" min="0" max="100" value={crop.x} onChange={event => setCrop(current => ({ ...current, x: Number(event.target.value) }))} />
                      </label>
                      <label>
                        Posisi vertikal
                        <input type="range" min="0" max="100" value={crop.y} onChange={event => setCrop(current => ({ ...current, y: Number(event.target.value) }))} />
                      </label>
                      <label>
                        Zoom
                        <input
                          type="range"
                          min={TESTIMONIAL_CROP_MIN_ZOOM}
                          max={TESTIMONIAL_CROP_MAX_ZOOM}
                          step=".05"
                          value={crop.zoom}
                          onChange={event => setCrop(current => ({ ...current, zoom: Number(event.target.value) }))}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
                <div className={styles.preview}>
                  {editorPreviewUrl
                    ? <Image
                        src={editorPreviewUrl}
                        alt={buildTestimonialAltText(draft.competitionName)}
                        fill
                        sizes="280px"
                        unoptimized
                        style={selectedFile ? {
                          objectPosition: `${crop.x}% ${crop.y}%`,
                          transform: `scale(${crop.zoom})`,
                          transformOrigin: `${crop.x}% ${crop.y}%`,
                        } : undefined}
                      />
                    : <div><ImagePlus aria-hidden="true" /><span>Seed belum memiliki gambar. Upload foto kompetisi di sini.</span></div>}
                </div>
              </section>

              <label className={styles.publishToggle}>
                <input type="checkbox" checked={draft.isPublished} onChange={event => setDraft(current => ({ ...current, isPublished: event.target.checked }))} />
                <span><strong>Published</strong><small>Beranda hanya menampilkan testimonial Published yang sudah memiliki gambar.</small></span>
              </label>

              <div className={styles.formActions}>
                <button className="button button-primary" disabled={busy}>{busyAction === 'save' ? 'Menyimpan…' : creating ? 'Buat testimoni' : 'Simpan perubahan'}</button>
                <button type="button" className="button button-outline" onClick={resetEditor} disabled={busy}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
    </section>
  )
}
