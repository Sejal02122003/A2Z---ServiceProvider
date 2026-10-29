import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  HardHat,
  Headphones,
  LifeBuoy,
  Mail,
  Menu,
  MessageSquare,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { ROLE_LABELS, USER_ROLES } from '../../constants/userRoles.js'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { AppSectionHeader } from '../../components/app-ui/layout/AppSectionHeader.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { complaintsApi } from '../../api/complaintsApi.js'

const TOPICS_BY_ROLE = {
  [USER_ROLES.CUSTOMER]: [
    { id: 'booking', label: 'Booking & service providers', desc: 'No-show, wrong trade, schedule' },
    { id: 'pricing', label: 'Pricing & estimates', desc: 'Quotes, add-ons, transparency' },
    { id: 'site', label: 'Site & safety', desc: 'Access, PPE, unsafe conditions' },
    { id: 'payment', label: 'Payments', desc: 'Refunds, charges, receipts' },
  ],
  [USER_ROLES.CONTRACTOR]: [
    { id: 'bulk', label: 'Bulk deployment', desc: 'Headcount, mobilisation, queue' },
    { id: 'billing', label: 'Billing & GST', desc: 'Invoices, milestones, postpaid' },
    { id: 'contract', label: 'Contracts', desc: 'Terms, SLAs, rate cards' },
  ],
  [USER_ROLES.LABOUR]: [
    { id: 'payout', label: 'Payouts & wages', desc: 'Delays, deductions, withdrawals' },
    { id: 'safety', label: 'Site safety', desc: 'Unsafe work, incidents' },
    { id: 'kyc', label: 'KYC & profile', desc: 'Verification, skills, documents' },
  ],
}

const TOPIC_ICONS = {
  booking: CalendarClock,
  pricing: Banknote,
  site: Shield,
  payment: Wallet,
  bulk: Users,
  billing: Banknote,
  contract: FileText,
  attendance: ClipboardList,
  payout: Wallet,
  safety: Shield,
  kyc: FileText,
  supply: ClipboardList,
  workforce: HardHat,
  client: Building2,
}

const WORKFLOW_STEPS = [
  { id: 'received', label: 'Received', short: 'In queue' },
  { id: 'triaged', label: 'Triaged', short: 'Priority set' },
  { id: 'assigned', label: 'Assigned', short: 'Owner' },
  { id: 'resolution', label: 'Resolution', short: 'Fix in progress' },
  { id: 'closed', label: 'Closed', short: 'Done' },
]

function openAppDrawer() {
  window.dispatchEvent(new Event('lc-open-app-drawer'))
}

function supportIntro(role) {
  if (role === USER_ROLES.CONTRACTOR) {
    return {
      title: 'Enterprise support',
      subtitle: 'Bulk deployment, billing, and contract escalations.',
      body: 'Tickets route to admin operations with your contractor account context.',
    }
  }
  if (role === USER_ROLES.LABOUR) {
    return {
      title: 'Service provider support',
      subtitle: 'Payouts, safety, and KYC help.',
      body: 'Same standards as the dedicated Service Provider channel — we respond by severity.',
    }
  }
  if (role === USER_ROLES.CONTRACTOR) {
    return {
      title: 'Vendor support',
      subtitle: 'Supply, workforce, and client coordination.',
      body: 'Aligned with admin-controlled allocation and deployment workflows.',
    }
  }
  return {
    title: 'Help & issues',
    subtitle: 'Booking, pricing, site, or payment concerns.',
    body: 'Your message joins the admin queue for triage. Ticket IDs and replies ship with the API.',
  }
}

function SupportScreenHeader({ title, subtitle }) {
  return (
    <div className="pb-1">
      <div className="flex items-start gap-2 sm:gap-3">
        <Link
          to="/app"
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-800 shadow-sm transition hover:border-brand/35 hover:text-brand"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">Support</p>
          <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-900">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600 sm:text-sm">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openAppDrawer}
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-700 shadow-sm transition hover:border-brand/35 hover:text-brand"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function SupportWorkflowTimeline() {
  return (
    <GlassPanel className="border-slate-200/90 p-4 ring-1 ring-slate-100/90">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-brand" aria-hidden />
        <p className="text-sm font-extrabold text-slate-900">What happens next</p>
      </div>
      <ol className="mt-4 space-y-0">
        {WORKFLOW_STEPS.map((step, i) => {
          const active = i === 0
          const upcoming = i > 0
          return (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < WORKFLOW_STEPS.length - 1 ? (
                <span
                  className={`absolute left-[0.65rem] top-7 h-[calc(100%-0.25rem)] w-px ${
                    active ? 'bg-brand/40' : 'bg-slate-200'
                  }`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ring-2 ring-white ${
                  active
                    ? 'bg-brand text-white shadow-md shadow-brand/30'
                    : upcoming
                      ? 'bg-slate-100 text-slate-400 ring-slate-100'
                      : 'bg-blue-600 text-white'
                }`}
              >
                {active ? i + 1 : upcoming ? '' : <CheckCircle2 className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={`text-sm font-bold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</p>
                <p className="text-[11px] text-slate-500">{step.short}</p>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 ring-1 ring-slate-100">
        SLA targets and in-app status updates appear once ticketing is connected.
      </p>
    </GlassPanel>
  )
}

function TopicChip({ topic, active, onSelect, reduce, index }) {
  const Icon = TOPIC_ICONS[topic.id] ?? MessageSquare
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex w-full min-w-0 flex-col rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.98] ${
        active
          ? 'border-brand/45 bg-linear-to-br from-brand/12 via-white to-blue-50/40 shadow-[0_12px_28px_-18px_rgba(0,43,92,0.45)] ring-2 ring-brand/20'
          : 'border-slate-200/90 bg-white hover:border-brand/25 hover:shadow-md'
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          active ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600'
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <p className="mt-2 text-sm font-bold text-slate-900">{topic.label}</p>
      <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-slate-500">{topic.desc}</p>
    </motion.button>
  )
}

function QuickLinkCard({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm transition hover:border-brand/30 hover:shadow-md active:scale-[0.99]"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/15">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="truncate text-sm font-bold text-slate-800">{label}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand" aria-hidden />
    </Link>
  )
}

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</label>
  )
}

export function AppSupportPage() {
  const { user } = useAuth()
  const role = user?.role ?? USER_ROLES.CUSTOMER
  const reduce = useReducedMotion()
  const intro = supportIntro(role)
  const topics = TOPICS_BY_ROLE[role] ?? TOPICS_BY_ROLE[USER_ROLES.CUSTOMER]

  const [topicId, setTopicId] = useState(topics[0]?.id ?? 'booking')
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [activeTab, setActiveTab] = useState('new') // 'new' | 'history'
  const [myComplaints, setMyComplaints] = useState(null) // null = not yet loaded
  const [complaintsLoading, setComplaintsLoading] = useState(false)

  const loadMyComplaints = async () => {
    if (complaintsLoading) return
    setComplaintsLoading(true)
    try {
      const res = await complaintsApi.getMyComplaints()
      setMyComplaints(res.data?.complaints ?? res.data?.items ?? [])
    } catch {
      setMyComplaints([])
    } finally {
      setComplaintsLoading(false)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (tab === 'history' && myComplaints === null) loadMyComplaints()
  }

  const topicMeta = useMemo(() => topics.find((t) => t.id === topicId) ?? topics[0], [topics, topicId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !details.trim()) return
    setFormError('')
    setSubmitting(true)
    try {
      await complaintsApi.submitComplaint({
        title: subject.trim(),
        description: details.trim(),
      })
      setSent(true)
      // refresh history if it was loaded
      if (myComplaints !== null) loadMyComplaints()
    } catch (err) {
      setFormError(err?.message || 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const RoleIcon =
    role === USER_ROLES.CONTRACTOR
      ? Building2
      : role === USER_ROLES.LABOUR
        ? HardHat
        : role === USER_ROLES.CONTRACTOR
          ? ClipboardList
          : Sparkles

  const quickLinks = useMemo(() => {
    const links = []
    if (role === USER_ROLES.LABOUR) {
      links.push({ to: '/app/jobs', icon: HardHat, label: 'Jobs & assignments' })
      links.push({ to: '/app/earnings', icon: Banknote, label: 'Earnings & payouts' })
    } else {
      links.push({ to: '/app/bookings', icon: CalendarClock, label: 'Bookings & requests' })
    }
    if (role === USER_ROLES.CONTRACTOR) {
      links.push({ to: '/app/billing', icon: Banknote, label: 'Billing & contracts' })
    }
    if (role === USER_ROLES.CONTRACTOR) {
      links.push({ to: '/app/workforce', icon: ClipboardList, label: 'Workforce' })
    }
    links.push({ to: '/app/profile', icon: FileText, label: 'Profile & account' })
    return links
  }, [role])

  return (
    <motion.div
      className="w-full min-w-0 max-w-full space-y-5 overflow-x-hidden bg-linear-to-b from-slate-50/95 via-white to-blue-50/15 pb-28 pt-1"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <SupportScreenHeader title={intro.title} subtitle={intro.subtitle} />

      <motion.section
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-linear-to-br from-slate-900 via-slate-900 to-brand/90 px-4 py-5 text-white shadow-[0_24px_56px_-28px_rgba(15,23,42,0.55)] ring-1 ring-slate-800/20"
      >
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-brand/40 blur-2xl" />
        </div>
        <div className="relative flex gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
            <LifeBuoy className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200/90">We&apos;re here to help</p>
            <p className="mt-2 text-sm leading-relaxed text-white/85">{intro.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold ring-1 ring-white/15">
                <RoleIcon className="h-3.5 w-3.5" aria-hidden />
                {ROLE_LABELS[role] || 'Account'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold ring-1 ring-white/15">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-200" aria-hidden />
                Role-based routing
              </span>
            </div>
          </div>
        </div>
      </motion.section>

      <SupportWorkflowTimeline />

      <section className="min-w-0">
        <AppSectionHeader title="Choose a topic" className="mb-3 px-0.5" />
        <div className="grid grid-cols-2 gap-2.5">
          {topics.map((t, idx) => (
            <TopicChip
              key={t.id}
              topic={t}
              active={topicId === t.id}
              onSelect={() => setTopicId(t.id)}
              reduce={reduce}
              index={idx}
            />
          ))}
        </div>
      </section>

      <motion.section
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.06 }}
      >
        <GlassPanel className="overflow-hidden border-slate-200/90 ring-1 ring-slate-100/90">
          {/* Panel header + tabs */}
          <div className="border-b border-slate-100 bg-linear-to-r from-brand/8 via-white to-white px-4 pb-0 pt-3.5">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-brand" aria-hidden />
              <h2 className="text-base font-extrabold text-slate-900">Complaints</h2>
            </div>
            {/* Tabs */}
            <div className="mt-3 flex gap-0 border-b border-slate-100">
              {[{ id: 'new', label: 'New complaint' }, { id: 'history', label: 'My complaints' }].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative px-3 pb-2.5 pt-1 text-xs font-bold transition ${
                    activeTab === tab.id
                      ? 'text-brand after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-brand after:content-[\'\']'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <AnimatePresence mode="wait">

              {/* ── NEW COMPLAINT TAB ── */}
              {activeTab === 'new' ? (
                <motion.div key="new-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {sent ? (
                    <motion.div
                      key="success"
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-blue-200/80 bg-linear-to-br from-blue-50 to-white p-4 ring-1 ring-blue-100"
                    >
                      <div className="flex gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <CheckCircle2 className="h-6 w-6" aria-hidden />
                        </span>
                        <div>
                          <p className="text-sm font-black text-slate-900">Complaint submitted!</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">
                            Your ticket is in the admin queue. You can track it under "My complaints".
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setSent(false)
                              setSubject('')
                              setDetails('')
                              setFormError('')
                            }}
                            className="mt-3 text-xs font-bold text-brand underline-offset-4 hover:underline"
                          >
                            Submit another
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      onSubmit={handleSubmit}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {/* Topic info */}
                      <p className="text-xs text-slate-500">
                        Topic: <span className="font-bold text-brand">{topicMeta?.label}</span> — add booking refs, dates, or site names when you can.
                      </p>
                      <div>
                        <FieldLabel>Subject</FieldLabel>
                        <input
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Short summary of the problem"
                          required
                          className="w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
                        />
                      </div>
                      <div>
                        <FieldLabel>Details</FieldLabel>
                        <textarea
                          value={details}
                          onChange={(e) => setDetails(e.target.value)}
                          required
                          rows={4}
                          placeholder="What happened? What did you expect?"
                          className="w-full resize-none rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
                        />
                      </div>
                      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5">
                        <p className="flex items-start gap-2 text-xs text-amber-950">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span>
                            <span className="font-bold">Urgent safety issue?</span> Call your supervisor and emergency
                            services if anyone is at risk.
                          </span>
                        </p>
                      </div>
                      {formError ? (
                        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{formError}</p>
                      ) : null}
                      <AppPrimaryButton type="submit" className="w-full py-3.5 text-[15px]" disabled={submitting}>
                        {submitting ? 'Submitting…' : 'Submit complaint'}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </AppPrimaryButton>
                    </motion.form>
                  )}
                </motion.div>
              ) : null}

              {/* ── HISTORY TAB ── */}
              {activeTab === 'history' ? (
                <motion.div key="history-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  {complaintsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand" />
                      Loading…
                    </div>
                  ) : !myComplaints?.length ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <MessageSquare className="h-6 w-6" aria-hidden />
                      </span>
                      <p className="text-sm font-bold text-slate-600">No complaints yet</p>
                      <p className="text-xs text-slate-400">Past tickets will appear here.</p>
                    </div>
                  ) : (
                    myComplaints.map((c) => {
                      const statusColor =
                        c.status === 'RESOLVED'
                          ? 'bg-blue-100 text-blue-700'
                          : c.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                      return (
                        <div
                          key={c._id}
                          className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="flex-1 text-sm font-bold text-slate-900 leading-snug">{c.title}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>
                              {c.status ?? 'OPEN'}
                            </span>
                          </div>
                          {c.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.description}</p>
                          ) : null}
                          {c.adminRemarks ? (
                            <p className="mt-2 rounded-xl bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                              <span className="font-bold text-brand">Admin: </span>{c.adminRemarks}
                            </p>
                          ) : null}
                          <p className="mt-2 text-[10px] text-slate-400">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          </p>
                        </div>
                      )
                    })
                  )}
                  <button
                    type="button"
                    onClick={loadMyComplaints}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 transition hover:border-brand/25 hover:text-brand"
                  >
                    Refresh
                  </button>
                </motion.div>
              ) : null}

            </AnimatePresence>
          </div>
        </GlassPanel>
      </motion.section>

      <section>
        <AppSectionHeader title="Other ways to reach us" className="mb-3 px-0.5" />
        <div className="grid gap-3 sm:grid-cols-2">
          <a href="tel:+917610125193" className="block transition hover:scale-[1.02] active:scale-[0.98]">
            <GlassPanel className="h-full border-slate-200/90 p-4 ring-1 ring-slate-100/90">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                <Phone className="h-5 w-5" aria-hidden />
              </div>
              <p className="mt-3 text-sm font-extrabold text-slate-900">Phone helpline</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Tap to call our customer support directly.
              </p>
            </GlassPanel>
          </a>
          <a href="mailto:rahulbairwa7610@gmail.com" className="block transition hover:scale-[1.02] active:scale-[0.98]">
            <GlassPanel className="h-full border-slate-200/90 p-4 ring-1 ring-slate-100/90">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                <Mail className="h-5 w-5" aria-hidden />
              </div>
              <p className="mt-3 text-sm font-extrabold text-slate-900">Email support</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Tap to email our dedicated support team.
              </p>
            </GlassPanel>
          </a>
        </div>
      </section>

      <section>
        <AppSectionHeader title="Quick links" className="mb-3 px-0.5" />
        <ul className="space-y-2">
          {quickLinks.map((link) => (
            <li key={link.to}>
              <QuickLinkCard to={link.to} icon={link.icon} label={link.label} />
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-center justify-center gap-2 pb-2 text-center text-[11px] font-medium text-slate-400">
        <Headphones className="h-3.5 w-3.5" aria-hidden />
        In-app chat & attachments — next phase
      </p>
    </motion.div>
  )
}
