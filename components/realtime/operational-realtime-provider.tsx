'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"

import {
  createDomainAccumulator,
  domainsForNotification,
  isNewerRevision,
  isOperationalDomain,
  parseRevision,
  revisionScopeKey,
  type OperationalDomain,
} from "@/lib/realtime/operational-invalidation"
import { createClient } from "@/lib/supabase/client"
import type { AppRole } from "@/lib/supabase/database.types"

export type OperationalRealtimeChannel = {
  on(
    event: "postgres_changes",
    filter: { event?: string; schema?: string; table: string },
    callback: (payload: { new: Record<string, unknown> }) => void,
  ): OperationalRealtimeChannel
  subscribe(callback: (status: string) => void): OperationalRealtimeChannel
}

export type OperationalRealtimeClient = {
  channel(name: string): OperationalRealtimeChannel
  from(table: string): {
    select(columns: string): Promise<{
      data: Record<string, unknown>[] | null
      error: unknown
    }>
  }
  removeChannel(channel: OperationalRealtimeChannel): Promise<unknown> | unknown
}

export type VisibilitySource = {
  visibilityState: DocumentVisibilityState
  addEventListener(event: "visibilitychange", listener: () => void): void
  removeEventListener(event: "visibilitychange", listener: () => void): void
}

type OperationalRealtimeControllerOptions = {
  client: OperationalRealtimeClient
  visibility: VisibilitySource
  onDomains(domains: ReadonlySet<OperationalDomain>): void
  onNotificationsChanged(): void
  debounceMilliseconds?: number
}

type RevisionRow = {
  recipient_role: AppRole
  recipient_user_id: string | null
  domain: OperationalDomain
  revision: number | string | bigint
}

function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "mentor" || value === "mentee"
}

function parseRevisionRow(value: Record<string, unknown>): RevisionRow | null {
  if (
    !isAppRole(value.recipient_role) ||
    !isOperationalDomain(value.domain) ||
    (value.recipient_user_id !== null &&
      typeof value.recipient_user_id !== "string") ||
    (typeof value.revision !== "number" &&
      typeof value.revision !== "string" &&
      typeof value.revision !== "bigint") ||
    parseRevision(value.revision) === null
  ) {
    return null
  }

  return {
    recipient_role: value.recipient_role,
    recipient_user_id: value.recipient_user_id,
    domain: value.domain,
    revision: value.revision,
  }
}

export function createOperationalRealtimeController({
  client,
  visibility,
  onDomains,
  onNotificationsChanged,
  debounceMilliseconds = 150,
}: OperationalRealtimeControllerOptions) {
  const observedRevisions = new Map<string, bigint>()
  const accumulator = createDomainAccumulator(onDomains, debounceMilliseconds)
  let active = false
  let subscribed = false
  let hasReconciled = false
  let channel: OperationalRealtimeChannel | null = null

  const acceptRealtimeRevision = (value: Record<string, unknown>) => {
    const row = parseRevisionRow(value)
    if (!row) return
    const key = revisionScopeKey(
      row.recipient_role,
      row.recipient_user_id,
      row.domain,
    )
    const previous = observedRevisions.get(key)
    if (!isNewerRevision(previous, row.revision)) return
    observedRevisions.set(key, parseRevision(row.revision)!)
    accumulator.add([row.domain])
  }

  const reconcileVisibleRevisions = async () => {
    if (!active || !subscribed) return
    const result = await client
      .from("operational_invalidation_versions")
      .select("recipient_role,recipient_user_id,domain,revision")
    if (!active || !subscribed || result.error) return

    const stale = new Set<OperationalDomain>()
    for (const value of result.data ?? []) {
      const row = parseRevisionRow(value)
      if (!row) continue
      const key = revisionScopeKey(
        row.recipient_role,
        row.recipient_user_id,
        row.domain,
      )
      const previous = observedRevisions.get(key)
      if (!hasReconciled || isNewerRevision(previous, row.revision)) {
        stale.add(row.domain)
      }
      const parsed = parseRevision(row.revision)!
      if (previous === undefined || parsed > previous) {
        observedRevisions.set(key, parsed)
      }
    }
    hasReconciled = true
    accumulator.add(stale)
  }

  const onVisibilityChange = () => {
    if (visibility.visibilityState !== "visible") return
    if (!subscribed) {
      return
    }
    void reconcileVisibleRevisions()
  }

  return {
    start() {
      if (active) return
      active = true
      visibility.addEventListener("visibilitychange", onVisibilityChange)
      channel = client
        .channel("operational-invalidation")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          (payload) => {
            if (!active) return
            onNotificationsChanged()
            const type = payload.new.type
            if (typeof type === "string") {
              accumulator.add(domainsForNotification(type))
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "operational_invalidation_versions",
          },
          (payload) => {
            if (active) acceptRealtimeRevision(payload.new)
          },
        )
        .subscribe((status) => {
          if (!active) return
          if (status !== "SUBSCRIBED") {
            subscribed = false
            return
          }
          subscribed = true
          void reconcileVisibleRevisions()
        })
    },
    stop() {
      if (!active) return
      active = false
      subscribed = false
      visibility.removeEventListener("visibilitychange", onVisibilityChange)
      accumulator.dispose()
      if (channel) void client.removeChannel(channel)
      channel = null
    },
  }
}

type Listener = {
  domains: ReadonlySet<OperationalDomain>
  callback(domains: ReadonlySet<OperationalDomain>): void
}

type OperationalRealtimeContextValue = {
  register(listener: Listener): () => void
}

const OperationalRealtimeContext =
  createContext<OperationalRealtimeContextValue | null>(null)

export function OperationalRealtimeProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef(new Map<symbol, Listener>())
  const client = useMemo(() => createClient(), [])

  const register = useCallback((listener: Listener) => {
    const id = Symbol("operational-invalidation-listener")
    listenersRef.current.set(id, listener)
    return () => {
      listenersRef.current.delete(id)
    }
  }, [])

  useEffect(() => {
    const controller = createOperationalRealtimeController({
      client: client as unknown as OperationalRealtimeClient,
      visibility: document,
      onDomains(staleDomains) {
        for (const listener of listenersRef.current.values()) {
          const relevant = new Set(
            [...staleDomains].filter((domain) => listener.domains.has(domain)),
          )
          if (relevant.size > 0) listener.callback(relevant)
        }
      },
      onNotificationsChanged() {
        window.dispatchEvent(new Event("strativate:notifications-changed"))
      },
    })
    controller.start()
    return () => controller.stop()
  }, [client])

  const value = useMemo(() => ({ register }), [register])

  return (
    <OperationalRealtimeContext.Provider value={value}>
      {children}
    </OperationalRealtimeContext.Provider>
  )
}

export function useOperationalInvalidation(
  domains: readonly OperationalDomain[],
  callback: (domains: ReadonlySet<OperationalDomain>) => void,
) {
  const context = useContext(OperationalRealtimeContext)
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])
  const domainKey = domains.join("\u0000")
  const subscribedDomains = useMemo(
    () => new Set(domains),
    // domainKey represents the ordered primitive domain list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domainKey],
  )

  useEffect(() => {
    if (!context) {
      throw new Error("OperationalRealtimeProvider is required.")
    }
    return context.register({
      domains: subscribedDomains,
      callback: (staleDomains) => callbackRef.current(staleDomains),
    })
  }, [context, subscribedDomains])
}
