import { ArrowRight, CalendarDays, Check } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getAccount } from '@/lib/auth/server'
import { OnboardingRouteLink, OnboardingRouteStage } from '@/components/onboarding/motion'
import { getGoogleConnectionStatus } from '@/lib/google-calendar/server'

export default async function CalendarOnboardingPage({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const account = await getAccount()
  if (!account) redirect('/auth')
  if (account.profile.role !== 'mentee') redirect(account.destination)
  if (!account.mentee?.onboarding_completed_at) redirect('/onboarding')

  const params = await searchParams
  const connection = await getGoogleConnectionStatus(account.user.id)

  return <OnboardingRouteStage scene="calendar">
    <section className="onboarding-calendar-stage">
      <div className="onboarding-calendar-stage__symbol" aria-hidden="true"><CalendarDays size={26} /></div>
      <p className="onboarding-eyebrow">Satu pilihan sebelum pengecekan akhir</p>
      <h1>{connection.connected ? 'Google Calendar-mu sudah terhubung.' : 'Ingin menghubungkan jadwalmu?'}</h1>
      <p className="onboarding-calendar-stage__lead">{connection.connected
        ? 'Koneksi ini membantu Strativate mengenali konflik jadwal mentoring. Kamu tetap bisa mengubahnya nanti.'
        : 'Google Calendar bisa membantu Strativate mengenali konflik jadwal mentoring. Ini opsional dan bisa diatur lagi dari dashboard.'}</p>

      {params.calendar === 'denied' && <p className="onboarding-calendar-stage__notice" role="status">
        Izin Calendar tidak diberikan. Tidak masalah—kamu bisa melanjutkan tanpa menghubungkannya.
      </p>}

      {connection.connected ? <>
        <p className="onboarding-calendar-connected" role="status"><Check aria-hidden="true" size={16} /> Terhubung sebagai <strong>{connection.accountEmail}</strong></p>
        <OnboardingRouteLink className="onboarding-primary-action" href="/onboarding/review">Lanjut ke ringkasan <ArrowRight aria-hidden="true" size={17} /></OnboardingRouteLink>
      </> : <>
        <a className="onboarding-calendar-option" href="/api/google-calendar/connect?returnTo=/onboarding/calendar">
          <span className="onboarding-calendar-option__icon" aria-hidden="true"><CalendarDays size={22} /></span>
          <span><strong>Hubungkan Google Calendar</strong><small>Opsional · bisa dilepas kapan saja.</small></span>
          <ArrowRight aria-hidden="true" size={19} />
        </a>
        <OnboardingRouteLink className="onboarding-text-action onboarding-calendar-skip" href="/onboarding/review">Lewati, lanjut ke ringkasan</OnboardingRouteLink>
      </>}
    </section>
  </OnboardingRouteStage>
}
