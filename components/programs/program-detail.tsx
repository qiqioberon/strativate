import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react'

import { formatRupiah } from '@/lib/commerce/money'
import { publicContact } from '@/lib/content/brand'
import type { IntensiveMentoringCatalogView } from '@/lib/intensive-mentoring/types'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import type { ProgramEditorial } from '@/lib/program-information'
import type { PrivateMentoringCatalogView, PrivateMentoringPackageView } from '@/lib/private-mentoring/types'
import styles from './program-detail.module.css'
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
  intensiveMentoringCatalog = null,
}: {
  program: ProgramEditorial
  privateMentoringCatalog?: PrivateMentoringCatalogView | null
  intensiveMentoringCatalog?: IntensiveMentoringCatalogView | null
}) {
  const isPrivateMentoring = program.slug === 'private-mentoring'
  const isIntensiveMentoring = program.slug === 'intensive-mentoring'
  const whatsappHref = buildWhatsAppHref(`Hello Strativate, I would like to discuss ${program.title}.`)
  const privatePackages = isPrivateMentoring ? privateMentoringCatalog?.packages ?? [] : []
  const packageGroups = groupPackages(privatePackages)
  const minimumPrivatePackage = privatePackages.length
    ? privatePackages.reduce((best, item) => item.priceAmount < best.priceAmount ? item : best)
    : null
  const fixedIntensivePackages = isIntensiveMentoring
    ? intensiveMentoringCatalog?.packages.filter(item => item.pricingMode === 'fixed' && item.priceAmount !== null) ?? []
    : []
  const minimumIntensivePackage = fixedIntensivePackages.length
    ? fixedIntensivePackages.reduce((best, item) => Number(item.priceAmount) < Number(best.priceAmount) ? item : best)
    : null
  const categories = isPrivateMentoring
    ? privateMentoringCatalog?.competitionCategories.map(item => item.name) ?? []
    : isIntensiveMentoring
      ? intensiveMentoringCatalog?.competitionCategories.map(item => item.name) ?? []
      : []

  return <main className="detail-page program-information">
    <nav className="program-breadcrumb" aria-label="Breadcrumb" data-testid="program-breadcrumb">
      <Link href="/" className="back-link" data-testid="program-home-back-link">Strativate</Link>
      <Link href="/program" className="back-link" data-testid="program-directory-back-link"><ArrowLeft size={15} aria-hidden="true" /> Back to Programs</Link>
    </nav>

    <section className="detail-hero" data-reveal data-testid="program-detail-hero">
      <div>
        <p className="kicker">{program.kicker}</p>
        <h1 data-testid="program-detail-title">{program.title}</h1>
        <p className="detail-lede">{program.detail}</p>
        <div className="detail-price">
          {isPrivateMentoring && minimumPrivatePackage ? <>
            <strong>From {formatRupiah(minimumPrivatePackage.priceAmount)}</strong>
            <span>{minimumPrivatePackage.durationMinutes} minutes per session · up to {minimumPrivatePackage.maxParticipants} participants</span>
          </> : isIntensiveMentoring && minimumIntensivePackage ? <>
            <strong>From {formatRupiah(Number(minimumIntensivePackage.priceAmount))}</strong>
            <span>{minimumIntensivePackage.sessionsPerMonth} sessions per month · international competition options available by consultation</span>
          </> : <>
            <strong>Commercial information is not available yet</strong>
            <span>Contact the Strativate team for the latest program information.</span>
          </>}
        </div>
        <div className="program-hero-actions">
          <a href="#packages" className="primary-cta" data-testid="program-packages-link">View packages <ArrowRight size={16} aria-hidden="true" /></a>
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="secondary-cta" data-testid="program-hero-whatsapp-link">Talk to us first</a>
        </div>
      </div>
      <aside className="detail-summary">
        <p className="kicker">Program overview</p>
        {program.highlights.map(fact => <div key={fact}><Check size={17} aria-hidden="true" /><span>{fact}</span></div>)}
      </aside>
    </section>

    <section className="program-audience" data-reveal>
      <Compass size={30} aria-hidden="true" />
      <div><p className="kicker">Who is it for?</p><h2>Start with your goal.</h2><p>{program.audience}</p></div>
    </section>

    {isPrivateMentoring && privateMentoringCatalog ? <>
      <section className="program-section" data-reveal data-testid="private-mentoring-learning-paths">
        <div className="program-section-heading"><p className="kicker">Learning Paths</p><h2>Two paths for different goals and starting points.</h2></div>
        <div className="program-comparison-grid">
          {privateMentoringCatalog.learningPaths.map(path => <article className="program-info-card" key={path.id}><h3>{path.name}</h3><p>{path.description}</p></article>)}
        </div>
      </section>
      <section className="program-section program-section--surface" data-reveal data-testid="private-mentoring-session-focuses">
        <div className="program-section-heading"><p className="kicker">Session topics</p><h2>One focused topic for every session.</h2></div>
        <div className="program-three-grid">
          {privateMentoringCatalog.sessionFocuses.map(focus => <article className="program-info-card" key={focus.id}><h3>{focus.name}</h3><p>{focus.description}</p></article>)}
        </div>
      </section>
    </> : null}

    <section className="program-section" data-reveal>
      <div className="program-section-heading"><p className="kicker">How it works</p><h2>From your goal to your next step.</h2></div>
      <ol className="program-journey">{program.journey.map((step, index) => <li key={step.title}><span className="program-step-number" aria-hidden="true">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol>
    </section>

    <section id="packages" className="program-section program-section--surface" data-reveal data-testid="program-packages-section">
      {isPrivateMentoring && packageGroups.length ? <>
        <div className="program-section-heading">
          <p className="kicker">Packages and pricing</p>
          <h2>Choose your session count, then share your needs.</h2>
          <p>Packages are available for individuals or teams of up to four participants. Per-session pricing is calculated from the active package.</p>
        </div>
        <div className="program-comparison-grid">
          {packageGroups.map(group => {
            const first = group.packages[0]
            return <article className={`program-price-table ${styles.privatePriceCard}`} key={group.tierId}>
              <div className="program-price-table-heading">
                <h3>{group.tierName}</h3>
                <p>{first.durationMinutes} minutes/session · max. {first.maxParticipants} participants</p>
              </div>
              <div className={styles.privatePriceScroll}>
                <table>
                  <thead><tr><th scope="col">Sessions</th><th scope="col">Total</th><th scope="col">Per session</th><th scope="col">Reference</th></tr></thead>
                  <tbody>{group.packages.map(item => <tr key={item.id} data-testid={`private-mentoring-package-${item.mentorTierCode.toLowerCase()}-${item.sessionCount}`}>
                    <th scope="row">{item.sessionCount}</th>
                    <td><strong>{formatRupiah(item.priceAmount)}</strong></td>
                    <td>{formatRupiah(item.pricePerSession)}/sesi</td>
                    <td>{item.referencePriceAmount ? <del>{formatRupiah(item.referencePriceAmount)}</del> : '—'}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </article>
          })}
        </div>
        <p className="program-pricing-note">After consultation, the Strativate team sends a Cart Link for the intended mentee. Cart and checkout continue to use Shared Commerce and the active package price.</p>
        <a href={whatsappHref} target="_blank" rel="noreferrer" className="primary-cta">Ask about packages on WhatsApp <ArrowRight size={16} aria-hidden="true" /></a>
      </> : isIntensiveMentoring && intensiveMentoringCatalog?.packages.length ? <>
        <div className="program-section-heading"><p className="kicker">Packages and pricing</p><h2>Choose support for your competition timeline.</h2><p>National competitions use fixed pricing. International competitions use a tailored plan after the initial consultation.</p></div>
        <div className={styles.catalogGrid} data-testid="intensive-mentoring-packages">
          {intensiveMentoringCatalog.packages.map(item => <article className={styles.catalogCard} key={item.id}>
            <div className={styles.catalogHeader}><span className={styles.badge}>{item.competitionScope === 'international' ? 'International Competition' : 'National Competition'}</span><h3>{item.name}</h3><p>{item.description}</p></div>
            {item.pricingMode === 'fixed' && item.priceAmount !== null ? <div className={styles.price}><strong>{formatRupiah(item.priceAmount)}</strong>{item.referencePriceAmount ? <del>{formatRupiah(item.referencePriceAmount)}</del> : null}<span>{item.sessionsPerMonth} sessions per month</span></div> : <div className={styles.price}><strong>Consultation required</strong><span>Scope and frequency are tailored to the competition requirements.</span></div>}
            {item.features.length ? <ul className={styles.featureList}>{item.features.map(feature => <li key={feature.id}>{feature.text}</li>)}</ul> : null}
            {item.pricingMode === 'consultation' ? <a href={whatsappHref} target="_blank" rel="noreferrer" className={styles.consultation}>Discuss your needs <ArrowRight size={14} aria-hidden="true" /></a> : null}
          </article>)}
        </div>
      </> : <div className={styles.fallback}><h3>Package information is not available right now.</h3><p>Contact the Strativate team for the latest program information and help choosing a mentoring format.</p></div>}
    </section>

    {isIntensiveMentoring && intensiveMentoringCatalog?.addOns.length ? <section className="program-section" data-reveal data-testid="intensive-mentoring-add-ons">
      <div className="program-section-heading"><p className="kicker">Optional add-ons</p><h2>Add support for your current needs.</h2><p>Choose additional evaluation or simulation support relevant to your preparation stage.</p></div>
      <div className={styles.catalogGrid}>{intensiveMentoringCatalog.addOns.map(item => <article className={styles.catalogCard} key={item.id}><div className={styles.catalogHeader}><h3>{item.name}</h3><p>{item.description}</p></div><div className={styles.price}><strong>+{formatRupiah(item.priceAmount)}</strong></div>{item.features.length ? <ul className={styles.featureList}>{item.features.map(feature => <li key={feature.id}>{feature.text}</li>)}</ul> : null}{item.termsNote ? <p className="program-pricing-note">{item.termsNote}</p> : null}</article>)}</div>
    </section> : null}

    {isIntensiveMentoring && intensiveMentoringCatalog?.bundles.length ? <section className="program-section program-section--surface" data-reveal data-testid="intensive-mentoring-bundles">
      <div className="program-section-heading"><p className="kicker">Best-value bundles</p><h2>Choose the combination that fits your goal.</h2><p>Active bundles combine mentoring packages and additional support in one choice.</p></div>
      <div className={styles.catalogGrid}>{intensiveMentoringCatalog.bundles.map(item => <article className={`${styles.catalogCard} ${item.badgeText ? styles.catalogCardFeatured : ''}`} key={item.id}>{item.badgeText ? <span className={styles.badge}>{item.badgeText}</span> : null}<div className={styles.catalogHeader}><h3>{item.name}</h3><p>{item.description}</p></div><div className={styles.price}><strong>{formatRupiah(item.priceAmount)}</strong></div>{item.items.length ? <ul className={styles.featureList}>{item.items.map(bundleItem => <li key={bundleItem.id}>{bundleItem.label}</li>)}</ul> : null}</article>)}</div>
    </section> : null}

    {categories.length ? <section className="program-section">
      <div className="program-section-heading"><p className="kicker">Competition categories</p><h2>Support across disciplines.</h2></div>
      <ul className="program-category-list">{categories.map(category => <li key={category}>{category}</li>)}</ul>
    </section> : null}

    <ProgramComparison />

    <section className="program-contact" data-reveal>
      <p className="kicker">Need help choosing?</p>
      <h2>Discuss your goal.</h2>
      <p>The Strativate team can explain the program options for your goal, preparation stage, and timeline.</p>
      <div className="program-contact-actions">
        <a href={whatsappHref} target="_blank" rel="noreferrer" className="primary-cta" data-testid="program-contact-whatsapp-link">Chat via WhatsApp <ArrowRight size={16} aria-hidden="true" /></a>
        <a href={publicContact.emailHref} className="back-link" data-testid="program-contact-email-link">{publicContact.email}</a>
      </div>
    </section>
  </main>
}
