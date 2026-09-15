import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read=(path:string)=>readFileSync(path,'utf8')

test('shared calendar reserves spacing for navigation, view controls, and source filters',()=>{
 const css=`${read('app/calendar-integration.css')}\n${read('app/calendar-mobile-polish.css')}`
 const layout=read('app/layout.tsx')
 assert.match(layout,/calendar-mobile-polish\.css/)
 assert.match(css,/\.calendar-toolbar\{[^}]*display:flex[^}]*flex-wrap:wrap[^}]*gap:14px 24px/)
 assert.match(css,/\.calendar-view-switch\{[^}]*display:grid[^}]*grid-template-columns:repeat\(3,minmax\(72px,1fr\)\)/)
 assert.match(css,/\.calendar-source-controls\{[^}]*gap:16px 20px/)
 assert.match(css,/@media\(max-width:760px\)[\s\S]*?\.calendar-nav\{[^}]*display:grid[^}]*grid-template-columns:auto 38px 38px minmax\(0,1fr\)/)
 assert.match(css,/@media\(max-width:760px\)[\s\S]*?\.calendar-view-switch\{[^}]*display:grid[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
 assert.match(css,/\.calendar-month-grid\{[^}]*overflow:hidden/)
})

test('calendar hides developer OAuth diagnostics and raw Google provider errors from end users',()=>{
 const calendar=read('components/calendar/role-calendar.tsx')
 assert.doesNotMatch(calendar,/calendar-connection-help/)
 assert.doesNotMatch(calendar,/403 access_denied/)
 assert.doesNotMatch(calendar,/Audience.*Test users/)
 assert.doesNotMatch(calendar,/\{payload\.googleError\}/)
 assert.match(calendar,/Google Calendar belum terhubung\. Silakan coba lagi\./)
})

test('oauth denial returns to the correct role dashboard with a diagnostic reason',()=>{
 const callback=read('app/api/google-calendar/callback/route.ts')
 assert.match(callback,/calendarReturnPath/)
 assert.match(callback,/role === 'admin'.*?\/admin/)
 assert.match(callback,/role === 'mentor'.*?\/mentor\/dashboard/)
 assert.match(callback,/target\.searchParams\.set\('calendar', 'denied'\)/)
 assert.match(callback,/target\.searchParams\.set\('reason', oauthError\)/)
})

test('production setup documents the exact Vercel callback and test-user remedy',()=>{
 const setup=read('docs/google-calendar-setup.md')
 assert.match(setup,/https:\/\/strativate\.vercel\.app\/api\/google-calendar\/callback/)
 assert.match(setup,/Google Auth Platform[\s\S]*Audience[\s\S]*Test users/)
 assert.match(setup,/403 access_denied/)
 assert.match(setup,/redeploy the production deployment/i)
 const env=read('.env.example')
 assert.match(env,/strativate\.vercel\.app\/api\/google-calendar\/callback/)
})
