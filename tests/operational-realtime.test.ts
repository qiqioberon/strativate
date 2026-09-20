import assert from "node:assert/strict"
import test from "node:test"

import {
  createDomainAccumulator,
  domainsForNotification,
  isNewerRevision,
  notificationCategoryTypes,
  revisionScopeKey,
} from "@/lib/realtime/operational-invalidation"

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

test("payment notifications invalidate every dependent operational domain", () => {
  assert.deepEqual(domainsForNotification("payment_paid"), [
    "commerce",
    "cart",
    "library",
    "mentoring",
    "admin-overview",
  ])
})

test("notification categories and invalidation domains share one metadata source", () => {
  assert.deepEqual(notificationCategoryTypes("commerce"), [
    "order_pending",
    "payment_paid",
  ])
  assert.equal(notificationCategoryTypes("meeting").includes("calendar_failed"), true)
  assert.equal(notificationCategoryTypes("mentoring").includes("topic_resolved"), true)
})

test("domain accumulator unions different domains in one debounce window", async () => {
  const calls: string[][] = []
  const accumulator = createDomainAccumulator(
    (domains) => calls.push([...domains].sort()),
    2,
  )

  accumulator.add(["calendar"])
  accumulator.add(["provider"])
  await delay(15)

  assert.deepEqual(calls, [["calendar", "provider"]])
  accumulator.dispose()
})

test("disposing a domain accumulator cancels an unflushed callback", async () => {
  const calls: string[][] = []
  const accumulator = createDomainAccumulator(
    (domains) => calls.push([...domains]),
    10,
  )

  accumulator.add(["commerce"])
  accumulator.dispose()
  await delay(20)

  assert.deepEqual(calls, [])
})

test("only a larger revision is newer", () => {
  assert.equal(isNewerRevision(BigInt(8), 9), true)
  assert.equal(isNewerRevision(BigInt(8), "8"), false)
  assert.equal(isNewerRevision(BigInt(8), 7), false)
  assert.equal(isNewerRevision(undefined, 1), true)
})

test("scope revision keys keep independent counters separate", () => {
  assert.notEqual(
    revisionScopeKey("admin", null, "commerce"),
    revisionScopeKey("mentee", null, "commerce"),
  )
  assert.notEqual(
    revisionScopeKey("mentee", null, "cart"),
    revisionScopeKey("mentee", "user-a", "cart"),
  )
  assert.notEqual(
    revisionScopeKey("mentee", "user-a", "cart"),
    revisionScopeKey("mentee", "user-b", "cart"),
  )
})
