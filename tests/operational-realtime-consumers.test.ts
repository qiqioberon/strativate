import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

async function source(path: string) {
  return readFile(path, "utf8")
}

test("notification surfaces use the shared transport and metadata", async () => {
  const [topbar, center] = await Promise.all([
    source("components/dashboard/dashboard-topbar-actions.tsx"),
    source("components/dashboard/notification-center.tsx"),
  ])

  assert.doesNotMatch(topbar, /\.channel\(/)
  assert.doesNotMatch(center, /\.channel\(/)
  assert.match(center, /notificationCategoryTypes/)
  assert.doesNotMatch(center, /const CATEGORY_TYPES/)
})

test("calendar and availability consumers register targeted canonical reloads", async () => {
  const [calendar, menteeAvailability, mentorAvailability] = await Promise.all([
    source("components/calendar/role-calendar.tsx"),
    source("components/dashboard/mentor-availability-explorer.tsx"),
    source("components/mentor/availability-editor.tsx"),
  ])

  assert.match(
    calendar,
    /useOperationalInvalidation\(\['calendar',\s*'provider'\],[\s\S]*?load\(\)/,
  )
  assert.match(
    menteeAvailability,
    /useOperationalInvalidation\(\['availability'\],[\s\S]*?load\(false\)/,
  )
  assert.match(
    mentorAvailability,
    /useOperationalInvalidation\(\['availability'\],[\s\S]*?if \(!dirty\)[\s\S]*?load\(false\)/,
  )
})
test("snapshot dashboards refresh only their server-backed operational domains", async () => {
  const [mentee, mentor] = await Promise.all([
    source("app/dashboard/dashboard-client.tsx"),
    source("components/mentor/mentor-dashboard-client.tsx"),
  ])

  assert.match(
    mentee,
    /useOperationalInvalidation\(\['commerce',\s*'cart',\s*'library',\s*'mentoring'\],[\s\S]*?router\.refresh\(\)/,
  )
  assert.match(
    mentor,
    /useOperationalInvalidation\(\['mentor-dashboard',\s*'mentoring',\s*'provider'\],[\s\S]*?router\.refresh\(\)/,
  )
  assert.doesNotMatch(
    mentee,
    /useOperationalInvalidation\(\[[^\]]*'calendar'[^\]]*\]/,
  )
})


test("open canonical details follow refreshed collections instead of stale object snapshots", async () => {
  const [orders, privateSessions, intensiveSessions, assignments, history] = await Promise.all([
    source("components/commerce/user-order-history.tsx"),
    source("components/dashboard/private-mentoring-sessions.tsx"),
    source("components/dashboard/intensive-mentoring-engagements.tsx"),
    source("components/mentor/dashboard/mentor-assignments.tsx"),
    source("components/mentor/dashboard/mentor-history.tsx"),
  ])

  assert.match(orders, /selectedOrderId[\s\S]*orders\.find\(order=>order\.id===selectedOrderId\)/)
  assert.doesNotMatch(orders, /useState<OrderWithItems\s*\|\s*null>/)
  assert.match(privateSessions, /selectedSessionId[\s\S]*sessions\.find\(session=>session\.sessionId===selectedSessionId\)/)
  assert.doesNotMatch(privateSessions, /useState<PrivateMentoringSessionView\|null>/)
  assert.match(intensiveSessions, /selectedSessionId[\s\S]*engagements\.flatMap\(item=>item\.sessions\)\.find/)
  assert.doesNotMatch(intensiveSessions, /useState<IntensiveSessionView\|null>/)
  assert.match(assignments, /selectedSessionId[\s\S]*data\.sessions\.find/)
  assert.match(history, /selectedSessionId[\s\S]*history\.find/)
})

test("availability invalidation refreshes an open day and preserves dirty mentor drafts", async () => {
  const [explorer, editor] = await Promise.all([
    source("components/dashboard/mentor-availability-explorer.tsx"),
    source("components/mentor/availability-editor.tsx"),
  ])

  assert.match(explorer, /detailRequestRef/)
  assert.match(explorer, /await load\(false\)[\s\S]*openFreshDay\(detail\.mentor, detail\.day\.dateKey\)/)
  assert.match(explorer, /setSelectedDetail\(null\)[\s\S]*Ketersediaan pada tanggal tersebut baru saja berubah/)
  assert.match(editor, /const \[dirty, setDirty\] = useState\(false\)/)
  assert.match(editor, /setDirty\(true\)/)
  assert.match(editor, /useOperationalInvalidation\(\['availability'\],[\s\S]*if \(!dirty\) void load\(false\)/)
  assert.match(editor, /setRangesByWeek\(nextRangesByWeek\)[\s\S]*setDirty\(false\)/)
})
