'use client'

import { Eye, MessageCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { publicContact } from '@/lib/content/brand'
import type { IntensiveMentoringEntitlementView } from '@/lib/private-mentoring/types'

function kindLabel(kind:IntensiveMentoringEntitlementView['entitlementKind']){
  if(kind==='package')return'Program / package'
  if(kind==='bundle')return'Bundle'
  return'Add-on'
}

export function IntensiveMentoringEntitlements({entitlements}:{entitlements:IntensiveMentoringEntitlementView[]}){
 const[selected,setSelected]=useState<IntensiveMentoringEntitlementView|null>(null)
 const dialogRef=useRef<HTMLDialogElement>(null)
 useEffect(()=>{const d=dialogRef.current;if(!d)return;if(selected&&!d.open)d.showModal();if(!selected&&d.open)d.close()},[selected])
 if(entitlements.length===0)return null
 const contact=publicContact.whatsapp+'?text='+encodeURIComponent('Halo admin Strativate, saya ingin menanyakan detail operasional Intensive Mentoring yang sudah saya beli.')
 return <section className="workspace-card mentoring-group">
  <div className="mentoring-group__header"><div><p className="kicker">Intensive Mentoring</p><h3>Entitlement Intensive Mentoring</h3><p>Purchase yang sudah paid ditampilkan sesuai domain Intensive. Detail sesi/jadwal tidak dibuat sebelum tersedia pada backend Intensive.</p></div><span className="ops-status ops-status--info">{entitlements.length} entitlement</span></div>
  <div className="mentoring-session-list">{entitlements.map(item=><article className="mentoring-session-card" key={item.entitlementId}><div className="mentoring-session-card__number"><span>{kindLabel(item.entitlementKind)}</span><strong>{item.purchasedSessions??'—'}</strong></div><div className="mentoring-session-card__body"><div className="mentoring-session-card__top"><div><h4>{item.name}</h4><small className="muted">{item.purchasedSessions?item.purchasedSessions+' sesi dibeli':'Tidak memakai jumlah sesi eksplisit'}</small></div><span className="ops-status ops-status--info">{item.status==='active'?'Aktif':'Selesai'}</span></div><p className="muted">Dibeli {new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date(item.createdAt))}</p><button className="button button-outline" type="button" onClick={()=>setSelected(item)}><Eye aria-hidden="true"/>Lihat detail</button></div></article>)}</div>
  <dialog ref={dialogRef} className="calendar-dialog" onCancel={event=>{event.preventDefault();setSelected(null)}} onClose={()=>setSelected(null)}>{selected?<><div className="calendar-dialog__head"><div><p className="kicker">Mentoring Saya</p><h3>{selected.name}</h3></div><button className="icon-button" type="button" onClick={()=>setSelected(null)} aria-label="Tutup detail"><X/></button></div><dl className="calendar-detail-list"><div><dt>Jenis mentoring</dt><dd>Intensive Mentoring</dd></div><div><dt>Tipe entitlement</dt><dd>{kindLabel(selected.entitlementKind)}</dd></div><div><dt>Jumlah sesi</dt><dd>{selected.purchasedSessions??'Tidak eksplisit pada item ini'}</dd></div><div><dt>Status</dt><dd>{selected.status==='active'?'Aktif':'Selesai'}</dd></div><div><dt>Tanggal tersedia</dt><dd>{new Intl.DateTimeFormat('id-ID',{dateStyle:'full'}).format(new Date(selected.createdAt))}</dd></div></dl><div className="calendar-dialog__actions"><a className="button button-outline" href={contact} target="_blank" rel="noopener noreferrer"><MessageCircle/>Hubungi Admin</a></div></>:null}</dialog>
 </section>
}
