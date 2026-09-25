import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root=path.resolve(import.meta.dirname,'..')
const read=(file:string)=>readFile(path.join(root,file),'utf8')

test('program, about, FAQ, publications, and competitions expose the requested stakeholder sections',async()=>{
  const [program,about,faq,publications,competitions]=await Promise.all([
    read('app/program/page.tsx'),read('app/tentang-kami/page.tsx'),read('app/tanya-jawab/page.tsx'),read('app/publications/page.tsx'),read('app/competitions/page.tsx'),
  ])
  for(const heading of ['Choose Your Mentoring Path','Perfect for you if','Our Services for Schools & Organizations','Ready Start Your Journey']) assert.match(program,new RegExp(heading))
  for(const heading of ['Empowering Future','Our Vision','Our Mission','What We']) assert.match(about,new RegExp(heading))
  assert.match(faq,/Have Questions\?/)
  assert.match(faq,/We Have Answers/)
  assert.match(faq,/Curious about Strativate\?/)
  assert.match(publications,/Publications <em>& News/)
  assert.match(competitions,/Discover Top/)
})

test('editorial admin provides upload, competition category selection, and section-controlled initial state',async()=>{
  const [admin,editor]=await Promise.all([read('app/admin/page.tsx'),read('components/admin/editorial-content-management.tsx')])
  assert.match(admin,/initialKind="publications"/)
  assert.match(admin,/initialKind="competitions"/)
  assert.match(editor,/type="file"/)
  assert.match(editor,/image\/jpeg,image\/png,image\/webp/)
  assert.match(editor,/editorial-competition-category-select/)
  assert.match(editor,/onClose={closeEditor}/)
})

test('digital product catalogue exposes a real content-format filter and detail sales proof',async()=>{
  const [directory,detail]=await Promise.all([read('components/digital-products/digital-product-directory.tsx'),read('app/produk-digital/[slug]/page.tsx')])
  assert.match(directory,/digital-product-content-type-filter/)
  assert.match(directory,/All formats/)
  assert.match(detail,/digital-product-detail-sales-count/)
})
