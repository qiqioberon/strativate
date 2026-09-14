export type DigitalPurchaseMode = 'anonymous' | 'mentee' | 'unavailable'

type PurchaseAccount = {
  profile: { role: string }
  mentee: { onboarding_completed_at: string | null } | null
}

export function resolveDigitalPurchaseMode(
  account: PurchaseAccount | null | undefined,
): DigitalPurchaseMode {
  if (!account) return 'anonymous'
  if (
    account.profile.role === 'mentee'
    && account.mentee?.onboarding_completed_at
  ) return 'mentee'
  return 'unavailable'
}
