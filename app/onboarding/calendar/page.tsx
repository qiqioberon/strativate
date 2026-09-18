import Link from 'next/link'
import { ArrowRight, CalendarDays, Check, CheckCircle2 } from 'lucide-react'
import { redirect } from 'next/navigation'
import { OnboardingShell } from '@/components/onboarding/shell'
import { displayLabel } from '@/lib/labels'
import { getAccount } from '@/lib/auth/server'
import { getGoogleConnectionStatus } from '@/lib/google-calendar/server'
import { createClient } from '@/lib/supabase/server'

function summarizeInterests(names: string[]) {
  if (names.length <= 3) return names.join(' · ')
  return names.slice(0, 3).join(' · ') + ' · +' + (names.length - 3) + ' lainnya'
}

export default async function CalendarOnboardingPage({ searchParams }: { searchParams: Promise<{ calendar?: string; reason?: string }> }) {
  const account = await getAccount()
  if (!account) redirect('/auth')
  if (account.profile.role !== 'mentee') redirect(account.destination)
  if (!account.mentee?.onboarding_completed_at) redirect('/onboarding')

  const params = await searchParams
  const db = await createClient()
  const [connection, institution, selections] = await Promise.all([
    getGoogleConnectionStatus(account.user.id),
    account.mentee.institution_id
      ? db.from('institutions').select('id,name').eq('id', account.mentee.institution_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from('mentee_interests').select('interest_id').eq('user_id', account.profile.id),
  ])

  if (institution.error || selections.error) throw new Error('Ringkasan pendaftaran belum dapat dimuat.')

  const interestIds = (selections.data || []).map(item => item.interest_id)
  const interestResult = interestIds.length
    ? await db.from('interests').select('id,name').in('id', interestIds).order('sort_order').order('name')
    : { data: [], error: null }

  if (interestResult.error) throw new Error('Ringkasan minat belum dapat dimuat.')

  const firstName = account.profile.first_name?.trim()
  const interests = (interestResult.data || []).map(item => displayLabel(item.name))
  const major = account.mentee.major_or_faculty?.trim()

  return <OnboardingShell>
    <section className="onboarding-finale">
      <div className="onboarding-finale__check" aria-hidden="true"><CheckCircle2 size={34} /></div>
      <p className="onboarding-eyebrow">Semua data utama tersimpan</p>
      <h1>Semua sudah siap{firstName ? ', ' + firstName : ''}.</h1>
      <p className="onboarding-finale__lead">Kami sudah mengenalmu sedikit lebih baik.</p>

      <div className="onboarding-finale__identity" aria-label="Ringkasan pendaftaran">
        {institution.data && <p><strong>{institution.data.name}</strong>{major ? <span>{major}</span> : null}</p>}
        {interests.length > 0 && <p className="onboarding-finale__interests">{summarizeInterests(interests)}</p>}
      </div>

      <div className="onboarding-calendar-choice">
        <p className="onboarding-eyebrow">Sebelum masuk…</p>
        <h2>{connection.connected ? 'Jadwalmu sudah terhubung.' : 'Ingin menyambungkan jadwalmu?'}</h2>
        <p>{connection.connected
          ? 'Google Calendar siap membantu Strativate melihat konflik jadwal mentoring.'
          : 'Google Calendar bisa membantu Strativate menampilkan konflik jadwal mentoring. Ini sepenuhnya opsional.'}</p>

        {params.calendar === 'denied' && <p className="onboarding-error" role="status">
          Izin Calendar tidak diberikan. Tidak masalah—kamu tetap bisa masuk dan menghubungkannya nanti dari dashboard.
        </p>}

        {connection.connected ? <>
          <p className="onboarding-calendar-connected" role="status"><Check aria-hidden="true" size={16} /> Terhubung sebagai <strong>{connection.accountEmail}</strong></p>
          <Link className="onboarding-primary-action" href="/auth/continue">Masuk ke Strativate <ArrowRight aria-hidden="true" size={17} /></Link>
        </> : <>
          <a className="onboarding-calendar-option" href="/api/google-calendar/connect?returnTo=/onboarding/calendar">
            <span className="onboarding-calendar-option__icon" aria-hidden="true"><CalendarDays size={22} /></span>
            <span><strong>Hubungkan Google Calendar</strong><small>Bisa dilepas kapan saja dari dashboard.</small></span>
            <ArrowRight aria-hidden="true" size={19} />
          </a>
          <Link className="onboarding-text-action onboarding-calendar-skip" href="/auth/continue">Lewati sekarang</Link>
        </>}
      </div>
    </section>
  </OnboardingShell>
}
