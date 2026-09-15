'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import styles from './sortable-table-header.module.css'

export type SortDirection = 'asc' | 'desc' | null

type Props = {
  label: string
  sortKey: string
  activeKey: string | null
  direction: SortDirection
  onSortChange: (key: string | null, direction: SortDirection) => void
  className?: string
}

export function nextSortDirection(active: boolean, direction: SortDirection): SortDirection {
  if (!active || direction === null) return 'asc'
  if (direction === 'asc') return 'desc'
  return null
}

export function SortableTableHeader({ label, sortKey, activeKey, direction, onSortChange, className }: Props) {
  const active = activeKey === sortKey && direction !== null
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  function changeSort() {
    const next = nextSortDirection(activeKey === sortKey, direction)
    onSortChange(next === null ? null : sortKey, next)
  }

  return <th scope="col" aria-sort={ariaSort} className={className}>
    <button type="button" className={styles.button} onClick={changeSort} aria-label={`${label}: ${active ? ariaSort : 'tidak diurutkan'}`}>
      <span>{label}</span><Icon aria-hidden="true" size={13} />
    </button>
  </th>
}
