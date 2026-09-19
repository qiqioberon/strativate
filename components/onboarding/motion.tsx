'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { OnboardingScene } from './types'

type RoutePhase = 'idle' | 'exit' | 'enter' | 'final-exit'

type MotionContextValue = {
  scene: OnboardingScene
  routePhase: RoutePhase
  finalMessage: string
  navigating: boolean
  reducedMotion: boolean
  setScene: (scene: OnboardingScene) => void
  beginRoute: (href: string, options?: { finalMessage?: string }) => boolean
  completeRouteExit: () => void
  completeRouteEnter: () => void
}

const MotionContext = createContext<MotionContextValue | null>(null)

export function OnboardingMotionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [scene, setScene] = useState<OnboardingScene>('welcome')
  const [routePhase, setRoutePhase] = useState<RoutePhase>('idle')
  const [finalMessage, setFinalMessage] = useState('')
  const [reducedMotion, setReducedMotion] = useState(false)
  const targetRef = useRef<string | null>(null)
  const navigatingRef = useRef(false)
  const previousPathRef = useRef(pathname)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (previousPathRef.current === pathname) return
    previousPathRef.current = pathname
    targetRef.current = null
    navigatingRef.current = false
    setFinalMessage('')
    setRoutePhase(reducedMotion ? 'idle' : 'enter')
  }, [pathname, reducedMotion])

  const beginRoute = useCallback((href: string, options?: { finalMessage?: string }) => {
    if (navigatingRef.current) return false
    navigatingRef.current = true
    if (reducedMotion) {
      router.push(href)
      return true
    }
    targetRef.current = href
    setFinalMessage(options?.finalMessage || '')
    setRoutePhase(options?.finalMessage ? 'final-exit' : 'exit')
    return true
  }, [reducedMotion, router])

  const completeRouteExit = useCallback(() => {
    const href = targetRef.current
    if (href) router.push(href)
  }, [router])

  const completeRouteEnter = useCallback(() => {
    setRoutePhase('idle')
  }, [])

  const value = useMemo<MotionContextValue>(() => ({
    scene,
    routePhase,
    finalMessage,
    navigating: routePhase === 'exit' || routePhase === 'final-exit',
    reducedMotion,
    setScene,
    beginRoute,
    completeRouteExit,
    completeRouteEnter,
  }), [scene, routePhase, finalMessage, reducedMotion, beginRoute, completeRouteExit, completeRouteEnter])

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
}

export function useOnboardingMotion() {
  const value = useContext(MotionContext)
  if (!value) throw new Error('Onboarding motion context is missing.')
  return value
}

export function OnboardingRouteStage({
  children,
  scene,
  className = '',
}: {
  children: ReactNode
  scene: OnboardingScene
  className?: string
}) {
  const { routePhase, setScene, completeRouteExit, completeRouteEnter } = useOnboardingMotion()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setScene(scene)
  }, [scene, setScene])

  useEffect(() => {
    if (routePhase !== 'enter') return
    requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }))
  }, [routePhase])

  return <div
    ref={ref}
    className={'onboarding-route-stage ' + className}
    data-route-phase={routePhase}
    tabIndex={-1}
    inert={routePhase === 'exit' || routePhase === 'final-exit'}
    aria-hidden={routePhase === 'exit' || routePhase === 'final-exit' ? true : undefined}
    onAnimationEnd={event => {
      if (event.currentTarget !== event.target) return
      if (routePhase === 'exit' || routePhase === 'final-exit') completeRouteExit()
      else if (routePhase === 'enter') completeRouteEnter()
    }}
  >{children}</div>
}

function shouldHandle(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

export function OnboardingRouteLink({
  href,
  children,
  className,
  finalMessage,
  ariaLabel,
}: {
  href: string
  children: ReactNode
  className?: string
  finalMessage?: string
  ariaLabel?: string
}) {
  const router = useRouter()
  const { beginRoute, navigating } = useOnboardingMotion()

  useEffect(() => {
    router.prefetch(href)
  }, [href, router])

  return <a
    href={href}
    className={className}
    aria-label={ariaLabel}
    aria-disabled={navigating || undefined}
    onClick={event => {
      if (!shouldHandle(event) || navigating) return
      event.preventDefault()
      beginRoute(href, { finalMessage })
    }}
  >{children}</a>
}
