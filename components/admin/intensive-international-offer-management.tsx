/* eslint-disable @typescript-eslint/no-explicit-any -- New Intensive custom-offer tables are intentionally accessed through the existing ungenerated Supabase boundary. */
'use client'

import {Check,Loader2,Pencil,Plus,Search,ShoppingCart,X} from 'lucide-react'
import {useCallback,useEffect,useRef,useState} from 'react'
import {adminFormError as formError} from '@/lib/auth/errors'
import dataStyles from './data-management.module.css'
import {formatRupiah} from '@/lib/commerce/money'
import {createClient} from '@/lib/supabase/client'

type Mentee={user_id:string;email:string;display_name:string|null}
type AddOn={id:string;name:string;code:string}
type Category={id:string;name:string}
type Offer={offer_id:string;intended_mentee_id:string;mentee_name:string|null;mentee_email:string;title:string;competition_category_id:string|null;competition_category_name:string|null;competition_name:string;baseline_sessions_per_month:number|null;final_price_amount:number;status:string;expires_at:string|null;created_at:string;updated_at:string;included_add_ons:AddOn[];benefits:string[]}
type RpcClient={rpc<T=unknown>(name:string,args?:Record<string,unknown>):Promise<{data:T|null;error:{message:string}|null}>}
type Mode='create'|'view'|'edit'
function offerStatusLabel(value:string){const labels:Record<string,string>={active:'Active',inactive:'Inactive',expired:'Expired',cancelled:'Cancelled',redeemed:'Redeemed',draft:'Draft'};return labels[value]??value.replaceAll('_',' ')}

export function IntensiveInternationalOfferManagement(){
 const[supabase]=useState(()=>createClient());const db=supabase as any;const rpc=supabase as unknown as RpcClient
 const[loading,setLoading]=useState(true)
 const[offers,setOffers]=useState<Offer[]>([]),[addOns,setAddOns]=useState<AddOn[]>([]),[categories,setCategories]=useState<Category[]>([])
 const[mode,setMode]=useState<Mode>('view'),[activeOffer,setActiveOffer]=useState<Offer|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[generatedUrl,setGeneratedUrl]=useState('')
 const[menteeQuery,setMenteeQuery]=useState(''),[mentees,setMentees]=useState<Mentee[]>([]),[menteeId,setMenteeId]=useState(''),[selectedMentee,setSelectedMentee]=useState<Mentee|null>(null),[menteeLoading,setMenteeLoading]=useState(false)
 const[competitionName,setCompetitionName]=useState(''),[categoryId,setCategoryId]=useState(''),[baseline,setBaseline]=useState(''),[price,setPrice]=useState(''),[expiresAt,setExpiresAt]=useState(''),[selectedAddOns,setSelectedAddOns]=useState<string[]>([]),[benefits,setBenefits]=useState<string[]>([''])
 const dialogRef=useRef<HTMLDialogElement>(null)
 const load=useCallback(async()=>{
  setLoading(true)
  setError('')
  try {
   const [offerResult,addOnResult,categoryResult]=await Promise.all([
    rpc.rpc<Offer[]>('list_admin_intensive_custom_offers'),
    db.from('intensive_mentoring_add_ons').select('id,name,code').eq('is_active',true).order('sort_order'),
    db.from('competition_categories').select('id,name').eq('is_active',true).order('sort_order'),
   ])
   if(offerResult.error)throw offerResult.error
   setOffers(offerResult.data??[])
   if(!addOnResult.error)setAddOns((addOnResult.data??[]) as AddOn[])
   if(!categoryResult.error)setCategories((categoryResult.data??[]) as Category[])
   if(addOnResult.error||categoryResult.error)setError(formError(addOnResult.error??categoryResult.error,'Offers loaded, but available support or categories could not be loaded. Refresh before editing.'))
  } catch(caught) {
   setError(formError(caught,'Unable to load international offers. Check your connection and try again.'))
  } finally {
   setLoading(false)
  }
 },[rpc,supabase])
 useEffect(()=>{void load()},[load])
 useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close()},[open])
 useEffect(()=>{
  if(!open||mode==='view')return
  let active=true
  const timer=setTimeout(async()=>{
   setMenteeLoading(true)
   try {
    const result=await rpc.rpc<Mentee[]>('list_cart_link_mentees',{p_query:menteeQuery.trim()})
    if(!active)return
    if(result.error)throw result.error
    setMentees(result.data??[])
   } catch(caught) {
    if(active){setMentees([]);setError(formError(caught,'Unable to search mentees. Try again.'))}
   } finally {
    if(active)setMenteeLoading(false)
   }
  },220)
  return()=>{active=false;clearTimeout(timer)}
 },[menteeQuery,mode,open,rpc])
 const initialDraftRef=useRef('')
 const persistedOfferIdRef=useRef<string|null>(null)
 const draftSnapshot=()=>JSON.stringify({menteeId,competitionName,categoryId,baseline,price,expiresAt,selectedAddOns,benefits})
 function draftChanged(){return draftSnapshot()!==initialDraftRef.current}
 useEffect(()=>{if(open)initialDraftRef.current=draftSnapshot()},[open,mode])
 function resetDraft(){persistedOfferIdRef.current=null;setMenteeLoading(false);setMenteeQuery('');setMentees([]);setMenteeId('');setSelectedMentee(null);setCompetitionName('');setCategoryId('');setBaseline('');setPrice('');setExpiresAt('');setSelectedAddOns([]);setBenefits(['']);setError('');setMessage('');setGeneratedUrl('')}
 function applyOffer(o:Offer){setMenteeId(o.intended_mentee_id);setSelectedMentee({user_id:o.intended_mentee_id,email:o.mentee_email,display_name:o.mentee_name});setMenteeQuery(o.mentee_name||o.mentee_email);setCompetitionName(o.competition_name);setCategoryId(o.competition_category_id??'');setBaseline(o.baseline_sessions_per_month?.toString()??'');setPrice(o.final_price_amount.toString());setExpiresAt(o.expires_at?new Date(o.expires_at).toISOString().slice(0,16):'');setSelectedAddOns(o.included_add_ons.map(x=>x.id));setBenefits(o.benefits.length?o.benefits:['']);setError('');setMessage('');setGeneratedUrl('')}
 function openCreate(){resetDraft();setActiveOffer(null);setMode('create');setOpen(true)}
 function openView(o:Offer){setActiveOffer(o);applyOffer(o);setMode('view');setOpen(true)}
 function close(){if(busy)return;if(mode!=='view'&&draftChanged()&&!window.confirm('Discard unsaved offer changes?'))return;setOpen(false);setActiveOffer(null);setMode('view');resetDraft()}
 function cancelEdit(){if(busy)return;if(draftChanged()&&!window.confirm('Discard unsaved offer changes?'))return;if(activeOffer){applyOffer(activeOffer);setMode('view')}else close()}
 function chooseMentee(m:Mentee){setSelectedMentee(m);setMenteeId(m.user_id);setMenteeQuery(m.display_name||m.email);setMentees([])}
 function toggleAddOn(id:string){setSelectedAddOns(xs=>xs.includes(id)?xs.filter(x=>x!==id):[...xs,id])}
 async function save(){
  if(busy)return
  const amount=Number(price),base=baseline?Number(baseline):null
  if(!menteeId||competitionName.trim().length<2){setError('Select a mentee and enter the competition name.');return}
  if(!Number.isSafeInteger(amount)||amount<=0){setError('The agreed price must be a positive whole Rupiah amount.');return}
  if(base!==null&&(!Number.isInteger(base)||base<1||base>100)){setError('Enter 1–100 baseline sessions per month, or leave it empty.');return}
  const expiration=expiresAt?new Date(expiresAt):null
  if(expiration&&!Number.isFinite(expiration.getTime())){setError('Enter a valid expiration date.');return}
  setBusy(true)
  setError('')
  let savedId:string|null=null
  try {
   const result=await rpc.rpc<string>('admin_save_intensive_custom_offer',{
    p_id:activeOffer?.offer_id??persistedOfferIdRef.current,p_mentee_id:menteeId,p_competition_category_id:categoryId||null,
    p_competition_name:competitionName.trim(),p_baseline_sessions_per_month:base,p_final_price_amount:amount,
    p_expires_at:expiration?expiration.toISOString():null,p_add_on_ids:selectedAddOns,
    p_benefits:benefits.map(x=>x.trim()).filter(Boolean),
   })
   if(result.error)throw result.error
   if(!result.data)throw new Error('Offer could not be saved.')
   savedId=result.data
   persistedOfferIdRef.current=savedId
   const list=await rpc.rpc<Offer[]>('list_admin_intensive_custom_offers')
   if(list.error)throw list.error
   const saved=(list.data??[]).find(x=>x.offer_id===savedId)
   if(!saved){setError('The offer was saved, but its details are unavailable. Close and refresh before making further changes.');return}
   setOffers(list.data??[])
   setActiveOffer(saved)
   applyOffer(saved)
   setMode('view')
   setMessage('International offer saved.')
  } catch(caught) {
   setError(formError(caught,savedId?'The offer was saved, but the refreshed details could not be loaded. Close and refresh before making further changes.':'Unable to save the offer. Check your connection and try again.'))
  } finally {
   setBusy(false)
  }
 }
 async function createCartLink(){if(busy||!activeOffer)return;setBusy(true);setError('');setGeneratedUrl('');try{const response=await fetch('/api/admin/cart-links',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({menteeId:activeOffer.intended_mentee_id,commerceItemIds:[activeOffer.offer_id]})});const body=await response.json() as{url?:string;error?:string};if(!response.ok||!body.url)throw new Error(formError({message:body.error},'Unable to create the cart link.'));setGeneratedUrl(body.url);setMessage('Cart link created for the international offer.')}catch(e){setError(formError(e,'Unable to create the cart link.'))}finally{setBusy(false)}}
 return <section className="role-card intensive-custom-offers"><div className="ops-section-heading intensive-custom-offers__heading"><div><h3>International Offers</h3></div><button type="button" className="button button-outline" onClick={openCreate} disabled={busy||loading}><Plus aria-hidden="true" size={15}/>Add offer</button></div>
  {!open&&error?<p className="form-error" role="alert">{error}</p>:null}
  {!open&&error?<button type="button" className="button button-outline button-compact" disabled={loading} onClick={()=>void load()}>Refresh</button>:null}
  <div className="ops-table-wrap"><table className="ops-table intensive-custom-offer-table"><thead><tr><th>Mentee</th><th>Competition</th><th>Baseline</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loading?<tr><td colSpan={6}>Loading international offers…</td></tr>:offers.length?offers.map(o=><tr key={o.offer_id}><td data-label="Mentee"><strong>{o.mentee_name||o.mentee_email}</strong><small>{o.mentee_email}</small></td><td data-label="Competition"><strong>{o.competition_name}</strong><small>{o.competition_category_name||'Flexible category'}</small></td><td data-label="Baseline">{o.baseline_sessions_per_month?o.baseline_sessions_per_month+' sessions/month':'Flexible'}</td><td data-label="Price"><strong>{formatRupiah(o.final_price_amount)}</strong></td><td data-label="Status"><span className="ops-status ops-status--info">{offerStatusLabel(o.status)}</span></td><td data-label="Actions"><button type="button" className="button button-outline button-compact" onClick={()=>openView(o)} disabled={busy}>View</button></td></tr>):<tr><td colSpan={6}>No international offers yet.</td></tr>}</tbody></table></div>
  <dialog ref={dialogRef} className="ops-dialog intensive-custom-offer-dialog" aria-labelledby="international-offer-title" onCancel={e=>{e.preventDefault();close()}} onClose={()=>setOpen(false)}>{open?<div className="ops-dialog__surface intensive-custom-offer-dialog__surface"><header className="ops-dialog__header"><div><h2 id="international-offer-title">{mode==='create'?'Create international offer':activeOffer?.competition_name||'International offer'}</h2><p>{mode==='view'?'Select Edit to change this offer.':'The agreed price is the final total. Included support is not added to it automatically.'}</p></div><button type="button" className="ops-icon-button" onClick={close} disabled={busy} aria-label="Close international offer"><X aria-hidden="true"/></button></header>
   {error?<p className="form-error" role="alert">{error}</p>:null}{message?<p className="form-success" role="status">{message}</p>:null}
   {mode==='view'&&activeOffer?<><div className="intensive-offer-read-grid"><div className="ops-readonly-field"><span>Mentee</span><strong>{activeOffer.mentee_name||activeOffer.mentee_email}</strong><small>{activeOffer.mentee_email}</small></div><div className="ops-readonly-field"><span>Competition name</span><strong>{activeOffer.competition_name}</strong><small>{activeOffer.competition_category_name||'Flexible category'}</small></div><div className="ops-readonly-field"><span>Baseline</span><strong>{activeOffer.baseline_sessions_per_month?activeOffer.baseline_sessions_per_month+' sessions/month':'Flexible'}</strong></div><div className="ops-readonly-field"><span>Agreed price</span><strong>{formatRupiah(activeOffer.final_price_amount)}</strong></div><div className="ops-readonly-field"><span>Status</span><strong>{offerStatusLabel(activeOffer.status)}</strong></div><div className="ops-readonly-field"><span>Valid until</span><strong>{activeOffer.expires_at?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(activeOffer.expires_at)):'No expiration'}</strong></div></div><section className="ops-dialog__section"><h3>Included support</h3><div className="intensive-config-chips">{activeOffer.included_add_ons.map(x=><span className="intensive-addon-chip" key={x.id}>{x.name}</span>)}</div>{activeOffer.benefits.length?<><h3>Additional benefits</h3><div className="intensive-config-chips">{activeOffer.benefits.map((x,i)=><span className="intensive-addon-chip" key={x+i}>{x}</span>)}</div></>:null}</section><div className="intensive-config-actions"><button type="button" className="button button-outline" disabled={busy||activeOffer.status!=='active'} onClick={()=>{applyOffer(activeOffer);setMode('edit')}}><Pencil aria-hidden="true" size={15}/>Edit</button><button type="button" className="button button-primary" disabled={busy||activeOffer.status!=='active'} onClick={()=>void createCartLink()}><ShoppingCart aria-hidden="true" size={15}/>{busy?'Creating…':'Create cart link'}</button></div>{generatedUrl?<div className="cart-link-result"><p>{generatedUrl}</p><button type="button" className="button button-outline" onClick={()=>void navigator.clipboard.writeText(generatedUrl).then(()=>setMessage('Cart link copied.')).catch(()=>setError('Unable to copy the cart link. Select and copy it manually.'))}>Copy Cart Link</button></div>:null}</>:<div className="intensive-offer-form"><fieldset className={dataStyles.editableFields} disabled={busy}>
    <label className="ops-field ops-field--wide"><span>Mentee</span><div className="ops-input-with-icon"><Search aria-hidden="true" size={15}/><input value={menteeQuery} onChange={e=>{setMenteeQuery(e.target.value);setMenteeId('');setSelectedMentee(null)}} placeholder="Search name or email"/>{menteeLoading?<Loader2 className="spin" aria-hidden="true" size={15}/>:null}</div>{selectedMentee?<small>Selected: {selectedMentee.display_name||selectedMentee.email} · {selectedMentee.email}</small>:null}{mentees.length?<div className="ops-combobox-options" role="listbox" aria-label="Mentee search results">{mentees.map(m=><button type="button" role="option" aria-selected={m.user_id===menteeId} onClick={()=>chooseMentee(m)} key={m.user_id}><strong>{m.display_name||'Strativate mentee'}</strong><span>{m.email}</span></button>)}</div>:null}</label>
    <div className="intensive-offer-form__grid"><label className="ops-field"><span>Competition name</span><input maxLength={300} value={competitionName} onChange={e=>setCompetitionName(e.target.value)} placeholder="Harvard Global Case Competition"/></label><label className="ops-field"><span>Category <small>optional</small></span><select value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">No category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="ops-field"><span>Baseline sessions <small>optional</small></span><input type="number" min={1} max={100} value={baseline} onChange={e=>setBaseline(e.target.value)}/><small>sessions / month</small></label><label className="ops-field"><span>Agreed price</span><input type="number" min={1} step={1} value={price} onChange={e=>setPrice(e.target.value)}/><small>Whole Rupiah amount. This is the final negotiated total.</small></label><label className="ops-field"><span>Valid until <small>optional</small></span><input type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></label></div>
    <fieldset className="intensive-offer-support"><legend>Included support</legend>{addOns.map(a=><label key={a.id} className="intensive-offer-support__item"><input type="checkbox" checked={selectedAddOns.includes(a.id)} onChange={()=>toggleAddOn(a.id)}/><span className="intensive-offer-support__check">{selectedAddOns.includes(a.id)?<Check aria-hidden="true" size={13}/>:null}</span><span>{a.name}</span></label>)}</fieldset>
    <section className="intensive-offer-benefits"><div className="intensive-config-card__heading"><div><span>Custom support</span><h3>Additional benefits</h3></div><button type="button" className="button button-outline button-compact" onClick={()=>setBenefits(xs=>[...xs,''])}><Plus aria-hidden="true" size={14}/>Add benefit</button></div>{benefits.map((b,i)=><div className="intensive-offer-benefit-row" key={i}><label className="ops-field"><span>Benefit {i+1}</span><input maxLength={500} value={b} onChange={e=>setBenefits(xs=>xs.map((x,n)=>n===i?e.target.value:x))} placeholder="International pitch deck review"/></label><button type="button" className="ops-icon-button" aria-label={'Remove benefit '+(i+1)} onClick={()=>setBenefits(xs=>xs.filter((_,n)=>n!==i))}><X aria-hidden="true" size={15}/></button></div>)}</section>
    <div className="intensive-config-actions"><button type="button" className="button button-primary" disabled={busy||!menteeId||!competitionName.trim()||!price} onClick={()=>void save()}>{busy?'Saving…':'Save offer'}</button><button type="button" className="button button-outline" disabled={busy} onClick={mode==='edit'?cancelEdit:close}>Cancel</button></div>
   </fieldset></div>}
  </div>:null}</dialog>
 </section>
}