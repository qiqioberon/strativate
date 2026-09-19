'use client'
/* eslint-disable @next/next/no-img-element */
import {ImagePlus,Move,Save,UploadCloud,X} from 'lucide-react'
import {useEffect,useRef,useState,type DragEvent} from 'react'

const MAX_BYTES=8*1024*1024
const ALLOWED=new Set(['image/jpeg','image/png','image/webp'])
export function ProfileAvatarEditor({open,onClose,onSaved}:{open:boolean;onClose:()=>void;onSaved:(url:string)=>void}){
 const dialogRef=useRef<HTMLDialogElement>(null),inputRef=useRef<HTMLInputElement>(null)
 const[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[zoom,setZoom]=useState(1),[offsetX,setOffsetX]=useState(0),[offsetY,setOffsetY]=useState(0)
 const[dragging,setDragging]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close()},[open])
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
 function choose(next:File|null){
  setError('')
  if(!next)return
  if(!ALLOWED.has(next.type)){setError('Format foto harus JPG, PNG, atau WebP.');return}
  if(next.size<=0||next.size>MAX_BYTES){setError('Ukuran foto maksimal 8 MB.');return}
  if(preview)URL.revokeObjectURL(preview)
  setFile(next);setPreview(URL.createObjectURL(next));setZoom(1);setOffsetX(0);setOffsetY(0)
 }
 function drop(event:DragEvent<HTMLButtonElement>){event.preventDefault();setDragging(false);choose(event.dataTransfer.files[0]??null)}
 async function save(){
  if(!file)return
  setBusy(true);setError('')
  try{
   const form=new FormData();form.set('file',file);form.set('zoom',String(zoom));form.set('offsetX',String(offsetX));form.set('offsetY',String(offsetY))
   const response=await fetch('/api/profile/avatar',{method:'POST',body:form}),body=await response.json() as{avatarUrl?:string;error?:string}
   if(!response.ok||!body.avatarUrl)throw new Error(body.error||'Foto profil belum dapat disimpan.')
   onSaved(body.avatarUrl)
   setFile(null);setPreview('');onClose()
  }catch(value){setError(value instanceof Error?value.message:'Foto profil belum dapat disimpan.')}
  finally{setBusy(false)}
 }
 return <dialog ref={dialogRef} className="avatar-editor-dialog" aria-labelledby="avatar-editor-title" onCancel={event=>{event.preventDefault();if(!busy)onClose()}} onClose={onClose}>
  <div className="avatar-editor-card">
   <header><div><p className="kicker">Foto profil</p><h3 id="avatar-editor-title">Atur foto profil</h3><p>JPG, PNG, atau WebP · maksimal 8 MB. Hasil akhir disimpan 512×512.</p></div><button type="button" className="ops-icon-button" aria-label="Tutup editor foto" disabled={busy} onClick={onClose}><X/></button></header>
   {!preview?<button type="button" className={'avatar-dropzone '+(dragging?'is-dragging':'')} onClick={()=>inputRef.current?.click()} onDragEnter={event=>{event.preventDefault();setDragging(true)}} onDragOver={event=>event.preventDefault()} onDragLeave={()=>setDragging(false)} onDrop={drop}><UploadCloud/><strong>Klik atau tarik foto ke sini</strong><span>Gunakan foto wajah yang jelas agar mudah dikenali.</span></button>:<div className="avatar-crop-workspace">
    <div className="avatar-crop-frame"><img src={preview} alt="Pratinjau foto yang akan dipotong" style={{transform:`translate(${offsetX*18}%,${offsetY*18}%) scale(${zoom})`}}/></div>
    <div className="avatar-crop-controls"><label><span><ImagePlus/>Zoom</span><input aria-label="Zoom" type="range" min="1" max="3" step=".05" value={zoom} onChange={event=>setZoom(Number(event.target.value))}/></label><label><span><Move/>Horizontal</span><input aria-label="Posisi horizontal" type="range" min="-1" max="1" step=".05" value={offsetX} onChange={event=>setOffsetX(Number(event.target.value))}/></label><label><span><Move/>Vertikal</span><input aria-label="Posisi vertikal" type="range" min="-1" max="1" step=".05" value={offsetY} onChange={event=>setOffsetY(Number(event.target.value))}/></label></div>
   </div>}
   <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>choose(event.target.files?.[0]??null)}/>
   {error?<p className="form-error" role="alert">{error}</p>:null}
   <footer><button type="button" className="button button-outline" disabled={busy} onClick={()=>preview?inputRef.current?.click():onClose()}>{preview?'Ganti foto':'Batal'}</button><button type="button" className="button button-primary" disabled={!file||busy} onClick={()=>void save()}><Save/>{busy?'Menyimpan…':'Simpan foto'}</button></footer>
  </div>
 </dialog>
}
