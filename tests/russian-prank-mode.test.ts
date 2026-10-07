import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')
const prank = readFileSync(new URL('../components/prank/russian-prank.tsx', import.meta.url), 'utf8')

test('temporary Russian prank mode is globally mounted and explicitly reversible', () => {
  assert.match(layout, /import \{ RussianPrank \} from '@\/components\/prank\/russian-prank'/)
  assert.match(layout, /<html lang="ru"/)
  assert.match(layout, /<RussianPrank \/>/)
  assert.match(layout, /locale: 'ru_RU'/)
  assert.match(prank, /TEMPORARY PRANK LAYER/)
})

test('Russian prank translates dynamic UI without mutating persisted values or technical content', () => {
  assert.match(prank, /MutationObserver/)
  assert.match(prank, /placeholder.*title.*aria-label.*alt/s)
  assert.match(prank, /document\.createTreeWalker/)
  assert.match(prank, /textarea/)
  assert.match(prank, /contenteditable/)
  assert.match(prank, /looksTechnical/)
  assert.doesNotMatch(prank, /\.value\s*=/)
  assert.match(prank, /'chat on whatsapp': 'Написать в WhatsApp'/)
  assert.match(prank, /'dashboard': 'Панель управления'/)
  assert.match(prank, /'save': 'Сохранить'/)
})
