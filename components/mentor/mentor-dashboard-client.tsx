'use client'

import {
  Bell,
  CalendarDays,
  ClipboardList,
  Clock3,
  History as HistoryIcon,
  LayoutDashboard,
  Menu,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAccount } from '@/components/auth/account-provider'
import { BrandLogo } from '@/components/brand/brand-logo'
import { RoleCalendar } from '@/components/calendar/role-calendar'
import { DashboardSidebarUtilities } from '@/components/dashboard/dashboard-sidebar-utilities'
import { DashboardTopbarActions } from '@/components/dashboard/dashboard-topbar-actions'
import { AssignmentPanel } from '@/components/mentor/dashboard/mentor-assignments'
import { HistoryPanel } from '@/components/mentor/dashboard/mentor-history'
import { MenteePanel } from '@/components/mentor/dashboard/mentor-mentees'
import { MentorOverview, type MentorDashboardSection } from '@/components/mentor/dashboard/mentor-overview'
import { AvailabilityPanel, MentorProfilePanel, NotificationsPanel } from '@/components/mentor/dashboard/mentor-secondary-sections'
import { displayName } from '@/lib/auth/rules'
import { buildMentorOverview, type MentorAvailabilityState, type MentorDashboardData } from '@/lib/mentor/dashboard'
import type { MyMentorPublicProfileData } from '@/lib/mentor/public-profile-types'
import type { Notification } from '@/lib/supabase/database.types'

const nav = [
  { id: 'overview' as const, label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'calendar' as const, label: 'Kalender', icon: CalendarDays },
  { id: 'assignments' as const, label: 'Penugasan', icon: ClipboardList },
  { id: 'mentees' as const, label: 'Peserta Saya', icon: UsersRound },
  { id: 'availability' as const, label: 'Ketersediaan', icon: Clock3 },
  { id: 'history' as const, label: 'Riwayat Sesi', icon: HistoryIcon },
  { id: 'notifications' as const, label: 'Notifikasi', icon: Bell },
  { id: 'profile' as const, label: 'Profil', icon: UserRound },
]

export function MentorDashboardClient({
  initialData,
  initialPublicProfile,
  publicProfileError,
}: {
  initialData: MentorDashboardData
  initialPublicProfile: MyMentorPublicProfileData
  publicProfileError: string | null
}) {
  const account = useAccount()
  const router = useRouter()
  const [section, setSection] = useState<MentorDashboardSection>('overview')
  const [mobile, setMobile] = useState(false)
  const [availability, setAvailability] = useState<MentorAvailabilityState>(initialData.availability)
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null)
  const accountName = displayName(account)
  const overview = useMemo(() => buildMentorOverview(initialData.sessions, new Date(), initialData.timezone), [initialData.sessions, initialData.timezone])

  const open = (next: MentorDashboardSection) => {
    setSection(next)
    setMobile(false)
  }
  const openNotification = (item: Notification) => {
    if (item.related_entity === 'session') { setFocusSessionId(item.related_entity_id); open('assignments'); return }
    open('overview')
  }
  const currentLabel = nav.find(item => item.id === section)?.label || 'Dashboard mentor'
  const retry = () => router.refresh()

  return <div className="role-shell mentor-shell">
    <aside id="mentor-navigation" className={`role-sidebar ${mobile ? 'open' : ''}`}>
      <div className="role-brand"><BrandLogo/><button type="button" onClick={() => setMobile(false)} className="role-close" aria-label="Tutup menu mentor"><X aria-hidden="true"/></button></div>
      <div className="role-person"><span className="role-avatar blue">{accountName.slice(0, 2)}</span><div><strong>{accountName}</strong><small>Akun mentor</small></div></div>
      <nav aria-label="Navigasi mentor">{nav.map(({ id, label, icon: Icon }) => <button type="button" className={section === id ? 'active' : ''} key={id} onClick={() => open(id)}><Icon aria-hidden="true"/>{label}{id === 'assignments' && overview.upcomingSessions > 0 ? <b aria-label={`${overview.upcomingSessions} sesi mendatang`}>{overview.upcomingSessions}</b> : null}</button>)}</nav>
      <div className="role-sidebar-bottom"><DashboardSidebarUtilities/></div>
    </aside>
    {mobile ? <button type="button" className="role-scrim" onClick={() => setMobile(false)} aria-label="Tutup menu"/> : null}
    <main className="role-main">
      <header className="role-topbar"><button type="button" className="role-menu" onClick={() => setMobile(true)} aria-label="Buka menu mentor" aria-controls="mentor-navigation" aria-expanded={mobile}><Menu aria-hidden="true"/></button><span className="role-context">{currentLabel}</span><div className="role-actions"><DashboardTopbarActions role="mentor" onEditProfile={() => open('profile')} onOpenNotification={openNotification}/></div></header>
      <div className="role-content mentor-role-content">
        {section === 'overview' ? <MentorOverview name={accountName} data={{ ...initialData, availability }} open={open} onRetry={retry}/> : null}
        {section === 'calendar' ? <RoleCalendar role="mentor" onOpenAvailability={() => open('availability')}/> : null}
        {section === 'assignments' ? <AssignmentPanel data={initialData} open={open} onRetry={retry} focusSessionId={focusSessionId}/> : null}
        {section === 'mentees' ? <MenteePanel data={initialData} open={open} onRetry={retry}/> : null}
        {section === 'availability' ? <AvailabilityPanel mentorId={account.id} onSaved={setAvailability} open={open}/> : null}
        {section === 'history' ? <HistoryPanel data={initialData} open={open} onRetry={retry}/> : null}
        {section === 'notifications' ? <NotificationsPanel open={open} onOpenRelated={openNotification}/> : null}
        {section === 'profile' ? <MentorProfilePanel data={{ ...initialData, availability }} publicProfile={initialPublicProfile} publicProfileError={publicProfileError} open={open}/> : null}
      </div>
    </main>
  </div>
}
