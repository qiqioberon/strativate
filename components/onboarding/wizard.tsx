'use client'

import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { displayLabel } from '@/lib/labels'
import { createClient } from '@/lib/supabase/client'
import type { Institution, MasterOption, MenteeProfile, Profile, Json } from '@/lib/supabase/database.types'
import { formError } from '@/lib/auth/errors'
import { institutionPayload, interestPayload, profilePayload, referralPayload } from '@/lib/onboarding/rules'
import { InstitutionPicker } from './institution-picker'
import { PasswordInput } from '@/components/auth/password-input'

type CanonicalStep = 1 | 2 | 3 | 4
type VisualStage = 'welcome' | 'identity' | 'institution' | 'major' | 'cohort' | 'referral' | 'interests'
type Direction = 'forward' | 'back'

type Props = {
  profile: Profile
  mentee: MenteeProfile
  names: { firstName: string; lastName: string }
  referrals: MasterOption[]
  interests: MasterOption[]
  initialInterests: string[]
  initialInstitution: Institution | null
}

const canonicalLabels = ['Akun', 'Institusi', 'Referensi', 'Minat'] as const

function canonicalStep(value: number): CanonicalStep {
  if (value <= 1) return 1
  if (value === 2) return 2
  if (value === 3) return 3
  return 4
}

function stageForStep(step: CanonicalStep): VisualStage {
  if (step === 1) return 'identity'
  if (step === 2) return 'institution'
  if (step === 3) return 'referral'
  return 'interests'
}

function stepForStage(stage: VisualStage): CanonicalStep {
  if (stage === 'identity' || stage === 'welcome') return 1
  if (stage === 'institution' || stage === 'major' || stage === 'cohort') return 2
  if (stage === 'referral') return 3
  return 4
}

function copyForStage(stage: Exclude<VisualStage, 'welcome'>) {
  if (stage === 'identity') return {
    kicker: 'Tentang dirimu',
    title: 'Kita mulai dari dirimu dulu.',
    description: 'Pastikan identitas akunmu sudah tepat. Kamu masih bisa mengubahnya nanti dari profil.',
  }
  if (stage === 'institution') return {
    kicker: 'Tempat belajar',
    title: 'Saat ini kamu belajar di mana?',
    description: 'Cari institusimu. Jika belum tersedia, kamu tetap bisa mengajukannya tanpa keluar dari alur ini.',
  }
  if (stage === 'major') return {
    kicker: 'Tentang studimu',
    title: 'Apa jurusan atau fakultasmu?',
    description: 'Bagian ini opsional. Isi jika relevan dengan tempat belajarmu.',
  }
  if (stage === 'cohort') return {
    kicker: 'Satu detail lagi',
    title: 'Kamu angkatan berapa?',
    description: 'Tahun angkatan juga opsional. Setelah ini, informasi institusimu akan disimpan.',
  }
  if (stage === 'referral') return {
    kicker: 'Hampir selesai',
    title: 'Kamu menemukan Strativate dari mana?',
    description: 'Pilih satu jawaban yang paling sesuai.',
  }
  return {
    kicker: 'Terakhir',
    title: 'Bidang kompetisi apa yang paling menarik buatmu?',
    description: 'Kamu bisa memilih lebih dari satu. Pilihan ini berasal dari daftar aktif Strativate.',
  }
}

export function OnboardingWizard({ profile, mentee, names, referrals, interests, initialInterests, initialInstitution }: Props) {
  const savedStep = canonicalStep(mentee.onboarding_step)
  const introAvailable = savedStep === 1 && !profile.username
  const [stage, setStage] = useState<VisualStage>(introAvailable ? 'welcome' : stageForStep(savedStep))
  const [direction, setDirection] = useState<Direction>('forward')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  const [firstName, setFirstName] = useState(names.firstName)
  const [lastName, setLastName] = useState(names.lastName)
  const [username, setUsername] = useState(profile.username || '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(!!profile.password_set_at)
  const [editingPassword, setEditingPassword] = useState(!profile.password_set_at)
  const [institution, setInstitution] = useState(initialInstitution)
  const [major, setMajor] = useState(mentee.major_or_faculty || '')
  const [cohort, setCohort] = useState(mentee.cohort_year?.toString() || '')
  const [referral, setReferral] = useState(
    mentee.referral_other_text
      ? 'other'
      : referrals.some(option => option.id === mentee.referral_source_id)
        ? mentee.referral_source_id!
        : '',
  )
  const [referralOther, setReferralOther] = useState(mentee.referral_other_text || '')
  const [selectedInterests, setSelectedInterests] = useState(
    initialInterests.filter(id => interests.some(option => option.id === id)),
  )

  const passwordRequired = profile.registration_method === 'email' && !passwordSaved
  const currentStep = stepForStage(stage)
  const greetingName = firstName.trim() || names.firstName.trim()
  const selectedInterestNames = interests
    .filter(option => selectedInterests.includes(option.id))
    .map(option => displayLabel(option.name))

  useEffect(() => {
    if (stage !== 'welcome') headingRef.current?.focus({ preventScroll: true })
  }, [stage])

  function move(next: VisualStage, nextDirection: Direction) {
    setDirection(nextDirection)
    setError('')
    setStage(next)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function previousStage(): VisualStage | null {
    if (stage === 'identity') return introAvailable ? 'welcome' : null
    if (stage === 'institution') return 'identity'
    if (stage === 'major') return 'institution'
    if (stage === 'cohort') return 'major'
    if (stage === 'referral') return 'cohort'
    if (stage === 'interests') return 'referral'
    return null
  }

  function stopEditingPassword() {
    setEditingPassword(false)
    setPassword('')
    setConfirmation('')
    setError('')
  }

  function toggleInterest(id: string, checked: boolean) {
    setSelectedInterests(current => {
      if (checked) return current.includes(id) ? current : [...current, id]
      return current.filter(value => value !== id)
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')

    if (stage === 'institution') {
      if (!institution) {
        setError('Pilih institusi terlebih dahulu.')
        return
      }
      move('major', 'forward')
      return
    }

    if (stage === 'major') {
      if (major.trim().length > 150) {
        setError('Jurusan atau fakultas maksimal 150 karakter.')
        return
      }
      move('cohort', 'forward')
      return
    }

    const step = stepForStage(stage)
    const result = stage === 'identity'
      ? profilePayload({ firstName, lastName, username, password, confirmation, passwordRequired })
      : stage === 'cohort'
        ? institutionPayload({ institutionId: institution?.id || '', majorOrFaculty: major, cohortYear: cohort })
        : stage === 'referral'
          ? referralPayload({ referralId: referral === 'other' ? '' : referral, otherText: referral === 'other' ? referralOther : '' })
          : interestPayload({ interestIds: selectedInterests })

    if (result.error) {
      setError(result.error)
      return
    }

    setBusy(true)
    try {
      const db = createClient()

      if (step === 1 && password) {
        const { error: passwordUpdateError } = await db.auth.updateUser({ password })
        if (passwordUpdateError && passwordUpdateError.code !== 'same_password') throw passwordUpdateError
        setPasswordSaved(true)
        setEditingPassword(false)
        setPassword('')
        setConfirmation('')
      }

      const { data, error: saveError } = await db.rpc('save_onboarding_step', {
        p_step: step,
        p_data: result.data as Json,
      })
      if (saveError) throw saveError
      if (!data) throw new Error('Missing saved progress')

      if (step === 4) {
        if (!data.onboarding_completed_at) throw new Error('Completion missing')
        window.location.assign('/onboarding/calendar')
        return
      }

      if (step === 1) move('institution', 'forward')
      if (step === 2) move('referral', 'forward')
      if (step === 3) move('interests', 'forward')
    } catch (submitError) {
      setError(formError(submitError, 'Langkah belum tersimpan. Periksa data dan koneksi, lalu coba lagi.'))
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'welcome') {
    return <section className="onboarding-intro onboarding-stage" data-direction={direction}>
      <div className="onboarding-intro__mark" aria-hidden="true"><Sparkles size={22} /></div>
      <p className="kicker">Selamat datang</p>
      <h1>Selamat datang di Strativate{greetingName ? ', ' + greetingName : ''}.</h1>
      <p>Yuk, kami bantu menyiapkan pengalaman Strativate yang lebih sesuai untukmu. Prosesnya singkat dan progresmu akan tersimpan per bagian.</p>
      <button className="button button-primary onboarding-intro__cta" type="button" onClick={() => move('identity', 'forward')}>
        Mulai <ArrowRight aria-hidden="true" size={17} />
      </button>
    </section>
  }

  const copy = copyForStage(stage)
  const back = previousStage()
  const isMasterEmpty = (stage === 'referral' && referrals.length === 0) || (stage === 'interests' && interests.length === 0)
  const primaryLabel = busy
    ? 'Menyimpan…'
    : stage === 'interests'
      ? 'Selesaikan data utama'
      : stage === 'cohort' || stage === 'referral'
        ? 'Simpan & lanjutkan'
        : 'Lanjutkan'

  return <>
    <div className="onboarding-progress-wrap">
      <div className="onboarding-progress-meta">
        <span>Langkah {currentStep} dari 4</span>
        <span>{canonicalLabels[currentStep - 1]}</span>
      </div>
      <ol className="onboarding-progress" aria-label="Progres pendaftaran">
        {canonicalLabels.map((label, index) => {
          const number = (index + 1) as CanonicalStep
          const state = number < currentStep ? 'complete' : number === currentStep ? 'current' : 'upcoming'
          return <li key={label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="onboarding-progress__track" aria-hidden="true"><span /></span>
            <span className="onboarding-progress__label">{label}</span>
          </li>
        })}
      </ol>
    </div>

    <form className="onboarding-form" onSubmit={submit}>
      <div key={stage} className="onboarding-stage" data-direction={direction}>
        <header className="onboarding-heading">
          <p className="kicker">{copy.kicker}</p>
          <h1 ref={headingRef} tabIndex={-1}>{copy.title}</h1>
          <p>{copy.description}</p>
        </header>

        <fieldset disabled={busy} className="onboarding-fields">
          {stage === 'identity' && <>
            <div className="onboarding-field-grid onboarding-field-grid--names">
              <label>Nama depan<input value={firstName} onChange={event => setFirstName(event.target.value)} required maxLength={100} autoComplete="given-name" /></label>
              <label>Nama belakang<input value={lastName} onChange={event => setLastName(event.target.value)} maxLength={100} autoComplete="family-name" /></label>
            </div>
            <label>Nama pengguna<input value={username} onChange={event => setUsername(event.target.value)} required minLength={3} maxLength={30} autoComplete="username" /></label>

            {!passwordSaved || editingPassword ? <>
              <PasswordInput
                label={passwordSaved ? 'Kata sandi baru' : passwordRequired ? 'Kata sandi' : 'Kata sandi (opsional)'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                required={passwordRequired}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
              <PasswordInput
                label="Konfirmasi kata sandi"
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
                required={passwordRequired || !!password}
                autoComplete="new-password"
              />
              {passwordSaved && <button className="onboarding-text-action" type="button" onClick={stopEditingPassword}>Batal ubah kata sandi</button>}
            </> : <div className="onboarding-inline-note">
              <span>Kata sandi akun sudah tersimpan.</span>
              <button className="onboarding-text-action" type="button" onClick={() => { setEditingPassword(true); setError('') }}>Ubah kata sandi</button>
            </div>}

            {profile.registration_method === 'google' && <p className="onboarding-helper">
              {passwordSaved ? 'Kamu dapat masuk dengan Google atau email dan kata sandi.' : 'Kamu tetap dapat masuk dengan Google tanpa membuat kata sandi.'}
            </p>}
          </>}

          {stage === 'institution' && <InstitutionPicker selected={institution} onSelect={setInstitution} disabled={busy} />}

          {stage === 'major' && <label>
            Jurusan / fakultas
            <input value={major} onChange={event => setMajor(event.target.value)} maxLength={150} autoComplete="organization-title" placeholder="Contoh: Teknik Informatika" />
            <small>Opsional</small>
          </label>}

          {stage === 'cohort' && <>
            <label>
              Tahun angkatan
              <input type="number" value={cohort} onChange={event => setCohort(event.target.value)} min={1950} max={new Date().getFullYear() + 1} step={1} inputMode="numeric" placeholder="Contoh: 2024" />
              <small>Opsional</small>
            </label>
            {institution && <div className="onboarding-selection-summary" role="status">
              <Check aria-hidden="true" size={18} />
              <span><strong>{institution.name}</strong>{major.trim() ? ' · ' + major.trim() : ''}{cohort.trim() ? ' · Angkatan ' + cohort.trim() : ''}</span>
            </div>}
          </>}

          {stage === 'referral' && <>
            {referrals.length === 0 ? <p className="onboarding-inline-note onboarding-inline-note--warning" role="alert">
              Pilihan sumber informasi belum tersedia. Coba muat ulang halaman sebelum melanjutkan.
            </p> : <div className="onboarding-choice-grid onboarding-choice-grid--single">
              {referrals.map(option => <label className={'onboarding-choice' + (referral === option.id ? ' is-selected' : '')} key={option.id}>
                <input type="radio" name="referral" value={option.id} checked={referral === option.id} onChange={() => setReferral(option.id)} />
                <span>{displayLabel(option.name)}</span>
                {referral === option.id && <Check aria-hidden="true" size={17} />}
              </label>)}
              <label className={'onboarding-choice' + (referral === 'other' ? ' is-selected' : '')}>
                <input type="radio" name="referral" value="other" checked={referral === 'other'} onChange={() => setReferral('other')} />
                <span>Lainnya</span>
                {referral === 'other' && <Check aria-hidden="true" size={17} />}
              </label>
            </div>}
            {referral === 'other' && <div className="onboarding-conditional">
              <label>Sumber informasi lainnya<input value={referralOther} onChange={event => setReferralOther(event.target.value)} required maxLength={500} /></label>
            </div>}
          </>}

          {stage === 'interests' && <>
            {interests.length === 0 ? <p className="onboarding-inline-note onboarding-inline-note--warning" role="alert">
              Daftar minat belum tersedia. Coba muat ulang halaman sebelum menyelesaikan onboarding.
            </p> : <div className="onboarding-choice-grid">
              {interests.map(option => {
                const selected = selectedInterests.includes(option.id)
                return <label className={'onboarding-choice' + (selected ? ' is-selected' : '')} key={option.id}>
                  <input type="checkbox" checked={selected} onChange={event => toggleInterest(option.id, event.target.checked)} />
                  <span>{displayLabel(option.name)}</span>
                  {selected && <Check aria-hidden="true" size={17} />}
                </label>
              })}
            </div>}
            {selectedInterestNames.length > 0 && <p className="onboarding-helper" role="status">
              {selectedInterestNames.join(', ')} — sudah siap disimpan.
            </p>}
          </>}
        </fieldset>
      </div>

      {error && <p className="onboarding-error" role="alert">{error}</p>}

      <div className="onboarding-actions">
        {back && <button type="button" className="button button-outline onboarding-actions__back" disabled={busy} onClick={() => move(back, 'back')}>
          <ArrowLeft aria-hidden="true" size={17} /> Kembali
        </button>}
        <button className="button button-primary onboarding-actions__primary" disabled={busy || isMasterEmpty}>
          {primaryLabel}{!busy && <ArrowRight aria-hidden="true" size={17} />}
        </button>
      </div>
    </form>
  </>
}
