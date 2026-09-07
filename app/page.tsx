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
  { title: 'Competition Class', tag: 'Learn together', desc: 'Learn with a cohort, practice together, and make your next competition your best one.', price: 'From Rp 349K', priceContext: '', icon: BookOpen, tone: 'yellow', bullets: ['Live expert classes', 'Peer feedback circles', 'Certificate of completion'], href: '/explore' },
]

const mentors = [
  { name: 'Alvin Haryanto', role: 'Strategy & Case', university: 'UI · 12 wins', initials: 'AH', color: 'coral', rating: '4.9' },
  { name: 'Nadia Prameswari', role: 'Marketing & Pitching', university: 'UGM · 9 wins', initials: 'NP', color: 'sun', rating: '5.0' },
  { name: 'Raka Adhitama', role: 'Finance & Analysis', university: 'ITB · 15 wins', initials: 'RA', color: 'navy', rating: '4.8' },
]

const products = [
  { name: 'The Case Cracking Playbook', type: 'Digital guide', price: 'Rp 79K', color: 'orange', mark: 'CASE' },
  { name: 'Pitch Deck Starter Kit', type: 'Template pack', price: 'Rp 59K', color: 'red', mark: 'PITCH' },
  { name: 'Competition Prep Workbook', type: 'Workbook', price: 'Rp 89K', color: 'yellow', mark: 'PREP' },
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
  function buy(label: string) { setCredits((value) => value + 5); notify(`${label} added. You earned 5 mentoring credits.`) }

  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="brand" onClick={() => go('home')} aria-label="Go to Strativate home"><span className="brand-mark">S</span><span>strativate</span></button>
        <nav className={`main-nav ${mobileOpen ? 'is-open' : ''}`}>
          {['home', 'programs', 'mentors', 'products', 'about', 'faq'].map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => go(item)}>{item === 'home' ? 'Home' : item === 'products' ? 'Digital Products' : item[0].toUpperCase() + item.slice(1)}</button>)}
        </nav>
        <div className="header-actions">
          <button className="text-button desktop-only" onClick={signIn}>Sign in</button>
          <button className="button button-primary desktop-only" onClick={() => { window.location.href = '/explore' }}>Start learning <ArrowRight size={16} /></button>
          <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">{mobileOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      {view === 'home' && <Home go={go} buy={buy} />}
      {view === 'programs' && <Programs />}
      {view === 'mentors' && <Mentors go={go} />}
      {view === 'products' && <Products buy={buy} />}
      {view === 'about' && <About go={go} />}
      {view === 'faq' && <Faq />}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
      <footer><div className="brand footer-brand"><span className="brand-mark">S</span><span>strativate</span></div><p>Win early. Get ahead.</p><div className="footer-links"><button onClick={() => go('programs')}>Programs</button><button onClick={() => go('mentors')}>Mentors</button><button onClick={() => go('faq')}>FAQ</button><Camera size={17} /></div></footer>
    </div>
  )
}

function Home({ go, buy }: { go: (v: string) => void; buy: (v: string) => void }) {
  return <main>
    <section className="hero"><div className="hero-copy"><div className="eyebrow"><Sparkles size={15} /> The competition advantage</div><h1>Win early.<br /><em>Get ahead.</em></h1><p className="hero-lede">Personalized mentoring and competition preparation from experienced winners, consultants, and young professionals.</p><div className="hero-actions"><button className="button button-primary" onClick={() => go('programs')}>Find your program <ArrowRight size={17} /></button><button className="button button-ghost" onClick={() => go('mentors')}><CirclePlay size={17} /> Meet our mentors</button></div><div className="hero-note"><span className="mini-stack"><i>AH</i><i>NP</i><i>RA</i></span><span><strong>2,500+</strong> students already building their edge</span></div></div><div className="hero-art"><div className="art-note note-one">National finalist <Trophy size={15} /></div><div className="art-card art-main"><div className="portrait portrait-orange"><span>AH</span></div><div><p className="small-label">Mentor spotlight</p><h3>Alvin Haryanto</h3><p>Strategy & case cracking</p></div><div className="rating"><Star size={14} fill="currentColor" /> 4.9</div></div><div className="art-card art-side"><Award size={23} /><strong>15+ wins</strong><span>across 4 countries</span></div><div className="art-scribble">your<br /><b>edge</b></div></div></section>
    <section className="trust-bar"><div><strong>2,500+</strong><span>Students empowered</span></div><div><strong>14+</strong><span>Partner universities</span></div><div><strong>3</strong><span>Countries represented</span></div><div><strong>100%</strong><span>Built for ambition</span></div></section>
    <section className="section programs-preview"><div className="section-head"><div><p className="kicker">Choose your advantage</p><h2>One goal. <em>Your way.</em></h2></div><button className="arrow-link" onClick={() => go('programs')}>View all programs <ArrowRight size={16} /></button></div><div className="program-grid">{programs.map((p) => <ProgramCard key={p.title} program={p} />)}</div></section>
    <section className="quote-section"><div className="quote-mark">“</div><blockquote>Strativate is where preparation stops being a guessing game.</blockquote><p>— Built by competition winners, for the next generation of winners.</p><button className="button button-dark" onClick={() => buy('Free starter guide')}>Get the free starter guide <ArrowRight size={16} /></button></section>
    <section className="section mentor-preview"><div className="section-head"><div><p className="kicker">The people behind the edge</p><h2>Learn from people<br /><em>who have done it.</em></h2></div><button className="arrow-link" onClick={() => go('mentors')}>Meet all mentors <ArrowRight size={16} /></button></div><div className="mentor-grid">{mentors.map((m) => <MentorCard mentor={m} key={m.name} />)}</div></section>
  </main>
}

function ProgramCard({ program }: { program: typeof programs[number] }) {
  const Icon = program.icon
  return <article className={`program-card ${program.tone}`}><div className="card-top"><span className="icon-wrap"><Icon size={21} /></span><span className="tag">{program.tag}</span></div><h3>{program.title}</h3><p>{program.desc}</p><ul>{program.bullets.map(b => <li key={b}><Check size={14} />{b}</li>)}</ul><div className="card-bottom"><div><strong>{program.price}</strong><small className="program-preview-price-context">{program.priceContext}</small></div><Link href={program.href} className="round-arrow" aria-label={`Explore ${program.title}`}><ArrowRight size={18} /></Link></div></article>
}

function MentorCard({ mentor }: { mentor: typeof mentors[number] }) { return <article className="mentor-card"><div className={`portrait portrait-${mentor.color}`}><span>{mentor.initials}</span></div><div className="mentor-info"><div className="rating"><Star size={13} fill="currentColor" /> {mentor.rating}</div><h3>{mentor.name}</h3><p>{mentor.role}</p><span>{mentor.university}</span></div></article> }

function Programs() {
  return <main className="page-main"><PageIntro kicker="Find your path" title={<>Programs built for<br /><em>your next win.</em></>} text="Compare flexible sessions and structured mentoring to find the support that fits your preparation." />
    <div className="program-list">{programs.map((p, index) => <div className={`program-wide ${p.tone}`} key={p.title}><div className="program-wide-icon"><p className="kicker">0{index + 1}</p><p>{p.tag}</p></div><div className="program-wide-body"><h2>{p.title}</h2><p>{p.desc}</p><div className="wide-bullets">{p.bullets.map(b => <span key={b}><Check size={14} />{b}</span>)}</div><div className="wide-actions"><div><strong>{p.price}</strong><small className="program-preview-price-context">{p.priceContext}</small></div><Link href={p.href} className="button button-dark" aria-label={`View ${p.title}`}>View program <ArrowRight size={16} /></Link></div></div></div>)}</div>
    <ProgramComparison />
  </main>
}

function PageIntro({ kicker, title, text }: { kicker: string; title: React.ReactNode; text: string }) { return <div className="page-intro"><p className="kicker">{kicker}</p><h1>{title}</h1><p>{text}</p></div> }

function Mentors({ go }: { go: (v: string) => void }) { return <main className="page-main"><PageIntro kicker="The Strativate roster" title={<>Find your <em>winning team.</em></>} text="Every mentor brings real competition experience, honest feedback, and a practical playbook." /><div className="filter-row"><div className="search-field"><Search size={17} /><input placeholder="Search by skill or name" /></div><button className="filter-pill">All expertise <ChevronDown size={15} /></button><button className="filter-pill">All universities <ChevronDown size={15} /></button></div><div className="mentor-directory">{mentors.concat([{ name: 'Dita Maharani', role: 'Business Plan', university: 'UNAIR · 8 wins', initials: 'DM', color: 'coral', rating: '4.9' }]).map((m) => <div className="directory-card" key={m.name}><MentorCard mentor={m} /><p className="mentor-bio">Turns complex business problems into clear stories and confident pitches.</p><div className="mentor-card-actions"><button className="button button-outline" onClick={() => { window.location.href = '/auth' }}>View profile</button><button className="button button-primary" onClick={() => { window.location.href = '/auth' }}>Book session</button></div></div>)}</div></main> }
function Products({ buy }: { buy: (v: string) => void }) { return <main className="page-main"><PageIntro kicker="Your unfair advantage" title={<>Tools for the <em>serious competitor.</em></>} text="Downloadable playbooks and templates designed to help you think sharper and present stronger." /><div className="product-grid">{products.map((product) => <article className={`product-card ${product.color}`} key={product.name}><div className="product-cover"><span>STRATIVATE</span><strong>{product.mark}</strong><i>edition 01</i></div><p className="kicker">{product.type}</p><h2>{product.name}</h2><div className="product-foot"><strong>{product.price}</strong><button className="button button-dark" onClick={() => buy(product.name)}>Get it <ShoppingBag size={15} /></button></div></article>)}</div></main> }
function About({ go }: { go: (v: string) => void }) { return <main className="page-main about-page"><PageIntro kicker="Why Strativate exists" title={<>The edge is not<br /><em>born. It is built.</em></>} text="We help ambitious students turn uncertainty into a repeatable way of winning." /><div className="about-grid"><div className="about-big"><span className="kicker">Our belief</span><h2>Talent gets you in the room. <em>Preparation gets you remembered.</em></h2></div><div className="about-copy"><p>Competitions are not just about the final answer. They are about how you frame the problem, make the call, and bring people with you.</p><p>Strativate brings together the mentors, frameworks, and practice spaces students need to prepare with intention.</p><button className="button button-primary" onClick={() => go('mentors')}>Meet the community <ArrowRight size={16} /></button></div></div><div className="values"><div><Globe2 /><strong>Student-first</strong><p>Your ambition sets the pace.</p></div><div><Mic2 /><strong>Practical</strong><p>Less theory. More doing.</p></div><div><MessageCircle /><strong>Honest</strong><p>Feedback that moves you forward.</p></div></div></main> }
function Faq() { return <main className="page-main faq-page"><PageIntro kicker="Need to know" title={<>Questions, <em>answered.</em></>} text="Everything you need before you take your next step." /><div className="faq-list">{['What kind of competitions does Strativate cover?', 'How do I choose the right mentor?', 'Can I book for my whole team?', 'Where do sessions happen?', 'What happens after I purchase a program?'].map((q, i) => <details key={q} open={i === 0}><summary>{q}<ChevronDown size={18} /></summary><p>Our mentors support business case, business plan, marketing, finance, pitching, and similar university competitions. Tell us where you are, and we will help you choose the best path.</p></details>)}</div></main> }

export function Dashboard({ role, credits = 0, go, notify, children }: { role: 'mentee' | 'mentor' | 'admin'; credits?: number; go: (v: string) => void; notify: (m: string) => void; children?: React.ReactNode }) { return <main className="dashboard-page"><aside className="dash-side"><div className="brand"><span className="brand-mark">S</span><span>strativate</span></div><p className="side-label">Workspace</p>{['Overview', 'My programs', 'Mentors', 'Resources'].map((item, i) => <button className={i === 0 ? 'side-active' : ''} key={item}><LayoutDashboard size={16} />{item}</button>)}<div className="side-bottom"><button><ChevronDown size={15} /> Settings</button><div className="profile-mini"><span className="avatar">M</span><span><strong>Marsha K.</strong><small>Mentee account</small></span></div></div></aside><div className="dash-content"><div className="dash-top"><div><p className="kicker">Tuesday, 17 August 2026</p><h1>Good morning, Marsha.</h1></div><button className="button button-outline" onClick={() => { window.location.href = '/' }}>Back to site</button></div>{children || (role === 'mentee' ? <MenteeContent credits={credits} go={go} notify={notify} /> : role === 'mentor' ? <MentorContent notify={notify} /> : <AdminContent />)}</div></main> }
function MenteeContent({ credits, go, notify }: { credits: number; go: (v: string) => void; notify: (m: string) => void }) { return <><div className="dash-banner"><div><p className="kicker">Your next win starts here</p><h2>Keep your momentum going.</h2><p>One focused session can change the way you see a problem.</p><button className="button button-dark" onClick={() => go('mentors')}>Book a mentor <ArrowRight size={16} /></button></div><div className="banner-shape"><Trophy size={42} /></div></div><div className="stat-row"><div><span>Mentoring credits</span><strong>{credits}</strong><small>+5 this session</small></div><div><span>Current program</span><strong>Case Foundations</strong><small>62% complete</small></div><div><span>Next session</span><strong>Thu, 20 Aug</strong><small>with Alvin · 19:00</small></div></div><div className="dash-grid"><section className="dash-card"><div className="dash-card-head"><h3>Continue learning</h3><button onClick={() => notify('Your learning library is ready.')}>View all</button></div><div className="learning-item"><div className="lesson-icon"><Play size={16} fill="currentColor" /></div><div><strong>How to crack a business case</strong><p>Lesson 4 · 18 min left</p><div className="progress"><i style={{ width: '62%' }} /></div></div><span>62%</span></div><div className="learning-item"><div className="lesson-icon yellow"><BookOpen size={16} /></div><div><strong>Market sizing fundamentals</strong><p>Lesson 5 · 25 min</p><div className="progress"><i style={{ width: '28%' }} /></div></div><span>28%</span></div></section><section className="dash-card upcoming"><div className="dash-card-head"><h3>Upcoming session</h3><CalendarDays size={18} /></div><div className="session-date"><strong>20</strong><span>Aug<br />2026</span></div><div><strong>Case practice & feedback</strong><p><Clock3 size={14} /> 19:00 — 20:15 WIB</p></div><button className="button button-outline" onClick={() => notify('Session link copied to clipboard.')}>Copy session link</button></section></div></> }
function MentorContent({ notify }: { notify: (m: string) => void }) { return <><div className="dash-banner red-banner"><div><p className="kicker">Mentor workspace</p><h2>Help someone find their edge.</h2><p>You have 3 sessions waiting for your expertise this week.</p><button className="button button-dark" onClick={() => notify('Opening your session calendar.')}>Open calendar <CalendarDays size={16} /></button></div><div className="banner-shape"><Users size={42} /></div></div><div className="stat-row"><div><span>This month</span><strong>Rp 3.2M</strong><small>+18% vs last month</small></div><div><span>Students helped</span><strong>24</strong><small>4.9 average rating</small></div><div><span>Next session</span><strong>Today, 19:00</strong><small>with Marsha K.</small></div></div><section className="dash-card table-card"><div className="dash-card-head"><h3>Recent students</h3><button onClick={() => notify('Student list opened.')}>View all</button></div>{['Marsha K. · Case Foundations', 'Kevin T. · Pitch Deck Review', 'Alya R. · Market Sizing'].map((s, i) => <div className="table-row" key={s}><span className="avatar small-avatar">{['M', 'K', 'A'][i]}</span><strong>{s}</strong><span className="badge">{i === 0 ? 'Upcoming' : 'Completed'}</span><button onClick={() => notify('Message sent.')}>Message</button></div>)}</section></> }
function AdminContent() { return <><div className="admin-heading"><div><p className="kicker">Admin overview</p><h2>Platform at a glance.</h2></div><span className="badge">Live demo data</span></div><div className="stat-row"><div><span>Total students</span><strong>2,548</strong><small>+12.4% this month</small></div><div><span>Active mentors</span><strong>86</strong><small>Across 14 universities</small></div><div><span>GMV this month</span><strong>Rp 48.2M</strong><small>+21.8% this month</small></div></div><div className="dash-grid"><section className="dash-card"><div className="dash-card-head"><h3>Enrollment pulse</h3><span className="muted">Last 30 days</span></div><div className="chart"><i style={{ height: '42%' }} /><i style={{ height: '60%' }} /><i style={{ height: '48%' }} /><i style={{ height: '78%' }} /><i style={{ height: '65%' }} /><i style={{ height: '91%' }} /><i style={{ height: '74%' }} /><i style={{ height: '100%' }} /><i style={{ height: '86%' }} /></div></section><section className="dash-card"><div className="dash-card-head"><h3>Top programs</h3></div>{programs.map((p, i) => <div className="rank-row" key={p.title}><span>0{i + 1}</span><strong>{p.title}</strong><b>{[842, 624, 410][i]}</b></div>)}</section></div></> }

