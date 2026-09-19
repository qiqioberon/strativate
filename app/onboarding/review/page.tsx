import { ArrowRight, CalendarDays, CheckCircle2, Pencil, School, Sparkles, UserRound, Waypoints } from 'lucide-react'
import { redirect } from 'next/navigation'
import { displayLabel } from '@/lib/labels'
import { getAccount } from '@/lib/auth/server'
import { OnboardingRouteLink, OnboardingRouteStage } from '@/components/onboarding/motion'
import { getGoogleConnectionStatus } from '@/lib/google-calendar/server'
import { createClient } from '@/lib/supabase/server'

function summarizeInterests(names: string[]) {
  if (names.length <= 4) return names.join(' · ')
  return names.slice(0, 4).join(' · ') + ' · +' + (names.length - 4) + ' lainnya'
}

function reviseHref(section: 'identity' | 'institution' | 'referral' | 'interests') {
  return '/onboarding?revisi=1&bagian=' + section
}

export default async function OnboardingReviewPage() {
  const account = await getAccount()
  if (!account) redirect('/auth')
  if (account.profile.role !== 'mentee') redirect(account.destination)
  if (!account.mentee?.onboarding_completed_at) redirect('/onboarding')

  const db = await createClient()
  const [connection, institution, selections, referral] = await Promise.all([
    getGoogleConnectionStatus(account.user.id),
    account.mentee.institution_id
      ? db.from('institutions').select('id,name,type,city').eq('id', account.mentee.institution_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from('mentee_interests').select('interest_id').eq('user_id', account.profile.id),
    account.mentee.referral_source_id
      ? db.from('referral_sources').select('id,name').eq('id', account.mentee.referral_source_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (institution.error || selections.error || referral.error) throw new Error('Ringkasan pendaftaran belum dapat dimuat.')

  const interestIds = (selections.data || []).map(item => item.interest_id)
  const interestResult = interestIds.length
    ? await db.from('interests').select('id,name').in('id', interestIds).order('sort_order').order('name')
    : { data: [], error: null }

  if (interestResult.error) throw new Error('Ringkasan minat belum dapat dimuat.')

  const name = [account.profile.first_name, account.profile.last_name].filter(Boolean).join(' ')
  const interests = (interestResult.data || []).map(item => displayLabel(item.name))
  const referralText = referral.data?.name
    ? displayLabel(referral.data.name)
    : account.mentee.referral_other_text || 'Belum tersedia'

  return <OnboardingRouteStage scene="review">
    <section className="onboarding-review">
      <div className="onboarding-review__intro">
        <div className="onboarding-review__symbol" aria-hidden="true"><CheckCircle2 size={28} /></div>
        <p className="onboarding-eyebrow">Pengecekan akhir</p>
        <h1>Sebelum masuk, periksa sebentar.</h1>
        <p>Pastikan semuanya sudah sesuai. Kalau ada yang ingin diubah, kamu masih bisa merevisinya tanpa mengulang dari awal.</p>
      </div>

      <div className="onboarding-review__grid" aria-label="Ringkasan data onboarding">
        <article className="onboarding-review__item">
          <span className="onboarding-review__icon" aria-hidden="true"><UserRound size={18} /></span>
          <div>
            <small>Profil akun</small>
            <strong>{name || account.profile.username || 'Profil Strativate'}</strong>
            <p>@{account.profile.username}</p>
          </div>
          <OnboardingRouteLink href={reviseHref('identity')} className="onboarding-review__edit"><Pencil size={14} aria-hidden="true" /> Ubah</OnboardingRouteLink>
        </article>

        <article className="onboarding-review__item">
          <span className="onboarding-review__icon" aria-hidden="true"><School size={18} /></span>
          <div>
            <small>Tempat belajar</small>
            <strong>{institution.data?.name || 'Belum tersedia'}</strong>
            <p>{[account.mentee.major_or_faculty, account.mentee.cohort_year ? 'Angkatan ' + account.mentee.cohort_year : null].filter(Boolean).join(' · ') || 'Detail tambahan belum diisi'}</p>
          </div>
          <OnboardingRouteLink href={reviseHref('institution')} className="onboarding-review__edit"><Pencil size={14} aria-hidden="true" /> Ubah</OnboardingRouteLink>
        </article>

        <article className="onboarding-review__item">
          <span className="onboarding-review__icon" aria-hidden="true"><Waypoints size={18} /></span>
          <div>
            <small>Menemukan Strativate dari</small>
            <strong>{referralText}</strong>
          </div>
          <OnboardingRouteLink href={reviseHref('referral')} className="onboarding-review__edit"><Pencil size={14} aria-hidden="true" /> Ubah</OnboardingRouteLink>
        </article>

        <article className="onboarding-review__item">
          <span className="onboarding-review__icon" aria-hidden="true"><Sparkles size={18} /></span>
          <div>
            <small>Minat yang ingin dieksplor</small>
            <strong>{interests.length ? summarizeInterests(interests) : 'Belum tersedia'}</strong>
          </div>
          <OnboardingRouteLink href={reviseHref('interests')} className="onboarding-review__edit"><Pencil size={14} aria-hidden="true" /> Ubah</OnboardingRouteLink>
        </article>

        <article className="onboarding-review__item onboarding-review__item--calendar">
          <span className="onboarding-review__icon" aria-hidden="true"><CalendarDays size={18} /></span>
          <div>
            <small>Google Calendar</small>
            <strong>{connection.connected ? 'Terhubung' : 'Tidak dihubungkan'}</strong>
            {connection.connected && connection.accountEmail ? <p>{connection.accountEmail}</p> : <p>Opsional, bisa diatur kapan saja.</p>}
          </div>
          <span className="onboarding-review__meta">{connection.connected ? 'Kelola nanti di dashboard' : 'Bisa dihubungkan nanti dari dashboard'}</span>
        </article>
      </div>


      <div className="onboarding-review__actions">
        <OnboardingRouteLink className="onboarding-primary-action" href="/auth/continue" finalMessage={'Semua siap, ' + (account.profile.first_name || 'kamu') + '.'}>Semua sudah benar, masuk Strativate <ArrowRight aria-hidden="true" size={17} /></OnboardingRouteLink>
        <p>Kamu tetap bisa mengubah sebagian informasi dari dashboard nanti.</p>
      </div>
    </section>
  </OnboardingRouteStage>
}
