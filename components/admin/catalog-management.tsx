'use client'

import { useMemo, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

export type CatalogManagementItem = {
  id: string
  title: string
  meta?: string
}

export type CatalogManagementFilter = {
  id: string
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
}

export type CatalogManagementProps = {
  eyebrow?: string
  title: string
  description: string
  items: readonly CatalogManagementItem[]
  selectedId?: string
  query: string
  onQueryChange: (value: string) => void
  onSelect: (id: string) => void
  filters?: readonly CatalogManagementFilter[]
  editor?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
}

export function CatalogManagement({
  eyebrow = 'Editor',
  title,
  description,
  items,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  filters = [],
  editor,
  emptyTitle = 'Belum ada item.',
  emptyDescription = 'Konten untuk editor ini belum tersedia.',
}: CatalogManagementProps) {
  const filteredItems = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('id')
    return term ? items.filter(item => `${item.title} ${item.meta ?? ''}`.toLocaleLowerCase('id').includes(term)) : items
  }, [items, query])

  return <>
    <div className="role-page-title"><p className="kicker">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>
    <div className="catalog-admin-layout">
      <section className="role-card catalog-admin-list">
        <div className="role-card-heading"><div><p className="kicker">Semua item</p><h2>{filteredItems.length} dari {items.length} item</h2></div></div>
        <div className="catalog-admin-filters">
          <label>Cari<input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari judul atau metadata" /></label>
          {filters.map(filter => <label key={filter.id}>{filter.label}<select value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>{filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
        </div>
        {!items.length && <div className="empty-state"><h3>{emptyTitle}</h3><p>{emptyDescription}</p></div>}
        {!!items.length && !filteredItems.length && <p className="muted">Tidak ada item yang sesuai dengan pencarian.</p>}
        {filteredItems.map(item => <button type="button" className={`catalog-admin-product ${item.id === selectedId ? 'active' : ''}`} key={item.id} onClick={() => onSelect(item.id)}><span><strong>{item.title}</strong>{item.meta ? <small>{item.meta}</small> : null}</span><ChevronRight /></button>)}
      </section>
      <section className="role-card catalog-admin-editor">
        {editor ?? <div className="empty-state"><h3>Pilih item untuk mulai mengelola.</h3></div>}
      </section>
    </div>
  </>
}
