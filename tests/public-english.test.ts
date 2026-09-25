import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root=path.resolve(import.meta.dirname,'..')
const publicFiles=[
  'app/produk-digital/[slug]/page.tsx',
  'components/digital-products/add-to-cart-button.tsx',
  'components/marketing/hero-carousel.tsx',
  'components/marketing/mentor-portrait-media.tsx',
  'components/marketing/mentor-detail-modal.tsx',
  'components/marketing/asset-media.tsx',
  'components/programs/program-comparison.tsx',
  'components/programs/program-detail.tsx',
]

test('known Indonesian public UI strings do not leak into revised marketing surfaces', async()=>{
  const source=(await Promise.all(publicFiles.map(file=>readFile(path.join(root,file),'utf8')))).join('\n')
  for(const phrase of [
    'Kembali ke Produk Digital','Produk Digital','Harga','Lihat keranjang',
    'Masuk untuk membeli','Tambahkan ke Keranjang','Buka informasi','Jelajahi ',
    '/sesi','Foto belum tersedia','Aset belum tersedia','Buka LinkedIn',
  ]) assert.equal(source.includes(phrase),false,`public UI still contains: ${phrase}`)
})
