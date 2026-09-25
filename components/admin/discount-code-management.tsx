'use client'

import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { DigitalProduct, DiscountCode, DiscountScope, DiscountType } from '@/lib/supabase/database.types'

type Draft = {
  code: string
  description: string
  discountType: DiscountType
  discountValue: number
  minimumSubtotal: number
  startsAt: string
  endsAt: string
  maxRedemptions: string
  scope: DiscountScope
  selectedProductIds: string[]
  isActive: boolean
}

const emptyDraft: Draft = {
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: 10,
  minimumSubtotal: 0,
  startsAt: '',
  endsAt: '',
  maxRedemptions: '',
  scope: 'digital_products',
  selectedProductIds: [],
  isActive: true,
}

function toLocalInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : ''
}

export function DiscountCodeManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [items, setItems] = useState<DiscountCode[]>([])
  const [products, setProducts] = useState<DigitalProduct[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [codeResult, productResult] = await Promise.all([
      supabase.from('commerce_discount_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('digital_products').select('*').order('name'),
    ])
    if (codeResult.error || productResult.error) setError(codeResult.error?.message ?? productResult.error?.message ?? 'Discount data could not be loaded.')
    setItems(codeResult.data ?? [])
    setProducts(productResult.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editingId && !dialog.open) dialog.showModal()
    if (!editingId && dialog.open) dialog.close()
  }, [editingId])

  async function edit(item?: DiscountCode) {
    setError('')
    if (!item) {
      setDraft(emptyDraft)
      setEditingId('new')
      return
    }
    const mappingResult = item.scope === 'selected_digital_products'
      ? await supabase.from('commerce_discount_code_products').select('product_id').eq('discount_code_id', item.id)
      : { data: [] as { product_id: string }[], error: null }
    if (mappingResult.error) {
      setError(mappingResult.error.message)
      return
    }
    setDraft({
      code: item.code,
      description: item.description ?? '',
      discountType: item.discount_type,
      discountValue: item.discount_value,
      minimumSubtotal: item.minimum_subtotal_amount,
      startsAt: toLocalInput(item.starts_at),
      endsAt: toLocalInput(item.ends_at),
      maxRedemptions: item.max_redemptions?.toString() ?? '',
      scope: item.scope,
      selectedProductIds: (mappingResult.data ?? []).map(row => row.product_id),
      isActive: item.is_active,
    })
    setEditingId(item.id)
  }

  function closeEditor() {
    setEditingId(null)
    setDraft(emptyDraft)
  }

  function toggleProduct(productId: string) {
    setDraft(current => ({
      ...current,
      selectedProductIds: current.selectedProductIds.includes(productId)
        ? current.selectedProductIds.filter(id => id !== productId)
        : [...current.selectedProductIds, productId],
    }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingId) return
    if (draft.scope === 'selected_digital_products' && draft.selectedProductIds.length === 0) {
      setError('Select at least one Digital Product for a selected-products code.')
      return
    }
    setBusy(true)
    setError('')
    const payload = {
      code: draft.code.trim().toUpperCase(),
      description: draft.description.trim() || null,
      discount_type: draft.discountType,
      discount_value: draft.discountValue,
      minimum_subtotal_amount: draft.minimumSubtotal,
      starts_at: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
      ends_at: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      max_redemptions: draft.maxRedemptions ? Number(draft.maxRedemptions) : null,
      scope: draft.scope,
      is_active: draft.isActive,
    }

    const codeResult = editingId === 'new'
      ? await supabase.from('commerce_discount_codes').insert(payload).select('id').single()
      : await supabase.from('commerce_discount_codes').update(payload).eq('id', editingId).select('id').single()

    if (codeResult.error || !codeResult.data) {
      setError(codeResult.error?.message ?? 'Discount code could not be saved.')
      setBusy(false)
      return
    }

    const codeId = codeResult.data.id
    const deleteResult = await supabase.from('commerce_discount_code_products').delete().eq('discount_code_id', codeId)
    if (deleteResult.error) {
      setError(deleteResult.error.message)
      setBusy(false)
      return
    }

    if (draft.scope === 'selected_digital_products') {
      const mappingResult = await supabase.from('commerce_discount_code_products').insert(
        draft.selectedProductIds.map(productId => ({ discount_code_id: codeId, product_id: productId })),
      )
      if (mappingResult.error) {
        setError(mappingResult.error.message)
        setBusy(false)
        return
      }
    }

    closeEditor()
    await load()
    setBusy(false)
  }

  async function remove(item: DiscountCode) {
    if (!window.confirm(`Delete discount code “${item.code}”?`)) return
    const result = await supabase.from('commerce_discount_codes').delete().eq('id', item.id)
    if (result.error) setError(result.error.message)
    else await load()
  }

  return <section className="discount-admin" data-testid="admin-discount-code-section">
    <div className="role-page-title"><p className="kicker">Commerce</p><h2>Discount codes</h2><p>Discounts are scoped to Digital Products and calculated authoritatively by the database. Only paid orders count as redeemed.</p></div>
    <div className="button-row"><button className="button button-primary" type="button" onClick={() => void edit()}><Plus aria-hidden="true" size={16}/> New code</button></div>
    {error ? <p className="form-error">{error}</p> : null}
    {loading ? <p>Loading discount codes…</p> : <div className="discount-admin__list">{items.length ? items.map(item => <article key={item.id}><div><span className={item.is_active ? 'status-pill status-pill--success' : 'status-pill'}>{item.is_active ? 'Active' : 'Inactive'}</span><h3>{item.code}</h3><p>{item.discount_type === 'percentage' ? `${item.discount_value}% off` : `${item.discount_value} IDR off`} · {item.redemption_count} paid redemption{item.redemption_count === 1 ? '' : 's'} · {item.scope === 'digital_products' ? 'All Digital Products' : 'Selected Digital Products'}</p></div><div className="button-row"><button className="button button-outline button-compact" type="button" onClick={() => void edit(item)}><Pencil aria-hidden="true" size={14}/> Edit</button><button className="button button-danger button-compact" type="button" onClick={() => void remove(item)}><Trash2 aria-hidden="true" size={14}/> Delete</button></div></article>) : <p>No discount codes yet.</p>}</div>}

    <dialog ref={dialogRef} className="editorial-admin__dialog" data-testid="discount-code-dialog" onClose={closeEditor}><form onSubmit={save}>
      <button className="dialog-close" type="button" onClick={closeEditor} aria-label="Close discount editor"><X aria-hidden="true"/></button>
      <p className="kicker">Discount code</p><h3>{editingId === 'new' ? 'New code' : draft.code}</h3>
      <label>Code<input required pattern="[A-Za-z0-9_-]{3,64}" value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value })}/></label>
      <label>Description<input value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })}/></label>
      <label>Scope<select value={draft.scope} onChange={event => setDraft({ ...draft, scope: event.target.value as DiscountScope, selectedProductIds: event.target.value === 'digital_products' ? [] : draft.selectedProductIds })} data-testid="discount-scope-select"><option value="digital_products">All Digital Products</option><option value="selected_digital_products">Selected Digital Products</option></select></label>
      {draft.scope === 'selected_digital_products' ? <fieldset className="discount-admin__products"><legend>Eligible Digital Products</legend>{products.map(product => <label key={product.id} className="checkbox-label"><input type="checkbox" checked={draft.selectedProductIds.includes(product.id)} onChange={() => toggleProduct(product.id)}/>{product.name}</label>)}</fieldset> : null}
      <label>Type<select value={draft.discountType} onChange={event => setDraft({ ...draft, discountType: event.target.value as DiscountType })}><option value="percentage">Percentage</option><option value="fixed">Fixed IDR</option></select></label>
      <label>Value<input required type="number" min="1" value={draft.discountValue} onChange={event => setDraft({ ...draft, discountValue: Number(event.target.value) })}/></label>
      <label>Minimum eligible subtotal<input type="number" min="0" value={draft.minimumSubtotal} onChange={event => setDraft({ ...draft, minimumSubtotal: Number(event.target.value) })}/></label>
      <label>Starts at<input type="datetime-local" value={draft.startsAt} onChange={event => setDraft({ ...draft, startsAt: event.target.value })}/></label>
      <label>Ends at<input type="datetime-local" value={draft.endsAt} onChange={event => setDraft({ ...draft, endsAt: event.target.value })}/></label>
      <label>Max paid redemptions<input type="number" min="1" value={draft.maxRedemptions} onChange={event => setDraft({ ...draft, maxRedemptions: event.target.value })}/></label>
      <label className="checkbox-label"><input type="checkbox" checked={draft.isActive} onChange={event => setDraft({ ...draft, isActive: event.target.checked })}/> Active</label>
      <button className="button button-primary" type="submit" disabled={busy}><Save aria-hidden="true" size={16}/> {busy ? 'Saving…' : 'Save code'}</button>
    </form></dialog>
  </section>
}
