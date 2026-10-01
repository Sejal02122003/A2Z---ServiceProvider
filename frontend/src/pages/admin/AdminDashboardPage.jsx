import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowUpRight,
  BarChart3,
  ClipboardList,
  Layers,
  Shield,
  Users,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { ADMIN_NAV_SECTIONS } from '../../config/adminNavigation.js'
import { apiRequest } from '../../api/http.js'

export function AdminDashboardPage() {
  const reduce = useReducedMotion()
  
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiRequest('/admin/dashboard/stats')
        setStats(res.data)
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const flatLinks = ADMIN_NAV_SECTIONS.flatMap((s) =>
    s.items.filter((i) => i.to !== '/admin').map((i) => ({ ...i, section: s.title })),
  ).slice(0, 6)

  const QUICK_STATS = [
    { 
      label: 'Active bookings', 
      value: stats?.bookings?.active ?? '—', 
      hint: 'Currently in progress', 
      icon: ClipboardList, 
      tone: 'from-brand/20 to-blue-50' 
    },
    { 
      label: 'Workers on roster', 
      value: stats?.users?.labourers ?? '—', 
      hint: 'Registered workforce', 
      icon: Users, 
      tone: 'from-sky-500/15 to-slate-50' 
    },
    { 
      label: 'Contractor accounts', 
      value: stats?.users?.contractors ?? '—', 
      hint: 'B2B Partners', 
      icon: Shield, 
      tone: 'from-violet-500/15 to-slate-50' 
    },
    { 
      label: 'Skill categories', 
      value: stats?.system?.categories ?? '—', 
      hint: 'Platform managed', 
      icon: Layers, 
      tone: 'from-amber-500/15 to-amber-50/50' 
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Control centre</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
          Super panel for A2Z — users, workforce, bookings, allocation, attendance, billing, and analytics per
          your Work Scope. Use the sidebar to jump into each module.
        </p>
      </motion.div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
             <GlassPanel key={i} className="h-28 flex items-center justify-center p-5 bg-slate-50/50 animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
             </GlassPanel>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 * i }}
            >
              <GlassPanel className={`relative h-full overflow-hidden p-5 bg-linear-to-br ${s.tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                    <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{s.value}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">{s.hint}</p>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-slate-700 shadow-sm ring-1 ring-slate-200/80">
                    <s.icon className="h-5 w-5" aria-hidden />
                  </span>
                </div>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <GlassPanel className="p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-900">Shortcuts</h2>
            <BarChart3 className="h-5 w-5 text-slate-300" aria-hidden />
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {flatLinks.map(({ to, label, icon: Icon, section }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="group flex items-center justify-between gap-3 py-3.5 transition hover:bg-slate-50/80"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand ring-1 ring-brand/15">
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{label}</span>
                      {section ? <span className="text-xs text-slate-500">{section}</span> : null}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
                </Link>
              </li>
            ))}
          </ul>
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="h-fit p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Action Required</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              There are currently <span className="font-bold text-brand">{stats?.actionable?.openComplaints || 0}</span> open complaints and <span className="font-bold text-brand">{stats?.actionable?.pendingWithdrawals || 0}</span> pending withdrawal requests.
            </p>
            <div className="flex flex-col gap-2 mt-5">
              <Link
                to="/admin/complaints"
                className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline"
              >
                View complaints
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                to="/admin/labour-wallet"
                className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline"
              >
                View withdrawal requests
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </GlassPanel>

          <GlassPanel className="h-fit p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Today</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Operational queues (contractor approvals, KYC, FCFS bookings) will surface here.
            </p>
            <Link
              to="/admin/labour"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline"
            >
              Open workforce requests
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}
