'use client'

import { Images, LayoutDashboard, Menu, X } from 'lucide-react'
import { useState } from 'react'

import { CommerceCartLinkManagement } from '@/components/admin/commerce-cart-link-management'
import { DigitalProductManagement } from '@/components/admin/digital-product-management'
import { HeroPosterManagement } from '@/components/admin/hero-poster-management'
import { InstitutionManagement } from '@/components/admin/institutions'
import { MasterOptions } from '@/components/admin/master-options'
import { MenteeManagement } from '@/components/admin/people'
import { MentorManagement } from '@/components/admin/mentor-management'
import { PrivateMentoringManagement } from '@/components/admin/private-mentoring-management'
import { PrivateMentoringSessionManagement } from '@/components/admin/private-mentoring-session-management'
import { useAccount } from '@/components/auth/account-provider'
import { ProfileForm } from '@/components/auth/profile-form'
import { BrandLogo } from '@/components/brand/brand-logo'
import { DashboardSidebarUtilities } from '@/components/dashboard/dashboard-sidebar-utilities'
import { DashboardTopbarActions } from '@/components/dashboard/dashboard-topbar-actions'
import { displayName } from '@/lib/auth/rules'
import { displayLabel } from '@/lib/labels'

const groups = [
  { label: 'Operasional', items: ['Overview', 'Orders', 'Mentoring Sessions', 'Cart Links'] },
  { label: 'Pengguna', items: ['Mentees', 'Mentors'] },
  { label: 'Produk', items: ['Private Mentoring', 'Digital Products'] },
  { label: 'Konten', items: ['Hero Posters'] },
  { label: 'Bisnis', items: ['Payments', 'Reports'] },
  { label: 'Data master', items: ['Institutions', 'Referral Sources', 'Competition Interests'] },
]

export default function AdminDashboard() {
  const account = useAccount()
  const [section, setSection] = useState('Overview')
  const [mobile, setMobile] = useState(false)
  const navigate = (value: string) => { setSection(value); setMobile(false) }

  return <div className="role-shell admin-shell">
    <aside id="admin-navigation" className={`role-sidebar ${mobile ? 'open' : ''}`}>
      <div className="role-brand"><BrandLogo /><button type="button" onClick={() => setMobile(false)} className="role-close" aria-label="Tutup menu admin"><X aria-hidden="true" /></button></div>
      <div className="role-person"><span className="role-avatar red">OP</span><div><strong>{displayName(account)}</strong><small>Kantor pusat Strativate</small></div></div>
      <nav aria-label="Navigasi admin">{groups.map(group => <div className="nav-group" key={group.label}><small>{group.label}</small>{group.items.map(item => <button type="button" className={section === item ? 'active' : ''} key={item} onClick={() => navigate(item)}>{item === 'Hero Posters' ? <Images aria-hidden="true" /> : <LayoutDashboard aria-hidden="true" />}{displayLabel(item)}</button>)}</div>)}</nav>
      <div className="role-sidebar-bottom"><button>Bantuan &amp; dukungan</button><DashboardSidebarUtilities /></div>
    </aside>
    {mobile && <button className="role-scrim" onClick={() => setMobile(false)} aria-label="Tutup menu" />}
    <main className="role-main">
      <header className="role-topbar"><button type="button" className="role-menu" onClick={() => setMobile(true)} aria-label="Buka menu admin" aria-controls="admin-navigation" aria-expanded={mobile}><Menu aria-hidden="true" /></button><span className="role-context">{displayLabel(section)}</span><div className="role-actions"><DashboardTopbarActions role="admin" onEditProfile={() => navigate('Profile')} /></div></header>
      <div className="role-content">
        {section === 'Overview' && <AdminIntro />}
        {section === 'Private Mentoring' && <PrivateMentoringManagement />}
        {section === 'Digital Products' && <DigitalProductManagement />}
        {section === 'Cart Links' && <CommerceCartLinkManagement />}
        {section === 'Mentoring Sessions' && <PrivateMentoringSessionManagement />}
        {section === 'Hero Posters' && <HeroPosterManagement />}
        {section === 'Mentors' && <MentorManagement />}
        {section === 'Mentees' && <MenteeManagement />}
        {section === 'Institutions' && <InstitutionManagement />}
        {section === 'Referral Sources' && <MasterOptions key="referral" table="referral_sources" />}
        {section === 'Competition Interests' && <MasterOptions key="interests" table="interests" />}
        {section === 'Profile' && <ProfileForm />}
        {['Orders', 'Payments', 'Reports'].includes(section) && <AdminPlaceholder section={section} />}
      </div>
    </main>
  </div>
}

function AdminIntro() { return <><div className="role-title"><div><p className="kicker">Operasional</p><h1>Admin Strativate.</h1><p>Kelola produk, pengguna, Cart Links, dan pelaksanaan Private Mentoring dari menu di samping.</p></div></div><div className="metric-grid three"><section className="metric-card"><span>Private Mentoring</span><strong>Domain aktif</strong><small>Konten dan paket dari database</small></section><section className="metric-card"><span>Cart Links</span><strong>Shared Commerce</strong><small>Harga server-authoritative</small></section><section className="metric-card"><span>Mentoring Sessions</span><strong>Admin-scheduled</strong><small>Mentor harus sesuai tier</small></section></div></> }
function AdminPlaceholder({ section }: { section: string }) { return <div className="role-page-title"><p className="kicker">Operasional</p><h2>{displayLabel(section)}</h2><p>Modul ini tetap menggunakan implementasi yang sudah ada dan berada di luar perubahan domain Private Mentoring Phase 3.</p></div> }
