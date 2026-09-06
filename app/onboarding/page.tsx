import { AuthShell } from '@/components/auth/auth-shell'
import { SignOut } from '@/components/auth/sign-out'
import { OnboardingWizard } from '@/components/onboarding/wizard'
import { requireAccount } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { onboardingNameDefaults } from '@/lib/onboarding/rules'

export default async function OnboardingPage() {
  const { profile, mentee, user } = await requireAccount('/onboarding')
  if (!mentee) throw new Error('Profil onboarding belum tersedia.')
  const db = await createClient()
  const [referrals, interests, selections, institution] = await Promise.all([
    db.from('referral_sources').select('*').eq('is_active', true).order('sort_order').order('name'),
    db.from('interests').select('*').eq('is_active', true).order('sort_order').order('name'),
    db.from('mentee_interests').select('interest_id').eq('user_id', profile.id),
    mentee.institution_id ? db.from('institutions').select('*').eq('id', mentee.institution_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  if (referrals.error || interests.error || selections.error || institution.error) throw new Error('Data pendaftaran belum dapat dimuat.')
  return <AuthShell><OnboardingWizard profile={profile} mentee={mentee}
    names={onboardingNameDefaults(profile, user.user_metadata)}
    referrals={referrals.data || []} interests={interests.data || []}
    initialInterests={(selections.data || []).map(item => item.interest_id)} initialInstitution={institution.data} />
    <SignOut className="auth-back" /></AuthShell>
}
