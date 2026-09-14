import Link from 'next/link'

import { mentoringProgramEditorial, type ProgramEditorial } from '@/lib/program-information'

export function ProgramComparison({ products = mentoringProgramEditorial }: { products?: readonly ProgramEditorial[] }) {
  if (!products.length) return null

  return <section className="program-section" aria-labelledby="compare-programs">
    <div className="program-section-heading"><p className="kicker">Bandingkan pilihanmu</p><h2 id="compare-programs">Butuh sesi terarah atau pendampingan rutin?</h2><p>Pilih ritme yang paling sesuai dengan targetmu.</p></div>
    <div className="program-comparison-grid">{products.map((program) => (
      <article className="program-info-card" key={program.slug}>
        <p className="kicker">{program.slug === 'private-mentoring' ? 'Fleksibel sesuai kebutuhan' : 'Pendampingan berkelanjutan'}</p>
        <h3>{program.title}</h3>
        <p>{program.shortDescription}</p>
        <ul>{program.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
        <Link className="catalog-card-link" href={`/program/${program.slug}`} data-testid={`compare-${program.slug}-link`}>Jelajahi {program.title}</Link>
      </article>
    ))}</div>
  </section>
}
