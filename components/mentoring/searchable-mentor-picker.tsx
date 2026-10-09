'use client'

import { Check, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

type MentorOption = { id: string; name: string }

export function SearchableMentorPicker({ mentors, value, onChange, label = 'Mentor', placeholder, selectedLabel, disabled = false, language = 'id' }: {
  mentors: readonly MentorOption[]
  value: string
  onChange: (id: string) => void
  label?: string
  placeholder?: string
  selectedLabel?: string | null
  disabled?: boolean
  language?: 'id' | 'en'
}) {
  const english = language === 'en'
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const selectedName = mentors.find(mentor => mentor.id === value)?.name || selectedLabel || ''
  const options = mentors.filter(mentor => mentor.name.toLocaleLowerCase('id-ID').includes(query.trim().toLocaleLowerCase('id-ID')))
  const activeIndex = Math.min(active, Math.max(0, options.length - 1))

  useEffect(() => {
    if (open) rootRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, query])

  function choose(mentor: MentorOption) {
    onChange(mentor.id)
    setOpen(false)
    setQuery('')
  }

  return <div ref={rootRef} className="ops-field mentor-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <label htmlFor={id}>{label}</label>
    <div className="ops-input-with-icon">
      <Search aria-hidden="true" size={15}/>
      <input id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open}
        aria-controls={id + '-options'} aria-activedescendant={open && options.length ? id + '-option-' + activeIndex : undefined}
        disabled={disabled} placeholder={placeholder ?? (english ? 'Search mentor name' : 'Cari nama mentor')} value={open ? query : selectedName}
        onFocus={() => { setOpen(true); setQuery(''); setActive(Math.max(0, mentors.findIndex(mentor => mentor.id === value))) }}
        onClick={() => { if (!open) { setOpen(true); setQuery(''); setActive(0) } }}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true) }}
        onKeyDown={event => {
          if (event.key === 'Escape') { if (open) { event.preventDefault(); event.stopPropagation() } setOpen(false); return }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) { setOpen(true); setQuery(''); setActive(0); return }
            setActive(current => Math.max(0, Math.min(options.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))))
          } else if (event.key === 'Enter' && open) {
            event.preventDefault()
            if (options[activeIndex]) choose(options[activeIndex])
          }
        }}/>
    </div>
    {open ? <div id={id + '-options'} role="listbox" aria-label={label} className="ops-combobox-options">
      {options.length ? options.map((mentor, index) => <button key={mentor.id} id={id + '-option-' + index}
        type="button" role="option" tabIndex={-1} aria-selected={mentor.id === value} data-active={index === activeIndex}
        className={index === activeIndex ? 'is-active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => choose(mentor)}>
        <strong>{mentor.name}</strong>{mentor.id === value ? <Check aria-hidden="true" size={14}/> : null}
      </button>) : <p>{mentors.length ? (english ? 'No matching mentors. Try another name.' : 'Tidak ada mentor yang cocok. Coba nama lain.') : (english ? 'No mentors available.' : 'Belum ada mentor yang tersedia.')}</p>}
    </div> : null}
    {value && selectedName ? <small className="mentor-picker__selected">{english ? 'Selected' : 'Terpilih'}: {selectedName}</small> : null}
  </div>
}
