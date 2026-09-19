import { redirect } from 'next/navigation'
import { OnboardingWizard } from '@/components/onboarding/wizard'
import { OnboardingRouteStage } from '@/components/onboarding/motion'
import type { RevisionTarget } from '@/components/onboarding/types'
import { getAccount } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { onboardingNameDefaults } from '@/lib/onboarding/rules'

const revisionTargets = new Set<RevisionTarget>(['identity', 'institution', 'referral', 'interests'])

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ revisi?: string; bagian?: string }> }) {
  const account = await getAccount()
  if (!account) redirect('/auth')
  if (account.profile.role !== 'mentee') redirect(account.destination)
  if (!account.mentee) throw new Error('Profil onboarding belum tersedia.')

  const params = await searchParams
  const requestedTarget = params.bagian as RevisionTarget | undefined
  const revisionTarget = account.mentee.onboarding_completed_at && params.revisi === '1' && requestedTarget && revisionTargets.has(requestedTarget)
    ? requestedTarget
    : null

  if (account.mentee.onboarding_completed_at && !revisionTarget) redirect(account.destination)

  const db = await createClient()
  const [referrals, interests, selections, institution] = await Promise.all([
    db.from('referral_sources').select('*').eq('is_active', true).order('sort_order').order('name'),
    db.from('interests').select('*').eq('is_active', true).order('sort_order').order('name'),
    db.from('mentee_interests').select('interest_id').eq('user_id', account.profile.id),
    account.mentee.institution_id
      ? db.from('institutions').select('*').eq('id', account.mentee.institution_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (referrals.error || interests.error || selections.error || institution.error) {
    throw new Error('Data pendaftaran belum dapat dimuat.')
  }

  return <OnboardingRouteStage>
    <OnboardingWizard
      profile={account.profile}
      mentee={account.mentee}
      names={onboardingNameDefaults(account.profile, account.user.user_metadata)}
      referrals={referrals.data || []}
      interests={interests.data || []}
      initialInterests={(selections.data || []).map(item => item.interest_id)}
      initialInstitution={institution.data}
      revisionTarget={revisionTarget}
      reviewReturnPath={revisionTarget ? '/onboarding/review' : null}
    />
  </OnboardingRouteStage>
}
