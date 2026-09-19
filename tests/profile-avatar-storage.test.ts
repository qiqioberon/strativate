import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const read=(path:string)=>readFileSync(path,'utf8')

test('profile avatar storage stays private and owner-scoped',()=>{
 const sql=read('supabase/migrations/202609200004_profile_avatar_storage.sql')
 assert.match(sql,/profile-avatars','profile-avatars',false/i)
 assert.match(sql,/split_part\(name,'\/',1\)=auth\.uid\(\)::text/i)
 assert.match(sql,/avatar_path text/i)
 assert.match(sql,/legacy fallback/i)
})

test('profile avatar endpoint normalizes orientation crops server-side and writes lossless 512 webp',()=>{
 const route=read('app/api/profile/avatar/route.ts')
 assert.match(route,/sharp\(source/)
 assert.match(route,/\.rotate\(\)/)
 assert.match(route,/\.extract\(\{left,top,width:size,height:size\}\)/)
 assert.match(route,/\.resize\(512,512/)
 assert.match(route,/\.webp\(\{lossless:true\}\)/)
 assert.match(route,/\$\{account\.user\.id\}\/avatar\.webp/)
 assert.match(route,/MAX_BYTES=8\*1024\*1024/)
 assert.doesNotMatch(route,/getPublicUrl|public:true/)
})

test('profile UI replaces raw avatar URL editing with shared upload editor',()=>{
 const form=read('components/auth/profile-form.tsx')
 const avatar=read('components/auth/profile-avatar.tsx')
 const editor=read('components/auth/profile-avatar-editor.tsx')
 assert.match(form,/ProfileAvatarEditor/)
 assert.match(form,/Ubah foto profil/)
 assert.doesNotMatch(form,/name="avatar_url"/)
 assert.match(avatar,/avatar_path/)
 assert.match(avatar,/avatar_url/)
 assert.match(editor,/dragover|onDragOver/)
 assert.match(editor,/input aria-label="Zoom" type="range"/)
 assert.match(editor,/Simpan foto/)
})
