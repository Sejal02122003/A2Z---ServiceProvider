/**
 * B2C app navigation — Individual + Labour only (/app).
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
} from 'lucide-react'
import { USER_ROLES } from '../constants/userRoles.js'

/** @type {Record<string, { headerTagline: string, bottomNav: object[], drawerNav: object[] }>} */
const byRole = {
  [USER_ROLES.CUSTOMER]: {
    headerTagline: 'Book Salon, Home Appliances & Repair Services',
    bottomNav: [
      { id: 'home', to: '/app', label: 'Home', icon: Home, end: true },
      { id: 'book', to: '/app/my-bookings', label: 'Bookings', icon: CalendarClock },
      { id: 'search', to: '/app/search', label: 'Search', icon: Search },
      { id: 'profile', to: '/app/profile', label: 'Profile', icon: UserRound },
    ],
    drawerNav: [
      { id: 'home', to: '/app', label: 'Home', icon: Home, end: true },
      { id: 'search', to: '/app/search', label: 'Search services', icon: Search },
      { id: 'billing', to: '/app/billing', label: 'Invoice & Billing', icon: FileText },
      { id: 'book', to: '/app/my-bookings', label: 'My bookings', icon: ClipboardList },
      { id: 'support', to: '/app/support', label: 'Support & issues', icon: LifeBuoy },
      { id: 'privacy', to: '/app/privacy-policy', label: 'Privacy Policy', icon: FileText },
      { id: 'terms', to: '/app/terms-conditions', label: 'Terms & Conditions', icon: FileText },
      { id: 'faqs', to: '/app/faqs', label: 'FAQs', icon: FileText },
      { id: 'cancellation', to: '/app/cancellation-policy', label: 'Cancellation Policy', icon: FileText },
      { id: 'refund', to: '/app/refund-policy', label: 'Refund Policy', icon: FileText },
      { id: 'profile', to: '/app/profile', label: 'Profile & settings', icon: UserRound },
    ],
  },
  [USER_ROLES.LABOUR]: {
    headerTagline: 'Jobs & earnings',
    bottomNav: [
      { id: 'home', to: '/app', label: 'Home', icon: Home, end: true },
      { id: 'jobs', to: '/app/jobs', label: 'Jobs', icon: HardHat },
      { id: 'materials', to: '/app/materials', label: 'Materials', icon: Package },
      { id: 'earnings', to: '/app/earnings', label: 'Earnings', icon: IndianRupee },
      { id: 'profile', to: '/app/profile', label: 'Profile', icon: UserRound },
    ],
    drawerNav: [
      { id: 'home', to: '/app', label: 'Home', icon: Home, end: true },
      { id: 'jobs', to: '/app/jobs', label: 'Assignments', icon: HardHat },
      { id: 'materials', to: '/app/materials', label: 'Materials & Stock', icon: Package },
      { id: 'book', to: '/app/my-bookings', label: 'My bookings', icon: CalendarClock },
      { id: 'earnings', to: '/app/earnings', label: 'Earnings & payouts', icon: IndianRupee },
      { id: 'kyc', to: '/app/kyc', label: 'Aadhaar KYC', icon: ShieldCheck },
      { id: 'workTypes', to: '/app/work-categories', label: 'Work types', icon: Wrench },
      { id: 'support', to: '/app/support', label: 'Support', icon: LifeBuoy },
      { id: 'privacy', to: '/app/privacy-policy', label: 'Privacy Policy', icon: FileText },
      { id: 'terms', to: '/app/terms-conditions', label: 'Terms & Conditions', icon: FileText },
      { id: 'faqs', to: '/app/faqs', label: 'FAQs', icon: FileText },
      { id: 'cancellation', to: '/app/cancellation-policy', label: 'Cancellation Policy', icon: FileText },
      { id: 'refund', to: '/app/refund-policy', label: 'Refund Policy', icon: FileText },
      { id: 'profile', to: '/app/profile', label: 'Profile', icon: UserRound },
    ],
  },
}

export function getAppNavigation(role) {
  if (role && byRole[role]) return byRole[role]
  return byRole[USER_ROLES.CUSTOMER]
}

export function getAppShellTitle(pathname) {
  if (pathname.startsWith('/app/jobs')) return 'Jobs'
  if (pathname.startsWith('/app/materials')) return 'Materials'
  if (pathname.startsWith('/app/earnings')) return 'Earnings'
  if (pathname.startsWith('/app/kyc')) return 'KYC verification'

  if (pathname.startsWith('/app/notifications')) return 'Notifications'
  if (pathname.startsWith('/app/work-categories')) return 'Work types'
  if (pathname.startsWith('/app/booking/flow')) return 'Book labour'
  if (pathname.startsWith('/app/support')) return 'Support'
  if (pathname.startsWith('/app/subscriptions')) return 'Subscription'
  if (pathname.startsWith('/app/billing')) return 'Invoice & Billing'
  if (pathname.startsWith('/app/profile')) return 'Profile'
  if (pathname.startsWith('/app/bookings')) return 'My bookings'
  if (pathname.startsWith('/app/search')) return 'Search'
  if (pathname.startsWith('/app/privacy-policy')) return 'Privacy Policy'
  if (pathname.startsWith('/app/terms-conditions')) return 'Terms & Conditions'
  if (pathname.startsWith('/app/faqs')) return 'FAQs'
  if (pathname.startsWith('/app/cancellation-policy')) return 'Cancellation Policy'
  if (pathname.startsWith('/app/refund-policy')) return 'Refund Policy'
  return 'Home'
}

