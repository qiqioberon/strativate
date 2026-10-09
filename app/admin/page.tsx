'use client'

import {
  Bell,
  Building2,
  CalendarDays,
  FileBarChart2,
  Handshake,
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
  Video,
  X,
} from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { AboutUsContentManagement } from '@/components/admin/about-us-content-management'
import { AdminCommerceOperations } from '@/components/admin/commerce-operations'
import { AdminSalesReporting } from '@/components/admin/sales-reporting'
import { CommerceCartLinkManagement } from '@/components/admin/commerce-cart-link-management'
import { CompetitionRecognitionManagement } from '@/components/admin/competition-recognition-management'
import { CompetitionCategoryManagement } from '@/components/admin/competition-category-management'
import { DigitalProductManagement } from '@/components/admin/digital-product-management'
import { DiscountCodeManagement } from '@/components/admin/discount-code-management'
import { EditorialContentManagement } from '@/components/admin/editorial-content-management'
import { InstitutionManagement } from '@/components/admin/institutions'
import { IntensiveMentoringManagement } from '@/components/admin/intensive-mentoring-management'
import { MasterOptions } from '@/components/admin/master-options'
import { MentorExpertiseManagement } from '@/components/admin/mentor-expertise-management'
import { MentorManagement } from '@/components/admin/mentor-management'
import { MenteeManagement } from '@/components/admin/people'
import { TestimonialManagement } from '@/components/admin/testimonial-management'
import { TrustedPartnerManagement } from '@/components/admin/trusted-partner-management'
import { ZoomRoomManagement } from '@/components/admin/zoom-room-management'
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
import styles from './admin-shell.module.css'

type Section =
  | 'Overview'
  | 'Orders'
  | 'Mentoring Sessions'
  | 'Calendar'
  | 'Zoom'
  | 'Cart Links'
  | 'Notifications'
  | 'Mentees'
  | 'Mentors'
  | 'Private Mentoring'
  | 'Intensive Mentoring'
  | 'Competition Categories'
  | 'Digital Products'
  | 'Discount Codes'
  | 'Testimonials'
  | 'Publications'
  | 'Competitions'
  | 'Competition Recognition'
  | 'Trusted Partners'
  | 'About Us Content'
  | 'Reports'
  | 'Mentor Expertise'
  | 'Institutions'
  | 'Referral Sources'
  | 'Competition Interests'
  | 'Profile'

type NavItem = { id: Section; label: string; icon: typeof LayoutDashboard }

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { id: 'Overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'Orders', label: 'Orders', icon: ReceiptText },
      { id: 'Mentoring Sessions', label: 'Mentoring Sessions', icon: UsersRound },
      { id: 'Calendar', label: 'Schedule', icon: CalendarDays },
      { id: 'Zoom', label: 'Zoom', icon: Video },
      { id: 'Cart Links', label: 'Cart Links', icon: ShoppingCart },
      { id: 'Notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Users',
    items: [
      { id: 'Mentees', label: 'Mentees', icon: UsersRound },
      { id: 'Mentors', label: 'Mentors', icon: UsersRound },
    ],
  },
  {
    label: 'Products',
    items: [
      { id: 'Private Mentoring', label: 'Private Mentoring', icon: PackageOpen },
      { id: 'Intensive Mentoring', label: 'Intensive Mentoring', icon: PackageOpen },
      { id: 'Competition Categories', label: 'Competition Categories', icon: PackageOpen },
      { id: 'Digital Products', label: 'Digital Products', icon: PackageOpen },
      { id: 'Discount Codes', label: 'Discount Codes', icon: Tags },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'Testimonials', label: 'Testimonials', icon: MessageSquareQuote },
      { id: 'Publications', label: 'Publications', icon: Newspaper },
      { id: 'Competitions', label: 'Competitions', icon: Trophy },
      { id: 'Competition Recognition', label: 'Competition Recognition', icon: Trophy },
      { id: 'Trusted Partners', label: 'Trusted Partners', icon: Handshake },
      { id: 'About Us Content', label: 'About Us Content', icon: Images },
    ],
  },
  { label: 'Business', items: [{ id: 'Reports', label: 'Reports', icon: FileBarChart2 }] },
  {
    label: 'Master Data',
    items: [
      { id: 'Mentor Expertise', label: 'Mentor Expertise', icon: Tags },
      { id: 'Institutions', label: 'Institutions', icon: Building2 },
      { id: 'Referral Sources', label: 'Referral Sources', icon: Building2 },
      { id: 'Competition Interests', label: 'Competition Interests', icon: Building2 },
    ],
  },
]

export default function AdminDashboard() {
  const account = useAccount()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const menteeView = searchParams.get('view')
  const hasMenteeView = menteeView === 'data' || menteeView === 'analytics'
  const hasCartView = searchParams.has('cartView')
  const hasReportView = searchParams.has('reportView')
  const [section, setSection] = useState<Section>(() => hasReportView ? 'Reports' : hasCartView ? 'Cart Links' : hasMenteeView ? 'Mentees' : 'Overview')
  const [mobile, setMobile] = useState(false)
  const [narrowScreen, setNarrowScreen] = useState(false)
  const [profileDirty, setProfileDirty] = useState(false)
  const sectionRef = useRef(section)
  const profileDirtyRef = useRef(profileDirty)
  const acceptedHrefRef = useRef(`${pathname}${searchParams.size ? `?${searchParams.toString()}` : ''}`)
  sectionRef.current = section
  profileDirtyRef.current = profileDirty
  const menuRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const wasMobileOpen = useRef(false)
  const [relatedTarget, setRelatedTarget] = useState<{ entity: string | null; id: string | null } | null>(null)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 800px)')
    const update = () => {
      setNarrowScreen(query.matches)
      if (!query.matches) setMobile(false)
    }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!mobile) {
      if (wasMobileOpen.current) menuRef.current?.focus()
      wasMobileOpen.current = false
      return
    }
    wasMobileOpen.current = true
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobile(false)
        return
      }
      if (event.key !== 'Tab') return
      const controls = sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')
      const first = controls?.[0]
      const last = controls?.[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [mobile])

  const closeMobileNavigation = () => {
    setMobile(false)
  }

  useEffect(() => {
    const current = sectionRef.current
    const next: Section = hasReportView ? 'Reports' : hasCartView ? 'Cart Links' : hasMenteeView ? 'Mentees'
      : current === 'Cart Links' || current === 'Mentees' || current === 'Reports' ? 'Overview' : current
    if (next !== current && current === 'Profile' && profileDirtyRef.current) {
      if (!window.confirm('Discard unsaved profile changes?')) {
        router.replace(acceptedHrefRef.current, { scroll: false })
        return
      }
      setProfileDirty(false)
    }
    acceptedHrefRef.current = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ''}`
    setSection(next)
  }, [hasCartView, hasMenteeView, hasReportView, searchParams, pathname, router])

  const navigate = (value: Section) => {
    if (value !== section && section === 'Profile' && profileDirty && !window.confirm('Discard unsaved profile changes?')) return
    if (value !== section) setProfileDirty(false)
    setSection(value)
    if (mobile) closeMobileNavigation()

    const params = new URLSearchParams(searchParams.toString())
    if (value !== 'Reports') params.delete('reportView')
    if (value === 'Mentees') {
      params.delete('cartView')
      const view = params.get('view')
      if (view !== 'data' && view !== 'analytics') params.set('view', 'data')
    } else if (value === 'Cart Links') {
      params.delete('view')
      const cartView = params.get('cartView')
      if (cartView !== 'create' && cartView !== 'history' && cartView !== 'international') params.set('cartView', 'create')
    } else if (value === 'Reports') {
      params.delete('view')
      params.delete('cartView')
      const reportView = params.get('reportView')
      if (reportView !== 'summary' && reportView !== 'analytics' && reportView !== 'transactions') params.set('reportView', 'summary')
    } else {
      params.delete('view')
      params.delete('cartView')
    }

    const nextQuery = params.toString()
    if (nextQuery === searchParams.toString()) return
    const href = nextQuery ? `${pathname}?${nextQuery}` : pathname
    if (value === 'Mentees' || value === 'Cart Links' || value === 'Reports' || hasReportView) router.push(href, { scroll: false })
    else router.replace(href, { scroll: false })
  }
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
  const currentLabel = groups.flatMap(group => group.items).find(item => item.id === section)?.label ?? section

  return (
    <div className={`role-shell admin-shell ${styles.shell}`} lang="en">
      <aside ref={sidebarRef} id="admin-navigation" className={`role-sidebar ${mobile ? 'open' : ''}`} inert={narrowScreen && !mobile}>
        <div className="role-brand"><BrandLogo/><button ref={closeRef} type="button" onClick={closeMobileNavigation} className="role-close" aria-label="Close Admin navigation"><X aria-hidden="true"/></button></div>
        <div className="role-person"><ProfileAvatar account={account} className="role-avatar"/><div><strong>{displayName(account, 'en')}</strong><small>Strativate administration</small></div></div>
        <nav aria-label="Admin navigation">
          {groups.map(group => <div className="nav-group" key={group.label}><small>{group.label}</small>{group.items.map(({ id, label, icon: Icon }) => <button type="button" className={section === id ? 'active' : ''} key={id} aria-current={section === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon aria-hidden="true"/>{label}</button>)}</div>)}
        </nav>
        <div className="role-sidebar-bottom"><DashboardSidebarUtilities language="en"/></div>
      </aside>
      {mobile ? <button type="button" className="role-scrim" onClick={closeMobileNavigation} aria-label="Close navigation" tabIndex={-1}/> : null}
      <main className="role-main" inert={mobile}>
        <header className="role-topbar"><button ref={menuRef} type="button" className="role-menu" onClick={() => setMobile(current => !current)} aria-label={mobile ? 'Close Admin navigation' : 'Open Admin navigation'} aria-controls="admin-navigation" aria-expanded={mobile}><Menu aria-hidden="true"/></button><span className="sr-only">Current section: {currentLabel}</span><div className="role-actions"><DashboardTopbarActions role="admin" onEditProfile={() => navigate('Profile')} onOpenNotification={openNotification}/></div></header>
        <div className="role-content">
          {section === 'Overview' ? <AdminCommerceOperations mode="overview" onNavigate={navigateOperational}/> : null}
          {section === 'Orders' ? <AdminCommerceOperations mode="orders" focusOrderId={relatedTarget?.entity === 'order' ? relatedTarget.id : null}/> : null}
          {section === 'Mentoring Sessions' ? <AdminMentoringSessionWorkspace focusSessionId={relatedTarget?.entity === 'session' || relatedTarget?.entity === 'intensive_mentoring_session' ? relatedTarget.id : null} focusEnrollmentId={relatedTarget?.entity === 'enrollment' ? relatedTarget.id : null} focusEngagementId={relatedTarget?.entity === 'intensive_mentoring_engagement' ? relatedTarget.id : null} focusEntity={relatedTarget?.entity}/> : null}
          {section === 'Calendar' ? <RoleCalendar role="admin"/> : null}
          {section === 'Zoom' ? <ZoomRoomManagement/> : null}
          {section === 'Cart Links' ? <CommerceCartLinkManagement/> : null}
          {section === 'Notifications' ? <><div className="role-page-title"><h2>Notifications</h2></div><DashboardNotificationCenter language="en" onOpenRelated={openNotification}/></> : null}
          {section === 'Mentees' ? <MenteeManagement/> : null}
          {section === 'Mentors' ? <MentorManagement/> : null}
          {section === 'Private Mentoring' ? <PrivateMentoringManagement/> : null}
          {section === 'Intensive Mentoring' ? <IntensiveMentoringManagement/> : null}
          {section === 'Competition Categories' ? <CompetitionCategoryManagement/> : null}
          {section === 'Digital Products' ? <DigitalProductManagement/> : null}
          {section === 'Discount Codes' ? <DiscountCodeManagement/> : null}
          {section === 'Testimonials' ? <TestimonialManagement/> : null}
          {section === 'Publications' ? <EditorialContentManagement initialKind="publications"/> : null}
          {section === 'Competitions' ? <EditorialContentManagement initialKind="competitions"/> : null}
          {section === 'Competition Recognition' ? <CompetitionRecognitionManagement/> : null}
          {section === 'Trusted Partners' ? <TrustedPartnerManagement/> : null}
          {section === 'About Us Content' ? <AboutUsContentManagement/> : null}
          {section === 'Reports' ? <AdminSalesReporting/> : null}
          {section === 'Mentor Expertise' ? <MentorExpertiseManagement/> : null}
          {section === 'Institutions' ? <InstitutionManagement/> : null}
          {section === 'Referral Sources' ? <MasterOptions key="referral" table="referral_sources"/> : null}
          {section === 'Competition Interests' ? <MasterOptions key="interests" table="interests"/> : null}
          {section === 'Profile' ? <ProfileForm language="en" onUnsavedChange={setProfileDirty}/> : null}
        </div>
      </main>
    </div>
  )
}
