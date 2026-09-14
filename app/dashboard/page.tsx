import { DashboardClient } from './dashboard-client'

import { listOwnedDigitalProducts } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'
import { getPublicPrivateMentoringCatalog, listMyPrivateMentoringSessions } from '@/lib/private-mentoring/server'

export default async function MenteeDashboard() {
  const digitalProductsEnabled = isDigitalProductsEnabled()
  const [ownedDigitalProducts, privateMentoringCatalog, privateMentoringSessions] = await Promise.all([
    digitalProductsEnabled ? listOwnedDigitalProducts() : Promise.resolve([]),
    getPublicPrivateMentoringCatalog(),
    listMyPrivateMentoringSessions(),
  ])
  return (
    <DashboardClient
      digitalProductsEnabled={digitalProductsEnabled}
      ownedDigitalProducts={ownedDigitalProducts}
      privateMentoringSessions={privateMentoringSessions}
      sessionFocuses={privateMentoringCatalog?.sessionFocuses ?? []}
    />
  )
}
