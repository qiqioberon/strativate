'use client'

import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { BarChart3, GraduationCap, RefreshCw, School, Trophy, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
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
const chartOptions:ChartOptions<'bar'>={indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,scales:{x:{beginAtZero:true,ticks:{precision:0},grid:{color:'rgba(75, 85, 95, .08)'}},y:{grid:{display:false},ticks:{autoSkip:false}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:context=>`${context.parsed.x??0} mentee`}}}}
const chartColors:Record<ChartAccent,string>={orange:'#d96b24',blue:'#4e7ca7',purple:'#735ea8',teal:'#3e887d',amber:'#b47a2a'}

function DistributionChart({title,description,rows,note,accent}:{title:string;description:string;rows:StatItem[];note?:string;accent:ChartAccent}){
 const height=Math.max(190,rows.length*34+42)
 return <article className={styles.chartCard} data-accent={accent}><header className={styles.chartHeading}><span className={styles.chartIcon}><BarChart3 aria-hidden="true"/></span><div><h4>{title}</h4><p>{description}</p></div><strong>{rows.length} kategori</strong></header>{rows.length?<div className={styles.chartScroll}><div className={styles.chartCanvas} style={{height}}><Bar options={chartOptions} data={{labels:rows.map(row=>row.label),datasets:[{label:'Mentee',data:rows.map(row=>row.count),backgroundColor:chartColors[accent],borderRadius:6,borderSkipped:false,maxBarThickness:22}]}}/></div></div>:<div className={styles.empty}>Belum ada data terisi untuk distribusi ini.</div>}{note?<p className={styles.note}>{note}</p>:null}</article>
}

export function AdminMenteeCommunityAnalytics(){
 const supabase=useMemo(()=>createClient(),[]),rpc=useMemo(()=>supabase as unknown as RpcClient,[supabase])
 const[stats,setStats]=useState<Stats|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const load=useCallback(async()=>{setLoading(true);setError('');const{data,error:loadError}=await rpc.rpc<unknown>('get_admin_mentee_community_stats');if(loadError){setStats(null);setError(loadError.message||'Analitik mentee belum dapat dimuat.')}else setStats(normalize(data));setLoading(false)},[rpc])
 useEffect(()=>{void load()},[load])
 return <section className={styles.section} aria-labelledby="admin-mentee-analytics-title"><header className={styles.heading}><div><p className="kicker">Analitik mentee</p><h3 id="admin-mentee-analytics-title">Distribusi komunitas Strativate</h3><p>Agregat memakai data profil/onboarding yang tersedia. Nilai kosong dikeluarkan hanya dari chart terkait, sehingga total tiap chart tidak harus sama dengan Total Mentee.</p></div><button type="button" className="button button-outline button-compact" onClick={()=>void load()} disabled={loading}><RefreshCw aria-hidden="true"/>{loading?'Memuat…':'Muat ulang'}</button></header>
 {loading&&!stats?<div className={styles.state}>Memuat analitik mentee…</div>:null}
 {!loading&&error?<div className={styles.error}><strong>Analitik belum tersedia.</strong><span>{error}</span><button type="button" className="button button-outline button-compact" onClick={()=>void load()}>Coba lagi</button></div>:null}
 {!loading&&!error&&stats?.totalMentees===0?<div className={styles.state}>Belum ada akun mentee untuk dianalisis.</div>:null}
 {stats&&stats.totalMentees>0?<div className={styles.content}><div className={styles.kpis}><article data-accent="orange"><UsersRound aria-hidden="true"/><span>Total Mentee</span><strong>{stats.totalMentees}</strong><small>Semua akun mentee</small></article><article data-accent="orange"><School aria-hidden="true"/><span>Sekolah unik</span><strong>{stats.uniqueSchools}</strong><small>SMA + SMK terisi</small></article><article data-accent="orange"><GraduationCap aria-hidden="true"/><span>Universitas unik</span><strong>{stats.uniqueUniversities}</strong><small>Universitas terisi</small></article><article data-accent="purple"><Trophy aria-hidden="true"/><span>Minat kompetisi</span><strong>{stats.uniqueInterests}</strong><small>Kategori minat terpilih</small></article></div><div className={styles.grid}>
 <DistributionChart title="Tipe institusi" description="SMA, SMK, dan universitas berdasarkan institusi yang terisi." rows={stats.institutionTypes} accent="orange"/>
 <DistributionChart title="Asal SMA" description="Semua nama SMA beserta jumlah mentee." rows={stats.sma} accent="orange"/>
 <DistributionChart title="Asal SMK" description="Semua nama SMK beserta jumlah mentee." rows={stats.smk} accent="orange"/>
 <DistributionChart title="Asal universitas" description="Semua universitas beserta jumlah mentee." rows={stats.universities} accent="orange"/>
 <DistributionChart title="Provinsi institusi" description="Distribusi provinsi dari institusi mentee yang terisi." rows={stats.provinces} accent="blue"/>
 <DistributionChart title="Kota institusi" description="Distribusi kota dari institusi mentee yang terisi." rows={stats.cities} accent="blue"/>
 <DistributionChart title="Minat kompetisi" description="Jumlah mentee unik untuk setiap minat kompetisi." rows={stats.interests} accent="purple" note="Seorang mentee dapat memilih lebih dari satu minat, sehingga jumlah antar-kategori dapat melebihi Total Mentee."/>
 <DistributionChart title="Sumber referral" description="Sumber referral master; jawaban bebas lainnya digabung sebagai Lainnya." rows={stats.referrals} accent="teal"/>
 <DistributionChart title="Angkatan" description="Distribusi cohort/entry year, diurutkan berdasarkan tahun." rows={stats.cohortYears} accent="amber"/>
 </div></div>:null}</section>
}
