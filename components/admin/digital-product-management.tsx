'use client'

import Image from 'next/image'
import { FileText, ImagePlus, PackageOpen, PlayCircle, Plus, RefreshCw, Search, ShieldCheck, Star, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { ImageFitEditor } from '@/components/admin/image-fit-editor'
import { adminFormError as formError } from '@/lib/auth/errors'
import {
  buildDigitalProductContentPath,
  buildDigitalProductContentPayload,
  buildDigitalProductNormalizedImagePath,
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
import {
  DIGITAL_PRODUCT_CONTENT_BUCKET,
  DIGITAL_PRODUCT_COVER_HEIGHT,
  DIGITAL_PRODUCT_COVER_MAX_DECODED_PIXELS,
  DIGITAL_PRODUCT_COVER_MAX_ZOOM,
  DIGITAL_PRODUCT_COVER_MIN_ZOOM,
  DIGITAL_PRODUCT_COVER_WEBP_QUALITY,
  DIGITAL_PRODUCT_COVER_WIDTH,
  DIGITAL_PRODUCT_IMAGE_BUCKET,
} from '@/lib/digital-products/config'
import { DEFAULT_IMAGE_FIT, fitImageToWebP, type ImageFit } from '@/lib/media/image-fit'
import { createClient } from '@/lib/supabase/client'
import type { DigitalProduct } from '@/lib/supabase/database.types'
import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './digital-product-management.module.css'
import { SortableTableHeader, type SortDirection } from './sortable-table-header'
import { TablePagination } from './table-pagination'
import { DigitalProductRatingManagement } from './digital-product-rating-management'

const migrationName = '202610040002_digital_product_reference_pricing.sql'
const PRODUCT_PAGE_SIZE = 10
type ProductSortKey = 'product' | 'type' | 'price' | 'status' | 'homepage' | 'content' | 'updated_at'
type Draft = { name:string; slug:string; description:string; price:string; referencePrice:string; contentType:DigitalProductContentType|''; isPublished:boolean; homepageFeatured:boolean; homepageOrder:string; showSalesCount:boolean }
const emptyDraft: Draft = { name: '', slug: '', description: '', price: '', referencePrice: '', contentType: '', isPublished: false, homepageFeatured: false, homepageOrder: '0', showSalesCount: false }
function formatUpdatedAt(value: string) { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) }
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
  const [coverFit, setCoverFit] = useState<ImageFit>({ ...DEFAULT_IMAGE_FIT })
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
  const [ratingProductId, setRatingProductId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const initialDraftRef = useRef(JSON.stringify(emptyDraft))

  const selected = useMemo(() => products.find(product => product.id === selectedId) ?? null, [products, selectedId])
  const ratingProduct = useMemo(() => products.find(product => product.id === ratingProductId) ?? null, [products, ratingProductId])
  const selectedImagePath = selected?.image_path ?? null
  const filteredProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('id-ID')
    if (!term) return products
    return products.filter(product => `${product.name} ${product.description} ${product.price_amount} ${product.reference_price_amount ?? ''} ${product.content_type ?? ''}`.toLocaleLowerCase('id-ID').includes(term))
  }, [products, query])
  const sortedProducts = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredProducts
    const sign = sortDirection === 'asc' ? 1 : -1
    return [...filteredProducts].sort((a, b) => {
      if (sortKey === 'price') return (a.price_amount - b.price_amount) * sign
      if (sortKey === 'updated_at') return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * sign
      if (sortKey === 'homepage') {
        const left = a.homepage_featured ? a.homepage_featured_order : Number.MAX_SAFE_INTEGER
        const right = b.homepage_featured ? b.homepage_featured_order : Number.MAX_SAFE_INTEGER
        return (left - right) * sign
      }
      const contentReady = (product: DigitalProduct) => Boolean(product.content_type && product.content_path && product.content_mime_type)
      if (sortKey === 'status') return (Number(a.is_published) - Number(b.is_published)) * sign
      if (sortKey === 'content') return (Number(contentReady(a)) - Number(contentReady(b))) * sign
      const left = sortKey === 'product' ? a.name : (a.content_type ?? '')
      const right = sortKey === 'product' ? b.name : (b.content_type ?? '')
      return left.localeCompare(right, 'id-ID') * sign
    })
  }, [filteredProducts, sortDirection, sortKey])
  const pagedProducts = useMemo(() => sortedProducts.slice(productPage * PRODUCT_PAGE_SIZE, productPage * PRODUCT_PAGE_SIZE + PRODUCT_PAGE_SIZE), [productPage, sortedProducts])
  const editorOpen = creating || selectedId !== null

  const load = useCallback(async () => {
    setLoading(true); setError(''); setSetupRequired(false); setLoadFailed(false)
    const { data, error: loadError } = await supabase.from('digital_products').select('id,name,slug,description,image_path,price_amount,reference_price_amount,content_type,content_path,content_mime_type,content_file_name,content_size_bytes,page_count,duration_seconds,is_published,homepage_featured,homepage_featured_order,show_sales_count,show_rating,created_at,updated_at').order('name', { ascending: true }).order('id', { ascending: true })
    if (loadError) {
      setProducts([])
      if (isDigitalProductSetupRequired(loadError)) setSetupRequired(true)
      else { setLoadFailed(true); setError(formError(loadError, 'Unable to load digital products. Check your connection and try again.')) }
    } else {
      const next = data ?? []; setProducts(next); setSelectedId(current => current && next.some(product => product.id === current) ? current : null)
    }
    setLoading(false)
  }, [supabase])
  useEffect(() => { void load() }, [load])
  useEffect(() => { const lastPage = Math.max(0, Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE) - 1); if (productPage > lastPage) setProductPage(lastPage) }, [filteredProducts.length, productPage])
  useEffect(() => {
    if (creating || !selected) return
    const nextDraft: Draft = { name:selected.name, slug:selected.slug, description:selected.description, price:String(selected.price_amount), referencePrice:selected.reference_price_amount == null ? '' : String(selected.reference_price_amount), contentType:selected.content_type ?? '', isPublished:selected.is_published, homepageFeatured:selected.homepage_featured, homepageOrder:String(selected.homepage_featured_order), showSalesCount:selected.show_sales_count ?? false }
    initialDraftRef.current = JSON.stringify(nextDraft)
    setDraft(nextDraft)
    setSlugManuallyEdited(true); setSelectedFile(null); setCoverFit({ ...DEFAULT_IMAGE_FIT }); setSelectedContentFile(null); setContentError(''); setFieldErrors({})
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
      if (signedUrlError) { setError(formError(signedUrlError, 'The cover is saved, but its preview could not be loaded.')); return }
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
  function beginCreate() { initialDraftRef.current = JSON.stringify(emptyDraft); setCreating(true); setSelectedId(null); setDraft(emptyDraft); setSlugManuallyEdited(false); setSelectedFile(null); setCoverFit({ ...DEFAULT_IMAGE_FIT }); setSelectedContentFile(null); setContentError(''); setFieldErrors({}); setError(''); setNotice('') }
  function beginEdit(id: string) { setCreating(false); setSelectedId(id); setSlugManuallyEdited(true); setSelectedFile(null); setCoverFit({ ...DEFAULT_IMAGE_FIT }); setSelectedContentFile(null); setContentError(''); setFieldErrors({}); setError(''); setNotice('') }
  function closeEditor() {
    if (busy) return
    const dirty = JSON.stringify(draft) !== initialDraftRef.current || Boolean(selectedFile || selectedContentFile)
    if (dirty && !window.confirm('Discard unsaved changes? Your edits and selected files will be lost.')) return
    dialogRef.current?.close()
  }
  function resetEditorState() { setCreating(false); setSelectedId(null); setSelectedFile(null); setCoverFit({ ...DEFAULT_IMAGE_FIT }); setSelectedContentFile(null); setContentError(''); setStoredPreviewUrl(null); setFieldErrors({}); setError('') }
  function updateName(name: string) { setDraft(current => ({ ...current, name, slug:creating && !slugManuallyEdited ? normalizeDigitalProductSlug(name) : current.slug })); setFieldErrors(current => ({ ...current, name:undefined, ...(creating && !slugManuallyEdited ? { slug:undefined } : {}) })) }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const editing = creating ? null : selected
    const validation = validateDigitalProductDraft({ name:draft.name, slug:draft.slug, description:draft.description, priceInput:draft.price, referencePriceInput:draft.referencePrice, file:selectedFile, hasStoredImage:Boolean(editing?.image_path) })
    const compatibleStoredContent = Boolean(editing?.content_path && editing.content_type === draft.contentType)
    const nextContentError = draft.contentType ? validateDigitalProductContentFile({ file:selectedContentFile, contentType:draft.contentType, hasStoredContent:compatibleStoredContent, publishing:draft.isPublished }) ?? '' : 'Select PDF or Video as the product type.'
    setFieldErrors(validation); setContentError(nextContentError); setError(''); setNotice('')
    if (Object.keys(validation).length > 0 || nextContentError) return
    const oldImagePath = editing?.image_path ?? null
    const oldContentPath = compatibleStoredContent ? editing?.content_path ?? null : null
    let uploadedImagePath: string | null = null, uploadedContentPath: string | null = null, databaseAttempted = false
    setBusy(true)
    try {
      if (selectedFile) {
        const normalizedCover = await fitImageToWebP(selectedFile, {
          width: DIGITAL_PRODUCT_COVER_WIDTH,
          height: DIGITAL_PRODUCT_COVER_HEIGHT,
          minZoom: DIGITAL_PRODUCT_COVER_MIN_ZOOM,
          maxZoom: DIGITAL_PRODUCT_COVER_MAX_ZOOM,
          quality: DIGITAL_PRODUCT_COVER_WEBP_QUALITY,
          maxDecodedPixels: DIGITAL_PRODUCT_COVER_MAX_DECODED_PIXELS,
        }, coverFit)
        uploadedImagePath = buildDigitalProductNormalizedImagePath(selectedFile.name)
        const { error: uploadError } = await supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).upload(uploadedImagePath, normalizedCover, { cacheControl:'3600', contentType:'image/webp', upsert:false })
        if (uploadError) throw uploadError
      }
      if (selectedContentFile) { uploadedContentPath = buildDigitalProductContentPath(selectedContentFile.name); const { error: contentUploadError } = await supabase.storage.from(DIGITAL_PRODUCT_CONTENT_BUCKET).upload(uploadedContentPath, selectedContentFile, { cacheControl:'3600', upsert:false }); if (contentUploadError) throw contentUploadError }
      const payload = {
        ...buildDigitalProductPayload({ name:draft.name, slug:draft.slug, description:draft.description, priceInput:draft.price, referencePriceInput:draft.referencePrice, imagePath:uploadedImagePath, storedImagePath:oldImagePath }),
        ...buildDigitalProductContentPayload({ contentType:draft.contentType || null, contentPath:uploadedContentPath, storedContentPath:oldContentPath, fileName:selectedContentFile?.name ?? null, storedFileName:compatibleStoredContent ? editing?.content_file_name ?? null : null, mimeType:selectedContentFile?.type ?? null, storedMimeType:compatibleStoredContent ? editing?.content_mime_type ?? null : null, fileSize:selectedContentFile?.size ?? null, storedFileSize:compatibleStoredContent ? editing?.content_size_bytes ?? null : null, isPublished:draft.isPublished }),
        homepage_featured: draft.homepageFeatured,
        homepage_featured_order: Math.min(9999, Math.max(0, Number.parseInt(draft.homepageOrder || '0', 10) || 0)),
        show_sales_count: draft.showSalesCount,
      }
      databaseAttempted = true
      let authoritativeId = editing?.id ?? null
      if (editing) { const { data:updated, error:updateError } = await supabase.from('digital_products').update(payload).eq('id', editing.id).select('id').single(); if (updateError) throw updateError; authoritativeId = updated.id }
      else { const { data:created, error:insertError } = await supabase.from('digital_products').insert(payload).select('id').single(); if (insertError) throw insertError; authoritativeId = created.id }
      const cleanupWarnings: string[] = []
      if (oldImagePath && uploadedImagePath && oldImagePath !== uploadedImagePath) { const { error:cleanupError } = await supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).remove([oldImagePath]); if (cleanupError) cleanupWarnings.push('old cover') }
      if (editing?.content_path && uploadedContentPath && editing.content_path !== uploadedContentPath) { const { error:cleanupError } = await supabase.storage.from(DIGITAL_PRODUCT_CONTENT_BUCKET).remove([editing.content_path]); if (cleanupError) cleanupWarnings.push('old content file') }
      setSelectedFile(null); setSelectedContentFile(null); setSelectedId(authoritativeId); setNotice(`${editing ? 'Digital product updated.' : 'Digital product created.'}${cleanupWarnings.length ? ` Review the ${cleanupWarnings.join(' and ')} in storage; automatic cleanup did not complete.` : ''}`); await load(); setCreating(false)
    } catch (caught) {
      let persisted = false
      if (databaseAttempted) { const { data:authoritative } = await supabase.from('digital_products').select('id,image_path,content_path').eq('slug', draft.slug.trim()).maybeSingle(); persisted = Boolean(authoritative && (!uploadedImagePath || authoritative.image_path === uploadedImagePath) && (!uploadedContentPath || authoritative.content_path === uploadedContentPath)) }
      if (!persisted) { const cleanup: PromiseLike<unknown>[] = []; if (uploadedImagePath) cleanup.push(supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).remove([uploadedImagePath])); if (uploadedContentPath) cleanup.push(supabase.storage.from(DIGITAL_PRODUCT_CONTENT_BUCKET).remove([uploadedContentPath])); await Promise.allSettled(cleanup) } else await load()
      setError(databaseAttempted ? digitalProductMutationError(caught) : 'Unable to upload the file. Check its type, size, and storage permissions, then try again.')
    } finally { setBusy(false) }
  }

  async function removeProduct(product: DigitalProduct) {
    if (busy || !window.confirm(`Delete digital product “${product.name}”? The product record will be deleted, then its stored files will be removed.`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { error:rowError } = await supabase.from('digital_products').delete().eq('id', product.id).select('id').single(); if (rowError) throw rowError
      setCreating(false); setSelectedId(null); setDraft(emptyDraft); setSelectedFile(null); setSelectedContentFile(null); setFieldErrors({})
      const removals = [supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).remove([product.image_path])]; if (product.content_path) removals.push(supabase.storage.from(DIGITAL_PRODUCT_CONTENT_BUCKET).remove([product.content_path]))
      const results = await Promise.all(removals); setNotice(results.some(result => result.error) ? 'The digital product was deleted, but some stored files require manual cleanup.' : 'Digital product deleted.'); await load()
    } catch (caught) { setError(formError(caught, 'Unable to delete the digital product. Check your connection and try again.')) } finally { setBusy(false) }
  }

  const parsedPrice = parseDigitalProductPriceInput(draft.price)
  const parsedReferencePrice = draft.referencePrice.trim() ? parseDigitalProductPriceInput(draft.referencePrice) : null
  const editorPreviewUrl = localPreviewUrl ?? storedPreviewUrl
  const previewSource = localPreviewUrl ? 'local' : storedPreviewUrl ? 'stored' : 'empty'
  const showDedicatedEmptyState = !loading && !setupRequired && !loadFailed && !creating && products.length === 0
  const storedContentCompatible = Boolean(selected?.content_path && selected.content_type === draft.contentType)
  const pageHeader = <header className={dataStyles.pageHeader}><div className={dataStyles.pageHeaderCopy}><h2>Digital Products</h2></div>{!loading && !setupRequired && !loadFailed && products.length > 0 ? <span className={dataStyles.countPill}><PackageOpen aria-hidden="true" />{products.length} products</span> : null}</header>

  const editor = (creating || selected) ? <form className={styles.form} onSubmit={save} noValidate aria-busy={busy} data-testid={creating ? 'digital-product-create-mode' : 'digital-product-edit-mode'}><fieldset className={dataStyles.editableFields} disabled={busy}>
    <section className={styles.formSection} aria-labelledby="digital-product-information-heading"><div className={styles.sectionHeading}><h3 id="digital-product-information-heading">Product information</h3><p>Enter the name and description shown in the digital product catalog.</p></div><div className={styles.formGrid}><label className={styles.field}>Product name<input data-testid="digital-product-name-input" value={draft.name} onChange={event => updateName(event.target.value)} maxLength={160} aria-invalid={Boolean(fieldErrors.name)} />{fieldErrors.name ? <small className="form-error">{fieldErrors.name}</small> : null}</label><label className={styles.wideField}>Description<textarea data-testid="digital-product-description-input" value={draft.description} onChange={event => { setDraft(current => ({ ...current, description:event.target.value })); setFieldErrors(current => ({ ...current, description:undefined })) }} rows={6} maxLength={5000} aria-invalid={Boolean(fieldErrors.description)} />{fieldErrors.description ? <small className="form-error">{fieldErrors.description}</small> : null}</label></div></section>
    <section className={styles.formSection} aria-labelledby="digital-product-price-heading"><div className={styles.sectionHeading}><h3 id="digital-product-price-heading">Pricing</h3><p>The selling price is charged at checkout. The optional reference price is crossed out and must be at least the selling price.</p></div><div className={styles.formGrid}><label className={styles.field}>Selling price<span className={styles.priceControl}><span className={styles.pricePrefix} aria-hidden="true">Rp</span><input data-testid="digital-product-price-input" type="text" inputMode="numeric" value={draft.price} onChange={event => { setDraft(current => ({ ...current, price:event.target.value })); setFieldErrors(current => ({ ...current, price:undefined, referencePrice:undefined })) }} placeholder="100000" aria-invalid={Boolean(fieldErrors.price)} /></span>{parsedPrice === null ? <small className={styles.helper}>Enter a whole Rupiah amount without symbols or thousands separators.</small> : <small className={styles.pricePreview}>Preview: {formatDigitalProductPrice(parsedPrice)}</small>}{fieldErrors.price ? <small className="form-error">{fieldErrors.price}</small> : null}</label><label className={styles.field}>Reference price (optional)<span className={styles.priceControl}><span className={styles.pricePrefix} aria-hidden="true">Rp</span><input data-testid="digital-product-reference-price-input" type="text" inputMode="numeric" value={draft.referencePrice} onChange={event => { setDraft(current => ({ ...current, referencePrice:event.target.value })); setFieldErrors(current => ({ ...current, referencePrice:undefined })) }} placeholder="150000" aria-invalid={Boolean(fieldErrors.referencePrice)} /></span>{!draft.referencePrice.trim() ? <small className={styles.helper}>Leave empty if the product has no reference price.</small> : parsedReferencePrice === null ? <small className={styles.helper}>Enter a whole Rupiah amount without symbols or thousands separators.</small> : <small className={styles.pricePreview}>Preview: {formatDigitalProductPrice(parsedReferencePrice)}</small>}{fieldErrors.referencePrice ? <small className="form-error">{fieldErrors.referencePrice}</small> : null}</label></div></section>
    <section className={styles.formSection} aria-labelledby="digital-product-cover-heading">
      <div className={styles.sectionHeading}>
        <h3 id="digital-product-cover-heading">Cover / poster</h3>
        <p>Covers use the same 4:5 frame as storefront cards. Paid PDF and video files are stored separately and privately.</p>
      </div>
      <div className={styles.coverLayout}>
        <div className={styles.coverInput}>
          <label>
            {selected ? 'Replace cover' : 'Select product cover'}
            <input
              data-testid="digital-product-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={event => {
                setSelectedFile(event.target.files?.[0] ?? null)
                setCoverFit({ ...DEFAULT_IMAGE_FIT })
                setFieldErrors(current => ({ ...current, file:undefined }))
              }}
            />
          </label>
          <small className={styles.helper}>
            {selected ? 'The saved cover is retained unless you select a new file. ' : ''}
            JPG, PNG, or WebP · maximum 5 MB. New covers are saved as 1000 × 1250 px WebP images.
          </small>
          {fieldErrors.file ? <small className="form-error">{fieldErrors.file}</small> : null}
        </div>
        <div className={styles.coverPreview} data-testid="digital-product-cover-preview" data-preview-source={previewSource} aria-label="Digital product cover preview">
          {editorPreviewUrl ? (
            <ImageFitEditor
              src={editorPreviewUrl}
              alt={draft.name ? `Cover ${draft.name}` : 'Digital product cover preview'}
              fit={coverFit}
              onFitChange={setCoverFit}
              targetWidth={DIGITAL_PRODUCT_COVER_WIDTH}
              targetHeight={DIGITAL_PRODUCT_COVER_HEIGHT}
              minZoom={DIGITAL_PRODUCT_COVER_MIN_ZOOM}
              maxZoom={DIGITAL_PRODUCT_COVER_MAX_ZOOM}
              editable={Boolean(!busy && selectedFile && localPreviewUrl)}
              testId="digital-product-cover-fit-editor"
            />
          ) : (
            <div className={styles.coverPreviewEmpty}>
              <ImagePlus aria-hidden="true" />
              <span>{previewLoading ? 'Loading saved cover…' : 'Select a cover to preview it.'}</span>
            </div>
          )}
          <p>{localPreviewUrl ? 'This preview shows the 4:5 crop that will be saved and displayed on storefront cards.' : selected ? 'Current saved cover.' : 'Your preview appears here before saving.'}</p>
        </div>
      </div>
    </section>
    <section className={styles.formSection} aria-labelledby="digital-product-content-heading"><div className={styles.sectionHeading}><h3 id="digital-product-content-heading">Protected content</h3><p>Select a product type and upload the paid content file. Access uses temporary private links.</p></div><fieldset className={styles.contentTypeFieldset}><legend>Product type</legend><div className={styles.typeOptions}><label className={draft.contentType === 'pdf' ? styles.typeOptionActive : styles.typeOption}><input type="radio" name="content-type" value="pdf" checked={draft.contentType === 'pdf'} onChange={() => { setDraft(current => ({ ...current, contentType:'pdf' })); setSelectedContentFile(null); setContentError('') }} /><FileText aria-hidden="true" /> PDF</label><label className={draft.contentType === 'video' ? styles.typeOptionActive : styles.typeOption}><input type="radio" name="content-type" value="video" checked={draft.contentType === 'video'} onChange={() => { setDraft(current => ({ ...current, contentType:'video' })); setSelectedContentFile(null); setContentError('') }} /><PlayCircle aria-hidden="true" /> Video</label></div></fieldset>{draft.contentType ? <label className={styles.field}>{draft.contentType === 'pdf' ? 'PDF source' : 'Video source'}<input data-testid="digital-product-content-input" type="file" accept={draft.contentType === 'pdf' ? 'application/pdf,.pdf' : 'video/mp4,video/webm,.mp4,.webm'} onChange={event => { setSelectedContentFile(event.target.files?.[0] ?? null); setContentError('') }} /><small className={styles.helper}>{storedContentCompatible ? `Saved content: ${selected?.content_file_name ?? 'protected file'}${formatFileSize(selected?.content_size_bytes ?? null) ? ` · ${formatFileSize(selected?.content_size_bytes ?? null)}` : ''}. Select a new file only to replace it.` : draft.contentType === 'pdf' ? 'PDF · maximum 500 MB.' : 'MP4 or WebM · maximum 500 MB.'}</small></label> : null}{selectedContentFile ? <div className={styles.protectedFileSummary}><ShieldCheck aria-hidden="true" /><span><strong>{selectedContentFile.name}</strong>{formatFileSize(selectedContentFile.size)} · {selectedContentFile.type}</span></div> : null}{contentError ? <small className="form-error" data-testid="digital-product-content-error">{contentError}</small> : null}<label className={styles.publishToggle}><input type="checkbox" checked={draft.isPublished} onChange={event => { setDraft(current => ({ ...current, isPublished:event.target.checked })); setContentError('') }} /><span><strong>Publish to storefront</strong><small>Drafts remain available to administrators. Publishing requires a product type and protected content file.</small></span></label></section>
    <section className={styles.formSection} aria-labelledby="digital-product-homepage-heading"><div className={styles.sectionHeading}><h3 id="digital-product-homepage-heading">Homepage showcase</h3><p>Up to five published products with the lowest display orders appear in the homepage Card Swap.</p></div><label className={styles.publishToggle}><input data-testid="digital-product-homepage-featured" type="checkbox" checked={draft.homepageFeatured} onChange={event => setDraft(current => ({ ...current, homepageFeatured:event.target.checked }))} /><span><strong>Show in homepage Card Swap</strong><small>Admin can change the selection without changing website code.</small></span></label><label className={styles.field}>Card Swap order<input data-testid="digital-product-homepage-order" type="number" min={0} max={9999} step={1} value={draft.homepageOrder} disabled={!draft.homepageFeatured} onChange={event => setDraft(current => ({ ...current, homepageOrder:event.target.value }))} /><small className={styles.helper}>Lower numbers appear first. 0 is the highest priority.</small></label><label className={styles.publishToggle}><input data-testid="digital-product-show-sales-count" type="checkbox" checked={draft.showSalesCount} onChange={event => setDraft(current => ({ ...current, showSalesCount:event.target.checked }))} /><span><strong>Show paid sales count publicly</strong><small>Sales counts remain hidden unless this explicit product-level flag is enabled.</small></span></label></section>
    <div className={styles.formActions}><button data-testid="digital-product-save-button" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : creating ? 'Create digital product' : 'Save changes'}</button><button type="button" className="button button-outline" onClick={closeEditor} disabled={busy}>Cancel</button>{!creating && selected ? <button type="button" className={`button button-outline ${styles.deleteButton}`} onClick={() => void removeProduct(selected)} disabled={busy} data-testid="digital-product-delete-button"><Trash2 aria-hidden="true" /> Delete</button> : null}</div>{error ? <p className={`${styles.feedback} ${styles.errorFeedback}`} role="alert" data-testid="digital-product-error">{error}</p> : null}{notice ? <p className={`${styles.feedback} ${styles.successFeedback}`} role="status" data-testid="digital-product-notice">{notice}</p> : null}
  </fieldset></form> : null

  const productDialog = editorOpen ? <dialog ref={dialogRef} className={dialogStyles.dialog} aria-labelledby="digital-product-dialog-heading" data-testid="digital-product-dialog" onClose={resetEditorState} onCancel={event => { event.preventDefault(); closeEditor() }} onClick={event => { if (event.target === event.currentTarget) closeEditor() }}><div className={dialogStyles.panel}><header className={dialogStyles.header}><div><h2 id="digital-product-dialog-heading">{creating ? 'Create digital product' : selected?.name || 'Manage digital product'}</h2></div><button type="button" className={`role-close ${dialogStyles.closeButton}`} onClick={closeEditor} disabled={busy} aria-label="Close digital product editor" data-testid="digital-product-dialog-close" autoFocus><X aria-hidden="true" /></button></header><div className={dialogStyles.body}>{editor}</div></div></dialog> : null

  if (loading) return <section className={dataStyles.page} data-testid="digital-product-management" aria-busy="true">{pageHeader}<div className={styles.stateCard} role="status"><RefreshCw aria-hidden="true" /><h3>Loading digital products…</h3><p>Loading products and covers.</p></div></section>
  if (setupRequired) return <section className={dataStyles.page} data-testid="digital-product-management" aria-busy={busy}>{pageHeader}<div className={styles.stateCard} role="alert" data-testid="digital-product-setup-required"><PackageOpen aria-hidden="true" /><h3>Database setup required.</h3><p>Apply migration <code>{migrationName}</code> to this deployment’s Supabase project before managing digital products.</p><button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Try again</button></div></section>
  if (loadFailed) return <section className={dataStyles.page} data-testid="digital-product-management" aria-busy={busy}>{pageHeader}<div className={styles.stateCard} role="alert" data-testid="digital-product-load-error"><RefreshCw aria-hidden="true" /><h3>Unable to load digital products.</h3><p>{error}</p><button type="button" className="button button-outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Try again</button></div></section>
  if (showDedicatedEmptyState) return <section className={dataStyles.page} data-testid="digital-product-management" aria-busy={busy}>{pageHeader}<div className={styles.emptyState} data-testid="digital-product-empty-state"><div className={styles.emptyContent}><span className={styles.emptyIcon}><PackageOpen aria-hidden="true" /></span><h3>No digital products yet</h3><p>Create your first digital product, select PDF or Video, upload its private content, and publish when ready.</p><button type="button" className="button button-primary" onClick={beginCreate}><Plus aria-hidden="true" /> Create digital product</button><div className={styles.emptyChips} aria-label="Digital product status"><span>PDF / Video</span><span>Private content</span><span>Draft / Published</span></div>{notice ? <p className={`${styles.feedback} ${styles.successFeedback}`} role="status" data-testid="digital-product-notice">{notice}</p> : null}</div></div></section>

  return <section className={dataStyles.page} data-testid="digital-product-management" aria-busy={busy}>
    {pageHeader}
    <div className={dataStyles.surface} data-testid="digital-product-list-surface">
      <div className={dataStyles.surfaceHeader}><div className={dataStyles.surfaceHeaderCopy}><p className="kicker">Product listings</p><h3>{products.length} Digital Product</h3></div><button type="button" className="button button-primary" onClick={beginCreate} disabled={busy}><Plus aria-hidden="true" /> Add product</button></div>
      <div className={dataStyles.toolbar}><label className={dataStyles.searchField}>Search products<span className={dataStyles.searchControl}><Search aria-hidden="true" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setProductPage(0) }} placeholder="Name, description, type, or price" /></span></label></div>
      {filteredProducts.length === 0 ? <div className={dataStyles.empty}>No digital products match your search.</div> : <div className={dataStyles.tableScroll} data-testid="digital-product-table-scroll"><table className={`${dataStyles.table} ${dataStyles.productTable}`} data-testid="digital-product-table"><thead><tr><SortableTableHeader label="Product" sortKey="product" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Type" sortKey="type" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Price" sortKey="price" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Homepage" sortKey="homepage" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Protected content" sortKey="content" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Updated" sortKey="updated_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><th scope="col" className={dataStyles.actionCell}>Actions</th></tr></thead><tbody>{pagedProducts.map(product => {
        const coverUrl = supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).getPublicUrl(product.image_path).data.publicUrl
        const contentReady = Boolean(product.content_type && product.content_path && product.content_mime_type)
         return <tr key={product.id} data-testid="digital-product-row"><td><div className={styles.tableProductIdentity}><div className={styles.tableThumbnail}><Image src={coverUrl} alt="" fill sizes="54px" unoptimized /></div><div className={dataStyles.identityText}><strong className={dataStyles.primaryText}>{product.name}</strong></div></div></td><td><span className={`${dataStyles.badge} ${product.content_type ? dataStyles.successBadge : dataStyles.warningBadge}`}>{product.content_type ? product.content_type.toUpperCase() : 'Not configured'}</span></td><td>{product.reference_price_amount != null ? <><del>{formatDigitalProductPrice(product.reference_price_amount)}</del><br /></> : null}<strong className={dataStyles.primaryText}>{formatDigitalProductPrice(product.price_amount)}</strong></td><td><span className={`${dataStyles.badge} ${product.is_published ? dataStyles.successBadge : dataStyles.warningBadge}`}>{product.is_published ? 'Published' : 'Draft'}</span></td><td><span className={`${dataStyles.badge} ${product.homepage_featured ? dataStyles.successBadge : dataStyles.warningBadge}`}>{product.homepage_featured ? `Card Swap #${product.homepage_featured_order}` : 'No'}</span></td><td><span className={`${dataStyles.badge} ${contentReady ? dataStyles.successBadge : dataStyles.warningBadge}`}>{contentReady ? 'Ready' : 'Missing'}</span></td><td><time className={dataStyles.dateCell} dateTime={product.updated_at}>{formatUpdatedAt(product.updated_at)}</time></td><td className={dataStyles.actionCell}><div className={styles.tableActions}>{product.is_published ? <a className={`button button-outline ${dataStyles.actionButton}`} href={`/produk-digital/${product.slug}`} target="_blank" rel="noreferrer">Preview</a> : null}<button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={() => beginEdit(product.id)} data-testid={`digital-product-manage-${product.id}`}>Manage</button><button type="button" className={`button button-outline ${dataStyles.actionButton}`} onClick={() => setRatingProductId(product.id)}><Star aria-hidden="true" size={14}/> Ratings &amp; Reviews</button></div></td></tr>
      })}</tbody></table></div>}
      <TablePagination language="en" page={productPage} pageSize={PRODUCT_PAGE_SIZE} totalItems={filteredProducts.length} onPageChange={setProductPage} disabled={busy} label="Pagination Digital Product" />
    </div>
     {productDialog}{ratingProduct ? <DigitalProductRatingManagement product={ratingProduct} onClose={() => setRatingProductId(null)} onVisibilityChange={value => setProducts(current => current.map(item => item.id === ratingProduct.id ? { ...item, show_rating: value } : item))} /> : null}
  </section>
}
