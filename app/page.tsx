'use client'

import { useState } from 'react'
import Link from 'next/link'
import { mentoringPrograms } from '@/lib/program-information'
import { ProgramComparison } from '@/components/programs/program-comparison'
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CirclePlay,
  Clock3,
  Globe2,
  Camera,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Mic2,
  Play,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Trophy,
  Users,
  X,
} from 'lucide-react'

const programs = [
  ...mentoringPrograms.map(program => ({
    title: program.title, tag: program.kicker, desc: program.description,
    price: program.priceLabel, priceContext: program.priceContext,
    icon: program.slug === 'private-mentoring' ? Users : Trophy,
    tone: program.slug === 'private-mentoring' ? 'orange' : 'red',
    bullets: program.highlights, href: `/program/${program.slug}`,
  })),
  { title: "Kelas Kompetisi", tag: "Belajar bersama", desc: "Belajar dan berlatih bersama peserta lain untuk memberikan yang terbaik di kompetisi berikutnya.", price: "Mulai Rp349.000", priceContext: '', icon: BookOpen, tone: 'yellow', bullets: ["Kelas langsung bersama ahli", "Saling memberi masukan", "Sertifikat penyelesaian"], href: '/explore' },
]

const mentors = [
  { name: 'Alvin Haryanto', role: "Strategi & Kasus", university: "UI · 12 kemenangan", initials: 'AH', color: 'coral', rating: "4,9" },
  { name: 'Nadia Prameswari', role: "Pemasaran & Presentasi", university: "UGM · 9 kemenangan", initials: 'NP', color: 'sun', rating: "5,0" },
  { name: 'Raka Adhitama', role: "Keuangan & Analisis", university: "ITB · 15 kemenangan", initials: 'RA', color: 'navy', rating: "4,8" },
]

const products = [
  { name: "Panduan Pemecahan Kasus", type: "Panduan digital", price: "Rp79.000", color: 'orange', mark: "KASUS" },
  { name: "Paket Awal Presentasi Bisnis", type: "Paket templat", price: "Rp59.000", color: 'red', mark: "PRESENTASI" },
  { name: "Buku Latihan Persiapan Kompetisi", type: "Buku latihan", price: "Rp89.000", color: 'yellow', mark: "LATIHAN" },
]

export default function Page() {
  const [view, setView] = useState('home')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [credits, setCredits] = useState(0)
  const [toast, setToast] = useState('')

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }
  function go(next: string) { setView(next); setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function signIn() { window.location.href = '/auth' }
  function buy(label: string) { setCredits((value) => value + 5); notify(`${label} ditambahkan. Kamu mendapat 5 kredit bimbingan.`) }

  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="brand" onClick={() => go('home')} aria-label="Ke beranda Strativate"><span className="brand-mark">S</span><span>strativate</span></button>
        <nav className={`main-nav ${mobileOpen ? 'is-open' : ''}`}>
          {['home', 'programs', 'mentors', 'products', 'about', 'faq'].map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => go(item)}>{({ home: 'Beranda', programs: 'Program', mentors: 'Mentor', products: 'Produk Digital', about: 'Tentang Kami', faq: 'Tanya Jawab' } as Record<string, string>)[item]}</button>)}
        </nav>
        <div className="header-actions">
          <button className="text-button desktop-only" onClick={signIn}>Masuk</button>
          <button className="button button-primary desktop-only" onClick={() => { window.location.href = '/explore' }}>Lihat pilihan program <ArrowRight size={16} /></button>
          <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Buka atau tutup menu">{mobileOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      {view === 'home' && <Home go={go} buy={buy} />}
      {view === 'programs' && <Programs />}
      {view === 'mentors' && <Mentors go={go} />}
      {view === 'products' && <Products buy={buy} />}
      {view === 'about' && <About go={go} />}
      {view === 'faq' && <Faq />}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
      <footer><div className="brand footer-brand"><span className="brand-mark">S</span><span>strativate</span></div><p>Raih kemenangan. Melangkah lebih jauh.</p><div className="footer-links"><button onClick={() => go('programs')}>Program</button><button onClick={() => go('mentors')}>Mentor</button><button onClick={() => go('faq')}>Tanya Jawab</button><Camera size={17} /></div></footer>
    </div>
  )
}

function Home({ go, buy }: { go: (v: string) => void; buy: (v: string) => void }) {
  return <main>
    <section className="hero"><div className="hero-copy"><div className="eyebrow"><Sparkles size={15} /> Persiapan yang membuatmu lebih siap</div><h1>Tampil lebih siap.<br /><em>Bawa ide terbaikmu.</em></h1><p className="hero-lede">Strativate membantu pelajar dan mahasiswa menyiapkan kompetisi lewat mentoring, latihan terarah, dan masukan praktis dari orang yang pernah mengalaminya.</p><div className="hero-actions"><button className="button button-primary" onClick={() => go('programs')}>Lihat pilihan program <ArrowRight size={17} /></button><button className="button button-ghost" onClick={() => go('mentors')}><CirclePlay size={17} /> Kenali para mentor</button></div><div className="hero-note"><span className="mini-stack"><i>AH</i><i>NP</i><i>RA</i></span><span><strong>2.500+</strong> peserta sudah belajar bersama mentor Strativate</span></div></div><div className="hero-art"><div className="art-note note-one">Finalis nasional <Trophy size={15} /></div><div className="art-card art-main"><div className="portrait portrait-orange"><span>AH</span></div><div><p className="small-label">Mentor pilihan</p><h3>Alvin Haryanto</h3><p>Strategi & pemecahan kasus</p></div><div className="rating"><Star size={14} fill="currentColor" /> 4,9</div></div><div className="art-card art-side"><Award size={23} /><strong>15+ kemenangan</strong><span>di 4 negara</span></div><div className="art-scribble">siapkan<br /><b>langkahmu</b></div></div></section>
    <section className="trust-bar"><div><strong>2.500+</strong><span>Peserta dibimbing</span></div><div><strong>14+</strong><span>Universitas mitra</span></div><div><strong>3</strong><span>Negara terwakili</span></div><div><strong>100%</strong><span>Mendukung ambisimu</span></div></section>
    <section className="section programs-preview"><div className="section-head"><div><p className="kicker">Pilih cara belajarmu</p><h2>Dukungan yang sesuai<br /><em>dengan targetmu.</em></h2></div><button className="arrow-link" onClick={() => go('programs')}>Bandingkan program <ArrowRight size={16} /></button></div><div className="program-grid">{programs.map((p) => <ProgramCard key={p.title} program={p} />)}</div></section>
    <section className="quote-section"><div className="quote-mark">“</div><blockquote>Ide yang baik perlu strategi, latihan, dan masukan yang tepat untuk siap dipresentasikan.</blockquote><p>— Belajar dari mentor yang pernah berdiri di posisi yang sama.</p><button className="button button-dark" onClick={() => buy("Panduan awal gratis")}>Dapatkan panduan awal gratis <ArrowRight size={16} /></button></section>
    <section className="section mentor-preview"><div className="section-head"><div><p className="kicker">Belajar dari pengalaman nyata</p><h2>Masukan dari orang<br /><em>yang pernah menjalaninya.</em></h2></div><button className="arrow-link" onClick={() => go('mentors')}>Lihat semua mentor <ArrowRight size={16} /></button></div><div className="mentor-grid">{mentors.map((m) => <MentorCard mentor={m} key={m.name} />)}</div></section>
  </main>
}

function ProgramCard({ program }: { program: typeof programs[number] }) {
  const Icon = program.icon
  return <article className={`program-card ${program.tone}`}><div className="card-top"><span className="icon-wrap"><Icon size={21} /></span><span className="tag">{program.tag}</span></div><h3>{program.title}</h3><p>{program.desc}</p><ul>{program.bullets.map(b => <li key={b}><Check size={14} />{b}</li>)}</ul><div className="card-bottom"><div><strong>{program.price}</strong><small className="program-preview-price-context">{program.priceContext}</small></div><Link href={program.href} className="round-arrow" aria-label={`Jelajahi ${program.title}`}><ArrowRight size={18} /></Link></div></article>
}

function MentorCard({ mentor }: { mentor: typeof mentors[number] }) { return <article className="mentor-card"><div className={`portrait portrait-${mentor.color}`}><span>{mentor.initials}</span></div><div className="mentor-info"><div className="rating"><Star size={13} fill="currentColor" /> {mentor.rating}</div><h3>{mentor.name}</h3><p>{mentor.role}</p><span>{mentor.university}</span></div></article> }

function Programs() {
  return <main className="page-main"><PageIntro kicker="Temukan dukungan yang tepat" title={<>Program untuk<br /><em>target kompetisimu.</em></>} text="Pilih sesi yang fleksibel atau pendampingan terstruktur sesuai tahap persiapan, kebutuhan, dan ritmemu." />
    <div className="program-list">{programs.map((p, index) => <div className={`program-wide ${p.tone}`} key={p.title}><div className="program-wide-icon"><p className="kicker">0{index + 1}</p><p>{p.tag}</p></div><div className="program-wide-body"><h2>{p.title}</h2><p>{p.desc}</p><div className="wide-bullets">{p.bullets.map(b => <span key={b}><Check size={14} />{b}</span>)}</div><div className="wide-actions"><div><strong>{p.price}</strong><small className="program-preview-price-context">{p.priceContext}</small></div><Link href={p.href} className="button button-dark" aria-label={`Lihat ${p.title}`}>Lihat program <ArrowRight size={16} /></Link></div></div></div>)}</div>
    <ProgramComparison />
  </main>
}

function PageIntro({ kicker, title, text }: { kicker: string; title: React.ReactNode; text: string }) { return <div className="page-intro"><p className="kicker">{kicker}</p><h1>{title}</h1><p>{text}</p></div> }

function Mentors({ go }: { go: (v: string) => void }) { return <main className="page-main"><PageIntro kicker="Tim mentor Strativate" title={<>Temukan <em>tim juaramu.</em></>} text="Setiap mentor membawa pengalaman kompetisi nyata, masukan jujur, dan panduan praktis." /><div className="filter-row"><div className="search-field"><Search size={17} /><input placeholder="Cari keahlian atau nama" /></div><button className="filter-pill">Semua keahlian <ChevronDown size={15} /></button><button className="filter-pill">Semua universitas <ChevronDown size={15} /></button></div><div className="mentor-directory">{mentors.concat([{ name: 'Dita Maharani', role: "Rencana Bisnis", university: "UNAIR · 8 kemenangan", initials: 'DM', color: 'coral', rating: "4,9" }]).map((m) => <div className="directory-card" key={m.name}><MentorCard mentor={m} /><p className="mentor-bio">Membantu menguraikan masalah bisnis yang rumit menjadi penjelasan yang jelas dan presentasi yang meyakinkan.</p><div className="mentor-card-actions"><button className="button button-outline" onClick={() => { window.location.href = '/auth' }}>Lihat profil</button><button className="button button-primary" onClick={() => { window.location.href = '/auth' }}>Jadwalkan sesi</button></div></div>)}</div></main> }
function Products({ buy }: { buy: (v: string) => void }) { return <main className="page-main"><PageIntro kicker="Bekal untuk unggul" title={<>Perlengkapan untuk <em>pejuang kompetisi.</em></>} text="Panduan dan templat yang bisa diunduh untuk mempertajam pemikiran dan memperkuat presentasimu." /><div className="product-grid">{products.map((product) => <article className={`product-card ${product.color}`} key={product.name}><div className="product-cover"><span>STRATIVATE</span><strong>{product.mark}</strong><i>edisi 01</i></div><p className="kicker">{product.type}</p><h2>{product.name}</h2><div className="product-foot"><strong>{product.price}</strong><button className="button button-dark" onClick={() => buy(product.name)}>Dapatkan <ShoppingBag size={15} /></button></div></article>)}</div></main> }
function About({ go }: { go: (v: string) => void }) { return <main className="page-main about-page"><PageIntro kicker="Mengapa Strativate hadir" title={<>Persiapan yang baik<br /><em>dimulai dari arah yang jelas.</em></>} text="Kami membantu pelajar dan mahasiswa memecah tantangan kompetisi menjadi langkah yang bisa dikerjakan." /><div className="about-grid"><div className="about-big"><span className="kicker">Cara kami membantu</span><h2>Ide yang kuat perlu <em>proses yang terarah.</em></h2></div><div className="about-copy"><p>Kompetisi menguji cara kamu merumuskan masalah, mengambil keputusan, dan menjelaskan ide dengan meyakinkan.</p><p>Strativate mempertemukanmu dengan mentor, kerangka berpikir, dan ruang latihan untuk memperbaiki pekerjaanmu dari satu tahap ke tahap berikutnya.</p><button className="button button-primary" onClick={() => go('mentors')}>Kenali para mentor <ArrowRight size={16} /></button></div></div><div className="values"><div><Globe2 /><strong>Sesuai kebutuhanmu</strong><p>Mulai dari tantangan yang sedang kamu hadapi.</p></div><div><Mic2 /><strong>Berbasis praktik</strong><p>Belajar dengan mengerjakan, bukan hanya membaca.</p></div><div><MessageCircle /><strong>Masukan yang jujur</strong><p>Tahu apa yang sudah kuat dan apa yang perlu diperbaiki.</p></div></div></main> }
function Faq() { return <main className="page-main faq-page"><PageIntro kicker="Yang perlu kamu tahu" title={<>Pertanyaanmu, <em>terjawab.</em></>} text="Informasi yang kamu butuhkan sebelum mengambil langkah berikutnya." /><div className="faq-list">{["Kompetisi apa saja yang didukung Strativate?", "Bagaimana cara memilih mentor yang tepat?", "Bisakah saya menjadwalkan sesi untuk seluruh tim?", "Di mana sesi berlangsung?", "Apa langkah selanjutnya setelah membeli program?"].map((q, i) => <details key={q} open={i === 0}><summary>{q}<ChevronDown size={18} /></summary><p>Mentor kami mendukung kompetisi kasus bisnis, rencana bisnis, pemasaran, keuangan, presentasi bisnis, dan kompetisi sejenis di tingkat universitas. Ceritakan kebutuhanmu agar kami dapat membantu memilih jalur yang sesuai.</p></details>)}</div></main> }

export function Dashboard({ role, credits = 0, go, notify, children }: { role: 'mentee' | 'mentor' | 'admin'; credits?: number; go: (v: string) => void; notify: (m: string) => void; children?: React.ReactNode }) { return <main className="dashboard-page"><aside className="dash-side"><div className="brand"><span className="brand-mark">S</span><span>strativate</span></div><p className="side-label">Ruang Belajar</p>{["Ringkasan", "Program Saya", "Mentor", "Materi"].map((item, i) => <button className={i === 0 ? 'side-active' : ''} key={item}><LayoutDashboard size={16} />{item}</button>)}<div className="side-bottom"><button><ChevronDown size={15} /> Pengaturan</button><div className="profile-mini"><span className="avatar">M</span><span><strong>Marsha K.</strong><small>Akun peserta</small></span></div></div></aside><div className="dash-content"><div className="dash-top"><div><p className="kicker">Senin, 17 Agustus 2026</p><h1>Selamat pagi, Marsha.</h1></div><button className="button button-outline" onClick={() => { window.location.href = '/' }}>Kembali ke situs</button></div>{children || (role === 'mentee' ? <MenteeContent credits={credits} go={go} notify={notify} /> : role === 'mentor' ? <MentorContent notify={notify} /> : <AdminContent />)}</div></main> }
function MenteeContent({ credits, go, notify }: { credits: number; go: (v: string) => void; notify: (m: string) => void }) { return <><div className="dash-banner"><div><p className="kicker">Kemenangan berikutnya dimulai di sini</p><h2>Terus jaga semangatmu.</h2><p>Satu sesi yang terarah dapat mengubah caramu melihat masalah.</p><button className="button button-dark" onClick={() => go('mentors')}>Jadwalkan bimbingan <ArrowRight size={16} /></button></div><div className="banner-shape"><Trophy size={42} /></div></div><div className="stat-row"><div><span>Kredit bimbingan</span><strong>{credits}</strong><small>+5 pada sesi ini</small></div><div><span>Program saat ini</span><strong>Dasar Pemecahan Kasus</strong><small>62% selesai</small></div><div><span>Sesi berikutnya</span><strong>Kam, 20 Agu</strong><small>bersama Alvin · 19:00</small></div></div><div className="dash-grid"><section className="dash-card"><div className="dash-card-head"><h3>Lanjutkan belajar</h3><button onClick={() => notify("Koleksi materi belajarmu sudah siap.")}>Lihat semua</button></div><div className="learning-item"><div className="lesson-icon"><Play size={16} fill="currentColor" /></div><div><strong>Cara memecahkan kasus bisnis</strong><p>Pelajaran 4 · tersisa 18 menit</p><div className="progress"><i style={{ width: '62%' }} /></div></div><span>62%</span></div><div className="learning-item"><div className="lesson-icon yellow"><BookOpen size={16} /></div><div><strong>Dasar Estimasi Ukuran Pasar</strong><p>Pelajaran 5 · 25 menit</p><div className="progress"><i style={{ width: '28%' }} /></div></div><span>28%</span></div></section><section className="dash-card upcoming"><div className="dash-card-head"><h3>Sesi mendatang</h3><CalendarDays size={18} /></div><div className="session-date"><strong>20</strong><span>Agu<br />2026</span></div><div><strong>Latihan kasus & masukan</strong><p><Clock3 size={14} /> 19:00 — 20:15 WIB</p></div><button className="button button-outline" onClick={() => notify("Tautan sesi disalin.")}>Salin tautan sesi</button></section></div></> }
function MentorContent({ notify }: { notify: (m: string) => void }) { return <><div className="dash-banner red-banner"><div><p className="kicker">Ruang Mentor</p><h2>Bantu peserta menemukan keunggulannya.</h2><p>Ada 3 sesi yang menanti bimbinganmu minggu ini.</p><button className="button button-dark" onClick={() => notify("Membuka kalender sesimu.")}>Buka kalender <CalendarDays size={16} /></button></div><div className="banner-shape"><Users size={42} /></div></div><div className="stat-row"><div><span>Bulan ini</span><strong>Rp3.200.000</strong><small>+18% dari bulan lalu</small></div><div><span>Peserta dibimbing</span><strong>24</strong><small>Rata-rata penilaian 4,9</small></div><div><span>Sesi berikutnya</span><strong>Hari ini, 19:00</strong><small>bersama Marsha K.</small></div></div><section className="dash-card table-card"><div className="dash-card-head"><h3>Peserta terbaru</h3><button onClick={() => notify("Daftar peserta dibuka.")}>Lihat semua</button></div>{["Marsha K. · Dasar Pemecahan Kasus", "Kevin T. · Ulasan Presentasi Bisnis", "Alya R. · Estimasi Ukuran Pasar"].map((s, i) => <div className="table-row" key={s}><span className="avatar small-avatar">{['M', 'K', 'A'][i]}</span><strong>{s}</strong><span className="badge">{i === 0 ? "Akan datang" : "Selesai"}</span><button onClick={() => notify("Pesan terkirim.")}>Pesan</button></div>)}</section></> }
function AdminContent() { return <><div className="admin-heading"><div><p className="kicker">Ringkasan Admin</p><h2>Sekilas tentang platform.</h2></div><span className="badge">Data simulasi</span></div><div className="stat-row"><div><span>Total peserta</span><strong>2.548</strong><small>+12,4% bulan ini</small></div><div><span>Mentor aktif</span><strong>86</strong><small>Dari 14 universitas</small></div><div><span>Nilai transaksi bulan ini</span><strong>Rp48.200.000</strong><small>+21,8% bulan ini</small></div></div><div className="dash-grid"><section className="dash-card"><div className="dash-card-head"><h3>Perkembangan pendaftaran</h3><span className="muted">30 hari terakhir</span></div><div className="chart"><i style={{ height: '42%' }} /><i style={{ height: '60%' }} /><i style={{ height: '48%' }} /><i style={{ height: '78%' }} /><i style={{ height: '65%' }} /><i style={{ height: '91%' }} /><i style={{ height: '74%' }} /><i style={{ height: '100%' }} /><i style={{ height: '86%' }} /></div></section><section className="dash-card"><div className="dash-card-head"><h3>Program terpopuler</h3></div>{programs.map((p, i) => <div className="rank-row" key={p.title}><span>0{i + 1}</span><strong>{p.title}</strong><b>{[842, 624, 410][i]}</b></div>)}</section></div></> }

