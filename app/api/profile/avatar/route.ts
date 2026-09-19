import {NextResponse} from 'next/server'
import sharp from 'sharp'
import {getAccount} from '@/lib/auth/server'
import {createAdminClient} from '@/lib/supabase/admin'

export const runtime='nodejs'
const BUCKET='profile-avatars'
const MAX_BYTES=8*1024*1024
const ALLOWED=new Set(['image/jpeg','image/png','image/webp'])
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))

export async function GET(){
 const account=await getAccount()
 if(!account)return NextResponse.json({error:'Unauthorized'},{status:401})
 const admin=createAdminClient()
 const{data:profile,error}=await admin.from('profiles').select('avatar_path').eq('id',account.user.id).maybeSingle()
 if(error||!profile?.avatar_path)return NextResponse.json({error:'Avatar not found'},{status:404})
 const{data,error:downloadError}=await admin.storage.from(BUCKET).download(profile.avatar_path)
 if(downloadError||!data)return NextResponse.json({error:'Avatar not found'},{status:404})
 return new Response(await data.arrayBuffer(),{headers:{'content-type':'image/webp','cache-control':'private, max-age=3600','x-content-type-options':'nosniff'}})
}

export async function POST(request:Request){
 const account=await getAccount()
 if(!account)return NextResponse.json({error:'Unauthorized'},{status:401})
 try{
  const form=await request.formData()
  const file=form.get('file')
  if(!(file instanceof File))return NextResponse.json({error:'Pilih file gambar.'},{status:400})
  if(!ALLOWED.has(file.type))return NextResponse.json({error:'Format foto harus JPG, PNG, atau WebP.'},{status:415})
  if(file.size<=0||file.size>MAX_BYTES)return NextResponse.json({error:'Ukuran foto maksimal 8 MB.'},{status:413})
  const zoom=clamp(Number(form.get('zoom')||1),1,3)
  const offsetX=clamp(Number(form.get('offsetX')||0),-1,1)
  const offsetY=clamp(Number(form.get('offsetY')||0),-1,1)
  const source=Buffer.from(await file.arrayBuffer())
  const normalized=await sharp(source,{failOn:'error'}).rotate().toBuffer({resolveWithObject:true})
  const width=normalized.info.width,height=normalized.info.height
  if(!width||!height||Math.min(width,height)<128)return NextResponse.json({error:'Resolusi foto terlalu kecil. Gunakan minimal 128×128 px.'},{status:400})
  const size=Math.max(1,Math.floor(Math.min(width,height)/zoom))
  const maxLeft=Math.max(0,width-size),maxTop=Math.max(0,height-size)
  const left=Math.round(clamp(maxLeft/2+offsetX*(maxLeft/2),0,maxLeft))
  const top=Math.round(clamp(maxTop/2+offsetY*(maxTop/2),0,maxTop))
  const output=await sharp(normalized.data).extract({left,top,width:size,height:size}).resize(512,512,{fit:'fill'}).webp({lossless:true}).toBuffer()
  const path=`${account.user.id}/avatar.webp`
  const admin=createAdminClient()
  const upload=await admin.storage.from(BUCKET).upload(path,output,{contentType:'image/webp',upsert:true,cacheControl:'3600'})
  if(upload.error)throw upload.error
  const update=await admin.from('profiles').update({avatar_path:path}).eq('id',account.user.id)
  if(update.error)throw update.error
  return NextResponse.json({path,avatarUrl:`/api/profile/avatar?rev=${Date.now()}`})
 }catch(error){
  console.error('Profile avatar upload failed',error)
  return NextResponse.json({error:'Foto profil belum dapat diproses. Coba file lain atau ulangi beberapa saat lagi.'},{status:400})
 }
}

export async function DELETE(){
 const account=await getAccount()
 if(!account)return NextResponse.json({error:'Unauthorized'},{status:401})
 const admin=createAdminClient(),path=`${account.user.id}/avatar.webp`
 await admin.storage.from(BUCKET).remove([path])
 const{error}=await admin.from('profiles').update({avatar_path:null}).eq('id',account.user.id)
 if(error)return NextResponse.json({error:'Foto profil belum dapat dihapus.'},{status:400})
 return NextResponse.json({ok:true})
}
