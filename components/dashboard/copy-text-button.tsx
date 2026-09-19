'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function CopyTextButton({
  value,
  label = 'Salin',
  copiedLabel = 'Disalin',
  className = '',
}: {
  value: string
  label?: string
  copiedLabel?: string
  className?: string
}) {
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
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      data-copy-state={copied ? 'copied' : 'idle'}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  )
}
