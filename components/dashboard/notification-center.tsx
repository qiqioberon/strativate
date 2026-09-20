'use client'

import { Bell, CheckCheck, Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/supabase/database.types'
import { notificationCategoryTypes } from '@/lib/realtime/operational-invalidation'

const PAGE_SIZE = 20

type ReadFilter = 'all' | 'unread' | 'read'
type Category = 'all' | 'commerce' | 'mentoring' | 'meeting'

function categoryLabel(value:Category){
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
  if(item.type==='zoom_failed')return'Zoom meeting belum berhasil disinkronkan. Coba sinkronkan ulang beberapa saat lagi.'
  if(item.type==='calendar_failed')return'Google Calendar belum berhasil disinkronkan. Periksa koneksi kalender lalu coba lagi.'
  if(item.type==='recording_failed')return'Cloud recording Zoom tidak tersedia atau memerlukan perhatian. Periksa status Zoom sebelum sesi.'
  return item.message
}

export function DashboardNotificationCenter({
  onOpenRelated,
}: {
  onOpenRelated?: (item: Notification) => void
} = {}) {
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
    if(category!=='all')historyQuery=historyQuery.in('type',notificationCategoryTypes(category))

    const [result,unreadResult]=await Promise.all([
      historyQuery.range(0, Math.max(0, limit - 1)),
      client.from('notifications').select('id',{count:'exact',head:true}).is('read_at',null),
    ])

    if (result.error||unreadResult.error) {
      setError('Notifikasi belum dapat dimuat.')
      setLoading(false)
      return
    }

    const unique = new Map((result.data ?? []).map(item => [item.id, item]))
    setItems([...unique.values()])
    setTotal(result.count ?? unique.size)
    setUnreadTotal(unreadResult.count??0)
    setLoading(false)
  }, [category,client,limit,readFilter])

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
    return <section className="workspace-card calendar-loading"><Loader2 className="spin" aria-hidden="true"/>Memuat notifikasi…</section>
  }
  if (error) {
    return <section className="workspace-card notification-history-state"><p className="form-error" role="alert">{error}</p><button className="button button-outline" type="button" onClick={() => void load()}><RefreshCw aria-hidden="true"/>Coba lagi</button></section>
  }

  return <section className="notification-history" aria-label="Riwayat notifikasi">
    <div className="notification-history__filters">
      <label className="ops-field"><span>Status baca</span><select value={readFilter} onChange={event=>changeReadFilter(event.target.value as ReadFilter)}><option value="all">Semua</option><option value="unread">Belum dibaca</option><option value="read">Sudah dibaca</option></select></label>
      <label className="ops-field"><span>Kategori</span><select value={category} onChange={event=>changeCategory(event.target.value as Category)}>{(['all','commerce','mentoring','meeting'] as Category[]).map(value=><option value={value} key={value}>{categoryLabel(value)}</option>)}</select></label>
      <div className="notification-history__summary"><strong>{total} notifikasi</strong><span>{unreadTotal} belum dibaca keseluruhan</span></div>
      {unreadTotal?<button className="button button-outline" type="button" onClick={() => void markAll()}><CheckCheck aria-hidden="true"/>Tandai semua dibaca</button>:<span className="muted">Semua notifikasi sudah dibaca.</span>}
    </div>

    {items.length===0?<section className="workspace-card notification-history-state"><Bell aria-hidden="true"/><h3>Tidak ada notifikasi pada filter ini.</h3><p className="muted">Ubah status baca atau kategori untuk melihat riwayat lainnya.</p></section>:<div className="notification-list">
      {items.map(item => <article className={'workspace-card notification-item ' + (!item.read_at ? 'is-unread' : '')} key={item.id}>
        <span className="notification-history__icon" aria-hidden="true"><Bell/></span>
        <div className="notification-history__body">
          <div className="notification-history__title-row">
            <div><small className="notification-category">{typeLabel(item.type)}</small><h3>{item.title}</h3></div>
            <time dateTime={item.created_at}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</time>
          </div>
          <p>{safeMessage(item)}</p>
          <div className="notification-history__actions">
            {!item.read_at?<button className="text-link" type="button" onClick={() => void markRead(item.id)}>Tandai dibaca</button>:<span>Sudah dibaca</span>}
            {item.related_entity && onOpenRelated?<button className="text-link" type="button" onClick={() => void openRelated(item)}>Buka terkait</button>:null}
            {item.related_entity_id?<small>Ref. {item.related_entity_id.slice(0,8)}</small>:null}
          </div>
        </div>
      </article>)}
    </div>}

    {items.length < total?<button className="button button-outline notification-history__more" type="button" onClick={() => setLimit(value => value + PAGE_SIZE)}>Muat lebih banyak</button>:null}
  </section>
}
