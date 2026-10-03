'use client'

import { Plus, X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'

export function MultiValueChipInput({value,onChange,label,placeholder='Ketik lalu tekan Enter atau koma',maxItems=20}:{value:string[];onChange:(value:string[])=>void;label:string;placeholder?:string;maxItems?:number}){
 const[input,setInput]=useState('');const id=useId()
 function commit(raw:string){const additions=raw.split(',').map(item=>item.trim()).filter(Boolean);if(!additions.length)return;const seen=new Set(value.map(item=>item.toLocaleLowerCase('id-ID')));const next=[...value];for(const item of additions){const key=item.toLocaleLowerCase('id-ID');if(!seen.has(key)&&next.length<maxItems){next.push(item);seen.add(key)}}onChange(next);setInput('')}
 function onKeyDown(event:KeyboardEvent<HTMLInputElement>){if(event.key==='Enter'||event.key===','){event.preventDefault();commit(input)}else if(event.key==='Backspace'&&!input&&value.length){onChange(value.slice(0,-1))}}
 return <div className="mentoring-chip-field"><label htmlFor={id}>{label}</label><div className="mentoring-chip-control" onClick={event=>(event.currentTarget.querySelector('input') as HTMLInputElement|null)?.focus()}>{value.map((item,index)=><span className="mentoring-chip" key={`${item}-${index}`}>{item}<button type="button" onClick={()=>onChange(value.filter((_,itemIndex)=>itemIndex!==index))} aria-label={`Hapus ${item}`}><X aria-hidden="true"/></button></span>)}<input id={id} value={input} onChange={event=>setInput(event.target.value)} onKeyDown={onKeyDown} onBlur={()=>commit(input)} placeholder={value.length?'Tambah nama lomba':placeholder} maxLength={300}/><button className="mentoring-chip-add" type="button" onClick={()=>commit(input)} disabled={!input.trim()||value.length>=maxItems} aria-label="Tambahkan nilai"><Plus aria-hidden="true"/></button></div><small>Enter atau koma akan membuat chip baru. Minimal satu nama lomba.</small></div>
}
