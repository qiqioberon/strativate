'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function CopyTextButton({
  value,
  label,
  copiedLabel,
  language = 'id',
  className = '',
}: {
  value: string
  label?: string
  copiedLabel?: string
  className?: string
  language?: 'id' | 'en'
}) {
  const actionLabel = label ?? (language === 'en' ? 'Copy' : 'Salin')
  const successLabel = copiedLabel ?? (language === 'en' ? 'Copied' : 'Disalin')
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      className={`copy-action ${className}`.trim()}
      onClick={() => void copy()}
      aria-label={copied ? successLabel : actionLabel}
      title={copied ? successLabel : actionLabel}
      data-copy-state={copied ? 'copied' : 'idle'}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{copied ? successLabel : actionLabel}</span>
    </button>
  )
}
