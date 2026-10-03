'use client'

import { Pencil, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MultiValueChipInput } from '@/components/mentoring/multi-value-chip-input'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { createClient } from '@/lib/supabase/client'

type CompetitionContext={parentId:string;competitionNames:string[];competitionCategoryId:string|null}
type Category={id:string;name:string}
type RpcClient={rpc:<T>(name:string,args:Record<string,unknown>)=>PromiseLike<{data:T|null;error:{message:string}|null}>}

export function MentoringCompetitionEditor({kind,parentId,readOnly=false,compact=false}:{kind:'private'|'intensive';parentId:string;readOnly?:boolean;compact?:boolean}){
 const supabase=useMemo(()=>createClient(),[]);const rpc=supabase as unknown as RpcClient
 const[data,setData]=useState<CompetitionContext|null>(null);const[names,setNames]=useState<string[]>([]);const[categoryId,setCategoryId]=useState('');const[categories,setCategories]=useState<Category[]>([]);const[editing,setEditing]=useState(false);const[busy,setBusy]=useState(false);const[message,setMessage]=useState('')
 const load=useCallback(async()=>{const[result,catalog]=await Promise.all([rpc.rpc<CompetitionContext>('get_mentoring_competition_names',{p_kind:kind,p_parent_id:parentId}),supabase.from('competition_categories').select('id,name').eq('is_active',true).order('sort_order')]);if(!result.error&&result.data){setData(result.data);setNames(result.data.competitionNames??[]);setCategoryId(result.data.competitionCategoryId??'')}if(!catalog.error)setCategories((catalog.data??[]) as Category[])},[kind,parentId,rpc,supabase])
 useEffect(()=>{void load()},[load]);useOperationalInvalidation(['mentoring','admin-overview'],()=>{void load()})
 async function save(){if(!names.length){setMessage('Tambahkan minimal satu nama lomba.');return}setBusy(true);setMessage('');const result=await rpc.rpc<CompetitionContext>('set_mentoring_competition_names',{p_kind:kind,p_parent_id:parentId,p_competition_names:names,p_competition_category_id:categoryId||null});setBusy(false);if(result.error||!result.data){setMessage(result.error?.message||'Nama lomba belum dapat disimpan.');return}setData(result.data);setNames(result.data.competitionNames);setEditing(false);setMessage('Nama lomba tersimpan.')}
 const values=data?.competitionNames??[]
 if(!editing)return <section className={`mentoring-preference-card${compact?' is-compact':''}`}><div className="mentoring-preference-card__head"><div><span>Nama lomba</span><div className="mentoring-chip-list">{values.length?values.map(item=><span className="mentoring-chip" key={item}>{item}</span>):<strong>Lengkapi nama lomba</strong>}</div></div>{!readOnly?<button className="button button-outline button-compact" type="button" onClick={()=>setEditing(true)}><Pencil aria-hidden="true"/>{values.length?'Edit':'Lengkapi nama lomba'}</button>:null}</div>{message?<small role="status">{message}</small>:null}</section>
 return <section className="mentoring-preference-card is-editing"><MultiValueChipInput label="Nama lomba" value={names} onChange={setNames}/><label className="ops-field"><span>Kategori kompetisi (opsional)</span><select value={categoryId} onChange={event=>setCategoryId(event.target.value)}><option value="">Tanpa kategori</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="button-row"><button className="button button-primary" type="button" disabled={busy||!names.length} onClick={()=>void save()}><Save aria-hidden="true"/>{busy?'Menyimpan…':'Simpan nama lomba'}</button><button className="button button-outline" type="button" disabled={busy} onClick={()=>{setNames(values);setCategoryId(data?.competitionCategoryId??'');setEditing(false)}}>Batal</button></div>{message?<small className="form-error" role="alert">{message}</small>:null}</section>
}
