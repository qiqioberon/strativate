'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

type MenteeOption = { user_id: string; email: string; display_name: string | null }
type CommerceOption = { commerce_item_id: string; item_kind: string; name: string; price_amount: number }
type CartLinkRow = { id: string; mentee_id: string; mentee_email: string; status: string; item_count: number; created_at: string; claimed_at: string | null }

export function CommerceCartLinkManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [mentees, setMentees] = useState<MenteeOption[]>([])
  const [items, setItems] = useState<CommerceOption[]>([])
  const [links, setLinks] = useState<CartLinkRow[]>([])
  const [menteeId, setMenteeId] = useState('')
  const [itemIds, setItemIds] = useState<string[]>([])
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (term = '') => {
    const [menteeResult, itemResult, linkResult] = await Promise.all([
      supabase.rpc('list_cart_link_mentees', { p_query: term }),
      supabase.rpc('list_purchasable_commerce_items', { p_query: term }),
      supabase.rpc('list_admin_cart_links'),
    ])
    if (menteeResult.error || itemResult.error || linkResult.error) {
      setMessage('Data Cart Link belum dapat dimuat. Pastikan migrasi Phase 3 sudah diterapkan.')
      return
    }
    setMentees((menteeResult.data ?? []) as MenteeOption[])
    setItems((itemResult.data ?? []) as CommerceOption[])
    setLinks((linkResult.data ?? []) as CartLinkRow[])
  }, [supabase])

  useEffect(() => { void load() }, [load])
  function toggleItem(id: string) { setItemIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]) }

  async function createLink() {
    if (!menteeId || itemIds.length === 0) { setMessage('Pilih satu mentee dan minimal satu item.'); return }
    setBusy(true); setMessage(''); setGeneratedUrl('')
    try {
      const response = await fetch('/api/admin/cart-links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ menteeId, commerceItemIds: itemIds }) })
      const body = await response.json() as { url?: string; error?: string }
      if (!response.ok || !body.url) throw new Error(body.error || 'Cart Link gagal dibuat.')
      setGeneratedUrl(body.url); setMessage('Cart Link berhasil dibuat. Kirim tautan ini hanya kepada mentee yang dipilih.'); setItemIds([]); await load(query)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Cart Link gagal dibuat.') } finally { setBusy(false) }
  }
  async function copyLink() { if (!generatedUrl) return; await navigator.clipboard.writeText(generatedUrl); setMessage('Cart Link disalin ke clipboard.') }

  return <>
    <div className="role-page-title"><p className="kicker">Operasional · Shared Commerce</p><h2>Cart Links</h2><p>Buat tautan keranjang yang hanya dapat diklaim oleh mentee tujuan. Harga selalu berasal dari Commerce Item aktif.</p></div>
    <section className="role-card">
      <div className="table-controls"><label className="search-field"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari mentee atau item" /></label><button className="button button-outline" type="button" onClick={() => load(query)}>Cari</button></div>
      <label className="form-label">Mentee tujuan<select value={menteeId} onChange={event => setMenteeId(event.target.value)}><option value="">Pilih mentee</option>{mentees.map(mentee => <option key={mentee.user_id} value={mentee.user_id}>{mentee.display_name || mentee.email} · {mentee.email}</option>)}</select></label>
      <div className="program-list"><p className="kicker">Item yang akan dimasukkan ke keranjang</p>{items.map(item => <label key={item.commerce_item_id} className="focus-row"><input type="checkbox" checked={itemIds.includes(item.commerce_item_id)} onChange={() => toggleItem(item.commerce_item_id)} /><span><strong>{item.name}</strong><small>{item.item_kind} · Rp {Number(item.price_amount).toLocaleString('id-ID')}</small></span></label>)}</div>
      <div className="button-row"><button className="button button-primary" type="button" disabled={busy} onClick={createLink}>{busy ? 'Membuat…' : 'Buat Cart Link'}</button></div>
      {generatedUrl ? <div className="role-card"><p className="kicker">Tautan baru</p><p style={{ overflowWrap: 'anywhere' }}>{generatedUrl}</p><button className="text-link" type="button" onClick={copyLink}>Copy Cart Link</button></div> : null}
      {message ? <p className="muted" role="status">{message}</p> : null}
    </section>
    <section className="role-card"><p className="kicker">Riwayat Cart Link</p><div className="table-card"><div className="table-head"><span>Mentee</span><span>Status</span><span>Item</span><span>Dibuat</span><span>Diklaim</span><span>ID</span></div>{links.map(link => <div className="table-row" key={link.id}><span>{link.mentee_email}</span><span>{link.status}</span><span>{link.item_count}</span><span>{new Date(link.created_at).toLocaleString('id-ID')}</span><span>{link.claimed_at ? new Date(link.claimed_at).toLocaleString('id-ID') : '—'}</span><small>{link.id}</small></div>)}</div></section>
  </>
}
