'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseMentorInvitationInput } from './mentor-invitation-input'

export async function inviteMentor(emailInput: string, tierIdInput: string): Promise<{ error?: string; success?: string }> {
  const parsed = parseMentorInvitationInput(emailInput, tierIdInput)
  if ('error' in parsed) return parsed
  const { email, tierId } = parsed
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'Please sign in again.' }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return { error: 'Only admins can invite mentors.' }
    const base = process.env.APP_URL
    if (!base || !/^https?:\/\//.test(base)) return { error: 'The application URL has not been configured.' }
    const admin = createAdminClient()
    const { data: tier, error: tierError } = await admin.from('mentor_tiers').select('id').eq('id', tierId).eq('is_active', true).maybeSingle()
    if (tierError || !tier) return { error: 'Select an active mentor tier.' }
    const { error: registryError } = await admin.from('mentor_invites').insert({ email, invited_by: user.id, status: 'pending', tier_id: tierId })
    if (registryError) {
      if (registryError.code !== '23505') return { error: 'Unable to prepare the invitation. Please try again.' }
      // Claim a failed invitation atomically. Sent/in-flight invitations cannot be duplicated.
      const { data: retry, error } = await admin.from('mentor_invites').update({ status: 'pending', invited_by: user.id, tier_id: tierId }).eq('email', email).eq('status', 'failed').is('user_id', null).select('email').maybeSingle()
      if (error || !retry) return { error: 'An invitation for this email has already been sent or is being processed.' }
    }
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: new URL('/auth/callback', base).href })
    if (error || !data.user) {
      await admin.from('mentor_invites').update({ status: 'failed' }).eq('email', email).eq('status', 'pending')
      return { error: 'Unable to send the invitation. Check email settings or use an email without an active account.' }
    }
    const [{ data: invitedProfile, error: profileError }, { data: mentorProfile, error: mentorProfileError }] = await Promise.all([
      admin.from('profiles').select('role').eq('id', data.user.id).single(),
      admin.from('mentor_profiles').select('tier_id').eq('user_id', data.user.id).single(),
    ])
    if (profileError || mentorProfileError || invitedProfile?.role !== 'mentor' || mentorProfile?.tier_id !== tierId) {
      return { error: 'Email processed, but the mentor account tier is unconfirmed. Contact an administrator before trying again.' }
    }
    const { error: sentError } = await admin.from('mentor_invites').update({ status: 'sent' }).eq('email', email).eq('user_id', data.user.id)
    if (sentError) return { error: 'Invitation sent, but its status could not be saved. Refresh the list before trying again.' }
    return { success: 'Mentor invitation sent.' }
  } catch { return { error: 'The invitation service is unavailable. Check server settings and try again.' } }
}
