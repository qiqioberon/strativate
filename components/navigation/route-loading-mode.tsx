'use client'

import { useEffect } from 'react'

const CLIENT_READY_ATTRIBUTE = 'data-strativate-client-ready'

export function RouteLoadingMode() {
  useEffect(() => {
    document.documentElement.setAttribute(CLIENT_READY_ATTRIBUTE, 'true')

    return () => {
      document.documentElement.removeAttribute(CLIENT_READY_ATTRIBUTE)
    }
  }, [])

  return null
}
