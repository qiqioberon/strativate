'use client'

import { type RefObject, useEffect } from 'react'

const CARD_SELECTOR = '.marketing-mentor-marquee__card'
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
/** A focus that lands this soon after a pointer press came from a click, which opens the dialog instead. */
const CLICK_FOCUS_WINDOW_MS = 600
/** Grace period while the pointer crosses the gap between two cards. */
const GAP_CLOSE_DELAY_MS = 140
/** Distance kept between a resting pointer and the edge of the card it opened. */
const POINTER_MARGIN_PX = 14

type OpenSource = 'pointer' | 'focus'

function readPx(style: CSSStyleDeclaration, name: string) {
  return Number.parseFloat(style.getPropertyValue(name)) || 0
}

function animatedOffsetX(style: CSSStyleDeclaration) {
  const transform = style.transform
  if (!transform || transform === 'none') return 0
  try {
    return new DOMMatrixReadOnly(transform).m41
  } catch {
    return 0
  }
}

/**
 * Opens one marquee card at a time (pointer hover or keyboard focus) by setting data-open, which the CSS turns
 * into the width expansion. While a card is open the CSS animation is paused, so the hook can work out where
 * that card rests and nudge the whole track sideways (the --mentor-shift custom property, applied with the
 * standalone `translate` so it never fights the animated `transform`) until the expanded card fits inside the
 * rail. The nudge keeps a resting pointer inside the card, so content moving under the cursor can never hand
 * hover to a neighbour. With reduced motion the rail is a native scroller and no nudge is applied.
 */
export function useMentorMarqueeExpansion(marqueeRef: RefObject<HTMLDivElement | null>, itemCount: number) {
  useEffect(() => {
    const marquee = marqueeRef.current
    const track = marquee?.querySelector<HTMLElement>('.marketing-mentor-marquee__track')
    if (!marquee || !track) return

    const finePointer = window.matchMedia(FINE_POINTER_QUERY)
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY)
    let openCard: HTMLElement | null = null
    let openedBy: OpenSource | null = null
    let focusCard: HTMLElement | null = null
    let closeTimer = 0
    let holdTimer = 0
    let lastPointerX = Number.NaN
    let lastPointerY = Number.NaN
    let lastPointerDown = Number.NEGATIVE_INFINITY

    marquee.setAttribute('data-enhanced', '')

    const setShift = (value: number) => {
      if (Math.abs(value) < 0.5) track.style.removeProperty('--mentor-shift')
      else track.style.setProperty('--mentor-shift', `${value.toFixed(1)}px`)
    }

    const shiftFor = (card: HTMLElement, pointerX: number | null) => {
      if (reducedMotion.matches) return 0
      const style = getComputedStyle(track)
      const width = readPx(style, '--card-w')
      const gap = readPx(style, '--card-gap')
      const openWidth = Math.max(width, readPx(style, '--card-open'))
      const index = Array.prototype.indexOf.call(track.querySelectorAll(CARD_SELECTOR), card)
      if (!width || index < 0) return 0

      // Where the card sits once every other card is collapsed and the track is not nudged.
      const bounds = marquee.getBoundingClientRect()
      const restLeft = bounds.left + marquee.clientLeft + track.offsetLeft + animatedOffsetX(style) + index * (width + gap)
      const viewport = document.documentElement.clientWidth
      const edge = viewport >= 1024 ? Math.max(48, (viewport - 1320) / 2) : viewport > 640 ? 24 : 16
      const minLeft = Math.max(bounds.left, 0) + edge
      const maxRight = Math.min(bounds.right, viewport) - edge

      let shift = 0
      if (restLeft + openWidth > maxRight) shift = maxRight - (restLeft + openWidth)
      else if (restLeft < minLeft) shift = minLeft - restLeft

      if (pointerX !== null) {
        const lowest = pointerX + POINTER_MARGIN_PX - restLeft - openWidth
        const highest = pointerX - POINTER_MARGIN_PX - restLeft
        shift = Math.min(Math.max(shift, lowest), highest)
      }
      return shift
    }

    const open = (card: HTMLElement | null, by: OpenSource, pointerX: number | null) => {
      window.clearTimeout(closeTimer)
      if (card !== openCard) {
        openCard?.removeAttribute('data-open')
        card?.setAttribute('data-open', '')
        openCard = card
      }
      openedBy = card ? by : null
      setShift(card ? shiftFor(card, pointerX) : 0)
    }

    /** Pointer released the rail: fall back to the keyboard-focused card, if any. */
    const closePointer = () => {
      if (openedBy !== 'pointer') return
      if (focusCard && track.contains(focusCard)) open(focusCard, 'focus', null)
      else open(null, 'pointer', null)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !finePointer.matches) return
      // Layout changes under a resting cursor can produce synthetic moves; only real movement changes the card.
      if (event.clientX === lastPointerX && event.clientY === lastPointerY) return
      lastPointerX = event.clientX
      lastPointerY = event.clientY
      const card = event.target instanceof Element ? event.target.closest<HTMLElement>(CARD_SELECTOR) : null
      if (card && track.contains(card)) {
        if (card !== openCard || openedBy !== 'pointer') open(card, 'pointer', event.clientX)
        else window.clearTimeout(closeTimer)
        return
      }
      if (openedBy === 'pointer') {
        window.clearTimeout(closeTimer)
        closeTimer = window.setTimeout(closePointer, GAP_CLOSE_DELAY_MS)
      }
    }

    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      lastPointerX = Number.NaN
      lastPointerY = Number.NaN
      closePointer()
    }

    const onPointerDown = (event: PointerEvent) => {
      lastPointerDown = performance.now()
      if (event.pointerType !== 'touch' || !marquee.contains(event.target as Node)) return
      // Touch has no hover: holding a finger on the rail pauses it so a portrait can be read or tapped.
      window.clearTimeout(holdTimer)
      marquee.setAttribute('data-holding', '')
    }

    const onPointerRelease = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !marquee.hasAttribute('data-holding')) return
      window.clearTimeout(holdTimer)
      holdTimer = window.setTimeout(() => marquee.removeAttribute('data-holding'), 1600)
    }

    const onFocusIn = (event: FocusEvent) => {
      const card = event.target instanceof Element ? event.target.closest<HTMLElement>(CARD_SELECTOR) : null
      if (!card || !track.contains(card)) return
      if (performance.now() - lastPointerDown < CLICK_FOCUS_WINDOW_MS) return
      focusCard = card
      if (openedBy === 'pointer' && openCard && openCard.matches(':hover')) return
      open(card, 'focus', null)
      if (reducedMotion.matches) card.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget
      if (next instanceof Node && track.contains(next)) return
      focusCard = null
      if (openedBy === 'focus') open(null, 'focus', null)
    }

    // Page scroll can carry the rail away from a resting cursor without any pointer event reaching it.
    const onScroll = () => {
      if (openedBy !== 'pointer') return
      const bounds = marquee.getBoundingClientRect()
      const inside = lastPointerX >= bounds.left && lastPointerX <= bounds.right && lastPointerY >= bounds.top && lastPointerY <= bounds.bottom
      if (!inside) closePointer()
    }

    const onResize = () => {
      if (openCard) open(null, 'pointer', null)
    }

    // A card may already hold keyboard focus if it was focused before hydration finished.
    const active = document.activeElement
    if (active instanceof HTMLElement && track.contains(active)) {
      const card = active.closest<HTMLElement>(CARD_SELECTOR)
      if (card && card.matches(':focus-visible')) {
        focusCard = card
        open(card, 'focus', null)
      }
    }

    marquee.addEventListener('pointermove', onPointerMove, { passive: true })
    marquee.addEventListener('pointerleave', onPointerLeave)
    marquee.addEventListener('focusin', onFocusIn)
    marquee.addEventListener('focusout', onFocusOut)
    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
    document.addEventListener('pointerup', onPointerRelease, { capture: true, passive: true })
    document.addEventListener('pointercancel', onPointerRelease, { capture: true, passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      window.clearTimeout(closeTimer)
      window.clearTimeout(holdTimer)
      marquee.removeEventListener('pointermove', onPointerMove)
      marquee.removeEventListener('pointerleave', onPointerLeave)
      marquee.removeEventListener('focusin', onFocusIn)
      marquee.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerdown', onPointerDown, { capture: true })
      document.removeEventListener('pointerup', onPointerRelease, { capture: true })
      document.removeEventListener('pointercancel', onPointerRelease, { capture: true })
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      openCard?.removeAttribute('data-open')
      track.style.removeProperty('--mentor-shift')
      marquee.removeAttribute('data-enhanced')
      marquee.removeAttribute('data-holding')
    }
  }, [marqueeRef, itemCount])
}
