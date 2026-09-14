'use client'

import Image from 'next/image'
import { ImagePlus, Plus, RefreshCw, Trash2 } from 'lucide-react'
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
    if (!selected?.image_path || creating) {
      setPreviewLoading(false)
      return () => { cancelled = true }
    }

    setPreviewLoading(true)
    void supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).createSignedUrl(selected.image_path, 60 * 60)
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
  }, [creating, selected?.image_path, supabase])

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
      hasStoredImage: Boolean(selected?.image_path),
    })
    setFieldErrors(validation)
    setError('')
    setNotice('')
    if (Object.keys(validation).length > 0) return

    const editing = !creating && selected
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
        const { error: updateError } = await supabase.from('digital_products').update(payload).eq('id', editing.id)
        if (updateError) throw updateError
      } else {
        const { data: created, error: insertError } = await supabase.from('digital_products').insert(payload).select('id').single()
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
      const { error: rowError } = await supabase.from('digital_products').delete().eq('id', product.id)
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
  const itemList = products.map(product => ({
    id: product.id,
    title: product.name,
    meta: `${formatDigitalProductPrice(product.price_amount)} · /${product.slug}`,
  }))

  const editor = loading ? (
    <div className="empty-state" role="status"><RefreshCw aria-hidden="true" /><h3>Memuat Digital Products…</h3></div>
  ) : setupRequired ? (
    <div className="empty-state" role="alert" data-testid="digital-product-setup-required">
      <h3>Setup database diperlukan.</h3>
      <p>Migration <code>{migrationName}</code> perlu diterapkan pada project Supabase yang digunakan deployment ini.</p>
      <button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Coba lagi</button>
    </div>
  ) : loadFailed ? (
    <div className="empty-state" role="alert" data-testid="digital-product-load-error">
      <h3>Digital Products belum dapat dimuat.</h3>
      <p>{error}</p>
      <button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Coba lagi</button>
    </div>
  ) : (creating || selected) ? (
    <form className="editor-panel catalog-product-form" onSubmit={save} noValidate aria-busy={busy} data-testid={creating ? 'digital-product-create-mode' : 'digital-product-edit-mode'}>
      <div className="role-card-heading">
        <div><p className="kicker">{creating ? 'Digital Product baru' : 'Edit Digital Product'}</p><h2>{creating ? 'Buat Digital Product' : selected?.name}</h2></div>
        <button type="button" className="button button-outline" onClick={beginCreate} disabled={busy}><Plus aria-hidden="true" /> Digital Product baru</button>
      </div>

      <div className="catalog-form-grid">
        <label>Nama
          <input data-testid="digital-product-name-input" value={draft.name} onChange={event => updateName(event.target.value)} maxLength={160} aria-invalid={Boolean(fieldErrors.name)} />
          {fieldErrors.name ? <small className="form-error">{fieldErrors.name}</small> : null}
        </label>
        <label>Slug
          <input data-testid="digital-product-slug-input" value={draft.slug} onChange={event => { setDraft(current => ({ ...current, slug: event.target.value })); setSlugManuallyEdited(true); setFieldErrors(current => ({ ...current, slug: undefined })) }} maxLength={120} aria-invalid={Boolean(fieldErrors.slug)} />
          {fieldErrors.slug ? <small className="form-error">{fieldErrors.slug}</small> : null}
        </label>
        <label className="catalog-wide">Deskripsi
          <textarea data-testid="digital-product-description-input" value={draft.description} onChange={event => { setDraft(current => ({ ...current, description: event.target.value })); setFieldErrors(current => ({ ...current, description: undefined })) }} rows={5} maxLength={5000} aria-invalid={Boolean(fieldErrors.description)} />
          {fieldErrors.description ? <small className="form-error">{fieldErrors.description}</small> : null}
        </label>
        <label>Harga (Rupiah)
          <input data-testid="digital-product-price-input" type="text" inputMode="numeric" value={draft.price} onChange={event => { setDraft(current => ({ ...current, price: event.target.value })); setFieldErrors(current => ({ ...current, price: undefined })) }} placeholder="75000" aria-invalid={Boolean(fieldErrors.price)} />
          <small>{parsedPrice === null ? 'Simpan sebagai angka Rupiah bulat, tanpa Rp atau pemisah ribuan.' : `Preview: ${formatDigitalProductPrice(parsedPrice)}`}</small>
          {fieldErrors.price ? <small className="form-error">{fieldErrors.price}</small> : null}
        </label>
        <label>Cover image
          <input data-testid="digital-product-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { setSelectedFile(event.target.files?.[0] ?? null); setFieldErrors(current => ({ ...current, file: undefined })) }} />
          <small>{selected ? 'Kosongkan untuk mempertahankan cover saat ini.' : 'JPG, PNG, atau WebP · maksimal 5 MB.'}</small>
          {fieldErrors.file ? <small className="form-error">{fieldErrors.file}</small> : null}
        </label>
      </div>

      <section className="hero-poster-preview" data-testid="digital-product-cover-preview" aria-label="Preview cover Digital Product">
        <div className="hero-poster-preview__canvas">
          {editorPreviewUrl
            ? <Image src={editorPreviewUrl} alt={draft.name ? `Cover ${draft.name}` : 'Preview cover Digital Product'} fill sizes="(max-width: 800px) 90vw, 420px" unoptimized />
            : <div className="hero-poster-preview__empty"><ImagePlus aria-hidden="true" /><span>{previewLoading ? 'Memuat cover tersimpan…' : 'Pilih cover untuk melihat preview.'}</span></div>}
        </div>
      </section>

      <div className="button-row">
        <button data-testid="digital-product-save-button" className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : creating ? 'Buat Digital Product' : 'Simpan perubahan'}</button>
        <button type="button" className="button button-outline" onClick={cancelEdit} disabled={busy}>Batal</button>
        {!creating && selected ? <button type="button" className="button button-outline" onClick={() => void removeProduct(selected)} disabled={busy} data-testid="digital-product-delete-button"><Trash2 aria-hidden="true" /> Hapus</button> : null}
      </div>
      {error ? <p className="form-error" role="alert" data-testid="digital-product-error">{error}</p> : null}
      {notice ? <p className="form-success" role="status" data-testid="digital-product-notice">{notice}</p> : null}
    </form>
  ) : (
    <div className="empty-state" data-testid="digital-product-empty-editor">
      <h3>Pilih Digital Product atau buat yang baru.</h3>
      <p>Data yang disimpan di sini belum dipublikasikan ke storefront.</p>
      <button type="button" className="button button-primary" onClick={beginCreate}><Plus aria-hidden="true" /> Digital Product baru</button>
      {notice ? <p className="form-success" role="status" data-testid="digital-product-notice">{notice}</p> : null}
    </div>
  )

  return (
    <section data-testid="digital-product-management" aria-busy={loading || busy}>
      <CatalogManagement
        eyebrow="Produk · Digital Product"
        title="Digital Products"
        description="Kelola data dan cover Digital Product. Storefront dan pembelian tetap dinonaktifkan pada fase ini."
        items={itemList}
        selectedId={selectedId ?? undefined}
        query={query}
        onQueryChange={setQuery}
        onSelect={beginEdit}
        editor={editor}
        emptyTitle="Belum ada Digital Product."
        emptyDescription="Buat Digital Product pertama untuk menyiapkan data sebelum storefront diluncurkan."
      />
    </section>
  )
}
