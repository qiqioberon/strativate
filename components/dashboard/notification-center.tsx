'use client'

import { Bell, CheckCheck, Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/supabase/database.types'

const PAGE_SIZE = 20

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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    const result = await client
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, Math.max(0, limit - 1))

    if (result.error) {
      setError('Notifikasi belum dapat dimuat.')
      setLoading(false)
      return
    }

    const unique = new Map((result.data ?? []).map(item => [item.id, item]))
    setItems([...unique.values()])
    setTotal(result.count ?? unique.size)
    setLoading(false)
  }, [client, limit])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const channel = client
      .channel('notification-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => void load(true))
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [client, load])

  async function markRead(id: string) {
    setItems(current => current.map(item => item.id === id
      ? { ...item, read_at: item.read_at ?? new Date().toISOString() }
      : item))
    const result = await client.rpc('mark_notification_read', { p_notification_id: id })
    if (result.error) await load(true)
  }

  async function markAll() {
    const now = new Date().toISOString()
    setItems(current => current.map(item => ({ ...item, read_at: item.read_at ?? now })))
    const result = await client.rpc('mark_all_notifications_read')
    if (result.error) await load(true)
  }

  async function openRelated(item: Notification) {
    if (!onOpenRelated) return
    await markRead(item.id)
    onOpenRelated(item)
  }

  const unread = items.filter(item => !item.read_at).length

  if (loading) {
    return <section className="workspace-card calendar-loading"><Loader2 className="spin" aria-hidden="true"/>Memuat notifikasi…</section>
  }
  if (error) {
    return <section className="workspace-card notification-history-state"><p className="form-error" role="alert">{error}</p><button className="button button-outline" type="button" onClick={() => void load()}><RefreshCw aria-hidden="true"/>Coba lagi</button></section>
  }
  if (items.length === 0) {
    return <section className="workspace-card notification-history-state"><Bell aria-hidden="true"/><h3>Belum ada notifikasi.</h3><p className="muted">Pembaruan pembayaran, mentoring, jadwal, dan meeting akan muncul di sini.</p></section>
  }

  return <section className="notification-history" aria-label="Riwayat notifikasi">
    <div className="notification-history__toolbar">
      <div><strong>{total} notifikasi</strong><span>{unread} belum dibaca pada halaman ini</span></div>
      {unread
        ? <button className="button button-outline" type="button" onClick={() => void markAll()}><CheckCheck aria-hidden="true"/>Tandai semua dibaca</button>
        : <span className="muted">Semua yang tampil sudah dibaca.</span>}
    </div>
    <div className="notification-list">
      {items.map(item => <article className={'workspace-card notification-item ' + (!item.read_at ? 'is-unread' : '')} key={item.id}>
        <span className="notification-history__icon" aria-hidden="true"><Bell/></span>
        <div className="notification-history__body">
          <div className="notification-history__title-row">
            <h3>{item.title}</h3>
            <time dateTime={item.created_at}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</time>
          </div>
          <p>{item.message}</p>
          <div className="notification-history__actions">
            {!item.read_at
              ? <button className="text-link" type="button" onClick={() => void markRead(item.id)}>Tandai dibaca</button>
              : <span>Sudah dibaca</span>}
            {item.related_entity && onOpenRelated
              ? <button className="text-link" type="button" onClick={() => void openRelated(item)}>Buka terkait</button>
              : null}
            {item.related_entity ? <small>{item.related_entity.replaceAll('_', ' ')}</small> : null}
          </div>
        </div>
      </article>)}
    </div>
    {items.length < total
      ? <button className="button button-outline notification-history__more" type="button" onClick={() => setLimit(value => value + PAGE_SIZE)}>Muat lebih banyak</button>
      : null}
  </section>
}
