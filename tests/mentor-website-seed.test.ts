import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import ExcelJS from 'exceljs'
import {
  executeDevMentorAccountPlan,
  parseMentorWebsiteSeed,
  redactDevMentorSeedLog,
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

test('development account seed refuses production, missing opt-in, and weak shared passwords',async()=>{
  const seedModule=await import('../scripts/mentor-website-seed-data.ts') as Record<string,unknown>
  assert.equal(typeof seedModule.validateDevMentorSeedEnvironment,'function')
  const validate=seedModule.validateDevMentorSeedEnvironment as (env:Record<string,string|undefined>)=>{password:string;workbookPath:string}
  const target={NEXT_PUBLIC_SUPABASE_URL:'https://dev-project.supabase.co',MENTOR_SEED_ALLOWED_SUPABASE_URL:'https://dev-project.supabase.co'}
  assert.throws(()=>validate({...target,ALLOW_DEV_MENTOR_ACCOUNT_SEED:'true',MENTOR_SEED_SHARED_PASSWORD:'long-enough-password',NODE_ENV:'production'}),/production/i)
  assert.throws(()=>validate({MENTOR_SEED_SHARED_PASSWORD:'long-enough-password'}),/ALLOW_DEV_MENTOR_ACCOUNT_SEED/)
  assert.throws(()=>validate({...target,ALLOW_DEV_MENTOR_ACCOUNT_SEED:'true',MENTOR_SEED_SHARED_PASSWORD:'short'}),/12/)
  assert.throws(()=>validate({ALLOW_DEV_MENTOR_ACCOUNT_SEED:'true',MENTOR_SEED_SHARED_PASSWORD:'long-enough-password',NEXT_PUBLIC_SUPABASE_URL:'https://production.supabase.co'}),/MENTOR_SEED_ALLOWED_SUPABASE_URL/)
  assert.throws(()=>validate({ALLOW_DEV_MENTOR_ACCOUNT_SEED:'true',MENTOR_SEED_SHARED_PASSWORD:'long-enough-password',NEXT_PUBLIC_SUPABASE_URL:'https://production.supabase.co',MENTOR_SEED_ALLOWED_SUPABASE_URL:'https://dev-project.supabase.co'}),/does not match/i)
  const valid=validate({...target,ALLOW_DEV_MENTOR_ACCOUNT_SEED:'true',MENTOR_SEED_SHARED_PASSWORD:'long-enough-password',MENTOR_SEED_WORKBOOK_PATH:'D:/mentor.xlsx'})
  assert.equal(valid.password,'long-enough-password')
  assert.equal(valid.workbookPath,'D:/mentor.xlsx')
})

test('development seed log redaction removes email addresses and the temporary password',()=>{
  assert.equal(
    redactDevMentorSeedLog('Auth rejected mentor@example.test with shared-password-123',['shared-password-123']),
    'Auth rejected [redacted-email] with [redacted-secret]',
  )
})

test('workbook identity parser normalizes email and joins it to the committed hash without persisting email',async()=>{
  const seedModule=await import('../scripts/mentor-website-seed-data.ts') as Record<string,unknown>
  assert.equal(typeof seedModule.parseMentorWorkbookIdentityRows,'function')
  assert.equal(typeof seedModule.attachWorkbookEmails,'function')
  const parseRows=seedModule.parseMentorWorkbookIdentityRows as (rows:unknown[][])=>{rows:Array<{displayName:string;email:string}>;invalid:unknown[]}
  const attach=seedModule.attachWorkbookEmails as (rows:unknown[],identities:Array<{displayName:string;email:string}>)=>{matched:Array<{email:string}>;missingSeedRows:unknown[];unknownWorkbookRows:unknown[]}
  const parsed=parseRows([[null,null,null],[1,' Mentor One ',' Mentor.One@Example.Test ']])
  assert.deepEqual(parsed,{rows:[{displayName:'Mentor One',email:'mentor.one@example.test'}],invalid:[]})
  const seed=parseMentorWebsiteSeed([{account_identity_hash:'43f58a93338fc4f8cba5138b2fb8f7544c7144b4a90ed151ed2b5dca64535ec6',public_slug:'mentor-one',display_name:'Mentor One',tier_name:'Top Student',headline:null,linkedin_url:null,short_bio:null,portrait_asset_key:null,photo_status:'missing',publication_status:'published',sort_order:10,achievements:[],expertise:[]}])
  const attached=attach(seed.rows,parsed.rows)
  assert.equal(attached.matched[0].email,'mentor.one@example.test')
  assert.deepEqual(attached.missingSeedRows,[])
  assert.deepEqual(attached.unknownWorkbookRows,[])
})

test('development account plan creates missing users, updates mentor or mentee users, and protects admins',async()=>{
  const seedModule=await import('../scripts/mentor-website-seed-data.ts') as Record<string,unknown>
  assert.equal(typeof seedModule.planDevMentorAccounts,'function')
  const planAccounts=seedModule.planDevMentorAccounts as (rows:Array<{email:string}>,users:Array<{id:string;email:string}>,roles:Array<{id:string;role:string}>)=>{create:Array<{email:string}>;update:Array<{userId:string}>;conflicts:Array<{email:string;reason:string}>}
  const plan=planAccounts(
    [{email:'new@example.test'},{email:'mentor@example.test'},{email:'mentee@example.test'},{email:'admin@example.test'}],
    [{id:'mentor-id',email:'mentor@example.test'},{id:'mentee-id',email:'mentee@example.test'},{id:'admin-id',email:'admin@example.test'}],
    [{id:'mentor-id',role:'mentor'},{id:'mentee-id',role:'mentee'},{id:'admin-id',role:'admin'}],
  )
  assert.deepEqual(plan.create.map(item=>item.email),['new@example.test'])
  assert.deepEqual(plan.update.map(item=>item.userId),['mentor-id','mentee-id'])
  assert.deepEqual(plan.conflicts,[{email:'admin@example.test',reason:'Existing admin account cannot be overwritten'}])
})

test('workbook loader reads the approved no-header name and email columns',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'strativate-mentor-workbook-'))
  try{
    const path=join(directory,'mentors.xlsx'),workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Sheet1')
    sheet.addRow([null,null,null,null])
    sheet.addRow([1,'Mentor One','mentor.one@example.test','portrait.jpg'])
    await workbook.xlsx.writeFile(path)
    const seedModule=await import('../scripts/mentor-website-seed-data.ts') as Record<string,unknown>
    assert.equal(typeof seedModule.readMentorWorkbookIdentities,'function')
    const load=seedModule.readMentorWorkbookIdentities as (path:string)=>Promise<{rows:Array<{displayName:string;email:string}>;invalid:unknown[]}>
    assert.deepEqual(await load(path),{rows:[{displayName:'Mentor One',email:'mentor.one@example.test'}],invalid:[]})
  }finally{await rm(directory,{recursive:true,force:true})}
})

test('account executor configures profiles and resets existing passwords without exposing credentials',async()=>{
  const calls:string[]=[]
  const admin={
    async createAuthUser(){calls.push('create');return{id:'new-user'}},
    async updateAuthUser(id:string){calls.push(`password:${id}`);return{id}},
    async deleteAuthUser(id:string){calls.push(`delete:${id}`)},
    async rpc(_name:string,args:Record<string,unknown>){
      const id=String(args.p_user_id);calls.push(`profile:${id}`)
      return{profile_id:`profile-${id}`,created:id==='new-user',public_slug:'mentor'}
    },
  }
  const row=parseMentorWebsiteSeed(JSON.parse(readFileSync(seedPath,'utf8'))).rows[0]
  const result=await executeDevMentorAccountPlan({create:[{row,email:'new@example.test'}],update:[{row,email:'existing@example.test',userId:'existing-user'}],conflicts:[]},admin,'shared-password-123',false)
  assert.deepEqual(calls,['create','profile:new-user','profile:existing-user','password:existing-user'])
  assert.deepEqual(result,{accountsCreated:1,accountsUpdated:1,profilesCreated:1,profilesUpdated:1})
})

test('account executor removes a newly created auth user when profile configuration fails',async()=>{
  const calls:string[]=[]
  const admin={
    async createAuthUser(){calls.push('create');return{id:'new-user'}},
    async updateAuthUser(id:string){return{id}},
    async deleteAuthUser(id:string){calls.push(`delete:${id}`)},
    async rpc(){calls.push('profile');throw new Error('profile failed')},
  }
  const row=parseMentorWebsiteSeed(JSON.parse(readFileSync(seedPath,'utf8'))).rows[0]
  await assert.rejects(()=>executeDevMentorAccountPlan({create:[{row,email:'new@example.test'}],update:[],conflicts:[]},admin,'shared-password-123',false),/profile failed/)
  assert.deepEqual(calls,['create','profile','delete:new-user'])
})

test('account executor performs no writes when the plan has a protected-account conflict or is a dry run',async()=>{
  let writes=0
  const admin={
    async createAuthUser(){writes+=1;return{id:'new-user'}},
    async updateAuthUser(id:string){writes+=1;return{id}},
    async deleteAuthUser(){writes+=1},
    async rpc(){writes+=1;return{created:true}},
  }
  const row=parseMentorWebsiteSeed(JSON.parse(readFileSync(seedPath,'utf8'))).rows[0]
  await assert.rejects(()=>executeDevMentorAccountPlan({create:[],update:[],conflicts:[{email:'admin@example.test',reason:'protected'}]},admin,'shared-password-123',false),/conflict/i)
  const result=await executeDevMentorAccountPlan({create:[{row,email:'new@example.test'}],update:[],conflicts:[]},admin,'shared-password-123',true)
  assert.equal(writes,0)
  assert.deepEqual(result,{accountsCreated:0,accountsUpdated:0,profilesCreated:0,profilesUpdated:0})
})
