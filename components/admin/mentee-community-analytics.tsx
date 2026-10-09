'use client'

import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { BarChart3, GraduationCap, RefreshCw, School, Trophy, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { adminFormError } from '@/lib/auth/errors'
import styles from './mentee-community-analytics.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)
ChartJS.defaults.font.family="'Poppins', sans-serif"

type StatItem={label:string;count:number}
type ChartAccent='orange'|'blue'|'purple'|'teal'|'amber'
type Stats={totalMentees:number;uniqueSchools:number;uniqueUniversities:number;uniqueInterests:number;institutionTypes:StatItem[];sma:StatItem[];smk:StatItem[];universities:StatItem[];provinces:StatItem[];cities:StatItem[];interests:StatItem[];referrals:StatItem[];cohortYears:StatItem[]}
type RpcClient={rpc<T>(name:string,args?:Record<string,unknown>):PromiseLike<{data:T|null;error:{message:string}|null}>}
const emptyStats:Stats={totalMentees:0,uniqueSchools:0,uniqueUniversities:0,uniqueInterests:0,institutionTypes:[],sma:[],smk:[],universities:[],provinces:[],cities:[],interests:[],referrals:[],cohortYears:[]}
const integer=(value:unknown)=>Number.isFinite(Number(value))?Math.max(0,Math.trunc(Number(value))):0
const items=(value:unknown):StatItem[]=>Array.isArray(value)?value.flatMap(item=>{if(!item||typeof item!=='object')return[];const row=item as Record<string,unknown>;const label=typeof row.label==='string'?row.label.trim():'';return label?[{label,count:integer(row.count)}]:[]}):[]
function normalize(value:unknown):Stats{if(!value||typeof value!=='object')return emptyStats;const row=value as Record<string,unknown>;return{totalMentees:integer(row.totalMentees),uniqueSchools:integer(row.uniqueSchools),uniqueUniversities:integer(row.uniqueUniversities),uniqueInterests:integer(row.uniqueInterests),institutionTypes:items(row.institutionTypes),sma:items(row.sma),smk:items(row.smk),universities:items(row.universities),provinces:items(row.provinces),cities:items(row.cities),interests:items(row.interests),referrals:items(row.referrals),cohortYears:items(row.cohortYears)}}
function wrapLabel(label:string){const lines:string[]=[];for(const word of label.split(/\s+/)){const last=lines.length-1;if(last>=0&&lines[last].length+word.length+1<=26)lines[last]+=' '+word;else lines.push(word)}return lines}
const chartOptions:ChartOptions<'bar'>={indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,scales:{x:{beginAtZero:true,ticks:{precision:0},grid:{color:'rgba(75, 85, 95, .08)'}},y:{grid:{display:false},ticks:{autoSkip:false,callback:function(value){return wrapLabel(this.getLabelForValue(Number(value)))}}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:context=>`${context.parsed.x??0} mentees`}}}}
const chartColors:Record<ChartAccent,string>={orange:'#d96b24',blue:'#4e7ca7',purple:'#735ea8',teal:'#3e887d',amber:'#b47a2a'}

function DistributionChart({title,description,rows,note,accent}:{title:string;description:string;rows:StatItem[];note?:string;accent:ChartAccent}){
 const height=Math.max(190,rows.length*Math.max(34,...rows.map(row=>wrapLabel(row.label).length*16+12))+42)
 return <article className={styles.chartCard} data-accent={accent}><header className={styles.chartHeading}><span className={styles.chartIcon}><BarChart3 aria-hidden="true"/></span><div><h4>{title}</h4><p>{description}</p></div><strong>{rows.length} categories</strong></header>{rows.length?<div className={styles.chartScroll}><div className={styles.chartCanvas} style={{height}}><Bar options={chartOptions} data={{labels:rows.map(row=>row.label),datasets:[{label:'Mentee',data:rows.map(row=>row.count),backgroundColor:chartColors[accent],borderRadius:6,borderSkipped:false,maxBarThickness:22}]}}/></div></div>:<div className={styles.empty}>No data available for this distribution.</div>}{note?<p className={styles.note}>{note}</p>:null}</article>
}

export function AdminMenteeCommunityAnalytics(){
 const supabase=useMemo(()=>createClient(),[]),rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
 const[stats,setStats]=useState<Stats|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const load=useCallback(async()=>{setLoading(true);setError('');try{const{data,error:loadError}=await rpc.rpc<unknown>('get_admin_mentee_community_stats');if(loadError)throw loadError;setStats(normalize(data))}catch(cause){setStats(null);setError(adminFormError(cause,'Unable to load mentee analytics.'))}finally{setLoading(false)}},[rpc])
 useEffect(()=>{void load()},[load])
 return <section className={styles.section} aria-labelledby="admin-mentee-analytics-title"><header className={styles.heading}><div><h3 id="admin-mentee-analytics-title">Community Analytics</h3><p>Charts use available profile data. Missing values are excluded from the relevant chart, so chart totals may differ from total mentees.</p></div><button type="button" className="button button-outline button-compact" onClick={()=>void load()} disabled={loading}><RefreshCw aria-hidden="true"/>{loading?'Loading…':'Refresh'}</button></header>
 {loading&&!stats?<div className={styles.state}>Loading mentee analytics…</div>:null}
 {!loading&&error?<div className={styles.error}><strong>Analytics unavailable.</strong><span>{error}</span><button type="button" className="button button-outline button-compact" onClick={()=>void load()}>Try again</button></div>:null}
 {!loading&&!error&&stats?.totalMentees===0?<div className={styles.state}>No mentee accounts to analyse yet.</div>:null}
 {stats&&stats.totalMentees>0?<div className={styles.content}><div className={styles.kpis}><article data-accent="orange"><UsersRound aria-hidden="true"/><span>Total mentees</span><strong>{stats.totalMentees}</strong><small>All mentee accounts</small></article><article data-accent="orange"><School aria-hidden="true"/><span>Unique schools</span><strong>{stats.uniqueSchools}</strong><small>Reported SMA and SMK schools</small></article><article data-accent="orange"><GraduationCap aria-hidden="true"/><span>Unique universities</span><strong>{stats.uniqueUniversities}</strong><small>Reported universities</small></article><article data-accent="purple"><Trophy aria-hidden="true"/><span>Competition interests</span><strong>{stats.uniqueInterests}</strong><small>Selected interest categories</small></article></div><div className={styles.grid}>
 <DistributionChart title="Institution types" description="Reported SMA, SMK, and university institutions." rows={stats.institutionTypes} accent="orange"/>
 <DistributionChart title="High school origins (SMA)" description="Mentees by high school." rows={stats.sma} accent="orange"/>
 <DistributionChart title="Vocational school origins (SMK)" description="Mentees by vocational school." rows={stats.smk} accent="orange"/>
 <DistributionChart title="University origins" description="Mentees by university." rows={stats.universities} accent="orange"/>
 <DistributionChart title="Provinces" description="Reported institution provinces." rows={stats.provinces} accent="blue"/>
 <DistributionChart title="Cities" description="Reported institution cities." rows={stats.cities} accent="blue"/>
 <DistributionChart title="Competition interests" description="Unique mentees per competition interest." rows={stats.interests} accent="purple" note="Mentees can select multiple interests, so category totals may exceed total mentees."/>
 <DistributionChart title="Referral sources" description="Free-text referral responses are grouped as Other." rows={stats.referrals} accent="teal"/>
 <DistributionChart title="Cohorts" description="Entry cohorts, ordered by year." rows={stats.cohortYears} accent="amber"/>
 </div></div>:null}</section>
}
