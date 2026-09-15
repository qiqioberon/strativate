'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import styles from './table-pagination.module.css'

type PageItem = number | 'ellipsis'

type Props = {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  disabled?: boolean
  label?: string
}

function pageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index)
  const wanted = new Set([0, totalPages - 1, page - 1, page, page + 1])
  const pages = [...wanted].filter(value => value >= 0 && value < totalPages).sort((a, b) => a - b)
  const items: PageItem[] = []
  pages.forEach((value, index) => {
    const previous = pages[index - 1]
    if (index > 0 && previous !== undefined && value - previous > 1) items.push('ellipsis')
    items.push(value)
  })
  return items
}

export function TablePagination({ page, pageSize, totalItems, onPageChange, disabled = false, label = 'Pagination' }: Props) {
  const totalPages = Math.ceil(totalItems / pageSize)
  if (totalPages === 0) return null

  const currentPage = Math.min(page, totalPages - 1)
  const items = pageItems(currentPage, totalPages)

  return <nav className={styles.pagination} aria-label={label} data-testid="table-pagination">
    <div className={styles.controls}>
      <button type="button" className={`button button-outline ${styles.edgeButton}`} disabled={disabled || currentPage === 0} onClick={() => onPageChange(currentPage - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={14} aria-hidden="true" /><span>Sebelumnya</span></button>
      <div className={styles.pages}>
        {items.map((item, index) => item === 'ellipsis'
          ? <span className={styles.ellipsis} aria-hidden="true" key={`ellipsis-${index}`}>…</span>
          : <button type="button" className={`${styles.pageButton} ${item === currentPage ? styles.activePage : ''}`} aria-current={item === currentPage ? 'page' : undefined} aria-label={`Halaman ${item + 1}`} disabled={disabled} onClick={() => onPageChange(item)} key={item}>{item + 1}</button>)}
      </div>
      <button type="button" className={`button button-outline ${styles.edgeButton}`} disabled={disabled || currentPage >= totalPages - 1} onClick={() => onPageChange(currentPage + 1)} aria-label="Halaman berikutnya"><span>Berikutnya</span><ChevronRight size={14} aria-hidden="true" /></button>
    </div>
    <span className={styles.summary}>Halaman {currentPage + 1} dari {totalPages}</span>
  </nav>
}
