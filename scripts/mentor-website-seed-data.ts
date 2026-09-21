import {createHash} from 'node:crypto'
import ExcelJS from 'exceljs'

export const APPROVED_MENTOR_EXPERTISE = [
  'Lintas kategori kompetisi',
  'Business Plan',
  'Business Case',
  'Marketing',
  'Finance',
  'Economics',
  'Accounting',
  'Proposal Development',
] as const

export type MentorWebsiteSeedInput={
  account_identity_hash:unknown
  public_slug:unknown
  display_name:unknown
  tier_name:unknown
  headline:unknown
  linkedin_url:unknown
  short_bio:unknown
  portrait_asset_key:unknown
  photo_status:unknown
  publication_status:unknown
  sort_order:unknown
  achievements:unknown
  expertise:unknown
}

export type MentorWebsiteSeedRow={
  accountIdentityHash:string
  publicSlug:string
  displayName:string
  tierName:'Top Student'|'Young Professional'|null
  headline:string|null
  linkedinUrl:string|null
  shortBio:string|null
  portraitAssetKey:string|null
  photoStatus:'ready'|'missing'
  publicationStatus:'draft'|'published'
  sortOrder:number
  achievements:string[]
  expertise:string[]
}

export type WorkbookMentorIdentity={displayName:string;email:string}
export type MentorSeedWithEmail={row:MentorWebsiteSeedRow;email:string}
export type DevMentorAccountPlan={
  create:MentorSeedWithEmail[]
  update:Array<MentorSeedWithEmail&{userId:string}>
  conflicts:Array<{email:string;reason:string}>
}
export type DevMentorSeedAdmin={
  createAuthUser(args:{email:string;password:string;email_confirm:boolean;user_metadata:Record<string,unknown>}):Promise<{id:string}>
  updateAuthUser(id:string,args:{password:string;email_confirm:boolean}):Promise<unknown>
  deleteAuthUser(id:string):Promise<void>
  rpc(name:string,args:Record<string,unknown>):Promise<{created:boolean}>
}

const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
const hashPattern=/^[a-f0-9]{64}$/
const approvedExpertise=new Set<string>(APPROVED_MENTOR_EXPERTISE)

export function normalizedEmailHash(email:string){
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

export function validateDevMentorSeedEnvironment(env:Record<string,string|undefined>){
  if(env.NODE_ENV==='production'||env.VERCEL_ENV==='production')throw new Error('Development mentor account seed is disabled in production.')
  if(env.ALLOW_DEV_MENTOR_ACCOUNT_SEED!=='true')throw new Error('Set ALLOW_DEV_MENTOR_ACCOUNT_SEED=true to acknowledge the development-only account reset.')
  const password=env.MENTOR_SEED_SHARED_PASSWORD??''
  if(password.length<12)throw new Error('MENTOR_SEED_SHARED_PASSWORD must contain at least 12 characters.')
  const targetUrl=(env.NEXT_PUBLIC_SUPABASE_URL??'').trim().replace(/\/$/,'')
  const allowedUrl=(env.MENTOR_SEED_ALLOWED_SUPABASE_URL??'').trim().replace(/\/$/,'')
  if(!targetUrl)throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for the development mentor account seed.')
  if(!allowedUrl)throw new Error('Set MENTOR_SEED_ALLOWED_SUPABASE_URL to the exact approved development project URL.')
  if(targetUrl!==allowedUrl)throw new Error('NEXT_PUBLIC_SUPABASE_URL does not match MENTOR_SEED_ALLOWED_SUPABASE_URL; refusing to reset mentor accounts.')
  return{password,workbookPath:env.MENTOR_SEED_WORKBOOK_PATH??'../Data Mentor for website.xlsx'}
}

export function redactDevMentorSeedLog(message:string,sensitiveValues:string[]=[]){
  let redacted=message.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-email]')
  for(const value of [...sensitiveValues].filter(Boolean).sort((a,b)=>b.length-a.length))redacted=redacted.split(value).join('[redacted-secret]')
  return redacted
}

export function parseMentorWorkbookIdentityRows(sourceRows:unknown[][]){
  const rows:WorkbookMentorIdentity[]=[],invalid:{row:number;reason:string}[]=[]
  const seen=new Set<string>()
  sourceRows.forEach((source,index)=>{
    if(!source.some(value=>value!==null&&value!==undefined&&String(value).trim()!==''))return
    const displayName=typeof source[1]==='string'?source[1].replace(/\s+/g,' ').trim():''
    const email=typeof source[2]==='string'?source[2].trim().toLowerCase():''
    if(!displayName||!/^\S+@\S+\.\S+$/.test(email)){invalid.push({row:index+1,reason:'Name and valid email are required'});return}
    if(seen.has(email)){invalid.push({row:index+1,reason:'Duplicate email'});return}
    seen.add(email);rows.push({displayName,email})
  })
  return{rows,invalid}
}

export async function readMentorWorkbookIdentities(path:string){
  const workbook=new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)
  const sheet=workbook.worksheets[0]
  if(!sheet)throw new Error('Mentor workbook does not contain a worksheet.')
  const sourceRows:unknown[][]=[]
  sheet.eachRow({includeEmpty:true},row=>sourceRows.push((row.values as unknown[]).slice(1)))
  return parseMentorWorkbookIdentityRows(sourceRows)
}

export function attachWorkbookEmails(seedRows:MentorWebsiteSeedRow[],identities:WorkbookMentorIdentity[]){
  const identityByHash=new Map(identities.map(identity=>[normalizedEmailHash(identity.email),identity]))
  const seedHashSet=new Set(seedRows.map(row=>row.accountIdentityHash))
  return{
    matched:seedRows.flatMap(row=>{const identity=identityByHash.get(row.accountIdentityHash);return identity?[{row,email:identity.email}]:[]}),
    missingSeedRows:seedRows.filter(row=>!identityByHash.has(row.accountIdentityHash)),
    unknownWorkbookRows:identities.filter(identity=>!seedHashSet.has(normalizedEmailHash(identity.email))),
  }
}

export function planDevMentorAccounts<T extends{email:string}>(rows:T[],users:Array<{id:string;email?:string|null}>,roles:Array<{id:string;role:string}>){
  const userByEmail=new Map(users.flatMap(user=>user.email?[[user.email.trim().toLowerCase(),user] as const]:[]))
  const roleById=new Map(roles.map(profile=>[profile.id,profile.role]))
  const create:T[]=[],update:Array<T&{userId:string}>=[],conflicts:Array<{email:string;reason:string}>=[]
  for(const row of rows){
    const email=row.email.trim().toLowerCase(),user=userByEmail.get(email)
    if(!user){create.push({...row,email});continue}
    const role=roleById.get(user.id)
    if(role==='admin'){conflicts.push({email,reason:'Existing admin account cannot be overwritten'});continue}
    if(role!=='mentor'&&role!=='mentee'){conflicts.push({email,reason:'Existing account profile is missing or unsupported'});continue}
    update.push({...row,email,userId:user.id})
  }
  return{create,update,conflicts}
}

function rpcProfile(row:MentorWebsiteSeedRow){
  return{
    public_slug:row.publicSlug,
    display_name:row.displayName,
    tier_name:row.tierName,
    headline:row.headline,
    linkedin_url:row.linkedinUrl,
    short_bio:row.shortBio,
    portrait_asset_key:row.portraitAssetKey,
    photo_status:row.photoStatus,
    publication_status:row.publicationStatus,
    sort_order:row.sortOrder,
    achievements:row.achievements,
    expertise_names:row.expertise,
  }
}

export async function executeDevMentorAccountPlan(plan:DevMentorAccountPlan,admin:DevMentorSeedAdmin,password:string,dryRun:boolean){
  if(plan.conflicts.length)throw new Error(`Mentor account plan contains ${plan.conflicts.length} protected or unsupported account conflict(s).`)
  const result={accountsCreated:0,accountsUpdated:0,profilesCreated:0,profilesUpdated:0}
  if(dryRun)return result
  for(const item of plan.create){
    const user=await admin.createAuthUser({email:item.email,password,email_confirm:true,user_metadata:{given_name:item.row.displayName}})
    try{
      const profile=await admin.rpc('service_seed_dev_mentor_account',{p_user_id:user.id,p_profile:rpcProfile(item.row)})
      result.accountsCreated+=1
      if(profile.created)result.profilesCreated+=1
      else result.profilesUpdated+=1
    }catch(error){
      try{await admin.deleteAuthUser(user.id)}catch(cleanupError){
        throw new Error(`${error instanceof Error?error.message:'Mentor profile configuration failed'}; cleanup of the newly created Auth user also failed: ${cleanupError instanceof Error?cleanupError.message:'unknown cleanup error'}`)
      }
      throw error
    }
  }
  for(const item of plan.update){
    const profile=await admin.rpc('service_seed_dev_mentor_account',{p_user_id:item.userId,p_profile:rpcProfile(item.row)})
    await admin.updateAuthUser(item.userId,{password,email_confirm:true})
    result.accountsUpdated+=1
    if(profile.created)result.profilesCreated+=1
    else result.profilesUpdated+=1
  }
  return result
}

function optionalText(value:unknown,max:number){
  if(value===null||value===undefined||value==='')return null
  if(typeof value!=='string')throw new Error('Expected text or null')
  const normalized=value.replace(/\s+/g,' ').trim()
  if(!normalized||normalized.length>max)throw new Error(`Text must contain 1–${max} characters`)
  return normalized
}

function orderedUniqueText(value:unknown,label:string,maxItems=30){
  if(!Array.isArray(value))throw new Error(`${label} must be an array`)
  const result:string[]=[]
  const seen=new Set<string>()
  for(const entry of value){
    const normalized=optionalText(entry,500)
    if(!normalized)continue
    const key=normalized.toLocaleLowerCase('id-ID')
    if(!seen.has(key)){seen.add(key);result.push(normalized)}
  }
  if(result.length>maxItems)throw new Error(`${label} must contain at most ${maxItems} items`)
  return result
}

export function parseMentorWebsiteSeed(input:unknown){
  if(!Array.isArray(input))return{rows:[] as MentorWebsiteSeedRow[],invalid:[{row:0,identity:'seed',reason:'Seed must be an array'}]}
  const rows:MentorWebsiteSeedRow[]=[]
  const invalid:{row:number;identity:string;reason:string}[]=[]
  const identities=new Set<string>(),slugs=new Set<string>()
  input.forEach((entry,index)=>{
    const row=index+1
    const value=(entry&&typeof entry==='object'?entry:{}) as Partial<MentorWebsiteSeedInput>
    const identity=typeof value.public_slug==='string'?value.public_slug:`row-${row}`
    try{
      const accountIdentityHash=String(value.account_identity_hash??'').trim().toLowerCase()
      const publicSlug=String(value.public_slug??'').trim().toLowerCase()
      const displayName=String(value.display_name??'').replace(/\s+/g,' ').trim()
      if(!hashPattern.test(accountIdentityHash))throw new Error('Invalid account identity hash')
      if(!slugPattern.test(publicSlug)||publicSlug.length>120)throw new Error('Invalid public slug')
      if(!displayName||displayName.length>120)throw new Error('Invalid display name')
      if(identities.has(accountIdentityHash))throw new Error('Duplicate account identity')
      if(slugs.has(publicSlug))throw new Error('Duplicate public slug')
      const tier=value.tier_name===null?null:String(value.tier_name??'').trim()
      if(tier!==null&&tier!=='Top Student'&&tier!=='Young Professional')throw new Error('Invalid mentor tier')
      const headline=optionalText(value.headline,180)
      const linkedinUrl=optionalText(value.linkedin_url,2048)
      if(linkedinUrl&&!/^https?:\/\//.test(linkedinUrl))throw new Error('Invalid LinkedIn URL')
      const shortBio=optionalText(value.short_bio,1200)
      const portraitAssetKey=optionalText(value.portrait_asset_key,180)
      if(value.photo_status!=='ready'&&value.photo_status!=='missing')throw new Error('Invalid photo status')
      if(value.publication_status!=='draft'&&value.publication_status!=='published')throw new Error('Invalid publication status')
      if(!Number.isInteger(value.sort_order)||Number(value.sort_order)<0)throw new Error('Invalid sort order')
      const achievements=orderedUniqueText(value.achievements,'Achievements')
      const expertise=orderedUniqueText(value.expertise,'Expertise')
      const unknown=expertise.find(item=>!approvedExpertise.has(item))
      if(unknown)throw new Error(`Unknown expertise: ${unknown}`)
      identities.add(accountIdentityHash);slugs.add(publicSlug)
      rows.push({accountIdentityHash,publicSlug,displayName,tierName:tier,headline,linkedinUrl,shortBio,portraitAssetKey,photoStatus:value.photo_status,publicationStatus:value.publication_status,sortOrder:Number(value.sort_order),achievements,expertise})
    }catch(error){invalid.push({row,identity,reason:error instanceof Error?error.message:'Invalid seed row'})}
  })
  return{rows,invalid}
}
