import assert from 'node:assert/strict'
import test from 'node:test'
import {createSupabaseAdminHttp} from '../scripts/supabase-admin-http.ts'

test('admin HTTP client paginates auth users without initializing realtime',async()=>{
  const calls:string[]=[]
  const fakeFetch:typeof fetch=async(input,init)=>{
    const url=String(input);calls.push(url)
    assert.equal(new Headers(init?.headers).get('authorization'),'Bearer secret')
    const page=new URL(url).searchParams.get('page')
    return new Response(JSON.stringify({users:page==='1'?[{id:'u1',email:'one@test.invalid'},{id:'u2',email:'two@test.invalid'}]:[{id:'u3',email:'three@test.invalid'}]}),{status:200,headers:{'content-type':'application/json'}})
  }
  const client=createSupabaseAdminHttp({url:'https://project.supabase.co',secret:'secret',fetchImpl:fakeFetch})
  const users=await client.listAuthUsers(2)
  assert.deepEqual(users.map(user=>user.id),['u1','u2','u3'])
  assert.deepEqual(calls,['https://project.supabase.co/auth/v1/admin/users?page=1&per_page=2','https://project.supabase.co/auth/v1/admin/users?page=2&per_page=2'])
})

test('admin HTTP client exposes PostgREST select and RPC failures clearly',async()=>{
  const fakeFetch:typeof fetch=async(input,init)=>{
    const url=String(input)
    if(url.includes('/rpc/'))return new Response(JSON.stringify({message:'migration missing'}),{status:404,headers:{'content-type':'application/json'}})
    assert.equal(init?.method,'GET')
    return new Response(JSON.stringify([{id:'tier-1',name:'Top Student'}]),{status:200,headers:{'content-type':'application/json'}})
  }
  const client=createSupabaseAdminHttp({url:'https://project.supabase.co/',secret:'secret',fetchImpl:fakeFetch})
  assert.deepEqual(await client.select<{id:string;name:string}>('mentor_tiers','id,name'),[{id:'tier-1',name:'Top Student'}])
  await assert.rejects(client.rpc('service_seed_mentor_website_profile',{}),/migration missing/)
})
