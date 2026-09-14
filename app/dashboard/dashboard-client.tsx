'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Bell, CalendarDays, ChevronRight, CircleHelp, Clock3, FileText, LayoutDashboard, LibraryBig, Menu, ReceiptText, ShoppingCart, Sparkles, UsersRound, X } from 'lucide-react'

import { useAccount } from '@/components/auth/account-provider'
import { ProfileForm } from '@/components/auth/profile-form'
import { BrandLogo } from '@/components/brand/brand-logo'
import { CartView } from '@/components/commerce/cart-view'
import { UserOrderHistory } from '@/components/commerce/user-order-history'
import { DashboardSidebarUtilities } from '@/components/dashboard/dashboard-sidebar-utilities'
import { DashboardTopbarActions } from '@/components/dashboard/dashboard-topbar-actions'
import { PrivateMentoringSessions } from '@/components/dashboard/private-mentoring-sessions'
import { displayName } from '@/lib/auth/rules'
import { formatRupiah } from '@/lib/commerce/money'
import type { ActiveCart, OrderWithItems, OwnedDigitalProductView } from '@/lib/commerce/types'
import { DemoState, readState } from '@/lib/demo-store'
import { displayDemoLabel, displayDemoNotification } from '@/lib/demo-labels'
import type { PrivateMentoringSessionFocusView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'

type Section = 'overview' | 'mentoring' | 'schedule' | 'library' | 'cart' | 'orders' | 'notifications' | 'profile' | 'support'

function buildNav(digitalProductsEnabled: boolean): { id: Section; label: string; icon: typeof LayoutDashboard }[] {
  return [
    { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'mentoring', label: 'Mentoring saya', icon: UsersRound },
    { id: 'schedule', label: 'Jadwal', icon: CalendarDays },
    ...(digitalProductsEnabled ? [{ id: 'library' as const, label: 'Produk Digital Saya', icon: LibraryBig }] : []),
    { id: 'cart', label: 'Keranjang', icon: ShoppingCart },
    { id: 'orders', label: 'Pesanan & pembayaran', icon: ReceiptText },
  ]
}

export function DashboardClient({ digitalProductsEnabled, ownedDigitalProducts, cart, commerceOrders, privateMentoringSessions = [], sessionFocuses = [] }: {
  digitalProductsEnabled: boolean
  ownedDigitalProducts: OwnedDigitalProductView[]
  cart: ActiveCart
  commerceOrders: OrderWithItems[]
  privateMentoringSessions?: PrivateMentoringSessionView[]
  sessionFocuses?: PrivateMentoringSessionFocusView[]
}) {
  const account = useAccount()
  const accountName = displayName(account)
  const nav = buildNav(digitalProductsEnabled)
  const [section, setSection] = useState<Section>('overview')
  const [previousSection, setPreviousSection] = useState<Section>('overview')
  const [state, setState] = useState<DemoState | null>(null)
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    const refresh = () => setState({ ...readState(), user: { id: account.id, name: accountName } })
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('strativate-state-updated', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('strativate-state-updated', refresh)
    }
  }, [account.id, accountName])

  const open = (next: Section) => {
    if (next !== section) setPreviousSection(section)
    setSection(next)
    setMobile(false)
  }
  if (!state) return <div className="workspace workspace-loading"><BrandLogo variant="mark" className="workspace-loading-mark" /></div>

  const unread = state.notifications.filter(item => item.role === 'mentee' && !item.read).length
  const remainingPrivateSessions = privateMentoringSessions.filter(session => session.status !== 'completed').length
  const hasPendingPayment = commerceOrders.some(order => order.status === 'pending_payment')

  return <div className="workspace">
    <aside className={`workspace-sidebar ${mobile ? 'open' : ''}`}>
      <div className="workspace-brand"><BrandLogo /><button type="button" className="workspace-close" onClick={() => setMobile(false)} aria-label="Tutup navigasi"><X /></button></div>
      <div className="workspace-profile"><span className="workspace-avatar">{accountName.slice(0, 1)}</span><div><strong>{accountName}</strong><span>Akun peserta</span></div><ChevronRight /></div>
      <nav className="workspace-nav" aria-label="Navigasi ruang belajar">
        {nav.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={section === id ? 'active' : ''} onClick={() => open(id)}><Icon />{label}{id === 'cart' && cart.items.length > 0 ? <b>{cart.items.length}</b> : null}{id === 'orders' && hasPendingPayment ? <i /> : null}</button>)}
        <span className="workspace-divider" />
        <button type="button" className={section === 'notifications' ? 'active' : ''} onClick={() => open('notifications')}><Bell />Notifikasi{unread > 0 && <b>{unread}</b>}</button>
        <button type="button" className={section === 'profile' ? 'active' : ''} onClick={() => open('profile')}><UsersRound />Profil</button>
        <button type="button" className={section === 'support' ? 'active' : ''} onClick={() => open('support')}><CircleHelp />Dukungan</button>
      </nav>
      <div className="workspace-side-footer"><div className="credit-box"><span>Sesi Private Mentoring tersedia</span><strong>{remainingPrivateSessions} sesi</strong><small>Penjadwalan dilakukan oleh admin setelah fokus dipilih.</small></div><DashboardSidebarUtilities /></div>
    </aside>
    {mobile && <button type="button" className="workspace-scrim" onClick={() => setMobile(false)} aria-label="Tutup menu" />}
    <main className="workspace-main">
      <header className="workspace-topbar"><button type="button" className="workspace-menu" onClick={() => setMobile(true)} aria-label="Buka navigasi"><Menu /></button><span className="workspace-context">{nav.find(item => item.id === section)?.label || 'Ruang belajar'}</span><div className="workspace-actions"><DashboardTopbarActions role="mentee" onEditProfile={() => open('profile')} /></div></header>
      <div className="workspace-content">
        {section === 'overview' && <Overview name={state.user.name} open={open} sessions={privateMentoringSessions} products={ownedDigitalProducts} orders={commerceOrders} cart={cart} digitalProductsEnabled={digitalProductsEnabled} />}
        {section === 'mentoring' && <><Title eyebrow="Mentoring saya" title="Kelola setiap sesi Private Mentoring." detail="Pilih fokus sesi, lalu pantau mentor, jadwal, dan status yang ditetapkan oleh tim Strativate." /><PrivateMentoringSessions sessions={privateMentoringSessions} sessionFocuses={sessionFocuses} /></>}
        {section === 'schedule' && <ReadOnlySchedule sessions={privateMentoringSessions} />}
        {section === 'library' && <DigitalProductLibrary products={ownedDigitalProducts} />}
        {section === 'cart' && <CartView cart={cart} embedded onBack={() => open(previousSection === 'cart' ? 'overview' : previousSection)} />}
        {section === 'orders' && <Orders commerceOrders={commerceOrders} />}
        {section === 'notifications' && <Notifications state={state} />}
        {section === 'profile' && <ProfileForm />}
        {section === 'support' && <SimplePage title="Apa yang bisa kami bantu?" detail="Tim dukungan kami siap membantu pembayaran, pencocokan mentor, dan penjadwalan." />}
      </div>
    </main>
  </div>
}

function Title({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="workspace-page-title"><div><p className="kicker">{eyebrow}</p><h1>{title}</h1><p>{detail}</p></div></div>
}

function sessionLabel(status: string) {
  if (status === 'pending_payment') return 'Menunggu pembayaran'
  if (status === 'paid') return 'Lunas'
  if (status === 'payment_failed') return 'Pembayaran gagal'
  if (status === 'expired') return 'Kedaluwarsa'
  if (status === 'cancelled') return 'Dibatalkan'
  if (status === 'awaiting_focus') return 'Menunggu fokus'
  if (status === 'awaiting_scheduling') return 'Menunggu admin'
  if (status === 'scheduled') return 'Terjadwal'
  if (status === 'completed') return 'Selesai'
  return status.replaceAll('_', ' ')
}

function Overview({ name, open, sessions, products, orders, cart, digitalProductsEnabled }: { name: string; open: (section: Section) => void; sessions: PrivateMentoringSessionView[]; products: OwnedDigitalProductView[]; orders: OrderWithItems[]; cart: ActiveCart; digitalProductsEnabled: boolean }) {
  const awaitingFocus = sessions.filter(session => session.status === 'awaiting_focus').length
  const pendingPayments = orders.filter(order => order.status === 'pending_payment').length
  const nextSession = sessions.filter(session => session.scheduledStartAt && new Date(session.scheduledStartAt).getTime() >= Date.now()).sort((a, b) => new Date(a.scheduledStartAt!).getTime() - new Date(b.scheduledStartAt!).getTime())[0]
  const latestOrder = orders[0]
  return <>
    <Title eyebrow="Ruang belajar" title={`Selamat datang, ${name}.`} detail="Ringkasan ini mengambil data dari mentoring, produk digital, keranjang, dan pesanan yang sudah ada." />
    {(awaitingFocus > 0 || pendingPayments > 0) ? <section className="workspace-card overview-attention"><p className="kicker">Perlu tindakan</p>{awaitingFocus > 0 ? <button type="button" onClick={() => open('mentoring')}><Clock3 aria-hidden="true" /><span><strong>{awaitingFocus} sesi membutuhkan fokus</strong><small>Pilih topik agar admin dapat melanjutkan penjadwalan.</small></span><ArrowRight aria-hidden="true" /></button> : null}{pendingPayments > 0 ? <button type="button" onClick={() => open('orders')}><ReceiptText aria-hidden="true" /><span><strong>{pendingPayments} pembayaran masih pending</strong><small>Buka pesanan untuk melanjutkan pembayaran yang valid.</small></span><ArrowRight aria-hidden="true" /></button> : null}</section> : null}
    <div className="overview-metric-grid">
      <button type="button" className="workspace-card overview-metric" onClick={() => open('mentoring')}><UsersRound aria-hidden="true" /><span>Sesi mentoring</span><strong>{sessions.length}</strong><small>{sessions.filter(session => session.status === 'completed').length} selesai</small></button>
      {digitalProductsEnabled ? <button type="button" className="workspace-card overview-metric" onClick={() => open('library')}><LibraryBig aria-hidden="true" /><span>Produk digital</span><strong>{products.length}</strong><small>Dimiliki</small></button> : null}
      <button type="button" className="workspace-card overview-metric" onClick={() => open('orders')}><ReceiptText aria-hidden="true" /><span>Pesanan</span><strong>{orders.length}</strong><small>{pendingPayments} pending</small></button>
      <button type="button" className="workspace-card overview-metric" onClick={() => open('cart')}><ShoppingCart aria-hidden="true" /><span>Keranjang</span><strong>{cart.items.length}</strong><small>{cart.items.length ? formatRupiah(cart.totalAmount) : 'Kosong'}</small></button>
    </div>
    <div className="workspace-grid-two overview-detail-grid">
      <section className="workspace-card"><p className="kicker">Sesi berikutnya</p>{nextSession ? <><h3>Sesi {nextSession.sessionNumber} · {nextSession.focusName ?? 'Fokus mentoring'}</h3><p className="muted">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(nextSession.scheduledStartAt!))} · {nextSession.mentorName ?? 'Mentor belum ditetapkan'}</p><button className="text-link" type="button" onClick={() => open('schedule')}>Lihat jadwal <ArrowRight /></button></> : <><h3>Belum ada sesi terjadwal.</h3><p className="muted">Jadwal akan muncul setelah fokus dan penugasan admin selesai.</p><button className="text-link" type="button" onClick={() => open('mentoring')}>Lihat mentoring <ArrowRight /></button></>}</section>
      <section className="workspace-card"><p className="kicker">Pesanan terbaru</p>{latestOrder ? <><h3>{latestOrder.items[0]?.name_snapshot ?? 'Pesanan Strativate'}{latestOrder.items.length > 1 ? ` +${latestOrder.items.length - 1} item lainnya` : ''}</h3><p className="muted">{formatRupiah(latestOrder.total_amount)} · {sessionLabel(latestOrder.status)}</p><button className="text-link" type="button" onClick={() => open('orders')}>Lihat pesanan <ArrowRight /></button></> : <><h3>Belum ada pesanan.</h3><p className="muted">Pesanan baru akan muncul di sini.</p><a className="button button-outline" href="/program">Lihat Program <ArrowRight /></a></>}</section>
    </div>
  </>
}

function ReadOnlySchedule({ sessions }: { sessions: PrivateMentoringSessionView[] }) {
  const scheduled = sessions.filter(session => session.scheduledStartAt)
  return <><Title eyebrow="Jadwal" title="Jadwal mentoring yang sudah ditetapkan." detail="Jadwal bersifat read-only di dashboard mentee. Hubungi tim Strativate jika ada kendala operasional." /><section className="workspace-card schedule-list"><div className="card-heading"><div><p className="kicker">Agenda</p><h3>Sesi terjadwal</h3></div></div>{scheduled.map(session => <article className="schedule-card" key={session.sessionId}><CalendarDays aria-hidden="true" /><div><strong>Sesi {session.sessionNumber} · {session.focusName ?? 'Fokus mentoring'}</strong><span>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.scheduledStartAt!))} · {session.mentorName ?? 'Mentor belum ditetapkan'}</span></div><span className="ops-status ops-status--positive">{sessionLabel(session.status)}</span></article>)}{scheduled.length === 0 ? <p className="muted">Belum ada jadwal yang ditetapkan admin.</p> : null}</section></>
}

function DigitalProductLibrary({ products }: { products: OwnedDigitalProductView[] }) {
  return <><Title eyebrow="Produk Digital Saya" title="Produk digital yang sudah Anda beli." detail="Hanya item dari pesanan yang sudah terverifikasi lunas yang tampil di sini." />{products.length > 0 ? <div className="resource-grid">{products.map(product => <section className="workspace-card resource-card" key={product.order_item_id}>{product.imageUrl ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={product.imageUrl} alt={`Sampul ${product.name_snapshot}`} className="resource-card-cover" /></> : <FileText aria-hidden="true" />}<p className="kicker">Dibeli {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(product.purchased_at))}</p><h3>{product.name_snapshot}</h3><div className="resource-card__meta"><p>{formatRupiah(product.unit_price_amount)}</p><span className="resource-card__type">{product.contentType ? product.contentType.toUpperCase() : 'Materi'}</span></div>{product.contentReady ? <a className="button button-primary resource-card__action" href={`/dashboard/produk-digital/${product.product_id}`}>{product.contentType === 'video' ? 'Tonton video' : 'Buka materi'} <ArrowRight /></a> : <p className="muted">Materi sedang disiapkan.</p>}</section>)}</div> : <WorkspaceEmptyState title="Anda belum memiliki Produk Digital." detail="Produk digital yang sudah Anda beli akan muncul di sini setelah pembayarannya terverifikasi." href="/produk-digital" action="Lihat Produk Digital" />}<a className="button button-outline" href="/produk-digital">Lihat Produk Digital di Website</a></>
}

function Orders({ commerceOrders }: { commerceOrders: OrderWithItems[] }) {
  return <><Title eyebrow="Pesanan & pembayaran" title="Riwayat pesanan Anda." detail="Ringkasan dibuat compact; buka detail untuk melihat seluruh item dan melanjutkan pembayaran yang masih valid." /><UserOrderHistory orders={commerceOrders} /></>
}

function Notifications({ state }: { state: DemoState }) {
  return <><Title eyebrow="Notifikasi" title="Pembaruan untuk akunmu." detail="Informasi program dan pesanan muncul di sini." /><div className="notification-list">{state.notifications.map(notification => <section className="workspace-card notification-item" key={notification.id}><Bell /><div><p className="kicker">{displayDemoLabel(notification.createdAt)}</p><h3>{displayDemoNotification(notification.title)}</h3><p>{displayDemoNotification(notification.body)}</p></div></section>)}</div></>
}

function WorkspaceEmptyState({ title, detail, href, action }: { title: string; detail: string; href: string; action: string }) {
  return <section className="workspace-card booking-panel"><Sparkles aria-hidden="true" /><h3>{title}</h3><p className="panel-copy">{detail}</p><a className="button button-outline" href={href}>{action} <ArrowRight /></a></section>
}

function SimplePage({ title, detail }: { title: string; detail: string }) {
  return <><Title eyebrow="Ruang belajar" title={title} detail={detail} /><section className="empty-order"><Sparkles /><p>Gunakan navigasi untuk melanjutkan perjalanan belajar Anda.</p></section></>
}
