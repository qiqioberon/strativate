import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  clearedAccountPasswordSecrets,
  confirmPasswordChange,
  requestPasswordChange,
  requestPasswordReauthentication,
} from "@/components/auth/account-password-security"
import { requestAdminEmailChange } from "@/components/auth/admin-account-security"

type UpdateAttributes = { email?: string; password?: string; nonce?: string }
type AuthError = { code?: string; message: string }

function authHarness(
  updateResults: Array<{
    data: { user: { email: string | null } | null }
    error: AuthError | null
  }>,
  reauthenticateError: AuthError | null = null,
) {
  const updates: UpdateAttributes[] = []
  let reauthenticateCalls = 0
  return {
    auth: {
      async updateUser(attributes: UpdateAttributes) {
        updates.push(attributes)
        return (
          updateResults.shift() ?? {
            data: { user: { email: null } },
            error: null,
          }
        )
      },
      async reauthenticate() {
        reauthenticateCalls += 1
        return { data: {}, error: reauthenticateError }
      },
    },
    updates,
    reauthenticateCalls: () => reauthenticateCalls,
  }
}

test("Admin security remains Admin-only and composes the shared password controls", async () => {
  const [profile, adminSecurity] = await Promise.all([
    readFile("components/auth/profile-form.tsx", "utf8"),
    readFile("components/auth/admin-account-security.tsx", "utf8"),
  ])

  assert.match(
    profile,
    /account\.role\s*===\s*['"]admin['"][\s\S]*?<AdminAccountSecurity/,
  )
  assert.match(adminSecurity, /account\.role\s*!==\s*['"]admin['"][\s\S]*?return null/)
  assert.match(adminSecurity, /Email baru/)
  assert.match(adminSecurity, /<AccountPasswordSecurity role=["']admin["']/)
  assert.doesNotMatch(adminSecurity, /\.storage\b|service[_-]?role|admin\.updateUserById/)
})

test("unchanged and malformed email values never call Auth", async () => {
  const harness = authHarness([])

  const unchanged = await requestAdminEmailChange(
    harness.auth,
    "admin@example.com",
    " ADMIN@example.com ",
  )
  const malformed = await requestAdminEmailChange(
    harness.auth,
    "admin@example.com",
    "not-an-email",
  )

  assert.equal(unchanged.status, "invalid")
  assert.equal(malformed.status, "invalid")
  assert.deepEqual(harness.updates, [])
})

test("email update reports pending confirmation without replacing the canonical display", async () => {
  const harness = authHarness([
    { data: { user: { email: "admin@example.com" } }, error: null },
  ])

  const result = await requestAdminEmailChange(
    harness.auth,
    "admin@example.com",
    "new-admin@example.com",
  )

  assert.deepEqual(harness.updates, [{ email: "new-admin@example.com" }])
  assert.equal(result.status, "confirmation-pending")
  assert.equal(result.displayEmail, "admin@example.com")
})

test("shared password validation rejects policy failures and mismatches before Auth", async () => {
  const harness = authHarness([])

  const weak = await requestPasswordChange(
    harness.auth,
    "lowercase-password!",
    "lowercase-password!",
  )
  const mismatch = await requestPasswordChange(
    harness.auth,
    "Strong-password-2026!",
    "Strong-password-2027!",
  )

  assert.equal(weak.status, "invalid")
  assert.equal(mismatch.status, "invalid")
  assert.deepEqual(harness.updates, [])
})

test("password updates directly when secure reauthentication is not required", async () => {
  const harness = authHarness([
    { data: { user: { email: "admin@example.com" } }, error: null },
  ])

  const result = await requestPasswordChange(
    harness.auth,
    "Strong-password-2026!",
    "Strong-password-2026!",
  )

  assert.equal(result.status, "updated")
  assert.deepEqual(harness.updates, [{ password: "Strong-password-2026!" }])
})

test("reauthentication-required password changes complete only with the nonce", async () => {
  const harness = authHarness([
    {
      data: { user: null },
      error: { code: "reauthentication_needed", message: "Reauthentication needed" },
    },
    { data: { user: { email: "admin@example.com" } }, error: null },
  ])

  const initial = await requestPasswordChange(
    harness.auth,
    "Strong-password-2026!",
    "Strong-password-2026!",
  )
  assert.equal(initial.status, "reauthentication-required")

  const sent = await requestPasswordReauthentication(harness.auth)
  assert.equal(sent.status, "sent")
  assert.equal(harness.reauthenticateCalls(), 1)

  const completed = await confirmPasswordChange(
    harness.auth,
    "Strong-password-2026!",
    "123456",
  )
  assert.equal(completed.status, "updated")
  assert.deepEqual(harness.updates, [
    { password: "Strong-password-2026!" },
    { password: "Strong-password-2026!", nonce: "123456" },
  ])
})

test("password secrets are cleared by the shared flow and are never persisted", async () => {
  const failedHarness = authHarness([
    {
      data: { user: null },
      error: { code: "weak_password", message: "Weak password" },
    },
  ])
  const failed = await requestPasswordChange(
    failedHarness.auth,
    "Strong-password-2026!",
    "Strong-password-2026!",
  )

  assert.equal(failed.status, "failed")
  assert.deepEqual(clearedAccountPasswordSecrets(), {
    password: "",
    confirmation: "",
    nonce: "",
  })

  const security = await readFile(
    "components/auth/account-password-security.tsx",
    "utf8",
  )
  assert.match(security, /passwordError\(password, confirmation, true\)/)
  assert.match(security, /cancelPasswordChange[\s\S]*?clearPasswordSecrets\(\)/)
  assert.doesNotMatch(
    security,
    /localStorage|sessionStorage|service[_-]?role|auth\.admin|updateUserById|userId|mentorId|profileId/,
  )
})

test("Admin email input follows a confirmed canonical account email change only", async () => {
  const security = await readFile(
    "components/auth/admin-account-security.tsx",
    "utf8",
  )

  assert.match(
    security,
    /useEffect\(\(\) => \{\s*setEmail\(account\.email \?\? ['"]['"]\)\s*\}, \[account\.email\]\)/,
  )
  assert.match(
    security,
    /confirmation-pending[\s\S]*setEmail\(result\.displayEmail\)/,
  )
})
