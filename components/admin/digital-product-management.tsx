'use client'

import Image from 'next/image'
import { ImagePlus, PackageOpen, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { CatalogManagement } from '@/components/admin/catalog-management'
import { formError } from '@/lib/auth/errors'
import {
  buildDigitalProductImagePath,
  buildDigitalProductPayload,
  digitalProductMutationError,
  formatDigitalProductPrice,
  isDigitalProductSetupRequired,
  normalizeDigitalProductSlug,
  parseDigitalProductPriceInput,
  validateDigitalProductDraft,
  type DigitalProductDraftErrors,
} from '@/lib/digital-products/admin'
import { DIGITAL_PRODUCT_IMAGE_BUCKET } from '@/lib/digital-products/config'
import { createClient } from '@/lib/supabase/client'
import type { DigitalProduct } from '@/lib/supabase/database.types'
import styles from './digital-product-management.module.css'

const migrationName = '202609140003_digital_product_domain.sql'

type Draft = {
  name: string
  slug: string
  description: string
  price: string
}

const emptyDraft: Draft = { name: '', slug: '', description: '', price: '' }

export function DigitalProductManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [products, setProducts] = useState<DigitalProduct[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [storedPreviewUrl, setStoredPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<DigitalProductDraftErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selected = useMemo(
    () => products.find(product => product.id === selectedId) ?? null,
    [products, selectedId],
  )
  const selectedImagePath = selected?.image_path ?? null

  const load = useCallback(async (autoSelect = true) => {
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)

    const { data, error: loadError } = await supabase
      .from('digital_products')
      .select('*')
      .order('name', { ascending: true })
      .order('id', { ascending: true })

    if (loadError) {
      setProducts([])
      if (isDigitalProductSetupRequired(loadError)) {
        setSetupRequired(true)
      } else {
        setLoadFailed(true)
        setError(formError(loadError, 'Digital Products belum dapat dimuat. Periksa koneksi lalu coba lagi.'))
      }
    } else {
      const next = data ?? []
      setProducts(next)
      setSelectedId(current => current && next.some(product => product.id === current)
        ? current
        : autoSelect ? next[0]?.id ?? null : null)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (creating || !selected) return
    setDraft({
      name: selected.name,
      slug: selected.slug,
      description: selected.description,
      price: String(selected.price_amount),
    })
    setSlugManuallyEdited(true)
    setSelectedFile(null)
    setFieldErrors({})
  }, [creating, selected])

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
    let cancelled = false
    setStoredPreviewUrl(null)
    if (!selectedImagePath || creating) {
      setPreviewLoading(false)
      return () => { cancelled = true }
    }

    setPreviewLoading(true)
    void supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).createSignedUrl(selectedImagePath, 60 * 60)
      .then(({ data, error: signedUrlError }) => {
        if (cancelled) return
        if (signedUrlError) {
          setError(formError(signedUrlError, 'Cover tersimpan, tetapi preview belum dapat dimuat dari Storage.'))
          return
        }
        setStoredPreviewUrl(data.signedUrl)
      })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })

    return () => { cancelled = true }
  }, [creating, selectedImagePath, supabase])

  function beginCreate() {
    setCreating(true)
    setSelectedId(null)
    setDraft(emptyDraft)
    setSlugManuallyEdited(false)
    setSelectedFile(null)
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  function beginEdit(id: string) {
    setCreating(false)
    setSelectedId(id)
    setSlugManuallyEdited(true)
    setSelectedFile(null)
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  function cancelEdit() {
    setSelectedFile(null)
    setFieldErrors({})
    setError('')
    if (creating) {
      setCreating(false)
      setSelectedId(products[0]?.id ?? null)
      return
    }
    if (selected) {
      setDraft({
        name: selected.name,
        slug: selected.slug,
        description: selected.description,
        price: String(selected.price_amount),
      })
    }
  }

  function updateName(name: string) {
    setDraft(current => ({
      ...current,
      name,
      slug: creating && !slugManuallyEdited ? normalizeDigitalProductSlug(name) : current.slug,
    }))
    setFieldErrors(current => ({ ...current, name: undefined, ...(creating && !slugManuallyEdited ? { slug: undefined } : {}) }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const validation = validateDigitalProductDraft({
      name: draft.name,
      slug: draft.slug,
      description: draft.description,
      priceInput: draft.price,
      file: selectedFile,
      hasStoredImage: Boolean(selectedImagePath),
    })
    setFieldErrors(validation)
    setError('')
    setNotice('')
    if (Object.keys(validation).length > 0) return

    const editing = creating ? null : selected
    const oldImagePath = editing?.image_path ?? null
    let uploadedPath: string | null = null
    let stage: 'upload' | 'database' = 'upload'
    setBusy(true)

    try {
      if (selectedFile) {
        uploadedPath = buildDigitalProductImagePath(selectedFile.name)
        const { error: uploadError } = await supabase.storage
          .from(DIGITAL_PRODUCT_IMAGE_BUCKET)
          .upload(uploadedPath, selectedFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
      }

      stage = 'database'
      const payload = buildDigitalProductPayload({
        name: draft.name,
        slug: draft.slug,
        description: draft.description,
        priceInput: draft.price,
        imagePath: uploadedPath,
        storedImagePath: oldImagePath,
      })

      let authoritativeId = editing?.id ?? null
      if (editing) {
        const { data: updated, error: updateError } = await supabase
          .from('digital_products')
          .update(payload)
          .eq('id', editing.id)
          .select('id')
          .single()
        if (updateError) throw updateError
        authoritativeId = updated.id
      } else {
        const { data: created, error: insertError } = await supabase
          .from('digital_products')
          .insert(payload)
          .select('id')
          .single()
        if (insertError) throw insertError
        authoritativeId = created.id
      }

      let cleanupWarning = ''
      if (oldImagePath && uploadedPath && oldImagePath !== uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).remove([oldImagePath])
        if (cleanupError) cleanupWarning = ' Cover lama masih perlu ditinjau dan dihapus manual dari Storage.'
      }

      setCreating(false)
      setSelectedFile(null)
      setSelectedId(authoritativeId)
      setNotice(`${editing ? 'Digital Product berhasil diperbarui.' : 'Digital Product berhasil dibuat.'}${cleanupWarning}`)
      await load()
    } catch (caught) {
      let cleanupWarning = ''
      if (uploadedPath && stage === 'database') {
        const { data: persisted, error: reconciliationError } = await supabase
          .from('digital_products')
          .select('id,image_path')
          .eq('image_path', uploadedPath)
          .maybeSingle()

        if (persisted) {
          if (oldImagePath && oldImagePath !== uploadedPath) {
            const { error: cleanupError } = await supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).remove([oldImagePath])
            if (cleanupError) cleanupWarning = ' Cover lama masih perlu ditinjau dan dihapus manual dari Storage.'
          }
          setCreating(false)
          setSelectedFile(null)
          setSelectedId(persisted.id)
          setNotice(`${editing ? 'Digital Product berhasil diperbarui.' : 'Digital Product berhasil dibuat.'}${cleanupWarning}`)
          await load()
          return
        }

        if (reconciliationError) {
          cleanupWarning = ' Cover baru tidak dihapus otomatis karena status database belum dapat dipastikan. Tinjau daftar Digital Products dan Storage sebelum mencoba lagi.'
        } else {
          const { error: cleanupError } = await supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).remove([uploadedPath])
          if (cleanupError) cleanupWarning = ' Cover baru juga perlu ditinjau manual di Storage.'
        }
      }

      setError(`${stage === 'upload'
        ? 'Cover image belum dapat diunggah. Periksa Storage dan coba lagi.'
        : digitalProductMutationError(caught)}${cleanupWarning}`)
    } finally {
      setBusy(false)
    }
  }

  async function removeProduct(product: DigitalProduct) {
    if (busy || !window.confirm(`Hapus Digital Product “${product.name}”? Data produk akan dihapus lebih dulu, lalu cover Storage dibersihkan.`)) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { error: rowError } = await supabase
        .from('digital_products')
        .delete()
        .eq('id', product.id)
        .select('id')
        .single()
      if (rowError) throw rowError

      setCreating(false)
      setSelectedId(null)
      setDraft(emptyDraft)
      setSelectedFile(null)
      setFieldErrors({})

      const { error: storageError } = await supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).remove([product.image_path])
      if (storageError) {
        setNotice('Digital Product sudah dihapus, tetapi cover Storage perlu ditinjau dan dihapus manual.')
      } else {
        setNotice('Digital Product berhasil dihapus.')
      }
      await load(false)
    } catch (caught) {
      setError(formError(caught, 'Digital Product belum dapat dihapus. Periksa koneksi lalu coba lagi.'))
    } finally {
      setBusy(false)
    }
  }

  const parsedPrice = parseDigitalProductPriceInput(draft.price)
  const editorPreviewUrl = localPreviewUrl ?? storedPreviewUrl
  const previewSource = localPreviewUrl ? 'local' : storedPreviewUrl ? 'stored' : 'empty'
  const itemList = products.map(product => ({
    id: product.id,
    title: product.name,
    meta: `${formatDigitalProductPrice(product.price_amount)} · /${product.slug}`,
  }))
  const showDedicatedEmptyState = !loading && !setupRequired && !loadFailed && !creating && products.length === 0

  const pageHeader = (
    <div className={styles.pageHeader}>
      <p className="kicker">Produk · Digital Product</p>
      <h2>Digital Products</h2>
      <p>Kelola informasi, harga, dan cover produk digital dari satu tempat. Storefront dan pembelian belum dipublikasikan pada fase ini.</p>
    </div>
  )

  const editor = (creating || selected) ? (
    <form className={styles.form} onSubmit={save} noValidate aria-busy={busy} data-testid={creating ? 'digital-product-create-mode' : 'digital-product-edit-mode'}>
      <div className={styles.formHeader}>
        <div>
          <p className="kicker">{creating ? 'Digital Product baru' : 'Edit Digital Product'}</p>
          <h2>{creating ? 'Buat Digital Product' : selected?.name}</h2>
        </div>
        {!creating ? <button type="button" className="button button-outline" onClick={beginCreate} disabled={busy}><Plus aria-hidden="true" /> Digital Product baru</button> : null}
      </div>

      <section className={styles.formSection} aria-labelledby="digital-product-information-heading">
        <div className={styles.sectionHeading}>
          <h3 id="digital-product-information-heading">Informasi produk</h3>
          <p>Atur nama, identifier, dan deskripsi yang menjadi dasar informasi Digital Product.</p>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>Nama
            <input data-testid="digital-product-name-input" value={draft.name} onChange={event => updateName(event.target.value)} maxLength={160} aria-invalid={Boolean(fieldErrors.name)} />
            {fieldErrors.name ? <small className="form-error">{fieldErrors.name}</small> : null}
          </label>
          <label className={styles.field}>Slug
            <input data-testid="digital-product-slug-input" value={draft.slug} onChange={event => { setDraft(current => ({ ...current, slug: event.target.value })); setSlugManuallyEdited(true); setFieldErrors(current => ({ ...current, slug: undefined })) }} maxLength={120} aria-invalid={Boolean(fieldErrors.slug)} />
            {fieldErrors.slug ? <small className="form-error">{fieldErrors.slug}</small> : <small className={styles.helper}>Identifier URL/internal produk. Slug dibuat otomatis sampai diedit manual.</small>}
          </label>
          <label className={styles.wideField}>Deskripsi
            <textarea data-testid="digital-product-description-input" value={draft.description} onChange={event => { setDraft(current => ({ ...current, description: event.target.value })); setFieldErrors(current => ({ ...current, description: undefined })) }} rows={6} maxLength={5000} aria-invalid={Boolean(fieldErrors.description)} />
            {fieldErrors.description ? <small className="form-error">{fieldErrors.description}</small> : null}
          </label>
        </div>
      </section>

      <section className={styles.formSection} aria-labelledby="digital-product-price-heading">
        <div className={styles.sectionHeading}>
          <h3 id="digital-product-price-heading">Harga</h3>
          <p>Simpan nilai sebagai Rupiah bulat. Preview formatting tidak mengubah data input.</p>
        </div>
        <label className={styles.field}>Harga
          <span className={styles.priceControl}>
            <span className={styles.pricePrefix} aria-hidden="true">Rp</span>
            <input data-testid="digital-product-price-input" type="text" inputMode="numeric" value={draft.price} onChange={event => { setDraft(current => ({ ...current, price: event.target.value })); setFieldErrors(current => ({ ...current, price: undefined })) }} placeholder="75000" aria-invalid={Boolean(fieldErrors.price)} />
          </span>
          {parsedPrice === null ? <small className={styles.helper}>Gunakan angka Rupiah bulat tanpa simbol atau pemisah ribuan.</small> : <small className={styles.pricePreview}>Preview: {formatDigitalProductPrice(parsedPrice)}</small>}
          {fieldErrors.price ? <small className="form-error">{fieldErrors.price}</small> : null}
        </label>
      </section>

      <section className={styles.formSection} aria-labelledby="digital-product-cover-heading">
        <div className={styles.sectionHeading}>
          <h3 id="digital-product-cover-heading">Cover</h3>
          <p>Cover digunakan sebagai gambar pemasaran. File produk sebenarnya belum dikelola pada fase ini.</p>
        </div>
        <div className={styles.coverLayout}>
          <div className={styles.coverInput}>
            <label>{selected ? 'Ganti cover' : 'Pilih cover produk'}
              <input data-testid="digital-product-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { setSelectedFile(event.target.files?.[0] ?? null); setFieldErrors(current => ({ ...current, file: undefined })) }} />
            </label>
            <small className={styles.helper}>{selected ? 'Cover saat ini tetap digunakan jika tidak memilih file baru. JPG, PNG, atau WebP · maksimal 5 MB.' : 'JPG, PNG, atau WebP · maksimal 5 MB.'}</small>
            {fieldErrors.file ? <small className="form-error">{fieldErrors.file}</small> : null}
          </div>

          <div className={styles.coverPreview} data-testid="digital-product-cover-preview" data-preview-source={previewSource} aria-label="Preview cover Digital Product">
            <div className={styles.coverPreviewCanvas}>
              {editorPreviewUrl
                ? <Image src={editorPreviewUrl} alt={draft.name ? `Cover ${draft.name}` : 'Preview cover Digital Product'} fill sizes="(max-width: 768px) 80vw, 280px" unoptimized />
                : <div className={styles.coverPreviewEmpty}><ImagePlus aria-hidden="true" /><span>{previewLoading ? 'Memuat cover tersimpan…' : 'Pilih cover untuk melihat preview.'}</span></div>}
            </div>
            <p>{localPreviewUrl ? 'Preview cover baru. Cover lama baru dibersihkan setelah update database berhasil.' : selected ? 'Cover tersimpan saat ini. Pilih file baru hanya jika ingin menggantinya.' : 'Preview akan muncul di sini sebelum data disimpan.'}</p>
          </div>
        </div>
      </section>

      <div className={styles.formActions}>
        <button data-testid="digital-product-save-button" className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : creating ? 'Buat Digital Product' : 'Simpan perubahan'}</button>
        <button type="button" className="button button-outline" onClick={cancelEdit} disabled={busy}>Batal</button>
        {!creating && selected ? <button type="button" className={`button button-outline ${styles.deleteButton}`} onClick={() => void removeProduct(selected)} disabled={busy} data-testid="digital-product-delete-button"><Trash2 aria-hidden="true" /> Hapus</button> : null}
      </div>
      {error ? <p className={`${styles.feedback} ${styles.errorFeedback}`} role="alert" data-testid="digital-product-error">{error}</p> : null}
      {notice ? <p className={`${styles.feedback} ${styles.successFeedback}`} role="status" data-testid="digital-product-notice">{notice}</p> : null}
    </form>
  ) : (
    <div className={styles.stateCard} data-testid="digital-product-empty-editor">
      <h3>Pilih Digital Product untuk mulai mengelola.</h3>
      <p>Pilih produk dari navigator atau buat Digital Product baru.</p>
      <button type="button" className="button button-primary" onClick={beginCreate}><Plus aria-hidden="true" /> Digital Product baru</button>
      {notice ? <p className={`${styles.feedback} ${styles.successFeedback}`} role="status" data-testid="digital-product-notice">{notice}</p> : null}
    </div>
  )

  if (loading) {
    return (
      <section className={styles.management} data-testid="digital-product-management" aria-busy="true">
        {pageHeader}
        <div className={styles.stateCard} role="status"><RefreshCw aria-hidden="true" /><h3>Memuat Digital Products…</h3><p>Menyiapkan daftar produk, cover, dan editor.</p></div>
      </section>
    )
  }

  if (setupRequired) {
    return (
      <section className={styles.management} data-testid="digital-product-management" aria-busy={busy}>
        {pageHeader}
        <div className={styles.stateCard} role="alert" data-testid="digital-product-setup-required">
          <PackageOpen aria-hidden="true" />
          <h3>Setup database diperlukan.</h3>
          <p>Migration <code>{migrationName}</code> perlu diterapkan pada project Supabase yang digunakan deployment ini sebelum Digital Product dapat dikelola.</p>
          <button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Coba lagi</button>
        </div>
      </section>
    )
  }

  if (loadFailed) {
    return (
      <section className={styles.management} data-testid="digital-product-management" aria-busy={busy}>
        {pageHeader}
        <div className={styles.stateCard} role="alert" data-testid="digital-product-load-error">
          <RefreshCw aria-hidden="true" />
          <h3>Digital Products belum dapat dimuat.</h3>
          <p>{error}</p>
          <button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Coba lagi</button>
        </div>
      </section>
    )
  }

  if (showDedicatedEmptyState) {
    return (
      <section className={styles.management} data-testid="digital-product-management" aria-busy={busy}>
        {pageHeader}
        <div className={styles.emptyState} data-testid="digital-product-empty-state">
          <div className={styles.emptyContent}>
            <span className={styles.emptyIcon}><PackageOpen aria-hidden="true" /></span>
            <h3>Belum ada Digital Product</h3>
            <p>Buat produk digital pertama untuk mulai menyiapkan informasi, harga, dan cover sebelum storefront tersedia.</p>
            <button type="button" className="button button-primary" onClick={beginCreate}><Plus aria-hidden="true" /> Buat Digital Product</button>
            <div className={styles.emptyChips} aria-label="Status Digital Product">
              <span>Draft admin</span>
              <span>Storefront belum aktif</span>
              <span>Cover JPG / PNG / WebP</span>
            </div>
            {notice ? <p className={`${styles.feedback} ${styles.successFeedback}`} role="status" data-testid="digital-product-notice">{notice}</p> : null}
          </div>
        </div>
      </section>
    )
  }

  if (creating && products.length === 0) {
    return (
      <section className={styles.management} data-testid="digital-product-management" aria-busy={busy}>
        {pageHeader}
        <div className={styles.singleEditor}>{editor}</div>
      </section>
    )
  }

  return (
    <section className={styles.management} data-testid="digital-product-management" aria-busy={busy}>
      <CatalogManagement
        eyebrow="Produk · Digital Product"
        title="Digital Products"
        description="Kelola informasi, harga, dan cover produk digital dari satu tempat. Storefront dan pembelian belum dipublikasikan pada fase ini."
        items={itemList}
        selectedId={selectedId ?? undefined}
        query={query}
        onQueryChange={setQuery}
        onSelect={beginEdit}
        editor={editor}
        listLabel="Digital Products"
        itemNoun="produk"
        searchLabel="Cari produk"
        searchPlaceholder="Cari nama, harga, atau slug…"
      />
    </section>
  )
}