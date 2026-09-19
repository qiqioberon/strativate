'use client'

// Adapted for Strativate from React Bits Text Type, Split Text, and Blur Text.
// Copyright (c) 2026 David Haz · MIT + Commons Clause License Condition v1.0.
// Full third-party notice: /THIRD_PARTY_NOTICES.md

import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { usePageMotionReady } from '@/components/navigation/use-page-motion-ready'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function SplitText({
  text,
  className = '',
  delay = 56,
  duration = .9,
  startDelay = 0,
}: {
  text: string
  className?: string
  delay?: number
  duration?: number
  startDelay?: number
}) {
  const rootRef = useRef<HTMLHeadingElement>(null)
  const words = useMemo(() => text.split(' '), [text])
  const motionReady = usePageMotionReady()

  useEffect(() => {
    if (!motionReady) return

    const root = rootRef.current
    if (!root) return
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-split-unit]'))
    gsap.killTweensOf(targets)

    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      gsap.set(targets, { opacity: 1, y: 0, filter: 'blur(0px)' })
      return
    }

    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y: 24, filter: 'blur(5px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration,
        delay: startDelay,
        ease: 'power3.out',
        stagger: delay / 1000,
        force3D: true,
      },
    )
    return () => {
      tween.kill()
    }
  }, [delay, duration, motionReady, startDelay, text])

  return (
    <h1
      ref={rootRef}
      className={['rb-split-text', className].filter(Boolean).join(' ')}
      aria-label={text}
      data-react-bits-text="split"
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden="true">
          <span data-split-unit style={motionReady ? undefined : { opacity: 0 }}>{word}</span>
          {index < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </h1>
  )
}

export function BlurText({
  text,
  className = '',
  delay = 46,
  duration = .72,
  startDelay = 0,
}: {
  text: string
  className?: string
  delay?: number
  duration?: number
  startDelay?: number
}) {
  const rootRef = useRef<HTMLParagraphElement>(null)
  const words = useMemo(() => text.split(' '), [text])
  const motionReady = usePageMotionReady()

  useEffect(() => {
    if (!motionReady) return

    const root = rootRef.current
    if (!root) return
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-blur-unit]'))
    gsap.killTweensOf(targets)

    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      gsap.set(targets, { opacity: 1, y: 0, filter: 'blur(0px)' })
      return
    }

    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y: 12, filter: 'blur(9px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration,
        delay: startDelay,
        ease: 'power2.out',
        stagger: delay / 1000,
        force3D: true,
      },
    )
    return () => {
      tween.kill()
    }
  }, [delay, duration, motionReady, startDelay, text])

  return (
    <p
      ref={rootRef}
      className={['rb-blur-text', className].filter(Boolean).join(' ')}
      aria-label={text}
      data-react-bits-text="blur"
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden="true">
          <span data-blur-unit style={motionReady ? undefined : { opacity: 0 }}>{word}</span>
          {index < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </p>
  )
}

export function TextType({
  text,
  className = '',
  typingSpeed = 44,
  deletingSpeed = 24,
  pauseDuration = 1450,
  initialDelay = 520,
}: {
  text: string[]
  className?: string
  typingSpeed?: number
  deletingSpeed?: number
  pauseDuration?: number
  initialDelay?: number
}) {
  const textArray = useMemo(() => text.filter(Boolean), [text])
  const [displayedText, setDisplayedText] = useState('')
  const [textIndex, setTextIndex] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const motionReady = usePageMotionReady()

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const cursor = cursorRef.current
    if (!motionReady || !cursor || reducedMotion) return
    const tween = gsap.to(cursor, {
      opacity: 0,
      duration: .48,
      repeat: -1,
      yoyo: true,
      ease: 'power2.inOut',
    })
    return () => {
      tween.kill()
    }
  }, [motionReady, reducedMotion])

  useEffect(() => {
    if (!motionReady || reducedMotion || textArray.length === 0) return

    const current = textArray[textIndex] ?? ''
    let timeout: ReturnType<typeof setTimeout> | undefined

    if (!deleting && displayedText.length < current.length) {
      timeout = setTimeout(
        () => setDisplayedText(current.slice(0, displayedText.length + 1)),
        displayedText.length === 0 ? initialDelay : typingSpeed,
      )
    } else if (!deleting) {
      timeout = setTimeout(() => setDeleting(true), pauseDuration)
    } else if (displayedText.length > 0) {
      timeout = setTimeout(
        () => setDisplayedText(value => value.slice(0, -1)),
        deletingSpeed,
      )
    } else {
      setDeleting(false)
      setTextIndex(index => (index + 1) % textArray.length)
    }

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [
    deleting,
    deletingSpeed,
    displayedText,
    initialDelay,
    pauseDuration,
    reducedMotion,
    motionReady,
    textArray,
    textIndex,
    typingSpeed,
  ])

  const visibleText = motionReady
    ? (reducedMotion ? (textArray[0] ?? '') : displayedText)
    : ''

  return (
    <span
      className={['rb-text-type', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      data-react-bits-text="type"
    >
      <span className="rb-text-type__content">{visibleText}</span>
      {motionReady && !reducedMotion && <span ref={cursorRef} className="rb-text-type__cursor">|</span>}
    </span>
  )
}
