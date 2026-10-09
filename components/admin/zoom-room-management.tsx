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
 if(Number(room.current_usage_count)>0)return`${room.current_usage_count} sessions in progress`
 if(room.next_usage_at)return`Next ${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(room.next_usage_at))}`
 return'No upcoming reservations'
}

export function ZoomRoomManagement(){
 const[rooms,setRooms]=useState<ZoomRoom[]>([]),[draft,setDraft]=useState<Draft>(EMPTY),[open,setOpen]=useState(false)
 const[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('')
 const dialogRef=useRef<HTMLDialogElement>(null)
 const initialDraftRef=useRef<Draft>(EMPTY)
 const load=useCallback(async()=>{
  setLoading(true)
  try{
   const response=await fetch('/api/admin/zoom-rooms',{cache:'no-store'})
   const body=await response.json() as{rooms?:ZoomRoom[];error?:string}
   if(!response.ok)throw new Error(body.error||'Unable to load Zoom rooms.')
   setRooms(body.rooms??[]);setError('')
  }catch(error){setError(error instanceof Error?error.message:'Unable to load Zoom rooms.')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load])
 useOperationalInvalidation(['provider','availability'],()=>void load())
 useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close()},[open])

 function add(){if(busy)return;const next={...EMPTY,sortOrder:rooms.length?Math.max(...rooms.map(room=>room.sort_order))+10:0};initialDraftRef.current=next;setDraft(next);setError('');setMessage('');setOpen(true)}
 function edit(room:ZoomRoom){if(busy)return;const next={id:room.id,name:room.name,meetingUrl:room.meeting_url,isActive:room.is_active,sortOrder:room.sort_order};initialDraftRef.current=next;setDraft(next);setError('');setMessage('');setOpen(true)}
 function closeEditor(){if(busy)return;if(JSON.stringify(draft)!==JSON.stringify(initialDraftRef.current)&&!window.confirm('Discard unsaved Zoom room changes?'))return;setOpen(false)}
 async function save(next:Draft=draft){
  if(busy)return
  setBusy(next.id||'new');setError('');setMessage('')
  try{
   const response=await fetch('/api/admin/zoom-rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(next)})
   const body=await response.json() as{error?:string;calendarFailures?:number;calendarWarning?:string|null}
   if(!response.ok)throw new Error(body.error||'Unable to save the Zoom room.')
   setOpen(false);await load();setMessage(body.calendarWarning||(body.calendarFailures?`Zoom room saved. ${body.calendarFailures} calendar events need to be synced again from session details.`:'Zoom room saved and ready for scheduling.'))
  }catch(error){setError(error instanceof Error?error.message:'Unable to save the Zoom room.')}
  finally{setBusy('')}
 }
 async function toggle(room:ZoomRoom){await save({id:room.id,name:room.name,meetingUrl:room.meeting_url,isActive:!room.is_active,sortOrder:room.sort_order})}
 async function remove(room:ZoomRoom){
  if(busy)return
  if(!window.confirm(`Delete ${room.name}? Rooms used by sessions cannot be deleted.`))return
  setBusy(room.id);setError('');setMessage('')
  try{
   const response=await fetch(`/api/admin/zoom-rooms/${room.id}`,{method:'DELETE'})
   const body=await response.json() as{error?:string}
   if(!response.ok)throw new Error(body.error||'Unable to delete the Zoom room.')
   await load();setMessage('Zoom room deleted.')
  }catch(error){setError(error instanceof Error?error.message:'Unable to delete the Zoom room.')}
  finally{setBusy('')}
 }
 async function copy(url:string){try{await navigator.clipboard.writeText(url);setMessage('Zoom link copied.')}catch{setError('Unable to copy the Zoom link.')}}

 return <div className="zoom-room-management">
  <div className="role-page-title zoom-room-title"><div><h2>Zoom</h2></div><button type="button" className="button button-primary" onClick={add}><Plus aria-hidden="true"/>Add Zoom Link</button></div>
  <section className="zoom-room-capacity role-card"><div className="zoom-room-capacity__icon"><Video aria-hidden="true"/></div><div className="zoom-room-capacity__copy"><span>Concurrent session capacity</span><strong>{rooms.filter(room=>room.is_active).length} active Zoom rooms</strong><p>Capacity follows the number of active rooms. Each room can host one session at a time.</p></div></section>
  {error?<p className="form-error" role="alert">{error}</p>:null}{message?<p className="form-success" role="status">{message}</p>:null}
  {loading?<section className="role-card"><p className="muted">Loading Zoom rooms…</p></section>:rooms.length?<div className="zoom-room-grid">{rooms.map(room=><article className="role-card zoom-room-card" key={room.id}>
   <div className="zoom-room-card__head"><div className="zoom-room-card__icon"><Video aria-hidden="true"/></div><div><h3>{room.name}</h3><span className={`ops-status ${room.is_active?'ops-status--success':'ops-status--neutral'}`}>{room.is_active?'Active':'Inactive'}</span></div></div>
   <a className="zoom-room-link" href={room.meeting_url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${room.name} link`}><span className="zoom-room-link__label">Zoom link</span><span className="zoom-room-link__value">{room.meeting_url}</span><ExternalLink aria-hidden="true"/></a>
   <div className="zoom-room-usage"><strong>{usageLabel(room)}</strong><span>{room.upcoming_usage_count} current / upcoming reservations</span></div>
   <div className="zoom-room-card__actions"><a className="button button-primary button-compact" href={room.meeting_url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true"/>Open</a><button className="button button-outline button-compact" type="button" onClick={()=>void copy(room.meeting_url)}><Clipboard aria-hidden="true"/>Copy</button><button className="button button-outline button-compact" type="button" onClick={()=>edit(room)}><Pencil aria-hidden="true"/>Edit</button><button className="button button-outline button-compact" type="button" disabled={Boolean(busy)} onClick={()=>void toggle(room)}><Power aria-hidden="true"/>{room.is_active?'Deactivate':'Activate'}</button><button className="button button-ghost button-compact zoom-room-delete" type="button" disabled={Boolean(busy)} onClick={()=>void remove(room)}><Trash2 aria-hidden="true"/>Delete</button></div>
  </article>)}</div>:<section className="role-card zoom-room-empty"><Video aria-hidden="true"/><div><h3>No Zoom rooms configured.</h3><p>Add a Strativate Zoom link to schedule Private and Intensive Mentoring sessions.</p><button type="button" className="button button-primary" onClick={add}><Plus aria-hidden="true"/>Add Zoom Link</button></div></section>}
  <dialog ref={dialogRef} className="ops-dialog zoom-room-dialog" onCancel={event=>{event.preventDefault();closeEditor()}} onClose={()=>setOpen(false)} aria-labelledby="zoom-room-dialog-title">{open?<div className="ops-dialog__surface"><header className="ops-dialog__header"><div><h2 id="zoom-room-dialog-title">{draft.id?'Edit Zoom Link':'Add Zoom Link'}</h2><p>Use a permanent Strativate HTTPS link. Duplicate URLs cannot be saved.</p></div><button type="button" className="ops-icon-button" onClick={closeEditor} disabled={Boolean(busy)} aria-label="Close"><X/></button></header><fieldset className="ops-dialog__body ops-form-stack" disabled={Boolean(busy)} style={{border:0,margin:0,minWidth:0}}><label className="ops-field"><span>Room name</span><input value={draft.name} maxLength={120} onChange={event=>setDraft(value=>({...value,name:event.target.value}))} placeholder="Zoom Room 1"/></label><label className="ops-field"><span>Zoom URL</span><input type="url" value={draft.meetingUrl} onChange={event=>setDraft(value=>({...value,meetingUrl:event.target.value}))} placeholder="https://zoom.us/j/…"/></label><label className="zoom-room-active-toggle"><input type="checkbox" checked={draft.isActive} onChange={event=>setDraft(value=>({...value,isActive:event.target.checked}))}/><span><strong>Active</strong><small>Active rooms increase scheduling capacity.</small></span></label>{error?<p className="form-error" role="alert">{error}</p>:null}</fieldset><footer className="ops-dialog__footer"><button type="button" className="button button-outline" onClick={closeEditor} disabled={Boolean(busy)}>Cancel</button><button type="button" className="button button-primary" disabled={Boolean(busy)||draft.name.trim().length<2||!/^https:\/\//i.test(draft.meetingUrl.trim())} onClick={()=>void save()}><Check aria-hidden="true"/>{busy?'Saving…':'Save Zoom room'}</button></footer></div>:null}</dialog>
 </div>
}
