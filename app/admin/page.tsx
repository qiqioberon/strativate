'use client'

import { Building2, CalendarDays, FileBarChart2, Images, LayoutDashboard, Menu, PackageOpen, ReceiptText, ShoppingCart, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import { AdminCommerceOperations } from '@/components/admin/commerce-operations'
import { CommerceCartLinkManagement } from '@/components/admin/commerce-cart-link-management'
import { DigitalProductManagement } from '@/components/admin/digital-product-management'
import { HeroPosterManagement } from '@/components/admin/hero-poster-management'
import { InstitutionManagement } from '@/components/admin/institutions'
import { MasterOptions } from '@/components/admin/master-options'
import { MentorManagement } from '@/components/admin/mentor-management'
import { MenteeManagement } from '@/components/admin/people'
import { PrivateMentoringManagement } from '@/components/admin/private-mentoring-management'
import { PrivateMentoringSessionManagement } from '@/components/admin/private-mentoring-enrollment-management'
import { useAccount } from '@/components/auth/account-provider'
import { ProfileForm } from '@/components/auth/profile-form'
import { BrandLogo } from '@/components/brand/brand-logo'
import { RoleCalendar } from '@/components/calendar/role-calendar'
import { DashboardSidebarUtilities } from '@/components/dashboard/dashboard-sidebar-utilities'
import { DashboardTopbarActions } from '@/components/dashboard/dashboard-topbar-actions'
import { displayName } from '@/lib/auth/rules'

type Section = 'Overview' | 'Orders' | 'Mentoring Sessions' | 'Calendar' | 'Cart Links' | 'Mentees' | 'Mentors' | 'Private Mentoring' | 'Digital Products' | 'Hero Posters' | 'Reports' | 'Institutions' | 'Referral Sources' | 'Competition Interests' | 'Profile'
type NavItem = { id: Section; label: string; icon: typeof LayoutDashboard }
const groups: { label: string; items: NavItem[] }[] = [
 {label:'Operasional',items:[{id:'Overview',label:'Ringkasan',icon:LayoutDashboard},{id:'Orders',label:'Pesanan',icon:ReceiptText},{id:'Mentoring Sessions',label:'Mentoring Sessions',icon:UsersRound},{id:'Calendar',label:'Jadwal',icon:CalendarDays},{id:'Cart Links',label:'Cart Links',icon:ShoppingCart}]},
 {label:'Pengguna',items:[{id:'Mentees',label:'Mentees',icon:UsersRound},{id:'Mentors',label:'Mentors',icon:UsersRound}]},
 { label: 'Produk', items: [{ id: 'Private Mentoring', label: 'Private Mentoring', icon: PackageOpen }, { id: 'Digital Products', label: 'Produk Digital', icon: PackageOpen }] },
 {label:'Konten',items:[{id:'Hero Posters',label:'Hero Posters',icon:Images}]},
 {label:'Bisnis',items:[{id:'Reports',label:'Laporan',icon:FileBarChart2}]},
 {label:'Data master',items:[{id:'Institutions',label:'Institusi',icon:Building2},{id:'Referral Sources',label:'Sumber Referral',icon:Building2},{id:'Competition Interests',label:'Minat Kompetisi',icon:Building2}]},
]
export default function AdminDashboard(){
 const account=useAccount();const[section,setSection]=useState<Section>('Overview');const[mobile,setMobile]=useState(false)
 const navigate=(value:Section)=>{setSection(value);setMobile(false)};const navigateOperational=(target:string)=>{if(target==='orders')navigate('Orders');else if(target==='sessions')navigate('Mentoring Sessions');else if(target==='reports')navigate('Reports')}
 const currentLabel=groups.flatMap(group=>group.items).find(item=>item.id===section)?.label??(section==='Profile'?'Profil':section)
 return <div className="role-shell admin-shell"><aside id="admin-navigation" className={`role-sidebar ${mobile?'open':''}`}><div className="role-brand"><BrandLogo/><button type="button" onClick={()=>setMobile(false)} className="role-close" aria-label="Tutup menu admin"><X aria-hidden="true"/></button></div><div className="role-person"><span className="role-avatar red">OP</span><div><strong>{displayName(account)}</strong><small>Kantor pusat Strativate</small></div></div><nav aria-label="Navigasi admin">{groups.map(group=><div className="nav-group" key={group.label}><small>{group.label}</small>{group.items.map(({id,label,icon:Icon})=><button type="button" className={section===id?'active':''} key={id} onClick={()=>navigate(id)}><Icon aria-hidden="true"/>{label}</button>)}</div>)}</nav><div className="role-sidebar-bottom"><DashboardSidebarUtilities/></div></aside>{mobile?<button type="button" className="role-scrim" onClick={()=>setMobile(false)} aria-label="Tutup menu"/>:null}<main className="role-main"><header className="role-topbar"><button type="button" className="role-menu" onClick={()=>setMobile(true)} aria-label="Buka menu admin" aria-controls="admin-navigation" aria-expanded={mobile}><Menu aria-hidden="true"/></button><span className="role-context">{currentLabel}</span><div className="role-actions"><DashboardTopbarActions role="admin" onEditProfile={()=>navigate('Profile')}/></div></header><div className="role-content">
 {section==='Overview'?<AdminCommerceOperations mode="overview" onNavigate={navigateOperational}/>:null}{section==='Orders'?<AdminCommerceOperations mode="orders"/>:null}{section==='Mentoring Sessions'?<PrivateMentoringSessionManagement/>:null}{section==='Calendar'?<RoleCalendar role="admin"/>:null}{section==='Cart Links'?<CommerceCartLinkManagement/>:null}{section==='Mentees'?<MenteeManagement/>:null}{section==='Mentors'?<MentorManagement/>:null}{section==='Private Mentoring'?<PrivateMentoringManagement/>:null}{section === 'Digital Products' ? <DigitalProductManagement /> : null}{section==='Hero Posters'?<HeroPosterManagement/>:null}{section==='Reports'?<AdminCommerceOperations mode="reports"/>:null}{section==='Institutions'?<InstitutionManagement/>:null}{section==='Referral Sources'?<MasterOptions key="referral" table="referral_sources"/>:null}{section==='Competition Interests'?<MasterOptions key="interests" table="interests"/>:null}{section==='Profile'?<ProfileForm/>:null}
 </div></main></div>
}
