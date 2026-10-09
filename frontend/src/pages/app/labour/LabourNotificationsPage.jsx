import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  BellRing,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  HardHat,
  IdCard,
  MapPin,
  Sparkles,
  Timer,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth.js'
import { KYC_STATUS } from '../../../constants/userRoles.js'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppButton } from '../../../components/app-ui/buttons/AppButton.jsx'
import { AppBadge } from '../../../components/app-ui/data-display/AppBadge.jsx'
import { AppEmptyState } from '../../../components/app/AppEmptyState.jsx'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { AppPillTabs } from '../../../components/app-ui/navigation/AppPillTabs.jsx'
import {
  buildLabourNotifications,
  dismissNotification,
  markNotificationRead,
  markNotificationsRead,
  subscribeLabourNotifications,
} from '../../../lib/labourNotifications.js'
import {
  loadJobDemoState,
  nowIso,
  saveJobDemoState,
  subscribeJobDemo,
} from '../../../lib/labourJobDemoStorage.js'

import { readWalletState, subscribeWallet } from '../../../lib/labourWalletStorage.js'
import { buildEarningsGlance } from '../../../lib/labourHomeHelpers.js'
import { bookingReminderApi } from '../../../api/bookingReminderApi.js'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'jobs', label: 'Job requests' },
  { id: 'updates', label: 'Updates' },
]

const KIND_ICON = {
  job_request: Flame,
  kyc: IdCard,
  earnings: Wallet,
  assignment: HardHat,
  profile: MapPin,
  system: Bell,
}

const KIND_TONE = {
  job_request: 'from-amber-500/15 to-orange-50 text-amber-800 ring-amber-200/80',
  kyc: 'from-violet-500/15 to-violet-50 text-violet-800 ring-violet-200/80',
  earnings: 'from-blue-600/15 to-blue-50 text-blue-800 ring-blue-200/80',
  assignment: 'from-brand/15 to-blue-50 text-brand ring-brand/25',
  profile: 'from-slate-500/15 to-slate-50 text-slate-800 ring-slate-200/80',
  system: 'from-slate-500/15 to-slate-50 text-slate-700 ring-slate-200/80',
}

export function LabourNotificationsPage() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('all')
  const [jobs, setJobs] = useState(loadJobDemoState)
  const [wallet, setWallet] = useState(readWalletState)
  const [tick, setTick] = useState(0)
  const [confirmOfferId, setConfirmOfferId] = useState(null)
  const [toast, setToast] = useState('')

  const kycOk = user?.labourProfile?.kycStatus === KYC_STATUS.VERIFIED

  useEffect(() => subscribeJobDemo(setJobs), [])
  useEffect(() => subscribeWallet(setWallet), [])
  useEffect(() => subscribeLabourNotifications(() => setTick((t) => t + 1)), [])

  const [serverNotifications, setServerNotifications] = useState([])

  useEffect(() => {
    if (!user || user.id === 'guest' || user._id === 'guest') return
    bookingReminderApi.getMyNotifications().then((res) => {
      if (res?.data?.notifications) {
        setServerNotifications(res.data.notifications)
      }
    }).catch(() => {})
  }, [user, tick])

  const earnings = useMemo(() => {
    const withdrawn = wallet.withdrawals.reduce((a, w) => a + w.amountPaise, 0)
    return buildEarningsGlance([], wallet.ratePaisePerMin, withdrawn)
  }, [wallet])

  const feed = useMemo(
    () => buildLabourNotifications(user, jobs, earnings),
    [user, jobs, earnings, tick],
  )

  const mergedItems = useMemo(() => {
    const serverItems = serverNotifications.map((sn) => ({
      id: sn._id,
      title: sn.title,
      body: sn.body,
      kind: 'system',
      read: sn.read,
      category: 'updates',
      time: sn.createdAt ? new Date(sn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
      href: sn.bookingId?._id || sn.bookingId ? `/app/active-job/${sn.bookingId?._id || sn.bookingId}` : undefined,
      isServer: true,
    }))
    return [...serverItems, ...feed.items]
  }, [serverNotifications, feed.items])

  const filtered = useMemo(() => {
    if (tab === 'jobs') return mergedItems.filter((n) => n.category === 'jobs')
    if (tab === 'updates') return mergedItems.filter((n) => n.category === 'updates')
    return mergedItems
  }, [mergedItems, tab])

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2800)
  }, [])

  const handleMarkAllRead = () => {
    bookingReminderApi.markAllNotificationsRead().catch(() => {})
    markNotificationsRead(feed.items.map((n) => n.id))
    setTick((t) => t + 1)
    showToast('All caught up — notifications marked read.')
  }

  const handleOpen = (n) => {
    if (n.isServer) {
      bookingReminderApi.markNotificationRead(n.id).catch(() => {})
    } else {
      markNotificationRead(n.id)
    }
    setTick((t) => t + 1)
    if (n.href && n.kind !== 'job_request') {
      navigate(n.href)
    }
  }

  const handleDismiss = (id, e) => {
    e?.stopPropagation()
    dismissNotification(id)
    setTick((t) => t + 1)
  }

  const handleAccept = (offerId) => {
    if (!kycOk) {
      showToast('Complete KYC before accepting jobs.')
      navigate('/app/kyc')
      return
    }
    setConfirmOfferId(offerId)
  }

  const confirmAccept = (offerId) => {
    const offer = jobs.offers.find((o) => o.id === offerId)
    if (!offer) return
    saveJobDemoState({
      ...jobs,
      offers: jobs.offers.filter((o) => o.id !== offerId),
      active: [...jobs.active, { ...offer, acceptedAt: nowIso() }],
    })
    markNotificationRead(`job:${offerId}`)
    setConfirmOfferId(null)
    setJobs(loadJobDemoState())
    setTick((t) => t + 1)
    showToast('Job accepted — see Active in My Jobs.')
  }

  const handleDecline = (offerId) => {
    saveJobDemoState({
      ...jobs,
      offers: jobs.offers.filter((o) => o.id !== offerId),
    })
    markNotificationRead(`job:${offerId}`)
    dismissNotification(`job:${offerId}`)
    setJobs(loadJobDemoState())
    setTick((t) => t + 1)
    showToast('Request removed from your list.')
  }

  return (
    <div className="-mx-4 min-h-[70vh] pb-6">
      <section className="relative overflow-hidden rounded-b-[2rem] bg-linear-to-br from-slate-900 via-slate-800 to-slate-950 px-4 pb-6 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
        <motion.div
          className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-brand/30 blur-3xl"
          animate={reduce ? undefined : { opacity: [0.3, 0.55, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
          aria-hidden
        />
        <div className="relative flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm transition hover:bg-white/20"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-brand-bright" aria-hidden />
              <h1 className="text-xl font-extrabold tracking-tight">Notifications</h1>
            </div>
            <p className="mt-1 text-sm text-white/75">Job requests, KYC & pay alerts</p>
          </div>
          {feed.unreadCount > 0 ? (
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-amber-400 px-2 text-xs font-black text-amber-950">
              {feed.unreadCount > 99 ? '99+' : feed.unreadCount}
            </span>
          ) : null}
        </div>

        <div className="relative mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Unread', value: String(feed.unreadCount) },
            { label: 'Job requests', value: String(feed.jobCount) },
            { label: 'Total', value: String(feed.items.length) },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/15 bg-white/10 px-2 py-2.5 text-center backdrop-blur-sm"
            >
              <p className="text-lg font-black tabular-nums">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">{s.label}</p>
            </div>
          ))}
        </div>

        {feed.unreadCount > 0 ? (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="relative mt-3 w-full rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"
          >
            Mark all as read
          </button>
        ) : null}
      </section>

      <motion.div className="space-y-4 px-4 pt-4">
        {toast ? (
          <p className="rounded-xl border border-brand/25 bg-brand/10 px-4 py-2 text-center text-sm font-semibold text-brand">
            {toast}
          </p>
        ) : null}

        <AppPillTabs items={TABS} value={tab} onChange={setTab} />

        {filtered.length === 0 ? (
          <AppEmptyState
            icon={Bell}
            title="No notifications here"
            subtitle={
              tab === 'jobs'
                ? 'New assignment requests will appear when admin or clients post jobs near you.'
                : 'KYC and pay updates show up in this tab.'
            }
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((n, i) => {
              const Icon = KIND_ICON[n.kind] || Bell
              const tone = KIND_TONE[n.kind] || KIND_TONE.system
              const offer = n.offerId ? jobs.offers.find((o) => o.id === n.offerId) : null

              return (
                <motion.li
                  key={n.id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <GlassPanel
                    className={`relative overflow-hidden border-2 p-4 transition ${
                      n.unread ? 'border-brand/30 bg-white shadow-md shadow-brand/5' : 'border-slate-200/90'
                    } ${n.priority === 'high' ? 'ring-1 ring-amber-200/60' : ''}`}
                  >
                    {n.unread ? (
                      <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_0_3px_rgba(0,43,92,0.25)]" />
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleDismiss(n.id)}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <div className="flex gap-3 pr-8">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ring-1 ${tone}`}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          {n.priority === 'high' ? <AppBadge variant="amber">Important</AppBadge> : null}
                          {n.kind === 'job_request' ? <AppBadge variant="brand">Job</AppBadge> : null}
                          {!n.unread ? (
                            <span className="text-[10px] font-bold uppercase text-slate-400">Read</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-extrabold text-slate-900">{n.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{n.body}</p>

                        {offer && n.meta?.shift ? (
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                            <Clock className="h-3.5 w-3.5 text-brand" aria-hidden />
                            {n.meta.shift}
                          </p>
                        ) : null}
                        {offer ? (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {offer.site}
                          </p>
                        ) : null}

                        {n.kind === 'job_request' && offer ? (
                          <div className="mt-4 space-y-2">
                            {confirmOfferId === offer.id ? (
                              <div className="rounded-xl border border-brand/20 bg-brand/5 p-3">
                                <p className="text-xs font-bold text-slate-900">Accept this assignment?</p>
                                <p className="mt-1 text-[11px] text-slate-600">
                                  You agree to report for {offer.trade} at {offer.site}.
                                </p>
                                <div className="mt-3 flex gap-2">
                                  <AppButton type="button" variant="secondary" onClick={() => setConfirmOfferId(null)}>
                                    Cancel
                                  </AppButton>
                                  <AppPrimaryButton
                                    type="button"
                                    className="flex-1 py-2.5 text-xs"
                                    onClick={() => confirmAccept(offer.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                                    Confirm
                                  </AppPrimaryButton>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <AppButton type="button" variant="secondary" onClick={() => handleDecline(offer.id)}>
                                  Decline
                                </AppButton>
                                <AppPrimaryButton
                                  type="button"
                                  className={`flex-1 py-2.5 text-xs ${!kycOk ? 'opacity-55' : ''}`}
                                  onClick={() => handleAccept(offer.id)}
                                >
                                  Accept job
                                </AppPrimaryButton>
                              </div>
                            )}
                          </div>
                        ) : n.href ? (
                          <button
                            type="button"
                            onClick={() => handleOpen(n)}
                            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand underline-offset-4 hover:underline"
                          >
                            {n.ctaLabel || 'Open'}
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => markNotificationRead(n.id)}
                            className="mt-3 text-xs font-bold text-slate-500 hover:text-slate-800"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </GlassPanel>
                </motion.li>
              )
            })}
          </ul>
        )}

        <GlassPanel className="border-dashed border-slate-300/90 p-4 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-brand" aria-hidden />
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Demo alerts on this device. Production will push real-time job offers and admin messages.
          </p>
          <Link
            to="/app/jobs"
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand underline-offset-4 hover:underline"
          >
            Open full jobs list
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </GlassPanel>
      </motion.div>
    </div>
  )
}
