'use client'

import { Check, Eye, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import { DIGITAL_PRODUCT_IMAGE_BUCKET } from '@/lib/digital-products/config'
import { formatRupiah } from '@/lib/commerce/money'
import { createClient } from '@/lib/supabase/client'

type MenteeOption = { user_id: string; email: string; display_name: string | null }
type CommerceOption = { commerce_item_id: string; item_kind: string; name: string; slug: string; price_amount: number; description: string | null; image_path: string | null }
type CartLinkRow = { total_count: number; id: string; mentee_id: string; mentee_email: string; creator_email: string; status: string; item_count: number; created_at: string; claimed_at: string | null }
type ProductDetail = { commerce_item_id: string; item_kind: string; name: string; slug: string; description: string | null; image_path: string | null; price_amount: number; is_available: boolean; session_count: number | null; mentor_tier_name: string | null; content_type: string | null }
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>
type UntypedClient = { rpc: <T>(name: string, args?: Record<string, unknown>) => RpcResult<T> }
type LinkSortKey = 'mentee' | 'status' | 'items' | 'created_at' | 'creator' | 'claimed_at'

function kindLabel(kind: string) { if (kind === 'digital_product') return 'Produk Digital'; if (kind === 'private_mentoring') return 'Private Mentoring'; return kind.replaceAll('_', ' ') }
function linkStatusLabel(status: string) { if (status === 'active') return 'Aktif'; if (status === 'claimed') return 'Diklaim'; if (status === 'revoked') return 'Dicabut'; return status }

export function CommerceCartLinkManagement() {
  const supabase = useMemo(() => createClient(), [])
  const client = supabase as unknown as UntypedClient
  const [menteeQuery, setMenteeQuery] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyStatus, setHistoryStatus] = useState('')
  const [mentees, setMentees] = useState<MenteeOption[]>([])
  const [items, setItems] = useState<CommerceOption[]>([])
  const [links, setLinks] = useState<CartLinkRow[]>([])
  const [totalLinks, setTotalLinks] = useState(0)
  const [menteeId, setMenteeId] = useState('')
  const [itemIds, setItemIds] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [sortKey, setSortKey] = useState<LinkSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const loadMentees = useCallback(async () => {
    const result = await supabase.rpc('list_cart_link_mentees', { p_query: menteeQuery.trim() })
    if (result.error) { setMessage('Daftar mentee belum dapat dimuat.'); return }
    setMentees((result.data ?? []) as MenteeOption[])
  }, [menteeQuery, supabase])
  const loadItems = useCallback(async () => {
    // Admin projection extends list_purchasable_commerce_items with cover metadata without changing domain ownership.
    const result = await client.rpc<CommerceOption[]>('list_admin_purchasable_commerce_items', { p_query: productQuery.trim() })
    if (result.error) { setMessage('Daftar produk belum dapat dimuat.'); return }
    setItems((result.data ?? []) as CommerceOption[])
  }, [client, productQuery])
  const loadHistory = useCallback(async () => {
    const result = await client.rpc<CartLinkRow[]>('list_admin_cart_links_page', { p_query: historyQuery.trim(), p_status: historyStatus, p_limit: pageSize, p_offset: page * pageSize })
    if (result.error) { setMessage('Riwayat Cart Link belum dapat dimuat.'); return }
    const rows = result.data ?? []; setLinks(rows); setTotalLinks(Number(rows[0]?.total_count ?? 0))
  }, [client, historyQuery, historyStatus, page, pageSize])

  useEffect(() => { const timer = setTimeout(() => { void loadMentees() }, 200); return () => clearTimeout(timer) }, [loadMentees])
  useEffect(() => { if (!menteeId) return; const timer = setTimeout(() => { void loadItems() }, 200); return () => clearTimeout(timer) }, [loadItems, menteeId])
  useEffect(() => { const timer = setTimeout(() => { void loadHistory() }, 200); return () => clearTimeout(timer) }, [loadHistory])
  useEffect(() => { const dialog = dialogRef.current; if (!dialog) return; if (detail && !dialog.open) dialog.showModal(); if (!detail && dialog.open) dialog.close() }, [detail])

  const types = useMemo(() => [...new Set(items.map(item => item.item_kind))], [items])
  const visibleItems = items.filter(item => typeFilter === 'all' || item.item_kind === typeFilter)
  const visibleLinks = useMemo(() => {
    if (!sortKey || !sortDirection) return links
    const sign = sortDirection === 'asc' ? 1 : -1
    return [...links].sort((a, b) => {
      if (sortKey === 'items') return (a.item_count - b.item_count) * sign
      if (sortKey === 'created_at') return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * sign
      if (sortKey === 'claimed_at') return ((a.claimed_at ? new Date(a.claimed_at).getTime() : 0) - (b.claimed_at ? new Date(b.claimed_at).getTime() : 0)) * sign
      const left = sortKey === 'mentee' ? a.mentee_email : sortKey === 'status' ? linkStatusLabel(a.status) : a.creator_email
      const right = sortKey === 'mentee' ? b.mentee_email : sortKey === 'status' ? linkStatusLabel(b.status) : b.creator_email
      return left.localeCompare(right, 'id-ID') * sign
    })
  }, [links, sortDirection, sortKey])
  function changeSort(key: string | null, direction: SortDirection) { setSortKey(key as LinkSortKey | null); setSortDirection(direction) }
  function toggleItem(id: string) { setItemIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]) }

  async function openDetail(item: CommerceOption) {
    const result = await client.rpc<ProductDetail[]>('get_admin_commerce_item_detail', { p_commerce_item_id: item.commerce_item_id })
    if (result.error || !result.data?.[0]) { setMessage('Detail produk belum dapat dimuat.'); return }
    setDetail(result.data[0])
  }
  async function createLink() {
    if (!menteeId || itemIds.length === 0) { setMessage('Pilih satu mentee dan minimal satu item.'); return }
    setBusy(true); setMessage(''); setGeneratedUrl('')
    try {
      const response = await fetch('/api/admin/cart-links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ menteeId, commerceItemIds: itemIds }) })
      const body = await response.json() as { url?: string; error?: string }
      if (!response.ok || !body.url) throw new Error(body.error || 'Cart Link gagal dibuat.')
      setGeneratedUrl(body.url); setMessage('Cart Link berhasil dibuat. Kirim tautan ini hanya kepada mentee yang dipilih.'); setItemIds([]); await loadHistory()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Cart Link gagal dibuat.') } finally { setBusy(false) }
  }
  async function copyLink() { if (!generatedUrl) return; await navigator.clipboard.writeText(generatedUrl); setMessage('Cart Link disalin ke clipboard.') }
  const imageUrl = detail?.image_path ? supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).getPublicUrl(detail.image_path).data.publicUrl : null

  return <div className="ops-page">
    <div className="role-page-title"><p className="kicker">Operasional · Shared Commerce</p><h2>Cart Links</h2><p>Pilih mentee terlebih dahulu, lalu susun keranjang dari Commerce Item aktif dengan harga domain yang sebenarnya.</p></div>
    <section className="role-card cart-link-create">
      <div className="ops-section-heading"><div><p className="kicker">Langkah 1</p><h3>Pilih Mentee</h3><p>Cart Link hanya dapat diklaim oleh akun mentee tujuan.</p></div></div>
      <div className="cart-link-mentee-picker"><label className="ops-field ops-field--wide"><span>Cari mentee</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15} /><input value={menteeQuery} onChange={event => setMenteeQuery(event.target.value)} placeholder="Nama atau email" /></div></label><label className="ops-field ops-field--wide"><span>Mentee tujuan</span><select value={menteeId} onChange={event => { setMenteeId(event.target.value); setItemIds([]) }}><option value="">Pilih mentee</option>{mentees.map(mentee => <option key={mentee.user_id} value={mentee.user_id}>{mentee.display_name || mentee.email} · {mentee.email}</option>)}</select></label></div>
      <div className={`cart-link-products ${menteeId ? '' : 'is-disabled'}`} aria-disabled={!menteeId}>
        <div className="ops-section-heading"><div><p className="kicker">Langkah 2</p><h3>Pilih produk</h3><p>{menteeId ? `${itemIds.length} item dipilih.` : 'Pilih mentee untuk membuka katalog item.'}</p></div></div>
        {menteeId ? <><div className="ops-filter-bar cart-link-product-filters"><label className="ops-field ops-field--wide"><span>Cari produk</span><input value={productQuery} onChange={event => setProductQuery(event.target.value)} placeholder="Nama produk" /></label><label className="ops-field"><span>Tipe</span><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">Semua</option>{types.map(type => <option value={type} key={type}>{kindLabel(type)}</option>)}</select></label></div><div className="cart-link-product-grid">{visibleItems.map(item => { const selected = itemIds.includes(item.commerce_item_id); return <article className={`cart-link-product-card ${selected ? 'is-selected' : ''}`} key={item.commerce_item_id}>{item.image_path ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="cart-link-product-card__cover" src={supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).getPublicUrl(item.image_path).data.publicUrl} alt={`Sampul ${item.name}`} /></> : <div className="cart-link-product-card__cover cart-link-product-card__cover--empty">{kindLabel(item.item_kind)}</div>}<button type="button" className="cart-link-product-card__select" onClick={() => toggleItem(item.commerce_item_id)} aria-pressed={selected}><span className="cart-link-product-card__check">{selected ? <Check aria-hidden="true" size={15} /> : null}</span><small>{kindLabel(item.item_kind)}</small><strong>{item.name}</strong><b>{formatRupiah(item.price_amount)}</b></button><button type="button" className="button button-outline" onClick={() => void openDetail(item)}><Eye aria-hidden="true" size={15} />Lihat Detail</button></article>})}{visibleItems.length === 0 ? <p className="muted">Tidak ada produk yang cocok.</p> : null}</div></> : <div className="cart-link-products__locked">Pilih mentee di atas sebelum memilih produk.</div>}
      </div>
      <div className="button-row"><button className="button button-primary" type="button" disabled={busy || !menteeId || itemIds.length === 0} onClick={createLink}>{busy ? 'Membuat…' : 'Buat Cart Link'}</button></div>
      {generatedUrl ? <div className="cart-link-result"><p className="kicker">Tautan baru</p><p>{generatedUrl}</p><button className="button button-outline" type="button" onClick={copyLink}>Copy Cart Link</button></div> : null}{message ? <p className="muted" role="status">{message}</p> : null}
    </section>

    <section className="role-card ops-table-section">
      <div className="ops-section-heading"><div><p className="kicker">Riwayat Cart Link</p><h3>Riwayat Cart Link</h3></div><span>{totalLinks} data</span></div>
      <div className="ops-filter-bar"><label className="ops-field ops-field--wide"><span>Cari riwayat</span><input value={historyQuery} onChange={event => { setHistoryQuery(event.target.value); setPage(0) }} placeholder="Mentee, creator, atau ID" /></label><label className="ops-field"><span>Status</span><select value={historyStatus} onChange={event => { setHistoryStatus(event.target.value); setPage(0) }}><option value="">Semua</option><option value="active">Aktif</option><option value="claimed">Diklaim</option><option value="revoked">Dicabut</option></select></label><label className="ops-field"><span>Per halaman</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}>{[5,10,20].map(size => <option key={size}>{size}</option>)}</select></label></div>
      <div className="ops-table-wrap"><table className="ops-table"><thead><tr><SortableTableHeader label="Mentee" sortKey="mentee" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Item" sortKey="items" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Dibuat" sortKey="created_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Creator" sortKey="creator" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /><SortableTableHeader label="Diklaim" sortKey="claimed_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort} /></tr></thead><tbody>{visibleLinks.length ? visibleLinks.map(link => <tr key={link.id}><td><strong>{link.mentee_email}</strong><small>{link.id}</small></td><td><span className={`ops-status ops-status--${link.status === 'claimed' ? 'positive' : link.status === 'active' ? 'info' : 'neutral'}`}>{linkStatusLabel(link.status)}</span></td><td>{link.item_count}</td><td>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(link.created_at))}</td><td>{link.creator_email || '—'}</td><td>{link.claimed_at ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(link.claimed_at)) : '—'}</td></tr>) : <tr><td colSpan={6}>Belum ada Cart Link yang cocok.</td></tr>}</tbody></table></div>
      <TablePagination page={page} pageSize={pageSize} totalItems={totalLinks} onPageChange={setPage} label="Pagination riwayat Cart Link" />
    </section>

    <dialog ref={dialogRef} className="ops-dialog" aria-labelledby="cart-link-product-detail-title" onClose={() => setDetail(null)}>{detail ? <div className="ops-dialog__surface"><header className="ops-dialog__header"><div><p className="kicker">Detail produk</p><h2 id="cart-link-product-detail-title">{detail.name}</h2><p>{kindLabel(detail.item_kind)}</p></div><button type="button" className="ops-icon-button" onClick={() => setDetail(null)} aria-label="Tutup detail produk"><X /></button></header>{imageUrl ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="cart-link-detail-cover" src={imageUrl} alt={`Sampul ${detail.name}`} /></> : null}<div className="ops-detail-grid"><div><span>Harga</span><strong>{formatRupiah(detail.price_amount)}</strong></div><div><span>Status</span><strong>{detail.is_available ? 'Aktif / dapat dibeli' : 'Tidak tersedia'}</strong></div>{detail.session_count ? <div><span>Jumlah sesi</span><strong>{detail.session_count}</strong></div> : null}{detail.mentor_tier_name ? <div><span>Tier mentor</span><strong>{detail.mentor_tier_name}</strong></div> : null}{detail.content_type ? <div><span>Format konten</span><strong>{detail.content_type.toUpperCase()}</strong></div> : null}</div>{detail.description ? <section className="ops-dialog__section"><h3>Deskripsi</h3><p>{detail.description}</p></section> : null}<section className="ops-dialog__section"><h3>Identitas commerce</h3><p className="muted">{detail.slug} · {detail.commerce_item_id}</p></section></div> : null}</dialog>
  </div>
}
