'use client'

import Image from 'next/image'
import { FileText, ImagePlus, PackageOpen, PlayCircle, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { formError } from '@/lib/auth/errors'
import {
  buildDigitalProductContentPath,
  buildDigitalProductContentPayload,
  buildDigitalProductImagePath,
  buildDigitalProductPayload,
  digitalProductMutationError,
  formatDigitalProductPrice,
  isDigitalProductSetupRequired,
  normalizeDigitalProductSlug,
  parseDigitalProductPriceInput,
  validateDigitalProductContentFile,
  validateDigitalProductDraft,
  type DigitalProductContentType,
  type DigitalProductDraftErrors,
} from '@/lib/digital-products/admin'
import { DIGITAL_PRODUCT_CONTENT_BUCKET, DIGITAL_PRODUCT_IMAGE_BUCKET } from '@/lib/digital-products/config'
import { createClient } from '@/lib/supabase/client'
import type { DigitalProduct } from '@/lib/supabase/database.types'
import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './digital-product-management.module.css'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'

const migrationName = '202609140009_digital_product_content_delivery.sql'
const PRODUCT_PAGE_SIZE = 10
type ProductSortKey = 'product' | 'type' | 'price' | 'status' | 'content' | 'updated_at'
type Draft = { name:string; slug:string; description:string; price:string; contentType:DigitalProductContentType|''; isPublished:boolean }
const emptyDraft: Draft = { name: '', slug: '', description: '', price: '', contentType: '', isPublished: false }
function formatUpdatedAt(value: string) { return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) }
function formatFileSize(value: number | null) { if (!value || value <= 0) return null; if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`; return `${Math.ceil(value / 1024)} KB` }

export function DigitalProductManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [products, setProducts] = useState<DigitalProduct[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [productPage, setProductPage] = useState(0)
  const [sortKey, setSortKey] = useState<ProductSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedContentFile, setSelectedContentFile] = useState<File | null>(null)
  const [contentError, setContentError] = useState('')
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
  const dialogRef = useRef<HTMLDialogElement>(null)

  const selected = useMemo(() => products.find(product => product.id === selectedId) ?? null, [products, selectedId])
  const selectedImagePath = selected?.image_path ?? null
  const filteredProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('id-ID')
    if (!term) return products
    return products.filter(product => `${product.name} ${product.slug} ${product.description} ${product.price_amount} ${product.content_type ?? ''}`.toLocaleLowerCase('id-ID').includes(term))
  }, [products, query])
  const sortedProducts = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredProducts
    const sign = sortDirection === 'asc' ? 1 : -1
    return [...filteredProducts].sort((a, b) => {
      if (sortKey === 'price') return (a.price_amount - b.price_amount) * sign
      if (sortKey === 'updated_at') return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * sign
      const contentReady = (product: DigitalProduct) => Boolean(product.content_type && product.content_path && product.content_mime_type)
      const left = sortKey === 'product' ? a.name : sortKey === 'type' ? (a.content_type ?? '') : sortKey === 'status' ? (a.is_published ? 'Published' : 'Draft') : (contentReady(a) ? 'Siap' : 'Belum ada')
      const right = sortKey === 'product' ? b.name : sortKey === 'type' ? (b.content_type ?? '') : sortKey === 'status' ? (b.is_published ? 'Published' : 'Draft') : (contentReady(b) ? 'Siap' : 'Belum ada')
      return left.localeCompare(right, 'id-ID') * sign
    })
  }, [filteredProducts, sortDirection, sortKey])
  const pagedProducts = useMemo(() => sortedProducts.slice(productPage * PRODUCT_PAGE_SIZE, productPage * PRODUCT_PAGE_SIZE + PRODUCT_PAGE_SIZE), [productPage, sortedProducts])
  const editorOpen = creating || selectedId !== null

  const load = useCallback(async () => {
    setLoading(true); setError(''); setSetupRequired(false); setLoadFailed(false)
    const { data, error: loadError } = await supabase.from('digital_products').select('*').order('name', { ascending: true }).order('id', { ascending: true })
    if (loadError) {
      setProducts([])
      if (isDigitalProductSetupRequired(loadError)) setSetupRequired(true)
      else { setLoadFailed(true); setError(formError(loadError, 'Digital Products belum dapat dimuat. Periksa koneksi lalu coba lagi.')) }
    } else {
      const next = data ?? []; setProducts(next); setSelectedId(current => current && next.some(product => product.id === current) ? current : null)
    }
    setLoading(false)
  }, [supabase])
  useEffect(() => { void load() }, [load])
  useEffect(() => { const lastPage = Math.max(0, Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE) - 1); if (productPage > lastPage) setProductPage(lastPage) }, [filteredProducts.length, productPage])
  useEffect(() => {
    if (creating || !selected) return
    setDraft({ name:selected.name, slug:selected.slug, description:selected.description, price:String(selected.price_amount), contentType:selected.content_type ?? '', isPublished:selected.is_published })
    setSlugManuallyEdited(true); setSelectedFile(null); setSelectedContentFile(null); setContentError(''); setFieldErrors({})
  }, [creating, selected])
  useEffect(() => {
    if (!selectedFile) { setLocalPreviewUrl(null); return }
    const objectUrl = URL.createObjectURL(selectedFile); setLocalPreviewUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])
  useEffect(() => {
    let cancelled = false; setStoredPreviewUrl(null)
    if (!selectedImagePath || creating) { setPreviewLoading(false); return () => { cancelled = true } }
    setPreviewLoading(true)
    void supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).createSignedUrl(selectedImagePath, 60 * 60).then(({ data, error: signedUrlError }) => {
      if (cancelled) return
      if (signedUrlError) { setError(formError(signedUrlError, 'Cover tersimpan, tetapi preview belum dapat dimuat dari Storage.')); return }
      setStoredPreviewUrl(data.signedUrl)
    }).finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [creating, selectedImagePath, supabase])
  useEffect(() => { const dialog = dialogRef.current; if (!dialog) return; if (editorOpen && !dialog.open) dialog.showModal(); if (!editorOpen && dialog.open) dialog.close() }, [editorOpen])
  useEffect(() => {
    if (!editorOpen) return
    const previousOverflow = document.body.style.overflow, previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'; if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    return () => { document.body.style.overflow = previousOverflow; document.body.style.paddingRight = previousPaddingRight }
  }, [editorOpen])

  function changeSort(key: string | null, direction: SortDirection) { setSortKey(key as ProductSortKey | null); setSortDirection(direction); setProductPage(0) }
  function beginCreate() { setCreating(true); setSelectedId(null); setDraft(emptyDraft); setSlugManuallyEdited(false); setSelectedFile(null); setSelectedContentFile(null); setContentError(''); setFieldErrors({}); setError(''); setNotice('') }
  function beginEdit(id: string) { setCreating(false); setSelectedId(id); setSlugManuallyEdited(true); setSelectedFile(null); setSelectedContentFile(null); setContentError(''); setFieldErrors({}); setError(''); setNotice('') }
  function closeEditor() { if (busy) return; dialogRef.current?.close() }
  function resetEditorState() { setCreating(false); setSelectedId(null); setSelectedFile(null); setSelectedContentFile(null); setContentError(''); setStoredPreviewUrl(null); setFieldErrors({}); setError('') }
  function updateName(name: string) { setDraft(current => ({ ...current, name, slug:creating && !slugManuallyEdited ? normalizeDigitalProductSlug(name) : current.slug })); setFieldErrors(current => ({ ...current, name:undefined, ...(creating && !slugManuallyEdited ? { slug:undefined } : {}) })) }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const editing = creating ? null : selected
    const validation = validateDigitalProductDraft({ name:draft.name, slug:draft.slug, description:draft.description, priceInput:draft.price, file:selectedFile, hasStoredImage:Boolean(editing?.image_path) })
    const compatibleStoredContent = Boolean(editing?.content_path && editing.content_type === draft.contentType)
    const nextContentError = draft.contentType ? validateDigitalProductContentFile({ file:selectedContentFile, contentType:draft.contentType, hasStoredContent:compatibleStoredContent, publishing:draft.isPublished }) ?? '' : 'Pilih Jenis Produk PDF atau Video.'
    setFieldErrors(validation); setContentError(nextContentError); setError(''); setNotice('')
    if (Object.keys(validation).length > 0 || nextContentError) return
    const oldImagePath = editing?.image_path ?? null
    const oldContentPath = compatibleStoredContent ? editing?.content_path ?? null : null
    let uploadedImagePath: string | null = null, uploadedContentPath: string | null = null, databaseAttempted = false
    setBusy(true)
    try {
      if (selectedFile) { uploadedImagePath = buildDigitalProductImagePath(selectedFile.name); const { error: uploadError } = await supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).upload(uploadedImagePath, selectedFile, { cacheControl:'3600', upsert:false }); if (uploadError) throw uploadError }
      if (selectedContentFile) { uploadedContentPath = buildDigitalProductContentPath(selectedContentFile.name); const { error: contentUploadError } = await supabase.storage.from(DIGITAL_PRODUCT_CONTENT_BUCKET).upload(uploadedContentPath, selectedContentFile, { cacheControl:'3600', upsert:false }); if (contentUploadError) throw contentUploadError }
      const payload = {
        ...buildDigitalProductPayload({ name:draft.name, slug:draft.slug, description:draft.description, priceInput:draft.price, imagePath:uploadedImagePath, storedImagePath:oldImagePath }),
        ...buildDigitalProductContentPayload({ contentType:draft.contentType || null, contentPath:uploadedContentPath, storedContentPath:oldContentPath, fileName:selectedContentFile?.name ?? null, storedFileName:compatibleStoredContent ? editing?.content_file_name ?? null : null, mimeType:selectedContentFile?.type ?? null, storedMimeType:compatibleStoredContent ? editing?.content_mime_type ?? null : null, fileSize:selectedContentFile?.size ?? null, storedFileSize:compatibleStoredContent ? editing?.content_size_bytes ?? null : null, isPublished:draft.isPublished }),
      }
      databaseAttempted = true
      let authoritativeId = editing?.id ?? null
      if (editing) { const { data:updated, error:updateError } = await supabase.from('digital_products').update(payload).eq('id', editing.id).select('id').single(); if (updateError) throw updateError; authoritativeId = updated.id }
      else { const { data:created, error:insertError } = await supabase.from('digital_products').insert(payload).select('id').single(); if (insertError) throw insertError; authoritativeId = created.id }
      const cleanupWarnings: string[] = []
      if (oldImagePath && uploadedImagePath && oldImagePath !== uploadedImagePath) { const { error:cleanupError } = await supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).remove([oldImagePath]); if (cleanupError) cleanupWarnings.push('cover lama') }
      if (editing?.content_path && uploadedContentPath && editing.content_path !== uploadedContentPath) { const { error:cleanupError } = await supabase.storage.from(DIGITAL_PRODUCT_CONTENT_BUCKET).remove([editing.content_path]); if (cleanupError) cleanupWarnings.push('materi lama') }
      setSelectedFile(null); setSelectedContentFile(null); setSelectedId(authoritativeId); setNotice(`${editing ? 'Digital Product berhasil diperbarui.' : 'Digital Product berhasil dibuat.'}${cleanupWarnings.length ? ` Tinjau ${cleanupWarnings.join(' dan ')} di Storage karena pembersihan otomatis belum berhasil.` : ''}`); await load(); setCreating(false)
    } catch (caught) {
      let persisted = false
      if (databaseAttempted) { const { data:authoritative } = await supabase.from('digital_products').select('id,image_path,content_path').eq('slug', draft.slug.trim()).maybeSingle(); persisted = Boolean(authoritative && (!uploadedImagePath || authoritative.image_path === uploadedImagePath) && (!uploadedContentPath || authoritative.content_path === uploadedContentPath)) }
      if (!persisted) { const cleanup: PromiseLike<unknown>[] = []; if (uploadedImagePath) cleanup.push(supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).remove([uploadedImagePath])); if (uploadedContentPath) cleanup.push(supabase.storage.from(DIGITAL_PRODUCT_CONTENT_BUCKET).remove([uploadedContentPath])); await Promise.allSettled(cleanup) } else await load()
      setError(databaseAttempted ? digitalProductMutationError(caught) : 'File belum dapat diunggah. Periksa tipe, ukuran, izin Storage, lalu coba lagi.')
    } finally { setBusy(false) }
  }

  async function removeProduct(product: DigitalProduct) {
    if (busy || !window.confirm(`Hapus Digital Product “${product.name}”? Data produk dihapus lebih dulu, lalu asset Storage dibersihkan.`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { error:rowError } = await supabase.from('digital_products').delete().eq('id', product.id).select('id').single(); if (rowError) throw rowError
      setCreating(false); setSelectedId(null); setDraft(emptyDraft); setSelectedFile(null); setSelectedContentFile(null); setFieldErrors({})
      const removals = [supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).remove([product.image_path])]; if (product.content_path) removals.push(supabase.storage.from(DIGITAL_PRODUCT_CONTENT_BUCKET).remove([product.content_path]))
      const results = await Promise.all(removals); setNotice(results.some(result => result.error) ? 'Digital Product sudah dihapus, tetapi sebagian asset Storage perlu ditinjau manual.' : 'Digital Product berhasil dihapus.'); await load()
    } catch (caught) { setError(formError(caught, 'Digital Product belum dapat dihapus. Periksa koneksi lalu coba lagi.')) } finally { setBusy(false) }
  }

  const parsedPrice = parseDigitalProductPriceInput(draft.price)
  const editorPreviewUrl = localPreviewUrl ?? storedPreviewUrl
  const previewSource = localPreviewUrl ? 'local' : storedPreviewUrl ? 'stored' : 'empty'
  const showDedicatedEmptyState = !loading && !setupRequired && !loadFailed && !creating && products.length === 0
  const storedContentCompatible = Boolean(selected?.content_path && selected.content_type === draft.contentType)
  const pageHeader = <header className={dataStyles.pageHeader}><div className={dataStyles.pageHeaderCopy}><p className="kicker">Produk · Digital Product</p><h2>Digital Products</h2><p>Kelola storefront, tipe materi PDF/Video, status publikasi, dan file berbayar yang disimpan secara private.</p></div>{!loading && !setupRequired && !loadFailed && products.length > 0 ? <span className={dataStyles.countPill}><PackageOpen aria-hidden="true" />{products.length} produk</span> : null}</header>

  const editor = (creating || selected) ? <form className={styles.form} onSubmit={save} noValidate aria-busy={busy} data-testid={creating ? 'digital-product-create-mode' : 'digital-product-edit-mode'}>
    <section className={styles.formSection} aria-labelledby="digital-product-information-heading"><div className={styles.sectionHeading}><h3 id="digital-product-information-heading">Informasi produk</h3><p>Atur nama, identifier, dan deskripsi yang tampil pada katalog Digital Product.</p></div><div className={styles.formGrid}><label className={styles.field}>Nama<input data-testid="digital-product-name-input" value={draft.name} onChange={event => updateName(event.target.value)} maxLength={160} aria-invalid={Boolean(fieldErrors.name)} />{fieldErrors.name ? <small className="form-error">{fieldErrors.name}</small> : null}</label><label className={styles.field}>Slug<input data-testid="digital-product-slug-input" value={draft.slug} onChange={event => { setDraft(current => ({ ...current, slug:event.target.value })); setSlugManuallyEdited(true); setFieldErrors(current => ({ ...current, slug:undefined })) }} maxLength={120} aria-invalid={Boolean(fieldErrors.slug)} />{fieldErrors.slug ? <small className="form-error">{fieldErrors.slug}</small> : <small className={styles.helper}>Slug dibuat otomatis sampai diedit manual.</small>}</label><label className={styles.wideField}>Deskripsi<textarea data-testid="digital-product-description-input" value={draft.description} onChange={event => { setDraft(current => ({ ...current, description:event.target.value })); setFieldErrors(current => ({ ...current, description:undefined })) }} rows={6} maxLength={5000} aria-invalid={Boolean(fieldErrors.description)} />{fieldErrors.description ? <small className="form-error">{fieldErrors.description}</small> : null}</label></div></section>
    <section className={styles.formSection} aria-labelledby="digital-product-price-heading"><div className={styles.sectionHeading}><h3 id="digital-product-price-heading">Harga</h3><p>Simpan nilai sebagai Rupiah bulat. Preview formatting tidak mengubah data input.</p></div><label className={styles.field}>Harga<span className={styles.priceControl}><span className={styles.pricePrefix} aria-hidden="true">Rp</span><input data-testid="digital-product-price-input" type="text" inputMode="numeric" value={draft.price} onChange={event => { setDraft(current => ({ ...current, price:event.target.value })); setFieldErrors(current => ({ ...current, price:undefined })) }} placeholder="75000" aria-invalid={Boolean(fieldErrors.price)} /></span>{parsedPrice === null ? <small className={styles.helper}>Gunakan angka Rupiah bulat tanpa simbol atau pemisah ribuan.</small> : <small className={styles.pricePreview}>Preview: {formatDigitalProductPrice(parsedPrice)}</small>}{fieldErrors.price ? <small className="form-error">{fieldErrors.price}</small> : null}</label></section>
    <section className={styles.formSection} aria-labelledby="digital-product-cover-heading"><div className={styles.sectionHeading}><h3 id="digital-product-cover-heading">Cover / poster</h3><p>Cover adalah asset pemasaran publik. File PDF/Video berbayar dikelola terpisah di storage private.</p></div><div className={styles.coverLayout}><div className={styles.coverInput}><label>{selected ? 'Ganti cover' : 'Pilih cover produk'}<input data-testid="digital-product-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { setSelectedFile(event.target.files?.[0] ?? null); setFieldErrors(current => ({ ...current, file:undefined })) }} /></label><small className={styles.helper}>{selected ? 'Cover tersimpan tetap digunakan jika tidak memilih file baru. ' : ''}JPG, PNG, atau WebP · maksimal 5 MB.</small>{fieldErrors.file ? <small className="form-error">{fieldErrors.file}</small> : null}</div><div className={styles.coverPreview} data-testid="digital-product-cover-preview" data-preview-source={previewSource} aria-label="Preview cover Digital Product"><div className={styles.coverPreviewCanvas}>{editorPreviewUrl ? <Image src={editorPreviewUrl} alt={draft.name ? `Cover ${draft.name}` : 'Preview cover Digital Product'} fill sizes="(max-width: 768px) 80vw, 280px" unoptimized /> : <div className={styles.coverPreviewEmpty}><ImagePlus aria-hidden="true" /><span>{previewLoading ? 'Memuat cover tersimpan…' : 'Pilih cover untuk melihat preview.'}</span></div>}</div><p>{localPreviewUrl ? 'Preview cover baru.' : selected ? 'Cover tersimpan saat ini.' : 'Preview akan muncul di sini sebelum data disimpan.'}</p></div></div></section>
    <section className={styles.formSection} aria-labelledby="digital-product-content-heading"><div className={styles.sectionHeading}><h3 id="digital-product-content-heading">Materi terlindungi</h3><p>Pilih Jenis Produk dan upload source berbayar. Asset ini tidak menggunakan public URL permanen.</p></div><fieldset className={styles.contentTypeFieldset}><legend>Jenis Produk</legend><div className={styles.typeOptions}><label className={draft.contentType === 'pdf' ? styles.typeOptionActive : styles.typeOption}><input type="radio" name="content-type" value="pdf" checked={draft.contentType === 'pdf'} onChange={() => { setDraft(current => ({ ...current, contentType:'pdf' })); setSelectedContentFile(null); setContentError('') }} /><FileText aria-hidden="true" /> PDF</label><label className={draft.contentType === 'video' ? styles.typeOptionActive : styles.typeOption}><input type="radio" name="content-type" value="video" checked={draft.contentType === 'video'} onChange={() => { setDraft(current => ({ ...current, contentType:'video' })); setSelectedContentFile(null); setContentError('') }} /><PlayCircle aria-hidden="true" /> Video</label></div></fieldset>{draft.contentType ? <label className={styles.field}>{draft.contentType === 'pdf' ? 'PDF source' : 'Video source'}<input data-testid="digital-product-content-input" type="file" accept={draft.contentType === 'pdf' ? 'application/pdf,.pdf' : 'video/mp4,video/webm,.mp4,.webm'} onChange={event => { setSelectedContentFile(event.target.files?.[0] ?? null); setContentError('') }} /><small className={styles.helper}>{storedContentCompatible ? `Materi tersimpan: ${selected?.content_file_name ?? 'file terlindungi'}${formatFileSize(selected?.content_size_bytes ?? null) ? ` · ${formatFileSize(selected?.content_size_bytes ?? null)}` : ''}. Pilih file baru hanya untuk mengganti.` : draft.contentType === 'pdf' ? 'PDF · maksimal 500 MB.' : 'MP4 atau WebM · maksimal 500 MB.'}</small></label> : null}{selectedContentFile ? <div className={styles.protectedFileSummary}><ShieldCheck aria-hidden="true" /><span><strong>{selectedContentFile.name}</strong>{formatFileSize(selectedContentFile.size)} · {selectedContentFile.type}</span></div> : null}{contentError ? <small className="form-error" data-testid="digital-product-content-error">{contentError}</small> : null}<label className={styles.publishToggle}><input type="checkbox" checked={draft.isPublished} onChange={event => { setDraft(current => ({ ...current, isPublished:event.target.checked })); setContentError('') }} /><span><strong>Publikasikan di storefront</strong><small>Produk draft tetap dapat dikelola admin. Publikasi memerlukan jenis dan file materi terlindungi.</small></span></label></section>
    <div className={styles.formActions}><button data-testid="digital-product-save-button" className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : creating ? 'Buat Digital Product' : 'Simpan perubahan'}</button><button type="button" className="button button-outline" onClick={closeEditor} disabled={busy}>Batal</button>{!creating && selected ? <button type="button" className={`button button-outline ${styles.deleteButton}`} onClick={() => void removeProduct(selected)} disabled={busy} data-testid="digital-product-delete-button"><Trash2 aria-hidden="true" /> Hapus</button> : null}</div>{error ? <p className={`${styles.feedback} ${styles.errorFeedback}`} role="alert" data-testid="digital-product-error">{error}</p> : null}{notice ? <p className={`${styles.feedback} ${styles.successFeedback}`} role="status" data-testid="digital-product-notice">{notice}</p> : null}
  </form> : null

  const productDialog = editorOpen ? <dialog ref={dialogRef} className={dialogStyles.dialog} aria-labelledby="digital-product-dialog-heading" data-testid="digital-product-dialog" onClose={resetEditorState} onCancel={event => { if (busy) event.preventDefault() }} onClick={event => { if (event.target === event.currentTarget && !busy) event.currentTarget.close() }}><div className={dialogStyles.panel}><header className={dialogStyles.header}><div><p className="kicker">{creating ? 'Digital Product baru' : 'Edit Digital Product'}</p><h2 id="digital-product-dialog-heading">{creating ? 'Buat Digital Product' : selected?.name || 'Kelola Digital Product'}</h2></div><button type="button" className={`role-close ${dialogStyles.closeButton}`} onClick={closeEditor} disabled={busy} aria-label="Tutup editor Digital Product" data-testid="digital-product-dialog-close" autoFocus><X aria-hidden="true" /></button></header><div className={dialogStyles.body}>{editor}</div></div></dialog> : null

  if (loading) return <section className={dataStyles.page} data-testid="digital-product-management" aria-busy="true">{pageHeader}<div className={styles.stateCard} role="status"><RefreshCw aria-hidden="true" /><h3>Memuat Digital Products…</h3><p>Menyiapkan daftar produk, cover, dan editor.</p></div></section>
  if (setupRequired) return <section className={dataStyles.page} data-testid="digital-product-management" aria-busy={busy}>{pageHeader}<div className={styles.stateCard} role="alert" data-testid="digital-product-setup-required"><PackageOpen aria-hidden="true" /><h3>Setup database diperlukan.</h3><p>Migration <code>{migrationName}</code> perlu diterapkan pada project Supabase yang digunakan deployment ini sebelum Digital Product dapat dikelola.</p><button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Coba lagi</button></div></section>
  if (loadFailed) return <section className={dataStyles.page} data-testid="digital-product-management" aria-busy={busy}>{pageHeader}<div className={styles.stateCard} role="alert" data-testid="digital-product-load-error"><RefreshCw aria-hidden="true" /><h3>Digital Products belum dapat dimuat.</h3><p>{error}</p><button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Coba lagi</button></div></section>
  if (showDedicatedEmptyState) return <section className={dataStyles.page} data-testid="digital-product-management" aria-busy={busy}>{pageHeader}<div className={styles.emptyState} data-testid="digital-product-empty-state"><div className={styles.emptyContent}><span className={styles.emptyIcon}><PackageOpen aria-hidden="true" /></span><h3>Belum ada Digital Product</h3><p>Buat produk digital pertama, pilih PDF atau Video, upload materi private, lalu publikasikan saat siap.</p><button type="button" className="button button-primary" onClick={beginCreate}><Plus aria-hidden="true" /> Buat Digital Product</button><div className={styles.emptyChips} aria-label="Status Digital Product"><span>PDF / Video</span><span>Private content</span><span>Draft / Published</span></div>{notice ? <p className={`${styles.feedback} ${styles.successFeedback}`} role="status" data-testid="digital-product-notice">{notice}</p> : null}</div></div></section>

  return <section className={dataStyles.page} data-testid="digital-product-management" aria-busy={busy}>
    {pageHeader}
    <div className={dataStyles.surface} data-testid="digital-product-list-surface">
      <div className={dataStyles.surfaceHeader}><div className={dataStyles.surfaceHeaderCopy}><p className="kicker">Daftar produk</p><h3>{products.length} Digital Product</h3><p>Cari produk, periksa jenis/status materi, lalu pilih Kelola untuk membuka editor.</p></div><button type="button" className="button button-primary" onClick={beginCreate} disabled={busy}><Plus aria-hidden="true" /> Digital Product baru</button></div>
      <div className={dataStyles.toolbar}><label className={dataStyles.searchField}>Cari produk<span className={dataStyles.searchControl}><Search aria-hidden="true" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setProductPage(0) }} placeholder="Cari nama, slug, deskripsi, jenis, atau harga" /></span></label></div>
      {filteredProducts.length === 0 ? <div className={dataStyles.empty}>Tidak ada Digital Product yang sesuai dengan pencarian.</div> : <div className={dataStyles.tableScroll} data-testid="digital-product-table-scroll"><table className={`${dataStyles.table} ${dataStyles.productTable}`} data-testid="digital-product-table"><thead><tr><SortableTableHeader label="Produk" sortKey="product" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Jenis" sortKey="type" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Harga" sortKey="price" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Materi terlindungi" sortKey="content" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Diperbarui" sortKey="updated_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th scope="col" className={dataStyles.actionCell}>Aksi</th></tr></thead><tbody>{pagedProducts.map(product => {
        const coverUrl = supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).getPublicUrl(product.image_path).data.publicUrl
        const contentReady = Boolean(product.content_type && product.content_path && product.content_mime_type)
        return <tr key={product.id} data-testid="digital-product-row"><td><div className={styles.tableProductIdentity}><div className={styles.tableThumbnail}><Image src={coverUrl} alt="" fill sizes="54px" unoptimized /></div><div className={dataStyles.identityText}><strong className={dataStyles.primaryText}>{product.name}</strong><span className={dataStyles.descriptionText}>/{product.slug}</span></div></div></td><td><span className={`${dataStyles.badge} ${product.content_type ? dataStyles.successBadge : dataStyles.warningBadge}`}>{product.content_type ? product.content_type.toUpperCase() : 'Belum diatur'}</span></td><td><strong className={dataStyles.primaryText}>{formatDigitalProductPrice(product.price_amount)}</strong></td><td><span className={`${dataStyles.badge} ${product.is_published ? dataStyles.successBadge : dataStyles.warningBadge}`}>{product.is_published ? 'Published' : 'Draft'}</span></td><td><span className={`${dataStyles.badge} ${contentReady ? dataStyles.successBadge : dataStyles.warningBadge}`}>{contentReady ? 'Siap' : 'Belum ada'}</span></td><td><time className={dataStyles.dateCell} dateTime={product.updated_at}>{formatUpdatedAt(product.updated_at)}</time></td><td className={dataStyles.actionCell}><div className={styles.tableActions}>{product.is_published ? <a className={`button button-outline ${dataStyles.actionButton}`} href={`/produk-digital/${product.slug}`} target="_blank" rel="noreferrer">Preview</a> : null}<button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={() => beginEdit(product.id)} data-testid={`digital-product-manage-${product.id}`}>Kelola</button></div></td></tr>
      })}</tbody></table></div>}
      <TablePagination page={productPage} pageSize={PRODUCT_PAGE_SIZE} totalItems={filteredProducts.length} onPageChange={setProductPage} disabled={busy} label="Pagination Digital Product" />
    </div>
    {productDialog}
  </section>
}
