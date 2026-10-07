'use client'

import { ArrowUpRight, Bell, Check, CheckCheck, Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/supabase/database.types'
import { notificationCategoryTypes } from '@/lib/realtime/operational-invalidation'
import { notificationCategoryLabels, notificationDate, presentNotification } from '@/lib/notifications/presentation'
import styles from './notification-history.module.css'

const PAGE_SIZE = 20

type ReadFilter = 'all' | 'unread' | 'read'
type Category = 'all' | 'commerce' | 'mentoring' | 'meeting' | 'account'

function categoryLabel(value:Category, english=false){
  if(english)return notificationCategoryLabels[value]
  if(value==='commerce')return'Pesanan & pembayaran'
  if(value==='mentoring')return'Mentoring'
  if(value==='meeting')return'Zoom & kalender'
  return'Semua kategori'
}

function typeLabel(type:string){
  if(notificationCategoryTypes('commerce').includes(type))return'Pesanan & pembayaran'
  if(notificationCategoryTypes('meeting').includes(type))return'Zoom & kalender'
  if(notificationCategoryTypes('mentoring').includes(type))return'Mentoring'
  return'Pembaruan akun'
}

function safeMessage(item:Notification){
  if(item.type==='zoom_failed')return'Notifikasi dari integrasi Zoom lama. Periksa link meeting sesi yang berlaku saat ini.'
  if(item.type==='calendar_failed')return'Google Calendar belum berhasil disinkronkan. Periksa koneksi kalender lalu coba lagi.'
  if(item.type==='recording_failed')return'Notifikasi recording dari integrasi Zoom lama. Pengelolaan recording kini berada di akun Zoom Strativate.'
  return item.message
}

export function DashboardNotificationCenter({
  onOpenRelated,
  language = 'id',
}: {
  onOpenRelated?: (item: Notification) => void
  language?: 'id' | 'en'
} = {}) {
  const english = language === 'en'
  const t = (en: string, id: string) => english ? en : id
  const client = useMemo(() => createClient(), [])
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [total, setTotal] = useState(0)
  const [unreadTotal,setUnreadTotal]=useState(0)
  const [readFilter,setReadFilter]=useState<ReadFilter>('all')
  const [category,setCategory]=useState<Category>('all')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    let historyQuery = client
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if(readFilter==='unread')historyQuery=historyQuery.is('read_at',null)
    if(readFilter==='read')historyQuery=historyQuery.not('read_at','is',null)
    if(category==='account')historyQuery=historyQuery.not('type','in',`(${(['commerce','mentoring','meeting'] as const).flatMap(notificationCategoryTypes).join(',')})`)
    else if(category!=='all')historyQuery=historyQuery.in('type',notificationCategoryTypes(category))

    const [result,unreadResult]=await Promise.all([
      historyQuery.range(0, Math.max(0, limit - 1)),
      client.from('notifications').select('id',{count:'exact',head:true}).is('read_at',null),
    ])

    if (result.error||unreadResult.error) {
      setError(english ? 'Notifications could not be loaded.' : 'Notifikasi belum dapat dimuat.')
      setLoading(false)
      return
    }

    const unique = new Map((result.data ?? []).map(item => [item.id, item]))
    setItems([...unique.values()])
    setTotal(result.count ?? unique.size)
    setUnreadTotal(unreadResult.count??0)
    setLoading(false)
  }, [category,client,english,limit,readFilter])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const refresh=()=>void load(true)
    window.addEventListener('strativate:notifications-changed',refresh)
    return () => {
      window.removeEventListener('strativate:notifications-changed',refresh)
    }
  }, [load])

  function changeReadFilter(next:ReadFilter){setReadFilter(next);setLimit(PAGE_SIZE)}
  function changeCategory(next:Category){setCategory(next);setLimit(PAGE_SIZE)}

  async function markRead(id: string) {
    const now=new Date().toISOString()
    setItems(current => current.map(item => item.id === id ? { ...item, read_at: item.read_at ?? now } : item))
    setUnreadTotal(current=>Math.max(0,current-1))
    const result = await client.rpc('mark_notification_read', { p_notification_id: id })
    if (result.error) await load(true)
    else {
      window.dispatchEvent(new CustomEvent('strativate:notifications-changed'))
      if(readFilter==='unread')await load(true)
    }
  }

  async function markAll() {
    const now = new Date().toISOString()
    setItems(current => current.map(item => ({ ...item, read_at: item.read_at ?? now })))
    setUnreadTotal(0)
    const result = await client.rpc('mark_all_notifications_read')
    if (result.error) await load(true)
    else {
      window.dispatchEvent(new CustomEvent('strativate:notifications-changed'))
      if(readFilter==='unread')await load(true)
    }
  }

  async function openRelated(item: Notification) {
    if (!onOpenRelated) return
    if(!item.read_at)await markRead(item.id)
    onOpenRelated(item)
  }

  if (loading) {
    return <section className="workspace-card calendar-loading" role="status"><Loader2 className="spin" aria-hidden="true"/>{t('Loading notifications…','Memuat notifikasi…')}</section>
  }
  if (error) {
    return <section className="workspace-card notification-history-state"><p className="form-error" role="alert">{error}</p><button className="button button-outline" type="button" onClick={() => void load()}><RefreshCw aria-hidden="true"/>{t('Try again','Coba lagi')}</button></section>
  }

  return <section className={`notification-history ${english ? styles.history : ''}`} aria-label={t('Notification history','Riwayat notifikasi')}>
    <div className="notification-history__filters">
      <label className="ops-field"><span>{t('Read status','Status baca')}</span><select value={readFilter} onChange={event=>changeReadFilter(event.target.value as ReadFilter)}><option value="all">{t('All','Semua')}</option><option value="unread">{t('Unread','Belum dibaca')}</option><option value="read">{t('Read','Sudah dibaca')}</option></select></label>
      <label className="ops-field"><span>{t('Category','Kategori')}</span><select value={category} onChange={event=>changeCategory(event.target.value as Category)}>{(['all','commerce','mentoring','meeting',...(english?['account']:[])] as Category[]).map(value=><option value={value} key={value}>{categoryLabel(value,english)}</option>)}</select></label>
      <div className="notification-history__summary" role="status"><strong>{total} {t(total === 1 ? 'notification' : 'notifications','notifikasi')}</strong><span>{english ? (unreadTotal ? `· ${unreadTotal} unread` : '· All read') : `${unreadTotal} belum dibaca keseluruhan`}</span></div>
      {unreadTotal?<button className="button button-outline" type="button" onClick={() => void markAll()}><CheckCheck aria-hidden="true"/>{t('Mark all as read','Tandai semua dibaca')}</button>:!english?<span className="muted">Semua notifikasi sudah dibaca.</span>:null}
    </div>

    {items.length===0?<section className="workspace-card notification-history-state"><Bell aria-hidden="true"/><h3>{t('No notifications match these filters.','Tidak ada notifikasi pada filter ini.')}</h3>{!english?<p className="muted">Ubah status baca atau kategori untuk melihat riwayat lainnya.</p>:null}</section>:<div className="notification-list">
      {items.map(item => { const content = english ? presentNotification(item) : { category: typeLabel(item.type), title: item.title, message: safeMessage(item) }; return <article className={'workspace-card notification-item ' + (!item.read_at ? 'is-unread' : '')} key={item.id}>
        <span className="notification-history__icon" aria-hidden="true"><Bell/></span>
        <div className="notification-history__body">
          <div className="notification-history__title-row">
            <div><small className="notification-category">{content.category}</small><h3>{content.title}</h3></div>
            <time dateTime={item.created_at}>{notificationDate(item.created_at,english?'en-GB':'id-ID')}</time>
          </div>
          <p>{content.message}</p>
          <div className="notification-history__actions">
            {!item.read_at?<button className={english?`button button-outline ${styles.itemAction}`:'text-link'} type="button" onClick={() => void markRead(item.id)}>{english?<Check aria-hidden="true"/>:null}{t('Mark as read','Tandai dibaca')}</button>:<span className={english?styles.readStatus:undefined}>{english?<Check aria-hidden="true"/>:null}{t('Read','Sudah dibaca')}</span>}
            {item.related_entity && onOpenRelated?<button className={english?`button button-outline ${styles.itemAction}`:'text-link'} type="button" onClick={() => void openRelated(item)}>{t('View related','Buka terkait')}{english?<ArrowUpRight aria-hidden="true"/>:null}</button>:null}
            {!english&&item.related_entity_id?<small>Ref. {item.related_entity_id.slice(0,8)}</small>:null}
          </div>
        </div>
      </article>})}
    </div>}

    {items.length < total?<button className="button button-outline notification-history__more" type="button" onClick={() => setLimit(value => value + PAGE_SIZE)}>{t('Load more','Muat lebih banyak')}</button>:null}
  </section>
}
