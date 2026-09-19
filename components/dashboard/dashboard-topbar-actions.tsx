'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckCheck, ChevronDown, Loader2, PencilLine } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAccount } from '@/components/auth/account-provider'
import { ProfileAvatar } from '@/components/auth/profile-avatar'
import { SignOut } from '@/components/auth/sign-out'
import { displayName } from '@/lib/auth/rules'
import { createClient } from '@/lib/supabase/client'
import type { AppRole, Notification } from '@/lib/supabase/database.types'
import styles from './dashboard-shared.module.css'
import './dashboard-layout-overrides.module.css'

type Panel = 'notification' | 'account' | null
const roleLabels: Record<AppRole, string> = { admin:'Admin',mentor:'Mentor',mentee:'User' }

export function DashboardTopbarActions({
  role,
  onEditProfile,
  onOpenNotification,
}: {
  role: AppRole
  onEditProfile: () => void
  onOpenNotification?: (item: Notification) => void
}) {
  const account=useAccount()
  const router=useRouter()
  const client=useMemo(()=>createClient(),[])
  const [openPanel,setOpenPanel]=useState<Panel>(null)
  const [notifications,setNotifications]=useState<Notification[]>([])
  const [notificationLoading,setNotificationLoading]=useState(true)
  const [notificationError,setNotificationError]=useState('')
  const [unreadCount,setUnreadCount]=useState(0)
  const rootRef=useRef<HTMLDivElement>(null)
  const name=displayName(account)

  const loadNotifications=useCallback(async()=>{
    setNotificationLoading(true);setNotificationError('')
    const [recent,countResult]=await Promise.all([
      client.from('notifications').select('*').is('read_at',null).order('created_at',{ascending:false}).limit(30),
      client.from('notifications').select('id',{count:'exact',head:true}).is('read_at',null),
    ])
    if(recent.error||countResult.error){
      setNotificationError('Notifikasi belum dapat dimuat.')
      setNotificationLoading(false)
      return
    }
    const unreadOnly=(recent.data??[]).filter(item=>!item.read_at)
    setNotifications(unreadOnly)
    setUnreadCount(countResult.count??unreadOnly.length)
    setNotificationLoading(false)
  },[client])

  useEffect(()=>{void loadNotifications()},[loadNotifications])
  useEffect(()=>{
    const refresh=()=>void loadNotifications()
    window.addEventListener('strativate:notifications-changed',refresh)
    return()=>window.removeEventListener('strativate:notifications-changed',refresh)
  },[loadNotifications])
  useEffect(()=>{
    const channel=client.channel('dashboard-notifications-'+account.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications'},payload=>{
        void loadNotifications()
        const row=(payload.new??{}) as Partial<Notification>
        if(row.type==='meeting_url_changed'||row.type==='session_scheduled'||row.type==='session_cancelled'||row.type==='mentor_assigned'){
          window.dispatchEvent(new CustomEvent('strativate:operational-refresh'))
          router.refresh()
        }
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

  async function markRead(id:string){
    const result=await client.rpc('mark_notification_read',{p_notification_id:id})
    if(!result.error){
      setNotifications(current=>current.filter(item=>item.id!==id))
      setUnreadCount(current=>Math.max(0,current-1))
      window.dispatchEvent(new CustomEvent('strativate:notifications-changed'))
    }else await loadNotifications()
  }

  async function openNotification(item:Notification){
    await markRead(item.id)
    setOpenPanel(null)
    onOpenNotification?.(item)
  }

  async function markAllRead(){
    const result=await client.rpc('mark_all_notifications_read')
    if(!result.error){
      setNotifications([])
      setUnreadCount(0)
      window.dispatchEvent(new CustomEvent('strativate:notifications-changed'))
    }else await loadNotifications()
  }

  return <div className={styles.topbarActions} ref={rootRef}>
    <button type="button" className={styles.iconButton} aria-label="Buka notifikasi" aria-haspopup="dialog" aria-expanded={openPanel==='notification'} aria-controls="dashboard-notification-popover" onClick={()=>toggle('notification')}>
      <Bell aria-hidden="true"/>
      {unreadCount?<span className={styles.notificationCount} aria-hidden="true">{unreadCount>99?'99+':unreadCount}</span>:null}
    </button>

    <button type="button" className={styles.accountButton} aria-label="Buka menu akun" aria-haspopup="dialog" aria-expanded={openPanel==='account'} aria-controls="dashboard-account-popover" onClick={()=>toggle('account')}>
      <ProfileAvatar account={account} className={styles.triggerAvatar}/><span className={styles.accountName}>{name}</span><ChevronDown className={styles.chevron} aria-hidden="true"/>
    </button>

    {openPanel==='notification'?<section id="dashboard-notification-popover" className={styles.popover} role="dialog" aria-label="Notifikasi">
      <div className={styles.popoverHeader}><div className={styles.notificationHeaderRow}><div><strong>Notifikasi baru</strong><span>{unreadCount?unreadCount+' belum dibaca':'Semua sudah dibaca'}</span></div>{unreadCount?<button type="button" className={styles.markAllButton} onClick={()=>void markAllRead()}><CheckCheck aria-hidden="true"/>Tandai semua dibaca</button>:null}</div></div>
      {notificationLoading?<p className={styles.notificationState}><Loader2 className="spin" aria-hidden="true"/>Memuat notifikasi…</p>:notificationError?<div className={styles.notificationState} role="alert">{notificationError}<button type="button" onClick={()=>void loadNotifications()}>Coba lagi</button></div>:notifications.length?<div className={styles.notificationList}>{notifications.map(item=><button type="button" className={styles.notificationItem+' '+styles.notificationUnread} key={item.id} onClick={()=>void openNotification(item)} aria-label={item.title+', belum dibaca'}><span className={styles.notificationIcon}><Bell aria-hidden="true"/></span><div><span className={styles.unreadLabel}>Baru</span><strong>{item.title}</strong><span>{item.message}</span><small>{new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at))}</small></div></button>)}</div>:<div className={styles.notificationState}><Bell aria-hidden="true"/><span>Tidak ada notifikasi baru. Riwayat tetap tersedia di halaman Notifikasi.</span></div>}
    </section>:null}

    {openPanel==='account'?<section id="dashboard-account-popover" className={styles.popover} role="dialog" aria-label="Informasi akun">
      <div className={styles.accountSummary}><ProfileAvatar account={account} className={styles.accountAvatar}/><div className={styles.accountIdentity}><strong>{name}</strong><span>{account.email||'Email akun tidak tersedia'}</span><span className={styles.roleBadge}>{roleLabels[role]}</span></div></div>
      <div className={styles.divider}/>
      <button type="button" className={styles.profileAction} onClick={()=>{setOpenPanel(null);onEditProfile()}}><PencilLine aria-hidden="true"/>Edit Profil</button>
      <div className={styles.divider}/><SignOut className={styles.accountSignOut} withIcon/>
    </section>:null}
  </div>
}
