'use client'

import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { DiscountCode, DiscountType } from '@/lib/supabase/database.types'

type Draft = { code: string; description: string; discountType: DiscountType; discountValue: number; minimumSubtotal: number; startsAt: string; endsAt: string; maxRedemptions: string; isActive: boolean }
const emptyDraft: Draft = { code: '', description: '', discountType: 'percentage', discountValue: 10, minimumSubtotal: 0, startsAt: '', endsAt: '', maxRedemptions: '', isActive: true }

export function DiscountCodeManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [items, setItems] = useState<DiscountCode[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await supabase.from('commerce_discount_codes').select('*').order('created_at', { ascending: false })
    setItems(result.data ?? [])
    setError(result.error?.message ?? '')
    setLoading(false)
  }, [supabase])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editingId && !dialog.open) dialog.showModal()
    if (!editingId && dialog.open) dialog.close()
  }, [editingId])

  function edit(item?: DiscountCode) {
    setDraft(item ? { code: item.code, description: item.description ?? '', discountType: item.discount_type, discountValue: item.discount_value, minimumSubtotal: item.minimum_subtotal_amount, startsAt: item.starts_at?.slice(0, 16) ?? '', endsAt: item.ends_at?.slice(0, 16) ?? '', maxRedemptions: item.max_redemptions?.toString() ?? '', isActive: item.is_active } : emptyDraft)
    setError('')
    setEditingId(item?.id ?? 'new')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = { code: draft.code.trim().toUpperCase(), description: draft.description.trim() || null, discount_type: draft.discountType, discount_value: draft.discountValue, minimum_subtotal_amount: draft.minimumSubtotal, starts_at: draft.startsAt || null, ends_at: draft.endsAt || null, max_redemptions: draft.maxRedemptions ? Number(draft.maxRedemptions) : null, is_active: draft.isActive }
    const result = editingId === 'new' ? await supabase.from('commerce_discount_codes').insert(payload) : await supabase.from('commerce_discount_codes').update(payload).eq('id', editingId!)
    if (result.error) setError(result.error.message)
    else { setEditingId(null); await load() }
  }

  async function remove(item: DiscountCode) {
    if (!window.confirm(`Delete discount code ${item.code}?`)) return
    const result = await supabase.from('commerce_discount_codes').delete().eq('id', item.id)
    if (result.error) setError(result.error.message)
    else await load()
  }

  return <section className="discount-admin" data-testid="admin-discount-code-section"><div className="role-page-title"><p className="kicker">Commerce</p><h2>Discount codes</h2><p>Codes are validated and applied by the database at checkout. Orders keep an immutable code and amount snapshot.</p></div><div className="button-row"><button className="button button-primary" type="button" onClick={() => edit()}><Plus aria-hidden="true" size={16} /> New code</button></div>{error ? <p className="form-error">{error}</p> : null}{loading ? <p>Loading discount codes…</p> : <div className="discount-admin__list">{items.length ? items.map(item => <article key={item.id}><div><span className={item.is_active ? 'status-pill status-pill--success' : 'status-pill'}>{item.is_active ? 'Active' : 'Inactive'}</span><h3>{item.code}</h3><p>{item.discount_type === 'percentage' ? `${item.discount_value}% off` : `${item.discount_value} IDR off`} · {item.redemption_count} redeemed</p></div><div className="button-row"><button className="button button-outline button-compact" type="button" onClick={() => edit(item)}><Pencil aria-hidden="true" size={14} /> Edit</button><button className="button button-danger button-compact" type="button" onClick={() => void remove(item)}><Trash2 aria-hidden="true" size={14} /> Delete</button></div></article>) : <p>No discount codes yet.</p>}</div>}<dialog ref={dialogRef} className="editorial-admin__dialog" data-testid="discount-code-dialog"><form onSubmit={save}><button className="dialog-close" type="button" onClick={() => setEditingId(null)} aria-label="Close discount editor"><X aria-hidden="true" /></button><p className="kicker">Discount code</p><h3>{editingId === 'new' ? 'New code' : draft.code}</h3><label>Code<input required pattern="[A-Za-z0-9_-]{3,64}" value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value })} /></label><label>Description<input value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label><label>Type<select value={draft.discountType} onChange={event => setDraft({ ...draft, discountType: event.target.value as DiscountType })}><option value="percentage">Percentage</option><option value="fixed">Fixed IDR</option></select></label><label>Value<input required type="number" min="1" value={draft.discountValue} onChange={event => setDraft({ ...draft, discountValue: Number(event.target.value) })} /></label><label>Minimum subtotal<input type="number" min="0" value={draft.minimumSubtotal} onChange={event => setDraft({ ...draft, minimumSubtotal: Number(event.target.value) })} /></label><label>Starts at<input type="datetime-local" value={draft.startsAt} onChange={event => setDraft({ ...draft, startsAt: event.target.value })} /></label><label>Ends at<input type="datetime-local" value={draft.endsAt} onChange={event => setDraft({ ...draft, endsAt: event.target.value })} /></label><label>Max redemptions<input type="number" min="1" value={draft.maxRedemptions} onChange={event => setDraft({ ...draft, maxRedemptions: event.target.value })} /></label><label className="checkbox-label"><input type="checkbox" checked={draft.isActive} onChange={event => setDraft({ ...draft, isActive: event.target.checked })} /> Active</label><button className="button button-primary" type="submit"><Save aria-hidden="true" size={16} /> Save code</button></form></dialog></section>
}
