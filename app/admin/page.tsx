'use client'

import {
  Bell,
  Building2,
  CalendarDays,
  FileBarChart2,
  Images,
  LayoutDashboard,
  MessageSquareQuote,
  Menu,
  Newspaper,
  PackageOpen,
  ReceiptText,
  ShoppingCart,
  Tags,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { AdminCommerceOperations } from '@/components/admin/commerce-operations'
import { CommerceCartLinkManagement } from '@/components/admin/commerce-cart-link-management'
import { CompetitionCategoryManagement } from '@/components/admin/competition-category-management'
import { DigitalProductManagement } from '@/components/admin/digital-product-management'
import { DiscountCodeManagement } from '@/components/admin/discount-code-management'
import { EditorialContentManagement } from '@/components/admin/editorial-content-management'
import { HeroPosterManagement } from '@/components/admin/hero-poster-management'
import { InstitutionManagement } from '@/components/admin/institutions'
import { IntensiveMentoringManagement } from '@/components/admin/intensive-mentoring-management'
import { MasterOptions } from '@/components/admin/master-options'
import { MentorExpertiseManagement } from '@/components/admin/mentor-expertise-management'
import { MentorManagement } from '@/components/admin/mentor-management'
import { MenteeManagement } from '@/components/admin/people'
import { TestimonialManagement } from '@/components/admin/testimonial-management'
import { PrivateMentoringManagement } from '@/components/admin/private-mentoring-management'
import { AdminMentoringSessionWorkspace } from '@/components/admin/admin-mentoring-session-workspace'
import { useAccount } from '@/components/auth/account-provider'
import { ProfileAvatar } from '@/components/auth/profile-avatar'
import { ProfileForm } from '@/components/auth/profile-form'
import { BrandLogo } from '@/components/brand/brand-logo'
import { RoleCalendar } from '@/components/calendar/role-calendar'
import { DashboardSidebarUtilities } from '@/components/dashboard/dashboard-sidebar-utilities'
import { DashboardTopbarActions } from '@/components/dashboard/dashboard-topbar-actions'
import { DashboardNotificationCenter } from '@/components/dashboard/notification-center'
import { displayName } from '@/lib/auth/rules'
import type { Notification } from '@/lib/supabase/database.types'

type Section =
  | 'Overview'
  | 'Orders'
  | 'Mentoring Sessions'
  | 'Calendar'
  | 'Cart Links'
  | 'Notifications'
  | 'Mentees'
  | 'Mentors'
  | 'Private Mentoring'
  | 'Intensive Mentoring'
  | 'Competition Categories'
  | 'Digital Products'
  | 'Discount Codes'
  | 'Hero Posters'
  | 'Testimonials'
  | 'Publications'
  | 'Competitions'
  | 'Reports'
  | 'Mentor Expertise'
  | 'Institutions'
  | 'Referral Sources'
  | 'Competition Interests'
  | 'Profile'

type NavItem = { id: Section; label: string; icon: typeof LayoutDashboard }

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operasional',
    items: [
      { id: 'Overview', label: 'Ringkasan', icon: LayoutDashboard },
      { id: 'Orders', label: 'Pesanan', icon: ReceiptText },
      { id: 'Mentoring Sessions', label: 'Mentoring Sessions', icon: UsersRound },
      { id: 'Calendar', label: 'Jadwal', icon: CalendarDays },
      { id: 'Cart Links', label: 'Cart Links', icon: ShoppingCart },
      { id: 'Notifications', label: 'Notifikasi', icon: Bell },
    ],
  },
  {
    label: 'Pengguna',
    items: [
      { id: 'Mentees', label: 'Mentees', icon: UsersRound },
      { id: 'Mentors', label: 'Mentors', icon: UsersRound },
    ],
  },
  {
    label: 'Produk',
    items: [
      { id: 'Private Mentoring', label: 'Private Mentoring', icon: PackageOpen },
      { id: 'Intensive Mentoring', label: 'Intensive Mentoring', icon: PackageOpen },
      { id: 'Competition Categories', label: 'Competition Categories', icon: PackageOpen },
      { id: 'Digital Products', label: 'Produk Digital', icon: PackageOpen },
      { id: 'Discount Codes', label: 'Discount Codes', icon: Tags },
    ],
  },
  {
    label: 'Konten',
    items: [
      { id: 'Hero Posters', label: 'Hero Posters', icon: Images },
      { id: 'Testimonials', label: 'Testimonials', icon: MessageSquareQuote },
      { id: 'Publications', label: 'Publications', icon: Newspaper },
      { id: 'Competitions', label: 'Competitions', icon: Trophy },
    ],
  },
  { label: 'Bisnis', items: [{ id: 'Reports', label: 'Laporan', icon: FileBarChart2 }] },
  {
    label: 'Data master',
    items: [
      { id: 'Mentor Expertise', label: 'Mentor Expertise', icon: Tags },
      { id: 'Institutions', label: 'Institusi', icon: Building2 },
      { id: 'Referral Sources', label: 'Sumber Referral', icon: Building2 },
      { id: 'Competition Interests', label: 'Minat Kompetisi', icon: Building2 },
    ],
  },
]

export default function AdminDashboard() {
  const account = useAccount()
  const [section, setSection] = useState<Section>('Overview')
  const [mobile, setMobile] = useState(false)
  const [relatedTarget, setRelatedTarget] = useState<{ entity: string | null; id: string | null } | null>(null)

  const navigate = (value: Section) => { setSection(value); setMobile(false) }
  const navigateOperational = (target: string) => {
    if (target === 'orders') navigate('Orders')
    else if (target === 'sessions') navigate('Mentoring Sessions')
    else if (target === 'reports') navigate('Reports')
  }
  const openNotification = (item: Notification) => {
    setRelatedTarget({ entity: item.related_entity, id: item.related_entity_id })
    if (item.related_entity === 'order') navigate('Orders')
    else if (item.related_entity === 'session' || item.related_entity === 'enrollment' || item.related_entity === 'intensive_mentoring_session' || item.related_entity === 'intensive_mentoring_engagement') navigate('Mentoring Sessions')
    else navigate('Overview')
  }
  const currentLabel = groups.flatMap(group => group.items).find(item => item.id === section)?.label ?? (section === 'Profile' ? 'Profil' : section)

  return (
    <div className="role-shell admin-shell">
      <aside id="admin-navigation" className={`role-sidebar ${mobile ? 'open' : ''}`}>
        <div className="role-brand"><BrandLogo/><button type="button" onClick={() => setMobile(false)} className="role-close" aria-label="Tutup menu admin"><X aria-hidden="true"/></button></div>
        <div className="role-person"><ProfileAvatar account={account} className="role-avatar"/><div><strong>{displayName(account)}</strong><small>Kantor pusat Strativate</small></div></div>
        <nav aria-label="Navigasi admin">
          {groups.map(group => <div className="nav-group" key={group.label}><small>{group.label}</small>{group.items.map(({ id, label, icon: Icon }) => <button type="button" className={section === id ? 'active' : ''} key={id} onClick={() => navigate(id)}><Icon aria-hidden="true"/>{label}</button>)}</div>)}
        </nav>
        <div className="role-sidebar-bottom"><DashboardSidebarUtilities/></div>
      </aside>
      {mobile ? <button type="button" className="role-scrim" onClick={() => setMobile(false)} aria-label="Tutup menu"/> : null}
      <main className="role-main">
        <header className="role-topbar"><button type="button" className="role-menu" onClick={() => setMobile(true)} aria-label="Buka menu admin" aria-controls="admin-navigation" aria-expanded={mobile}><Menu aria-hidden="true"/></button><span className="role-context">{currentLabel}</span><div className="role-actions"><DashboardTopbarActions role="admin" onEditProfile={() => navigate('Profile')} onOpenNotification={openNotification}/></div></header>
        <div className="role-content">
          {section === 'Overview' ? <AdminCommerceOperations mode="overview" onNavigate={navigateOperational}/> : null}
          {section === 'Orders' ? <AdminCommerceOperations mode="orders" focusOrderId={relatedTarget?.entity === 'order' ? relatedTarget.id : null}/> : null}
          {section === 'Mentoring Sessions' ? <AdminMentoringSessionWorkspace focusSessionId={relatedTarget?.entity === 'session' || relatedTarget?.entity === 'intensive_mentoring_session' ? relatedTarget.id : null} focusEnrollmentId={relatedTarget?.entity === 'enrollment' ? relatedTarget.id : null} focusEntity={relatedTarget?.entity}/> : null}
          {section === 'Calendar' ? <RoleCalendar role="admin"/> : null}
          {section === 'Cart Links' ? <CommerceCartLinkManagement/> : null}
          {section === 'Notifications' ? <><div className="role-page-title"><p className="kicker">Notifikasi</p><h2>Riwayat notifikasi</h2><p>Pembaruan operasional Admin dari backend realtime, dengan status baca yang tersinkron dengan bell.</p></div><DashboardNotificationCenter onOpenRelated={openNotification}/></> : null}
          {section === 'Mentees' ? <MenteeManagement/> : null}
          {section === 'Mentors' ? <MentorManagement/> : null}
          {section === 'Private Mentoring' ? <PrivateMentoringManagement/> : null}
          {section === 'Intensive Mentoring' ? <IntensiveMentoringManagement/> : null}
          {section === 'Competition Categories' ? <CompetitionCategoryManagement/> : null}
          {section === 'Digital Products' ? <DigitalProductManagement/> : null}
          {section === 'Discount Codes' ? <DiscountCodeManagement/> : null}
          {section === 'Hero Posters' ? <HeroPosterManagement/> : null}
          {section === 'Testimonials' ? <TestimonialManagement/> : null}
          {section === 'Publications' || section === 'Competitions' ? <EditorialContentManagement/> : null}
          {section === 'Reports' ? <AdminCommerceOperations mode="reports"/> : null}
          {section === 'Mentor Expertise' ? <MentorExpertiseManagement/> : null}
          {section === 'Institutions' ? <InstitutionManagement/> : null}
          {section === 'Referral Sources' ? <MasterOptions key="referral" table="referral_sources"/> : null}
          {section === 'Competition Interests' ? <MasterOptions key="interests" table="interests"/> : null}
          {section === 'Profile' ? <ProfileForm/> : null}
        </div>
      </main>
    </div>
  )
}
