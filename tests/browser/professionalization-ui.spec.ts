import { expect, test, type Page, type Route } from '@playwright/test'

const categoryId = '86000000-0000-0000-0000-000000000001'
const enrollmentId = '87000000-0000-0000-0000-000000000001'

async function json(route: Route, body: unknown, headers: Record<string, string> = {}) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(body),
  })
}

async function stubNotifications(page: Page) {
  const notifications = [
    {
      id: '88000000-0000-0000-0000-000000000001',
      recipient_user_id: null,
      recipient_role: 'admin',
      type: 'payment_paid',
      title: 'Pembayaran berhasil',
      message: 'Pesanan Strativate sudah terverifikasi lunas.',
      related_entity: 'order',
      related_entity_id: 'order-fixture',
      idempotency_key: 'fixture-paid',
      read_at: null,
      created_at: '2026-09-19T01:00:00.000Z',
    },
    {
      id: '88000000-0000-0000-0000-000000000002',
      recipient_user_id: null,
      recipient_role: 'admin',
      type: 'session_scheduled',
      title: 'Jadwal mentoring diperbarui',
      message: 'Sesi mentoring sudah memiliki jadwal baru.',
      related_entity: 'session',
      related_entity_id: 'session-fixture',
      idempotency_key: 'fixture-schedule',
      read_at: '2026-09-19T01:10:00.000Z',
      created_at: '2026-09-19T00:30:00.000Z',
    },
  ]

  await page.route('**/rest/v1/notifications**', async route => {
    if (route.request().method() === 'HEAD') {
      await route.fulfill({ status: 200, headers: { 'Content-Range': '0-0/1' }, body: '' })
      return
    }
    await json(route, notifications, { 'Content-Range': '0-1/2' })
  })
  await page.route('**/rest/v1/rpc/mark_notification_read', route => json(route, null))
  await page.route('**/rest/v1/rpc/mark_all_notifications_read', route => json(route, null))
}

async function stubUnreadNotifications(page:Page){
  let notifications=Array.from({length:3},(_,index)=>({
    id:'97000000-0000-0000-0000-'+String(index+1).padStart(12,'0'),
    recipient_user_id:null,recipient_role:'mentee',type:'session_scheduled',
    title:index===0?'Jadwal mentoring diperbarui':'Notifikasi '+(index+1),
    message:index===0?'Pesan notifikasi yang sengaja cukup panjang untuk memastikan line-height, wrapping, dan spacing kartu tetap nyaman pada viewport mobile tanpa mendorong layout keluar layar.':'Pembaruan operasional mentoring.',
    related_entity:'session',related_entity_id:'fixture-'+index,idempotency_key:'unread-'+index,read_at:null as string|null,created_at:'2026-09-20T0'+index+':00:00.000Z'
  }))
  await page.route('**/rest/v1/notifications**',async route=>{
    const unread=notifications.filter(item=>!item.read_at)
    const range=unread.length?'0-'+(unread.length-1)+'/'+unread.length:'*/0'
    if(route.request().method()==='HEAD'){await route.fulfill({status:200,headers:{'Content-Range':range},body:''});return}
    await json(route,unread,{'Content-Range':range})
  })
  await page.route('**/rest/v1/rpc/mark_notification_read',async route=>{
    const id=(route.request().postDataJSON() as {p_notification_id?:string}).p_notification_id
    notifications=notifications.map(item=>item.id===id?{...item,read_at:'2026-09-20T05:00:00.000Z'}:item)
    await json(route,null)
  })
  await page.route('**/rest/v1/rpc/mark_all_notifications_read',async route=>{
    notifications=notifications.map(item=>({...item,read_at:'2026-09-20T05:00:00.000Z'}))
    await json(route,null)
  })
}

async function stubAdminCommerce(page: Page) {
  await page.route('**/rest/v1/rpc/list_admin_commerce_orders', route => json(route, []))
  await page.route('**/rest/v1/rpc/get_admin_commerce_report', route => json(route, [{
    total_revenue: 0,
    total_transactions: 0,
    paid_orders: 0,
    pending_orders: 0,
    customer_count: 0,
    average_order_value: 0,
    total_users: 1,
    total_mentors: 1,
    total_sessions: 0,
    sessions_today: 0,
    pending_sessions: 0,
    trend: [],
    product_distribution: [],
    best_sellers: [],
  }]))
}

async function stubMenteeCompetition(page: Page) {
  let competition = {
    enrollment_id: '83000000-0000-0000-0000-000000000001',
    competition_category_id: null as string | null,
    competition_category_name: null as string | null,
    competition_name: null as string | null,
    competition_updated_at: null as string | null,
  }

  await page.route('**/rest/v1/rpc/list_my_private_mentoring_competitions', route => json(route, [competition]))
  await page.route('**/rest/v1/competition_categories**', route => json(route, [
    { id: categoryId, name: 'Business Case' },
  ]))
  await page.route('**/rest/v1/rpc/set_private_mentoring_competition', async route => {
    const payload = route.request().postDataJSON() as {
      p_competition_category_id: string | null
      p_competition_name: string
    }
    competition = {
      ...competition,
      competition_category_id: payload.p_competition_category_id,
      competition_category_name: payload.p_competition_category_id ? 'Business Case' : null,
      competition_name: payload.p_competition_name,
      competition_updated_at: '2026-09-19T02:00:00.000Z',
    }
    await json(route, null)
  })
}

function adminSession(index: number) {
  const n = index + 1
  return {
    session_id: `89000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
    session_number: n,
    status: 'awaiting_scheduling',
    session_focus_id: '81000000-0000-0000-0000-000000000001',
    focus_name: 'Idea & Problem Framing',
    requested_focus_id: '81000000-0000-0000-0000-000000000001',
    requested_focus_name: 'Idea & Problem Framing',
    mentee_topic_request: `Bahas scope sesi ${n} dan prioritas eksekusi.`,
    topic_status: 'confirmed',
    resolved_topic: `Scope final sesi ${n}`,
    mentor_scope_notes: 'Gunakan framework yang ringkas.',
    mentor_id: null,
    mentor_name: null,
    primary_mentor_id: null,
    primary_mentor_name: null,
    scheduled_start_at: null,
    scheduled_end_at: null,
    purchased_sessions: 4,
    google_sync_status: 'pending',
    google_sync_error: null,
  }
}

async function stubAdminMentoring(page: Page) {
  await page.route('**/rest/v1/private_mentoring_packages**', route => json(route, [{
    id: '90000000-0000-0000-0000-000000000001',
    mentor_tier_id: '91000000-0000-0000-0000-000000000001',
    session_count: 4,
    price_amount: 400000,
    reference_price_amount: null,
    duration_minutes: 75,
    max_participants: 1,
    is_active: true,
    sort_order: 10,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  }]))
  await page.route('**/rest/v1/mentor_tiers**', route => json(route, [{
    id: '91000000-0000-0000-0000-000000000001',
    code: 'TOP_STUDENT',
    name: 'Top Student',
    sort_order: 10,
    is_active: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  }]))
  await page.route('**/rest/v1/private_mentoring_session_focuses**', route => json(route, [{
    id: '81000000-0000-0000-0000-000000000001',
    name: 'Idea & Problem Framing',
    is_active: true,
  }]))
  await page.route('**/rest/v1/competition_categories**', route => json(route, [
    { id: categoryId, name: 'Business Case' },
  ]))
  await page.route('**/rest/v1/rpc/list_admin_private_mentoring_enrollments_page', route => json(route, [{
    total_count: 1,
    enrollment_id: enrollmentId,
    mentee_id: '92000000-0000-0000-0000-000000000003',
    mentee_email: 'aqil@fixture.test',
    mentee_username: 'aqil',
    mentee_name: 'Aqil Aja',
    package_id: '90000000-0000-0000-0000-000000000001',
    package_name: 'Private Mentoring - Top Student - 4 Session',
    mentor_tier_id: '91000000-0000-0000-0000-000000000001',
    mentor_tier_name: 'Top Student',
    purchased_sessions: 4,
    awaiting_focus_sessions: 0,
    awaiting_scheduling_sessions: 4,
    scheduled_sessions: 0,
    completed_sessions: 0,
    configured_sessions: 0,
    purchased_at: '2026-09-18T00:00:00.000Z',
  }]))
  await page.route('**/rest/v1/rpc/get_admin_private_mentoring_enrollment_sessions', route => json(route, Array.from({ length: 4 }, (_, index) => adminSession(index))))
  await page.route('**/rest/v1/rpc/get_admin_private_mentoring_competition', route => json(route, [{
    enrollment_id: enrollmentId,
    competition_category_id: null,
    competition_category_name: null,
    competition_name: null,
    competition_updated_at: null,
  }]))
  await page.route('**/api/admin/private-mentoring/sessions/*/meeting', async route => {
    const path = new URL(route.request().url()).pathname
    const sessionId = path.split('/').at(-2) || 'fixture'
    await json(route, {
      sessionId,
      status: 'awaiting_scheduling',
      meetingProvider: null,
      providerMeetingId: null,
      providerMeetingUrl: null,
      manualMeetingUrl: null,
      effectiveMeetingUrl: null,
      providerSyncStatus: 'pending',
      providerSyncError: null,
      calendarSyncStatus: 'pending',
      calendarSyncError: null,
      recordingStatus: 'expected',
      recordingError: null,
    })
  })
}

async function stubAdminIntensive(page:Page){
  const engagementId='95000000-0000-0000-0000-000000000001'
  const mentorId='84000000-0000-0000-0000-000000000001'
  const secondMentorId='84000000-0000-0000-0000-000000000002'
  let engagement={
    engagement_id:engagementId,mentee_id:'92000000-0000-0000-0000-000000000003',mentee_name:'Aqil Aja',mentee_email:'aqil@fixture.test',
    base_entitlement_id:'95000000-0000-0000-0000-000000000002',base_kind:'bundle',program_name:'Bundel Competition Ready',status:'active',baseline_sessions_per_month:8,
    primary_mentor_id:mentorId,primary_mentor_name:'Mentor Fixture',program_stage:'review_refinement',current_activity:'Final pitch deck refinement' as string|null,progress_summary:'Storyline dan Q&A refinement.' as string|null,created_at:'2026-09-01T00:00:00.000Z',
    add_ons:[{entitlementId:null,name:'Laporan Performa Terperinci',code:'DETAILED_PERFORMANCE_REPORT',status:'included',source:'bundle',supportType:'add_on'},{entitlementId:null,name:'Simulasi Penjurian',code:'JUDGING_SIMULATION',status:'included',source:'bundle',supportType:'add_on'}],
    unassigned_add_ons:[],
    sessions:[{sessionId:'96000000-0000-0000-0000-000000000001',sessionNumber:1,durationMinutes:60,status:'scheduled',focusId:'81000000-0000-0000-0000-000000000001',focusName:'Idea & Problem Framing',menteeTopicRequest:'Review final storyline.',topicStatus:'confirmed',resolvedTopic:'Final storyline & Q&A',mentorId,mentorName:'Mentor Fixture',scheduledStartAt:'2026-09-26T02:00:00.000Z',scheduledEndAt:'2026-09-26T03:00:00.000Z',meetingUrl:'https://zoom.us/j/intensive-admin-fixture',providerSyncStatus:'ready',googleSyncStatus:'synced',recordingStatus:'expected',creationSource:'admin_added',creationReason:'Hasil diskusi mentee'}] as Array<Record<string,unknown>>
  }
  await page.route('**/rest/v1/rpc/list_admin_intensive_mentoring_engagements',route=>json(route,[engagement]))
  await page.route('**/rest/v1/rpc/admin_set_intensive_program_stage',async route=>{
    const payload=route.request().postDataJSON() as {p_stage:string;p_progress_summary:string|null;p_current_activity?:string|null}
    engagement={...engagement,program_stage:payload.p_stage,current_activity:payload.p_current_activity??null,progress_summary:payload.p_progress_summary}
    await json(route,null)
  })
  await page.route('**/rest/v1/rpc/admin_set_intensive_primary_mentor',route=>json(route,null))
  await page.route('**/rest/v1/rpc/admin_resolve_intensive_mentoring_topic',async route=>{
    const payload=route.request().postDataJSON() as {p_focus_id:string;p_resolved_topic:string}
    engagement={...engagement,sessions:engagement.sessions.map(item=>item.sessionId==='96000000-0000-0000-0000-000000000001'?{...item,focusId:payload.p_focus_id,focusName:'Idea & Problem Framing',resolvedTopic:payload.p_resolved_topic,topicStatus:'confirmed'}:item)}
    await json(route,null)
  })
  await page.route('**/rest/v1/rpc/admin_assign_intensive_session_mentor',async route=>{
    const payload=route.request().postDataJSON() as {p_mentor_id:string}
    engagement={...engagement,sessions:engagement.sessions.map(item=>item.sessionId==='96000000-0000-0000-0000-000000000001'?{...item,mentorId:payload.p_mentor_id,mentorName:payload.p_mentor_id===secondMentorId?'Mentor Cadangan':'Mentor Fixture'}:item)}
    await json(route,null)
  })
  await page.route('**/rest/v1/rpc/admin_add_intensive_mentoring_session',async route=>{
    const payload=route.request().postDataJSON() as {p_duration_minutes:number}
    engagement={...engagement,sessions:[...engagement.sessions,{sessionId:'96000000-0000-0000-0000-000000000002',sessionNumber:2,durationMinutes:payload.p_duration_minutes,status:'awaiting_focus',focusId:null,focusName:null,menteeTopicRequest:null,topicStatus:'needs_input',resolvedTopic:null,mentorId,mentorName:'Mentor Fixture',scheduledStartAt:null,scheduledEndAt:null,meetingUrl:null,providerSyncStatus:'pending',googleSyncStatus:'pending',recordingStatus:'expected',creationSource:'admin_added',creationReason:null}]}
    await json(route,null)
  })
  await page.route('**/rest/v1/mentor_profiles**',route=>json(route,[{user_id:mentorId,is_active:true},{user_id:secondMentorId,is_active:true}]))
  await page.route('**/rest/v1/profiles**',route=>json(route,[{id:mentorId,first_name:'Mentor',last_name:'Fixture',username:'mentor-fixture'},{id:secondMentorId,first_name:'Mentor',last_name:'Cadangan',username:'mentor-cadangan'}]))
  await page.route('**/api/admin/intensive-mentoring/sessions/*/meeting',route=>json(route,{sessionId:'96000000-0000-0000-0000-000000000001',status:'scheduled',meetingProvider:'zoom',providerMeetingId:'123456789',providerMeetingUrl:'https://zoom.us/j/intensive-admin-fixture',manualMeetingUrl:null,effectiveMeetingUrl:'https://zoom.us/j/intensive-admin-fixture',providerSyncStatus:'ready',providerSyncError:null,calendarSyncStatus:'synced',calendarSyncError:null,recordingStatus:'expected',recordingError:null}))
}

async function waitForBrandIntro(page: Page) {
  const intro = page.getByTestId('initial-brand-intro')
  if (await intro.count()) await expect(intro).toBeHidden({ timeout: 6000 })
}

async function expectNoDocumentOverflow(page: Page) {
  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width)
}

test('mentee competition renders empty form, persists to read-only, and supports edit/cancel', async ({ page }) => {
  await stubMenteeCompetition(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://localhost:3001/mentoring-professionalization')

  await expect(page.getByText('Wajib dilengkapi sebelum scheduling')).toBeVisible()
  const name = page.getByPlaceholder('Contoh: Business Case Competition')
  await expect(name).toBeVisible()
  await page.getByLabel('Kategori (opsional)').selectOption(categoryId)
  await name.fill('National Business Case Competition')

  const save = page.getByRole('button', { name: 'Simpan lomba' })
  await expect(save.locator('svg')).toBeVisible()
  const background = await save.evaluate(element => getComputedStyle(element).backgroundColor)
  expect(background).not.toBe('rgba(0, 0, 0, 0)')
  await save.click()

  const readonly = page.locator('.competition-readonly')
  await expect(readonly).toContainText('Business Case')
  await expect(readonly).toContainText('National Business Case Competition')
  await expect(name).toHaveCount(0)

  await readonly.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByPlaceholder('Contoh: Business Case Competition')).toHaveValue('National Business Case Competition')
  await page.getByRole('button', { name: 'Batal' }).click()
  await expect(readonly).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoDocumentOverflow(page)
  await expect(page.locator('[data-testid="mentee-mentoring-session-table"]')).toHaveCount(1)
})

test('admin Kelola Sesi uses one primary dialog scroll region with a long session document', async ({ page }) => {
  await stubNotifications(page)
  await stubAdminCommerce(page)
  await stubAdminMentoring(page)
  await page.setViewportSize({ width: 1280, height: 820 })
  await page.goto('http://localhost:3001/admin')

  await page.getByRole('button', { name: 'Mentoring Sessions', exact: true }).click()
  await expect(page.getByText('Private Mentoring - Top Student - 4 Session')).toBeVisible()
  await page.getByRole('button', { name: 'Lihat detail Aqil Aja' }).click()

  const dialog = page.locator('dialog.mentoring-session-dialog-flow')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Mentor per sesi')
  await expect(dialog.getByRole('button', { name: 'Simpan lomba' })).toBeVisible()
  await expect(dialog.getByText('Sesi 4/4', { exact: false })).toBeVisible()

  const scroll = await dialog.evaluate(element => {
    const list = element.querySelector<HTMLElement>('.schedule-slot-list')!
    const dialogStyle = getComputedStyle(element)
    const listStyle = getComputedStyle(list)
    return {
      dialogOverflowY: dialogStyle.overflowY,
      dialogScrollable: element.scrollHeight > element.clientHeight,
      listOverflowY: listStyle.overflowY,
      listMaxHeight: listStyle.maxHeight,
      listScrollable: list.scrollHeight > list.clientHeight,
    }
  })
  expect(['auto', 'scroll']).toContain(scroll.dialogOverflowY)
  expect(scroll.dialogScrollable).toBe(true)
  expect(scroll.listOverflowY).toBe('visible')
  expect(scroll.listMaxHeight === 'none' || scroll.listMaxHeight === 'max-content').toBe(true)
  expect(scroll.listScrollable).toBe(false)

  await page.setViewportSize({ width: 768, height: 820 })
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeLessThanOrEqual(768)
  await expectNoDocumentOverflow(page)
})

const roleHistory = [
  { url: 'http://localhost:3001/admin', button: 'Notifikasi', heading: 'Riwayat notifikasi', admin: true },
  { url: 'http://localhost:3001/dashboard', button: 'Notifikasi', heading: 'Pembaruan untuk akunmu.', admin: false },
  { url: 'http://localhost:3001/mentor', button: 'Notifikasi', heading: 'Pembaruan operasional mentor.', admin: false },
] as const

for (const role of roleHistory) {
  test(`${role.url.split('/').at(-1)} notification history renders paginated shared UI and read state`, async ({ page }) => {
    await stubNotifications(page)
    if (role.admin) await stubAdminCommerce(page)
    await page.setViewportSize({ width: 1280, height: 850 })
    await page.goto(role.url)

    await page.getByRole('button', { name: role.button, exact: true }).click()
    await expect(page.getByRole('heading', { name: role.heading })).toBeVisible()
    await expect(page.locator('.notification-item')).toHaveCount(2)
    await expect(page.getByText('Pembayaran berhasil', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Tandai dibaca' }).click()
    await expect(page.locator('.notification-history__actions > span', { hasText: 'Sudah dibaca' }).first()).toBeVisible()
    await expectNoDocumentOverflow(page)
  })
}


test('topbar notification bell shows unread only while history keeps read records', async ({ page }) => {
  await stubNotifications(page)
  await stubAdminCommerce(page)
  await page.setViewportSize({ width: 1280, height: 850 })
  await page.goto('http://localhost:3001/admin')

  await page.getByRole('button', { name: 'Buka notifikasi' }).click()
  const popover = page.getByRole('dialog', { name: 'Notifikasi' })
  await expect(popover.getByText('Pembayaran berhasil', { exact: true })).toBeVisible()
  await expect(popover.getByText('Jadwal mentoring diperbarui', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Notifikasi', exact: true }).click()
  await expect(page.getByText('Pembayaran berhasil', { exact: true })).toBeVisible()
  await expect(page.getByText('Jadwal mentoring diperbarui', { exact: true })).toBeVisible()
})


test('Mentoring Saya mode switcher stays usable without horizontal document overflow across representative widths', async ({ page }) => {
  await stubMenteeCompetition(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://localhost:3001/mentoring-professionalization')

  const privateTab=page.getByRole('tab',{name:/Private Mentoring/})
  const intensiveTab=page.getByRole('tab',{name:/Intensive Mentoring/})
  await expect(privateTab).toHaveAttribute('aria-selected','true')
  await expect(page.locator('.mentoring-enrollment-summary')).toHaveCount(2)
  await expect(page.getByRole('button',{name:/Detail/}).first()).toBeVisible()

  for(const width of [360,390,768,1024,1280,1440,1920]){
    await page.setViewportSize({width,height:900})
    await expectNoDocumentOverflow(page)
    await expect(page.getByRole('button',{name:/Detail/}).first()).toBeVisible()
  }

  await intensiveTab.click()
  await expect(intensiveTab).toHaveAttribute('aria-selected','true')
  await expect(page.getByRole('heading',{name:'Bundel Competition Ready',exact:true})).toBeVisible()
  await expect(page.getByText('Laporan Performa Terperinci',{exact:true})).toBeVisible()
  await expect(page.getByText('Simulasi Penjurian',{exact:true})).toBeVisible()
  await expect(page.locator('[data-testid="intensive-session-table"]')).toHaveCount(1)

  for(const width of [360,390,768,1024,1280,1440,1920]){
    await page.setViewportSize({width,height:900})
    await expectNoDocumentOverflow(page)
    await expect(page.getByRole('button',{name:'Detail',exact:true}).first()).toBeVisible()
  }
})


test('admin Intensive engagement table, Program Configuration states, and completion flow remain responsive',async({page})=>{
  await stubNotifications(page)
  await stubAdminCommerce(page)
  await stubAdminMentoring(page)
  await stubAdminIntensive(page)
  await page.setViewportSize({width:1280,height:900})
  await page.goto('http://localhost:3001/admin')
  await page.getByRole('button',{name:'Mentoring Sessions',exact:true}).click()
  await page.getByRole('tab',{name:'Intensive Mentoring',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Engagement & session operations'})).toBeVisible()
  await expect(page.locator('.intensive-engagement-table')).toBeVisible()
  await expect(page.getByText('Dedicated Mentor',{exact:true}).first()).toBeVisible()
  const reload=page.getByRole('button',{name:'Muat ulang',exact:true})
  await expect(reload).toBeVisible()
  const whiteSpace=await reload.evaluate(element=>getComputedStyle(element).whiteSpace)
  expect(whiteSpace).toBe('nowrap')

  await page.getByRole('button',{name:'Kelola program',exact:true}).click()
  const config=page.locator('dialog.intensive-config-dialog')
  await expect(config).toBeVisible()
  await expect(config.getByText('Mentor Fixture',{exact:true})).toBeVisible()
  await expect(config.getByText('Final pitch deck refinement',{exact:true})).toBeVisible()
  await expect(config.getByLabel('Durasi sesi baru (menit)')).toHaveCount(0)

  const geometry=await config.evaluate(element=>{const r=element.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,cx:r.left+r.width/2,cy:r.top+r.height/2,w:innerWidth,h:innerHeight}})
  expect(Math.abs(geometry.cx-geometry.w/2)).toBeLessThanOrEqual(3)
  expect(Math.abs(geometry.cy-geometry.h/2)).toBeLessThanOrEqual(3)
  expect(geometry.left).toBeGreaterThan(0);expect(geometry.top).toBeGreaterThan(0)
  expect(geometry.right).toBeLessThanOrEqual(geometry.w);expect(geometry.bottom).toBeLessThanOrEqual(geometry.h)

  await config.getByRole('button',{name:'Edit mentor',exact:true}).click()
  const dedicatedReason=config.getByLabel(/Alasan perubahan/)
  const dedicatedActions=config.locator('.intensive-config-actions').first()
  const dedicatedSpacing=await Promise.all([dedicatedReason.boundingBox(),dedicatedActions.boundingBox()])
  expect(dedicatedSpacing[0]).not.toBeNull();expect(dedicatedSpacing[1]).not.toBeNull()
  expect(dedicatedSpacing[1]!.y-(dedicatedSpacing[0]!.y+dedicatedSpacing[0]!.height)).toBeGreaterThanOrEqual(17)
  for(const button of await dedicatedActions.getByRole('button').all())expect(await button.evaluate(element=>getComputedStyle(element).whiteSpace)).toBe('nowrap')
  await dedicatedActions.getByRole('button',{name:'Batal',exact:true}).click()

  await config.getByRole('button',{name:'Edit progres'}).click()
  const activity=config.getByLabel(/Aktivitas saat ini/)
  await expect(activity).toHaveValue('Final pitch deck refinement')
  await activity.fill('Final deck + mock Q&A')
  await config.getByRole('button',{name:'Batal',exact:true}).click()
  await expect(activity).toHaveCount(0)
  await expect(config.getByText('Final pitch deck refinement',{exact:true})).toBeVisible()

  await config.getByRole('button',{name:'Edit progres'}).click()
  await config.getByLabel(/Aktivitas saat ini/).fill('Final deck + mock Q&A')
  await config.getByRole('button',{name:'Simpan progres'}).click()
  await expect(config.getByLabel(/Aktivitas saat ini/)).toHaveCount(0)
  await expect(config.getByText('Final deck + mock Q&A',{exact:true})).toBeVisible()

  await config.getByRole('button',{name:'Tambah sesi',exact:true}).click()
  const duration=config.getByLabel('Durasi sesi baru (menit)')
  await expect(duration).toHaveValue('')
  const sessionActions=config.locator('.intensive-config-actions').last()
  for(const button of await sessionActions.getByRole('button').all())expect(await button.evaluate(element=>getComputedStyle(element).whiteSpace)).toBe('nowrap')
  await duration.fill('90')
  await config.getByRole('button',{name:'Tambah sesi',exact:true}).click()
  await expect(config.getByLabel('Durasi sesi baru (menit)')).toHaveCount(0)
  for(const width of [375,390,768,820,1280,1440]){
    await page.setViewportSize({width,height:900})
    await expectNoDocumentOverflow(page)
    const responsiveBox=await config.boundingBox()
    expect(responsiveBox).not.toBeNull()
    expect(responsiveBox!.width).toBeLessThanOrEqual(width)
  }
  await config.getByRole('button',{name:'Tutup Program Configuration'}).click()
  await expect(page.getByText('2 sesi operasional',{exact:true})).toBeVisible()

  await page.setViewportSize({width:1024,height:900})
  const firstSessionRow=page.locator('.mentee-session-table tbody tr').filter({has:page.getByText('Sesi 1',{exact:true})})
  await firstSessionRow.getByRole('button',{name:'Kelola',exact:true}).click()
  const detail=page.locator('dialog[aria-labelledby="intensive-admin-session-title"]')
  await expect(detail).toBeVisible()
  await expect(detail).toHaveClass(/intensive-session-detail-dialog/)
  await expect(detail.getByText('Final storyline & Q&A',{exact:true})).toBeVisible()
  await expect(detail.getByText('Idea & Problem Framing',{exact:true})).toBeVisible()
  await expect(detail.getByText('Confirmed',{exact:true})).toBeVisible()
  await expect(detail.getByLabel('Topik final')).toHaveCount(0)
  await expect(detail.getByLabel('Fokus')).toHaveCount(0)
  await expect(detail.getByRole('button',{name:'Ubah jadwal',exact:true})).toBeVisible()

  await detail.getByRole('button',{name:'Edit topik',exact:true}).click()
  await expect(detail.getByLabel('Topik final')).toHaveValue('Final storyline & Q&A')
  await detail.getByLabel('Topik final').fill('Draft change to cancel')
  await detail.getByRole('button',{name:'Batal',exact:true}).click()
  await expect(detail.getByLabel('Topik final')).toHaveCount(0)
  await expect(detail.getByText('Final storyline & Q&A',{exact:true})).toBeVisible()

  await detail.getByRole('button',{name:'Edit topik',exact:true}).click()
  await detail.getByLabel('Topik final').fill('Updated final storyline')
  await detail.getByRole('button',{name:'Simpan topik',exact:true}).click()
  await expect(detail.getByLabel('Topik final')).toHaveCount(0)
  await expect(detail.getByText('Updated final storyline',{exact:true})).toBeVisible()

  await expect(detail.getByText('Mentor Fixture',{exact:true})).toBeVisible()
  await expect(detail.getByLabel('Mentor sesi')).toHaveCount(0)
  await detail.getByRole('button',{name:'Edit mentor',exact:true}).click()
  await detail.getByLabel('Mentor sesi').selectOption('84000000-0000-0000-0000-000000000002')
  await detail.getByLabel(/Alasan override/).fill('Temporary draft')
  await detail.getByRole('button',{name:'Batal',exact:true}).click()
  await expect(detail.getByLabel('Mentor sesi')).toHaveCount(0)
  await expect(detail.getByText('Mentor Fixture',{exact:true})).toBeVisible()

  await detail.getByRole('button',{name:'Edit mentor',exact:true}).click()
  await detail.getByLabel('Mentor sesi').selectOption('84000000-0000-0000-0000-000000000002')
  await detail.getByLabel(/Alasan override/).fill('Approved override')
  await detail.getByRole('button',{name:'Simpan mentor sesi',exact:true}).click()
  await expect(detail.getByLabel('Mentor sesi')).toHaveCount(0)
  await expect(detail.getByText('Mentor Cadangan',{exact:true})).toBeVisible()

  for(const width of [375,390,768,820,1280,1440]){
    await page.setViewportSize({width,height:900})
    await expectNoDocumentOverflow(page)
    for(const button of await detail.locator('.intensive-session-action-row .button').all())expect(await button.evaluate(element=>getComputedStyle(element).whiteSpace)).toBe('nowrap')
  }
  await detail.getByRole('button',{name:/Tandai selesai/i}).click()
  const confirm=page.locator('dialog.compact-confirm-dialog')
  await expect(confirm).toBeVisible()
  await expect(confirm.getByRole('button',{name:'Batal',exact:true})).toBeVisible()
  await expect(confirm.getByRole('button',{name:'Ya, tandai selesai',exact:true})).toBeVisible()
  await expectNoDocumentOverflow(page)
})



test('International custom offer supports create view edit cancel and Cart Link reuse',async({page})=>{
  await stubNotifications(page)
  await stubAdminCommerce(page)
  const menteeId='92000000-0000-0000-0000-000000000003'
  const offerId='97500000-0000-0000-0000-000000000001'
  const winId='97510000-0000-0000-0000-000000000001'
  let offer:Record<string,unknown>|null=null

  await page.route('**/rest/v1/rpc/list_admin_cart_links_page',route=>json(route,[]))
  await page.route('**/rest/v1/rpc/list_cart_link_mentees',route=>json(route,[{user_id:menteeId,email:'aqil@fixture.test',display_name:'Aqil Aja'}]))
  await page.route('**/rest/v1/rpc/list_admin_intensive_custom_offers',route=>json(route,offer?[offer]:[]))
  await page.route('**/rest/v1/rpc/admin_save_intensive_custom_offer',async route=>{
    const p=route.request().postDataJSON() as Record<string,unknown>
    offer={
      offer_id:offerId,intended_mentee_id:menteeId,mentee_name:'Aqil Aja',mentee_email:'aqil@fixture.test',
      title:'International Competition · Harvard Global Case Competition',competition_category_id:null,competition_category_name:null,
      competition_name:String(p.p_competition_name),baseline_sessions_per_month:Number(p.p_baseline_sessions_per_month),
      final_price_amount:Number(p.p_final_price_amount),status:'active',expires_at:null,
      created_at:'2026-09-21T00:00:00.000Z',updated_at:'2026-09-21T00:00:00.000Z',
      included_add_ons:[{id:winId,name:'Win Guarantee Protection',code:'WIN_GUARANTEE_PROTECTION'}],
      benefits:['International pitch deck review'],
    }
    await json(route,offerId)
  })
  await page.route('**/rest/v1/intensive_mentoring_add_ons**',route=>json(route,[
    {id:winId,name:'Win Guarantee Protection',code:'WIN_GUARANTEE_PROTECTION'},
    {id:'97510000-0000-0000-0000-000000000002',name:'Simulasi Penjurian',code:'JUDGING_SIMULATION'},
  ]))
  await page.route('**/rest/v1/competition_categories**',route=>json(route,[{id:categoryId,name:'Business Case'}]))
  await page.route('**/api/admin/cart-links',route=>json(route,{url:'http://localhost:3001/cart-link/custom-offer-fixture'}))

  await page.setViewportSize({width:1280,height:900})
  await page.goto('http://localhost:3001/admin')
  await page.getByRole('button',{name:'Cart Links',exact:true}).click()
  await page.getByRole('button',{name:/Penawaran Internasional/,exact:true}).click()

  const dialog=page.locator('dialog.intensive-custom-offer-dialog')
  await expect(dialog).toBeVisible()
  const geometry=await dialog.evaluate(element=>{const r=element.getBoundingClientRect();return{cx:r.left+r.width/2,cy:r.top+r.height/2,w:innerWidth,h:innerHeight,left:r.left,top:r.top}})
  expect(Math.abs(geometry.cx-geometry.w/2)).toBeLessThanOrEqual(3)
  expect(Math.abs(geometry.cy-geometry.h/2)).toBeLessThanOrEqual(3)
  expect(geometry.left).toBeGreaterThan(0);expect(geometry.top).toBeGreaterThan(0)

  const menteeSearch=dialog.getByPlaceholder('Cari nama atau email')
  await menteeSearch.fill('Aqil')
  await dialog.getByRole('option',{name:/Aqil Aja/}).click()
  await dialog.getByPlaceholder('Harvard Global Case Competition').fill('Harvard Global Case Competition')
  await dialog.getByLabel(/Baseline \/ intensitas/).fill('6')
  await dialog.getByLabel('Harga kesepakatan').fill('4750000')
  await dialog.getByText('Win Guarantee Protection',{exact:true}).click()
  await dialog.getByPlaceholder('International pitch deck review').fill('International pitch deck review')
  await dialog.getByRole('button',{name:'Simpan penawaran'}).click()

  await expect(dialog.getByText('Rp4.750.000',{exact:true})).toBeVisible()
  await expect(dialog.getByText('Win Guarantee Protection',{exact:true})).toBeVisible()
  await expect(dialog.getByText('International pitch deck review',{exact:true})).toBeVisible()
  await expect(dialog.getByPlaceholder('Harvard Global Case Competition')).toHaveCount(0)

  await dialog.getByRole('button',{name:'Edit',exact:true}).click()
  await expect(dialog.getByLabel(/Baseline \/ intensitas/)).toHaveValue('6')
  await dialog.getByLabel(/Baseline \/ intensitas/).fill('7')
  await dialog.getByRole('button',{name:'Batal',exact:true}).click()
  await expect(dialog.getByLabel(/Baseline \/ intensitas/)).toHaveCount(0)
  await expect(dialog.getByText('6 sesi/bulan',{exact:true})).toBeVisible()

  await dialog.getByRole('button',{name:'Buat Cart Link',exact:true}).click()
  await expect(dialog.getByText('http://localhost:3001/cart-link/custom-offer-fixture',{exact:true})).toBeVisible()

  for(const width of [375,390,768,820,1280,1440]){
    await page.setViewportSize({width,height:900})
    await expectNoDocumentOverflow(page)
  }
})

test('role profile avatar dialog supports drag drop crop save and responsive widths',async({page})=>{
  await stubNotifications(page)
  await page.route('**/api/profile/avatar**',async route=>{
    if(route.request().method()==='POST'){await json(route,{avatarUrl:'/api/profile/avatar?rev=fixture',path:'92000000-0000-0000-0000-000000000003/avatar.webp'});return}
    await route.fulfill({status:200,contentType:'image/webp',body:Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/v89WAAAAA==','base64')})
  })
  await page.setViewportSize({width:1280,height:900})
  await page.goto('http://localhost:3001/dashboard')
  await page.getByRole('button',{name:'Profil',exact:true}).click()
  const trigger=page.getByRole('button',{name:'Ubah foto profil'})
  await expect(trigger).toBeVisible()
  await trigger.focus()
  await trigger.click()
  const dialog=page.locator('dialog.avatar-editor-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Klik atau tarik foto ke sini')).toBeVisible()
  const expectAvatarDialogCentered=async(width:number,height:number)=>{
    await page.setViewportSize({width,height})
    const geometry=await dialog.evaluate(element=>{
      const rect=element.getBoundingClientRect()
      return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,centerX:rect.left+rect.width/2,centerY:rect.top+rect.height/2,viewportWidth:window.innerWidth,viewportHeight:window.innerHeight}
    })
    expect(Math.abs(geometry.centerX-geometry.viewportWidth/2), `avatar dialog horizontal center at ${width}x${height}`).toBeLessThanOrEqual(2)
    expect(Math.abs(geometry.centerY-geometry.viewportHeight/2), `avatar dialog vertical center at ${width}x${height}`).toBeLessThanOrEqual(2)
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.top).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth)
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight)
  }
  await expectAvatarDialogCentered(1280,900)

  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256
    const context=canvas.getContext('2d')!;context.fillStyle='#ff7a00';context.fillRect(0,0,256,256);context.fillStyle='#111827';context.fillRect(64,64,128,128)
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('png failed')),'image/png'))
    const file=new File([blob],'avatar.png',{type:'image/png'})
    const transfer=new DataTransfer();transfer.items.add(file)
    const target=document.querySelector('.avatar-dropzone')!
    target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}))
    target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}))
  })
  await expect(dialog.getByAltText('Pratinjau foto yang akan dipotong')).toBeVisible()
  await expect(dialog.getByText('Zoom',{exact:true})).toBeVisible()
  await expect(dialog.locator('input[type="range"]')).toHaveCount(3)

  for(const width of [375,390,430,768,820,1024,1280,1440,1920]){
    await expectAvatarDialogCentered(width,900)
    await expectNoDocumentOverflow(page)
    await expect(dialog.getByRole('button',{name:'Simpan foto'})).toBeVisible()
  }

  await dialog.getByRole('button',{name:'Simpan foto'}).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('.profile-avatar-edit-trigger img.profile-avatar-image')).toBeVisible()
})


test('Cart Link failure states are centered, responsive, and authorization-safe',async({page})=>{
  for(const fixture of [
    {reason:'not-authorized',copy:'Cart Link ini hanya dapat digunakan oleh akun mentee yang dituju.'},
    {reason:'invalid',copy:'Tautan ini sudah tidak aktif, kedaluwarsa, atau tidak lagi tersedia.'},
  ]){
    for(const size of [{width:1440,height:900},{width:390,height:844}]){
      await page.setViewportSize(size)
      await page.goto(`http://localhost:3000/cart-link/error?reason=${fixture.reason}`)
      await waitForBrandIntro(page)
      const card=page.locator('.cart-link-error-card')
      await expect(page.getByRole('heading',{name:'Cart Link tidak dapat digunakan.'})).toBeVisible()
      await expect(card).toContainText(fixture.copy)
      await expect(page.getByRole('link',{name:'Kembali ke Beranda'})).toHaveAttribute('href','/')
      await expect(page.getByText('Cart Link ini dibuat untuk akun mentee yang berbeda.')).toHaveCount(0)
      const geometry=await card.evaluate(element=>{
        const rect=element.getBoundingClientRect()
        return {left:rect.left,right:rect.right,centerX:rect.left+rect.width/2,viewportWidth:window.innerWidth}
      })
      expect(Math.abs(geometry.centerX-geometry.viewportWidth/2)).toBeLessThanOrEqual(2)
      expect(geometry.left).toBeGreaterThanOrEqual(0)
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth)
      await expectNoDocumentOverflow(page)
    }
  }
})


test('notification popover keeps three unread items centered and mobile safe',async({page})=>{
  await stubUnreadNotifications(page)
  await page.setViewportSize({width:390,height:844})
  await page.goto('http://localhost:3001/dashboard')
  await page.getByRole('button',{name:'Buka notifikasi'}).click()
  const popover=page.getByRole('dialog',{name:'Notifikasi'})
  const unread=popover.getByRole('button',{name:/belum dibaca/})
  await expect(unread).toHaveCount(3)
  await expect(popover.getByText(/Pesan notifikasi yang sengaja cukup panjang/)).toBeVisible()
  await expectNoDocumentOverflow(page)
  const centered=await unread.first().evaluate(button=>{
    const box=button.querySelector('span')?.getBoundingClientRect()
    const icon=button.querySelector('span svg')?.getBoundingClientRect()
    if(!box||!icon)return false
    const dx=Math.abs((box.left+box.width/2)-(icon.left+icon.width/2))
    const dy=Math.abs((box.top+box.height/2)-(icon.top+icon.height/2))
    return box.width>=40&&box.height>=40&&dx<1.5&&dy<1.5
  })
  expect(centered).toBe(true)
  await unread.first().click()
  await page.getByRole('button',{name:'Buka notifikasi'}).click()
  await expect(popover.getByRole('button',{name:/belum dibaca/})).toHaveCount(2)
  await popover.getByRole('button',{name:/Tandai semua dibaca/}).click()
  await expect(popover.getByText('Tidak ada notifikasi baru.')).toBeVisible()
})
