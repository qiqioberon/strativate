import Link from 'next/link'
import { CalendarDays, Check, CheckCircle2, ArrowRight } from 'lucide-react'
import { redirect } from 'next/navigation'
import { OnboardingShell } from '@/components/onboarding/shell'
import { displayLabel } from '@/lib/labels'
import { getAccount } from '@/lib/auth/server'
import { getGoogleConnectionStatus } from '@/lib/google-calendar/server'
import { createClient } from '@/lib/supabase/server'

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
  const interests = interestResult.data || []

  return <OnboardingShell>
    <section className="onboarding-completion">
      <div className="onboarding-completion__icon" aria-hidden="true"><CheckCircle2 size={28} /></div>
      <p className="kicker">Data utama selesai</p>
      <h1>Semua sudah siap{firstName ? ', ' + firstName : ''}.</h1>
      <p>Profil utamamu sudah tersimpan. Kamu bisa langsung masuk ke Strativate, atau menyambungkan Google Calendar terlebih dahulu.</p>

      <div className="onboarding-completion__summary" aria-label="Ringkasan pendaftaran">
        {institution.data && <div>
          <span>Tempat belajar</span>
          <strong>{institution.data.name}</strong>
        </div>}
        {interests.length > 0 && <div>
          <span>Minat kompetisi</span>
          <strong>{interests.map(item => displayLabel(item.name)).join(', ')}</strong>
        </div>}
      </div>

      {params.calendar === 'denied' && <p className="onboarding-inline-note onboarding-inline-note--warning" role="status">
        Izin Calendar tidak diberikan. Akunmu tetap aktif dan kamu bisa menghubungkannya nanti dari dashboard.
      </p>}

      <div className="onboarding-calendar-card">
        <div className="onboarding-calendar-card__icon" aria-hidden="true"><CalendarDays size={23} /></div>
        <div className="onboarding-calendar-card__copy">
          <p className="kicker">Opsional</p>
          <h2>{connection.connected ? 'Google Calendar sudah terhubung.' : 'Mau menyambungkan jadwalmu?'}</h2>
          <p>
            {connection.connected
              ? 'Strativate dapat membantu menampilkan konflik jadwal bersama sesi mentoring.'
              : 'Hubungkan Google Calendar agar Strativate bisa membantu menampilkan konflik jadwal bersama sesi mentoring. Ini tidak wajib untuk menyelesaikan pendaftaran.'}
          </p>
          {connection.connected && <p className="onboarding-calendar-card__status" role="status">
            <Check aria-hidden="true" size={16} /> Terhubung sebagai <strong>{connection.accountEmail}</strong>
          </p>}
        </div>
      </div>

      <div className="onboarding-actions onboarding-actions--completion">
        {connection.connected ? <Link className="button button-primary onboarding-actions__primary" href="/auth/continue">
          Masuk ke Strativate <ArrowRight aria-hidden="true" size={17} />
        </Link> : <>
          <a className="button button-primary onboarding-actions__primary" href="/api/google-calendar/connect?returnTo=/onboarding/calendar">
            Hubungkan Google Calendar
          </a>
          <Link className="button button-outline onboarding-actions__back" href="/auth/continue">
            Lewati sekarang
          </Link>
        </>}
      </div>
    </section>
  </OnboardingShell>
}
