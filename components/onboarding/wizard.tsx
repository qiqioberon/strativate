'use client'
import { displayLabel } from '@/lib/labels'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Institution, MasterOption, MenteeProfile, Profile, Json } from '@/lib/supabase/database.types'
import { formError } from '@/lib/auth/errors'
import { institutionPayload, interestPayload, profilePayload, referralPayload } from '@/lib/onboarding/rules'
import { InstitutionPicker } from './institution-picker'
import { PasswordInput } from "@/components/auth/password-input"

const steps = ['Data Diri', 'Asal Institusi', 'Dari Mana?', 'Minat Kompetisi']
type Props = { profile: Profile; mentee: MenteeProfile; names: { firstName: string; lastName: string }; referrals: MasterOption[]; interests: MasterOption[]; initialInterests: string[]; initialInstitution: Institution | null }
export function OnboardingWizard({ profile, mentee, names, referrals, interests, initialInterests, initialInstitution }: Props) {
  const [step, setStep] = useState(mentee.onboarding_step), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [firstName, setFirstName] = useState(names.firstName), [lastName, setLastName] = useState(names.lastName), [username, setUsername] = useState(profile.username || '')
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [passwordSaved, setPasswordSaved] = useState(!!profile.password_set_at)
  const [institution, setInstitution] = useState(initialInstitution), [major, setMajor] = useState(mentee.major_or_faculty || ''), [cohort, setCohort] = useState(mentee.cohort_year?.toString() || '')
  const [referral, setReferral] = useState(mentee.referral_other_text ? 'other' : referrals.some(r => r.id === mentee.referral_source_id) ? mentee.referral_source_id! : '')
  const [referralOther, setReferralOther] = useState(mentee.referral_other_text || '')
  const [selectedInterests, setSelectedInterests] = useState(initialInterests.filter(id => interests.some(i => i.id === id)))
  const passwordRequired = profile.registration_method === 'email' && !passwordSaved
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const result = step === 1 ? profilePayload({ firstName, lastName, username, password, confirmation, passwordRequired })
      : step === 2 ? institutionPayload({ institutionId: institution?.id || '', majorOrFaculty: major, cohortYear: cohort })
      : step === 3 ? referralPayload({ referralId: referral === 'other' ? '' : referral, otherText: referral === 'other' ? referralOther : '' })
      : interestPayload({ interestIds: selectedInterests })
    if (result.error) { setError(result.error); return }
    setBusy(true)
    try {
      const db = createClient()
      if (step === 1 && password) {
        const { error } = await db.auth.updateUser({ password })
        if (error) throw error
        setPasswordSaved(true); setPassword(''); setConfirmation('')
      }
      const { data, error } = await db.rpc('save_onboarding_step', { p_step: step, p_data: result.data as Json })
      if (error) throw error
      if (!data) throw new Error('Missing saved progress')
      if (step === 4) {
        if (!data.onboarding_completed_at) throw new Error('Completion missing')
        window.location.assign('/auth/continue')
      } else { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    } catch (error) { setError(formError(error, 'Langkah belum tersimpan. Periksa data dan koneksi, lalu coba lagi.')) }
    finally { setBusy(false) }
  }
  return <><div className="auth-heading"><p className="kicker">Langkah {step} dari 4</p><h1>{steps[step - 1]}<em>.</em></h1><p>Lengkapi profilmu agar kami bisa menyiapkan pengalaman belajar yang sesuai. Progres tersimpan setiap kali kamu melanjutkan.</p></div>
    <ol className="onboarding-progress" aria-label="Progres pendaftaran">{steps.map((name, index) => <li key={name} className={index + 1 <= step ? 'active' : ''} aria-current={index + 1 === step ? 'step' : undefined}>{index + 1}. {name}</li>)}</ol>
    <form className="auth-form" onSubmit={submit}><fieldset disabled={busy}>
      {step === 1 && <><label>Nama Depan<input value={firstName} onChange={e => setFirstName(e.target.value)} required maxLength={100} autoComplete="given-name" /></label><label>Nama Belakang<input value={lastName} onChange={e => setLastName(e.target.value)} maxLength={100} autoComplete="family-name" /></label><label>Nama pengguna<input value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={30} autoComplete="username" /></label><PasswordInput label={passwordRequired ? "Kata sandi" : "Kata sandi (opsional)"} value={password} onChange={e => setPassword(e.target.value)} required={passwordRequired} minLength={8} maxLength={128} autoComplete="new-password" /><PasswordInput label="Konfirmasi kata sandi" value={confirmation} onChange={e => setConfirmation(e.target.value)} required={passwordRequired || !!password} autoComplete="new-password" />{passwordSaved && <p role="status">Kata sandi akun sudah tersimpan.</p>}{profile.registration_method === 'google' && <p>Kamu tetap dapat masuk dengan Google tanpa membuat kata sandi.</p>}</>}
      {step === 2 && <><InstitutionPicker selected={institution} onSelect={setInstitution} disabled={busy} /><label>Jurusan / Fakultas<input value={major} onChange={e => setMajor(e.target.value)} maxLength={150} /></label><label>Angkatan<input type="number" value={cohort} onChange={e => setCohort(e.target.value)} min={1950} max={new Date().getFullYear() + 1} step={1} /></label></>}
      {step === 3 && <><p>Dari mana kamu mengetahui Strativate?</p>{referrals.map(option => <label className="option-label" key={option.id}><input type="radio" name="referral" value={option.id} checked={referral === option.id} onChange={() => setReferral(option.id)} />{displayLabel(option.name)}</label>)}<label className="option-label"><input type="radio" name="referral" value="other" checked={referral === 'other'} onChange={() => setReferral('other')} />Lainnya…</label>{referral === 'other' && <label>Sumber informasi lainnya<input value={referralOther} onChange={e => setReferralOther(e.target.value)} required maxLength={500} /></label>}</>}
      {step === 4 && <><p>Pilih satu atau lebih minat kompetisimu.</p>{interests.map(option => <label className="option-label" key={option.id}><input type="checkbox" checked={selectedInterests.includes(option.id)} onChange={e => setSelectedInterests(ids => e.target.checked ? [...ids, option.id] : ids.filter(id => id !== option.id))} />{displayLabel(option.name)}</label>)}</>}
    </fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="button-row">{step > 1 && <button type="button" className="button button-outline" disabled={busy} onClick={() => { setStep(step - 1); setError('') }}>Kembali</button>}<button className="button button-primary" disabled={busy}>{busy ? 'Menyimpan…' : step === 4 ? 'Selesaikan pendaftaran' : 'Lanjutkan'}</button></div></form>
  </>
}
