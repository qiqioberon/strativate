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

test('admin HTTP client creates, updates, and deletes Auth users through server-only endpoints',async()=>{
  const calls:Array<{url:string;method:string;body:unknown}>=[]
  const fetchImpl:typeof fetch=async(input,init)=>{
    const url=String(input),method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):null
    calls.push({url,method,body})
    if(method==='DELETE')return new Response(null,{status:204})
    return new Response(JSON.stringify({id:'user-1',email:'mentor@example.test'}),{status:200,headers:{'content-type':'application/json'}})
  }
  const client=createSupabaseAdminHttp({url:'https://project.supabase.co',secret:'server-secret',fetchImpl}) as ReturnType<typeof createSupabaseAdminHttp>&{
    createAuthUser(args:{email:string;password:string;email_confirm:boolean;user_metadata:Record<string,unknown>}):Promise<{id:string;email:string}>
    updateAuthUser(id:string,args:{password:string;email_confirm:boolean}):Promise<{id:string;email:string}>
    deleteAuthUser(id:string):Promise<void>
  }
  assert.equal(typeof client.createAuthUser,'function')
  assert.equal(typeof client.updateAuthUser,'function')
  assert.equal(typeof client.deleteAuthUser,'function')
  await client.createAuthUser({email:'mentor@example.test',password:'shared-password',email_confirm:true,user_metadata:{full_name:'Mentor'}})
  await client.updateAuthUser('user-1',{password:'shared-password',email_confirm:true})
  await client.deleteAuthUser('user-1')
  assert.deepEqual(calls,[
    {url:'https://project.supabase.co/auth/v1/admin/users',method:'POST',body:{email:'mentor@example.test',password:'shared-password',email_confirm:true,user_metadata:{full_name:'Mentor'}}},
    {url:'https://project.supabase.co/auth/v1/admin/users/user-1',method:'PUT',body:{password:'shared-password',email_confirm:true}},
    {url:'https://project.supabase.co/auth/v1/admin/users/user-1',method:'DELETE',body:null},
  ])
})
