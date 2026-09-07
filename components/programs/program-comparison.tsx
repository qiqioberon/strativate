import Link from 'next/link'
import { mentoringPrograms } from '@/lib/program-information'

export function ProgramComparison() {
  return <section className="program-section" aria-labelledby="compare-programs">
    <div className="program-section-heading"><p className="kicker">Temukan program yang sesuai</p><h2 id="compare-programs">Bimbingan terarah atau proses belajar terstruktur?</h2><p>Kedua program menawarkan mentoring sesuai kebutuhanmu. Pilih kesinambungan bimbingan yang sesuai dengan tujuanmu.</p></div>
    <div className="program-comparison-grid">
      {mentoringPrograms.map(program => <article className="program-info-card" key={program.slug}>
        <p className="kicker">{program.slug === 'private-mentoring' ? 'Sesuai jadwalmu' : 'Perkembangan konsisten'}</p>
        <h3>{program.title}</h3><p>{program.description}</p>
        <ul>{program.highlights.map(item => <li key={item}>{item}</li>)}</ul>
        <Link className="catalog-card-link" href={`/program/${program.slug}`}>Jelajahi {program.title}</Link>
      </article>)}
    </div>
  </section>
}
