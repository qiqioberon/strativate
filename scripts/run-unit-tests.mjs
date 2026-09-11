import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const tests = readdirSync(join(root, 'tests'), { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.test.ts'))
  .map(entry => join(root, 'tests', entry.name))
  .sort()

if (tests.length === 0) throw new Error('No unit test files were discovered.')

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests], { stdio: 'inherit' })
process.exitCode = result.status ?? 1
