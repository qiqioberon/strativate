import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {parseMentorWebsiteSeed,planMentorWebsiteSeed,type SeedAccount} from './mentor-website-seed-data'
import {createSupabaseAdminHttp} from './supabase-admin-http'

const dryRun=process.argv.includes('--dry-run')
const seedPath=resolve('supabase/seed/mentor_website_profiles.json')
const migration='supabase/migrations/202609210002_mentor_website_seed_import.sql'
const url=process.env.NEXT_PUBLIC_SUPABASE_URL
const secret=process.env.SUPABASE_SECRET_KEY

function identityHash(email:string){return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}

async function main(){
  const parsed=parseMentorWebsiteSeed(JSON.parse(readFileSync(seedPath,'utf8')))
  if(parsed.invalid.length){
    console.log(JSON.stringify({mode:dryRun?'dry-run':'import',totalSpreadsheetMentors:parsed.rows.length+parsed.invalid.length,matchedExistingMentorAccounts:0,publicProfilesInserted:0,publicProfilesUpdated:0,unmatchedAccountsRequiringAction:0,invalidRows:parsed.invalid.length,invalid:parsed.invalid}))
    throw new Error('Seed data is invalid; no database writes were attempted.')
  }
  if(!url||!secret)throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.')
  const admin=createSupabaseAdminHttp({url,secret})
  const [authUsers,mentorProfiles,profiles,tiers,existingProfiles]=await Promise.all([
    admin.listAuthUsers(),
    admin.select<{user_id:string;tier_id:string|null}>('mentor_profiles','user_id,tier_id'),
    admin.select<{id:string;role:string}>('profiles','id,role'),
    admin.select<{id:string;name:string}>('mentor_tiers','id,name'),
    admin.select<{id:string;mentor_user_id:string;public_slug:string}>('mentor_public_profiles','id,mentor_user_id,public_slug'),
  ]).catch(error=>{throw new Error(`Mentor public-profile domain is unavailable. Apply ${migration} and its prerequisite migrations first. ${error instanceof Error?error.message:''}`)})
  const tierById=new Map(tiers.map(tier=>[tier.id,tier.name]))
  const mentorById=new Map(mentorProfiles.map(profile=>[profile.user_id,profile]))
  const profileById=new Map(profiles.map(profile=>[profile.id,profile]))
  const accounts:SeedAccount[]=authUsers.flatMap(user=>user.email?[{
    userId:user.id,accountIdentityHash:identityHash(user.email),isMentor:mentorById.has(user.id)&&profileById.get(user.id)?.role==='mentor',tierName:mentorById.get(user.id)?.tier_id?tierById.get(mentorById.get(user.id)!.tier_id!)??null:null,
  }]:[])
  const plan=planMentorWebsiteSeed(parsed.rows,accounts,existingProfiles.map(profile=>({id:profile.id,mentorUserId:profile.mentor_user_id,publicSlug:profile.public_slug})))

  let inserted=plan.inserted,updated=plan.updated
  if(!dryRun){
    const p_rows=plan.matched.map(({row,mentorUserId})=>({
      mentor_user_id:mentorUserId,public_slug:row.publicSlug,display_name:row.displayName,tier_name:row.tierName,
      headline:row.headline,linkedin_url:row.linkedinUrl,short_bio:row.shortBio,
      portrait_asset_key:row.portraitAssetKey,photo_status:row.photoStatus,
      publication_status:row.publicationStatus,sort_order:row.sortOrder,
      achievements:row.achievements,expertise_names:row.expertise,
    }))
    try{
      const result=await admin.rpc<{inserted:number;updated:number}>('service_seed_mentor_website_profiles',{p_rows})
      inserted=result.inserted;updated=result.updated
    }catch(error){
      console.log(JSON.stringify({mode:'import',totalSpreadsheetMentors:parsed.rows.length,matchedExistingMentorAccounts:plan.matched.length,publicProfilesInserted:0,publicProfilesUpdated:0,unmatchedAccountsRequiringAction:plan.unmatched.length,unmatched:plan.unmatched.map(row=>row.publicSlug),tierMismatchesRequiringAction:plan.tierMismatches.length,tierMismatches:plan.tierMismatches.map(item=>({mentor:item.row.publicSlug,expected:item.row.tierName,actual:item.actualTier})),invalidRows:0,importFailed:true}))
      throw new Error(`Atomic mentor website import failed; no seed writes were committed. ${error instanceof Error?error.message:'Unknown error'}. Apply ${migration} first if the RPC is missing.`)
    }
  }

  const summary={
    mode:dryRun?'dry-run':'import',
    totalSpreadsheetMentors:parsed.rows.length,
    matchedExistingMentorAccounts:plan.matched.length,
    publicProfilesInserted:inserted,
    publicProfilesUpdated:updated,
    unmatchedAccountsRequiringAction:plan.unmatched.length,
    unmatched:plan.unmatched.map(row=>row.publicSlug),
    tierMismatchesRequiringAction:plan.tierMismatches.length,
    tierMismatches:plan.tierMismatches.map(item=>({mentor:item.row.publicSlug,expected:item.row.tierName,actual:item.actualTier})),
    invalidRows:parsed.invalid.length,
  }
  console.log(JSON.stringify(summary))
  if(plan.unmatched.length||plan.tierMismatches.length)process.exitCode=2
}

main().catch(error=>{console.error(error instanceof Error?error.message:'Mentor website seed failed.');process.exitCode=1})
