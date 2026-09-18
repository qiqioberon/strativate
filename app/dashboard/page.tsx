import { DashboardClient } from './dashboard-client'

import { getActiveCart, listOwnedDigitalProducts, listUserOrders } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'
import { getPublicPrivateMentoringCatalog, listMyIntensiveMentoringEntitlements, listMyPrivateMentoringSessions } from '@/lib/private-mentoring/server'

export default async function MenteeDashboard() {
  const digitalProductsEnabled = isDigitalProductsEnabled()
  const [ownedDigitalProducts, cart, commerceOrders, privateMentoringCatalog, privateMentoringSessions, intensiveMentoringEntitlements] = await Promise.all([
    digitalProductsEnabled ? listOwnedDigitalProducts() : Promise.resolve([]),
    getActiveCart(),
    listUserOrders(),
    getPublicPrivateMentoringCatalog(),
    listMyPrivateMentoringSessions(),
    listMyIntensiveMentoringEntitlements(),
  ])

  return (
    <DashboardClient
      digitalProductsEnabled={digitalProductsEnabled}
      ownedDigitalProducts={ownedDigitalProducts}
      cart={cart}
      commerceOrders={commerceOrders}
      privateMentoringSessions={privateMentoringSessions}
      intensiveMentoringEntitlements={intensiveMentoringEntitlements}
      sessionFocuses={privateMentoringCatalog?.sessionFocuses ?? []}
    />
  )
}
