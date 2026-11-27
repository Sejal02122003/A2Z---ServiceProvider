/**
 * Sub-admin access control.
 *
 * A sub-admin is DENIED every authenticated API call unless a rule below allows it, either for
 * everyone (their own session / notifications) or for one of the sections the main admin granted.
 * When a new admin page or endpoint is added, add its rule here (and the page in the frontend's
 * config/adminPermissions.js), otherwise only the main admin can use it.
 */

const READ = ['GET']
const ANY = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const OID = '[a-f0-9]{24}'
const SEG = '[^/]+'

/** `rest` also allows every path underneath */
const rule = (methods, path, { rest = false } = {}) => ({
  methods,
  pattern: new RegExp(`^${path.replace(/:oid/g, OID).replace(/:any/g, SEG)}${rest ? '(/.*)?' : ''}$`, 'i'),
})
const all = (path) => rule(ANY, path, { rest: true })

const categoryTree = rule(READ, '/admin/labour-categories/tree')
const zoneLookup = rule(READ, '/admin/zones(/list)?')
const readSettings = rule(READ, '/admin/settings')
const readBookings = rule(READ, '/admin/bookings')
const walletSettings = rule(['GET', 'PUT'], '/admin/wallets?/settings')
const rechargeRequests = all('/admin/wallets?/recharge-requests')
const walletTransactions = rule(READ, '/admin/wallets?/transactions')
const walletUsers = [
  rule(READ, '/admin/wallets?/users(/:oid)?'),
  rule(['POST'], '/admin/wallets?/users/:oid/adjust'),
]
const serviceProviderAccounts = [
  rule(READ, '/users(/:oid)?'),
  rule(['PATCH'], '/users/:oid/status'),
  all('/users/:oid/welcome-kit'),
  all('/service-partners'),
]

const PERMISSION_RULES = {
  dashboard: [rule(READ, '/admin/dashboard/stats')],
  inventory: [
    all('/inventory'),
    all('/products'),
    rule(['GET', 'POST'], '/services/:oid/products'),
    all('/service-products'),
    all('/material-requests/admin'),
    categoryTree,
  ],
  users: [...serviceProviderAccounts, rule(['DELETE'], '/users/:oid')],
  identity_verification: [all('/admin/identity-verifications')],
  service_providers: [
    ...serviceProviderAccounts,
    rule(['PATCH'], '/users/:oid/(labour-kyc-review|trial-evaluate)'),
  ],
  vendor_trials: [
    all('/admin/vendor-trials'),
    rule(['GET', 'PUT'], '/admin/trial-settings'),
    zoneLookup,
  ],
  service_catalog: [
    all('/admin/labour-category-groups'),
    all('/admin/labour-categories'),
    all('/admin/labour-subcategories'),
    all('/admin/labour-services'),
    all('/admin/packages'),
    zoneLookup,
  ],
  bookings: [all('/admin/bookings')],
  booking_policies: [
    all('/booking-cancellations/admin'),
    all('/penalties/admin'),
    all('/reminders/admin'),
  ],
  simulated_alerts: [all('/simulated-opportunities/admin'), categoryTree, zoneLookup],
  complaints: [all('/admin/complaints')],
  zones: [all('/admin/zones')],
  wallet_recharge: [rechargeRequests, walletTransactions, rule(READ, '/admin/wallets?/statistics')],
  rewards: [all('/admin/rewards'), categoryTree],
  payments: [
    all('/admin/payments/qr-config'),
    all('/admin/provider-payments'),
    all('/provider-payments/admin'),
    readBookings,
    rule(READ, '/admin/bookings/:oid'),
    rule(['POST'], '/admin/bookings/:oid/invoice'),
  ],
  wallet_rewards: [
    walletSettings,
    ...walletUsers,
    all('/admin/wallets?/service-credit'),
    all('/admin/wallet-eligibility'),
  ],
  fees: [
    readSettings,
    readBookings,
    rule(['PATCH'], '/admin/settings/(platform-fees|commission)'),
    rule(READ, '/admin/commission-fee'),
  ],
  provider_wallet: [
    readSettings,
    readBookings,
    walletSettings,
    ...walletUsers,
    rechargeRequests,
    walletTransactions,
    rule(['PATCH'], '/admin/settings/labour-cash-limit'),
    rule(READ, '/admin/wallets?/(labour-stats|vendor-stats|vendor-withdrawals)'),
    all('/admin/wallets?/withdrawals'),
    rule(['POST'], '/admin/wallets?/reconcile-settlement/:oid'),
  ],
  subscriptions: [all('/admin/labour-subscriptions'), readSettings],
  reports: [rule(READ, '/admin/reports/(stats|data)')],
  banners: [all('/admin/banners')],
  policies: [rule(['GET', 'PUT'], '/policies/:any/:any')],
  settings: [
    all('/admin/settings'),
    walletSettings,
    categoryTree,
    rule(['PUT'], '/admin/labour-categories/:oid/gst'),
  ],
  reviews: [rule(READ, '/reviews'), rule(['DELETE'], '/reviews/:oid')],
}

export const ADMIN_PERMISSION_KEYS = Object.keys(PERMISSION_RULES)

/** Allowed for every sub-admin: their own session, profile and notifications */
const SELF_RULES = [
  rule(READ, '/auth/me'),
  rule(READ, '/admin/profile'),
  rule(['GET', 'DELETE'], '/notifications'),
  rule(READ, '/notifications/unread-count'),
  rule(['PATCH'], '/notifications/:oid/read'),
  rule(['DELETE'], '/notifications/:oid'),
  rule(['POST'], '/notifications/(read-all|token|remove-token)'),
  rule(['POST', 'DELETE'], '/fcm-tokens/(save|mobile/save|remove)'),
  rule(READ, '/uploads/config'),
]
const UPLOAD_RULE = rule(['POST'], '/uploads/(media|document)')

const matches = (r, method, path) => r.methods.includes(method) && r.pattern.test(path)

export function canSubAdminAccess(permissions, method, originalUrl) {
  const verb = method === 'HEAD' ? 'GET' : method
  const path = String(originalUrl || '')
    .split('?')[0]
    .replace(/^\/api(\/v1)?(?=\/)/i, '')
    .replace(/(.)\/+$/, '$1')
  if (SELF_RULES.some((r) => matches(r, verb, path))) return true
  const granted = (permissions || []).filter((key) => Object.hasOwn(PERMISSION_RULES, key))
  if (granted.length && matches(UPLOAD_RULE, verb, path)) return true
  return granted.some((key) => PERMISSION_RULES[key].some((r) => matches(r, verb, path)))
}

/** Admin panel page prefix -> sections that include it (used to route admin alerts) */
const PAGE_PERMISSIONS = [
  ['/admin/bookings', ['bookings']],
  ['/admin/users', ['users']],
  ['/admin/identity-verifications', ['identity_verification']],
  ['/admin/labour', ['service_providers']],
  ['/admin/vendor-trials', ['vendor_trials']],
  ['/admin/complaints', ['complaints']],
  ['/admin/wallet-management', ['wallet_recharge']],
  ['/admin/qr-payments', ['payments']],
  ['/admin/billing', ['payments']],
  ['/admin/labour-wallet', ['provider_wallet']],
  ['/admin/labour-subscriptions', ['subscriptions']],
  ['/admin/inventory', ['inventory']],
  ['/admin/rewards', ['rewards']],
  ['/admin/penalty-management', ['booking_policies']],
  ['/admin/booking-cancellation', ['booking_policies']],
  ['/admin/booking-reminders', ['booking_policies']],
  ['/admin/simulated-opportunities', ['simulated_alerts']],
  ['/admin/reviews', ['reviews']],
]

export function permissionsForAdminLink(link) {
  const path = String(link || '').split('?')[0]
  const hit = PAGE_PERMISSIONS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
  return hit ? hit[1] : []
}
