'use client'

import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/supabase/database.types'

export function DashboardNotificationCenter() {
  const client=useMemo(()=>createClient(),[])
  const[items,setItems]=useState<Notification[]>([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')

  const load=useCallback(async()=>{
    setLoading(true);setError('')
    const result=await client.from('notifications').select('*').order('created_at',{ascending:false}).limit(100)
    if(result.error){setError('Notifikasi belum dapat dimuat.');setLoading(false);return}
    setItems(result.data??[]);setLoading(false)
  },[client])

  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    const channel=client.channel('notification-center')
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications'},()=>void load())
      .subscribe()
    return()=>{void client.removeChannel(channel)}
  },[client,load])

  async function markRead(id:string){await client.rpc('mark_notification_read',{p_notification_id:id});await load()}
  async function markAll(){await client.rpc('mark_all_notifications_read');await load()}
  const unread=items.filter(item=>!item.read_at).length

  if(loading)return <section className="workspace-card calendar-loading"><Loader2 className="spin" aria-hidden="true"/>Memuat notifikasi…</section>
  if(error)return <section className="workspace-card"><p className="form-error" role="alert">{error}</p><button className="button button-outline" type="button" onClick={()=>void load()}>Coba lagi</button></section>
  if(items.length===0)return <section className="workspace-card"><Bell aria-hidden="true"/><h3>Belum ada notifikasi.</h3><p className="muted">Pembaruan pembayaran, mentoring, jadwal, dan meeting akan muncul di sini.</p></section>

  return <div className="notification-list">
    <div className="button-row">{unread?<button className="button button-outline" type="button" onClick={()=>void markAll()}><CheckCheck aria-hidden="true"/>Tandai semua dibaca</button>:<span className="muted">Semua notifikasi sudah dibaca.</span>}</div>
    {items.map(item=><button type="button" className={'workspace-card notification-item '+(!item.read_at?'is-unread':'')} key={item.id} onClick={()=>void markRead(item.id)}>
      <Bell aria-hidden="true"/>
      <div><p className="kicker">{!item.read_at?'Baru':'Sudah dibaca'} · {new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at))}</p><h3>{item.title}</h3><p>{item.message}</p></div>
    </button>)}
  </div>
}
