export type PublicationFilterInput = {
  title: string
  excerpt: string
  category: string | null
  published_at: string | null
}

export type CompetitionFilterInput = {
  name: string
  description: string
  category_id: string | null
  status: 'upcoming' | 'open' | 'closed' | 'archived'
  registration_deadline: string | null
  created_at: string
}

export type PublicationSort = 'newest' | 'oldest' | 'title'
export type CompetitionSort = 'deadline' | 'newest' | 'name'

export function filterPublications<T extends PublicationFilterInput>(
  items: readonly T[],
  filters: { query: string; category: string; sort: PublicationSort },
): T[] {
  const needle = filters.query.trim().toLocaleLowerCase('en')
  return items.filter(item => {
    const category = item.category ?? ''
    return (filters.category === 'all' || category === filters.category)
      && (!needle || `${item.title} ${item.excerpt} ${category}`.toLocaleLowerCase('en').includes(needle))
  }).toSorted((a, b) => {
    if (filters.sort === 'title') return a.title.localeCompare(b.title)
    const left = a.published_at ?? ''
    const right = b.published_at ?? ''
    return filters.sort === 'oldest' ? left.localeCompare(right) : right.localeCompare(left)
  })
}

export function filterCompetitions<T extends CompetitionFilterInput>(
  items: readonly T[],
  filters: { query: string; categoryId: string; status: string; sort: CompetitionSort },
): T[] {
  const needle = filters.query.trim().toLocaleLowerCase('en')
  return items.filter(item => (
    (filters.categoryId === 'all' || item.category_id === filters.categoryId)
    && (filters.status === 'all' || item.status === filters.status)
    && (!needle || `${item.name} ${item.description}`.toLocaleLowerCase('en').includes(needle))
  )).toSorted((a, b) => {
    if (filters.sort === 'name') return a.name.localeCompare(b.name)
    if (filters.sort === 'newest') return b.created_at.localeCompare(a.created_at)
    const left = a.registration_deadline ?? '9999-12-31'
    const right = b.registration_deadline ?? '9999-12-31'
    return left.localeCompare(right)
  })
}
