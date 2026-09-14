'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Bell, BookOpen, CalendarDays, ChevronRight, CircleHelp, Clock3, FileText, LayoutDashboard, LibraryBig, Menu, ReceiptText, ShoppingCart, Sparkles, UsersRound, X } from 'lucide-react'

import { useAccount } from '@/components/auth/account-provider'
import { ProfileForm } from '@/components/auth/profile-form'
import { BrandLogo } from '@/components/brand/brand-logo'
import { CartView } from '@/components/commerce/cart-view'
import { DashboardSidebarUtilities } from '@/components/dashboard/dashboard-sidebar-utilities'
import { DashboardTopbarActions } from '@/components/dashboard/dashboard-topbar-actions'
import { PrivateMentoringSessions } from '@/components/dashboard/private-mentoring-sessions'
import { displayName } from '@/lib/auth/rules'
import { formatRupiah } from '@/lib/commerce/money'
import type { ActiveCart, OrderWithItems, OwnedDigitalProductView } from '@/lib/commerce/types'
import { DemoState, readState } from '@/lib/demo-store'
import { displayDemoLabel, displayDemoNotification } from '@/lib/demo-labels'
import { displayLabel } from '@/lib/labels'
import type { PrivateMentoringPublicView, PrivateMentoringSessionView } from '@/lib/private-mentoring/types'

type Section = 'overview' | 'mentoring' | 'schedule' | 'programs' | 'library' | 'cart' | 'orders' | 'notifications' | 'profile' | 'support'

function buildNav(digitalProductsEnabled: boolean): { id: Section; label: string; icon: typeof LayoutDashboard }[] {
  return [
    { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'mentoring', label: 'Mentoring saya', icon: UsersRound },
    { id: 'schedule', label: 'Jadwal', icon: CalendarDays },
    { id: 'programs', label: 'Program saya', icon: BookOpen },
    ...(digitalProductsEnabled ? [{ id: 'library' as const, label: 'Produk Digital Saya', icon: LibraryBig }] : []),
    { id: 'cart', label: 'Keranjang', icon: ShoppingCart },
    { id: 'orders', label: 'Pesanan & pembayaran', icon: ReceiptText },
  ]
}

export function DashboardClient({
  digitalProductsEnabled,
  ownedDigitalProducts,
  cart,
  commerceOrders,
  privateMentoringSessions = [],
  sessionFocuses = [],
}: {
  digitalProductsEnabled: boolean
  ownedDigitalProducts: OwnedDigitalProductView[]
  cart: ActiveCart
  commerceOrders: OrderWithItems[]
  privateMentoringSessions?: PrivateMentoringSessionView[]
  sessionFocuses?: PrivateMentoringPublicView['sessionFocuses']
}) {
  const account = useAccount()
  const accountName = displayName(account)
  const nav = buildNav(digitalProductsEnabled)
  const [section, setSection] = useState<Section>('overview')
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

  const open = (next: Section) => { setSection(next); setMobile(false) }
  if (!state) return <div className="workspace workspace-loading"><BrandLogo variant="mark" className="workspace-loading-mark" /></div>

  const unread = state.notifications.filter(item => item.role === 'mentee' && !item.read).length
  const remainingPrivateSessions = privateMentoringSessions.filter(session => session.status !== 'completed').length
  const hasPendingPayment = state.orders.some(order => order.paymentStatus === 'Pending') || commerceOrders.some(order => order.status === 'pending_payment')

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
        {section === 'overview' && <Overview state={state} open={open} privateMentoringSessions={privateMentoringSessions} />}
        {section === 'mentoring' && <><Title eyebrow="Mentoring saya" title="Kelola fokus setiap sesi Private Mentoring." detail="Pilih fokus sesi. Mentor dan waktu sesi ditetapkan oleh admin sesuai tier paket yang kamu beli." /><PrivateMentoringSessions sessions={privateMentoringSessions} sessionFocuses={sessionFocuses} /></>}
        {section === 'schedule' && <ReadOnlySchedule sessions={privateMentoringSessions} />}
        {section === 'programs' && <Programs state={state} />}
        {section === 'library' && <DigitalProductLibrary products={ownedDigitalProducts} />}
        {section === 'cart' && <CartView cart={cart} embedded />}
        {section === 'orders' && <Orders state={state} commerceOrders={commerceOrders} />}
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

function Overview({ state, open, privateMentoringSessions }: { state: DemoState; open: (section: Section) => void; privateMentoringSessions: PrivateMentoringSessionView[] }) {
  const awaitingFocus = privateMentoringSessions.filter(session => session.status === 'awaiting_focus').length
  return <><Title eyebrow="Ruang belajar" title={`Selamat datang, ${state.user.name}.`} detail="Pantau program, pesanan, dan sesi mentoring dari satu tempat." />{awaitingFocus > 0 ? <section className="workspace-card"><div className="focus-row"><span className="focus-icon orange"><Clock3 /></span><div><strong>{awaitingFocus} sesi perlu fokus</strong><span>Pilih fokus agar tim Strativate dapat melanjutkan penjadwalan.</span></div><button className="text-link" onClick={() => open('mentoring')}>Buka <ArrowRight /></button></div></section> : null}<div className="workspace-grid-two"><section className="workspace-card"><p className="kicker">Private Mentoring</p><h3>{privateMentoringSessions.length} sesi tercatat</h3><p className="muted">Jadwal dan mentor akan tampil setelah ditetapkan admin.</p><button className="text-link" onClick={() => open('mentoring')}>Lihat sesi <ArrowRight /></button></section><section className="workspace-card yellow-card"><p className="kicker">Butuh program baru?</p><h3>Temukan layanan melalui website Strativate.</h3><a className="button button-outline" href="/program">Lihat Program di Website <ArrowRight /></a></section></div></>
}

function ReadOnlySchedule({ sessions }: { sessions: PrivateMentoringSessionView[] }) {
  const scheduled = sessions.filter(session => session.scheduledStartAt)
  return <><Title eyebrow="Jadwal" title="Jadwal mentoring yang sudah ditetapkan." detail="Jadwal bersifat read-only di dashboard mentee. Hubungi tim Strativate jika ada kendala operasional." /><section className="workspace-card"><div className="card-heading"><div><p className="kicker">Agenda</p><h3>Sesi terjadwal</h3></div></div>{scheduled.map(session => <div className="focus-row" key={session.sessionId}><span className="focus-icon orange"><CalendarDays /></span><div><strong>Sesi {session.sessionNumber} · {session.focusName}</strong><span>{session.scheduledStartAt ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.scheduledStartAt)) : '—'} · {session.mentorName ?? 'Mentor belum ditetapkan'}</span></div><span className="status-chip">{session.status}</span></div>)}{scheduled.length === 0 ? <p className="muted">Belum ada jadwal yang ditetapkan admin.</p> : null}</section></>
}

function Programs({ state }: { state: DemoState }) {
  return <><Title eyebrow="Program saya" title="Program belajar yang Anda miliki." detail="Lihat program yang sudah Anda beli beserta progresnya." />{state.enrollments.length > 0 ? <div className="program-list">{state.enrollments.map(item => <section className="workspace-card program-row" key={item.id}><span className="program-number orange"><Sparkles /></span><div><p className="kicker">{displayLabel(item.type)} · {item.id}</p><h3>{displayDemoLabel(item.subject)}</h3><p>Pesanan {item.orderId} · {item.progress}/{item.totalUnits} selesai</p></div><span className="status-chip">{displayLabel(item.status)}</span></section>)}</div> : <WorkspaceEmptyState title="Belum ada program yang dimiliki." detail="Program yang sudah Anda pesan akan muncul di sini." href="/program" action="Lihat Program" />}</>
}

function DigitalProductLibrary({ products }: { products: OwnedDigitalProductView[] }) {
  return <><Title eyebrow="Produk Digital Saya" title="Produk digital yang sudah Anda beli." detail="Hanya item dari pesanan yang sudah terverifikasi lunas yang tampil di sini." />{products.length > 0 ? <div className="resource-grid">{products.map(product => <section className="workspace-card resource-card" key={product.order_item_id}>{product.imageUrl ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={product.imageUrl} alt={`Sampul ${product.name_snapshot}`} className="resource-card-cover" /></> : <FileText aria-hidden="true" />}<p className="kicker">Dibeli {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(product.purchased_at))}</p><h3>{product.name_snapshot}</h3><div className="resource-card__meta"><p>{formatRupiah(product.unit_price_amount)}</p><span className="resource-card__type">{product.contentType ? product.contentType.toUpperCase() : 'Materi'}</span></div>{product.contentReady ? <a className="button button-primary resource-card__action" href={`/dashboard/produk-digital/${product.product_id}`}>{product.contentType === 'video' ? 'Tonton video' : 'Buka materi'} <ArrowRight /></a> : <p className="muted">Materi sedang disiapkan.</p>}</section>)}</div> : <WorkspaceEmptyState title="Anda belum memiliki Produk Digital." detail="Produk digital yang sudah Anda beli akan muncul di sini setelah pembayarannya terverifikasi." href="/produk-digital" action="Lihat Produk Digital" />}<a className="button button-outline" href="/produk-digital">Lihat Produk Digital di Website</a></>
}

function orderStatusLabel(status: OrderWithItems['status']) {
  if (status === 'pending_payment') return 'Menunggu pembayaran'
  if (status === 'paid') return 'Lunas'
  if (status === 'payment_failed') return 'Pembayaran gagal'
  if (status === 'expired') return 'Kedaluwarsa'
  return 'Dibatalkan'
}

function commerceKindLabel(kind: string) {
  if (kind === 'digital_product') return 'Produk Digital'
  if (kind === 'private_mentoring') return 'Private Mentoring'
  return 'Item'
}

function CommerceOrders({ orders }: { orders: OrderWithItems[] }) {
  if (orders.length === 0) return null
  return <section className="workspace-commerce-orders" aria-label="Pesanan checkout Strativate"><div className="card-heading"><div><p className="kicker">Shared Commerce</p><h3>Pesanan dari checkout Strativate</h3></div></div>{orders.map(order => <article className="workspace-card order-detail-card" key={order.id}><div className="order-detail-top"><div><p className="kicker">#STR-{order.id.slice(0, 8).toUpperCase()} · {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(order.created_at))}</p><h3>{order.items.map(item => item.name_snapshot).join(', ') || 'Pesanan Strativate'}</h3></div><span className="status-chip">{orderStatusLabel(order.status)}</span></div><div className="confirmation-grid"><div><span>Jumlah</span><strong>{formatRupiah(order.total_amount)}</strong></div><div><span>Status</span><strong>{orderStatusLabel(order.status)}</strong></div><div><span>Item</span><strong>{order.items.length}</strong></div><div><span>Pembayaran</span><strong>{order.status === 'paid' ? 'Terverifikasi' : 'Belum lunas'}</strong></div></div><div className="workspace-commerce-order__actions"><div className="workspace-commerce-order__items">{order.items.map(item => <span key={item.id}>{commerceKindLabel(item.item_kind_snapshot)} · {item.name_snapshot} · {formatRupiah(item.unit_price_amount)}</span>)}</div>{order.status === 'pending_payment' ? <a className="button button-primary" href={`/checkout?order=${encodeURIComponent(order.id)}`}>Lanjutkan pembayaran <ArrowRight /></a> : null}</div></article>)}</section>
}

function Orders({ state, commerceOrders }: { state: DemoState; commerceOrders: OrderWithItems[] }) {
  return <><Title eyebrow="Pesanan & pembayaran" title="Riwayat lengkap pesanan Anda." detail="Pesanan terbaru ditampilkan lebih dulu. Status checkout berasal dari sistem pembayaran Strativate." /><CommerceOrders orders={commerceOrders} />{state.orders.length > 0 ? <div className="order-list">{state.orders.map(order => <section className="workspace-card order-detail-card" key={order.id}><div className="order-detail-top"><div><p className="kicker">{order.id}</p><h3>{displayDemoLabel(order.title)}</h3></div><span className="status-chip">{displayLabel(order.paymentStatus)}</span></div><p>{displayDemoLabel(order.price)}</p></section>)}</div> : commerceOrders.length === 0 ? <WorkspaceEmptyState title="Belum ada pesanan." detail="Pesanan yang Anda buat akan muncul di sini." href="/program" action="Lihat Program" /> : null}</>
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
