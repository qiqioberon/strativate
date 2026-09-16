import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
const read=(p:string)=>{assert.equal(existsSync(p),true,`${p} must exist`);return readFileSync(p,'utf8')}
test('intensive detail uses explicit DB catalog while homepage stays editorial',()=>{
 const route=read('app/program/[slug]/page.tsx')
 const detail=read('components/programs/program-detail.tsx')
 const home=read('components/marketing/home-page.tsx')
 assert.match(route,/getPublicIntensiveMentoringCatalog/)
 assert.match(route,/canonical === 'intensive-mentoring'/)
 assert.match(detail,/intensiveMentoringCatalog/)
 assert.match(detail,/Optional Add-Ons|Add-On/)
 assert.match(detail,/Best-Value Bundles|Bundel/)
 assert.doesNotMatch(home,/getPublicIntensiveMentoringCatalog/)
 assert.doesNotMatch(detail,/Win Guarantee|Competition Assurance|refund|credit/i)
})
