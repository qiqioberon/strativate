import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {
  parseMentorWebsiteSeed,
  planMentorWebsiteSeed,
  type MentorWebsiteSeedInput,
} from '../scripts/mentor-website-seed-data.ts'

const seedPath='supabase/seed/mentor_website_profiles.json'

test('approved spreadsheet seed normalizes all 26 public mentor rows without plaintext email',()=>{
  const source=readFileSync(seedPath,'utf8')
  const parsed=parseMentorWebsiteSeed(JSON.parse(source))
  assert.equal(parsed.invalid.length,0)
  assert.equal(parsed.rows.length,26)
  assert.doesNotMatch(source,/@/)
  assert.deepEqual(parsed.rows[0],{
    accountIdentityHash:'78d5ca53916e941c8f523c97525ae230addacc1c0f36819c549ae1404c744a90',
    publicSlug:'navira-putri',displayName:'Navira Putri',tierName:'Young Professional',headline:'Senior Associate Consultant at Altha Consulting',
    linkedinUrl:'https://www.linkedin.com/in/navira-putri-apriliani-063476207/',shortBio:null,
    portraitAssetKey:'mentors.navira-putri.portrait',photoStatus:'ready',publicationStatus:'published',sortOrder:10,
    achievements:['Co-Founder Strativate','Next Generation Women Leaders Asia Pacific 2026 — McKinsey & Company','Winner of 30+ business and research competitions'],
    expertise:['Lintas kategori kompetisi'],
  })
})

test('seed normalization trims and deduplicates achievements and expertise in source order',()=>{
  const fixture:MentorWebsiteSeedInput={account_identity_hash:'a'.repeat(64),public_slug:'mentor-one',display_name:' Mentor One ',tier_name:'Top Student',headline:null,linkedin_url:null,short_bio:null,portrait_asset_key:null,photo_status:'missing',publication_status:'published',sort_order:10,achievements:[' Winner  ','Winner','Finalist'],expertise:['Finance',' Finance ']}
  const parsed=parseMentorWebsiteSeed([fixture])
  assert.equal(parsed.invalid.length,0)
  assert.deepEqual(parsed.rows[0].achievements,['Winner','Finalist'])
  assert.deepEqual(parsed.rows[0].expertise,['Finance'])
})

test('unknown expertise is rejected deterministically before database writes',()=>{
  const fixture:MentorWebsiteSeedInput={account_identity_hash:'b'.repeat(64),public_slug:'mentor-two',display_name:'Mentor Two',tier_name:'Top Student',headline:null,linkedin_url:null,short_bio:null,portrait_asset_key:null,photo_status:'missing',publication_status:'published',sort_order:20,achievements:[],expertise:['Invented Category']}
  const parsed=parseMentorWebsiteSeed([fixture])
  assert.deepEqual(parsed.rows,[])
  assert.deepEqual(parsed.invalid,[{row:1,identity:'mentor-two',reason:'Unknown expertise: Invented Category'}])
})

test('seed plan reuses normalized account identity and reports accounts without real mentor ownership',()=>{
  const parsed=parseMentorWebsiteSeed(JSON.parse(readFileSync(seedPath,'utf8')))
  const [matched,unmatched]=parsed.rows
  const plan=planMentorWebsiteSeed([matched,unmatched],[{userId:'mentor-user-1',accountIdentityHash:matched.accountIdentityHash,isMentor:true,tierName:matched.tierName},{userId:'plain-user',accountIdentityHash:unmatched.accountIdentityHash,isMentor:false,tierName:null}],[])
  assert.equal(plan.matched.length,1)
  assert.equal(plan.matched[0].mentorUserId,'mentor-user-1')
  assert.deepEqual(plan.unmatched.map(row=>row.publicSlug),[unmatched.publicSlug])
})

test('rerunning the seed updates the owned profile without duplicate profile identity',()=>{
  const parsed=parseMentorWebsiteSeed(JSON.parse(readFileSync(seedPath,'utf8')))
  const row=parsed.rows[0]
  const accounts=[{userId:'mentor-user-1',accountIdentityHash:row.accountIdentityHash,isMentor:true,tierName:row.tierName}]
  const first=planMentorWebsiteSeed([row],accounts,[])
  assert.equal(first.inserted,1)
  assert.equal(first.updated,0)
  const second=planMentorWebsiteSeed([row],accounts,[{id:'profile-1',mentorUserId:'mentor-user-1',publicSlug:row.publicSlug}])
  assert.equal(second.inserted,0)
  assert.equal(second.updated,1)
  assert.equal(second.matched.length,1)
  assert.equal(new Set(second.matched[0].row.achievements).size,second.matched[0].row.achievements.length)
  assert.equal(new Set(second.matched[0].row.expertise).size,second.matched[0].row.expertise.length)
})

test('profiles absent from the spreadsheet are explicitly left untouched',()=>{
  const parsed=parseMentorWebsiteSeed(JSON.parse(readFileSync(seedPath,'utf8')))
  const row=parsed.rows[0]
  const plan=planMentorWebsiteSeed([row],[{userId:'mentor-user-1',accountIdentityHash:row.accountIdentityHash,isMentor:true,tierName:row.tierName}],[
    {id:'profile-1',mentorUserId:'mentor-user-1',publicSlug:row.publicSlug},
    {id:'profile-existing',mentorUserId:'mentor-existing',publicSlug:'existing-mentor'},
  ])
  assert.deepEqual(plan.untouchedExistingProfileIds,['profile-existing'])
})

test('seeder source has no auth-account creation or invitation side effect',()=>{
  const source=readFileSync('scripts/seed-mentor-website.ts','utf8')
  assert.doesNotMatch(source,/createUser|inviteUserByEmail|auth\.users\s*\)|insert\([^)]*auth/i)
})

test('import uses one transactional bulk RPC and the exact operational mentor-role predicate',()=>{
  const source=readFileSync('scripts/seed-mentor-website.ts','utf8')
  const migration=readFileSync('supabase/migrations/202609210002_mentor_website_seed_import.sql','utf8')
  assert.match(source,/select<\{id:string;role:string\}>\('profiles','id,role'\)/)
  assert.match(source,/profileById\.get\(user\.id\)\?\.role==='mentor'/)
  assert.match(source,/admin\.rpc(?:<[^>]+>)?\('service_seed_mentor_website_profiles',\{p_rows\}\)/)
  assert.match(migration,/create or replace function public\.service_seed_mentor_website_profiles\(p_rows jsonb\)/)
  assert.match(migration,/jsonb_typeof\(p_rows\) <> 'array'/)
})

test('seed reconciliation tracks owned child rows and preserves absent mentor-managed scalar values',()=>{
  const migration=readFileSync('supabase/migrations/202609210002_mentor_website_seed_import.sql','utf8')
  assert.match(migration,/create table public\.mentor_website_seed_achievements/)
  assert.match(migration,/create table public\.mentor_website_seed_expertise/)
  assert.match(migration,/headline=coalesce\(/)
  assert.match(migration,/short_bio=coalesce\(/)
  assert.doesNotMatch(migration,/portrait_url\s*=\s*null/)
  assert.match(migration,/delete from public\.mentor_public_achievements a\s+using public\.mentor_website_seed_achievements managed/)
  assert.match(migration,/delete from public\.mentor_public_profile_expertise relation\s+using public\.mentor_website_seed_expertise managed/)
})
