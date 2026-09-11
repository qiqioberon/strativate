import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Compass, Users } from 'lucide-react'
import { formatRupiah } from '@/lib/catalog/format'
import { catalogPriceLabel, catalogProductTypeLabels, directCheckoutOfferings } from '@/lib/catalog/presentation'
import type { CatalogProductDetail, CatalogProductSummary } from '@/lib/catalog/types'
import { commercialItemEditorial, competitionCategories, deliveryOptionEditorial, getProgramEditorial } from '@/lib/program-information'
import { ProgramComparison } from './program-comparison'
import { publicContact } from '@/lib/content/brand'

function FeatureList({ items }: { items: string[] }) {
  return <ul className="program-feature-list">{items.map((item) => <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}</ul>
}

function PrivatePackages({ product }: { product: CatalogProductDetail }) {
  const tiers = Array.from(new Map(product.privateOfferings.map((offering) => [offering.mentorTier.id, offering.mentorTier])).values())
  return <>
    {product.privateDetails && <p className="program-pricing-note">Setiap sesi berlangsung {product.privateDetails.sessionDurationMinutes} menit. Satu harga berlaku untuk individu maupun tim berisi {product.privateDetails.minParticipants}–{product.privateDetails.maxParticipants} peserta.</p>}
    <div className="program-comparison-grid">{tiers.map((tier) => {
      const offerings = product.privateOfferings.filter((offering) => offering.mentorTier.id === tier.id)
      return <article className="program-price-table" key={tier.id}><div className="program-price-table-heading"><Users size={22} aria-hidden="true" /><h3>{tier.label}</h3></div><table><caption className="sr-only">Paket {tier.label}</caption><thead><tr><th scope="col">Sesi</th><th scope="col">Per sesi</th><th scope="col">Total paket</th></tr></thead><tbody>{offerings.map((offering) => <tr key={offering.id}><th scope="row">{offering.sessionPackage.label}</th><td>{formatRupiah(offering.perSessionPriceAmount)}</td><td><strong>{formatRupiah(offering.priceAmount)}</strong>{offering.referencePriceAmount !== null && <><br /><s>{formatRupiah(offering.referencePriceAmount)}</s></>}</td></tr>)}</tbody></table><p className="program-table-note">Atur jadwal sesuai kebutuhan · Pilih mentormu</p></article>
    })}</div>
  </>
}

function IntensivePackages({ product }: { product: CatalogProductDetail }) {
  return <div className="program-three-grid">{product.intensiveOfferings.map((offering) => <article className={`program-info-card program-package ${offering.pricingMode === 'quotation_required' ? 'program-custom-package' : ''}`} key={offering.id}><p className="kicker">{offering.scope === 'national_fixed' ? 'Kompetisi nasional' : 'Kompetisi internasional'}</p><h3>{offering.title}</h3><p className="program-session-count">{offering.sessionsPerMonth ? `${offering.sessionsPerMonth} sesi per bulan` : 'Cakupan dan frekuensi sesuai kebutuhanmu'}</p><p className={`program-package-price ${offering.pricingMode === 'quotation_required' ? 'program-consultation-label' : ''}`}>{offering.pricingMode === 'fixed' ? formatRupiah(offering.priceAmount!) : 'Sesuai konsultasi'}</p>{offering.pricingMode === 'fixed' && offering.referencePriceAmount && <p className="program-normal-price">Harga normal <s>{formatRupiah(offering.referencePriceAmount)}</s></p>}<p>{commercialItemEditorial[offering.code]?.description ?? 'Hubungi tim Strativate untuk informasi lebih lanjut.'}</p><FeatureList items={(product.benefitsByItemId[offering.id] ?? []).map((benefit) => benefit.label)} /></article>)}</div>
}

function IntensiveExtras({ product }: { product: CatalogProductDetail }) {
  return <>
    <section id="add-ons" className="program-section"><div className="program-section-heading"><p className="kicker">Layanan tambahan</p><h2>Tambahkan dukungan yang kamu perlukan.</h2></div><div className="program-three-grid">{product.addOns.map((item) => <article className="program-info-card" key={item.id}><h3>{item.title}</h3><p className="program-extra-price">{item.pricingMode === 'fixed' ? `+${formatRupiah(item.priceAmount)}` : 'Sesuai konsultasi'}</p><p>{commercialItemEditorial[item.code]?.description}</p>{item.publicConditionSummary && <p className="program-conditions">{item.publicConditionSummary}</p>}</article>)}</div></section>
    <section className="program-section" aria-labelledby="bundle-heading"><div className="program-section-heading"><p className="kicker">Paket gabungan</p><h2 id="bundle-heading">Satu paket untuk target yang lebih jelas.</h2><p>Komposisi berikut berasal langsung dari Product Master.</p></div><div className="program-three-grid">{product.bundles.map((item) => <article className="program-info-card" key={item.id}><h3>{item.title}</h3><p className="program-extra-price">{item.pricingMode === 'fixed' ? formatRupiah(item.priceAmount) : 'Sesuai konsultasi'}</p><p>{commercialItemEditorial[item.code]?.description}</p><FeatureList items={item.components.map((component) => component.quantity > 1 ? `${component.quantity} × ${component.title}` : component.title)} />{item.publicConditionSummary && <p className="program-conditions">{item.publicConditionSummary}</p>}</article>)}</div></section>
  </>
}

type ProductDetailProps = { product: CatalogProductDetail; comparisons: CatalogProductSummary[] }

export function ProductDetail(props: ProductDetailProps) {
  if (props.product.productType === 'private_mentoring' || props.product.productType === 'intensive_mentoring') {
    return <MentoringProductDetail {...props} />
  }
  return <GeneralCatalogProductDetail product={props.product} />
}

function MentoringProductDetail({ product, comparisons }: ProductDetailProps) {
  const editorial = getProgramEditorial(product.code)
  const isPrivate = product.productType === 'private_mentoring'
  const isIntensive = product.productType === 'intensive_mentoring'
  const allBenefits = Array.from(new Map(Object.values(product.benefitsByItemId).flat().map((benefit) => [benefit.id, benefit])).values())

  return <main className="detail-page program-information">
    <nav className="program-breadcrumb" aria-label="Jejak navigasi"><Link href="/" className="back-link">Strativate</Link><Link href="/explore" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Jelajahi program</Link></nav>
    <section className="detail-hero"><div><p className="kicker">{editorial?.kicker ?? 'Program Strativate'}</p><h1>{product.title}</h1><p className="detail-lede">{editorial?.detail ?? product.description ?? product.shortDescription}</p><div className="detail-price"><strong>{catalogPriceLabel(product)}</strong><span>{product.defaultPurchaseFlow === 'consultation_offer' ? 'Pilih kebutuhanmu bersama tim Strativate' : 'Pembelian langsung'}</span></div><a href="#packages" className="primary-cta">Lihat paket <ArrowRight size={16} aria-hidden="true" /></a></div><aside className="detail-summary"><p className="kicker">Sekilas program</p>{editorial?.highlights.map((fact) => <div key={fact}><Check size={17} aria-hidden="true" /><span>{fact}</span></div>)}</aside></section>
    {editorial && <section className="program-audience"><Compass size={30} aria-hidden="true" /><div><p className="kicker">Cocok untuk siapa?</p><h2>Mulai dari kebutuhanmu sekarang.</h2><p>{editorial.audience}</p></div></section>}
    {isPrivate && <><DeliveryOptions product={product} kind="learning_path" title="Mulai dari dasar atau fokus ke kompetisi tertentu." /><DeliveryOptions product={product} kind="focus_topic" title="Kerjakan hal yang paling penting." /></>}
    {!!allBenefits.length && <section className="program-section"><div className="program-section-heading"><p className="kicker">Yang akan kamu dapatkan</p><h2>{isPrivate ? 'Masukan yang bisa langsung dipakai.' : 'Progres yang terlihat dari waktu ke waktu.'}</h2></div><FeatureList items={allBenefits.map((benefit) => benefit.label)} /></section>}
    {editorial && <section className="program-section"><div className="program-section-heading"><p className="kicker">Cara kerja program</p><h2>Dari tujuan sampai langkah berikutnya.</h2></div><ol className="program-journey">{editorial.journey.map((step, index) => <li key={step.title}><span className="program-step-number" aria-hidden="true">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol></section>}
    <section id="packages" className="program-section"><div className="program-section-heading"><p className="kicker">Paket dan harga</p><h2>{isPrivate ? 'Pilih mentormu. Tentukan ritmemu.' : 'Pilih tingkat bimbinganmu.'}</h2></div>{isPrivate ? <PrivatePackages product={product} /> : <IntensivePackages product={product} />}</section>
    {isIntensive && <IntensiveExtras product={product} />}
    <section className="program-section"><div className="program-section-heading"><p className="kicker">Kategori kompetisi</p><h2>Dukungan lintas bidang.</h2></div><ul className="program-category-list">{competitionCategories.map((category) => <li key={category}>{category}</li>)}</ul></section>
    <ProgramComparison products={comparisons} />
    <section className="program-contact"><p className="kicker">Butuh bantuan memilih?</p><h2>Diskusikan tujuanmu.</h2><p>Tim Strativate dapat menjelaskan pilihan program sesuai tujuan, tahap persiapan, dan jadwalmu.</p><div className="program-contact-actions"><a href={publicContact.whatsapp} className="primary-cta">Konsultasi via WhatsApp <ArrowRight size={16} aria-hidden="true" /></a><a href={publicContact.emailHref} className="back-link">{publicContact.email}</a></div></section>
  </main>
}

function GeneralCatalogProductDetail({ product }: { product: CatalogProductDetail }) {
  const checkoutOfferings = new Map(directCheckoutOfferings(product).map(item => [item.id, item]))

  return <main className="detail-page program-information">
    <nav className="program-breadcrumb" aria-label="Jejak navigasi"><Link href="/" className="back-link">Strativate</Link><Link href="/explore" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Jelajahi katalog</Link></nav>
    <section className="detail-hero">
      <div>
        <p className="kicker">{catalogProductTypeLabels[product.productType]}</p>
        <h1>{product.title}</h1>
        <p className="detail-lede">{product.description ?? product.shortDescription}</p>
        {product.digitalDetails && <p className="program-conditions">Format: {product.digitalDetails.contentType === 'pdf' ? 'PDF' : 'Video'}</p>}
        <div className="detail-price"><strong>{catalogPriceLabel(product)}</strong><span>{product.defaultPurchaseFlow === 'direct_checkout' ? 'Pembelian langsung' : 'Sesuai konsultasi'}</span></div>
        {product.offerings.length > 0 && <a href="#packages" className="primary-cta">Lihat pilihan <ArrowRight size={16} aria-hidden="true" /></a>}
      </div>
      <aside className="detail-summary"><p className="kicker">Informasi produk</p><div><Check size={17} aria-hidden="true" /><span>{product.shortDescription}</span></div></aside>
    </section>
    <section id="packages" className="program-section">
      <div className="program-section-heading"><p className="kicker">Pilihan yang tersedia</p><h2>{product.offerings.length > 0 ? 'Pilih sesuai kebutuhanmu.' : 'Belum ada penawaran yang dipublikasikan.'}</h2></div>
      {product.offerings.length > 0 && <div className="program-three-grid">{product.offerings.map((offering) => {
        const checkoutOffering = checkoutOfferings.get(offering.id)
        return <article className="program-info-card program-package" key={offering.id}>
          <h3>{offering.title}</h3>
          {offering.description && <p>{offering.description}</p>}
          <p className={`program-package-price ${offering.pricingMode === 'quotation_required' ? 'program-consultation-label' : ''}`}>{offering.pricingMode === 'fixed' ? formatRupiah(offering.priceAmount) : 'Sesuai konsultasi'}</p>
          {offering.pricingMode === 'fixed' && offering.referencePriceAmount !== null && <p className="program-normal-price">Harga referensi <s>{formatRupiah(offering.referencePriceAmount)}</s></p>}
          <FeatureList items={(product.benefitsByItemId[offering.id] ?? []).map(benefit => benefit.label)} />
          {checkoutOffering && <Link className="primary-cta" href={`/checkout/${product.slug}?item=${checkoutOffering.id}`}>Beli sekarang <ArrowRight size={16} aria-hidden="true" /></Link>}
        </article>
      })}</div>}
    </section>
    <section className="program-contact"><p className="kicker">Katalog Strativate</p><h2>Lihat pilihan lainnya.</h2><p>Bandingkan produk dan program yang telah dipublikasikan.</p><Link href="/explore" className="back-link">Kembali ke semua produk <ArrowRight size={16} aria-hidden="true" /></Link></section>
  </main>
}

function DeliveryOptions({ product, kind, title }: { product: CatalogProductDetail; kind: 'learning_path' | 'focus_topic'; title: string }) {
  const options = product.deliveryOptions.filter((option) => option.kind === kind)
  if (!options.length) return null
  return <section className="program-section"><div className="program-section-heading"><p className="kicker">{kind === 'learning_path' ? 'Jalur belajar' : 'Fokus sesi'}</p><h2>{title}</h2></div><div className={kind === 'learning_path' ? 'program-comparison-grid' : 'program-three-grid'}>{options.map((option) => <article className="program-info-card" key={option.id}><h3>{option.label}</h3><p>{deliveryOptionEditorial[option.code]?.description}</p>{option.allowsCustomValue && <p className="program-conditions">Kamu dapat mengajukan topik lain saat konsultasi.</p>}</article>)}</div></section>
}
