import { Focus, Repeat2, Waypoints } from 'lucide-react'

import { BrandLogo } from '@/components/brand/brand-logo'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { homepageExpertise, preparationPrinciples } from '@/lib/content/marketing-content'

const icons = [Focus, Waypoints, Repeat2]

export default function AboutPage() {
  return (
    <MarketingShell>
      <main className="about-reference-page">
        <section className="marketing-section about-reference-hero" data-reveal data-testid="about-story-section">
          <div className="marketing-container about-reference-hero__grid">
            <div><p className="marketing-kicker">About Us</p><h1>Empowering Future<br /><em>Business Leaders.</em></h1><p>Strativate is a business mentoring and coaching platform that supports students in building future-ready skills and achieving success in business competitions and future career pathways.</p><p>Through structured learning, hands-on practice, and personalized guidance, we help students strengthen the skills needed for competition preparation.</p></div>
            <div className="about-reference-visual" role="img" aria-label="Strativate editorial image placeholder"><BrandLogo variant="mark" priority /><span>Editorial image slot</span></div>
          </div>
        </section>

        <section className="marketing-section about-reference-mission" data-reveal data-testid="about-vision-mission-section">
          <div className="marketing-container">
            <div className="about-reference-vision"><span></span><p className="marketing-kicker">Our Vision</p><h2>To become a youth acceleration platform that equips the next generation with future skills, business literacy, and financial intelligence to thrive in an ever-evolving global workforce.</h2></div>
            <div className="marketing-section-head"><div><p className="marketing-kicker">Our Mission</p><h2>Practical learning that helps students keep moving forward.</h2></div></div>
            <div className="marketing-about-page__principles about-reference-mission__grid">{preparationPrinciples.map((principle, index) => { const Icon = icons[index]; return <article key={principle.number}><Icon aria-hidden="true" size={22} /><span>{principle.number}</span><h3>{principle.title}</h3><p>{principle.description}</p></article> })}</div>
          </div>
        </section>

        <section className="marketing-section stakeholder-expertise about-reference-expertise" data-reveal data-testid="about-expertise-section">
          <div className="marketing-container"><div className="marketing-section-head"><div><p className="marketing-kicker">Our Expertise</p><h2>What We <em>Specialize In</em></h2></div><p className="marketing-section-head__copy">Coaching across major business competition categories, helping students develop practical skills for each challenge.</p></div><div className="stakeholder-expertise-grid">{homepageExpertise.map((item, index) => <article key={item.title}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></div>
        </section>
      </main>
    </MarketingShell>
  )
}
