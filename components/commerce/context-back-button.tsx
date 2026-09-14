'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function ContextBackButton({ fallbackHref, onBack, label = 'Kembali' }: { fallbackHref: string; onBack?: () => void; label?: string }) {
  const router = useRouter()

  function goBack() {
    if (onBack) {
      onBack()
      return
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(fallbackHref)
  }

  return <button type="button" className="commerce-back-button" onClick={goBack}><ArrowLeft aria-hidden="true" size={16} />{label}</button>
}
