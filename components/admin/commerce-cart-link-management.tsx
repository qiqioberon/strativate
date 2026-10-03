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
  if (kind === 'digital_product') return 'Produk Digital'
  if (kind === 'private_mentoring') return 'Private Mentoring'
  if (kind === 'intensive_mentoring_package') return 'Program / package'
  if (kind === 'intensive_mentoring_bundle') return 'Bundle'
  if (kind === 'intensive_mentoring_add_on') return 'Add-on'
  if (kind === 'intensive_mentoring_custom_offer') return 'Penawaran Internasional'
  return kind.replaceAll('_', ' ')
}

function linkStatusLabel(status: string) {
  if (status === 'active') return 'Aktif'
  if (status === 'claimed') return 'Diklaim'
  if (status === 'revoked') return 'Dicabut'
  return status
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
      setMessage('Daftar mentee belum dapat dimuat.')
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
      setMessage('Daftar produk belum dapat dimuat.')
      return
    }
    setItems(result.data ?? [])
  }, [client, menteeId, productQuery])

  const loadHistory = useCallback(async () => {
    const result = await client.rpc<CartLinkRow[]>('list_admin_cart_links_page', { p_query: historyQuery.trim(), p_status: historyStatus, p_limit: pageSize, p_offset: page * pageSize })
    if (result.error) {
      setMessage('Riwayat Cart Link belum dapat dimuat.')
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
      setMessage(result.error?.message || 'Konteks Private Mentoring belum dapat dimuat.')
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
        setMessage(result.error?.message || 'Quote Private Mentoring belum tersedia.')
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
      const left = sortKey === 'mentee' ? a.mentee_email : sortKey === 'status' ? linkStatusLabel(a.status) : a.creator_email
      const right = sortKey === 'mentee' ? b.mentee_email : sortKey === 'status' ? linkStatusLabel(b.status) : b.creator_email
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
            <img className="cart-link-product-card__cover" src={supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).getPublicUrl(item.image_path).data.publicUrl} alt={'Sampul ' + item.name}/>
          </>
        ) : (
          <div className="cart-link-product-card__cover cart-link-product-card__cover--empty">{kindLabel(item.item_kind)}</div>
        )}
        <button type="button" className="cart-link-product-card__select" disabled={item.owned_by_mentee} onClick={() => toggleItem(item)} aria-pressed={selected}>
          <span className="cart-link-product-card__check">{selected ? <Check aria-hidden="true" size={15}/> : null}</span>
          <small>{kindLabel(item.item_kind)}</small>
          <strong>{item.name}</strong>
          <b>{formatRupiah(item.price_amount)}</b>
          {item.owned_by_mentee ? <span className="ops-status ops-status--neutral">Sudah dimiliki</span> : null}
        </button>
        <button type="button" className="button button-outline" onClick={() => void openDetail(item)}>
          <Eye aria-hidden="true" size={15}/>
          Lihat Detail
        </button>
      </article>
    )
  }

  async function openDetail(item: CommerceOption) {
    const result = await client.rpc<ProductDetail[]>('get_admin_commerce_item_detail', { p_commerce_item_id: item.commerce_item_id })
    if (result.error || !result.data?.[0]) {
      setMessage('Detail produk belum dapat dimuat.')
      return
    }
    setDetail(result.data[0])
  }

  async function createLink() {
    if (!menteeId || (itemIds.length === 0 && !privateIncluded)) {
      setMessage('Pilih satu mentee dan minimal satu item.')
      return
    }
    if (privateIncluded && (!privateQuote || privateSessionCountValue === null)) {
      setMessage('Tunggu sampai quote Private Mentoring tersedia.')
      return
    }
    if (privateMode === 'new_enrollment' && !competitionNames.length) {
      setMessage('Tambahkan minimal satu nama lomba untuk enrollment baru.')
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
      if (!response.ok || !body.url) throw new Error(body.error || 'Cart Link gagal dibuat.')
      setGeneratedUrl(body.url)
      setMessage('Cart Link berhasil dibuat dengan harga yang sudah dikunci.')
      setItemIds([])
      removePrivateMentoring()
      await loadHistory()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cart Link gagal dibuat.')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setMessage('Cart Link disalin ke clipboard.')
  }

  function changeSort(key: string | null, direction: SortDirection) {
    setSortKey(key as LinkSortKey | null)
    setSortDirection(direction)
  }

  const imageUrl = detail?.image_path ? supabase.storage.from(DIGITAL_PRODUCT_IMAGE_BUCKET).getPublicUrl(detail.image_path).data.publicUrl : null

  return (
    <div className="ops-page cart-link-management">
      <div className="role-page-title">
        <p className="kicker">Operasional · Shared Commerce</p>
        <h2>Cart Links</h2>
        <p>Kelola pembuatan Cart Link, riwayat, dan penawaran internasional dari satu alur yang terstruktur.</p>
      </div>

      <div className="cart-link-main-tabs" role="tablist" aria-label="Tampilan Cart Links">
        <button id="cart-link-tab-create" type="button" role="tab" aria-selected={cartView === 'create'} aria-controls="cart-link-panel-create" className={cartView === 'create' ? 'active' : ''} onClick={() => changeCartView('create')}>Buat Cart Link</button>
        <button id="cart-link-tab-history" type="button" role="tab" aria-selected={cartView === 'history'} aria-controls="cart-link-panel-history" className={cartView === 'history' ? 'active' : ''} onClick={() => changeCartView('history')}>Riwayat Cart Link</button>
        <button id="cart-link-tab-international" type="button" role="tab" aria-selected={cartView === 'international'} aria-controls="cart-link-panel-international" className={cartView === 'international' ? 'active' : ''} onClick={() => changeCartView('international')}>Penawaran Internasional</button>
      </div>

      {cartView === 'create' ? (
        <section id="cart-link-panel-create" role="tabpanel" aria-labelledby="cart-link-tab-create" className="role-card cart-link-create cart-link-view-panel">
          <div className="ops-section-heading">
            <div>
              <p className="kicker">Langkah 1</p>
              <h3>Pilih Mentee</h3>
              <p>Cart Link hanya dapat diklaim akun tujuan.</p>
            </div>
          </div>

          <div ref={comboRef} className="ops-field ops-field--wide">
            <span>Cari mentee</span>
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
                placeholder="Ketik nama atau email"
              />
              {menteeLoading ? <Loader2 className="spin" aria-hidden="true" size={15}/> : <ChevronDown aria-hidden="true" size={15}/>}
            </div>
            {comboOpen ? (
              <div id="cart-link-mentee-options" role="listbox" className="ops-combobox-options">
                {menteeLoading ? <p>Memuat…</p> : mentees.length ? mentees.map((mentee, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={mentee.user_id === menteeId}
                    className={index === activeIndex ? 'is-active' : ''}
                    key={mentee.user_id}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectMentee(mentee)}
                  >
                    <strong>{mentee.display_name || 'Mentee Strativate'}</strong>
                    <span>{mentee.email}</span>
                  </button>
                )) : <p>Tidak ada mentee yang cocok.</p>}
              </div>
            ) : null}
          </div>

          {selectedMentee ? (
            <div className="cart-link-selected-mentee" role="status">
              <span>Email akun tujuan</span>
              <strong>{selectedMentee.email}</strong>
            </div>
          ) : null}

          <div className={'cart-link-products ' + (menteeId ? '' : 'is-disabled')} aria-disabled={!menteeId}>
            <div className="ops-section-heading">
              <div>
                <p className="kicker">Langkah 2</p>
                <h3>Pilih produk</h3>
                <p>
                  {!menteeId
                    ? 'Pilih mentee untuk membuka katalog.'
                    : catalogTab === 'private'
                      ? privateReady
                        ? 'Private Mentoring siap ditambahkan.'
                        : privateMode
                          ? 'Lengkapi konfigurasi Private Mentoring.'
                          : 'Pilih mode untuk menambahkan Private Mentoring.'
                      : itemIds.length + ' item katalog dipilih.'}
                </p>
              </div>
            </div>

            {menteeId ? (
              <>
                {catalogTab !== 'private' ? (
                  <label className="ops-field ops-field--wide cart-link-product-search">
                    <span>Cari produk</span>
                    <input value={productQuery} onChange={event => setProductQuery(event.target.value)} placeholder="Nama produk"/>
                  </label>
                ) : null}

                <div className="cart-link-product-tabs" role="tablist" aria-label="Kategori produk">
                  <button id="cart-link-product-tab-digital" type="button" role="tab" aria-selected={catalogTab === 'digital'} aria-controls="cart-link-product-panel-digital" className={catalogTab === 'digital' ? 'active' : ''} onClick={() => setCatalogTab('digital')}>Produk Digital</button>
                  <button id="cart-link-product-tab-private" type="button" role="tab" aria-selected={catalogTab === 'private'} aria-controls="cart-link-product-panel-private" className={catalogTab === 'private' ? 'active' : ''} onClick={() => setCatalogTab('private')}>Private Mentoring</button>
                  <button id="cart-link-product-tab-intensive" type="button" role="tab" aria-selected={catalogTab === 'intensive'} aria-controls="cart-link-product-panel-intensive" className={catalogTab === 'intensive' ? 'active' : ''} onClick={() => setCatalogTab('intensive')}>Intensive Mentoring</button>
                </div>

                {itemIds.length || privateIncluded ? (
                  <div className="cart-link-selection-summary" aria-live="polite">
                    {itemIds.length ? <span><strong>{itemIds.length}</strong> produk katalog dipilih</span> : null}
                    {privateMode ? <span><strong>Private Mentoring</strong> · {privateMode === 'new_enrollment' ? 'Enrollment baru' : 'Tambah sesi'}</span> : null}
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
                        <p>Pilih salah satu mode untuk memasukkan Private Mentoring ke Cart Link.</p>
                      </div>
                      {privateIncluded ? (
                        <button type="button" className="button button-outline button-compact private-cart-remove" onClick={removePrivateMentoring}>
                          Batalkan Private Mentoring
                        </button>
                      ) : null}
                    </div>

                    <div className="private-cart-mode" role="group" aria-label="Mode Private Mentoring">
                      <button type="button" aria-pressed={privateMode === 'new_enrollment'} onClick={() => activatePrivateMode('new_enrollment')}>Enrollment baru</button>
                      <button type="button" aria-pressed={privateMode === 'top_up'} onClick={() => activatePrivateMode('top_up')}>Tambah sesi</button>
                    </div>

                    {privateIncluded ? (
                      <>
                        <div className="ops-form-stack private-cart-form">
                          {privateMode === 'new_enrollment' ? (
                            <label className="ops-field">
                              <span>Tier mentor</span>
                              <select value={privateTierId} onChange={event => setPrivateTierId(event.target.value)}>
                                <option value="">Pilih tier</option>
                                {privateContext.tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                              </select>
                            </label>
                          ) : (
                            <label className="ops-field">
                              <span>Enrollment tujuan</span>
                              <select value={targetEnrollmentId} onChange={event => setTargetEnrollmentId(event.target.value)}>
                                <option value="">Pilih enrollment</option>
                                {privateContext.enrollments.map(enrollment => <option key={enrollment.id} value={enrollment.id}>{enrollment.tierName} · {enrollment.purchasedSessions} sesi · {enrollment.status}</option>)}
                              </select>
                            </label>
                          )}

                          <label className="ops-field">
                            <span>{privateMode === 'top_up' ? 'Sesi tambahan' : 'Jumlah sesi'}</span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              inputMode="numeric"
                              value={privateSessionCount}
                              onChange={event => setPrivateSessionCount(event.target.value)}
                              aria-invalid={privateSessionCount !== '' && privateSessionCountValue === null}
                            />
                            {privateSessionCount === '' || privateSessionCountValue === null ? <small className="private-cart-helper">Masukkan bilangan bulat 1–20.</small> : null}
                          </label>

                          {privateMode === 'new_enrollment' ? (
                            <>
                              <MultiValueChipInput label="Nama lomba" value={competitionNames} onChange={setCompetitionNames}/>
                              <label className="ops-field">
                                <span>Kategori kompetisi <small>(opsional)</small></span>
                                <select value={competitionCategoryId} onChange={event => setCompetitionCategoryId(event.target.value)}>
                                  <option value="">Tanpa kategori</option>
                                  {competitionCategories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}
                                </select>
                              </label>
                            </>
                          ) : null}
                        </div>

                        {quoteBusy ? (
                          <p className="muted">Menghitung quote server…</p>
                        ) : privateQuote ? (
                          <>
                            <div className={'private-cart-quote ' + (privateMode === 'top_up' ? 'private-cart-quote--four' : '')}>
                              <div><span>Tier terkunci</span><strong>{privateQuote.mentorTierName}</strong></div>
                              {privateMode === 'top_up' ? <div><span>Sesi saat ini</span><strong>{privateQuote.currentSessionCount}</strong></div> : null}
                              <div><span>Total setelah pembelian</span><strong>{privateQuote.resultingSessionCount} sesi</strong></div>
                              <div><span>Harga terkunci</span><strong>{formatRupiah(privateQuote.lockedTotalAmount)}</strong></div>
                            </div>

                            <div className="private-cart-secondary">
                              <h5>Rincian harga</h5>
                              <ul className="private-cart-breakdown">
                                {privateQuote.breakdown.map(item => <li key={item.packageId}>{item.quantity} × package {item.sessionCount} sesi · {formatRupiah(item.subtotalAmount)}</li>)}
                              </ul>
                            </div>

                            {privateMode === 'top_up' ? (
                              <div className="private-cart-secondary">
                                <h5>Kompetisi saat ini</h5>
                                <div className="mentoring-chip-list">
                                  {privateQuote.competitionNames?.length ? privateQuote.competitionNames.map(name => <span className="mentoring-chip" key={name}>{name}</span>) : <span className="muted">Belum ada kompetisi tercatat.</span>}
                                </div>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <p className="muted">Lengkapi pilihan untuk melihat harga terkunci.</p>
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

                {catalogTab !== 'private' && visibleItems.length === 0 ? <p className="muted">Tidak ada produk yang cocok di kategori ini.</p> : null}
              </>
            ) : (
              <div className="cart-link-products__locked">Pilih mentee di atas sebelum memilih produk.</div>
            )}
          </div>

          <div className="button-row cart-link-create-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={busy || !menteeId || (itemIds.length === 0 && !privateIncluded) || Boolean(privateIncluded && !privateReady)}
              onClick={() => void createLink()}
            >
              {busy ? 'Membuat…' : 'Buat Cart Link'}
            </button>
          </div>

          {generatedUrl ? (
            <div className="cart-link-result">
              <p className="kicker">Tautan baru</p>
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
              <p className="kicker">Riwayat Cart Link</p>
              <h3>Riwayat Cart Link</h3>
              <p>Telusuri Cart Link yang pernah dibuat dan status klaimnya.</p>
            </div>
            <span>{totalLinks} data</span>
          </div>
          <div className="ops-filter-bar cart-link-history-filters">
            <label className="ops-field ops-field--wide">
              <span>Cari riwayat</span>
              <input value={historyQuery} onChange={event => { setHistoryQuery(event.target.value); setPage(0) }} placeholder="Mentee, creator, atau ID"/>
            </label>
            <label className="ops-field">
              <span>Status</span>
              <select value={historyStatus} onChange={event => { setHistoryStatus(event.target.value); setPage(0) }}>
                <option value="">Semua</option>
                <option value="active">Aktif</option>
                <option value="claimed">Diklaim</option>
                <option value="revoked">Dicabut</option>
              </select>
            </label>
            <label className="ops-field">
              <span>Per halaman</span>
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
                  <SortableTableHeader label="Dibuat" sortKey="created_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/>
                  <SortableTableHeader label="Creator" sortKey="creator" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/>
                  <SortableTableHeader label="Diklaim" sortKey="claimed_at" activeKey={sortKey} direction={sortDirection} onSortChange={changeSort}/>
                </tr>
              </thead>
              <tbody>
                {visibleLinks.length ? visibleLinks.map(link => (
                  <tr key={link.id}>
                    <td><strong>{link.mentee_email}</strong><small>{link.id}</small></td>
                    <td><span className={'ops-status ops-status--' + (link.status === 'claimed' ? 'positive' : link.status === 'active' ? 'info' : 'neutral')}>{linkStatusLabel(link.status)}</span></td>
                    <td>{link.item_count}</td>
                    <td>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(link.created_at))}</td>
                    <td>{link.creator_email || '—'}</td>
                    <td>{link.claimed_at ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(link.claimed_at)) : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6}>Belum ada Cart Link yang cocok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination page={page} pageSize={pageSize} totalItems={totalLinks} onPageChange={setPage} label="Pagination riwayat Cart Link"/>
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
                <p className="kicker">Detail produk</p>
                <h2 id="cart-link-product-detail-title">{detail.name}</h2>
                <p>{kindLabel(detail.item_kind)}</p>
              </div>
              <button type="button" className="ops-icon-button" onClick={() => setDetail(null)} aria-label="Tutup detail produk"><X/></button>
            </header>
            {imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="cart-link-detail-cover" src={imageUrl} alt={'Sampul ' + detail.name}/>
              </>
            ) : null}
            <div className="ops-detail-grid">
              <div><span>Harga</span><strong>{formatRupiah(detail.price_amount)}</strong></div>
              <div><span>Status</span><strong>{detail.is_available ? 'Aktif / dapat dibeli' : 'Tidak tersedia'}</strong></div>
              {detail.session_count ? <div><span>Jumlah sesi</span><strong>{detail.session_count}</strong></div> : null}
              {detail.mentor_tier_name ? <div><span>Tier mentor</span><strong>{detail.mentor_tier_name}</strong></div> : null}
            </div>
            {detail.description ? <section className="ops-dialog__section"><h3>Deskripsi</h3><p>{detail.description}</p></section> : null}
          </div>
        ) : null}
      </dialog>
    </div>
  )
}
