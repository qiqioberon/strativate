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

export type SeedAccount={userId:string;accountIdentityHash:string;isMentor:boolean;tierName:string|null}
export type ExistingSeedProfile={id:string;mentorUserId:string;publicSlug:string}
export type PlannedSeedRow={row:MentorWebsiteSeedRow;mentorUserId:string;existingProfileId:string|null}

const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/
const hashPattern=/^[a-f0-9]{64}$/
const approvedExpertise=new Set<string>(APPROVED_MENTOR_EXPERTISE)

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

export function planMentorWebsiteSeed(rows:MentorWebsiteSeedRow[],accounts:SeedAccount[],existingProfiles:ExistingSeedProfile[]){
  const accountByIdentity=new Map(accounts.map(account=>[account.accountIdentityHash,account]))
  const existingByOwner=new Map(existingProfiles.map(profile=>[profile.mentorUserId,profile]))
  const matched:PlannedSeedRow[]=[],unmatched:MentorWebsiteSeedRow[]=[],tierMismatches:{row:MentorWebsiteSeedRow;actualTier:string|null}[]=[]
  for(const row of rows){
    const account=accountByIdentity.get(row.accountIdentityHash)
    if(!account?.isMentor){unmatched.push(row);continue}
    if(row.tierName&&account.tierName!==row.tierName){tierMismatches.push({row,actualTier:account.tierName});continue}
    const existing=existingByOwner.get(account.userId)
    matched.push({row,mentorUserId:account.userId,existingProfileId:existing?.id??null})
  }
  const matchedOwners=new Set(matched.map(item=>item.mentorUserId))
  return{
    matched,
    unmatched,
    tierMismatches,
    inserted:matched.filter(item=>!item.existingProfileId).length,
    updated:matched.filter(item=>item.existingProfileId).length,
    untouchedExistingProfileIds:existingProfiles.filter(profile=>!matchedOwners.has(profile.mentorUserId)).map(profile=>profile.id),
  }
}
