import assert from 'node:assert/strict'
import test from 'node:test'

import { filterCompetitions, filterPublications } from '../lib/content/editorial-filters'

test('publication filters combine query, real category, and deterministic sorting', () => {
  const rows = [
    { title:'Beta Story',excerpt:'finance',category:'News',published_at:'2026-09-20' },
    { title:'Alpha Story',excerpt:'business case',category:'Insights',published_at:'2026-09-25' },
    { title:'Gamma Story',excerpt:'business case',category:'Insights',published_at:'2026-09-10' },
  ]
  assert.deepEqual(
    filterPublications(rows,{query:'business',category:'Insights',sort:'newest'}).map(item=>item.title),
    ['Alpha Story','Gamma Story'],
  )
  assert.deepEqual(
    filterPublications(rows,{query:'',category:'all',sort:'title'}).map(item=>item.title),
    ['Alpha Story','Beta Story','Gamma Story'],
  )
})

test('competition filters combine search, shared category, status, and deadline order', () => {
  const rows = [
    { name:'Late Open',description:'case',category_id:'case',status:'open' as const,registration_deadline:'2026-11-20',created_at:'2026-09-20' },
    { name:'Early Open',description:'case',category_id:'case',status:'open' as const,registration_deadline:'2026-10-01',created_at:'2026-09-22' },
    { name:'Essay Closed',description:'essay',category_id:'essay',status:'closed' as const,registration_deadline:'2026-09-30',created_at:'2026-09-25' },
  ]
  assert.deepEqual(
    filterCompetitions(rows,{query:'case',categoryId:'case',status:'open',sort:'deadline'}).map(item=>item.name),
    ['Early Open','Late Open'],
  )
  assert.deepEqual(
    filterCompetitions(rows,{query:'',categoryId:'all',status:'all',sort:'newest'}).map(item=>item.name),
    ['Essay Closed','Early Open','Late Open'],
  )
})
