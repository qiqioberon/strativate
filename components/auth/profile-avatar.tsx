'use client'
/* eslint-disable @next/next/no-img-element */
import {useEffect,useMemo,useState} from 'react'
import type {Profile} from '@/lib/supabase/database.types'

type AvatarAccount=Pick<Profile,'first_name'|'last_name'|'username'|'avatar_url'|'avatar_path'|'updated_at'>
export function ProfileAvatar({account,className='',srcOverride=null}:{account:AvatarAccount;className?:string;srcOverride?:string|null}){
 const fallback=useMemo(()=>[account.first_name,account.last_name].filter(Boolean).map(value=>value!.trim()[0]).join('').slice(0,2).toUpperCase()||account.username?.slice(0,2).toUpperCase()||'S',[account.first_name,account.last_name,account.username])
 const source=srcOverride||(account.avatar_path?'/api/profile/avatar?rev='+encodeURIComponent(account.updated_at):account.avatar_url)
 const[failed,setFailed]=useState(false)
 useEffect(()=>setFailed(false),[source])
 if(source&&!failed)return <img className={'profile-avatar-image '+className} src={source} alt="" aria-hidden="true" onError={()=>setFailed(true)}/>
 return <span className={'profile-avatar-fallback '+className} aria-hidden="true">{fallback}</span>
}
