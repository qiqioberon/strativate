import { ArrowRight, Check, CheckCircle2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { displayLabel } from '@/lib/labels'
import type { Institution, MasterOption, RegistrationMethod } from '@/lib/supabase/database.types'
import { PasswordInput } from '@/components/auth/password-input'
import { InstitutionPicker } from './institution-picker'
import { InlineError, PrimaryAction, QuestionStage } from './stage-frame'

export function WelcomeStage({ firstName, onStart }: { firstName: string; onStart: () => void }) {
  return <section className="onboarding-welcome">
    <div className="onboarding-welcome__mark" aria-hidden="true"><span /></div>
    <p className="onboarding-eyebrow">Strativate</p>
    <h1>Selamat datang di Strativate{firstName ? ', ' + firstName : ''}.</h1>
    <p>Sebelum mulai, kami ingin mengenalmu sedikit lebih baik.</p>
    <PrimaryAction onClick={onStart}>Mulai <ArrowRight aria-hidden="true" size={17} /></PrimaryAction>
  </section>
}

export function NameConfirmationStage({
  fullName,
  onConfirm,
  onEdit,
  onBack,
}: {
  fullName: string
  onConfirm: () => void
  onEdit: () => void
  onBack: () => void
}) {
  return <QuestionStage eyebrow="Tentang dirimu" title="Kami mengenalmu sebagai…" description="Apakah nama ini sudah tepat?" onBack={onBack}>
    <div className="onboarding-name-display">{fullName}</div>
    <div className="onboarding-action-stack">
      <PrimaryAction onClick={onConfirm}>Ya, lanjutkan <ArrowRight aria-hidden="true" size={17} /></PrimaryAction>
      <button type="button" className="onboarding-text-action" onClick={onEdit}>Ubah nama</button>
    </div>
  </QuestionStage>
}

export function NameEditStage({
  firstName,
  lastName,
  error,
  onFirstName,
  onLastName,
  onSubmit,
  onBack,
}: {
  firstName: string
  lastName: string
  error: string
  onFirstName: (value: string) => void
  onLastName: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onBack: () => void
}) {
  return <QuestionStage eyebrow="Tentang dirimu" title="Siapa namamu?" description="Nama ini akan dipakai untuk membuat pengalaman Strativate terasa lebih personal." onBack={onBack}>
    <form className="onboarding-focused-form" onSubmit={onSubmit}>
      <div className="onboarding-name-fields">
        <label>Nama depan<input value={firstName} onChange={event => onFirstName(event.target.value)} required maxLength={100} autoComplete="given-name" /></label>
        <label>Nama belakang<input value={lastName} onChange={event => onLastName(event.target.value)} maxLength={100} autoComplete="family-name" /></label>
      </div>
      <InlineError message={error} />
      <PrimaryAction type="submit">Lanjutkan <ArrowRight aria-hidden="true" size={17} /></PrimaryAction>
    </form>
  </QuestionStage>
}

export function UsernameStage({
  username,
  error,
  validation,
  onUsername,
  onSubmit,
  onBack,
}: {
  username: string
  error: string
  validation: string
  onUsername: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onBack: () => void
}) {
  return <QuestionStage eyebrow="Identitas akun" title="Mau dipanggil apa di Strativate?" description="Ini akan menjadi nama pengguna akunmu." onBack={onBack}>
    <form className="onboarding-focused-form" onSubmit={onSubmit}>
      <label className="onboarding-hero-field">
        <span>Nama pengguna</span>
        <div className="onboarding-input-with-action">
          <input value={username} onChange={event => onUsername(event.target.value)} required minLength={3} maxLength={30} autoComplete="username" aria-describedby={validation ? 'username-feedback' : undefined} />
          <button type="submit" aria-label="Lanjutkan dari nama pengguna"><ArrowRight aria-hidden="true" size={20} /></button>
        </div>
      </label>
      {validation && <p id="username-feedback" className="onboarding-field-feedback">{validation}</p>}
      <InlineError message={error} />
    </form>
  </QuestionStage>
}

export function PasswordStage({
  registrationMethod,
  passwordSaved,
  editingPassword,
  password,
  confirmation,
  busy,
  error,
  onPassword,
  onConfirmation,
  onEditPassword,
  onCancelEdit,
  onSubmit,
  onSkipGoogle,
  onBack,
}: {
  registrationMethod: RegistrationMethod
  passwordSaved: boolean
  editingPassword: boolean
  password: string
  confirmation: string
  busy: boolean
  error: string
  onPassword: (value: string) => void
  onConfirmation: (value: string) => void
  onEditPassword: () => void
  onCancelEdit: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSkipGoogle: () => void
  onBack: () => void
}) {
  const google = registrationMethod === 'google'
  const showInputs = editingPassword || (!passwordSaved && !google)

  if (!showInputs && google && !passwordSaved) {
    return <QuestionStage eyebrow="Keamanan akun" title="Akun Google-mu sudah siap." description="Kamu bisa menambahkan kata sandi sekarang atau melakukannya nanti." onBack={onBack}>
      <div className="onboarding-action-stack">
        <PrimaryAction onClick={onEditPassword}>Tambahkan kata sandi</PrimaryAction>
        <button type="button" className="onboarding-text-action" disabled={busy} onClick={onSkipGoogle}>Lewati</button>
        <InlineError message={error} />
      </div>
    </QuestionStage>
  }

  if (!showInputs && passwordSaved) {
    return <QuestionStage eyebrow="Keamanan akun" title="Kata sandi akunmu sudah siap." description={google ? 'Kamu bisa masuk dengan Google atau email dan kata sandi.' : 'Kita bisa lanjut menggunakan kata sandi akun yang sudah tersimpan.'} onBack={onBack}>
      <form className="onboarding-action-stack" onSubmit={onSubmit}>
        <PrimaryAction type="submit" disabled={busy}>{busy ? 'Menyimpan…' : <>Lanjutkan <ArrowRight aria-hidden="true" size={17} /></>}</PrimaryAction>
        <button type="button" className="onboarding-text-action" disabled={busy} onClick={onEditPassword}>Ubah kata sandi</button>
        <InlineError message={error} />
      </form>
    </QuestionStage>
  }

  return <QuestionStage eyebrow="Keamanan akun" title={passwordSaved ? 'Mau mengganti kata sandimu?' : 'Sekarang, amankan akunmu.'} description={google ? 'Kata sandi ini opsional untuk akun Google, tapi bisa menjadi cara masuk cadangan.' : 'Gunakan minimal 8 karakter.'} onBack={onBack}>
    <form className="onboarding-focused-form" onSubmit={onSubmit}>
      <PasswordInput label={passwordSaved ? 'Kata sandi baru' : 'Kata sandi'} value={password} onChange={event => onPassword(event.target.value)} minLength={8} maxLength={128} required={!google || editingPassword} autoComplete="new-password" disabled={busy} />
      <PasswordInput label="Konfirmasi kata sandi" value={confirmation} onChange={event => onConfirmation(event.target.value)} required={!google || !!password} autoComplete="new-password" disabled={busy} />
      <InlineError message={error} />
      <PrimaryAction type="submit" disabled={busy}>{busy ? 'Menyimpan…' : <>Lanjutkan <ArrowRight aria-hidden="true" size={17} /></>}</PrimaryAction>
      {passwordSaved && <button type="button" className="onboarding-text-action" disabled={busy} onClick={onCancelEdit}>Batal ubah kata sandi</button>}
      {google && !passwordSaved && <button type="button" className="onboarding-text-action" disabled={busy} onClick={onSkipGoogle}>Lewati tanpa kata sandi</button>}
    </form>
  </QuestionStage>
}

export function InstitutionStage({
  institution,
  busy,
  error,
  onInstitution,
  onContinue,
}: {
  institution: Institution | null
  busy: boolean
  error: string
  onInstitution: (institution: Institution | null) => void
  onContinue: () => void
}) {
  return <QuestionStage eyebrow="Tempat belajar" title="Saat ini kamu belajar di mana?" description="Cari universitas, SMA, atau SMK-mu.">
    <div className="onboarding-focused-form">
      <InstitutionPicker selected={institution} onSelect={onInstitution} disabled={busy} />
      <InlineError message={error} />
      {institution && <PrimaryAction onClick={onContinue}>Lanjutkan <ArrowRight aria-hidden="true" size={17} /></PrimaryAction>}
    </div>
  </QuestionStage>
}

export function MajorStage({
  institutionName,
  major,
  error,
  onMajor,
  onSubmit,
  onSkip,
  onBack,
}: {
  institutionName: string
  major: string
  error: string
  onMajor: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSkip: () => void
  onBack: () => void
}) {
  return <QuestionStage eyebrow={institutionName} title="Kamu mengambil jurusan atau fakultas apa?" description="Kalau tidak relevan, bagian ini boleh dilewati." onBack={onBack}>
    <form className="onboarding-focused-form" onSubmit={onSubmit}>
      <label className="onboarding-hero-field">
        <span>Jurusan / fakultas</span>
        <input value={major} onChange={event => onMajor(event.target.value)} maxLength={150} autoComplete="organization-title" placeholder="Contoh: Teknik Informatika" />
      </label>
      <InlineError message={error} />
      <PrimaryAction type="submit">Lanjutkan <ArrowRight aria-hidden="true" size={17} /></PrimaryAction>
      <button type="button" className="onboarding-text-action" onClick={onSkip}>Lewati</button>
    </form>
  </QuestionStage>
}

export function CohortStage({
  institutionName,
  cohort,
  busy,
  error,
  onCohort,
  onSubmit,
  onSkip,
  onBack,
}: {
  institutionName: string
  cohort: string
  busy: boolean
  error: string
  onCohort: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSkip: () => void
  onBack: () => void
}) {
  return <QuestionStage eyebrow={institutionName} title="Kamu mulai di sana tahun berapa?" description="Tahun angkatan membantu kami memahami perjalananmu. Bagian ini opsional." onBack={onBack}>
    <form className="onboarding-focused-form" onSubmit={onSubmit}>
      <label className="onboarding-hero-field">
        <span>Tahun angkatan</span>
        <input type="number" value={cohort} onChange={event => onCohort(event.target.value)} min={1950} max={new Date().getFullYear() + 1} step={1} inputMode="numeric" placeholder="2022" />
      </label>
      <InlineError message={error} />
      <PrimaryAction type="submit" disabled={busy}>{busy ? 'Menyimpan…' : <>Simpan & lanjutkan <ArrowRight aria-hidden="true" size={17} /></>}</PrimaryAction>
      <button type="button" className="onboarding-text-action" disabled={busy} onClick={onSkip}>Lewati dan simpan</button>
    </form>
  </QuestionStage>
}

export function ReferralStage({
  referrals,
  selected,
  otherText,
  busy,
  error,
  onChoose,
  onOther,
  onOtherText,
  onSubmitOther,
}: {
  referrals: MasterOption[]
  selected: string
  otherText: string
  busy: boolean
  error: string
  onChoose: (id: string) => void
  onOther: () => void
  onOtherText: (value: string) => void
  onSubmitOther: (event: FormEvent<HTMLFormElement>) => void
}) {
  return <QuestionStage eyebrow="Satu hal lagi" title={<>Kamu pertama kali menemukan<br className="onboarding-desktop-break" /> Strativate dari mana?</>} description="Pilih jawaban yang paling sesuai.">
    {referrals.length === 0 ? <InlineError message="Pilihan sumber informasi belum tersedia. Muat ulang halaman untuk mencoba lagi." /> : <div className="onboarding-answer-list">
      {referrals.map(option => {
        const active = selected === option.id
        return <button type="button" className="onboarding-answer-card" data-selected={active || undefined} aria-pressed={active} disabled={busy} key={option.id} onClick={() => onChoose(option.id)}>
          <span>{displayLabel(option.name)}</span>
          {busy && active ? <small>Menyimpan…</small> : active ? <Check aria-hidden="true" size={18} /> : <ArrowRight aria-hidden="true" size={18} />}
        </button>
      })}
      <button type="button" className="onboarding-answer-card" data-selected={selected === 'other' || undefined} aria-pressed={selected === 'other'} disabled={busy} onClick={onOther}>
        <span>Lainnya</span>
        {selected === 'other' ? <Check aria-hidden="true" size={18} /> : <ArrowRight aria-hidden="true" size={18} />}
      </button>
    </div>}

    {selected === 'other' && <form className="onboarding-focused-form onboarding-reveal" onSubmit={onSubmitOther}>
      <label className="onboarding-hero-field">
        <span>Ceritakan dari mana kamu mengenal Strativate.</span>
        <textarea value={otherText} onChange={event => onOtherText(event.target.value)} required maxLength={500} rows={3} />
      </label>
      <PrimaryAction type="submit" disabled={busy}>{busy ? 'Menyimpan…' : <>Lanjutkan <ArrowRight aria-hidden="true" size={17} /></>}</PrimaryAction>
    </form>}
    <InlineError message={error} />
  </QuestionStage>
}

function interestSummary(names: string[]) {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return names.join(' dan ')
  return names.slice(0, 2).join(', ') + ', dan ' + (names.length - 2) + ' lainnya'
}

export function InterestsStage({
  interests,
  selectedIds,
  busy,
  error,
  onToggle,
  onSubmit,
}: {
  interests: MasterOption[]
  selectedIds: string[]
  busy: boolean
  error: string
  onToggle: (id: string, checked: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const selectedNames = interests.filter(option => selectedIds.includes(option.id)).map(option => displayLabel(option.name))
  return <QuestionStage eyebrow="Minatmu" title="Apa yang paling ingin kamu eksplor di Strativate?" description="Pilih satu atau lebih.">
    <form className="onboarding-focused-form" onSubmit={onSubmit}>
      {interests.length === 0 ? <InlineError message="Daftar minat belum tersedia. Muat ulang halaman untuk mencoba lagi." /> : <div className="onboarding-answer-list onboarding-answer-list--interests">
        {interests.map(option => {
          const active = selectedIds.includes(option.id)
          return <label className="onboarding-answer-card onboarding-answer-card--check" data-selected={active || undefined} key={option.id}>
            <input type="checkbox" checked={active} disabled={busy} onChange={event => onToggle(option.id, event.target.checked)} />
            <span>{displayLabel(option.name)}</span>
            {active && <Check aria-hidden="true" size={18} />}
          </label>
        })}
      </div>}
      {selectedNames.length > 0 && <p className="onboarding-selection-note" role="status">{interestSummary(selectedNames)} — sudah kami catat.</p>}
      <InlineError message={error} />
      <PrimaryAction type="submit" disabled={busy || selectedIds.length === 0}>
        {busy ? 'Menyimpan…' : <>Lanjutkan dengan {selectedIds.length} pilihan <ArrowRight aria-hidden="true" size={17} /></>}
      </PrimaryAction>
    </form>
  </QuestionStage>
}

export function TransitionAcknowledgement({ message }: { message: string }) {
  if (!message) return null
  return <div className="onboarding-transition-ack" role="status">
    <CheckCircle2 aria-hidden="true" size={22} />
    <span>{message}</span>
  </div>
}
