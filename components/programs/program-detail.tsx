import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react'

import { formatRupiah } from '@/lib/commerce/money'
import { publicContact } from '@/lib/content/brand'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import { competitionCategories as intensiveCompetitionCategories, type ProgramEditorial } from '@/lib/program-information'
import type { PrivateMentoringCatalogView, PrivateMentoringPackageView } from '@/lib/private-mentoring/types'
import { ProgramComparison } from './program-comparison'

function groupPackages(packages: PrivateMentoringPackageView[]) {
  return packages.reduce<Array<{ tierId: string; tierName: string; packages: PrivateMentoringPackageView[] }>>((groups, item) => {
    const current = groups.find(group => group.tierId === item.mentorTierId)
    if (current) current.packages.push(item)
    else groups.push({ tierId: item.mentorTierId, tierName: item.mentorTierName, packages: [item] })
    return groups
  }, [])
}

export function ProgramDetail({
  program,
  privateMentoringCatalog = null,
}: {
  program: ProgramEditorial
  privateMentoringCatalog?: PrivateMentoringCatalogView | null
}) {
  const isPrivateMentoring = program.slug === 'private-mentoring'
  const whatsappHref = buildWhatsAppHref(`Halo Strativate, saya ingin berkonsultasi tentang ${program.title}.`)
  const packages = isPrivateMentoring ? privateMentoringCatalog?.packages ?? [] : []
  const packageGroups = groupPackages(packages)
  const minimumPackage = packages.length
    ? packages.reduce((best, item) => item.priceAmount < best.priceAmount ? item : best)
    : null
  const categories = isPrivateMentoring
    ? privateMentoringCatalog?.competitionCategories.map(item => item.name) ?? []
    : intensiveCompetitionCategories

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
          {isPrivateMentoring && minimumPackage ? <>
            <strong>Mulai {formatRupiah(minimumPackage.priceAmount)}</strong>
            <span>{minimumPackage.durationMinutes} menit per sesi · hingga {minimumPackage.maxParticipants} peserta</span>
          </> : <>
            <strong>Informasi komersial belum tersedia</strong>
            <span>Hubungi tim Strativate untuk informasi program terbaru.</span>
          </>}
        </div>
        <div className="program-hero-actions">
          <a href="#packages" className="primary-cta" data-testid="program-packages-link">Lihat informasi paket <ArrowRight size={16} aria-hidden="true" /></a>
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="secondary-cta" data-testid="program-hero-whatsapp-link">Konsultasi dahulu</a>
        </div>
      </div>
      <aside className="detail-summary">
        <p className="kicker">Sekilas program</p>
        {program.highlights.map(fact => <div key={fact}><Check size={17} aria-hidden="true" /><span>{fact}</span></div>)}
      </aside>
    </section>

    <section className="program-audience" data-reveal>
      <Compass size={30} aria-hidden="true" />
      <div><p className="kicker">Cocok untuk siapa?</p><h2>Mulai dari kebutuhanmu sekarang.</h2><p>{program.audience}</p></div>
    </section>

    {isPrivateMentoring && privateMentoringCatalog ? <>
      <section className="program-section" data-reveal data-testid="private-mentoring-learning-paths">
        <div className="program-section-heading"><p className="kicker">Learning Paths</p><h2>Dua jalur sesuai tujuan dan titik awalmu.</h2></div>
        <div className="program-comparison-grid">
          {privateMentoringCatalog.learningPaths.map(path => <article className="program-info-card" key={path.id}><h3>{path.name}</h3><p>{path.description}</p></article>)}
        </div>
      </section>
      <section className="program-section program-section--surface" data-reveal data-testid="private-mentoring-session-focuses">
        <div className="program-section-heading"><p className="kicker">Session Topics</p><h2>Satu fokus utama untuk setiap sesi.</h2></div>
        <div className="program-three-grid">
          {privateMentoringCatalog.sessionFocuses.map(focus => <article className="program-info-card" key={focus.id}><h3>{focus.name}</h3><p>{focus.description}</p></article>)}
        </div>
      </section>
    </> : null}

    <section className="program-section" data-reveal>
      <div className="program-section-heading"><p className="kicker">Cara kerja program</p><h2>Dari tujuan sampai langkah berikutnya.</h2></div>
      <ol className="program-journey">{program.journey.map((step, index) => <li key={step.title}><span className="program-step-number" aria-hidden="true">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol>
    </section>

    <section id="packages" className="program-section program-section--surface" data-reveal data-testid="program-packages-section">
      {isPrivateMentoring && packageGroups.length ? <>
        <div className="program-section-heading">
          <p className="kicker">Paket dan harga</p>
          <h2>Pilih jumlah sesi, lalu konsultasikan kebutuhanmu.</h2>
          <p>Harga paket berlaku untuk individu atau tim hingga empat peserta. Per-session price diturunkan dari total paket aktif, bukan disimpan sebagai sumber harga terpisah.</p>
        </div>
        <div className="program-comparison-grid">
          {packageGroups.map(group => {
            const first = group.packages[0]
            return <article className="program-price-table" key={group.tierId}>
              <div className="program-price-table-heading">
                <h3>{group.tierName}</h3>
                <p>{first.durationMinutes} menit/sesi · maks. {first.maxParticipants} peserta</p>
              </div>
              <table>
                <thead><tr><th scope="col">Sesi</th><th scope="col">Total</th><th scope="col">Per sesi</th><th scope="col">Referensi</th></tr></thead>
                <tbody>{group.packages.map(item => <tr key={item.id} data-testid={`private-mentoring-package-${item.mentorTierCode.toLowerCase()}-${item.sessionCount}`}>
                  <th scope="row">{item.sessionCount}</th>
                  <td><strong>{formatRupiah(item.priceAmount)}</strong></td>
                  <td>{formatRupiah(item.pricePerSession)}/session</td>
                  <td>{item.referencePriceAmount ? <del>{formatRupiah(item.referencePriceAmount)}</del> : '—'}</td>
                </tr>)}</tbody>
              </table>
            </article>
          })}
        </div>
        <p className="program-pricing-note">Setelah konsultasi, tim Strativate mengirim Cart Link untuk mentee yang dituju. Cart dan checkout tetap menggunakan Shared Commerce dan harga paket aktif.</p>
        <a href={whatsappHref} target="_blank" rel="noreferrer" className="primary-cta">Tanya paket via WhatsApp <ArrowRight size={16} aria-hidden="true" /></a>
      </> : isPrivateMentoring ? <div className="program-section-heading"><p className="kicker">Paket dan harga</p><h2>Data paket belum dapat dimuat saat ini.</h2><p>Hubungi tim Strativate untuk bantuan dan informasi terbaru.</p></div> : <div className="program-section-heading"><p className="kicker">Paket dan harga</p><h2>Rincian paket dan harga sedang diperbarui.</h2><p>Hubungi tim Strativate untuk informasi program terbaru dan mendiskusikan kebutuhanmu.</p></div>}
    </section>

    <section className="program-section">
      <div className="program-section-heading"><p className="kicker">Kategori kompetisi</p><h2>Dukungan lintas bidang.</h2></div>
      <ul className="program-category-list">{categories.map(category => <li key={category}>{category}</li>)}</ul>
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
