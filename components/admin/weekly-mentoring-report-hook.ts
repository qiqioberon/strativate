'use client'

import { useEffect, useRef, useState } from 'react'
import { useOperationalInvalidation } from '@/components/realtime/operational-realtime-provider'
import { mentoringApiParams, mentoringRangeError, type MentoringReport, type MentoringReportFilters, type MentoringReportPagination } from '@/lib/admin/mentoring-reporting'

export function useWeeklyMentoringReport(filters: MentoringReportFilters, pagination: MentoringReportPagination) {
  const requestKey = mentoringApiParams(filters, pagination)
  const rangeError = mentoringRangeError(filters.from, filters.to)
  const [stored, setStored] = useState<{ key: string; report: MentoringReport } | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const invalidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (rangeError) { setLoading(false); setError(''); return }
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/mentoring-reporting?${requestKey}`, { signal: controller.signal, cache: 'no-store' })
        const data: MentoringReport & { error?: string } = await response.json()
        if (controller.signal.aborted) return
        if (!response.ok || !data.summary) throw new Error(data.error || 'Unable to load mentoring sessions.')
        setStored({ key: requestKey, report: data })
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load mentoring sessions.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 250)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [requestKey, rangeError, revision])
  useOperationalInvalidation(['mentoring', 'calendar', 'provider'], () => {
    if (invalidationTimer.current) clearTimeout(invalidationTimer.current)
    invalidationTimer.current = setTimeout(() => setRevision(value => value + 1), 400)
  })
  useEffect(() => () => { if (invalidationTimer.current) clearTimeout(invalidationTimer.current) }, [])
  return { report: !rangeError && !error && stored?.key === requestKey ? stored.report : null, loading, error: rangeError || error, refresh: () => setRevision(value => value + 1) }
}
