'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckCheck, ChevronDown, Loader2, PencilLine } from 'lucide-react'
import { useAccount } from '@/components/auth/account-provider'
import { ProfileAvatar } from '@/components/auth/profile-avatar'
import { SignOut } from '@/components/auth/sign-out'
import { displayName } from '@/lib/auth/rules'
import { createClient } from '@/lib/supabase/client'
import type { AppRole, Notification } from '@/lib/supabase/database.types'
import { notificationDate, presentNotification } from '@/lib/notifications/presentation'
import styles from './dashboard-shared.module.css'
import './dashboard-layout-overrides.module.css'

type Panel = 'notification' | 'account' | null
const roleLabels: Record<AppRole, string> = { admin:'Admin',mentor:'Mentor',mentee:'Mentee' }

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
  const client=useMemo(()=>createClient(),[])
  const [openPanel,setOpenPanel]=useState<Panel>(null)
  const [notifications,setNotifications]=useState<Notification[]>([])
  const [notificationLoading,setNotificationLoading]=useState(true)
  const [notificationError,setNotificationError]=useState('')
  const [unreadCount,setUnreadCount]=useState(0)
  const rootRef=useRef<HTMLDivElement>(null)
  const name=displayName(account,'en')

  const loadNotifications=useCallback(async()=>{
    setNotificationLoading(true);setNotificationError('')
    const [recent,countResult]=await Promise.all([
      client.from('notifications').select('*').is('read_at',null).order('created_at',{ascending:false}).limit(30),
      client.from('notifications').select('id',{count:'exact',head:true}).is('read_at',null),
    ])
    if(recent.error||countResult.error){
      setNotificationError('Notifications could not be loaded.')
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
    <button type="button" className={styles.iconButton} aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-haspopup="dialog" aria-expanded={openPanel==='notification'} aria-controls="dashboard-notification-popover" onClick={()=>toggle('notification')}>
      <Bell aria-hidden="true"/>
      {unreadCount?<span className={styles.notificationCount} aria-hidden="true">{unreadCount>99?'99+':unreadCount}</span>:null}
    </button>

    <button type="button" className={styles.accountButton} aria-label="Open account menu" aria-haspopup="dialog" aria-expanded={openPanel==='account'} aria-controls="dashboard-account-popover" onClick={()=>toggle('account')}>
      <ProfileAvatar account={account} className={styles.triggerAvatar}/><span className={styles.accountName}>{name}</span><ChevronDown className={styles.chevron} aria-hidden="true"/>
    </button>

    {openPanel==='notification'?<section id="dashboard-notification-popover" className={`${styles.popover}${role === 'admin' ? ` ${styles.adminNotifications}` : ''}`} role="dialog" aria-label="Notifications">
      <div className={styles.popoverHeader}><div className={styles.notificationHeaderRow}><div><strong>New notifications</strong><span>{unreadCount?unreadCount+' unread':"You're all caught up"}</span></div>{unreadCount?<button type="button" className={styles.markAllButton} onClick={()=>void markAllRead()}><CheckCheck aria-hidden="true"/>Mark all as read</button>:null}</div></div>
      {notificationLoading?<p className={styles.notificationState}><Loader2 className="spin" aria-hidden="true"/>Loading notifications…</p>:notificationError?<div className={styles.notificationState} role="alert">{notificationError}<button type="button" onClick={()=>void loadNotifications()}>Try again</button></div>:notifications.length?<div className={styles.notificationList}>{notifications.map(item=>{const content=presentNotification(item);return <button type="button" className={styles.notificationItem+' '+styles.notificationUnread} key={item.id} onClick={()=>void openNotification(item)} aria-label={content.title+', unread'}><span className={styles.notificationIcon}><Bell aria-hidden="true"/></span><div><span className={styles.unreadLabel}>{role === 'admin' ? content.category + ' · New' : 'New'}</span><strong>{content.title}</strong><span>{content.message}</span><small>{notificationDate(item.created_at)}</small></div></button>})}</div>:<div className={styles.notificationState}><Bell aria-hidden="true"/><span>No new notifications. Your notification history is still available.</span></div>}
    </section>:null}

    {openPanel==='account'?<section id="dashboard-account-popover" className={styles.popover} role="dialog" aria-label="Account information">
      <div className={styles.accountSummary}><ProfileAvatar account={account} className={styles.accountAvatar}/><div className={styles.accountIdentity}><strong>{name}</strong><span>{account.email||'Account email unavailable'}</span><span className={styles.roleBadge}>{roleLabels[role]}</span></div></div>
      <div className={styles.divider}/>
      <button type="button" className={styles.profileAction} onClick={()=>{setOpenPanel(null);onEditProfile()}}><PencilLine aria-hidden="true"/>Edit profile</button>
      <div className={styles.divider}/><SignOut className={styles.accountSignOut} withIcon language="en"/>
    </section>:null}
  </div>
}
