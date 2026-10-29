/**
 * B2C app navigation — Individual (/user) + Service Provider (/serviceprovider).
 */
import {
  CalendarClock,
  ClipboardList,
  Clock,
  HardHat,
  Home,
  IndianRupee,
  LifeBuoy,
  Search,
  ShieldCheck,
  UserRound,
  Wrench,
  FileText,
  Package,
  Award,
  Wallet,
  Bell,
  Sparkles,
} from 'lucide-react'
import { USER_ROLES } from '../constants/userRoles.js'

/** @type {Record<string, { headerTagline: string, bottomNav: object[], drawerNav: object[] }>} */
const byRole = {
  [USER_ROLES.CUSTOMER]: {
    headerTagline: 'Book Salon, Home Appliances & Repair Services',
    bottomNav: [
      { id: 'home', to: '/user', label: 'Home', icon: Home, end: true },
      { id: 'book', to: '/user/my-bookings', label: 'Bookings', icon: CalendarClock },
      { id: 'search', to: '/user/search', label: 'Search', icon: Search },
      { id: 'profile', to: '/user/profile', label: 'Profile', icon: UserRound },
    ],
    drawerNav: [
      { id: 'home', to: '/user', label: 'Home', icon: Home, end: true },
      { id: 'wallet', to: '/user/wallet', label: 'My Wallet', icon: Wallet },
      { id: 'search', to: '/user/search', label: 'Search services', icon: Search },
      { id: 'billing', to: '/user/billing', label: 'Invoice & Billing', icon: FileText },
      { id: 'book', to: '/user/my-bookings', label: 'My bookings', icon: ClipboardList },
      { id: 'notifications', to: '/user/notifications', label: 'Notifications', icon: Bell },
      { id: 'support', to: '/user/support', label: 'Support & issues', icon: LifeBuoy },
      { id: 'privacy', to: '/user/privacy-policy', label: 'Privacy Policy', icon: FileText },
      { id: 'terms', to: '/user/terms-conditions', label: 'Terms & Conditions', icon: FileText },
      { id: 'faqs', to: '/user/faqs', label: 'FAQs', icon: FileText },
      { id: 'cancellation', to: '/user/cancellation-policy', label: 'Cancellation Policy', icon: FileText },
      { id: 'refund', to: '/user/refund-policy', label: 'Refund Policy', icon: FileText },
      { id: 'profile', to: '/user/profile', label: 'Profile & settings', icon: UserRound },
    ],
  },
  [USER_ROLES.LABOUR]: {
    headerTagline: 'Jobs & earnings',
    bottomNav: [
      { id: 'home', to: '/serviceprovider', label: 'Home', icon: Home, end: true },
      { id: 'jobs', to: '/serviceprovider/jobs', label: 'Jobs', icon: HardHat },
      { id: 'wallet', to: '/serviceprovider/wallet', label: 'Wallet', icon: Wallet },
      { id: 'earnings', to: '/serviceprovider/earnings', label: 'Earnings', icon: IndianRupee },
      { id: 'profile', to: '/serviceprovider/profile', label: 'Profile', icon: UserRound },
    ],
    drawerNav: [
      { id: 'home', to: '/serviceprovider', label: 'Home', icon: Home, end: true },
      { id: 'onboarding', to: '/serviceprovider/partner-onboarding', label: 'Registration Steps (Onboarding)', icon: Sparkles },
      { id: 'wallet', to: '/serviceprovider/wallet', label: 'My Wallet & Recharge', icon: Wallet },
      { id: 'jobs', to: '/serviceprovider/jobs', label: 'Assignments', icon: HardHat },
      { id: 'rewards', to: '/serviceprovider/rewards', label: 'Rewards & Incentives', icon: Award },
      { id: 'materials', to: '/serviceprovider/materials', label: 'Materials & Stock', icon: Package },
      { id: 'book', to: '/serviceprovider/my-bookings', label: 'My bookings', icon: CalendarClock },
      { id: 'earnings', to: '/serviceprovider/earnings', label: 'Earnings & payouts', icon: IndianRupee },
      { id: 'kyc', to: '/serviceprovider/kyc', label: 'Aadhaar KYC', icon: ShieldCheck },
      { id: 'workTypes', to: '/serviceprovider/work-categories', label: 'Work types', icon: Wrench },
      { id: 'support', to: '/serviceprovider/support', label: 'Support', icon: LifeBuoy },
      { id: 'privacy', to: '/serviceprovider/privacy-policy', label: 'Privacy Policy', icon: FileText },
      { id: 'terms', to: '/serviceprovider/terms-conditions', label: 'Terms & Conditions', icon: FileText },
      { id: 'faqs', to: '/serviceprovider/faqs', label: 'FAQs', icon: FileText },
      { id: 'cancellation', to: '/serviceprovider/cancellation-policy', label: 'Cancellation Policy', icon: FileText },
      { id: 'refund', to: '/serviceprovider/refund-policy', label: 'Refund Policy', icon: FileText },
      { id: 'profile', to: '/serviceprovider/profile', label: 'Profile', icon: UserRound },
    ],
  },
}

export function getAppNavigation(role) {
  if (role && byRole[role]) return byRole[role]
  return byRole[USER_ROLES.CUSTOMER]
}

export function getAppShellTitle(pathname) {
  const p = pathname.replace(/^\/(user|serviceprovider|app)/, '') || '/'
  if (p.startsWith('/wallet') || p.startsWith('/labor-wallet') || p.startsWith('/labour-wallet')) return 'My Wallet'
  if (p.startsWith('/jobs')) return 'Jobs'
  if (p.startsWith('/rewards')) return 'Rewards & Incentives'
  if (p.startsWith('/materials')) return 'Materials'
  if (p.startsWith('/earnings')) return 'Earnings'
  if (p.startsWith('/kyc')) return 'KYC verification'
  if (p.startsWith('/partner-onboarding') || p.startsWith('/onboarding')) return 'Registration Steps'

  if (p.startsWith('/notifications')) return 'Notifications'
  if (p.startsWith('/work-categories')) return 'Work types'
  if (p.startsWith('/booking/flow')) return 'Book Service Provider'
  if (p.startsWith('/support')) return 'Support'
  if (p.startsWith('/subscriptions') || p.startsWith('/subscription')) return 'Subscription'
  if (p.startsWith('/billing')) return 'Invoice & Billing'
  if (p.startsWith('/profile')) return 'Profile'
  if (p.startsWith('/bookings') || p.startsWith('/my-bookings')) return 'My bookings'
  if (p.startsWith('/search')) return 'Search'
  if (p.startsWith('/privacy-policy')) return 'Privacy Policy'
  if (p.startsWith('/terms-conditions')) return 'Terms & Conditions'
  if (p.startsWith('/faqs')) return 'FAQs'
  if (p.startsWith('/cancellation-policy')) return 'Cancellation Policy'
  if (p.startsWith('/refund-policy')) return 'Refund Policy'
  return 'Home'
}
