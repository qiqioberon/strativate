'use client'

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Building2, GraduationCap, Trophy, UsersRound } from 'lucide-react'
import { Bar } from 'react-chartjs-2'

import type {
  CommunityStatItem,
  MenteeCommunityStats,
  SchoolCommunityStatItem,
} from '@/lib/mentee/community-stats-types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

type ChartRow = CommunityStatItem | SchoolCommunityStatItem
type ChartTone = 'school' | 'university' | 'category'

const tones: Record<ChartTone, { base: string; hover: string }> = {
  school: { base: 'rgba(255, 122, 0, 0.72)', hover: 'rgba(255, 122, 0, 0.92)' },
  university: { base: 'rgba(220, 13, 22, 0.66)', hover: 'rgba(220, 13, 22, 0.88)' },
  category: { base: 'rgba(39, 54, 74, 0.68)', hover: 'rgba(39, 54, 74, 0.9)' },
}

function rowLabel(row: ChartRow) {
  return 'type' in row ? `${row.type.toUpperCase()} · ${row.label}` : row.label
}

function compactLabel(value: string) {
  return value.length > 28 ? `${value.slice(0, 27)}…` : value
}

function CommunityBarChart({ rows, tone, emptyText }: { rows: ChartRow[]; tone: ChartTone; emptyText: string }) {
  if (rows.length === 0) return <div className="community-chart-empty">{emptyText}</div>

  const labels = rows.map(rowLabel)
  const height = Math.max(220, rows.length * 38 + 58)
  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 320 },
    interaction: { mode: 'nearest', axis: 'y', intersect: false },
    scales: {
      x: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: 'rgba(112, 91, 78, 0.10)' },
        ticks: { precision: 0, maxTicksLimit: 6, color: '#7a6f68', font: { size: 10 } },
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          autoSkip: false,
          color: '#3f3732',
          font: { size: 10, weight: 600 },
          callback: (_value, index) => compactLabel(labels[index] ?? ''),
        },
      },
    },
    plugins: {
      tooltip: {
        displayColors: false,
        padding: 10,
        callbacks: {
          title: items => labels[items[0]?.dataIndex ?? 0] ?? '',
          label: context => `${context.parsed.x ?? 0} mentee`,
        },
      },
    },
  }

  return <div className="community-chart-scroll"><div className="community-chart-canvas" style={{ height }}>
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Mentee',
          data: rows.map(row => row.count),
          backgroundColor: tones[tone].base,
          hoverBackgroundColor: tones[tone].hover,
          borderRadius: 7,
          borderSkipped: false,
          barThickness: 18,
        }],
      }}
      options={options}
    />
  </div></div>
}

function total(rows: ChartRow[]) {
  return rows.reduce((sum, row) => sum + row.count, 0)
}

export function MenteeCommunityStatsSection({ stats, available }: { stats: MenteeCommunityStats; available: boolean }) {
  return <section className="community-stats-section" aria-labelledby="community-stats-title">
    <div className="community-stats-heading">
      <div>
        <p className="kicker">Komunitas Strativate</p>
        <h2 id="community-stats-title">Lihat persebaran komunitas secara agregat.</h2>
        <p>Statistik hanya menampilkan jumlah mentee, tanpa nama, email, atau identitas peserta.</p>
      </div>
      <div className="community-stats-total"><UsersRound aria-hidden="true"/><span><strong>{stats.totalMentees}</strong><small>mentee selesai onboarding</small></span></div>
    </div>

    {!available ? <div className="community-stats-unavailable">
      <strong>Statistik komunitas belum tersedia.</strong>
      <span>Data personal dashboard tetap berjalan seperti biasa.</span>
    </div> : <div className="community-stats-grid">
      <article className="workspace-card community-chart-card">
        <div className="community-chart-card__heading"><span className="community-chart-icon"><GraduationCap aria-hidden="true"/></span><div><h3>Asal sekolah</h3><p>SMA dan SMK dipisahkan lewat label tipe sekolah.</p></div><strong>{total(stats.schools)}</strong></div>
        <CommunityBarChart rows={stats.schools} tone="school" emptyText="Belum ada data SMA atau SMK yang dapat ditampilkan."/>
      </article>

      <article className="workspace-card community-chart-card">
        <div className="community-chart-card__heading"><span className="community-chart-icon"><Building2 aria-hidden="true"/></span><div><h3>Asal universitas</h3><p>Dikelompokkan berdasarkan nama universitas.</p></div><strong>{total(stats.universities)}</strong></div>
        <CommunityBarChart rows={stats.universities} tone="university" emptyText="Belum ada data universitas yang dapat ditampilkan."/>
      </article>

      <article className="workspace-card community-chart-card">
        <div className="community-chart-card__heading"><span className="community-chart-icon"><Trophy aria-hidden="true"/></span><div><h3>Kategori lomba</h3><p>Berdasarkan minat kompetisi yang dipilih saat onboarding.</p></div><strong>{total(stats.categories)}</strong></div>
        <CommunityBarChart rows={stats.categories} tone="category" emptyText="Belum ada kategori lomba yang dapat ditampilkan."/>
      </article>
    </div>}

    {available ? <p className="community-stats-note">Satu mentee dapat muncul di lebih dari satu kategori lomba apabila memilih beberapa minat kompetisi.</p> : null}
  </section>
}
