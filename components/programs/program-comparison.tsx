import Link from 'next/link'
import { mentoringPrograms } from '@/lib/program-information'

export function ProgramComparison() {
  return <section className="program-section" aria-labelledby="compare-programs">
    <div className="program-section-heading"><p className="kicker">Find your fit</p><h2 id="compare-programs">Focused support or a structured journey?</h2><p>Both programs offer personalized mentoring. Choose the level of continuity that fits your goals.</p></div>
    <div className="program-comparison-grid">
      {mentoringPrograms.map(program => <article className="program-info-card" key={program.slug}>
        <p className="kicker">{program.slug === 'private-mentoring' ? 'On your schedule' : 'Consistent progress'}</p>
        <h3>{program.title}</h3><p>{program.description}</p>
        <ul>{program.highlights.map(item => <li key={item}>{item}</li>)}</ul>
        <Link className="catalog-card-link" href={`/program/${program.slug}`}>Explore {program.title}</Link>
      </article>)}
    </div>
  </section>
}
