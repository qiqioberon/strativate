import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { test } from 'node:test'

type PlaywrightConfig = {
  use?: { baseURL?: string }
  webServer?: Array<{ command: string, url: string }>
}

const configUrl = pathToFileURL(resolve(process.cwd(), 'playwright.config.ts')).href

async function loadConfig(testBaseUrl?: string) {
  const env = { ...process.env }
  if (testBaseUrl) env.TEST_BASE_URL = testBaseUrl
  else delete env.TEST_BASE_URL
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', `import configModule from ${JSON.stringify(configUrl)}; const config = configModule.default ?? configModule; console.log(JSON.stringify({ use: config.use, webServer: config.webServer }))`],
    { encoding: 'utf8', env },
  )
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout) as PlaywrightConfig
}

test('external base URL mode retains the carousel fixture server', { concurrency: false }, async () => {
  const config = await loadConfig('https://marketing.example.test')

  assert.equal(config.use?.baseURL, 'https://marketing.example.test')
  assert.equal(config.webServer?.length, 1)
  assert.match(config.webServer?.[0]?.command ?? '', /next dev tests\/fixtures\/carousel-interaction/)
  assert.equal(config.webServer?.[0]?.url, 'http://localhost:3001')
})

test('local mode starts both the production app and carousel fixture servers', { concurrency: false }, async () => {
  const config = await loadConfig()

  assert.equal(config.use?.baseURL, 'http://localhost:3000')
  assert.equal(config.webServer?.length, 2)
  assert.match(config.webServer?.[0]?.command ?? '', /pnpm start --port 3000/)
  assert.match(config.webServer?.[1]?.command ?? '', /next dev tests\/fixtures\/carousel-interaction/)
})
