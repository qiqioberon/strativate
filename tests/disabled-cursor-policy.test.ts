import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const stylesheets = [
  '../app/auth/auth.css',
  '../app/globals.css',
  '../app/onboarding.css',
  '../app/admin-mentoring-scheduling.css',
  '../app/operations-dashboard.css',
  '../app/mentee-mentor-availability.css',
  '../components/admin/table-pagination.module.css',
]

test('disabled controls keep a normal cursor instead of busy or blocked cursors', () => {
  for (const relativePath of stylesheets) {
    const css = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    assert.doesNotMatch(css, /cursor\s*:\s*(?:wait|progress|not-allowed)/, relativePath)
  }

  const authCss = readFileSync(new URL('../app/auth/auth.css', import.meta.url), 'utf8')
  const disabledRule = authCss.match(/button:disabled\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  assert.match(disabledRule, /cursor:\s*default/)
})
