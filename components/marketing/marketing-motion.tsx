'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { usePageMotionReady } from '@/components/navigation/use-page-motion-ready'

export function MarketingMotion() {
  const pathname = usePathname()
  const motionReady = usePageMotionReady()

  useEffect(() => {
    if (!motionReady) return

    const elements = Array.from(document.querySelectorAll<HTMLElement>('.marketing-site [data-reveal]'))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [motionReady, pathname])

  return null
}
