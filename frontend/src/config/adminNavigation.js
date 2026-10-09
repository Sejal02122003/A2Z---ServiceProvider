/**
 * Admin sidebar — aligned with Work Scope (Super Control Panel modules).
 */
import {
  LayoutDashboard,
  Users,
  IdCard,
  Layers,
  ClipboardList,
  Package,
  Network,
  Clock,
  Wallet,
  BadgeIndianRupee,
  BarChart3,
  Settings,
  Image,
  MessageSquare,
  UserCog,
  Tag,
  Wrench,
  Map,
  HandCoins,
  ClipboardCheck,
  Star,
  CalendarDays,
  AlertTriangle,
  Boxes,
  Radio,
  Gift,
  Award,
  UserCheck,
  Sliders,
  BellRing,
  ShieldAlert,
} from 'lucide-react'


/**
 * Admin Labour hub (`/admin/labour`) shows links to these routes — a curated slice of Work Scope modules
 * that touch roster, KYC, deployment, and time records. Edit here to expand the hub without touching the page.
 */
export const ADMIN_LABOUR_HUB_PATHS = new Set([
  '/admin/categories',
  '/admin/sub-categories',
  '/admin/services',
  '/admin/users',
  '/admin/bookings',
])

/**
 * @returns {{ title: string | null, items: { to: string, label: string, icon: import('lucide-react').LucideIcon, end?: boolean }[] }[]}
 */
export function getLabourAdminHubNavGroups() {
  return ADMIN_NAV_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items.filter((item) => ADMIN_LABOUR_HUB_PATHS.has(item.to)),
  })).filter((g) => g.items.length > 0)
}

/** @type {{ title: string | null, items: { to: string, label: string, icon: import('lucide-react').LucideIcon, end?: boolean }[] }[]} */
export const ADMIN_NAV_SECTIONS = [
  {
    title: null,
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Inventory',
    items: [
      { to: '/admin/inventory', label: 'Inventory Hub', icon: Package, end: true },
      { to: '/admin/inventory/products', label: 'Products', icon: Tag },
      { to: '/admin/inventory/service-materials', label: 'Service Materials', icon: Wrench },
      { to: '/admin/inventory/material-requests', label: 'Material Requests', icon: ClipboardCheck },
      { to: '/admin/inventory/stock', label: 'Stock Management', icon: Boxes },
      { to: '/admin/inventory/vendor-inventory', label: 'Vendor Inventory', icon: Users },
      { to: '/admin/inventory/transactions', label: 'Ledger Audit', icon: BarChart3 },
      { to: '/admin/inventory/low-stock', label: 'Low Stock Alerts', icon: AlertTriangle },
    ],
  },
  {
    title: 'Users',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users },
    ],
  },
  {
    title: 'Workforce',
    items: [
      { to: '/admin/labour', label: 'KYC', icon: IdCard },
    ],
  },
  {
    title: 'Vendor Management',
    items: [
      { to: '/admin/vendor-trials', label: 'Trial Management', icon: Award },
      { to: '/admin/vendor-trials/pending-confirmations', label: 'Pending Confirmations', icon: UserCheck },
      { to: '/admin/vendor-trials/settings', label: 'Trial Settings', icon: Sliders },
    ],
  },
  {
    title: 'Skill categories',
    items: [
      { to: '/admin/categories', label: 'Categories', icon: Layers },
      { to: '/admin/sub-categories', label: 'Sub-Categories', icon: Tag },
      { to: '/admin/services', label: 'Services', icon: Wrench },
    ],
  },

  {
    title: 'Operations',
    items: [
      { to: '/admin/bookings', label: 'Bookings & requests', icon: ClipboardList },
      { to: '/admin/penalty-management', label: 'Penalty & Bounce Policy', icon: ShieldAlert },
      { to: '/admin/booking-reminders', label: 'Booking Reminders', icon: BellRing },
      { to: '/admin/simulated-opportunities', label: 'Simulated Alerts', icon: Radio },
      { to: '/admin/complaints', label: 'Complaints', icon: MessageSquare },
      { to: '/admin/zone-management', label: 'Zone Management', icon: Map },
      { to: '/admin/zones', label: 'Manage Radius', icon: Map },
    ],
  },
  {
    title: 'Finance & Incentives',
    items: [
      { to: '/admin/rewards', label: 'Rewards & Incentives', icon: Award },
      { to: '/admin/billing', label: 'Payments & billing', icon: Wallet },
      { to: '/admin/wallet-rewards', label: 'Wallet & Rewards', icon: Gift },
      { to: '/admin/platform-fee', label: 'Platform Fee', icon: HandCoins },
      { to: '/admin/commission-fee', label: 'Commission Fee', icon: HandCoins },
      { to: '/admin/labour-wallet', label: 'Labour Wallet', icon: Wallet },
      { to: '/admin/cash-management', label: 'Cash Management', icon: Wallet },
      { to: '/admin/labour-subscriptions', label: 'Labour Subscriptions', icon: CalendarDays },
      { to: '/admin/free-trials', label: 'Free Trials', icon: CalendarDays },
    ],
  },
  {
    title: 'Insights',
    items: [{ to: '/admin/reports', label: 'Reports & analytics', icon: BarChart3 }],
  },
  {
    title: 'Content',
    items: [
      { to: '/admin/banners', label: 'Banners', icon: Image },
    ],
  },
  {
    title: 'Policies',
    items: [
      { to: '/admin/privacy-policy', label: 'Privacy Policy', icon: ClipboardList },
      { to: '/admin/terms-conditions', label: 'Terms & Conditions', icon: ClipboardList },
      { to: '/admin/faqs', label: 'FAQs', icon: ClipboardList },
      { to: '/admin/cancellation-policy', label: 'Cancellation Policy', icon: ClipboardList },
      { to: '/admin/refund-policy', label: 'Refund Policy', icon: ClipboardList },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/admin/profile', label: 'Profile', icon: UserCog },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
      { to: '/admin/reviews', label: 'Reviews & Ratings', icon: Star },
    ],
  },
]

const ROUTE_TITLES = [
  { prefix: '/admin/inventory/products', title: 'Inventory — Products' },
  { prefix: '/admin/inventory/service-materials', title: 'Inventory — Service Materials' },
  { prefix: '/admin/inventory/material-requests', title: 'Inventory — Material Requests' },
  { prefix: '/admin/inventory/stock', title: 'Inventory — Stock Management' },
  { prefix: '/admin/inventory/vendor-inventory', title: 'Inventory — Vendor Inventory' },
  { prefix: '/admin/inventory/transactions', title: 'Inventory — Ledger Audit' },
  { prefix: '/admin/inventory/low-stock', title: 'Inventory — Low Stock Alerts' },
  { prefix: '/admin/inventory', title: 'Central Inventory Hub' },
  { prefix: '/admin/rewards', title: 'Rewards & Incentives Management' },
  { prefix: '/admin/penalty-management', title: 'Penalty & Bounce Management' },
  { prefix: '/admin/booking-reminders', title: 'Booking Date & Time Reminders' },
  { prefix: '/admin/wallet-rewards', title: 'Wallet & Rewards' },

  { prefix: '/admin/simulated-opportunities', title: 'Simulated Opportunities' },
  { prefix: '/admin/vendor-trials/pending-confirmations', title: 'Vendor Management — Pending Confirmations' },
  { prefix: '/admin/vendor-trials/settings', title: 'Vendor Management — Trial Settings' },
  { prefix: '/admin/vendor-trials', title: 'Vendor Management — Trial Management' },
  { prefix: '/admin/profile', title: 'Profile' },
  { prefix: '/admin/complaints', title: 'Complaints' },
  { prefix: '/admin/settings', title: 'Settings' },
  { prefix: '/admin/banners', title: 'Banners' },
  { prefix: '/admin/reports', title: 'Reports & analytics' },
  { prefix: '/admin/platform-fee', title: 'Platform Fee' },
  { prefix: '/admin/commission-fee', title: 'Commission Fee' },
  { prefix: '/admin/labour-wallet', title: 'Labour Wallet' },
  { prefix: '/admin/cash-management', title: 'Cash Management' },
  { prefix: '/admin/billing', title: 'Payments & billing' },
  { prefix: '/admin/labour-subscriptions', title: 'Labour Subscriptions' },
  { prefix: '/admin/free-trials', title: 'Free Trials' },
  { prefix: '/admin/reviews', title: 'Reviews & Ratings' },
  { prefix: '/admin/privacy-policy', title: 'Privacy Policy' },
  { prefix: '/admin/terms-conditions', title: 'Terms & Conditions' },
  { prefix: '/admin/faqs', title: 'FAQs' },
  { prefix: '/admin/cancellation-policy', title: 'Cancellation Policy' },
  { prefix: '/admin/refund-policy', title: 'Refund Policy' },
  { prefix: '/admin/bookings', title: 'Bookings & requests' },
  { prefix: '/admin/services', title: 'Services' },
  { prefix: '/admin/sub-categories', title: 'Sub-Categories' },
  { prefix: '/admin/categories', title: 'Categories' },
  { prefix: '/admin/labour', title: 'KYC' },
  { prefix: '/admin/users', title: 'Users' },
  { prefix: '/admin/zone-management', title: 'Zone Management' },
  { prefix: '/admin/zones', title: 'Manage Radius' },
  { prefix: '/admin', title: 'Dashboard' },
]

export function getAdminTitle(pathname) {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname
  for (const { prefix, title } of ROUTE_TITLES) {
    if (path === prefix || (prefix !== '/admin' && path.startsWith(prefix + '/'))) return title
  }
  return 'Admin'
}
