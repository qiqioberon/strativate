import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Compass, Users } from 'lucide-react'
import {
  competitionCategories, formatRupiah, guaranteeConditions, intensiveAddOns,
  intensiveBundles, intensivePackages, privateLearningPaths, privateMentorTiers,
  privateTopics, type ProgramInformation,
} from '@/lib/program-information'
import { ProgramComparison } from './program-comparison'

function FeatureList({ items }: { items: string[] }) {
  return <ul className="program-feature-list">{items.map(item => <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}</ul>
}

function PrivatePackages() {
  return <>
    <p className="program-pricing-note">Setiap sesi berlangsung 75 menit. Satu harga berlaku untuk individu maupun tim berisi 1–4 peserta.</p>
    <div className="program-comparison-grid">
      {privateMentorTiers.map(tier => <article className="program-price-table" key={tier.name}>
        <div className="program-price-table-heading"><Users size={22} aria-hidden="true" /><h3>{tier.name}</h3><p>{tier.description}</p></div>
        <table>
          <caption className="sr-only">Paket {tier.name}</caption>
          <thead><tr><th scope="col">Sesi</th><th scope="col">Per sesi</th><th scope="col">Total paket</th></tr></thead>
          <tbody>{tier.packages.map(item => <tr key={item.sessions}>
            <th scope="row">{item.sessions} sesi</th>
            <td>{formatRupiah(item.perSession)}</td><td><strong>{formatRupiah(item.total)}</strong></td>
          </tr>)}</tbody>
        </table>
        <p className="program-table-note">Atur jadwal sesuai kebutuhan · Pilih mentormu</p>
      </article>)}
    </div>
  </>
}

function IntensivePackages() {
  return <div className="program-three-grid">
    {intensivePackages.map(item => <article className="program-info-card program-package" key={item.name}>
      <p className="kicker">Kompetisi nasional</p><h3>{item.name}</h3><p className="program-session-count">{item.sessions} sesi per bulan</p>
      <p className="program-package-price">{formatRupiah(item.price)}</p>
      <p className="program-normal-price">Harga normal <s>{formatRupiah(item.normalPrice)}</s></p>
      <p>{item.description}</p><FeatureList items={item.features} />
    </article>)}
    <article className="program-info-card program-package program-custom-package">
      <p className="kicker">Kompetisi internasional</p><h3>Sepenuhnya disesuaikan</h3><p className="program-session-count">Cakupan dan frekuensi sesuai kebutuhanmu</p>
      <p className="program-package-price program-consultation-label">Sesuai konsultasi</p>
      <p>Setiap kompetisi internasional membutuhkan pendekatan berbeda. Rencana mentoring disesuaikan setelah konsultasi awal.</p>
      <FeatureList items={['Rencana persiapan sesuai kompetisi', 'Cakupan dan frekuensi sesi yang disesuaikan', 'Pemilihan mentor berdasarkan kebutuhan kompetisi', 'Dukungan terarah sepanjang persiapan']} />
    </article>
  </div>
}

function IntensiveExtras() {
  return <>
    <section id="add-ons" className="program-section">
      <div className="program-section-heading"><p className="kicker">Layanan tambahan</p><h2>Tambahkan dukungan yang kamu perlukan.</h2><p>Lengkapi paket utama dengan evaluasi, simulasi, atau perlindungan berbasis capaian.</p></div>
      <div className="program-three-grid">{intensiveAddOns.map(item => <article className="program-info-card" key={item.name}>
        <h3>{item.name}</h3><p className="program-extra-price">+{formatRupiah(item.price)}</p><p>{item.description}</p><FeatureList items={item.features} />
        {item.conditional && <p className="program-conditions">{guaranteeConditions}</p>}
      </article>)}</div>
    </section>
    <section className="program-section" aria-labelledby="bundle-heading">
      <div className="program-section-heading"><p className="kicker">Paket gabungan</p><h2 id="bundle-heading">Satu paket untuk target yang lebih jelas.</h2><p>Bandingkan layanan yang sudah termasuk dalam setiap paket mentoring.</p></div>
      <div className="program-three-grid">{intensiveBundles.map(item => <article className="program-info-card" key={item.name}>
        <h3>{item.name}</h3><p className="program-extra-price">{formatRupiah(item.price)}</p><p>{item.description}</p><FeatureList items={item.features} />
        {item.conditional && <p className="program-conditions">{guaranteeConditions}</p>}
      </article>)}</div>
    </section>
  </>
}

export function ProgramInformationDetail({ program }: { program: ProgramInformation }) {
  const isPrivate = program.slug === 'private-mentoring'
  return <main className="detail-page program-information">
    <nav className="program-breadcrumb" aria-label="Jejak navigasi"><Link href="/" className="back-link">Strativate</Link><Link href="/explore" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Jelajahi program</Link></nav>
    <section className="detail-hero">
      <div><p className="kicker">{program.kicker}</p><h1>{program.title}</h1><p className="detail-lede">{program.detail}</p>
        <div className="detail-price"><strong>{program.priceLabel}</strong><span>{program.priceContext}</span></div>
        <a href="#packages" className="primary-cta">Lihat paket <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <aside className="detail-summary"><p className="kicker">Sekilas program</p>{program.facts.map(fact => <div key={fact}><Check size={17} aria-hidden="true" /><span>{fact}</span></div>)}</aside>
    </section>

    <section className="program-audience"><Compass size={30} aria-hidden="true" /><div><p className="kicker">Cocok untuk siapa?</p><h2>Mulai dari kebutuhanmu sekarang.</h2><p>{program.audience}</p></div></section>

    {isPrivate && <>
      <section className="program-section"><div className="program-section-heading"><p className="kicker">Dua jalur belajar</p><h2>Mulai dari dasar atau fokus ke kompetisi tertentu.</h2></div><div className="program-comparison-grid">{privateLearningPaths.map(path => <article className="program-info-card" key={path.title}><h3>{path.title}</h3><p>{path.description}</p></article>)}</div></section>
      <section className="program-section"><div className="program-section-heading"><p className="kicker">Fokus sesi</p><h2>Kerjakan hal yang paling penting.</h2><p>Bahas satu prioritas dalam setiap sesi agar masukan lebih jelas dan langkah berikutnya mudah diterapkan. Topik khusus dapat dibicarakan saat konsultasi.</p></div><div className="program-three-grid">{privateTopics.map(topic => <article className="program-info-card" key={topic.title}><h3>{topic.title}</h3><p>{topic.description}</p></article>)}</div></section>
    </>}

    <section className="program-section"><div className="program-section-heading"><p className="kicker">Yang akan kamu dapatkan</p><h2>{isPrivate ? 'Masukan yang bisa langsung dipakai.' : 'Progres yang terlihat dari waktu ke waktu.'}</h2></div><FeatureList items={program.outcomes} /></section>
    <section className="program-section"><div className="program-section-heading"><p className="kicker">Cara kerja program</p><h2>Dari tujuan sampai langkah berikutnya.</h2></div><ol className="program-journey">{program.journey.map((step, index) => <li key={step.title}><span className="program-step-number" aria-hidden="true">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol></section>
    <section id="packages" className="program-section"><div className="program-section-heading"><p className="kicker">Paket dan harga</p><h2>{isPrivate ? 'Pilih mentormu. Tentukan ritmemu.' : 'Pilih tingkat bimbinganmu.'}</h2></div>{isPrivate ? <PrivatePackages /> : <IntensivePackages />}</section>
    {!isPrivate && <IntensiveExtras />}
    <section className="program-section"><div className="program-section-heading"><p className="kicker">Kategori kompetisi</p><h2>Dukungan lintas bidang.</h2></div><ul className="program-category-list">{competitionCategories.map(category => <li key={category}>{category}</li>)}</ul></section>
    <ProgramComparison />
    <section className="program-contact"><p className="kicker">Butuh bantuan memilih?</p><h2>Diskusikan tujuanmu.</h2><p>Tim Strativate dapat menjelaskan pilihan program dan merekomendasikan dukungan sesuai tujuan, tahap persiapan, dan jadwalmu.</p><p className="program-contact-details">+62 851-8775-4671 <span aria-hidden="true">·</span> strativateid@gmail.com</p><Link href="/explore" className="back-link">Kembali ke semua program <ArrowRight size={16} aria-hidden="true" /></Link></section>
  </main>
}
