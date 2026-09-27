import type { CompetitionRecognitionView } from '@/lib/marketing/competition-recognitions'

export function CompetitionRecognitionSection({
  recognitions,
}: {
  recognitions: CompetitionRecognitionView[]
}) {
  return (
    <section
      className="homepage-recognition"
      aria-labelledby="homepage-recognition-heading"
      data-testid="homepage-recognition-section"
    >
      <div className="marketing-container homepage-recognition__inner">
        <h2 id="homepage-recognition-heading">
          Our mentors and students are award-winning business competition finalists.
        </h2>
        {recognitions.length > 0 ? (
          <div className="homepage-recognition__logo-wall" data-testid="homepage-recognition-logo-wall">
            {recognitions.map((recognition) => (
              // Supabase owns these admin-uploaded public assets, so native images accept any configured project hostname.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={recognition.id}
                src={recognition.logoUrl}
                alt={recognition.competition_name}
                width={220}
                height={96}
                loading="lazy"
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
