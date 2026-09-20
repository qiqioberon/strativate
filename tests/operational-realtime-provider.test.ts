import assert from "node:assert/strict"
import test from "node:test"

import {
  createOperationalRealtimeController,
  type OperationalRealtimeChannel,
  type OperationalRealtimeClient,
  type VisibilitySource,
} from "@/components/realtime/operational-realtime-provider"

const delay = (milliseconds = 5) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

class FakeChannel implements OperationalRealtimeChannel {
  private bindings = new Map<
    string,
    (payload: { new: Record<string, unknown> }) => void
  >()
  private statusHandler: ((status: string) => void) | null = null

  on(
    _event: "postgres_changes",
    filter: { table: string },
    callback: (payload: { new: Record<string, unknown> }) => void,
  ) {
    this.bindings.set(filter.table, callback)
    return this
  }

  subscribe(callback: (status: string) => void) {
    this.statusHandler = callback
    return this
  }

  emitStatus(status: string) {
    this.statusHandler?.(status)
  }

  emit(table: string, row: Record<string, unknown>) {
    this.bindings.get(table)?.({ new: row })
  }
}

class FakeVisibility implements VisibilitySource {
  visibilityState: DocumentVisibilityState = "hidden"
  private listener: (() => void) | null = null

  addEventListener(_event: "visibilitychange", listener: () => void) {
    this.listener = listener
  }

  removeEventListener(_event: "visibilitychange", listener: () => void) {
    if (this.listener === listener) this.listener = null
  }

  show() {
    this.visibilityState = "visible"
    this.listener?.()
  }

  hasListener() {
    return this.listener !== null
  }
}

function createHarness(
  rows: Array<Record<string, unknown>[]> = [[]],
) {
  const channel = new FakeChannel()
  const visibility = new FakeVisibility()
  const selectCalls: string[] = []
  const removed: OperationalRealtimeChannel[] = []
  let rowIndex = 0
  const client: OperationalRealtimeClient = {
    channel() {
      return channel
    },
    from(table) {
      return {
        async select(columns) {
          selectCalls.push(`${table}:${columns}`)
          const data = rows[Math.min(rowIndex, rows.length - 1)] ?? []
          rowIndex += 1
          return { data, error: null }
        },
      }
    },
    async removeChannel(value) {
      removed.push(value)
    },
  }
  return { channel, client, removed, selectCalls, visibility }
}

test("controller reconciles only after the channel reaches SUBSCRIBED", async () => {
  const harness = createHarness([
    [
      {
        recipient_role: "admin",
        recipient_user_id: null,
        domain: "commerce",
        revision: 1,
      },
    ],
  ])
  const calls: string[][] = []
  const controller = createOperationalRealtimeController({
    client: harness.client,
    visibility: harness.visibility,
    debounceMilliseconds: 1,
    onDomains: (domains) => calls.push([...domains]),
    onNotificationsChanged() {},
  })

  controller.start()
  assert.equal(harness.selectCalls.length, 0)

  harness.channel.emitStatus("SUBSCRIBED")
  await delay()

  assert.equal(harness.selectCalls.length, 1)
  assert.deepEqual(calls, [["commerce"]])
  controller.stop()
})

test("scope-aware revision keys do not suppress an independent lower counter", async () => {
  const harness = createHarness([
    [
      {
        recipient_role: "mentee",
        recipient_user_id: "user-a",
        domain: "calendar",
        revision: 8,
      },
      {
        recipient_role: "mentee",
        recipient_user_id: null,
        domain: "calendar",
        revision: 1,
      },
    ],
  ])
  const calls: string[][] = []
  const controller = createOperationalRealtimeController({
    client: harness.client,
    visibility: harness.visibility,
    debounceMilliseconds: 1,
    onDomains: (domains) => calls.push([...domains]),
    onNotificationsChanged() {},
  })

  controller.start()
  harness.channel.emitStatus("SUBSCRIBED")
  await delay()
  harness.channel.emit("operational_invalidation_versions", {
    recipient_role: "mentee",
    recipient_user_id: null,
    domain: "calendar",
    revision: 2,
  })
  await delay()

  assert.deepEqual(calls, [["calendar"], ["calendar"]])
  controller.stop()
})

test("reconnect and visible-tab reconciliation wait for the next subscription", async () => {
  const harness = createHarness([[], [], []])
  const controller = createOperationalRealtimeController({
    client: harness.client,
    visibility: harness.visibility,
    debounceMilliseconds: 1,
    onDomains() {},
    onNotificationsChanged() {},
  })

  controller.start()
  harness.channel.emitStatus("SUBSCRIBED")
  await delay()
  assert.equal(harness.selectCalls.length, 1)

  harness.channel.emitStatus("CHANNEL_ERROR")
  harness.visibility.show()
  await delay()
  assert.equal(harness.selectCalls.length, 1)

  harness.channel.emitStatus("SUBSCRIBED")
  await delay()
  assert.equal(harness.selectCalls.length, 2)

  harness.visibility.show()
  await delay()
  assert.equal(harness.selectCalls.length, 3)
  controller.stop()
})

test("notification events share the channel and emit mapped domains", async () => {
  const harness = createHarness([[]])
  const domains: string[][] = []
  let notificationChanges = 0
  const controller = createOperationalRealtimeController({
    client: harness.client,
    visibility: harness.visibility,
    debounceMilliseconds: 1,
    onDomains: (stale) => domains.push([...stale]),
    onNotificationsChanged: () => {
      notificationChanges += 1
    },
  })

  controller.start()
  harness.channel.emit("notifications", { type: "session_scheduled" })
  await delay()

  assert.equal(notificationChanges, 1)
  assert.deepEqual(domains, [
    ["mentoring", "mentor-dashboard", "calendar", "availability", "provider"],
  ])
  controller.stop()
})

test("controller cleanup removes visibility and realtime listeners", () => {
  const harness = createHarness()
  const controller = createOperationalRealtimeController({
    client: harness.client,
    visibility: harness.visibility,
    onDomains() {},
    onNotificationsChanged() {},
  })

  controller.start()
  assert.equal(harness.visibility.hasListener(), true)

  controller.stop()

  assert.equal(harness.visibility.hasListener(), false)
  assert.deepEqual(harness.removed, [harness.channel])
})
