'use client'

import { Palette, Search, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { eventParticipantName, personColor, personKey, type CalendarLocale, type EventItem } from '@/lib/calendar/presentation'
import { CALENDAR_PAGE_SIZE, CalendarPagination } from './calendar-views'

export function CalendarLegend({ events, showGoogle, locale = 'id-ID' }: { events: EventItem[]; showGoogle: boolean; locale?: CalendarLocale }) {
  const english = locale === 'en-GB'
  const popupId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [position, setPosition] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const people = useMemo(() => {
    const entries = new Map<string, { id: string; name: string; color: string; context: string }>()
    for (const event of events) {
      if (event.source !== 'strativate') continue
      const id = personKey(event)
      entries.set(id, { id, name: eventParticipantName(event, locale) || (english ? 'Participant' : 'Peserta'), color: personColor(event, locale), context: event.menteeEmail || event.focusName || '' })
    }
    const sorted = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, locale) || a.id.localeCompare(b.id))
    const counts = new Map<string, number>()
    const indexes = new Map<string, number>()
    for (const person of sorted) counts.set(person.name, (counts.get(person.name) || 0) + 1)
    return sorted.map(person => {
      const index = (indexes.get(person.name) || 0) + 1
      indexes.set(person.name, index)
      return { ...person, clarification: (counts.get(person.name) || 0) > 1 ? `${english ? 'Participant' : 'Peserta'} ${index}${person.context ? ` · ${person.context}` : ''}` : '' }
    })
  }, [events, english, locale])
  const matches = people.filter(person => `${person.name} ${person.context}`.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(matches.length / CALENDAR_PAGE_SIZE)))
  const offset = (currentPage - 1) * CALENDAR_PAGE_SIZE

  useLayoutEffect(() => {
    if (!open) return
    const positionPopup = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const anchor = trigger.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportTop = viewport?.offsetTop ?? 0
      const width = viewport?.width ?? window.innerWidth
      const height = viewport?.height ?? window.innerHeight
      const popupWidth = Math.min(360, width - 24)
      const anchorBottom = Math.max(viewportTop + 12, Math.min(anchor.bottom, viewportTop + height - 12))
      const anchorTop = Math.max(viewportTop + 12, Math.min(anchor.top, viewportTop + height - 12))
      const below = Math.max(0, viewportTop + height - anchorBottom - 20)
      const above = Math.max(0, anchorTop - viewportTop - 20)
      const placeBelow = below >= 240 || below >= above
      const popupHeight = Math.min(460, placeBelow ? below : above)
      setPosition({
        width: popupWidth,
        left: Math.max(viewportLeft + 12, Math.min(anchor.right - popupWidth, viewportLeft + width - popupWidth - 12)),
        top: placeBelow ? anchorBottom + 8 : 'auto',
        bottom: placeBelow ? 'auto' : window.innerHeight - anchorTop + 8,
        maxHeight: popupHeight,
      })
    }
    positionPopup()
    window.addEventListener('resize', positionPopup)
    window.addEventListener('scroll', positionPopup, { capture: true, passive: true })
    window.visualViewport?.addEventListener('resize', positionPopup)
    window.visualViewport?.addEventListener('scroll', positionPopup)
    return () => {
      window.removeEventListener('resize', positionPopup)
      window.removeEventListener('scroll', positionPopup, true)
      window.visualViewport?.removeEventListener('resize', positionPopup)
      window.visualViewport?.removeEventListener('scroll', positionPopup)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      const popup = popupRef.current
      const firstControl = popup?.querySelector<HTMLInputElement>('input') || popup?.querySelector<HTMLButtonElement>('button')
      firstControl?.focus({ preventScroll: true })
    }
  }, [open])

  function close() {
    popupRef.current?.hidePopover()
    triggerRef.current?.focus()
  }

  return <div className="calendar-legend-menu">
    <button className="calendar-legend-trigger" type="button" ref={triggerRef} aria-haspopup="dialog" aria-expanded={open} aria-controls={popupId} popoverTarget={popupId}>
      <Palette aria-hidden="true" />{english ? 'Legend' : 'Legenda'}<span>{people.length + Number(showGoogle)}</span>
    </button>
    <div id={popupId} className="calendar-legend-popover" popover="auto" ref={popupRef}
      role="dialog" aria-label={english ? 'Calendar legend' : 'Legenda kalender'} style={position}
      onToggle={event => {
        const isOpen = event.currentTarget.matches(':popover-open')
        setOpen(isOpen)
        if (!isOpen && event.currentTarget.contains(document.activeElement)) triggerRef.current?.focus()
      }}>
      <div className="calendar-legend-popover__head">
        <div><strong>{english ? 'Calendar legend' : 'Legenda kalender'}</strong><small>{people.length} {english ? 'participants' : 'peserta'}{showGoogle ? english ? ' · 1 external source' : ' · 1 sumber eksternal' : ''}</small></div>
        <button className="icon-button" type="button" aria-label={english ? 'Close legend' : 'Tutup legenda'} onClick={close}><X aria-hidden="true" /></button>
      </div>
      {people.length > 8 || query ? <label className="calendar-legend-search calendar-search"><Search aria-hidden="true" /><input type="search" value={query} aria-label={english ? 'Search participants in the legend' : 'Cari peserta di legenda'} placeholder={english ? 'Search participants' : 'Cari peserta'} onChange={event => { setQuery(event.target.value); setPage(1) }} /></label> : null}
      <div className="calendar-legend-list">{matches.slice(offset, offset + CALENDAR_PAGE_SIZE).map(person => <div key={person.id}>
        <i style={{ backgroundColor: person.color }} aria-hidden="true" /><span title={person.name}>{person.name}{person.clarification ? <small>{person.clarification}</small> : null}</span>
      </div>)}{!matches.length ? <p>{query.trim() ? english ? 'No participants found.' : 'Peserta tidak ditemukan.' : english ? 'No participants in this period.' : 'Belum ada peserta pada rentang ini.'}</p> : null}</div>
      {showGoogle ? <div className="calendar-legend-external"><i className="calendar-legend__google" aria-hidden="true" /><span>{english ? 'External Google Calendar' : 'Google Calendar eksternal'}</span></div> : null}
      {matches.length > CALENDAR_PAGE_SIZE ? <div className="calendar-legend-footer"><small>{offset + 1}–{Math.min(offset + CALENDAR_PAGE_SIZE, matches.length)} {english ? 'of' : 'dari'} {matches.length}</small><CalendarPagination page={currentPage} total={matches.length} onChange={setPage} label={english ? 'Legend pages' : 'Halaman legenda'} locale={locale} /></div> : null}
    </div>
  </div>
}
