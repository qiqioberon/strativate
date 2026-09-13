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
    if (userError || !user) return { error: 'Silakan masuk kembali.' }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return { error: 'Hanya admin yang dapat mengundang mentor.' }
    const base = process.env.APP_URL
    if (!base || !/^https?:\/\//.test(base)) return { error: 'URL aplikasi belum dikonfigurasi oleh administrator.' }
    const admin = createAdminClient()
    const { data: tier, error: tierError } = await admin.from('mentor_tiers').select('id').eq('id', tierId).eq('is_active', true).maybeSingle()
    if (tierError || !tier) return { error: 'Pilih tier mentor yang aktif.' }
    const { error: registryError } = await admin.from('mentor_invites').insert({ email, invited_by: user.id, status: 'pending', tier_id: tierId })
    if (registryError) {
      if (registryError.code !== '23505') return { error: 'Undangan belum dapat disiapkan. Coba lagi.' }
      // Claim a failed invitation atomically. Sent/in-flight invitations cannot be duplicated.
      const { data: retry, error } = await admin.from('mentor_invites').update({ status: 'pending', invited_by: user.id, tier_id: tierId }).eq('email', email).eq('status', 'failed').is('user_id', null).select('email').maybeSingle()
      if (error || !retry) return { error: 'Undangan sudah dikirim atau sedang diproses untuk email ini.' }
    }
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: new URL('/auth/callback', base).href })
    if (error || !data.user) {
      await admin.from('mentor_invites').update({ status: 'failed' }).eq('email', email).eq('status', 'pending')
      return { error: 'Undangan gagal dikirim. Periksa konfigurasi email atau gunakan alamat yang belum memiliki akun aktif.' }
    }
    const [{ data: invitedProfile, error: profileError }, { data: mentorProfile, error: mentorProfileError }] = await Promise.all([
      admin.from('profiles').select('role').eq('id', data.user.id).single(),
      admin.from('mentor_profiles').select('tier_id').eq('user_id', data.user.id).single(),
    ])
    if (profileError || mentorProfileError || invitedProfile?.role !== 'mentor' || mentorProfile?.tier_id !== tierId) {
      return { error: 'Email diproses, tetapi tier akun mentor belum terkonfirmasi. Hubungi administrator sebelum mencoba lagi.' }
    }
    const { error: sentError } = await admin.from('mentor_invites').update({ status: 'sent' }).eq('email', email).eq('user_id', data.user.id)
    if (sentError) return { error: 'Undangan dikirim, tetapi statusnya belum tersimpan. Muat ulang daftar sebelum mengulang.' }
    return { success: 'Undangan mentor telah dikirim.' }
  } catch { return { error: 'Layanan undangan belum tersedia. Periksa konfigurasi server dan coba lagi.' } }
}
