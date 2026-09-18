import http from 'node:http'

const port = Number(process.env.COMMERCE_FIXTURE_PORT || 54321)
const now = '2026-09-14T00:00:00.000Z'

const ids = {
  mentee: '95000000-0000-0000-0000-000000000001', mentor: '95000000-0000-0000-0000-000000000002', admin: '95000000-0000-0000-0000-000000000003',
  onboardingMentee: '95000000-0000-0000-0000-000000000004',
  product: '95100000-0000-0000-0000-000000000001', cart: '95200000-0000-0000-0000-000000000001', cartItem: '95300000-0000-0000-0000-000000000001', order: '95400000-0000-0000-0000-000000000001', orderItem: '95500000-0000-0000-0000-000000000001',
}

const productSeed = { id: ids.product, name: 'Business Case Competition Ultimate Preparation Handbook', slug: 'business-case-handbook', description: 'Panduan fixture untuk persiapan business case competition.', image_path: 'products/business-case-handbook.webp', price_amount: 75000, created_at: now, updated_at: now }
const mentorTiers = [
  { id: '81000000-0000-0000-0000-000000000001', code: 'TOP_STUDENT', name: 'Top Student', description: 'Top Student', sort_order: 1, is_active: true, created_at: now, updated_at: now },
  { id: '81000000-0000-0000-0000-000000000002', code: 'YOUNG_PROFESSIONAL', name: 'Young Professional', description: 'Young Professional', sort_order: 2, is_active: true, created_at: now, updated_at: now },
]
const pmPaths = [
  { id: '97100000-0000-0000-0000-000000000001', code: 'END_TO_END', slug: 'end-to-end-learning', name: 'End-to-End Learning', description: 'Best for students who want to learn from the ground up.', sort_order: 1 },
  { id: '97100000-0000-0000-0000-000000000002', code: 'COMPETITION_FOCUSED', slug: 'competition-focused-mentoring', name: 'Competition-Focused Mentoring', description: 'Best for students who already have a competition target.', sort_order: 2 },
].map(row => ({ ...row, is_active: true, created_at: now, updated_at: now }))
const focusNames = ['Idea & Problem Framing', 'Business Analysis & Case Structuring', 'Proposal Writing & Storyline', 'Financial Analysis & Valuation', 'Slide Deck & Visual Design', 'Pitching & Presentation Skills']
const pmFocuses = focusNames.map((name, index) => ({ id: `97200000-0000-0000-0000-00000000000${index + 1}`, code: name.toUpperCase().replaceAll(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''), slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name, description: `${name} focused mentoring.`, sort_order: index + 1, is_active: true, created_at: now, updated_at: now }))
const categoryNames = ['Business Plan Competition', 'Business Case Competition', 'Scientific Paper Competition', 'Marketing Competition', 'Accounting and Finance Competition', 'Pitching Competition', 'Business Essay Competition', 'Equity Research Competition', 'Economic & Policy Case Competition']
const categories = categoryNames.map((name, index) => ({ id: `97400000-0000-0000-0000-00000000000${index + 1}`, code: `CATEGORY_${index + 1}`, slug: `category-${index + 1}`, name, sort_order: index + 1, is_active: true, created_at: now, updated_at: now }))
const packagePrices = [
  ['81000000-0000-0000-0000-000000000001', 1, 300000, null], ['81000000-0000-0000-0000-000000000001', 3, 885000, 950000], ['81000000-0000-0000-0000-000000000001', 5, 1395000, 1500000], ['81000000-0000-0000-0000-000000000001', 7, 1890000, 2100000], ['81000000-0000-0000-0000-000000000001', 10, 2500000, 3000000],
  ['81000000-0000-0000-0000-000000000002', 1, 350000, null], ['81000000-0000-0000-0000-000000000002', 3, 1005000, 1050000], ['81000000-0000-0000-0000-000000000002', 5, 1645000, 1750000], ['81000000-0000-0000-0000-000000000002', 7, 2240000, 2450000], ['81000000-0000-0000-0000-000000000002', 10, 3000000, 3500000],
]
const pmPackages = packagePrices.map(([mentor_tier_id, session_count, price_amount, reference_price_amount], index) => ({ id: `97300000-0000-0000-0000-0000000000${String(index + 1).padStart(2, '0')}`, mentor_tier_id, session_count, price_amount, reference_price_amount, duration_minutes: 75, max_participants: 4, is_active: true, sort_order: index + 1, created_at: now, updated_at: now }))

const onboardingInstitution = { id: '96000000-0000-0000-0000-000000000001', name: 'Institut Teknologi Sepuluh Nopember', normalized_name: 'institut teknologi sepuluh nopember', type: 'university', province: 'Jawa Timur', city: 'Surabaya', external_id: null, source: 'fixture', source_url: null, approval_status: 'approved', institution_status: 'active', submitted_by: null, created_at: now, updated_at: now }
const referralSources = [
  { id: '96100000-0000-0000-0000-000000000001', name: 'Instagram', sort_order: 1, is_active: true, created_at: now, updated_at: now },
  { id: '96100000-0000-0000-0000-000000000002', name: 'Teman atau komunitas', sort_order: 2, is_active: true, created_at: now, updated_at: now },
]
const onboardingInterests = [
  { id: '96200000-0000-0000-0000-000000000001', name: 'Business Case', sort_order: 1, is_active: true, created_at: now, updated_at: now },
  { id: '96200000-0000-0000-0000-000000000002', name: 'UI/UX', sort_order: 2, is_active: true, created_at: now, updated_at: now },
  { id: '96200000-0000-0000-0000-000000000003', name: 'Scientific Paper', sort_order: 3, is_active: true, created_at: now, updated_at: now },
]
function initialOnboardingState() {
  return {
    profile: { id: ids.onboardingMentee, role: 'mentee', first_name: 'Yuta', last_name: 'Fixture', username: null, avatar_url: null, registration_method: 'email', mentor_setup_completed_at: null, password_set_at: now, created_at: now, updated_at: now },
    mentee: { user_id: ids.onboardingMentee, institution_id: null, major_or_faculty: null, cohort_year: null, referral_source_id: null, referral_other_text: null, other_interest_text: null, onboarding_step: 1, onboarding_completed_at: null, created_at: now, updated_at: now },
    interestIds: [],
    saveCalls: 0,
    failNextSave: false,
  }
}
let onboardingState = initialOnboardingState()
const profileFor = id => id === ids.onboardingMentee
  ? onboardingState.profile
  : ({ id, role: id === ids.admin ? 'admin' : id === ids.mentor ? 'mentor' : 'mentee', first_name: id === ids.mentor ? 'Mentor' : id === ids.admin ? 'Admin' : 'Mentee', last_name: 'Fixture', username: null, avatar_url: null, registration_method: 'email', mentor_setup_completed_at: id === ids.mentor ? now : null, password_set_at: now, created_at: now, updated_at: now })
const menteeProfile = { user_id: ids.mentee, institution_id: null, major_or_faculty: null, cohort_year: null, referral_source_id: null, referral_other_text: null, other_interest_text: null, onboarding_step: 4, onboarding_completed_at: now, created_at: now, updated_at: now }
const mentorProfile = { user_id: ids.mentor, tier_id: mentorTiers[0].id, timezone: 'Asia/Jakarta', is_active: true, created_at: now, updated_at: now }

function initialState() { return { product: { ...productSeed }, productDeleted: false, productAvailable: true, cartItems: [], order: null, orderItems: [], createOrderCalls: 0 } }
let state = initialState()
function cors(req) { return { 'access-control-allow-origin': req.headers.origin || '*', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, prefer, range, accept-profile, content-profile', 'access-control-allow-methods': 'GET, POST, DELETE, PATCH, OPTIONS', 'access-control-expose-headers': 'content-range, content-location', vary: 'Origin' } }
function json(req, res, status, body, extra = {}) { res.writeHead(status, { 'content-type': 'application/json', ...cors(req), ...extra }); res.end(JSON.stringify(body)) }
function noContent(req, res, status = 204) { res.writeHead(status, cors(req)); res.end() }
async function readBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); if (!chunks.length) return {}; return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
function bearerUser(req) { const authorization = req.headers.authorization || ''; const token = authorization.replace(/^Bearer\s+/i, ''); let id = ids.mentee; try { const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')); if ([ids.mentee, ids.mentor, ids.admin, ids.onboardingMentee].includes(payload.sub)) id = payload.sub } catch {} return { id, aud: 'authenticated', role: 'authenticated', email: id === ids.mentor ? 'mentor@example.test' : id === ids.admin ? 'admin@example.test' : id === ids.onboardingMentee ? 'onboarding@example.test' : 'mentee@example.test', email_confirmed_at: now, phone: '', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: now, updated_at: now } }
function wantsObject(req) { return String(req.headers.accept || '').includes('application/vnd.pgrst.object+json') }
function postgrest(req, res, rows) { if (wantsObject(req)) { if (rows.length === 1) return json(req, res, 200, rows[0]); return json(req, res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }) } return json(req, res, 200, rows, { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` }) }
function filterEq(url, key) { const raw = url.searchParams.get(key); return raw?.startsWith('eq.') ? raw.slice(3) : null }
function activeCart() { return { id: ids.cart, user_id: ids.mentee, status: 'active', created_at: now, updated_at: now } }
function cartRows() { return state.cartItems.map(item => { const available = state.productAvailable && !state.productDeleted; return { cart_id: ids.cart, cart_item_id: item.id, commerce_item_id: ids.product, item_kind: 'digital_product', name: state.productDeleted ? null : state.product.name, slug: state.productDeleted ? null : state.product.slug, image_path: state.productDeleted ? null : state.product.image_path, price_amount: state.productDeleted ? null : state.product.price_amount, is_available: available, created_at: item.created_at } }) }
function createOrder() { state.createOrderCalls += 1; if (state.order) return state.order; if (!state.cartItems.length || !state.productAvailable || state.productDeleted) throw new Error('Cart is not checkoutable'); state.order = { id: ids.order, user_id: ids.mentee, cart_id: ids.cart, status: 'pending_payment', currency_code: 'IDR', total_amount: state.product.price_amount, created_at: now, updated_at: now, paid_at: null }; state.orderItems = [{ id: ids.orderItem, order_id: ids.order, commerce_item_id: ids.product, item_kind_snapshot: 'digital_product', name_snapshot: state.product.name, slug_snapshot: state.product.slug, unit_price_amount: state.product.price_amount, created_at: now }]; return state.order }
function ownedRows() { if (!state.order || state.order.status !== 'paid') return []; const item = state.orderItems[0]; return [{ order_item_id: item.id, order_id: state.order.id, commerce_item_id: item.commerce_item_id, name_snapshot: item.name_snapshot, slug_snapshot: item.slug_snapshot, unit_price_amount: item.unit_price_amount, purchased_at: state.order.paid_at || now, current_image_path: state.productDeleted ? null : state.product.image_path }] }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`)
  if (req.method === 'OPTIONS') return noContent(req, res)
  if (url.pathname === '/health') return json(req, res, 200, { ok: true })
  if (url.pathname === '/__fixture/reset' && req.method === 'POST') { state = initialState(); return json(req, res, 200, { ok: true }) }
  if (url.pathname === '/__fixture/onboarding-reset' && req.method === 'POST') { onboardingState = initialOnboardingState(); return json(req, res, 200, { ok: true }) }
  if (url.pathname === '/__fixture/onboarding-fail-next-save' && req.method === 'POST') { onboardingState.failNextSave = true; return json(req, res, 200, { ok: true }) }
  if (url.pathname === '/__fixture/onboarding-state') return json(req, res, 200, onboardingState)
  if (url.pathname === '/__fixture/state') return json(req, res, 200, { cartItemCount: state.cartItems.length, orderCount: state.order ? 1 : 0, createOrderCalls: state.createOrderCalls, orderId: state.order?.id ?? null, orderStatus: state.order?.status ?? null, productDeleted: state.productDeleted, productAvailable: state.productAvailable })
  if (url.pathname === '/__fixture/mark-paid' && req.method === 'POST') { if (!state.order) createOrder(); state.order.status = 'paid'; state.order.paid_at = now; return json(req, res, 200, { ok: true }) }
  if (url.pathname === '/__fixture/delete-product' && req.method === 'POST') { state.productDeleted = true; state.productAvailable = false; return json(req, res, 200, { ok: true }) }
  if (url.pathname === '/__fixture/set-unavailable' && req.method === 'POST') { state.productAvailable = false; return json(req, res, 200, { ok: true }) }
  if (url.pathname === '/auth/v1/user') { if (!req.headers.authorization) return json(req, res, 401, { message: 'missing session' }); return json(req, res, 200, bearerUser(req)) }

  if (url.pathname === '/rest/v1/profiles' && req.method === 'GET') { const requested = filterEq(url, 'id'); const user = bearerUser(req); return postgrest(req, res, [profileFor(requested || user.id)]) }
  if (url.pathname === '/rest/v1/mentee_profiles' && req.method === 'GET') { const requested = filterEq(url, 'user_id'); return postgrest(req, res, requested === ids.mentee ? [menteeProfile] : requested === ids.onboardingMentee ? [onboardingState.mentee] : []) }
  if (url.pathname === '/rest/v1/referral_sources' && req.method === 'GET') return postgrest(req, res, referralSources)
  if (url.pathname === '/rest/v1/interests' && req.method === 'GET') {
    const selectedOnly = String(url.searchParams.get('id') || '').startsWith('in.')
    return postgrest(req, res, selectedOnly ? onboardingInterests.filter(item => onboardingState.interestIds.includes(item.id)) : onboardingInterests)
  }
  if (url.pathname === '/rest/v1/mentee_interests' && req.method === 'GET') {
    const requested = filterEq(url, 'user_id')
    return postgrest(req, res, requested === ids.onboardingMentee ? onboardingState.interestIds.map(interest_id => ({ interest_id })) : [])
  }
  if (url.pathname === '/rest/v1/institutions' && req.method === 'GET') {
    const requested = filterEq(url, 'id')
    return postgrest(req, res, requested === onboardingInstitution.id ? [onboardingInstitution] : [])
  }
  if (url.pathname === '/rest/v1/google_calendar_connections' && req.method === 'GET') {
    if (wantsObject(req)) return json(req, res, 200, null)
    return postgrest(req, res, [])
  }
  if (url.pathname === '/rest/v1/mentor_profiles' && req.method === 'GET') { const requested = filterEq(url, 'user_id'); return postgrest(req, res, requested === ids.mentor ? [mentorProfile] : []) }
  if (url.pathname === '/rest/v1/digital_products' && req.method === 'GET') { if (state.productDeleted) return postgrest(req, res, []); const slug = filterEq(url, 'slug'); return postgrest(req, res, slug && slug !== state.product.slug ? [] : [state.product]) }
  if (url.pathname === '/rest/v1/orders' && req.method === 'GET') { const id = filterEq(url, 'id'); return postgrest(req, res, state.order && (!id || id === state.order.id) ? [state.order] : []) }
  if (url.pathname === '/rest/v1/order_items' && req.method === 'GET') { const orderId = filterEq(url, 'order_id'); return postgrest(req, res, orderId === ids.order ? state.orderItems : []) }
  if (url.pathname === '/rest/v1/private_mentoring_learning_paths' && req.method === 'GET') return postgrest(req, res, pmPaths)
  if (url.pathname === '/rest/v1/private_mentoring_session_focuses' && req.method === 'GET') return postgrest(req, res, pmFocuses)
  if (url.pathname === '/rest/v1/competition_categories' && req.method === 'GET') return postgrest(req, res, categories)
  if (url.pathname === '/rest/v1/private_mentoring_packages' && req.method === 'GET') return postgrest(req, res, pmPackages)
  if (url.pathname === '/rest/v1/mentor_tiers' && req.method === 'GET') return postgrest(req, res, mentorTiers)

  if (url.pathname.startsWith('/rest/v1/rpc/') && req.method === 'POST') {
    const fn = url.pathname.split('/').pop(); const body = await readBody(req)
    if (fn === 'search_institutions') return json(req, res, 200, [onboardingInstitution])
    if (fn === 'submit_institution') return json(req, res, 200, onboardingInstitution)
    if (fn === 'save_onboarding_step') {
      const user = bearerUser(req)
      if (user.id !== ids.onboardingMentee) return json(req, res, 403, { message: 'Fixture onboarding user required' })
      onboardingState.saveCalls += 1
      if (onboardingState.failNextSave) {
        onboardingState.failNextSave = false
        return json(req, res, 400, { message: 'Fixture save failure' })
      }
      const step = Number(body.p_step)
      const data = body.p_data || {}
      if (step > onboardingState.mentee.onboarding_step) return json(req, res, 400, { message: 'Complete preceding steps first' })
      if (step === 1) {
        onboardingState.profile = { ...onboardingState.profile, first_name: data.first_name, last_name: data.last_name, username: data.username, updated_at: now }
      } else if (step === 2) {
        onboardingState.mentee = { ...onboardingState.mentee, institution_id: data.institution_id, major_or_faculty: data.major_or_faculty, cohort_year: data.cohort_year, updated_at: now }
      } else if (step === 3) {
        onboardingState.mentee = { ...onboardingState.mentee, referral_source_id: data.referral_source_id, referral_other_text: data.referral_other_text, updated_at: now }
      } else if (step === 4) {
        onboardingState.interestIds = [...new Set(data.interest_ids || [])]
        onboardingState.mentee = { ...onboardingState.mentee, onboarding_completed_at: now, updated_at: now }
      }
      onboardingState.mentee = { ...onboardingState.mentee, onboarding_step: Math.max(onboardingState.mentee.onboarding_step, Math.min(step + 1, 4)) }
      return json(req, res, 200, onboardingState.mentee)
    }
    if (fn === 'get_or_create_active_cart') return json(req, res, 200, activeCart())
    if (fn === 'get_active_cart') return json(req, res, 200, cartRows())
    if (fn === 'add_cart_item') { if (body.p_commerce_item_id !== ids.product || state.productDeleted) return json(req, res, 400, { message: 'Unavailable item' }); if (!state.cartItems.length) state.cartItems.push({ id: ids.cartItem, created_at: now }); return json(req, res, 200, { id: ids.cartItem, cart_id: ids.cart, commerce_item_id: ids.product, created_at: now }) }
    if (fn === 'remove_cart_item') { state.cartItems = state.cartItems.filter(item => item.id !== body.p_cart_item_id); return noContent(req, res) }
    if (fn === 'create_order_from_cart') { try { return json(req, res, 200, createOrder()) } catch { return json(req, res, 400, { message: 'Cart is not checkoutable' }) } }
    if (fn === 'list_owned_digital_products') return json(req, res, 200, ownedRows())
    if (fn === 'list_my_private_mentoring_sessions') return json(req, res, 200, [])
  }

  if (url.pathname.startsWith('/storage/v1/object/public/digital-product-images/')) { res.writeHead(200, { 'content-type': 'image/svg+xml', ...cors(req) }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900"><rect width="640" height="900" fill="#171314"/></svg>') }
  return json(req, res, 404, { message: `Unhandled fixture request: ${req.method} ${url.pathname}` })
})

server.listen(port, '127.0.0.1', () => { console.log(`Commerce fixture backend listening on http://localhost:${port}`) })
