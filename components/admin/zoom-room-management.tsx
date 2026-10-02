'use client'

import {Check,Clipboard,ExternalLink,Pencil,Plus,Power,Trash2,Video,X} from 'lucide-react'
import {useCallback,useEffect,useRef,useState} from 'react'

import {useOperationalInvalidation} from '@/components/realtime/operational-realtime-provider'

type ZoomRoom={
 id:string;name:string;meeting_url:string;is_active:boolean;sort_order:number;
 current_usage_count:number;upcoming_usage_count:number;next_usage_at:string|null;created_at:string;updated_at:string
}
type Draft={id:string|null;name:string;meetingUrl:string;isActive:boolean;sortOrder:number}
const EMPTY:Draft={id:null,name:'',meetingUrl:'',isActive:true,sortOrder:0}

function usageLabel(room:ZoomRoom){
 if(Number(room.current_usage_count)>0)return`${room.current_usage_count} sesi sedang berlangsung`
 if(room.next_usage_at)return`Berikutnya ${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(room.next_usage_at))}`
 return'Belum ada penggunaan mendatang'
}

export function ZoomRoomManagement(){
 const[rooms,setRooms]=useState<ZoomRoom[]>([]),[draft,setDraft]=useState<Draft>(EMPTY),[open,setOpen]=useState(false)
 const[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('')
 const dialogRef=useRef<HTMLDialogElement>(null)
 const load=useCallback(async()=>{
  setLoading(true)
  try{
   const response=await fetch('/api/admin/zoom-rooms',{cache:'no-store'})
   const body=await response.json() as{rooms?:ZoomRoom[];error?:string}
   if(!response.ok)throw new Error(body.error||'Zoom room belum dapat dimuat.')
   setRooms(body.rooms??[]);setError('')
  }catch(error){setError(error instanceof Error?error.message:'Zoom room belum dapat dimuat.')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load])
 useOperationalInvalidation(['provider','availability'],()=>void load())
 useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close()},[open])

 function add(){setDraft({...EMPTY,sortOrder:rooms.length?Math.max(...rooms.map(room=>room.sort_order))+10:0});setError('');setMessage('');setOpen(true)}
 function edit(room:ZoomRoom){setDraft({id:room.id,name:room.name,meetingUrl:room.meeting_url,isActive:room.is_active,sortOrder:room.sort_order});setError('');setMessage('');setOpen(true)}
 async function save(next:Draft=draft){
  setBusy(next.id||'new');setError('');setMessage('')
  try{
   const response=await fetch('/api/admin/zoom-rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(next)})
   const body=await response.json() as{error?:string;calendarFailures?:number;calendarWarning?:string|null}
   if(!response.ok)throw new Error(body.error||'Zoom room belum dapat disimpan.')
   setOpen(false);await load();setMessage(body.calendarWarning||(body.calendarFailures?`Zoom room tersimpan. ${body.calendarFailures} event Calendar perlu disinkronkan ulang dari detail sesi.`:'Zoom room tersimpan dan siap digunakan untuk penjadwalan.'))
  }catch(error){setError(error instanceof Error?error.message:'Zoom room belum dapat disimpan.')}
  finally{setBusy('')}
 }
 async function toggle(room:ZoomRoom){await save({id:room.id,name:room.name,meetingUrl:room.meeting_url,isActive:!room.is_active,sortOrder:room.sort_order})}
 async function remove(room:ZoomRoom){
  if(!window.confirm(`Hapus ${room.name}? Room yang pernah digunakan tidak dapat dihapus.`))return
  setBusy(room.id);setError('');setMessage('')
  try{
   const response=await fetch(`/api/admin/zoom-rooms/${room.id}`,{method:'DELETE'})
   const body=await response.json() as{error?:string}
   if(!response.ok)throw new Error(body.error||'Zoom room tidak dapat dihapus.')
   await load();setMessage('Zoom room dihapus.')
  }catch(error){setError(error instanceof Error?error.message:'Zoom room tidak dapat dihapus.')}
  finally{setBusy('')}
 }
 async function copy(url:string){try{await navigator.clipboard.writeText(url);setMessage('Link Zoom disalin.')}catch{setError('Link Zoom belum dapat disalin.')}}

 return <div className="zoom-room-management">
  <div className="role-page-title zoom-room-title"><div><p className="kicker">Operasional</p><h2>Zoom</h2><p>Kelola link Zoom tetap Strativate yang digunakan untuk sesi mentoring.</p></div><button type="button" className="button button-primary" onClick={add}><Plus aria-hidden="true"/>Add Zoom Link</button></div>
  <section className="zoom-room-capacity role-card"><div><Video aria-hidden="true"/><div><span>Kapasitas sesi bersamaan</span><strong>{rooms.filter(room=>room.is_active).length} Zoom room aktif</strong><p>Kapasitas otomatis mengikuti jumlah room aktif. Satu room hanya dapat dipakai satu sesi pada interval yang sama.</p></div></div></section>
  {error?<p className="form-error" role="alert">{error}</p>:null}{message?<p className="form-success" role="status">{message}</p>:null}
  {loading?<section className="role-card"><p className="muted">Memuat Zoom room…</p></section>:rooms.length?<div className="zoom-room-grid">{rooms.map(room=><article className="role-card zoom-room-card" key={room.id}>
   <div className="zoom-room-card__head"><div className="zoom-room-card__icon"><Video aria-hidden="true"/></div><div><h3>{room.name}</h3><span className={`ops-status ${room.is_active?'ops-status--success':'ops-status--neutral'}`}>{room.is_active?'Active':'Inactive'}</span></div></div>
   <a className="zoom-room-url" href={room.meeting_url} target="_blank" rel="noopener noreferrer">{room.meeting_url}</a>
   <div className="zoom-room-usage"><strong>{usageLabel(room)}</strong><span>{room.upcoming_usage_count} reservasi aktif/mendatang</span></div>
   <div className="zoom-room-card__actions"><a className="button button-primary button-compact" href={room.meeting_url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true"/>Open</a><button className="button button-outline button-compact" type="button" onClick={()=>void copy(room.meeting_url)}><Clipboard aria-hidden="true"/>Copy</button><button className="button button-outline button-compact" type="button" onClick={()=>edit(room)}><Pencil aria-hidden="true"/>Edit</button><button className="button button-outline button-compact" type="button" disabled={busy===room.id} onClick={()=>void toggle(room)}><Power aria-hidden="true"/>{room.is_active?'Deactivate':'Activate'}</button><button className="button button-ghost button-compact zoom-room-delete" type="button" disabled={busy===room.id} onClick={()=>void remove(room)}><Trash2 aria-hidden="true"/>Delete</button></div>
  </article>)}</div>:<section className="role-card zoom-room-empty"><Video aria-hidden="true"/><div><h3>Belum ada Zoom room terkelola.</h3><p>Tambahkan link Zoom tetap Strativate agar sesi Private dan Intensive Mentoring dapat dijadwalkan.</p><button type="button" className="button button-primary" onClick={add}><Plus aria-hidden="true"/>Add Zoom Link</button></div></section>}
  <dialog ref={dialogRef} className="ops-dialog zoom-room-dialog" onCancel={event=>{event.preventDefault();setOpen(false)}} onClose={()=>setOpen(false)} aria-labelledby="zoom-room-dialog-title">{open?<div className="ops-dialog__surface"><header className="ops-dialog__header"><div><p className="kicker">Zoom room</p><h2 id="zoom-room-dialog-title">{draft.id?'Edit Zoom Link':'Add Zoom Link'}</h2><p>Gunakan link HTTPS tetap milik Strativate. URL duplikat tidak dapat disimpan.</p></div><button type="button" className="ops-icon-button" onClick={()=>setOpen(false)} aria-label="Tutup"><X/></button></header><div className="ops-dialog__body ops-form-stack"><label className="ops-field"><span>Room name</span><input value={draft.name} maxLength={120} onChange={event=>setDraft(value=>({...value,name:event.target.value}))} placeholder="Zoom Room 1"/></label><label className="ops-field"><span>Zoom URL</span><input type="url" value={draft.meetingUrl} onChange={event=>setDraft(value=>({...value,meetingUrl:event.target.value}))} placeholder="https://zoom.us/j/…"/></label><label className="zoom-room-active-toggle"><input type="checkbox" checked={draft.isActive} onChange={event=>setDraft(value=>({...value,isActive:event.target.checked}))}/><span><strong>Active</strong><small>Room aktif langsung menambah kapasitas jadwal.</small></span></label>{error?<p className="form-error" role="alert">{error}</p>:null}</div><footer className="ops-dialog__footer"><button type="button" className="button button-outline" onClick={()=>setOpen(false)}>Batal</button><button type="button" className="button button-primary" disabled={Boolean(busy)||draft.name.trim().length<2||!/^https:\/\//i.test(draft.meetingUrl.trim())} onClick={()=>void save()}><Check aria-hidden="true"/>{busy?'Menyimpan…':'Simpan Zoom room'}</button></footer></div>:null}</dialog>
 </div>
}
