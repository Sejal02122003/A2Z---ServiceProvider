/**
 * Admin panel sections the main admin can grant to a sub-admin.
 * Keys must match backend `src/constants/adminPermissions.js`, which enforces them on the API.
 * Pages not listed here (other than profile and notifications) are main-admin only.
 */
import { USER_ROLES } from '../constants/userRoles.js'
import { ADMIN_NAV_SECTIONS } from './adminNavigation.js'

export const ADMIN_PERMISSION_GROUPS = [
  {
    title: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', description: 'Platform totals and stats', paths: ['/admin'] },
      { key: 'reports', label: 'Reports & Analytics', description: 'Reports and analytics data', paths: ['/admin/reports'] },
    ],
  },
  {
    title: 'People',
    items: [
      { key: 'users', label: 'Users', description: 'View, block and delete user accounts', paths: ['/admin/users'] },
      { key: 'identity_verification', label: 'Identity Verification', description: 'Review identity checks', paths: ['/admin/identity-verifications'] },
      { key: 'service_providers', label: 'Service Provider KYC', description: 'KYC review and welcome kits', paths: ['/admin/labour'] },
      { key: 'vendor_trials', label: 'Vendor Management', description: 'Trials, confirmations and trial settings', paths: ['/admin/vendor-trials', '/admin/free-trials'] },
    ],
  },
  {
    title: 'Operations',
    items: [
      { key: 'bookings', label: 'Bookings & Requests', description: 'Manage and assign bookings', paths: ['/admin/bookings'] },
      { key: 'complaints', label: 'Complaints', description: 'Respond to complaints', paths: ['/admin/complaints'] },
      { key: 'booking_policies', label: 'Cancellation, Penalty & Reminders', description: 'Late fees, penalties and booking reminders', paths: ['/admin/booking-cancellation', '/admin/penalty-management', '/admin/booking-reminders'] },
      { key: 'simulated_alerts', label: 'Simulated Alerts', description: 'Send practice job alerts', paths: ['/admin/simulated-opportunities'] },
      { key: 'zones', label: 'Zones & Radius', description: 'Service zones and search radius', paths: ['/admin/zone-management', '/admin/zones'] },
    ],
  },
  {
    title: 'Catalogue & stock',
    items: [
      { key: 'service_catalog', label: 'Categories, Services & Packages', description: 'Categories, sub-services and packages', paths: ['/admin/categories', '/admin/sub-categories', '/admin/services', '/admin/sub-services', '/admin/packages'] },
      { key: 'inventory', label: 'Inventory', description: 'Products, stock and material requests', paths: ['/admin/inventory'] },
    ],
  },
  {
    title: 'Money',
    items: [
      { key: 'wallet_recharge', label: 'Wallet Recharge Requests', description: 'Approve or reject recharges', paths: ['/admin/wallet-management'] },
      { key: 'payments', label: 'Payments, Billing & QR', description: 'Billing, invoices and QR payments', paths: ['/admin/billing', '/admin/qr-payments'] },
      { key: 'wallet_rewards', label: 'Customer Wallet & Eligibility', description: 'Customer balances and wallet rules', paths: ['/admin/wallet-rewards', '/admin/wallet-eligibility'] },
      { key: 'provider_wallet', label: 'Service Provider Wallet', description: 'Provider balances and withdrawals', paths: ['/admin/labour-wallet', '/admin/cash-management'] },
      { key: 'fees', label: 'Platform & Commission Fees', description: 'Change fees and commission', paths: ['/admin/platform-fee', '/admin/commission-fee'] },
      { key: 'rewards', label: 'Rewards & Incentives', description: 'Provider reward campaigns', paths: ['/admin/rewards'] },
      { key: 'subscriptions', label: 'Provider Subscriptions', description: 'Plans and refunds', paths: ['/admin/labour-subscriptions'] },
    ],
  },
  {
    title: 'Content & system',
    items: [
      { key: 'banners', label: 'Banners', description: 'App banners', paths: ['/admin/banners'] },
      { key: 'policies', label: 'Policies & FAQs', description: 'Privacy, terms, refund and FAQs', paths: ['/admin/privacy-policy', '/admin/terms-conditions', '/admin/faqs', '/admin/cancellation-policy', '/admin/refund-policy'] },
      { key: 'reviews', label: 'Reviews & Ratings', description: 'View and delete reviews', paths: ['/admin/reviews'] },
      { key: 'settings', label: 'Platform Settings', description: 'Fees, GST, wallet, contacts and branding', paths: ['/admin/settings'] },
    ],
  },
]

export const ADMIN_PERMISSIONS = ADMIN_PERMISSION_GROUPS.flatMap((g) => g.items)

const ALWAYS_ALLOWED = ['/admin/profile', '/admin/notifications']

const isUnder = (pathname, base) =>
  pathname === base || (base !== '/admin' && pathname.startsWith(`${base}/`))

export function canAccessAdminPath(user, pathname) {
  if (user?.role === USER_ROLES.ADMIN) return true
  if (user?.role !== USER_ROLES.SUB_ADMIN) return false
  const path = pathname.toLowerCase().replace(/(.)\/+$/, '$1')
  if (ALWAYS_ALLOWED.some((base) => isUnder(path, base))) return true
  const section = ADMIN_PERMISSIONS.find((p) => p.paths.some((base) => isUnder(path, base)))
  return Boolean(section && user.adminPermissions?.includes(section.key))
}

/** Sidebar sections limited to what this account may open */
export function getAdminNavSections(user) {
  return ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccessAdminPath(user, item.to)),
  })).filter((section) => section.items.length > 0)
}

/** Where to send an account that cannot open the dashboard */
export function firstAllowedAdminPath(user) {
  const items = getAdminNavSections(user).flatMap((s) => s.items)
  return items.find((i) => !ALWAYS_ALLOWED.includes(i.to))?.to || '/admin/profile'
}
