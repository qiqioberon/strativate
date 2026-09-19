'use client'

// Adapted for Strativate from React Bits Card Swap by David Haz.
// Copyright (c) 2026 David Haz · MIT + Commons Clause License Condition v1.0.
// Full third-party notice: /THIRD_PARTY_NOTICES.md

import {
  Children,
  cloneElement,
  createRef,
  forwardRef,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import gsap from 'gsap'

export interface CardSwapProps {
  width?: number | string
  height?: number | string
  cardDistance?: number
  verticalDistance?: number
  delay?: number
  pauseOnHover?: boolean
  skewAmount?: number
  easing?: 'linear' | 'elastic'
  ariaLabel?: string
  activeIndex?: number
  onActiveIndexChange?: (index:number) => void
  children: ReactNode
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  customClass?: string
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ customClass, className, ...rest }, ref) => (
  <div
    ref={ref}
    {...rest}
    className={['rb-card-swap__card', customClass, className].filter(Boolean).join(' ')}
  />
))
Card.displayName = 'Card'

type CardRef = RefObject<HTMLDivElement | null>
type Slot = { x:number; y:number; z:number; zIndex:number }

function slotFor(index:number, distanceX:number, distanceY:number, total:number): Slot {
  return {
    x: index * distanceX,
    y: -index * distanceY,
    z: -index * distanceX * 1.5,
    zIndex: total - index,
  }
}

function placeCard(element:HTMLElement, slot:Slot, skew:number) {
  gsap.set(element, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true,
  })
}

export function CardSwap({
  width = 500,
  height = 400,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = true,
  skewAmount = 6,
  easing = 'elastic',
  ariaLabel = 'Produk Digital pilihan',
  activeIndex,
  onActiveIndexChange,
  children,
}: CardSwapProps) {
  const childArray = useMemo(() => Children.toArray(children) as ReactElement<CardProps>[], [children])
  const refs = useMemo<CardRef[]>(() => childArray.map(() => createRef<HTMLDivElement>()), [childArray])
  const order = useRef<number[]>(Array.from({ length: childArray.length }, (_, index) => index))
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const intervalRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigateRef = useRef<(index:number) => void>(() => undefined)

  useEffect(() => {
    const total = refs.length
    if (!total) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = media.matches
    let hoverPaused = false

    const config = easing === 'elastic'
      ? { ease:'elastic.out(0.6,0.9)', drop:1.15, move:1.15, back:1.15, overlap:.82, returnDelay:.05 }
      : { ease:'power1.inOut', drop:.65, move:.65, back:.65, overlap:.45, returnDelay:.18 }

    const positionAll = () => {
      order.current.forEach((cardIndex, position) => {
        const element = refs[cardIndex]?.current
        if (element) placeCard(element, slotFor(position, cardDistance, verticalDistance, total), skewAmount)
      })
    }

    const stopTimer = () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const swap = () => {
      if (reducedMotion || hoverPaused || order.current.length < 2) return
      const [front, ...rest] = order.current
      const frontElement = refs[front]?.current
      if (!frontElement) return

      timelineRef.current?.kill()
      const timeline = gsap.timeline()
      timelineRef.current = timeline

      timeline.to(frontElement, {
        y: '+=500',
        duration: config.drop,
        ease: config.ease,
      })

      timeline.addLabel('promote', `-=${config.drop * config.overlap}`)
      rest.forEach((cardIndex, position) => {
        const element = refs[cardIndex]?.current
        if (!element) return
        const slot = slotFor(position, cardDistance, verticalDistance, total)
        timeline.set(element, { zIndex:slot.zIndex }, 'promote')
        timeline.to(element, {
          x:slot.x,
          y:slot.y,
          z:slot.z,
          duration:config.move,
          ease:config.ease,
        }, `promote+=${position * .12}`)
      })

      const backSlot = slotFor(total - 1, cardDistance, verticalDistance, total)
      timeline.addLabel('return', `promote+=${config.move * config.returnDelay}`)
      timeline.call(() => {
        gsap.set(frontElement, { zIndex:backSlot.zIndex })
      }, undefined, 'return')
      timeline.to(frontElement, {
        x:backSlot.x,
        y:backSlot.y,
        z:backSlot.z,
        duration:config.back,
        ease:config.ease,
      }, 'return')
      timeline.call(() => {
        const nextOrder = [...rest, front]
        order.current = nextOrder
        onActiveIndexChange?.(nextOrder[0] ?? front)
      })
    }

    const startTimer = () => {
      stopTimer()
      if (!reducedMotion && !hoverPaused && total > 1) {
        intervalRef.current = window.setInterval(swap, delay)
      }
    }

    const navigateTo = (targetIndex:number) => {
      if (targetIndex < 0 || targetIndex >= total) return
      const targetPosition = order.current.indexOf(targetIndex)
      if (targetPosition <= 0) {
        startTimer()
        return
      }

      stopTimer()
      timelineRef.current?.kill()
      const currentOrder = order.current
      const nextOrder = [...currentOrder.slice(targetPosition), ...currentOrder.slice(0, targetPosition)]

      if (reducedMotion) {
        order.current = nextOrder
        positionAll()
        onActiveIndexChange?.(targetIndex)
        startTimer()
        return
      }

      const timeline = gsap.timeline({
        onComplete: () => {
          order.current = nextOrder
          onActiveIndexChange?.(targetIndex)
          startTimer()
        },
      })
      timelineRef.current = timeline

      nextOrder.forEach((cardIndex, position) => {
        const element = refs[cardIndex]?.current
        if (!element) return
        const slot = slotFor(position, cardDistance, verticalDistance, total)
        timeline.set(element, { zIndex:slot.zIndex }, 0)
        timeline.to(element, {
          x:slot.x,
          y:slot.y,
          z:slot.z,
          duration:config.move,
          ease:config.ease,
        }, position * .06)
      })
    }

    navigateRef.current = navigateTo
    positionAll()
    startTimer()

    const node = containerRef.current
    const pause = () => {
      if (!pauseOnHover) return
      hoverPaused = true
      timelineRef.current?.pause()
      stopTimer()
    }
    const resume = () => {
      if (!pauseOnHover) return
      hoverPaused = false
      timelineRef.current?.play()
      startTimer()
    }
    const syncMotion = () => {
      reducedMotion = media.matches
      timelineRef.current?.kill()
      positionAll()
      startTimer()
    }

    node?.addEventListener('mouseenter', pause)
    node?.addEventListener('mouseleave', resume)
    node?.addEventListener('focusin', pause)
    node?.addEventListener('focusout', resume)
    media.addEventListener('change', syncMotion)

    return () => {
      stopTimer()
      timelineRef.current?.kill()
      node?.removeEventListener('mouseenter', pause)
      node?.removeEventListener('mouseleave', resume)
      node?.removeEventListener('focusin', pause)
      node?.removeEventListener('focusout', resume)
      media.removeEventListener('change', syncMotion)
      navigateRef.current = () => undefined
    }
  }, [cardDistance, delay, easing, onActiveIndexChange, pauseOnHover, refs, skewAmount, verticalDistance])

  useEffect(() => {
    if (typeof activeIndex === 'number') navigateRef.current(activeIndex)
  }, [activeIndex])

  const rendered = childArray.map((child, index) => isValidElement<CardProps>(child)
    ? cloneElement(child, {
        key:child.key ?? index,
        ref:refs[index],
        style:{ width, height, ...(child.props.style ?? {}) },
      } as CardProps & { ref: RefObject<HTMLDivElement | null> })
    : child)

  return (
    <div
      ref={containerRef}
      className="rb-card-swap"
      style={{ width, height }}
      role="region"
      aria-label={ariaLabel}
      data-testid="react-bits-card-swap"
    >
      {rendered}
    </div>
  )
}
