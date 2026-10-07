'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Bell, CalendarDays, ChevronRight, MessageCircle, Clock3, FileText, LayoutDashboard, LibraryBig, Menu, Play, ReceiptText, ShoppingCart, UsersRound, X } from 'lucide-react'
import { useAccount } from '@/components/auth/account-provider'
import { ProfileAvatar } from '@/components/auth/profile-avatar'
import { ProfileForm } from '@/components/auth/profile-form'
import { BrandLogo } from '@/components/brand/brand-logo'
import { RoleCalendar } from '@/components/calendar/role-calendar'
import { CartView } from '@/components/commerce/cart-view'
import { UserOrderHistory } from '@/components/commerce/user-order-history'
import { DashboardSidebarUtilities } from '@/components/dashboard/dashboard-sidebar-utilities'
import { DashboardNotificationCenter } from '@/components/dashboard/notification-center'
import { DashboardTopbarActions } from '@/components/dashboard/dashboard-topbar-actions'
import { MentorAvailabilityExplorer } from '@/components/dashboard/mentor-availability-explorer'
import { MentoringWorkspace } from '@/components/dashboard/mentoring-workspace'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { displayName } from '@/lib/auth/rules'
import { publicContact } from '@/lib/content/brand'
import { formatRupiah } from '@/lib/commerce/money'
import { menteeMentoringName, menteeSessionStatus } from '@/lib/mentoring-presentation'
import type { Notification } from '@/lib/supabase/database.types'
import type { ActiveCart, OrderWithItems, OwnedDigitalProductView } from '@/lib/commerce/types'
import type { PrivateMentoringSessionFocusView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'
import type { IntensiveEngagementView } from '@/lib/intensive-mentoring/types'
import styles from './mentee-dashboard.module.css'

type Section = 'overview' | 'mentoring' | 'mentorAvailability' | 'schedule' | 'library' | 'cart' | 'orders' | 'notifications' | 'profile'
function buildNav(digitalProductsEnabled: boolean): { id: Section; label: string; icon: typeof LayoutDashboard }[] {
  return [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'mentoring', label: 'Mentoring', icon: UsersRound },
    { id: 'mentorAvailability', label: 'Mentor availability', icon: Clock3 },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays },
    ...(digitalProductsEnabled ? [{ id: 'library' as const, label: 'My digital products', icon: LibraryBig }] : []),
    { id: 'cart', label: 'Cart', icon: ShoppingCart },
    { id: 'orders', label: 'Orders & payments', icon: ReceiptText },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Profile', icon: UsersRound },
  ]
}

export function DashboardClient({ digitalProductsEnabled, ownedDigitalProducts, cart, commerceOrders, privateMentoringSessions = [], intensiveMentoringEngagements = [], sessionFocuses = [] }: {
  digitalProductsEnabled: boolean; ownedDigitalProducts: OwnedDigitalProductView[]; cart: ActiveCart; commerceOrders: OrderWithItems[]
  privateMentoringSessions?: PrivateMentoringSessionView[]; intensiveMentoringEngagements?: IntensiveEngagementView[]; sessionFocuses?: PrivateMentoringSessionFocusView[]
}) {
  const account = useAccount()
  const router = useRouter()
  const accountName = displayName(account, 'en')
  const nav = buildNav(digitalProductsEnabled)
  const [section, setSection] = useState<Section>('overview')
  const [previousSection, setPreviousSection] = useState<Section>('overview')
  const [mobile, setMobile] = useState(false)
  const [relatedTarget, setRelatedTarget] = useState<{ entity: string | null; id: string | null } | null>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  useOperationalInvalidation(['commerce', 'cart', 'library', 'mentoring'], () => router.refresh())
  useEffect(() => {
    if (!mobile) return
    closeRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobile(false); menuRef.current?.focus() }
      else if (event.key === 'Tab') {
        const controls = sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')
        const first = controls?.[0], last = controls ? controls[controls.length - 1] : undefined
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mobile])
  function open(next: Section) {
    if (next !== section) setPreviousSection(section)
    setSection(next); setMobile(false)
    if (mobile) menuRef.current?.focus()
  }
  function openNotification(item: Notification) {
    setRelatedTarget({ entity: item.related_entity, id: item.related_entity_id })
    if (item.related_entity === 'order') open('orders')
    else if (['session', 'enrollment', 'intensive_mentoring_session', 'intensive_mentoring_engagement'].includes(item.related_entity ?? '')) open('mentoring')
    else open('overview')
  }
  const hasPendingPayment = commerceOrders.some(order => order.status === 'pending_payment')
  const closeMenu = () => { setMobile(false); menuRef.current?.focus() }
  return <div className={`workspace mentee-workspace ${styles.shell}`} lang="en">
    <aside ref={sidebarRef} id="mentee-navigation" className={`workspace-sidebar ${mobile ? 'open' : ''}`}>
      <div className="workspace-brand"><BrandLogo /><button ref={closeRef} type="button" className="workspace-close" onClick={closeMenu} aria-label="Close navigation"><X aria-hidden="true" /></button></div>
      <div className="workspace-profile"><ProfileAvatar account={account} className="workspace-avatar workspace-avatar-image" /><div><strong title={accountName}>{accountName}</strong><span>Mentee account</span></div><ChevronRight aria-hidden="true" /></div>
      <nav className="workspace-nav" aria-label="Dashboard navigation">{nav.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={section === id ? 'active' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => open(id)}>
        <Icon aria-hidden="true" />{label}{id === 'cart' && cart.items.length > 0 ? <b aria-label={`${cart.items.length} items`}>{cart.items.length > 99 ? '99+' : cart.items.length}</b> : null}{id === 'orders' && hasPendingPayment ? <i aria-label="Payment pending" /> : null}
      </button>)}</nav>
      <div className="workspace-side-footer"><DashboardSidebarUtilities language="en" /></div>
    </aside>
    {mobile ? <button type="button" className="workspace-scrim" onClick={closeMenu} aria-label="Close menu" tabIndex={-1} /> : null}
    <main className="workspace-main"><header className="workspace-topbar">
      <button ref={menuRef} type="button" className="workspace-menu" onClick={() => setMobile(true)} aria-label="Open navigation" aria-expanded={mobile} aria-controls="mentee-navigation"><Menu aria-hidden="true" /></button>
      <span className={styles.srOnly} aria-live="polite">{nav.find(item => item.id === section)?.label}</span>
      <div className="workspace-actions"><DashboardTopbarActions role="mentee" onEditProfile={() => open('profile')} onOpenNotification={openNotification} /></div>
    </header><div className="workspace-content">
      {section === 'overview' ? <Overview name={accountName} open={open} sessions={privateMentoringSessions} products={ownedDigitalProducts} orders={commerceOrders} cart={cart} digitalProductsEnabled={digitalProductsEnabled} /> : null}
      {section === 'mentoring' ? <><SectionHeading title="Your mentoring programs and sessions" /><MentoringWorkspace privateSessions={privateMentoringSessions} intensiveEngagements={intensiveMentoringEngagements} sessionFocuses={sessionFocuses} focusSessionId={relatedTarget?.entity === 'session' ? relatedTarget.id : null} focusEnrollmentId={relatedTarget?.entity === 'enrollment' ? relatedTarget.id : null} initialMode={relatedTarget?.entity?.startsWith('intensive_') ? 'intensive' : 'private'} /></> : null}
      {section === 'mentorAvailability' ? <><SectionHeading title="Find a mentor with available slots" /><MentorAvailabilityExplorer /></> : null}
      {section === 'schedule' ? <RoleCalendar role="mentee" /> : null}
      {section === 'library' ? <DigitalProductLibrary products={ownedDigitalProducts} /> : null}
      {section === 'cart' ? <CartView cart={cart} embedded language="en" onBack={() => open(previousSection === 'cart' ? 'overview' : previousSection)} /> : null}
      {section === 'orders' ? <><SectionHeading title="Orders & payments" /><UserOrderHistory orders={commerceOrders} language="en" focusOrderId={relatedTarget?.entity === 'order' ? relatedTarget.id : null} /></> : null}
      {section === 'notifications' ? <><SectionHeading title="Notifications" /><DashboardNotificationCenter language="en" onOpenRelated={openNotification} /></> : null}
      {section === 'profile' ? <div className={styles.profileStack}><ProfileForm language="en" /></div> : null}
    </div></main>
    <a className="dashboard-whatsapp-fab" href={publicContact.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Contact Strativate via WhatsApp" title="Contact Strativate"><MessageCircle aria-hidden="true" /><span>WhatsApp</span></a>
  </div>
}

function SectionHeading({ title, welcome = false }: { title: string; welcome?: boolean }) {
  return <div className={`workspace-page-title ${styles.heading} ${welcome ? styles.welcome : ''}`}><h1>{title}</h1></div>
}
function orderStatus(status: string) {
  const labels: Record<string, string> = { pending_payment: 'Pending payment', paid: 'Paid', payment_failed: 'Payment failed', expired: 'Expired', cancelled: 'Cancelled' }
  return labels[status] ?? status.replaceAll('_', ' ')
}
function Overview({ name, open, sessions, products, orders, cart, digitalProductsEnabled }: {
  name: string; open: (section: Section) => void; sessions: PrivateMentoringSessionView[]; products: OwnedDigitalProductView[]; orders: OrderWithItems[]; cart: ActiveCart; digitalProductsEnabled: boolean
}) {
  const pendingPayments = orders.filter(order => order.status === 'pending_payment').length
  const nextSession = sessions.filter(session => session.status === 'scheduled' && session.scheduledStartAt).sort((a, b) => new Date(a.scheduledStartAt!).getTime() - new Date(b.scheduledStartAt!).getTime())[0]
  const latestOrder = orders[0]
  return <>
    <SectionHeading title={`Welcome back, ${name}.`} welcome />
    {pendingPayments > 0 ? <section className={styles.attention} aria-label="Action needed"><button type="button" onClick={() => open('orders')}><span className={styles.attentionIcon}><ReceiptText aria-hidden="true" /></span><span><small className={styles.attentionLabel}>Action needed</small><strong>{pendingPayments} {pendingPayments === 1 ? 'payment is' : 'payments are'} pending</strong><small>Complete pending payments to continue.</small></span><ArrowRight aria-hidden="true" /></button></section> : null}
    <div className={styles.metrics}>
      <Metric icon={UsersRound} label="Mentoring sessions" value={sessions.length} detail={`${sessions.filter(session => session.status === 'completed').length} completed`} tone="orange" onClick={() => open('mentoring')} />
      {digitalProductsEnabled ? <Metric icon={LibraryBig} label="Digital products" value={products.length} detail="Purchased" tone="amber" onClick={() => open('library')} /> : null}
      <Metric icon={ReceiptText} label="Orders" value={orders.length} detail={pendingPayments ? `${pendingPayments} pending payment` : 'No pending payments'} tone="coral" onClick={() => open('orders')} />
      <Metric icon={ShoppingCart} label="Cart" value={cart.items.length} detail={cart.items.length ? formatRupiah(cart.totalAmount) : 'Empty'} tone="neutral" onClick={() => open('cart')} />
    </div>
    <div className={styles.details}>
      <section className={`workspace-card ${styles.detailCard}`}><div className={styles.detailLabel}><CalendarDays aria-hidden="true" /><h2>Next session</h2></div>{nextSession ? <><h3>Session {nextSession.sessionNumber} · {nextSession.resolvedTopic || nextSession.focusName || 'Focus not selected'}</h3><p className={styles.detailMeta}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(nextSession.scheduledStartAt!))}<br />{nextSession.mentorName ?? 'Mentor not assigned'} · {menteeSessionStatus(nextSession.status).label}</p><button className="text-link" type="button" onClick={() => open('schedule')}>View schedule <ArrowRight aria-hidden="true" /></button></> : <><h3>No sessions scheduled</h3><button className="text-link" type="button" onClick={() => open('mentoring')}>View mentoring <ArrowRight aria-hidden="true" /></button></>}</section>
      <section className={`workspace-card ${styles.detailCard}`}><div className={styles.detailLabel}><ReceiptText aria-hidden="true" /><h2>Latest order</h2></div>{latestOrder ? <><h3>{menteeMentoringName(latestOrder.items[0]?.name_snapshot ?? 'Strativate order')}{latestOrder.items.length > 1 ? ` +${latestOrder.items.length - 1} more` : ''}</h3><p className={styles.detailMeta}>{formatRupiah(latestOrder.total_amount)} · {orderStatus(latestOrder.status)}</p><button className="text-link" type="button" onClick={() => open('orders')}>View order <ArrowRight aria-hidden="true" /></button></> : <><h3>No orders yet</h3><a className="button button-outline" href="/program">Browse programs <ArrowRight aria-hidden="true" /></a></>}</section>
    </div>
  </>
}
function Metric({ icon: Icon, label, value, detail, tone, onClick }: { icon: typeof UsersRound; label: string; value: number; detail: string; tone: 'orange' | 'amber' | 'coral' | 'neutral'; onClick: () => void }) {
  return <button type="button" className={styles.metric} data-tone={tone} onClick={onClick}><span className={styles.metricIcon}><Icon aria-hidden="true" /></span><span className={styles.metricLabel}>{label}</span><strong>{value}</strong><small>{detail}</small></button>
}
function DigitalProductLibrary({ products }: { products: OwnedDigitalProductView[] }) {
  return <><div className={styles.libraryHeading}><SectionHeading title="Your digital products" /><a className="button button-outline" href="/produk-digital"><LibraryBig aria-hidden="true" />Browse digital products <ArrowRight aria-hidden="true" /></a></div>
    {products.length > 0 ? <div className={styles.resources}>{products.map(product => <article className={styles.resource} key={product.order_item_id}>
      <div className={styles.resourceMedia}>{product.imageUrl ? <img src={product.imageUrl} alt={`Cover of ${product.name_snapshot}`} loading="lazy" /> : <FileText aria-hidden="true" />}</div>
      <div className={styles.resourceBody}><div className={styles.resourceMeta}><time dateTime={product.purchased_at}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(product.purchased_at))}</time><span>{product.contentType === 'video' ? <Play aria-hidden="true" /> : <FileText aria-hidden="true" />}{product.contentType === 'video' ? 'Video' : product.contentType === 'pdf' ? 'PDF' : 'Material'}</span></div><h2>{product.name_snapshot}</h2><p className={styles.resourcePrice}>{formatRupiah(product.unit_price_amount)}</p>{product.contentReady ? <a className="button button-primary" href={`/dashboard/produk-digital/${product.product_id}`}>{product.contentType === 'video' ? <Play aria-hidden="true" /> : <FileText aria-hidden="true" />}{product.contentType === 'video' ? 'Watch video' : 'Open material'}<ArrowRight aria-hidden="true" /></a> : <p className={styles.resourcePending}>Material is being prepared.</p>}</div>
    </article>)}</div> : <section className={`workspace-card ${styles.empty}`}><LibraryBig aria-hidden="true" /><h2>No digital products yet</h2><p>Your purchases will appear here once payment is verified.</p></section>}
  </>
}
