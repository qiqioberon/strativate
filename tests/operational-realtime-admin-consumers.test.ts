import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { retainSelectedScheduleSlot } from "@/components/admin/admin-schedule-dialog"

async function source(path: string) {
  return readFile(path, "utf8")
}

test("Admin operational surfaces register their targeted canonical loaders", async () => {
  const [commerce, privateMentoring, intensiveMentoring, cartLinks, invitations] =
    await Promise.all([
      source("components/admin/commerce-operations.tsx"),
      source("components/admin/private-mentoring-enrollment-management.tsx"),
      source("components/admin/intensive-mentoring-session-management.tsx"),
      source("components/admin/commerce-cart-link-management.tsx"),
      source("components/admin/mentor-invitations.tsx"),
    ])

  assert.match(
    commerce,
    /useOperationalInvalidation\(\['commerce',\s*'admin-overview'\],[\s\S]*?load\(\)/,
  )
  assert.match(
    privateMentoring,
    /useOperationalInvalidation\(\['mentoring',\s*'provider'\],[\s\S]*?refresh\(\)/,
  )
  assert.match(
    intensiveMentoring,
    /useOperationalInvalidation\(\['mentoring',\s*'provider'\],[\s\S]*?load\(\)/,
  )
  assert.match(
    cartLinks,
    /useOperationalInvalidation\(\['cart-links'\],[\s\S]*?loadHistory\(\)/,
  )
  assert.match(
    invitations,
    /useOperationalInvalidation\(\['mentor-invitations'\],[\s\S]*?load\(\)/,
  )
})

test("the scheduling dialog reloads only while open and keeps active filters", async () => {
  const scheduleDialog = await source(
    "components/admin/admin-schedule-dialog.tsx",
  )

  assert.match(
    scheduleDialog,
    /useOperationalInvalidation\(\['calendar',\s*'availability',\s*'provider'\],[\s\S]*?sessionId[\s\S]*?loadSlots\(false\)/,
  )
  assert.match(scheduleDialog, /loadSlots\(true\)/)
  assert.doesNotMatch(
    scheduleDialog,
    /loadSlots\(false\)[\s\S]{0,300}setMentorQuery\(''\)/,
  )
})

test("a canonical slot reload retains only a still-valid selection", () => {
  const selected = { mentorId: "mentor-a", start: "2026-09-22T09:00:00Z" }
  const stillAvailable = [
    { mentorId: "mentor-a", start: "2026-09-22T09:00:00Z" },
    { mentorId: "mentor-b", start: "2026-09-22T10:00:00Z" },
  ]

  assert.equal(retainSelectedScheduleSlot(selected, stillAvailable), selected)
  assert.equal(
    retainSelectedScheduleSlot(selected, [stillAvailable[1]]),
    null,
  )
})


test("Admin detail selections follow canonical reloads without resetting operational context", async () => {
  const [commerce, privateMentoring, intensiveMentoring] = await Promise.all([
    source("components/admin/commerce-operations.tsx"),
    source("components/admin/private-mentoring-enrollment-management.tsx"),
    source("components/admin/intensive-mentoring-session-management.tsx"),
  ])

  assert.match(commerce, /selectedOrderId/)
  assert.match(commerce, /p_query:\s*selectedOrderId[\s\S]*p_status:\s*['"]['"]/)
  assert.match(commerce, /setSelected\(canonical\)/)
  assert.match(privateMentoring, /setSelected\(current=>current\?next\.find\(row=>row\.enrollment_id===current\.enrollment_id\)\?\?null:null\)/)
  assert.match(intensiveMentoring, /setSession\(current=>current\?next\.flatMap\(row=>row\.sessions\)\.find\(item=>item\.sessionId===current\.sessionId\)\?\?null:null\)/)
})
