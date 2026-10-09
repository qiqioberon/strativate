'use client'

import { Check, ChevronDown, Eye, Loader2, Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { IntensiveInternationalOfferManagement } from '@/components/admin/intensive-international-offer-management'
import { SortableTableHeader, type SortDirection } from '@/components/admin/sortable-table-header'
import { TablePagination } from '@/components/admin/table-pagination'
import { MultiValueChipInput } from '@/components/mentoring/multi-value-chip-input'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { formatRupiah } from '@/lib/commerce/money'
import { adminFormError } from '@/lib/auth/errors'
import { DIGITAL_PRODUCT_IMAGE_BUCKET } from '@/lib/digital-products/config'
import { createClient } from '@/lib/supabase/client'

type MenteeOption = { user_id: string; email: string; display_name: string | null }
type CommerceOption = { commerce_item_id: string; item_kind: string; name: string; slug: string; price_amount: number; description: string | null; image_path: string | null; owned_by_mentee: boolean; family_label: string | null; session_count: number | null }
type CartLinkRow = { total_count: number; id: string; mentee_id: string; mentee_email: string; creator_email: string; status: string; item_count: number; created_at: string; claimed_at: string | null }
type ProductDetail = { commerce_item_id: string; item_kind: string; name: string; slug: string; description: string | null; image_path: string | null; price_amount: number; is_available: boolean; session_count: number | null; mentor_tier_name: string | null; content_type: string | null }
type CompetitionCategory = { id: string; name: string }
type PrivateTier = { id: string; name: string; code: string }
type PrivateEnrollment = { id: string; tierId: string; tierName: string; purchasedSessions: number; status: string; competitionNames: string[]; primaryMentorId: string | null }
type PrivateContext = { tiers: PrivateTier[]; enrollments: PrivateEnrollment[] }
type PrivateQuote = { mentorTierId: string; mentorTierName: string; sessionCount: number; lockedTotalAmount: number; canonicalPackageId: string; breakdown: { packageId: string; sessionCount: number; unitPriceAmount: number; quantity: number; subtotalAmount: number }[]; mode: 'new_enrollment' | 'top_up'; targetEnrollmentId?: string; currentSessionCount: number; resultingSessionCount: number; competitionNames?: string[] }
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>
type UntypedClient = { rpc: <T>(name: string, args?: Record<string, unknown>) => RpcResult<T> }
type LinkSortKey = 'mentee' | 'status' | 'items' | 'created_at' | 'creator' | 'claimed_at'
type CatalogTab = 'digital' | 'private' | 'intensive'
type CartView = 'create' | 'history' | 'international'
type PrivateMode = 'new_enrollment' | 'top_up'

function kindLabel(kind: string) {
  if (kind === 'digital_product') return 'Digital Products'
  if (kind === 'private_mentoring') return 'Private Mentoring'
  if (kind === 'intensive_mentoring_package') return 'Program / package'
  if (kind === 'intensive_mentoring_bundle') return 'Bundle'
  if (kind === 'intensive_mentoring_add_on') return 'Add-on'
  if (kind === 'intensive_mentoring_custom_offer') return 'International Offers'
  return kind.replaceAll('_', ' ')
}

function linkStatusLabel(status: string) {
  if (status === 'active') return 'Active'
  if (status === 'claimed') return 'Claimed'
  if (status === 'revoked') return 'Revoked'
  return status
}
function enrollmentStatusLabel(status: string) {
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return status.replaceAll('_', ' ')
}

function tabFor(item: CommerceOption): CatalogTab {
  return item.item_kind === 'digital_product' ? 'digital' : item.item_kind === 'private_mentoring' ? 'private' : 'intensive'
}

function resolveCartView(value: string | null): CartView {
  return value === 'history' || value === 'international' ? value : 'create'
}

export function CommerceCartLinkManagement() {
  const supabase = useMemo(() => createClient(), [])
  const client = supabase as unknown as UntypedClient
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const cartViewParam = searchParams.get('cartView')
  const cartView = resolveCartView(cartViewParam)

  const [menteeQuery, setMenteeQuery] = useState('')
  const [mentees, setMentees] = useState<MenteeOption[]>([])
  const [menteeId, setMenteeId] = useState('')
  const [selectedMentee, setSelectedMentee] = useState<MenteeOption | null>(null)
  const [comboOpen, setComboOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menteeLoading, setMenteeLoading] = useState(false)

  const [productQuery, setProductQuery] = useState('')
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('digital')
  const [items, setItems] = useState<CommerceOption[]>([])
  const [itemIds, setItemIds] = useState<string[]>([])

  const [historyQuery, setHistoryQuery] = useState('')
  const [historyStatus, setHistoryStatus] = useState('')
  const [links, setLinks] = useState<CartLinkRow[]>([])
  const [totalLinks, setTotalLinks] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [sortKey, setSortKey] = useState<LinkSortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const [competitionCategories, setCompetitionCategories] = useState<CompetitionCategory[]>([])
  const [competitionCategoryId, setCompetitionCategoryId] = useState('')
  const [privateMode, setPrivateMode] = useState<PrivateMode | null>(null)
  const [privateContext, setPrivateContext] = useState<PrivateContext>({ tiers: [], enrollments: [] })
  const [privateTierId, setPrivateTierId] = useState('')
  const [targetEnrollmentId, setTargetEnrollmentId] = useState('')
  const [privateSessionCount, setPrivateSessionCount] = useState('1')
  const [competitionNames, setCompetitionNames] = useState<string[]>([])
  const [privateQuote, setPrivateQuote] = useState<PrivateQuote | null>(null)
  const [quoteBusy, setQuoteBusy] = useState(false)

  const [generatedUrl, setGeneratedUrl] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState<ProductDetail | null>(null)

  const comboRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const privateSessionCountValue = useMemo(() => {
    const raw = privateSessionCount.trim()
    if (!raw || !/^\d+$/.test(raw)) return null
    const value = Number(raw)
    return Number.isInteger(value) && value >= 1 && value <= 20 ? value : null
  }, [privateSessionCount])
  const privateIncluded = privateMode !== null
  const privateReady = privateQuote !== null && (privateMode !== 'new_enrollment' || competitionNames.length > 0)

  const loadMentees = useCallback(async () => {
    setMenteeLoading(true)
    const result = await supabase.rpc('list_cart_link_mentees', { p_query: menteeQuery.trim() })
    setMenteeLoading(false)
    if (result.error) {
      setMessage('Unable to load mentees.')
      return
    }
    setMentees((result.data ?? []) as MenteeOption[])
    setActiveIndex(0)
  }, [menteeQuery, supabase])

  const loadItems = useCallback(async () => {
    if (!menteeId) {
      setItems([])
      return
    }
    const result = await client.rpc<CommerceOption[]>('list_admin_cart_link_items', { p_mentee_id: menteeId, p_query: productQuery.trim() })
    if (result.error) {
      setMessage('Unable to load products.')
      return
    }
    setItems(result.data ?? [])
  }, [client, menteeId, productQuery])

  const loadHistory = useCallback(async () => {
    const result = await client.rpc<CartLinkRow[]>('list_admin_cart_links_page', { p_query: historyQuery.trim(), p_status: historyStatus, p_limit: pageSize, p_offset: page * pageSize })
    if (result.error) {
      setMessage('Unable to load Cart Link history.')
      return
    }
    const rows = result.data ?? []
    setLinks(rows)
    setTotalLinks(Number(rows[0]?.total_count ?? 0))
  }, [client, historyQuery, historyStatus, page, pageSize])

  const loadCompetitionCategories = useCallback(async () => {
    const result = await supabase.from('competition_categories').select('id,name').eq('is_active', true).order('sort_order')
    if (!result.error) setCompetitionCategories((result.data ?? []) as CompetitionCategory[])
  }, [supabase])

  const loadPrivateContext = useCallback(async () => {
    if (!menteeId) {
      setPrivateContext({ tiers: [], enrollments: [] })
      return
    }
    const result = await client.rpc<PrivateContext>('list_admin_private_cart_link_context', { p_mentee_id: menteeId })
    if (result.error || !result.data) {
      setMessage(adminFormError(result.error, 'Unable to load Private Mentoring details.'))
      return
    }
    setPrivateContext(result.data)
    setPrivateTierId(current => current || result.data?.tiers[0]?.id || '')
    setTargetEnrollmentId(current => current || result.data?.enrollments[0]?.id || '')
  }, [client, menteeId])

  useEffect(() => {
    const hasMenteeViewParam = searchParams.has('view')
    if (cartViewParam === cartView && !hasMenteeViewParam) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('view')
    params.set('cartView', cartView)
    router.replace(pathname + '?' + params.toString(), { scroll: false })
  }, [cartView, cartViewParam, pathname, router, searchParams])

  useEffect(() => {
    const timer = setTimeout(() => void loadMentees(), 220)
    return () => clearTimeout(timer)
  }, [loadMentees])

  useEffect(() => {
    const timer = setTimeout(() => void loadItems(), 220)
    return () => clearTimeout(timer)
  }, [loadItems])

  useEffect(() => {
    if (cartView !== 'history') return
    const timer = setTimeout(() => void loadHistory(), 220)
    return () => clearTimeout(timer)
  }, [cartView, loadHistory])

  useOperationalInvalidation(['cart-links'], () => {
    if (cartView === 'history') void loadHistory()
  })

  useEffect(() => {
    void loadCompetitionCategories()
  }, [loadCompetitionCategories])

  useEffect(() => {
    void loadPrivateContext()
  }, [loadPrivateContext])

  useEffect(() => {
    if (!privateMode || !menteeId || privateSessionCountValue === null) {
      setPrivateQuote(null)
      setQuoteBusy(false)
      return
    }
    const tierId = privateMode === 'top_up'
      ? privateContext.enrollments.find(item => item.id === targetEnrollmentId)?.tierId
      : privateTierId
    if (!tierId) {
      setPrivateQuote(null)
      setQuoteBusy(false)
      return
    }

    let active = true
    setPrivateQuote(null)
    setQuoteBusy(true)
    const timer = setTimeout(async () => {
      const result = await client.rpc<PrivateQuote>('quote_admin_private_cart_link', {
        p_mentee_id: menteeId,
        p_mode: privateMode,
        p_mentor_tier_id: tierId,
        p_target_enrollment_id: privateMode === 'top_up' ? targetEnrollmentId : null,
        p_session_count: privateSessionCountValue,
      })
      if (!active) return
      setQuoteBusy(false)
      if (result.error || !result.data) {
        setPrivateQuote(null)
        setMessage(adminFormError(result.error, 'Private Mentoring quote is unavailable.'))
        return
      }
      setPrivateQuote(result.data)
    }, 260)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [client, menteeId, privateContext.enrollments, privateMode, privateSessionCountValue, privateTierId, targetEnrollmentId])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (comboRef.current && !comboRef.current.contains(event.target as Node)) setComboOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (detail && !dialog.open) dialog.showModal()
    if (!detail && dialog.open) dialog.close()
  }, [detail])

  const visibleItems = items.filter(item => tabFor(item) === catalogTab)
  const intensiveGroups = useMemo(() => {
    const order = ['intensive_mentoring_package', 'intensive_mentoring_bundle', 'intensive_mentoring_add_on', 'intensive_mentoring_custom_offer']
    return order.map(kind => [kind, visibleItems.filter(item => item.item_kind === kind)] as const).filter(([, rows]) => rows.length)
  }, [visibleItems])

  const visibleLinks = useMemo(() => {
    if (!sortKey || !sortDirection) return links
    const sign = sortDirection === 'asc' ? 1 : -1
    return [...links].sort((a, b) => {
      if (sortKey === 'items') return (a.item_count - b.item_count) * sign
      if (sortKey === 'created_at') return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * sign
      if (sortKey === 'claimed_at') return ((a.claimed_at ? new Date(a.claimed_at).getTime() : 0) - (b.claimed_at ? new Date(b.claimed_at).getTime() : 0)) * sign
      if (sortKey === 'status') {
        const priority: Record<string, number> = { active: 0, revoked: 1, claimed: 2 }
        return ((priority[a.status] ?? 3) - (priority[b.status] ?? 3) || a.status.localeCompare(b.status)) * sign
      }
      const left = sortKey === 'mentee' ? a.mentee_email : a.creator_email
      const right = sortKey === 'mentee' ? b.mentee_email : b.creator_email
      return left.localeCompare(right, 'id-ID') * sign
    })
  }, [links, sortDirection, sortKey])

  function changeCartView(nextView: CartView) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('view')
    params.set('cartView', nextView)
    router.push(pathname + '?' + params.toString(), { scroll: false })
  }

  function selectMentee(mentee: MenteeOption) {
    setSelectedMentee(mentee)
    setMenteeId(mentee.user_id)
    setMenteeQuery(mentee.display_name || mentee.email)
    setComboOpen(false)
    setItemIds([])
    setProductQuery('')
    setCompetitionCategoryId('')
    setCompetitionNames([])
    setPrivateMode(null)
    setPrivateQuote(null)
    setPrivateTierId('')
    setTargetEnrollmentId('')
    setPrivateSessionCount('1')
  }

  function onComboKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setComboOpen(true)
      setActiveIndex(index => Math.min(index + 1, mentees.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(0, index - 1))
    } else if (event.key === 'Enter' && comboOpen && mentees[activeIndex]) {
      event.preventDefault()
      selectMentee(mentees[activeIndex])
    } else if (event.key === 'Escape') {
      setComboOpen(false)
    }
  }

  function toggleItem(item: CommerceOption) {
    if (item.owned_by_mentee) return
    const selected = itemIds.includes(item.commerce_item_id)
    setItemIds(current => selected ? current.filter(value => value !== item.commerce_item_id) : [...current, item.commerce_item_id])
  }

  function activatePrivateMode(mode: PrivateMode) {
    setPrivateMode(mode)
    setPrivateQuote(null)
    if (mode === 'new_enrollment' && !privateTierId) setPrivateTierId(privateContext.tiers[0]?.id || '')
    if (mode === 'top_up' && !targetEnrollmentId) setTargetEnrollmentId(privateContext.enrollments[0]?.id || '')
  }

  function removePrivateMentoring() {
    setPrivateMode(null)
    setPrivateQuote(null)
    setQuoteBusy(false)
    setPrivateTierId('')
    setTargetEnrollmentId('')
    setPrivateSessionCount('1')
    setCompetitionCategoryId('')
    setCompetitionNames([])
  }

  function productCard(item: CommerceOption) {
    const selected = itemIds.includes(item.commerce_item_id)
    return (
      <article className={'cart-link-product-card ' + (selected ? 'is-selected' : '') + (item.owned_by_mentee ? ' is-disabled' : '')} key={item.commerce_item_id}>
        {item.image_path ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cart-link-product-card__cover" src={supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).getPublicUrl(item.image_path).data.publicUrl} alt={'Cover for ' + item.name}/>
          </>
        ) : (
          <div className="cart-link-product-card__cover cart-link-product-card__cover--empty">{kindLabel(item.item_kind)}</div>
        )}
        <button type="button" className="cart-link-product-card__select" disabled={item.owned_by_mentee} onClick={() => toggleItem(item)} aria-pressed={selected}>
          <span className="cart-link-product-card__check">{selected ? <Check aria-hidden="true" size={15}/> : null}</span>
          <small>{kindLabel(item.item_kind)}</small>
          <strong>{item.name}</strong>
          <b>{formatRupiah(item.price_amount)}</b>
          {item.owned_by_mentee ? <span className="ops-status ops-status--neutral">Already owned</span> : null}
        </button>
        <button type="button" className="button button-outline" onClick={() => void openDetail(item)}>
          <Eye aria-hidden="true" size={15}/>
          View details
        </button>
      </article>
    )
  }

  async function openDetail(item: CommerceOption) {
    const result = await client.rpc<ProductDetail[]>('get_admin_commerce_item_detail', { p_commerce_item_id: item.commerce_item_id })
    if (result.error || !result.data?.[0]) {
      setMessage('Unable to load product details.')
      return
    }
    setDetail(result.data[0])
  }

  async function createLink() {
    if (!menteeId || (itemIds.length === 0 && !privateIncluded)) {
      setMessage('Select one mentee and at least one item.')
      return
    }
    if (privateIncluded && (!privateQuote || privateSessionCountValue === null)) {
      setMessage('Wait for the Private Mentoring quote.')
      return
    }
    if (privateMode === 'new_enrollment' && !competitionNames.length) {
      setMessage('Add at least one competition name for a new enrollment.')
      return
    }

    setBusy(true)
    setMessage('')
    setGeneratedUrl('')
    try {
      const response = await fetch('/api/admin/cart-links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          menteeId,
          commerceItemIds: itemIds,
          privateConfig: privateMode ? {
            mode: privateMode,
            mentorTierId: privateQuote?.mentorTierId,
            targetEnrollmentId: privateMode === 'top_up' ? targetEnrollmentId : null,
            sessionCount: privateSessionCountValue,
            competitionCategoryId: competitionCategoryId || null,
            competitionNames: privateMode === 'top_up' ? privateQuote?.competitionNames : competitionNames,
          } : null,
        }),
      })
      const body = await response.json() as { url?: string; error?: string }
      if (!response.ok || !body.url) throw new Error(body.error || 'Unable to create the Cart Link.')
      setGeneratedUrl(body.url)
      setMessage('Cart Link created with locked prices.')
      setItemIds([])
      removePrivateMentoring()
      await loadHistory()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create the Cart Link.')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    if (!generatedUrl) return
    try {
      await navigator.clipboard.writeText(generatedUrl)
      setMessage('Cart Link copied to clipboard.')
    } catch {
      setMessage('Unable to copy the Cart Link. Select the link and copy it manually.')
    }
  }

  function changeSort(key: string | null, direction: SortDirection) {
    setSortKey(key as LinkSortKey | null)
    setSortDirection(direction)
  }

  const imageUrl = detail?.image_path ? supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).getPublicUrl(detail.image_path).data.publicUrl : null

  return (
    <div className="ops-page cart-link-management">
      <div className="role-page-title">
        <h2>Cart Links</h2>
      </div>

      <div className="cart-link-main-tabs" role="tablist" aria-label="Cart Link views">
        <button id="cart-link-tab-create" type="button" role="tab" aria-selected={cartView === 'create'} aria-controls="cart-link-panel-create" className={cartView === 'create' ? 'active' : ''} onClick={() => changeCartView('create')}>Create Cart Link</button>
        <button id="cart-link-tab-history" type="button" role="tab" aria-selected={cartView === 'history'} aria-controls="cart-link-panel-history" className={cartView === 'history' ? 'active' : ''} onClick={() => changeCartView('history')}>Cart Link History</button>
        <button id="cart-link-tab-international" type="button" role="tab" aria-selected={cartView === 'international'} aria-controls="cart-link-panel-international" className={cartView === 'international' ? 'active' : ''} onClick={() => changeCartView('international')}>International Offers</button>
      </div>

      {cartView === 'create' ? (
        <section id="cart-link-panel-create" role="tabpanel" aria-labelledby="cart-link-tab-create" className="role-card cart-link-create cart-link-view-panel">
          <div className="ops-section-heading">
            <div>
              <p className="kicker">Step 1</p>
              <h3>Select mentee</h3>
              <p>Only the intended account can claim this Cart Link.</p>
            </div>
          </div>

          <div ref={comboRef} className="ops-field ops-field--wide">
            <span>Search mentees</span>
            <div className="ops-input-with-icon">
              <Search aria-hidden="true" size={15}/>
              <input
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={comboOpen}
                aria-controls="cart-link-mentee-options"
                value={menteeQuery}
                onFocus={() => setComboOpen(true)}
                onChange={event => {
                  setMenteeQuery(event.target.value)
                  setSelectedMentee(null)
                  setMenteeId('')
                  setComboOpen(true)
                }}
                onKeyDown={onComboKeyDown}
                placeholder="Type a name or email"
              />
              {menteeLoading ? <Loader2 className="spin" aria-hidden="true" size={15}/> : <ChevronDown aria-hidden="true" size={15}/>}
            </div>
            {comboOpen ? (
              <div id="cart-link-mentee-options" role="listbox" className="ops-combobox-options">
                {menteeLoading ? <p>Loading…</p> : mentees.length ? mentees.map((mentee, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={mentee.user_id === menteeId}
                    className={index === activeIndex ? 'is-active' : ''}
                    key={mentee.user_id}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectMentee(mentee)}
                  >
                    <strong>{mentee.display_name || 'Strativate mentee'}</strong>
                    <span>{mentee.email}</span>
                  </button>
                )) : <p>No matching mentees.</p>}
              </div>
            ) : null}
          </div>

          {selectedMentee ? (
            <div className="cart-link-selected-mentee" role="status">
              <span>Intended account email</span>
              <strong>{selectedMentee.email}</strong>
            </div>
          ) : null}

          <div className={'cart-link-products ' + (menteeId ? '' : 'is-disabled')} aria-disabled={!menteeId}>
            <div className="ops-section-heading">
              <div>
                <p className="kicker">Step 2</p>
                <h3>Select products</h3>
                <p>
                  {!menteeId
                    ? 'Select a mentee to open the catalog.'
                    : catalogTab === 'private'
                      ? privateReady
                        ? 'Private Mentoring is ready to add.'
                        : privateMode
                          ? 'Complete the Private Mentoring configuration.'
                          : 'Choose a mode to add Private Mentoring.'
                      : itemIds.length + ' catalog items selected.'}
                </p>
              </div>
            </div>

            {menteeId ? (
              <>
                {catalogTab !== 'private' ? (
                  <label className="ops-field ops-field--wide cart-link-product-search">
                    <span>Search products</span>
                    <input value={productQuery} onChange={event => setProductQuery(event.target.value)} placeholder="Product name"/>
                  </label>
                ) : null}

                <div className="cart-link-product-tabs" role="tablist" aria-label="Product categories">
                  <button id="cart-link-product-tab-digital" type="button" role="tab" aria-selected={catalogTab === 'digital'} aria-controls="cart-link-product-panel-digital" className={catalogTab === 'digital' ? 'active' : ''} onClick={() => setCatalogTab('digital')}>Digital Products</button>
                  <button id="cart-link-product-tab-private" type="button" role="tab" aria-selected={catalogTab === 'private'} aria-controls="cart-link-product-panel-private" className={catalogTab === 'private' ? 'active' : ''} onClick={() => setCatalogTab('private')}>Private Mentoring</button>
                  <button id="cart-link-product-tab-intensive" type="button" role="tab" aria-selected={catalogTab === 'intensive'} aria-controls="cart-link-product-panel-intensive" className={catalogTab === 'intensive' ? 'active' : ''} onClick={() => setCatalogTab('intensive')}>Intensive Mentoring</button>
                </div>

                {itemIds.length || privateIncluded ? (
                  <div className="cart-link-selection-summary" aria-live="polite">
                    {itemIds.length ? <span><strong>{itemIds.length}</strong> catalog products selected</span> : null}
                    {privateMode ? <span><strong>Private Mentoring</strong> · {privateMode === 'new_enrollment' ? 'New enrollment' : 'Add sessions'}</span> : null}
                  </div>
                ) : null}

                {catalogTab === 'digital' ? (
                  <div id="cart-link-product-panel-digital" role="tabpanel" aria-labelledby="cart-link-product-tab-digital" className="cart-link-product-grid">
                    {visibleItems.map(productCard)}
                  </div>
                ) : null}

                {catalogTab === 'private' ? (
                  <section id="cart-link-product-panel-private" role="tabpanel" aria-labelledby="cart-link-product-tab-private" className="private-cart-config">
                    <div className="private-cart-config__head">
                      <div>
                        <h4>Private Mentoring</h4>
                        <p>Choose a mode to add Private Mentoring to this Cart Link.</p>
                      </div>
                      {privateIncluded ? (
                        <button type="button" className="button button-outline button-compact private-cart-remove" onClick={removePrivateMentoring}>
                          Remove Private Mentoring
                        </button>
                      ) : null}
                    </div>

                    <div className="private-cart-mode" role="group" aria-label="Private Mentoring mode">
                      <button type="button" aria-pressed={privateMode === 'new_enrollment'} onClick={() => activatePrivateMode('new_enrollment')}>New enrollment</button>
                      <button type="button" aria-pressed={privateMode === 'top_up'} onClick={() => activatePrivateMode('top_up')}>Add sessions</button>
                    </div>

                    {privateIncluded ? (
                      <>
                        <div className="ops-form-stack private-cart-form">
                          {privateMode === 'new_enrollment' ? (
                            <label className="ops-field">
                              <span>Mentor tier</span>
                              <select value={privateTierId} onChange={event => setPrivateTierId(event.target.value)}>
                                <option value="">Select a tier</option>
                                {privateContext.tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                              </select>
                            </label>
                          ) : (
                            <label className="ops-field">
                              <span>Target enrollment</span>
                              <select value={targetEnrollmentId} onChange={event => setTargetEnrollmentId(event.target.value)}>
                                <option value="">Select an enrollment</option>
                                {privateContext.enrollments.map(enrollment => <option key={enrollment.id} value={enrollment.id}>{enrollment.tierName} · {enrollment.purchasedSessions} sessions · {enrollmentStatusLabel(enrollment.status)}</option>)}
                              </select>
                            </label>
                          )}

                          <label className="ops-field">
                            <span>{privateMode === 'top_up' ? 'Additional sessions' : 'Session count'}</span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              inputMode="numeric"
                              value={privateSessionCount}
                              onChange={event => setPrivateSessionCount(event.target.value)}
                              aria-invalid={privateSessionCount !== '' && privateSessionCountValue === null}
                            />
                            {privateSessionCount === '' || privateSessionCountValue === null ? <small className="private-cart-helper">Enter a whole number from 1 to 20.</small> : null}
                          </label>

                          {privateMode === 'new_enrollment' ? (
                            <>
                              <MultiValueChipInput language="en" label="Competition names" value={competitionNames} onChange={setCompetitionNames}/>
                              <label className="ops-field">
                                <span>Competition category <small>(optional)</small></span>
                                <select value={competitionCategoryId} onChange={event => setCompetitionCategoryId(event.target.value)}>
                                  <option value="">No category</option>
                                  {competitionCategories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}
                                </select>
                              </label>
                            </>
                          ) : null}
                        </div>

                        {quoteBusy ? (
                          <p className="muted">Calculating quote…</p>
                        ) : privateQuote ? (
                          <>
                            <div className={'private-cart-quote ' + (privateMode === 'top_up' ? 'private-cart-quote--four' : '')}>
                              <div><span>Locked tier</span><strong>{privateQuote.mentorTierName}</strong></div>
                              {privateMode === 'top_up' ? <div><span>Current sessions</span><strong>{privateQuote.currentSessionCount}</strong></div> : null}
                              <div><span>Total after purchase</span><strong>{privateQuote.resultingSessionCount} sessions</strong></div>
                              <div><span>Locked price</span><strong>{formatRupiah(privateQuote.lockedTotalAmount)}</strong></div>
                            </div>

                            <div className="private-cart-secondary">
                              <h5>Price breakdown</h5>
                              <ul className="private-cart-breakdown">
                                {privateQuote.breakdown.map(item => <li key={item.packageId}>{item.quantity} × package {item.sessionCount} sessions · {formatRupiah(item.subtotalAmount)}</li>)}
                              </ul>
                            </div>

                            {privateMode === 'top_up' ? (
                              <div className="private-cart-secondary">
                                <h5>Current competitions</h5>
                                <div className="mentoring-chip-list">
                                  {privateQuote.competitionNames?.length ? privateQuote.competitionNames.map(name => <span className="mentoring-chip" key={name}>{name}</span>) : <span className="muted">No competitions recorded.</span>}
                                </div>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <p className="muted">Complete the selections to see the locked price.</p>
                        )}
                      </>
                    ) : null}
                  </section>
                ) : null}

                {catalogTab === 'intensive' ? (
                  <div id="cart-link-product-panel-intensive" role="tabpanel" aria-labelledby="cart-link-product-tab-intensive" className="cart-link-intensive-groups">
                    {intensiveGroups.map(([kind, rows]) => (
                      <section className="schedule-day" key={kind}>
                        <h4>{kindLabel(kind)}</h4>
                        <div className="cart-link-product-grid">{rows.map(productCard)}</div>
                      </section>
                    ))}
                  </div>
                ) : null}

                {catalogTab !== 'private' && visibleItems.length === 0 ? <p className="muted">No matching products in this category.</p> : null}
              </>
            ) : (
              <div className="cart-link-products__locked">Select a mentee above before choosing products.</div>
            )}
          </div>

          <div className="button-row cart-link-create-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={busy || !menteeId || (itemIds.length === 0 && !privateIncluded) || Boolean(privateIncluded && !privateReady)}
              onClick={() => void createLink()}
            >
              {busy ? 'Creating…' : 'Create Cart Link'}
            </button>
          </div>

          {generatedUrl ? (
            <div className="cart-link-result">
              <p className="kicker">New link</p>
              <p>{generatedUrl}</p>
              <button className="button button-outline" type="button" onClick={() => void copyLink()}>Copy Cart Link</button>
            </div>
          ) : null}
          {message ? <p className="muted" role="status">{message}</p> : null}
        </section>
      ) : null}

      {cartView === 'history' ? (
        <section id="cart-link-panel-history" role="tabpanel" aria-labelledby="cart-link-tab-history" className="role-card ops-table-section cart-link-view-panel">
          <div className="ops-section-heading cart-link-history-heading">
            <div>
              <h3>Cart Link History</h3>
            </div>
            <span>{totalLinks} links</span>
          </div>
          <div className="ops-filter-bar cart-link-history-filters">
            <label className="ops-field ops-field--wide">
              <span>Search history</span>
              <input value={historyQuery} onChange={event => { setHistoryQuery(event.target.value); setPage(0) }} placeholder="Mentee, creator or ID"/>
            </label>
            <label className="ops-field">
              <span>Status</span>
              <select value={historyStatus} onChange={event => { setHistoryStatus(event.target.value); setPage(0) }}>
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="claimed">Claimed</option>
                <option value="revoked">Revoked</option>
              </select>
            </label>
            <label className="ops-field">
              <span>Per page</span>
              <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}>
                {[5, 10, 20].map(size => <option key={size}>{size}</option>)}
              </select>
            </label>
          </div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <SortableTableHeader label="Mentee" sortKey="mentee" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/>
                  <SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/>
                  <SortableTableHeader label="Item" sortKey="items" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/>
                  <SortableTableHeader label="Created" sortKey="created_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/>
                  <SortableTableHeader label="Creator" sortKey="creator" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/>
                  <SortableTableHeader label="Claimed" sortKey="claimed_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/>
                </tr>
              </thead>
              <tbody>
                {visibleLinks.length ? visibleLinks.map(link => (
                  <tr key={link.id}>
                    <td><strong>{link.mentee_email}</strong><small>{link.id}</small></td>
                    <td><span className={'ops-status ops-status--' + (link.status === 'claimed' ? 'positive' : link.status === 'active' ? 'info' : 'neutral')}>{linkStatusLabel(link.status)}</span></td>
                    <td>{link.item_count}</td>
                    <td>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(link.created_at))}</td>
                    <td>{link.creator_email || '—'}</td>
                    <td>{link.claimed_at ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(link.claimed_at)) : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6}>No matching Cart Links.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination language="en" page={page} pageSize={pageSize} totalItems={totalLinks} onPageChange={setPage} label="Cart Link history pages"/>
          {message ? <p className="muted" role="status">{message}</p> : null}
        </section>
      ) : null}

      {cartView === 'international' ? (
        <section id="cart-link-panel-international" role="tabpanel" aria-labelledby="cart-link-tab-international" className="cart-link-view-panel">
          <IntensiveInternationalOfferManagement/>
        </section>
      ) : null}

      <dialog ref={dialogRef} className="ops-dialog" aria-labelledby="cart-link-product-detail-title" onClose={() => setDetail(null)}>
        {detail ? (
          <div className="ops-dialog__surface">
            <header className="ops-dialog__header">
              <div>
                <h2 id="cart-link-product-detail-title">{detail.name}</h2>
                <p>{kindLabel(detail.item_kind)}</p>
              </div>
              <button type="button" className="ops-icon-button" onClick={() => setDetail(null)} aria-label="Close product details"><X/></button>
            </header>
            {imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="cart-link-detail-cover" src={imageUrl} alt={'Cover for ' + detail.name}/>
              </>
            ) : null}
            <div className="ops-detail-grid">
              <div><span>Price</span><strong>{formatRupiah(detail.price_amount)}</strong></div>
              <div><span>Status</span><strong>{detail.is_available ? 'Active / available for purchase' : 'Unavailable'}</strong></div>
              {detail.session_count ? <div><span>Session count</span><strong>{detail.session_count}</strong></div> : null}
              {detail.mentor_tier_name ? <div><span>Mentor tier</span><strong>{detail.mentor_tier_name}</strong></div> : null}
            </div>
            {detail.description ? <section className="ops-dialog__section"><h3>Description</h3><p>{detail.description}</p></section> : null}
          </div>
        ) : null}
      </dialog>
    </div>
  )
}
