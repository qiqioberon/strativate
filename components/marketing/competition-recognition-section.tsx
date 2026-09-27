import type { CompetitionRecognitionView } from '@/lib/marketing/competition-recognitions'

const MINIMUM_LOGOS_PER_CYCLE = 12
const MINIMUM_LOGOS_FOR_TWO_ROWS = 12

function RecognitionLogo({
  recognition,
  hidden = false,
  instance,
}: {
  recognition: CompetitionRecognitionView
  hidden?: boolean
  instance: string
}) {
  return (
    <span className="homepage-recognition__logo" aria-hidden={hidden || undefined}>
      {/* Supabase owns these admin-uploaded public assets, so native images accept any configured project hostname. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={recognition.logoUrl}
        alt={hidden ? '' : recognition.competition_name}
        width={220}
        height={96}
        loading="lazy"
        draggable={false}
        tabIndex={-1}
        data-recognition-id={recognition.id}
        data-recognition-instance={instance}
      />
    </span>
  )
}

function RecognitionCycle({
  recognitions,
  isDuplicate = false,
}: {
  recognitions: CompetitionRecognitionView[]
  isDuplicate?: boolean
}) {
  const repetitionCount = Math.ceil(MINIMUM_LOGOS_PER_CYCLE / recognitions.length)

  return (
    <div className="homepage-recognition__logo-cycle" aria-hidden={isDuplicate || undefined}>
      {Array.from({ length: repetitionCount }, (_, repetition) => (
        recognitions.map((recognition) => (
          <RecognitionLogo
            key={`${recognition.id}-${repetition}`}
            recognition={recognition}
            hidden={isDuplicate || repetition > 0}
            instance={`${isDuplicate ? 'duplicate' : 'source'}-${repetition}`}
          />
        ))
      ))}
    </div>
  )
}

function RecognitionRow({
  recognitions,
  reverse = false,
}: {
  recognitions: CompetitionRecognitionView[]
  reverse?: boolean
}) {
  const directionClass = reverse
    ? 'homepage-recognition__logo-row--reverse'
    : 'homepage-recognition__logo-row--forward'

  return (
    <div
      className={`homepage-recognition__logo-row ${directionClass}`}
      data-direction={reverse ? 'reverse' : 'forward'}
    >
      <div className="homepage-recognition__logo-track">
        <RecognitionCycle recognitions={recognitions} />
        <RecognitionCycle recognitions={recognitions} isDuplicate />
      </div>
    </div>
  )
}

export function CompetitionRecognitionSection({
  recognitions,
}: {
  recognitions: CompetitionRecognitionView[]
}) {
  const usesTwoRows = recognitions.length >= MINIMUM_LOGOS_FOR_TWO_ROWS
  const firstRow = usesTwoRows
    ? recognitions.filter((_recognition, index) => index % 2 === 0)
    : recognitions
  const secondRow = usesTwoRows
    ? recognitions.filter((_recognition, index) => index % 2 === 1)
    : []

  return (
    <section
      className="homepage-recognition"
      aria-labelledby="homepage-recognition-heading"
      data-testid="homepage-recognition-section"
    >
      <div className="homepage-recognition__statement">
        <div className="marketing-container homepage-recognition__inner">
          <h2 id="homepage-recognition-heading">
            Our mentors and students are award-winning business competition finalists.
          </h2>
        </div>
      </div>

      {recognitions.length > 0 ? (
        <div className="homepage-recognition__logos" data-testid="homepage-recognition-logo-section">
          {recognitions.length === 1 ? (
            <div
              className="homepage-recognition__logo-wall homepage-recognition__logo-wall--static"
              data-testid="homepage-recognition-logo-wall"
            >
              <RecognitionLogo recognition={recognitions[0]} instance="static" />
            </div>
          ) : (
            <>
              <div
                className={`homepage-recognition__logo-wall homepage-recognition__logo-wall--animated${usesTwoRows ? ' homepage-recognition__logo-wall--two-rows' : ''}`}
                data-testid="homepage-recognition-logo-wall"
              >
                <RecognitionRow recognitions={firstRow} />
                {secondRow.length ? <RecognitionRow recognitions={secondRow} reverse /> : null}
              </div>
              <div className="homepage-recognition__reduced-grid">
                {recognitions.map((recognition) => (
                  <RecognitionLogo
                    key={recognition.id}
                    recognition={recognition}
                    instance="reduced"
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
