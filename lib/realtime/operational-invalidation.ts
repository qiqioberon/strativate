import type { AppRole } from "@/lib/supabase/database.types"

export const operationalDomains = [
  "commerce",
  "cart",
  "library",
  "mentoring",
  "mentor-dashboard",
  "calendar",
  "availability",
  "provider",
  "admin-overview",
  "cart-links",
  "mentor-invitations",
] as const

export type OperationalDomain = (typeof operationalDomains)[number]
export type NotificationCategory = "commerce" | "mentoring" | "meeting"

type NotificationMetadata = {
  category: NotificationCategory
  domains: readonly OperationalDomain[]
}

export const notificationMetadata = {
  order_pending: {
    category: "commerce",
    domains: ["commerce", "admin-overview"],
  },
  payment_paid: {
    category: "commerce",
    domains: ["commerce", "cart", "library", "mentoring", "admin-overview"],
  },
  competition_updated: {
    category: "mentoring",
    domains: ["mentoring", "admin-overview"],
  },
  competition_reviewed: {
    category: "mentoring",
    domains: ["mentoring"],
  },
  mentor_assigned: {
    category: "mentoring",
    domains: ["mentoring", "mentor-dashboard", "calendar", "availability"],
  },
  mentoring_attention: {
    category: "mentoring",
    domains: ["mentoring", "admin-overview"],
  },
  topic_reviewed: {
    category: "mentoring",
    domains: ["mentoring"],
  },
  topic_resolved: {
    category: "mentoring",
    domains: ["mentoring"],
  },
  scope_updated: {
    category: "mentoring",
    domains: ["mentoring", "mentor-dashboard"],
  },
  session_scheduled: {
    category: "mentoring",
    domains: [
      "mentoring",
      "mentor-dashboard",
      "calendar",
      "availability",
      "provider",
    ],
  },
  session_cancelled: {
    category: "mentoring",
    domains: [
      "mentoring",
      "mentor-dashboard",
      "calendar",
      "availability",
      "provider",
    ],
  },
  meeting_url_changed: {
    category: "meeting",
    domains: ["mentoring", "mentor-dashboard", "calendar", "provider"],
  },
  zoom_failed: {
    category: "meeting",
    domains: [
      "mentoring",
      "mentor-dashboard",
      "calendar",
      "provider",
      "admin-overview",
    ],
  },
  calendar_failed: {
    category: "meeting",
    domains: [
      "mentoring",
      "mentor-dashboard",
      "calendar",
      "provider",
      "admin-overview",
    ],
  },
  recording_failed: {
    category: "meeting",
    domains: ["mentoring", "mentor-dashboard", "provider", "admin-overview"],
  },
} as const satisfies Record<string, NotificationMetadata>

export type KnownNotificationType = keyof typeof notificationMetadata

export function domainsForNotification(
  type: string,
): readonly OperationalDomain[] {
  return notificationMetadata[type as KnownNotificationType]?.domains ?? []
}

export function notificationCategoryTypes(
  category: NotificationCategory,
): string[] {
  return (Object.entries(notificationMetadata) as [
    KnownNotificationType,
    NotificationMetadata,
  ][])
    .filter(([, metadata]) => metadata.category === category)
    .map(([type]) => type)
}

export function isOperationalDomain(value: unknown): value is OperationalDomain {
  return (
    typeof value === "string" &&
    (operationalDomains as readonly string[]).includes(value)
  )
}

export function revisionScopeKey(
  recipientRole: AppRole,
  recipientUserId: string | null,
  domain: OperationalDomain,
): string {
  return JSON.stringify([recipientRole, recipientUserId, domain])
}

export function parseRevision(
  revision: number | string | bigint,
): bigint | null {
  try {
    const parsed = BigInt(revision)
    return parsed > BigInt(0) ? parsed : null
  } catch {
    return null
  }
}

export function isNewerRevision(
  previous: bigint | undefined,
  next: number | string | bigint,
): boolean {
  const parsed = parseRevision(next)
  return parsed !== null && (previous === undefined || parsed > previous)
}

export type DomainAccumulator = {
  add(domains: Iterable<OperationalDomain>): void
  dispose(): void
}

export function createDomainAccumulator(
  flush: (domains: ReadonlySet<OperationalDomain>) => void,
  debounceMilliseconds = 150,
): DomainAccumulator {
  const pending = new Set<OperationalDomain>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const flushPending = () => {
    timer = null
    if (pending.size === 0) return
    const domains = new Set(pending)
    pending.clear()
    flush(domains)
  }

  return {
    add(domains) {
      for (const domain of domains) pending.add(domain)
      if (pending.size > 0 && timer === null) {
        timer = setTimeout(flushPending, debounceMilliseconds)
      }
    },
    dispose() {
      if (timer !== null) clearTimeout(timer)
      timer = null
      pending.clear()
    },
  }
}
