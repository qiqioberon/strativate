import { DashboardClient } from './dashboard-client'

import { getActiveCart, listOwnedDigitalProducts, listUserOrders } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'
import { getPublicPrivateMentoringCatalog, listMyPrivateMentoringSessions } from '@/lib/private-mentoring/server'
import { listMyIntensiveMentoringEngagements } from '@/lib/intensive-mentoring/server'
import { getMenteeCommunityStats } from '@/lib/mentee/community-stats'

export default async function MenteeDashboard() {
  const digitalProductsEnabled = isDigitalProductsEnabled()
  const [ownedDigitalProducts, cart, commerceOrders, privateMentoringCatalog, privateMentoringSessions, intensiveMentoringEngagements, communityStatsResult] = await Promise.all([
    digitalProductsEnabled ? listOwnedDigitalProducts() : Promise.resolve([]),
    getActiveCart(),
    listUserOrders(),
    getPublicPrivateMentoringCatalog(),
    listMyPrivateMentoringSessions(),
    listMyIntensiveMentoringEngagements(),
    getMenteeCommunityStats(),
  ])

  return (
    <DashboardClient
      digitalProductsEnabled={digitalProductsEnabled}
      ownedDigitalProducts={ownedDigitalProducts}
      cart={cart}
      commerceOrders={commerceOrders}
      privateMentoringSessions={privateMentoringSessions}
      intensiveMentoringEngagements={intensiveMentoringEngagements}
      sessionFocuses={privateMentoringCatalog?.sessionFocuses ?? []}
      communityStats={communityStatsResult.stats}
      communityStatsAvailable={communityStatsResult.available}
    />
  )
}
