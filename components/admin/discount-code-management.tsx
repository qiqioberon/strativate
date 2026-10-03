'use client'

import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { formatRupiah } from '@/lib/commerce/money'
import { createClient } from '@/lib/supabase/client'
import type { DigitalProduct, DiscountCategory, DiscountCode, DiscountScope, DiscountType } from '@/lib/supabase/database.types'

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
  categories: DiscountCategory[]
  selectedProductIds: string[]
  isActive: boolean
}

const emptyDraft: Draft = {
  code: '', description: '', discountType: 'percentage', discountValue: 10, minimumSubtotal: 0,
  startsAt: '', endsAt: '', maxRedemptions: '', scope: 'digital_products',
  categories: ['digital_products'], selectedProductIds: [], isActive: true,
}

const categoryOptions: { value: DiscountCategory; label: string; description: string }[] = [
  { value: 'digital_products', label: 'Digital Products', description: 'Published products from the digital catalog.' },
  { value: 'private_mentoring', label: 'Private Mentoring', description: 'All eligible Private Mentoring packages.' },
  { value: 'intensive_mentoring', label: 'Intensive Mentoring', description: 'Packages, bundles, add-ons, and custom offers.' },
]

function toLocalDateInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localTime.toISOString().slice(0, 10)
}

function dateBoundaryIso(value: string, boundary: 'start' | 'end') {
  if (!value) return null
  return new Date(`${value}${boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999'}`).toISOString()
}

function scopeSummary(item: DiscountCode, categories: DiscountCategory[]) {
  if (categories.length === 3 && item.scope === 'digital_products') return 'All Commerce Categories'
  const labels: string[] = []
  if (categories.includes('digital_products')) labels.push(item.scope === 'selected_digital_products' ? 'Selected Digital Products' : 'Digital Products')
  if (categories.includes('private_mentoring')) labels.push('Private Mentoring')
  if (categories.includes('intensive_mentoring')) labels.push('Intensive Mentoring')
  return labels.join(' + ') || 'No categories'
}

export function DiscountCodeManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [items, setItems] = useState<DiscountCode[]>([])
  const [categoriesByCode, setCategoriesByCode] = useState<Record<string, DiscountCategory[]>>({})
  const [products, setProducts] = useState<DigitalProduct[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [codeResult, categoryResult, productResult] = await Promise.all([
      supabase.from('commerce_discount_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('commerce_discount_code_categories').select('*'),
      supabase.from('digital_products').select('*').order('name'),
    ])
    const loadError = codeResult.error ?? categoryResult.error ?? productResult.error
    if (loadError) setError(loadError.message)
    setItems(codeResult.data ?? [])
    setProducts(productResult.data ?? [])
    const grouped: Record<string, DiscountCategory[]> = {}
    for (const mapping of categoryResult.data ?? []) {
      grouped[mapping.discount_code_id] = [...(grouped[mapping.discount_code_id] ?? []), mapping.category]
    }
    setCategoriesByCode(grouped)
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
    const categories = categoriesByCode[item.id] ?? ['digital_products']
    const mappingResult = categories.includes('digital_products') && item.scope === 'selected_digital_products'
      ? await supabase.from('commerce_discount_code_products').select('product_id').eq('discount_code_id', item.id)
      : { data: [] as { product_id: string }[], error: null }
    if (mappingResult.error) {
      setError(mappingResult.error.message)
      return
    }
    setDraft({
      code: item.code, description: item.description ?? '', discountType: item.discount_type,
      discountValue: item.discount_value, minimumSubtotal: item.minimum_subtotal_amount,
      startsAt: toLocalDateInput(item.starts_at), endsAt: toLocalDateInput(item.ends_at),
      maxRedemptions: item.max_redemptions?.toString() ?? '', scope: item.scope, categories,
      selectedProductIds: (mappingResult.data ?? []).map(row => row.product_id), isActive: item.is_active,
    })
    setEditingId(item.id)
  }

  function closeEditor() {
    setEditingId(null)
    setDraft(emptyDraft)
    setError('')
  }

  function toggleCategory(category: DiscountCategory) {
    setDraft(current => ({ ...current, categories: current.categories.includes(category)
      ? current.categories.filter(value => value !== category)
      : [...current.categories, category] }))
  }

  function toggleProduct(productId: string) {
    setDraft(current => ({ ...current, selectedProductIds: current.selectedProductIds.includes(productId)
      ? current.selectedProductIds.filter(id => id !== productId)
      : [...current.selectedProductIds, productId] }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingId) return
    if (draft.categories.length === 0) {
      setError('Select at least one commerce category.')
      return
    }
    if (draft.categories.includes('digital_products') && draft.scope === 'selected_digital_products' && draft.selectedProductIds.length === 0) {
      setError('Select at least one Digital Product for a selected-products code.')
      return
    }

    setBusy(true)
    setError('')
    const { error: saveError } = await supabase.rpc('admin_save_discount_code', {
      p_discount_code_id: editingId === 'new' ? null : editingId,
      p_code: draft.code.trim().toUpperCase(), p_description: draft.description,
      p_discount_type: draft.discountType, p_discount_value: draft.discountValue,
      p_minimum_subtotal_amount: draft.minimumSubtotal,
      p_starts_at: dateBoundaryIso(draft.startsAt, 'start'),
      p_ends_at: dateBoundaryIso(draft.endsAt, 'end'),
      p_max_redemptions: draft.maxRedemptions ? Number(draft.maxRedemptions) : null,
      p_scope: draft.scope, p_is_active: draft.isActive, p_categories: draft.categories,
      p_product_ids: draft.categories.includes('digital_products') && draft.scope === 'selected_digital_products' ? draft.selectedProductIds : [],
    })

    if (saveError) {
      setError(saveError.message)
      setBusy(false)
      return
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

  const hasDigitalProducts = draft.categories.includes('digital_products')

  return <section className="discount-admin" data-testid="admin-discount-code-section">
    <div className="role-page-title"><p className="kicker">Commerce</p><h2>Discount codes</h2><p>Configure eligible commerce categories and promotion limits. Only successful paid orders count as redeemed.</p></div>
    <div className="button-row"><button className="button button-primary" type="button" onClick={() => void edit()}><Plus aria-hidden="true" size={16}/> New code</button></div>
    {!editingId && error ? <p className="form-error">{error}</p> : null}
    {loading ? <p>Loading discount codes…</p> : <div className="discount-admin__list">{items.length ? items.map(item => {
      const categories = categoriesByCode[item.id] ?? ['digital_products']
      const discountLabel = item.discount_type === 'percentage' ? `${item.discount_value}% off` : `${formatRupiah(item.discount_value)} off`
      return <article className="discount-code-card" key={item.id}>
        <div className="discount-code-card__content">
          <div className="discount-code-card__badges">
            <span className={item.is_active ? 'status-pill status-pill--success' : 'status-pill'}>{item.is_active ? 'Active' : 'Inactive'}</span>
            <span className={`discount-value-badge discount-value-badge--${item.discount_type}`}>{discountLabel}</span>
          </div>
          <h3>{item.code}</h3>
          {item.description ? <p className="discount-code-card__description">{item.description}</p> : null}
          <div className="discount-code-card__meta">
            <span><strong>{item.redemption_count}</strong> paid redemption{item.redemption_count === 1 ? '' : 's'}</span>
            <span>{scopeSummary(item, categories)}</span>
          </div>
        </div>
        <div className="button-row discount-code-card__actions"><button className="button button-outline button-compact" type="button" onClick={() => void edit(item)}><Pencil aria-hidden="true" size={14}/> Edit</button><button className="button button-danger button-compact" type="button" onClick={() => void remove(item)}><Trash2 aria-hidden="true" size={14}/> Delete</button></div>
      </article>
    }) : <p>No discount codes yet.</p>}</div>}

    <dialog ref={dialogRef} className="discount-dialog" data-testid="discount-code-dialog" onClose={closeEditor}>
      <form className="discount-dialog__form" onSubmit={save}>
        <button className="discount-dialog__close" type="button" onClick={closeEditor} aria-label="Close discount editor"><X aria-hidden="true"/></button>
        <header className="discount-dialog__header"><p className="kicker">Discount code</p><h3>{editingId === 'new' ? 'Create a new code' : `Edit ${draft.code}`}</h3><p>Set the value, eligible items, validity, and redemption limits for this promotion.</p></header>

        <div className="discount-dialog__section discount-dialog__grid">
          <label className="discount-field">Code<input required pattern="[A-Za-z0-9_-]{3,64}" placeholder="WELCOME30" value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value.toUpperCase() })}/></label>
          <label className="discount-field discount-field--wide">Description <span className="discount-field__optional">Optional</span><input placeholder="New customer promotion" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })}/><small>Optional internal description for this promotion.</small></label>
        </div>

        <fieldset className="discount-dialog__section discount-dialog__fieldset">
          <legend>Applies to</legend>
          <p>Select one or more top-level commerce categories.</p>
          <div className="discount-category-grid">{categoryOptions.map(option => <label className="discount-category" key={option.value}><input type="checkbox" checked={draft.categories.includes(option.value)} onChange={() => toggleCategory(option.value)}/><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div>
        </fieldset>

        {hasDigitalProducts ? <fieldset className="discount-dialog__section discount-dialog__fieldset">
          <legend>Digital Product eligibility</legend>
          <div className="discount-scope-options">
            <label><input type="radio" name="digital-product-scope" value="digital_products" checked={draft.scope === 'digital_products'} onChange={() => setDraft({ ...draft, scope: 'digital_products' })}/><span><strong>All Digital Products</strong><small>Every eligible Digital Product can receive the discount.</small></span></label>
            <label><input type="radio" name="digital-product-scope" value="selected_digital_products" checked={draft.scope === 'selected_digital_products'} onChange={() => setDraft({ ...draft, scope: 'selected_digital_products' })}/><span><strong>Selected Digital Products</strong><small>Limit the discount to products chosen below.</small></span></label>
          </div>
          {draft.scope === 'selected_digital_products' ? <div className="discount-admin__products" aria-label="Eligible Digital Products">{products.map(product => <label key={product.id} className="checkbox-label"><input type="checkbox" checked={draft.selectedProductIds.includes(product.id)} onChange={() => toggleProduct(product.id)}/><span>{product.name}</span></label>)}</div> : null}
        </fieldset> : null}

        <div className="discount-dialog__section discount-dialog__grid">
          <label className="discount-field">Discount type<select value={draft.discountType} onChange={event => setDraft({ ...draft, discountType: event.target.value as DiscountType })}><option value="percentage">Percentage</option><option value="fixed">Fixed IDR</option></select></label>
          <label className="discount-field">Value<div className={`discount-input-group${draft.discountType === 'fixed' ? ' discount-input-group--prefix' : ''}`}>{draft.discountType === 'fixed' ? <span>Rp</span> : null}<input required type="number" min="1" max={draft.discountType === 'percentage' ? 100 : undefined} value={draft.discountValue} onChange={event => setDraft({ ...draft, discountValue: Number(event.target.value) })}/>{draft.discountType === 'percentage' ? <span>%</span> : null}</div><small>{draft.discountType === 'percentage' ? 'Percentage of the eligible item subtotal.' : 'Fixed Rupiah amount, capped at the eligible subtotal.'}</small></label>
          <label className="discount-field discount-field--wide">Minimum eligible subtotal<div className="discount-input-group discount-input-group--prefix"><span>Rp</span><input type="number" min="0" value={draft.minimumSubtotal} onChange={event => setDraft({ ...draft, minimumSubtotal: Number(event.target.value) })}/></div><small>Minimum subtotal of eligible items required to use this code. Use 0 for no minimum.</small></label>
        </div>

        <div className="discount-dialog__section">
          <div className="discount-date-grid">
            <label className="discount-field">Starts on<input type="date" value={draft.startsAt} onChange={event => setDraft({ ...draft, startsAt: event.target.value })}/><small>Starts at the beginning of this date. Leave empty to start immediately.</small></label>
            <label className="discount-field">Ends on<input type="date" value={draft.endsAt} onChange={event => setDraft({ ...draft, endsAt: event.target.value })}/><small>Valid through the selected date. Leave empty for no end date.</small></label>
          </div>
          <label className="discount-field">Max paid redemptions<input type="number" min="1" placeholder="Unlimited" value={draft.maxRedemptions} onChange={event => setDraft({ ...draft, maxRedemptions: event.target.value })}/><small>Maximum number of successful paid redemptions. Leave empty for unlimited.</small></label>
        </div>

        <label className="discount-active"><input type="checkbox" checked={draft.isActive} onChange={event => setDraft({ ...draft, isActive: event.target.checked })}/><span><strong>Active</strong><small>Customers can apply this code while its other conditions are valid.</small></span></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="discount-dialog__actions"><button className="button button-outline" type="button" onClick={closeEditor}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}><Save aria-hidden="true" size={16}/> {busy ? 'Saving…' : 'Save code'}</button></div>
      </form>
    </dialog>
  </section>
}
