'use client'

import { useEffect, useState } from 'react'

export const PAGE_MOTION_BLOCKER_SELECTOR = '[data-page-motion-blocker="true"]'

export function usePageMotionReady() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let frame: number | null = null

    const sync = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
        frame = null
      }

      if (document.querySelector(PAGE_MOTION_BLOCKER_SELECTOR)) {
        setReady(false)
        return
      }

      frame = window.requestAnimationFrame(() => {
        frame = null
        setReady(true)
      })
    }

    sync()

    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return ready
}
