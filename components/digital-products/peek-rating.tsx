'use client'

import { Star } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

type Props = {
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  readOnly?: boolean
  disabled?: boolean
  size?: number
  ariaLabel?: string
  className?: string
  language?: 'id' | 'en'
}

export function PeekRating({ value: valueProp, defaultValue = 0, onChange, readOnly = false, disabled = false, size = 30, ariaLabel = 'Rating', className = '', language = 'id' }: Props) {
  const [inner, setInner] = useState(defaultValue)
  const value = Math.min(5, Math.max(0, valueProp ?? inner))
  const interactive = !readOnly && !disabled
  const rootRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const stars = useRef<(HTMLButtonElement | null)[]>([])
  const lifts = useRef<(HTMLSpanElement | null)[]>([])
  const glyphs = useRef<(HTMLSpanElement | null)[]>([])
  const hover = useRef<number | null>(null)
  const pressing = useRef(false)
  const pointerId = useRef<number | null>(null)
  const rect = useRef<DOMRect | null>(null)

  const paint = useCallback(() => {
    const shown = hover.current === null ? value : hover.current + 1
    for (let i = 0; i < 5; i++) {
      if (glyphs.current[i]) glyphs.current[i]!.dataset.lit = String(i < shown)
      if (lifts.current[i]) lifts.current[i]!.style.transform = hover.current !== null && i <= hover.current ? `translateY(-6px) scale(${i === hover.current ? 1.15 : 1})` : 'translateY(0) scale(1)'
    }
  }, [value])
  useLayoutEffect(paint, [paint])
  const setHover = useCallback((next: number | null) => { hover.current = next; paint() }, [paint])
  const measure = () => { if (rowRef.current) rect.current = rowRef.current.getBoundingClientRect() }
  const indexAt = (x: number, y: number) => {
    const box = rect.current
    if (!box?.width) return null
    if (pressing.current && (y < box.top - size || y > box.bottom + size)) return null
    return Math.min(4, Math.max(0, Math.floor(((x - box.left) / box.width) * 5)))
  }
  const commit = (next: number) => { if (valueProp === undefined) setInner(next); onChange?.(next); hover.current = null; paint() }
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId); pointerId.current = event.pointerId; pressing.current = true; measure(); setHover(indexAt(event.clientX, event.clientY))
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || (!pressing.current && event.pointerType !== 'mouse')) return
    if (pressing.current && event.pointerId !== pointerId.current) return
    if (!rect.current) measure(); setHover(indexAt(event.clientX, event.clientY))
  }
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pressing.current || event.pointerId !== pointerId.current) return
    pressing.current = false; pointerId.current = null
    if (hover.current !== null) commit(hover.current + 1)
    if (event.pointerType !== 'mouse') setHover(null)
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    let next = value
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, value + 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(1, value - 1)
    else if (event.key === 'Home') next = 1
    else if (event.key === 'End') next = 5
    else if (event.key === 'Delete' || event.key === 'Backspace') next = 0
    else if (event.key === 'Enter' || event.key === ' ') { const index = stars.current.indexOf(event.target as HTMLButtonElement); if (index < 0) return; next = index + 1 }
    else return
    event.preventDefault(); commit(next); stars.current[Math.max(0, next - 1)]?.focus()
  }

  useEffect(() => { const reset = () => { pressing.current = false; pointerId.current = null; hover.current = null; paint() }; window.addEventListener('blur', reset); return () => window.removeEventListener('blur', reset) }, [paint])
  return <div ref={rootRef} className={`peek-rating ${className}`} role={readOnly ? 'img' : 'radiogroup'} aria-label={readOnly ? `${value} of 5` : ariaLabel} aria-disabled={disabled || undefined} style={{ '--peek-size': `${size}px` } as CSSProperties} onKeyDown={onKeyDown}>
    <div ref={rowRef} className="peek-rating__row" onPointerEnter={measure} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={() => { if (!pressing.current) setHover(null) }}>
      {Array.from({ length: 5 }, (_, index) => <button key={index} ref={element => { stars.current[index] = element }} type="button" className="peek-rating__star" role={readOnly ? undefined : 'radio'} aria-checked={readOnly ? undefined : value === index + 1} aria-label={readOnly ? undefined : `${index + 1} ${language === 'en' ? 'of' : 'dari'} 5`} aria-hidden={readOnly || undefined} tabIndex={readOnly ? -1 : value === 0 ? (index === 0 ? 0 : -1) : value === index + 1 ? 0 : -1} disabled={readOnly || disabled}><span ref={element => { lifts.current[index] = element }} className="peek-rating__lift"><span ref={element => { glyphs.current[index] = element }} className="peek-rating__glyph"><Star size={size} fill="currentColor" /></span></span></button>)}
    </div>
  </div>
}
