'use client'

import { useEffect, useMemo, useRef, useState, type AnimationEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { formError } from '@/lib/auth/errors'
import { displayLabel } from '@/lib/labels'
import { usernameError } from '@/lib/auth/rules'
import { institutionPayload, interestPayload, profilePayload, referralPayload } from '@/lib/onboarding/rules'
import { createClient } from '@/lib/supabase/client'
import type { Institution, Json } from '@/lib/supabase/database.types'
import {
  CohortStage,
  InstitutionStage,
  InterestsStage,
  MajorStage,
  NameConfirmationStage,
  NameEditStage,
  PasswordStage,
  ReferralStage,
  TransitionAcknowledgement,
  UsernameStage,
  WelcomeStage,
} from './stages'
import { OnboardingProgress } from './stage-frame'
import { canonicalStep, initialVisualStage, type OnboardingExperienceProps, type TransitionPhase, type VisualStage } from './types'

type TransitionTarget = { stage: VisualStage; route?: never } | { route: string; stage?: never }

function fullName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

function readableInterestAcknowledgement(names: string[]) {
  if (names.length === 1) return names[0] + ' — siap, kami sudah mengenal minatmu sedikit lebih baik.'
  if (names.length === 2) return names[0] + ' dan ' + names[1] + ' — sudah kami catat.'
  return names.slice(0, 2).join(', ') + ', dan ' + (names.length - 2) + ' lainnya — sudah kami catat.'
}

export function OnboardingExperience({ profile, mentee, names, referrals, interests, initialInterests, initialInstitution }: OnboardingExperienceProps) {
  const router = useRouter()
  const savedStep = canonicalStep(mentee.onboarding_step)
  const [stage, setStage] = useState<VisualStage>(initialVisualStage(savedStep))
  const [phase, setPhase] = useState<TransitionPhase>('idle')
  const [transitionTarget, setTransitionTarget] = useState<TransitionTarget | null>(null)
  const [acknowledgement, setAcknowledgement] = useState('')
  const [reducedMotion, setReducedMotion] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [firstName, setFirstName] = useState(names.firstName)
  const [lastName, setLastName] = useState(names.lastName)
  const [username, setUsername] = useState(profile.username || '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(!!profile.password_set_at)
  const [editingPassword, setEditingPassword] = useState(profile.registration_method === 'email' && !profile.password_set_at)
  const [institution, setInstitution] = useState<Institution | null>(initialInstitution)
  const [major, setMajor] = useState(mentee.major_or_faculty || '')
  const [cohort, setCohort] = useState(mentee.cohort_year?.toString() || '')
  const [referral, setReferral] = useState(mentee.referral_other_text ? 'other' : mentee.referral_source_id || '')
  const [referralOther, setReferralOther] = useState(mentee.referral_other_text || '')
  const [selectedInterests, setSelectedInterests] = useState(initialInterests.filter(id => interests.some(option => option.id === id)))

  const hasUsableName = !!firstName.trim()
  const displayFullName = fullName(firstName, lastName)
  const institutionName = institution?.name || 'Tempat belajarmu'
  const usernameValidation = username.length > 0 ? usernameError(username) || '' : ''
  const selectedInterestNames = useMemo(
    () => interests.filter(option => selectedInterests.includes(option.id)).map(option => displayLabel(option.name)),
    [interests, selectedInterests],
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (stage === 'welcome') return
    requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }))
  }, [stage])

  function clearInteractionError() {
    setError('')
  }

  function swapImmediately(target: TransitionTarget) {
    setAcknowledgement('')
    setTransitionTarget(null)
    setPhase('idle')
    if (target.route) {
      router.push(target.route)
      return
    }
    if (!target.stage) return
    setStage(target.stage)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function transitionTo(target: TransitionTarget, message = '') {
    if (phase !== 'idle') return
    clearInteractionError()
    const active = document.activeElement
    if (active instanceof HTMLElement && stageRef.current?.contains(active)) active.blur()

    if (reducedMotion) {
      swapImmediately(target)
      return
    }

    setAcknowledgement(message)
    setTransitionTarget(target)
    setPhase('exit')
  }

  function handleStageAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.currentTarget !== event.target) return
    if (phase === 'exit' && transitionTarget) {
      if (transitionTarget.route) {
        router.push(transitionTarget.route)
        return
      }
      if (!transitionTarget.stage) return
      setStage(transitionTarget.stage)
      setTransitionTarget(null)
      setAcknowledgement('')
      setPhase('enter')
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    if (phase === 'enter') setPhase('idle')
  }

  function setPending(value: boolean) {
    busyRef.current = value
    setBusy(value)
  }

  async function runCanonicalSave(step: 1 | 2 | 3 | 4, payload: Json) {
    const db = createClient()
    const { data, error: saveError } = await db.rpc('save_onboarding_step', { p_step: step, p_data: payload })
    if (saveError) throw saveError
    if (!data) throw new Error('Missing saved progress')
    return data
  }

  function startExperience() {
    transitionTo({ stage: hasUsableName ? 'name-confirmation' : 'name-edit' })
  }

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanFirst = firstName.trim()
    const cleanLast = lastName.trim()
    if (!cleanFirst || cleanFirst.length > 100 || cleanLast.length > 100) {
      setError('Isi nama depan yang valid.')
      return
    }
    setFirstName(cleanFirst)
    setLastName(cleanLast)
    transitionTo({ stage: 'username' })
  }

  function submitUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const invalid = usernameError(username.trim())
    if (invalid) {
      setError(invalid)
      return
    }
    setUsername(username.trim())
    transitionTo({ stage: 'password' })
  }

  async function saveIdentity(event?: FormEvent<HTMLFormElement>, skipPassword = false) {
    event?.preventDefault()
    if (busyRef.current || phase !== 'idle') return
    setError('')

    const effectivePassword = skipPassword ? '' : password
    const effectiveConfirmation = skipPassword ? '' : confirmation
    const passwordRequired = profile.registration_method === 'email' && !passwordSaved
    const result = profilePayload({ firstName, lastName, username, password: effectivePassword, confirmation: effectiveConfirmation, passwordRequired })
    if (result.error) {
      setError(result.error)
      return
    }

    setPending(true)
    try {
      const db = createClient()
      if (effectivePassword) {
        const { error: passwordUpdateError } = await db.auth.updateUser({ password: effectivePassword })
        if (passwordUpdateError && passwordUpdateError.code !== 'same_password') throw passwordUpdateError
        setPasswordSaved(true)
        setEditingPassword(false)
      }

      await runCanonicalSave(1, result.data as Json)
      setPassword('')
      setConfirmation('')
      transitionTo({ stage: 'institution' }, '✓ Akunmu sudah siap.')
    } catch (submitError) {
      setError(formError(submitError, 'Akunmu belum tersimpan. Periksa data dan koneksi, lalu coba lagi.'))
    } finally {
      setPending(false)
    }
  }

  function continueInstitution() {
    if (!institution) {
      setError('Pilih institusi terlebih dahulu.')
      return
    }
    transitionTo({ stage: 'major' })
  }

  function submitMajor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (major.trim().length > 150) {
      setError('Jurusan atau fakultas maksimal 150 karakter.')
      return
    }
    setMajor(major.trim())
    transitionTo({ stage: 'cohort' })
  }

  async function saveInstitution(event?: FormEvent<HTMLFormElement>, forceEmptyCohort = false) {
    event?.preventDefault()
    if (busyRef.current || phase !== 'idle') return
    setError('')
    const result = institutionPayload({
      institutionId: institution?.id || '',
      majorOrFaculty: major,
      cohortYear: forceEmptyCohort ? '' : cohort,
    })
    if (result.error) {
      setError(result.error)
      return
    }

    setPending(true)
    try {
      await runCanonicalSave(2, result.data as Json)
      if (forceEmptyCohort) setCohort('')
      transitionTo({ stage: 'referral' }, '✓ ' + institutionName + ' sudah kami catat.')
    } catch (submitError) {
      setError(formError(submitError, 'Informasi studimu belum tersimpan. Coba lagi.'))
    } finally {
      setPending(false)
    }
  }

  async function saveReferralChoice(id: string) {
    if (busyRef.current || phase !== 'idle') return
    setReferral(id)
    setReferralOther('')
    setError('')
    const result = referralPayload({ referralId: id, otherText: '' })
    if (result.error) {
      setError(result.error)
      return
    }

    setPending(true)
    try {
      await runCanonicalSave(3, result.data as Json)
      transitionTo({ stage: 'interests' })
    } catch (submitError) {
      setError(formError(submitError, 'Pilihanmu belum tersimpan. Coba lagi.'))
    } finally {
      setPending(false)
    }
  }

  async function saveReferralOther(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busyRef.current || phase !== 'idle') return
    setError('')
    const result = referralPayload({ referralId: '', otherText: referralOther })
    if (result.error) {
      setError(result.error)
      return
    }

    setPending(true)
    try {
      await runCanonicalSave(3, result.data as Json)
      transitionTo({ stage: 'interests' })
    } catch (submitError) {
      setError(formError(submitError, 'Jawabanmu belum tersimpan. Coba lagi.'))
    } finally {
      setPending(false)
    }
  }

  function toggleInterest(id: string, checked: boolean) {
    if (busyRef.current || phase !== 'idle') return
    setSelectedInterests(current => checked
      ? current.includes(id) ? current : [...current, id]
      : current.filter(value => value !== id))
  }

  async function saveInterests(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busyRef.current || phase !== 'idle') return
    setError('')
    const result = interestPayload({ interestIds: selectedInterests })
    if (result.error) {
      setError(result.error)
      return
    }

    setPending(true)
    try {
      const data = await runCanonicalSave(4, result.data as Json)
      if (!data.onboarding_completed_at) throw new Error('Completion missing')
      transitionTo({ route: '/onboarding/calendar' }, readableInterestAcknowledgement(selectedInterestNames))
    } catch (submitError) {
      setError(formError(submitError, 'Minatmu belum tersimpan. Coba lagi.'))
    } finally {
      setPending(false)
    }
  }

  function renderStage() {
    if (stage === 'welcome') return <WelcomeStage firstName={firstName.trim()} onStart={startExperience} />

    if (stage === 'name-confirmation') return <NameConfirmationStage
      fullName={displayFullName}
      onConfirm={() => transitionTo({ stage: 'username' })}
      onEdit={() => transitionTo({ stage: 'name-edit' })}
      onBack={() => transitionTo({ stage: 'welcome' })}
    />

    if (stage === 'name-edit') return <NameEditStage
      firstName={firstName}
      lastName={lastName}
      error={error}
      onFirstName={value => { setFirstName(value); clearInteractionError() }}
      onLastName={value => { setLastName(value); clearInteractionError() }}
      onSubmit={submitName}
      onBack={() => transitionTo({ stage: hasUsableName ? 'name-confirmation' : 'welcome' })}
    />

    if (stage === 'username') return <UsernameStage
      username={username}
      error={error}
      validation={usernameValidation}
      onUsername={value => { setUsername(value); clearInteractionError() }}
      onSubmit={submitUsername}
      onBack={() => transitionTo({ stage: hasUsableName ? 'name-confirmation' : 'name-edit' })}
    />

    if (stage === 'password') return <PasswordStage
      registrationMethod={profile.registration_method}
      passwordSaved={passwordSaved}
      editingPassword={editingPassword}
      password={password}
      confirmation={confirmation}
      busy={busy}
      error={error}
      onPassword={value => { setPassword(value); clearInteractionError() }}
      onConfirmation={value => { setConfirmation(value); clearInteractionError() }}
      onEditPassword={() => { setEditingPassword(true); clearInteractionError() }}
      onCancelEdit={() => { setEditingPassword(false); setPassword(''); setConfirmation(''); clearInteractionError() }}
      onSubmit={saveIdentity}
      onSkipGoogle={() => { void saveIdentity(undefined, true) }}
      onBack={() => transitionTo({ stage: 'username' })}
    />

    if (stage === 'institution') return <InstitutionStage
      institution={institution}
      busy={busy}
      error={error}
      onInstitution={value => { setInstitution(value); clearInteractionError() }}
      onContinue={continueInstitution}
    />

    if (stage === 'major') return <MajorStage
      institutionName={institutionName}
      major={major}
      error={error}
      onMajor={value => { setMajor(value); clearInteractionError() }}
      onSubmit={submitMajor}
      onSkip={() => { setMajor(''); transitionTo({ stage: 'cohort' }) }}
      onBack={() => transitionTo({ stage: 'institution' })}
    />

    if (stage === 'cohort') return <CohortStage
      institutionName={institutionName}
      cohort={cohort}
      busy={busy}
      error={error}
      onCohort={value => { setCohort(value); clearInteractionError() }}
      onSubmit={event => { void saveInstitution(event) }}
      onSkip={() => { void saveInstitution(undefined, true) }}
      onBack={() => transitionTo({ stage: 'major' })}
    />

    if (stage === 'referral') return <ReferralStage
      referrals={referrals}
      selected={referral}
      otherText={referralOther}
      busy={busy}
      error={error}
      onChoose={id => { void saveReferralChoice(id) }}
      onOther={() => { if (!busyRef.current) { setReferral('other'); setReferralOther(''); clearInteractionError() } }}
      onOtherText={value => { setReferralOther(value); clearInteractionError() }}
      onSubmitOther={saveReferralOther}
    />

    return <InterestsStage
      interests={interests}
      selectedIds={selectedInterests}
      busy={busy}
      error={error}
      onToggle={toggleInterest}
      onSubmit={saveInterests}
    />
  }

  return <div className="onboarding-experience" data-stage={stage}>
    <div className="onboarding-experience__progress"><OnboardingProgress stage={stage} /></div>
    <div
      ref={stageRef}
      className="onboarding-stage-region"
      data-phase={phase}
      tabIndex={-1}
      inert={phase === 'exit'}
      aria-hidden={phase === 'exit' ? true : undefined}
      onAnimationEnd={handleStageAnimationEnd}
    >
      {renderStage()}
    </div>
    <TransitionAcknowledgement message={acknowledgement} />
  </div>
}
