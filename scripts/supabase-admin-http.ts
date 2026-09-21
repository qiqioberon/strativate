type AuthUser={id:string;email?:string|null}

export function createSupabaseAdminHttp({url,secret,fetchImpl=fetch}:{url:string;secret:string;fetchImpl?:typeof fetch}){
  const base=url.replace(/\/$/,'')
  async function request<T>(path:string,init:RequestInit={}){
    const response=await fetchImpl(base+path,{...init,headers:{apikey:secret,authorization:`Bearer ${secret}`,'content-type':'application/json',...init.headers}})
    const body=await response.json().catch(()=>null) as T|{message?:string;error?:string}|null
    if(!response.ok){
      const detail=body&&typeof body==='object'&&('message'in body||'error'in body)?body.message||body.error:null
      throw new Error(detail||`Supabase request failed with HTTP ${response.status}`)
    }
    return body as T
  }
  return{
    async listAuthUsers(perPage=1000){
      const users:AuthUser[]=[]
      for(let page=1;;page+=1){
        const body=await request<{users:AuthUser[]}>(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`)
        users.push(...body.users)
        if(body.users.length<perPage)break
      }
      return users
    },
    createAuthUser(args:{email:string;password:string;email_confirm:boolean;user_metadata:Record<string,unknown>}){
      return request<AuthUser>('/auth/v1/admin/users',{method:'POST',body:JSON.stringify(args)})
    },
    updateAuthUser(id:string,args:{password:string;email_confirm:boolean}){
      return request<AuthUser>(`/auth/v1/admin/users/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(args)})
    },
    async deleteAuthUser(id:string){await request<void>(`/auth/v1/admin/users/${encodeURIComponent(id)}`,{method:'DELETE'})},
    select<T>(table:string,columns:string){return request<T[]>(`/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(columns)}`,{method:'GET'})},
    rpc<T=unknown>(name:string,args:Record<string,unknown>){return request<T>(`/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',body:JSON.stringify(args)})},
  }
}
