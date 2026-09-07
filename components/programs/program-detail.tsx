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
    <p className="program-pricing-note">Every session lasts 75 minutes. The same package price applies to an individual or a team of 1–4 participants.</p>
    <div className="program-comparison-grid">
      {privateMentorTiers.map(tier => <article className="program-price-table" key={tier.name}>
        <div className="program-price-table-heading"><Users size={22} aria-hidden="true" /><h3>{tier.name}</h3><p>{tier.description}</p></div>
        <table>
          <caption className="sr-only">{tier.name} packages</caption>
          <thead><tr><th scope="col">Sessions</th><th scope="col">Per session</th><th scope="col">Package total</th></tr></thead>
          <tbody>{tier.packages.map(item => <tr key={item.sessions}>
            <th scope="row">{item.sessions} {item.sessions === 1 ? 'session' : 'sessions'}</th>
            <td>{formatRupiah(item.perSession)}</td><td><strong>{formatRupiah(item.total)}</strong></td>
          </tr>)}</tbody>
        </table>
        <p className="program-table-note">Flexible scheduling · Choose your mentor</p>
      </article>)}
    </div>
  </>
}

function IntensivePackages() {
  return <div className="program-three-grid">
    {intensivePackages.map(item => <article className="program-info-card program-package" key={item.name}>
      <p className="kicker">National competition</p><h3>{item.name}</h3><p className="program-session-count">{item.sessions} sessions per month</p>
      <p className="program-package-price">{formatRupiah(item.price)}</p>
      <p className="program-normal-price">Normal price <s>{formatRupiah(item.normalPrice)}</s></p>
      <p>{item.description}</p><FeatureList items={item.features} />
    </article>)}
    <article className="program-info-card program-package program-custom-package">
      <p className="kicker">International competition</p><h3>Fully customized</h3><p className="program-session-count">Scope and frequency tailored to your needs</p>
      <p className="program-package-price program-consultation-label">By consultation</p>
      <p>Each international competition requires a different approach. The mentoring plan is customized after an initial consultation.</p>
      <FeatureList items={['Competition-specific preparation plan', 'Customized scope and session frequency', 'Mentor matching based on competition needs', 'Focused support throughout preparation']} />
    </article>
  </div>
}

function IntensiveExtras() {
  return <>
    <section id="add-ons" className="program-section">
      <div className="program-section-heading"><p className="kicker">Optional program add-ons</p><h2>More support where you need it.</h2><p>Additional evaluation, simulation, or outcome-based protection alongside your main package.</p></div>
      <div className="program-three-grid">{intensiveAddOns.map(item => <article className="program-info-card" key={item.name}>
        <h3>{item.name}</h3><p className="program-extra-price">+{formatRupiah(item.price)}</p><p>{item.description}</p><FeatureList items={item.features} />
        {item.conditional && <p className="program-conditions">{guaranteeConditions}</p>}
      </article>)}</div>
    </section>
    <section className="program-section" aria-labelledby="bundle-heading">
      <div className="program-section-heading"><p className="kicker">Combined support</p><h2 id="bundle-heading">Packages built around your goal.</h2><p>Compare the combinations included in each mentoring bundle.</p></div>
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
    <nav className="program-breadcrumb" aria-label="Breadcrumb"><Link href="/" className="back-link">Strativate</Link><Link href="/explore" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Explore programs</Link></nav>
    <section className="detail-hero">
      <div><p className="kicker">{program.kicker}</p><h1>{program.title}</h1><p className="detail-lede">{program.detail}</p>
        <div className="detail-price"><strong>{program.priceLabel}</strong><span>{program.priceContext}</span></div>
        <a href="#packages" className="primary-cta">View packages <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <aside className="detail-summary"><p className="kicker">At a glance</p>{program.facts.map(fact => <div key={fact}><Check size={17} aria-hidden="true" /><span>{fact}</span></div>)}</aside>
    </section>

    <section className="program-audience"><Compass size={30} aria-hidden="true" /><div><p className="kicker">Is this for you?</p><h2>Start from where you are.</h2><p>{program.audience}</p></div></section>

    {isPrivate && <>
      <section className="program-section"><div className="program-section-heading"><p className="kicker">Two learning paths</p><h2>Build your foundation. Focus on your target.</h2></div><div className="program-comparison-grid">{privateLearningPaths.map(path => <article className="program-info-card" key={path.title}><h3>{path.title}</h3><p>{path.description}</p></article>)}</div></section>
      <section className="program-section"><div className="program-section-heading"><p className="kicker">Session focus</p><h2>Work on what matters most.</h2><p>Focus on one priority per session for clear feedback and actionable next steps. Custom topics can be discussed during consultation.</p></div><div className="program-three-grid">{privateTopics.map(topic => <article className="program-info-card" key={topic.title}><h3>{topic.title}</h3><p>{topic.description}</p></article>)}</div></section>
    </>}

    <section className="program-section"><div className="program-section-heading"><p className="kicker">What you will get</p><h2>{isPrivate ? 'Focused sessions. Practical insights.' : 'Steady guidance. Visible progress.'}</h2></div><FeatureList items={program.outcomes} /></section>
    <section className="program-section"><div className="program-section-heading"><p className="kicker">How it works</p><h2>Your mentoring journey.</h2></div><ol className="program-journey">{program.journey.map((step, index) => <li key={step.title}><span className="program-step-number" aria-hidden="true">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol></section>
    <section id="packages" className="program-section"><div className="program-section-heading"><p className="kicker">Packages & pricing</p><h2>{isPrivate ? 'Choose your mentor. Set your pace.' : 'Choose your level of support.'}</h2></div>{isPrivate ? <PrivatePackages /> : <IntensivePackages />}</section>
    {!isPrivate && <IntensiveExtras />}
    <section className="program-section"><div className="program-section-heading"><p className="kicker">Competition categories</p><h2>Support across disciplines.</h2></div><ul className="program-category-list">{competitionCategories.map(category => <li key={category}>{category}</li>)}</ul></section>
    <ProgramComparison />
    <section className="program-contact"><p className="kicker">Need help choosing?</p><h2>Talk through your goals.</h2><p>The Strativate team can explain the options and recommend support for your goals, preparation stage, and timeline.</p><p className="program-contact-details">+62 851-8775-4671 <span aria-hidden="true">·</span> strativateid@gmail.com</p><Link href="/explore" className="back-link">Back to all programs <ArrowRight size={16} aria-hidden="true" /></Link></section>
  </main>
}
