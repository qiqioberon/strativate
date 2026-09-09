'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Archive, ChevronRight, Plus, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formError } from '@/lib/auth/errors'
import { formatRupiah } from '@/lib/catalog/format'
import { catalogProductTypeLabels, catalogStatusLabels, filterCatalogProducts, normalizeCatalogCode, normalizeCatalogSlug } from '@/lib/catalog/admin'
import type {
  CatalogAdminCommercialItem, CatalogAdminProduct, CatalogLifecycleStatus, CatalogMentorTier, CatalogProduct,
  CatalogSessionPackage,
} from '@/lib/supabase/database.types'
import { CatalogStructures } from './catalog-structures'

type EditorData = {
  products: CatalogAdminProduct[]
  items: CatalogAdminCommercialItem[]
  tiers: CatalogMentorTier[]
  packages: CatalogSessionPackage[]
}

const emptyData: EditorData = { products: [], items: [], tiers: [], packages: [] }

export function CatalogManagement() {
  const [data, setData] = useState<EditorData>(emptyData)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [productType, setProductType] = useState<CatalogAdminProduct['product_type'] | 'all'>('all')
  const [status, setStatus] = useState<CatalogLifecycleStatus | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const db = createClient()
      const [products, items, tiers, packages] = await Promise.all([
        db.from('catalog_products').select('id,code,slug,product_type,status,default_purchase_flow,title,short_description,description,is_public,is_featured,sort_order,published_at,archived_at,created_at,updated_at').order('sort_order').order('title'),
        db.from('catalog_commercial_items').select('id,product_id,code,kind,status,title,description,pricing_mode,price_amount,reference_price_amount,currency_code,is_sellable,sort_order,published_at,archived_at,created_at,updated_at').order('sort_order').order('title'),
        db.from('catalog_mentor_tiers').select('*').order('sort_order'),
        db.from('catalog_session_packages').select('*').order('sort_order'),
      ])
      for (const result of [products, items, tiers, packages]) if (result.error) throw result.error
      const next = {
        products: products.data ?? [], items: items.data ?? [],
        tiers: tiers.data ?? [], packages: packages.data ?? [],
      }
      setData(next)
      setSelectedId((current) => current && next.products.some((product) => product.id === current) ? current : next.products[0]?.id ?? null)
    } catch (caught) { setError(formError(caught)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  const selected = data.products.find((product) => product.id === selectedId) ?? null
  const selectedItems = useMemo(() => data.items.filter((item) => item.product_id === selectedId), [data.items, selectedId])
  const filteredProducts = useMemo(() => filterCatalogProducts(data.products, { query, productType, status }), [data.products, productType, query, status])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setNotice('')
    try { await action(); setNotice(success); await load() }
    catch (caught) { setError(formError(caught)) } finally { setBusy(false) }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const productType = String(values.get('product_type')) as CatalogProduct['product_type']
    const payload = {
      slug: normalizeCatalogSlug(String(values.get('slug'))),
      title: String(values.get('title')).trim(),
      short_description: String(values.get('short_description')).trim(),
      description: String(values.get('description')).trim() || null,
      default_purchase_flow: productType === 'digital_product' ? 'direct_checkout' as const : 'consultation_offer' as const,
      is_public: values.get('is_public') === 'on', is_featured: values.get('is_featured') === 'on',
      sort_order: Number(values.get('sort_order')),
    }
    await run(async () => {
      const db = createClient()
      if (selected && !creating) {
        const { error } = await db.from('catalog_products').update(payload).eq('id', selected.id)
        if (error) throw error
      } else {
        const { data: created, error } = await db.from('catalog_products').insert({
          ...payload, code: normalizeCatalogCode(String(values.get('code'))), product_type: productType,
        }).select('id').single()
        if (error) throw error
        setSelectedId(created.id)
        setCreating(false)
      }
    }, selected && !creating ? 'Perubahan produk disimpan.' : 'Produk draf dibuat.')
  }

  async function setProductStatus(status: CatalogLifecycleStatus) {
    if (!selected) return
    await run(async () => {
      const { error } = await createClient().rpc('set_catalog_product_status', { p_product_id: selected.id, p_status: status })
      if (error) throw error
    }, status === 'published' ? 'Produk dipublikasikan.' : 'Produk diarsipkan.')
  }

  return <>
    <div className="role-page-title"><p className="kicker">Produk · Product Master</p><h2>Katalog Produk</h2><p>Kelola identitas, harga, dan status katalog yang menjadi sumber resmi Strativate.</p></div>
    <div className="catalog-admin-layout">
      <section className="role-card catalog-admin-list"><div className="role-card-heading"><div><p className="kicker">Semua produk</p><h2>{filteredProducts.length} dari {data.products.length} produk</h2></div><button className="button button-primary" onClick={() => { setCreating(true); setSelectedId(null) }}><Plus /> Produk baru</button></div>
        <div className="catalog-admin-filters"><label>Cari produk<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Judul atau kode" /></label><label>Jenis<select value={productType} onChange={(event) => setProductType(event.target.value as CatalogProduct['product_type'] | 'all')}><option value="all">Semua jenis</option>{Object.entries(catalogProductTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as CatalogLifecycleStatus | 'all')}><option value="all">Semua status</option><option value="draft">Draf</option><option value="published">Dipublikasikan</option><option value="archived">Diarsipkan</option></select></label></div>
        {loading && <p role="status">Memuat Product Master…</p>}
        {!loading && !data.products.length && <div className="empty-state"><h3>Belum ada produk.</h3><p>Buat produk sebagai draf sebelum dipublikasikan.</p></div>}
        {!loading && data.products.length > 0 && !filteredProducts.length && <p className="muted">Tidak ada produk yang sesuai dengan filter.</p>}
        {filteredProducts.map((product) => <button className={`catalog-admin-product ${product.id === selectedId ? 'active' : ''}`} key={product.id} onClick={() => { setSelectedId(product.id); setCreating(false) }}><span><strong>{product.title}</strong><small>{catalogProductTypeLabels[product.product_type]} · {catalogStatusLabels[product.status]}</small></span><ChevronRight /></button>)}
      </section>
      <section className="role-card catalog-admin-editor">
        {(selected || creating) ? <><ProductForm key={selected?.id ?? 'new'} product={creating ? null : selected} busy={busy} onSubmit={saveProduct} />
          {selected && !creating && <><div className="button-row catalog-lifecycle-actions">{selected.status === 'draft' && <button className="button button-primary" disabled={busy} onClick={() => setProductStatus('published')}>Publikasikan</button>}{selected.status !== 'archived' && <button className="button button-outline" disabled={busy} onClick={() => setProductStatus('archived')}><Archive /> Arsipkan</button>}<button className="button button-outline" disabled={loading} onClick={() => void load()}><RefreshCw /> Muat ulang</button></div><CommercialItems product={selected} items={selectedItems} tiers={data.tiers.filter((tier) => tier.product_id === selected.id)} packages={data.packages.filter((item) => item.product_id === selected.id)} busy={busy} run={run} /><CatalogStructures key={selected.id} product={selected} items={selectedItems} onChanged={load} /></>}
        </> : <div className="empty-state"><h3>Pilih produk untuk mulai mengelola.</h3></div>}
        {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
      </section>
    </div>
  </>
}

function ProductForm({ product, busy, onSubmit }: { product: CatalogAdminProduct | null; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="editor-panel catalog-product-form" onSubmit={onSubmit}><div className="role-card-heading"><div><p className="kicker">{product ? `Identitas ${product.code}` : 'Produk baru'}</p><h2>{product ? product.title : 'Buat produk draf'}</h2></div><span className="status-pill">{product ? catalogStatusLabels[product.status] : 'Draf'}</span></div><div className="catalog-form-grid"><label>Jenis produk<select name="product_type" defaultValue={product?.product_type ?? 'private_mentoring'} disabled={!!product}><option value="private_mentoring">Mentoring Privat</option><option value="intensive_mentoring">Mentoring Intensif</option><option value="big_class">Kelas Besar</option><option value="digital_product">Produk Digital</option></select></label><label>Kode stabil<input name="code" pattern="[a-z][a-z0-9_]*" defaultValue={product?.code ?? ''} disabled={!!product} required /></label><label>Slug<input name="slug" defaultValue={product?.slug ?? ''} required /></label><label>Judul<input name="title" defaultValue={product?.title ?? ''} required maxLength={160} /></label><label className="catalog-wide">Deskripsi singkat<input name="short_description" defaultValue={product?.short_description ?? ''} required maxLength={500} /></label><label className="catalog-wide">Deskripsi<textarea name="description" defaultValue={product?.description ?? ''} rows={4} /></label><label>Urutan<input name="sort_order" type="number" defaultValue={product?.sort_order ?? 0} /></label><label className="option-label"><input name="is_public" type="checkbox" defaultChecked={product?.is_public ?? false} />Tampil di publik</label><label className="option-label"><input name="is_featured" type="checkbox" defaultChecked={product?.is_featured ?? false} />Produk unggulan</label></div><button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan produk'}</button></form>
}

function CommercialItems({ product, items, tiers, packages, busy, run }: { product: CatalogAdminProduct; items: CatalogAdminCommercialItem[]; tiers: CatalogMentorTier[]; packages: CatalogSessionPackage[]; busy: boolean; run: (action: () => Promise<void>, success: string) => Promise<void> }) {
  const [showForm, setShowForm] = useState(false)
  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget)
    const kind = String(values.get('kind')) as CatalogAdminCommercialItem['kind']
    const pricingMode = String(values.get('pricing_mode')) as 'fixed' | 'quotation_required'
    await run(async () => {
      const { error } = await createClient().rpc('create_catalog_commercial_item', {
        p_product_id: product.id, p_kind: kind, p_code: normalizeCatalogCode(String(values.get('code'))),
        p_title: String(values.get('title')).trim(), p_description: String(values.get('description')).trim() || null,
        p_pricing_mode: pricingMode, p_price_amount: pricingMode === 'fixed' ? Number(values.get('price_amount')) : null,
        p_reference_price_amount: pricingMode === 'fixed' && values.get('reference_price_amount') ? Number(values.get('reference_price_amount')) : null,
        p_is_sellable: true, p_sort_order: Number(values.get('sort_order')),
        p_mentor_tier_id: values.get('mentor_tier_id') ? String(values.get('mentor_tier_id')) : null,
        p_session_package_id: values.get('session_package_id') ? String(values.get('session_package_id')) : null,
        p_per_session_price_amount: values.get('per_session_price_amount') ? Number(values.get('per_session_price_amount')) : null,
        p_intensive_scope: values.get('intensive_scope') ? String(values.get('intensive_scope')) as 'national_fixed' | 'international_custom' : null,
        p_sessions_per_month: values.get('sessions_per_month') ? Number(values.get('sessions_per_month')) : null,
        p_is_conditional: values.get('is_conditional') === 'on', p_public_condition_summary: String(values.get('public_condition_summary')).trim() || null,
      })
      if (error) throw error
      setShowForm(false)
    }, 'Identitas komersial draf dibuat.')
  }
  async function updateItem(event: FormEvent<HTMLFormElement>, item: CatalogAdminCommercialItem) {
    event.preventDefault(); const values = new FormData(event.currentTarget); const mode = String(values.get('pricing_mode')) as 'fixed' | 'quotation_required'
    await run(async () => { const { error } = await createClient().from('catalog_commercial_items').update({ title: String(values.get('title')).trim(), description: String(values.get('description')).trim() || null, pricing_mode: mode, price_amount: mode === 'fixed' ? Number(values.get('price_amount')) : null, reference_price_amount: mode === 'fixed' && values.get('reference_price_amount') ? Number(values.get('reference_price_amount')) : null, is_sellable: values.get('is_sellable') === 'on', sort_order: Number(values.get('sort_order')) }).eq('id', item.id); if (error) throw error }, 'Pilihan komersial diperbarui.')
  }
  async function setItemStatus(item: CatalogAdminCommercialItem, status: CatalogLifecycleStatus) {
    await run(async () => { const { error } = await createClient().rpc('set_catalog_commercial_item_status', { p_item_id: item.id, p_status: status }); if (error) throw error }, status === 'published' ? 'Pilihan dipublikasikan.' : 'Pilihan diarsipkan.')
  }
  return <div className="catalog-commercial-section"><div className="role-card-heading"><div><p className="kicker">Identitas komersial</p><h2>Offering, add-on, dan bundle</h2></div>{product.status !== 'archived' && <button className="button button-outline" onClick={() => setShowForm((value) => !value)}><Plus /> Tambah pilihan</button>}</div>{showForm && <ItemCreateForm product={product} tiers={tiers} packages={packages} busy={busy} onSubmit={createItem} />}{items.map((item) => <form className="catalog-item-editor" key={item.id} onSubmit={(event) => updateItem(event, item)}><div><strong>{item.title}</strong><small>{item.code} · {item.kind} · {catalogStatusLabels[item.status]}</small></div><input name="title" aria-label={`Judul ${item.code}`} defaultValue={item.title} /><input name="description" aria-label={`Deskripsi ${item.code}`} defaultValue={item.description ?? ''} placeholder="Deskripsi" /><select name="pricing_mode" aria-label={`Mode harga ${item.code}`} defaultValue={item.pricing_mode ?? 'fixed'}><option value="fixed">Harga tetap</option><option value="quotation_required">Sesuai konsultasi</option></select><input name="price_amount" aria-label={`Harga ${item.code}`} type="number" min="0" defaultValue={item.price_amount ?? ''} placeholder="Harga" /><input name="reference_price_amount" aria-label={`Harga normal ${item.code}`} type="number" min="0" defaultValue={item.reference_price_amount ?? ''} placeholder="Harga normal" /><input name="sort_order" aria-label={`Urutan ${item.code}`} type="number" defaultValue={item.sort_order} /><label className="option-label"><input name="is_sellable" type="checkbox" defaultChecked={item.is_sellable} />Dapat dipilih</label><div className="button-row"><button className="text-link" disabled={busy || item.status === 'archived'}>Simpan</button>{item.status === 'draft' && <button type="button" className="text-link" onClick={() => setItemStatus(item, 'published')}>Publikasikan</button>}{item.status !== 'archived' && <button type="button" className="text-link" onClick={() => setItemStatus(item, 'archived')}>Arsipkan</button>}</div>{item.pricing_mode === 'fixed' && item.price_amount !== null && <span className="catalog-price-preview">{formatRupiah(item.price_amount)}</span>}</form>)}{!items.length && <p className="muted">Belum ada identitas komersial untuk produk ini.</p>}</div>
}

function ItemCreateForm({ product, tiers, packages, busy, onSubmit }: { product: CatalogAdminProduct; tiers: CatalogMentorTier[]; packages: CatalogSessionPackage[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [kind, setKind] = useState<CatalogAdminCommercialItem['kind']>('offering')
  const [pricingMode, setPricingMode] = useState<'fixed' | 'quotation_required'>('fixed')
  const privateOffering = product.product_type === 'private_mentoring' && kind === 'offering'
  const intensiveOffering = product.product_type === 'intensive_mentoring' && kind === 'offering'
  return <form className="editor-panel catalog-item-create" onSubmit={onSubmit}><h3>Identitas komersial baru</h3><div className="catalog-form-grid"><label>Jenis<select name="kind" value={kind} onChange={(event) => setKind(event.target.value as CatalogAdminCommercialItem['kind'])}><option value="offering">Offering / paket</option>{product.product_type === 'intensive_mentoring' && <><option value="add_on">Add-on</option><option value="bundle">Bundle</option></>}</select></label><label>Kode stabil<input name="code" required pattern="[a-z][a-z0-9_]*" /></label><label>Judul<input name="title" required /></label><label>Mode harga<select name="pricing_mode" value={pricingMode} onChange={(event) => setPricingMode(event.target.value as 'fixed' | 'quotation_required')}><option value="fixed">Harga tetap</option><option value="quotation_required">Sesuai konsultasi</option></select></label>{pricingMode === 'fixed' && <><label>Harga<input name="price_amount" type="number" min="0" required /></label><label>Harga normal<input name="reference_price_amount" type="number" min="0" /></label></>}<label>Urutan<input name="sort_order" type="number" defaultValue="0" /></label><label className="catalog-wide">Deskripsi<textarea name="description" /></label>{privateOffering && <><label>Tier mentor<select name="mentor_tier_id" required><option value="">Pilih tier</option>{tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.label}</option>)}</select></label><label>Paket sesi<select name="session_package_id" required><option value="">Pilih paket</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Harga per sesi<input name="per_session_price_amount" type="number" min="0" required /></label></>}{intensiveOffering && <><label>Cakupan<select name="intensive_scope"><option value="national_fixed">Kompetisi nasional</option><option value="international_custom">Kompetisi internasional</option></select></label><label>Sesi per bulan<input name="sessions_per_month" type="number" min="1" /></label></>}{(kind === 'add_on' || kind === 'bundle') && <><label className="option-label"><input name="is_conditional" type="checkbox" />Bersyarat</label><label className="catalog-wide">Ringkasan syarat<textarea name="public_condition_summary" /></label></>}</div><button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Buat sebagai draf'}</button></form>
}
