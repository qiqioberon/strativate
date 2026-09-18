'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckCheck, ChevronDown, Loader2, PencilLine } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAccount } from '@/components/auth/account-provider'
import { SignOut } from '@/components/auth/sign-out'
import { displayName } from '@/lib/auth/rules'
import { createClient } from '@/lib/supabase/client'
import type { AppRole, Notification } from '@/lib/supabase/database.types'
import styles from './dashboard-shared.module.css'
import './dashboard-layout-overrides.module.css'

type Panel = 'notification' | 'account' | null
const roleLabels: Record<AppRole, string> = { admin:'Admin',mentor:'Mentor',mentee:'User' }

export function DashboardTopbarActions({role,onEditProfile}:{role:AppRole;onEditProfile:()=>void}) {
  const account=useAccount()
  const router=useRouter()
  const client=useMemo(()=>createClient(),[])
  const [openPanel,setOpenPanel]=useState<Panel>(null)
  const [notifications,setNotifications]=useState<Notification[]>([])
  const [notificationLoading,setNotificationLoading]=useState(true)
  const [notificationError,setNotificationError]=useState('')
  const rootRef=useRef<HTMLDivElement>(null)
  const name=displayName(account)
  const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join('')||'S'
  const unread=notifications.filter(item=>!item.read_at).length

  const loadNotifications=useCallback(async()=>{
    setNotificationLoading(true);setNotificationError('')
    const {data,error}=await client.from('notifications').select('*').order('created_at',{ascending:false}).limit(30)
    if(error){setNotificationError('Notifikasi belum dapat dimuat.');setNotificationLoading(false);return}
    setNotifications(data??[]);setNotificationLoading(false)
  },[client])

  useEffect(()=>{void loadNotifications()},[loadNotifications])
  useEffect(()=>{
    const channel=client.channel('dashboard-notifications-'+account.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications'},payload=>{
        void loadNotifications()
        const row=(payload.new??{}) as Partial<Notification>
        if(row.type==='meeting_url_changed'||row.type==='session_scheduled'||row.type==='session_cancelled'||row.type==='mentor_assigned'){window.dispatchEvent(new CustomEvent('strativate:operational-refresh'));router.refresh()}
      }).subscribe()
    return()=>{void client.removeChannel(channel)}
  },[account.id,client,loadNotifications,router])

  useEffect(()=>{
    const closeOutside=(event:PointerEvent)=>{if(rootRef.current&&!rootRef.current.contains(event.target as Node))setOpenPanel(null)}
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpenPanel(null)}
    document.addEventListener('pointerdown',closeOutside);document.addEventListener('keydown',closeOnEscape)
    return()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',closeOnEscape)}
  },[])

  const toggle=(panel:Exclude<Panel,null>)=>setOpenPanel(current=>current===panel?null:panel)
  async function markRead(id:string){await client.rpc('mark_notification_read',{p_notification_id:id});await loadNotifications()}
  async function markAllRead(){await client.rpc('mark_all_notifications_read');await loadNotifications()}

  return <div className={styles.topbarActions} ref={rootRef}>
    <button type="button" className={styles.iconButton} aria-label="Buka notifikasi" aria-haspopup="dialog" aria-expanded={openPanel==='notification'} aria-controls="dashboard-notification-popover" onClick={()=>toggle('notification')}>
      <Bell aria-hidden="true"/>
      {unread?<span className={styles.notificationCount} aria-hidden="true">{unread>99?'99+':unread}</span>:null}
    </button>

    <button type="button" className={styles.accountButton} aria-label="Buka menu akun" aria-haspopup="dialog" aria-expanded={openPanel==='account'} aria-controls="dashboard-account-popover" onClick={()=>toggle('account')}>
      <span className={styles.triggerAvatar} aria-hidden="true">{initials}</span><span className={styles.accountName}>{name}</span><ChevronDown className={styles.chevron} aria-hidden="true"/>
    </button>

    {openPanel==='notification'?<section id="dashboard-notification-popover" className={styles.popover} role="dialog" aria-label="Notifikasi">
      <div className={styles.popoverHeader}><div className={styles.notificationHeaderRow}><div><strong>Notifikasi</strong><span>{unread?unread+' belum dibaca':'Semua sudah dibaca'}</span></div>{unread?<button type="button" className={styles.markAllButton} onClick={()=>void markAllRead()}><CheckCheck aria-hidden="true"/>Tandai semua dibaca</button>:null}</div></div>
      {notificationLoading?<p className={styles.notificationState}><Loader2 className="spin" aria-hidden="true"/>Memuat notifikasi…</p>:notificationError?<div className={styles.notificationState} role="alert">{notificationError}<button type="button" onClick={()=>void loadNotifications()}>Coba lagi</button></div>:notifications.length?<div className={styles.notificationList}>{notifications.map(item=><button type="button" className={styles.notificationItem+' '+(!item.read_at?styles.notificationUnread:'')} key={item.id} onClick={()=>void markRead(item.id)} aria-label={item.title+(item.read_at?'':', belum dibaca')}><span className={styles.notificationIcon}><Bell aria-hidden="true"/></span><div>{!item.read_at?<span className={styles.unreadLabel}>Baru</span>:null}<strong>{item.title}</strong><span>{item.message}</span><small>{new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at))}</small></div></button>)}</div>:<p className={styles.notificationState}>Belum ada notifikasi.</p>}
    </section>:null}

    {openPanel==='account'?<section id="dashboard-account-popover" className={styles.popover} role="dialog" aria-label="Informasi akun">
      <div className={styles.accountSummary}><span className={styles.accountAvatar} aria-hidden="true">{initials}</span><div className={styles.accountIdentity}><strong>{name}</strong><span>{account.email||'Email akun tidak tersedia'}</span><span className={styles.roleBadge}>{roleLabels[role]}</span></div></div>
      <div className={styles.divider}/>
      <button type="button" className={styles.profileAction} onClick={()=>{setOpenPanel(null);onEditProfile()}}><PencilLine aria-hidden="true"/>Edit Profil</button>
      <div className={styles.divider}/><SignOut className={styles.accountSignOut} withIcon/>
    </section>:null}
  </div>
}
