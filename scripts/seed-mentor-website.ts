import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {
  attachWorkbookEmails,
  executeDevMentorAccountPlan,
  parseMentorWebsiteSeed,
  planDevMentorAccounts,
  readMentorWorkbookIdentities,
  redactDevMentorSeedLog,
  validateDevMentorSeedEnvironment,
} from './mentor-website-seed-data'
import {createSupabaseAdminHttp} from './supabase-admin-http'

const dryRun=process.argv.includes('--dry-run')
const seedPath=resolve('supabase/seed/mentor_website_profiles.json')
const migration='supabase/migrations/202609210004_dev_mentor_account_seed.sql'
let temporaryPassword=''

async function main(){
  const config=validateDevMentorSeedEnvironment(process.env)
  temporaryPassword=config.password
  const parsed=parseMentorWebsiteSeed(JSON.parse(readFileSync(seedPath,'utf8')))
  if(parsed.invalid.length){
    console.log(JSON.stringify({mode:dryRun?'dry-run':'seed',invalidSeedRows:parsed.invalid.length,invalid:parsed.invalid}))
    throw new Error('Committed mentor seed data is invalid; no writes were attempted.')
  }
  const workbook=await readMentorWorkbookIdentities(resolve(config.workbookPath))
  const attached=attachWorkbookEmails(parsed.rows,workbook.rows)
  const missingTiers=attached.matched.filter(item=>!item.row.tierName)
  if(workbook.invalid.length||attached.missingSeedRows.length||attached.unknownWorkbookRows.length||missingTiers.length){
    console.log(JSON.stringify({
      mode:dryRun?'dry-run':'seed',
      workbookRows:workbook.rows.length,
      invalidWorkbookRows:workbook.invalid.length,
      invalidWorkbookRowNumbers:workbook.invalid.map(item=>item.row),
      seedRowsMissingWorkbookIdentity:attached.missingSeedRows.map(row=>row.publicSlug),
      unrecognizedWorkbookRows:attached.unknownWorkbookRows.length,
      seedRowsMissingTier:missingTiers.map(item=>item.row.publicSlug),
    }))
    throw new Error('Workbook identities and committed mentor seed do not match exactly; no writes were attempted.')
  }

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret=process.env.SUPABASE_SECRET_KEY
  if(!url||!secret)throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.')
  const admin=createSupabaseAdminHttp({url,secret})
  const [authUsers,profiles]=await Promise.all([
    admin.listAuthUsers(),
    admin.select<{id:string;role:string}>('profiles','id,role'),
  ]).catch(error=>{throw new Error(`Mentor account domain is unavailable. Apply ${migration} and its prerequisite migrations first. ${error instanceof Error?error.message:''}`)})
  const plan=planDevMentorAccounts(attached.matched,authUsers,profiles)
  const conflictedSlugs=plan.conflicts.flatMap(conflict=>{
    const match=attached.matched.find(item=>item.email===conflict.email)
    return match?[match.row.publicSlug]:[]
  })
  if(plan.conflicts.length){
    console.log(JSON.stringify({mode:dryRun?'dry-run':'seed',protectedOrUnsupportedAccounts:plan.conflicts.length,mentors:conflictedSlugs}))
    throw new Error('Protected or unsupported existing accounts prevent this seed; no writes were attempted.')
  }

  const result=await executeDevMentorAccountPlan(plan,admin,config.password,dryRun)
  console.log(JSON.stringify({
    mode:dryRun?'dry-run':'seed',
    totalMentors:attached.matched.length,
    accountsPlannedForCreation:plan.create.length,
    accountsPlannedForPasswordReset:plan.update.length,
    ...result,
    protectedOrUnsupportedAccounts:0,
    invalidRows:0,
  }))
}

main().catch(error=>{
  console.error(redactDevMentorSeedLog(error instanceof Error?error.message:'Development mentor account seed failed.',[temporaryPassword]))
  process.exitCode=1
})
