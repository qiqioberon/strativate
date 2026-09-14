import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../app/program/program-page.css', import.meta.url), 'utf8')

test('program bento keeps service cards readable instead of forcing five cramped columns', () => {
  const supportRule = css.match(/\.program-page \.marketing-services-supporting\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(supportRule, /repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  assert.doesNotMatch(supportRule, /repeat\(5,/)
})

test('primary program cards use compact editorial proportions instead of large empty fixed panels', () => {
  const primaryRule = css.match(/\.program-page \.marketing-service-card--primary\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(primaryRule, /min-height:\s*(?:260|270|280)px/)
  assert.doesNotMatch(primaryRule, /min-height:\s*350px/)
})
