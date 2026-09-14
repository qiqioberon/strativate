import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react'

import { formatRupiah } from '@/lib/commerce/money'
import { publicContact } from '@/lib/content/brand'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import { competitionCategories as intensiveCompetitionCategories, type ProgramEditorial } from '@/lib/program-information'
import type { PrivateMentoringPackageView, PrivateMentoringPublicView } from '@/lib/private-mentoring/types'
import { ProgramComparison } from './program-comparison'

type ProgramDetailModel = ProgramEditorial | PrivateMentoringPublicView

function isPrivateMentoring(program: ProgramDetailModel): program is PrivateMentoringPublicView {
  return 'packages' in program
}

function groupPackages(packages: PrivateMentoringPackageView[]) {
  return packages.reduce<Array<{ tierId: string; tierName: string; packages: PrivateMentoringPackageView[] }>>((groups, item) => {
    const current = groups.find(group => group.tierId === item.mentorTierId)
    if (current) current.packages.push(item)
    else groups.push({ tierId: item.mentorTierId, tierName: item.mentorTierName, packages: [item] })
    return groups
  }, [])
}

export function ProgramDetail({ program }: { program: ProgramDetailModel }) {
  const privateMentoring = isPrivateMentoring(program)
  const whatsappHref = buildWhatsAppHref(`Halo Strativate, saya ingin berkonsultasi tentang ${program.title}.`)
  const highlights = privateMentoring ? program.highlights.map(item => item.text) : program.highlights
  const journey = privateMentoring ? program.journeySteps : program.journey
  const categories = privateMentoring ? program.competitionCategories.map(item => item.name) : intensiveCompetitionCategories
  const packageGroups = privateMentoring ? groupPackages(program.packages) : []
  const minimumPackage = privateMentoring && program.packages.length
    ? program.packages.reduce((best, item) => item.priceAmount < best.priceAmount ? item : best)
    : null

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
          {minimumPackage ? <><strong>Mulai {formatRupiah(minimumPackage.priceAmount)}</strong><span>{minimumPackage.durationMinutes} menit per sesi · hingga {minimumPackage.maxParticipants} peserta</span></> : <><strong>Informasi komersial belum tersedia</strong><span>Hubungi tim Strativate untuk informasi program terbaru.</span></>}
        </div>
        <div className="program-hero-actions">
          <a href="#packages" className="primary-cta" data-testid="program-packages-link">Lihat informasi paket <ArrowRight size={16} aria-hidden="true" /></a>
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="secondary-cta" data-testid="program-hero-whatsapp-link">Konsultasi dahulu</a>
        </div>
      </div>
      <aside className="detail-summary">
        <p className="kicker">Sekilas program</p>
        {highlights.map(fact => <div key={fact}><Check size={17} aria-hidden="true" /><span>{fact}</span></div>)}
      </aside>
    </section>

    <section className="program-audience" data-reveal>
      <Compass size={30} aria-hidden="true" />
      <div><p className="kicker">Cocok untuk siapa?</p><h2>Mulai dari kebutuhanmu sekarang.</h2><p>{program.audience}</p></div>
    </section>

    {privateMentoring ? <>
      <section className="program-section" data-reveal data-testid="private-mentoring-learning-paths">
        <div className="program-section-heading"><p className="kicker">Learning Paths</p><h2>Dua jalur sesuai tujuan dan titik awalmu.</h2></div>
        <div className="program-info-grid">{program.learningPaths.map(path => <article key={path.id}><h3>{path.name}</h3><p>{path.description}</p></article>)}</div>
      </section>
      <section className="program-section program-section--surface" data-reveal data-testid="private-mentoring-session-focuses">
        <div className="program-section-heading"><p className="kicker">Session Focus</p><h2>Satu fokus utama untuk setiap sesi.</h2></div>
        <div className="program-info-grid program-info-grid--three">{program.sessionFocuses.map(focus => <article key={focus.id}><h3>{focus.name}</h3><p>{focus.description}</p></article>)}</div>
      </section>
    </> : null}

    <section className="program-section" data-reveal>
      <div className="program-section-heading"><p className="kicker">Cara kerja program</p><h2>Dari tujuan sampai langkah berikutnya.</h2></div>
      <ol className="program-journey">{journey.map((step, index) => <li key={step.title}><span className="program-step-number" aria-hidden="true">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol>
    </section>

    <section id="packages" className="program-section program-section--surface" data-reveal data-testid="program-packages-section">
      {privateMentoring ? <>
        <div className="program-section-heading"><p className="kicker">Paket dan harga</p><h2>Pilih jumlah sesi, lalu konsultasikan kebutuhanmu.</h2><p>Harga paket berlaku untuk individu atau tim hingga empat peserta. Transaksi setelah konsultasi tetap menggunakan harga paket aktif di Shared Commerce.</p></div>
        <div className="program-package-groups">
          {packageGroups.map(group => <section key={group.tierId} className="program-package-group"><h3>{group.tierName}</h3><div className="program-package-grid">
            {group.packages.map(item => <article key={item.id} className="program-package-card" data-testid={`private-mentoring-package-${item.mentorTierCode.toLowerCase()}-${item.sessionCount}`}>
              <div><strong>{item.sessionCount} {item.sessionCount === 1 ? 'Session' : 'Sessions'}</strong><span>{item.durationMinutes} menit/sesi · maks. {item.maxParticipants} peserta</span></div>
              <p className="program-package-total">{formatRupiah(item.priceAmount)}</p>
              <p>{formatRupiah(item.pricePerSession)}/session</p>
              {item.referencePriceAmount ? <del>{formatRupiah(item.referencePriceAmount)}</del> : null}
            </article>)}
          </div></section>)}
        </div>
        <a href={whatsappHref} target="_blank" rel="noreferrer" className="primary-cta">Tanya paket via WhatsApp <ArrowRight size={16} aria-hidden="true" /></a>
      </> : <div className="program-section-heading"><p className="kicker">Paket dan harga</p><h2>Rincian paket dan harga sedang diperbarui.</h2><p>Hubungi tim Strativate untuk informasi program terbaru dan mendiskusikan kebutuhanmu.</p></div>}
    </section>

    <section className="program-section">
      <div className="program-section-heading"><p className="kicker">Kategori kompetisi</p><h2>Dukungan lintas bidang.</h2></div>
      <ul className="program-category-list">{categories.map(category => <li key={category}>{category}</li>)}</ul>
    </section>

    <ProgramComparison />

    <section className="program-contact" data-reveal>
      <p className="kicker">Butuh bantuan memilih?</p><h2>Diskusikan tujuanmu.</h2>
      <p>Tim Strativate dapat menjelaskan pilihan program sesuai tujuan, tahap persiapan, dan jadwalmu.</p>
      <div className="program-contact-actions"><a href={whatsappHref} target="_blank" rel="noreferrer" className="primary-cta" data-testid="program-contact-whatsapp-link">Konsultasi via WhatsApp <ArrowRight size={16} aria-hidden="true" /></a><a href={publicContact.emailHref} className="back-link" data-testid="program-contact-email-link">{publicContact.email}</a></div>
    </section>
  </main>
}
