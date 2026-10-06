import { CompetitionRecognitionSection } from '../../../../../components/marketing/competition-recognition-section'
import { TrustedPartnersSection } from '../../../../../components/marketing/trusted-partners-section'

// Synthetic records exercise the real public sections without publishing stakeholder claims.
const logoUrl = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="100%" height="100%" fill="#de6b31"/></svg>')}`
const recognitions = Array.from({ length: 12 }, (_, index) => ({
  id: `recognition-${index}`, competition_name: `Fixture competition ${index}`, display_order: index, logoUrl,
}))
const partners = Array.from({ length: 9 }, (_, index) => ({
  id: `partner-${index}`, organization_name: `Fixture organization ${index}`, display_order: index, logoUrl,
}))

export default function MarketingImagesFixture() {
  return <main className="marketing-site">
    <CompetitionRecognitionSection recognitions={recognitions} />
    <TrustedPartnersSection partners={partners} />
  </main>
}
