import { DashboardClient } from './dashboard-client'

import { getActiveCart, listOwnedDigitalProducts, listUserOrders } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'
import { getPublicPrivateMentoringCatalog, listMyPrivateMentoringSessions } from '@/lib/private-mentoring/server'
import { listMyIntensiveMentoringEngagements } from '@/lib/intensive-mentoring/server'

export default async function MenteeDashboard() {
  const digitalProductsEnabled = isDigitalProductsEnabled()
  const [ownedDigitalProducts, cart, commerceOrders, privateMentoringCatalog, privateMentoringSessions, intensiveMentoringEngagements] = await Promise.all([
    digitalProductsEnabled ? listOwnedDigitalProducts() : Promise.resolve([]),
    getActiveCart(),
    listUserOrders(),
    getPublicPrivateMentoringCatalog(),
    listMyPrivateMentoringSessions(),
    listMyIntensiveMentoringEngagements(),
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
    />
  )
}
