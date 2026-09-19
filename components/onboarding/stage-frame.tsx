import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { BlurText, SplitText } from '@/components/animations/react-bits-text'
import { progressForStage, type VisualStage } from './types'

export function OnboardingProgress({ stage }: { stage: VisualStage }) {
  const current = progressForStage(stage)
  const maximum = 8
  if (stage === 'welcome') return <div className="onboarding-progress-minimal onboarding-progress-minimal--welcome" aria-hidden="true" />

  return <div className="onboarding-progress-minimal" role="progressbar" aria-label="Progres pengenalan Strativate" aria-valuemin={1} aria-valuemax={maximum} aria-valuenow={current}>
    <span className="sr-only">{current} dari {maximum} bagian</span>
    <div className="onboarding-progress-minimal__dots" aria-hidden="true">
      {Array.from({ length: maximum }, (_, index) => <span key={index} data-state={index < current - 1 ? 'filled' : index === current - 1 ? 'current' : 'empty'} />)}
    </div>
  </div>
}

export function QuestionStage({
  eyebrow,
  title,
  description,
  children,
  backLabel = 'Kembali',
  onBack,
  align = 'center',
  interactionMotion = 'wrapper',
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  backLabel?: string
  onBack?: () => void
  align?: 'center' | 'left'
  interactionMotion?: 'wrapper' | 'list'
}) {
  return <section className="onboarding-question" data-align={align}>
    <header className="onboarding-question__copy">
      {eyebrow && <p className="onboarding-eyebrow">{eyebrow}</p>}
      {typeof title === 'string'
        ? <SplitText text={title} className="onboarding-question__animated-title" />
        : <h1>{title}</h1>}
      {description && (typeof description === 'string'
        ? <BlurText text={description} className="onboarding-question__description onboarding-question__animated-description" />
        : <p className="onboarding-question__description">{description}</p>)}
    </header>
    <div className="onboarding-question__interaction" data-motion={interactionMotion}>{children}</div>
    {onBack && <button type="button" className="onboarding-back" onClick={onBack}>
      <ArrowLeft aria-hidden="true" size={16} /> {backLabel}
    </button>}
  </section>
}

export function InlineError({ message }: { message: string }) {
  if (!message) return null
  return <p className="onboarding-error" role="alert">{message}</p>
}

export function PrimaryAction({
  children,
  disabled,
  type = 'button',
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
}) {
  return <button type={type} className="onboarding-primary-action" disabled={disabled} onClick={onClick}>{children}</button>
}
