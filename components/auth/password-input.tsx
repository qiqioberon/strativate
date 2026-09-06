'use client'

import { useId, useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = Omit<ComponentProps<'input'>, 'type'> & { label: string }

export function PasswordInput({ label, id, disabled, ...props }: Props) {
  const generatedId = useId()
  const inputId = id || generatedId
  const [visible, setVisible] = useState(false)
  const action = `${visible ? 'Sembunyikan' : 'Tampilkan'} ${label.toLowerCase()}`

  return <div className="password-field">
    <label htmlFor={inputId}>{label}</label>
    <div className="password-control">
      <input {...props} id={inputId} type={visible ? 'text' : 'password'} disabled={disabled} />
      <button type="button" className="password-toggle" aria-label={action} aria-controls={inputId}
        aria-pressed={visible} disabled={disabled} onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  </div>
}
