import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react'

import { publicContact } from '@/lib/content/brand'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import { competitionCategories, type ProgramEditorial } from '@/lib/program-information'
import { ProgramComparison } from './program-comparison'

export function ProgramDetail({ program }: { program: ProgramEditorial }) {
  const whatsappHref = buildWhatsAppHref(`Halo Strativate, saya ingin berkonsultasi tentang ${program.title}.`)

  return <main className="detail-page program-information">
    <nav className="program-breadcrumb" aria-label="Jejak navigasi" data-testid="program-breadcrumb">
      <Link href="/" className="back-link" data-testid="program-home-back-link">Strativate</Link>
      <Link href="/program" className="back-link" data-testid="program-directory-back-link"><ArrowLeft size={15} aria-hidden="true" /> Kembali ke Program</Link>
    </nav>

    <section className="detail-hero" data-reveal data-testid="program-detail-hero">
      <div>
        <p className="kicker">{program.kicker}</p>
        <h1 data-testid="program-detail-title">{program.title}</h1>
        <p className="detail-lede">{program.detail}</p>
        <div className="detail-price">
          <strong>Informasi komersial belum tersedia</strong>
          <span>Hubungi tim Strativate untuk informasi program terbaru.</span>
        </div>
        <div className="program-hero-actions">
          <a href="#packages" className="primary-cta" data-testid="program-packages-link">Lihat informasi paket <ArrowRight size={16} aria-hidden="true" /></a>
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="secondary-cta" data-testid="program-hero-whatsapp-link">Konsultasi dahulu</a>
        </div>
      </div>
      <aside className="detail-summary">
        <p className="kicker">Sekilas program</p>
        {program.highlights.map((fact) => <div key={fact}><Check size={17} aria-hidden="true" /><span>{fact}</span></div>)}
      </aside>
    </section>

    <section className="program-audience" data-reveal>
      <Compass size={30} aria-hidden="true" />
      <div><p className="kicker">Cocok untuk siapa?</p><h2>Mulai dari kebutuhanmu sekarang.</h2><p>{program.audience}</p></div>
    </section>

    <section className="program-section" data-reveal>
      <div className="program-section-heading"><p className="kicker">Cara kerja program</p><h2>Dari tujuan sampai langkah berikutnya.</h2></div>
      <ol className="program-journey">{program.journey.map((step, index) => <li key={step.title}><span className="program-step-number" aria-hidden="true">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol>
    </section>

    <section id="packages" className="program-section program-section--surface" data-reveal>
      <div className="program-section-heading">
        <p className="kicker">Paket dan harga</p>
        <h2>Rincian paket dan harga sedang diperbarui.</h2>
        <p>Hubungi tim Strativate untuk informasi program terbaru dan mendiskusikan kebutuhanmu.</p>
      </div>
    </section>

    <section className="program-section">
      <div className="program-section-heading"><p className="kicker">Kategori kompetisi</p><h2>Dukungan lintas bidang.</h2></div>
      <ul className="program-category-list">{competitionCategories.map((category) => <li key={category}>{category}</li>)}</ul>
    </section>

    <ProgramComparison />

    <section className="program-contact" data-reveal>
      <p className="kicker">Butuh bantuan memilih?</p>
      <h2>Diskusikan tujuanmu.</h2>
      <p>Tim Strativate dapat menjelaskan pilihan program sesuai tujuan, tahap persiapan, dan jadwalmu.</p>
      <div className="program-contact-actions">
        <a href={whatsappHref} target="_blank" rel="noreferrer" className="primary-cta" data-testid="program-contact-whatsapp-link">Konsultasi via WhatsApp <ArrowRight size={16} aria-hidden="true" /></a>
        <a href={publicContact.emailHref} className="back-link" data-testid="program-contact-email-link">{publicContact.email}</a>
      </div>
    </section>
  </main>
}
