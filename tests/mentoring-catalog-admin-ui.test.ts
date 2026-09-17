import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
const read=(p:string)=>{assert.equal(existsSync(p),true,`${p} must exist`);return readFileSync(p,'utf8')}
test('admin exposes product catalog masters with table/pagination/dialog patterns',()=>{
 const admin=read('app/admin/page.tsx')
 for(const label of ['Private Mentoring','Intensive Mentoring','Competition Categories','Produk Digital']) assert.match(admin,new RegExp(label))
 for(const file of ['components/admin/private-mentoring-management.tsx','components/admin/intensive-mentoring-management.tsx','components/admin/competition-category-management.tsx']){
  const src=read(file);assert.match(src,/SortableTableHeader/);assert.match(src,/TablePagination/);assert.match(src,/<dialog/)
 }
 const intensiveUi=read('components/admin/intensive-mentoring-management.tsx')
 for(const fn of ['admin_save_intensive_package','admin_save_intensive_add_on','admin_save_intensive_bundle']) assert.match(intensiveUi,new RegExp(fn))
 assert.doesNotMatch(intensiveUi,/replaceChildren/)
 const privateUi=read('components/admin/private-mentoring-management.tsx')
 assert.doesNotMatch(privateUi,/private-mentoring-catalog-row|private-mentoring-package-row/)
})

test('mentoring catalog dialogs stay centered and form controls stay contained',()=>{
 const competitionUi=read('components/admin/competition-category-management.tsx')
 const css=read('components/admin/mentoring-catalog-management.module.css')
 assert.doesNotMatch(competitionUi,/row\.slug/)
 const dialog=css.match(/\.dialog\{([^}]*)\}/)?.[1]??''
 for(const rule of [/position:fixed/,/inset:0/,/margin:auto/,/overflow:hidden/]) assert.match(dialog,rule)
 const panel=css.match(/\.dialogPanel\{([^}]*)\}/)?.[1]??''
 assert.match(panel,/display:grid/)
 assert.match(panel,/grid-template-rows:auto minmax\(0,1fr\)/)
 assert.match(panel,/overflow:hidden/)
 const body=css.match(/\.dialogBody\{([^}]*)\}/)?.[1]??''
 assert.match(body,/overflow-y:auto/)
 assert.match(css,/\.field input:not\(\[type='checkbox'\]\)/)
 assert.match(css,/\.checkbox input\[type='checkbox'\]\{[^}]*width:16px[^}]*height:16px/)
 assert.match(css,/\.repeatableRow>input,.bundleRow>input,.bundleRow>select\{[^}]*width:100%/)
})
