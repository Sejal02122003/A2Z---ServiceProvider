import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Wallet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Percent,
  IndianRupee,
  Lock,
  RefreshCw,
  Search,
  Filter,
  Save,
  Clock,
  History,
  Users,
  Sliders,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileText,
} from 'lucide-react'
import { walletEligibilityApi } from '../../api/walletEligibilityApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'

function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminWalletEligibilityPage() {
  const reduce = useReducedMotion()
  const [activeTab, setActiveTab] = useState('settings') // 'settings' | 'providers' | 'transactions'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ message: '', variant: 'success' })

  // Settings State
  const [settings, setSettings] = useState({
    minimumWalletBalance: 300,
    commissionPercentage: 25,
    eligibilitySystemEnabled: true,
    commissionReservationEnabled: true,
    updatedBy: null,
    updatedAt: null,
    auditLog: [],
  })

  // Edit form state
  const [minBalanceInput, setMinBalanceInput] = useState('300')
  const [commissionInput, setCommissionInput] = useState('25')
  const [eligibilityEnabled, setEligibilityEnabled] = useState(true)
  const [reservationEnabled, setReservationEnabled] = useState(true)

  // Simulation preview state
  const [simBookingAmount, setSimBookingAmount] = useState('1000')

  // Providers Report State
  const [providers, setProviders] = useState([])
  const [providersLoading, setProvidersLoading] = useState(false)
  const [providerSearch, setProviderSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState('all') // all, eligible, low_balance, pending_reservations
  const [providerPage, setProviderPage] = useState(1)
  const [providerTotalPages, setProviderTotalPages] = useState(1)
  const [providerTotalCount, setProviderTotalCount] = useState(0)

  // Transactions State
  const [transactions, setTransactions] = useState([])
  const [txLoading, setTxLoading] = useState(false)
  const [txSearch, setTxSearch] = useState('')
  const [txContext, setTxContext] = useState('ALL')
  const [txPage, setTxPage] = useState(1)
  const [txTotalPages, setTxTotalPages] = useState(1)

  const showToast = useCallback((message, variant = 'success') => {
    setToast({ message, variant })
    setTimeout(() => setToast({ message: '', variant: 'success' }), 4000)
  }, [])

  // Load Settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await walletEligibilityApi.getAdminSettings()
      const s = res?.data?.settings || {}
      setSettings(s)
      setMinBalanceInput(String(s.minimumWalletBalance ?? 300))
      setCommissionInput(String(s.commissionPercentage ?? 25))
      setEligibilityEnabled(Boolean(s.eligibilitySystemEnabled ?? true))
      setReservationEnabled(Boolean(s.commissionReservationEnabled ?? true))
    } catch (err) {
      console.error('Failed to load wallet eligibility settings:', err)
      showToast('Failed to load eligibility settings', 'error')
    }
  }, [showToast])

  // Load Providers Report
  const loadProviders = useCallback(async () => {
    setProvidersLoading(true)
    try {
      const res = await walletEligibilityApi.getProvidersReport({
        search: providerSearch,
        filter: providerFilter,
        page: providerPage,
        limit: 15,
      })
      setProviders(res?.data?.providers || [])
      setProviderTotalPages(res?.data?.pagination?.pages || 1)
      setProviderTotalCount(res?.data?.pagination?.total || 0)
    } catch (err) {
      console.error('Failed to load provider eligibility report:', err)
    } finally {
      setProvidersLoading(false)
    }
  }, [providerSearch, providerFilter, providerPage])

  // Load Transactions
  const loadTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      const res = await walletEligibilityApi.getEligibilityTransactions({
        search: txSearch,
        context: txContext,
        page: txPage,
        limit: 15,
      })
      setTransactions(res?.data?.transactions || [])
      setTxTotalPages(res?.data?.pagination?.pages || 1)
    } catch (err) {
      console.error('Failed to load eligibility transactions:', err)
    } finally {
      setTxLoading(false)
    }
  }, [txSearch, txContext, txPage])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadSettings().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [loadSettings])

  useEffect(() => {
    if (activeTab === 'providers') {
      loadProviders()
    } else if (activeTab === 'transactions') {
      loadTransactions()
    }
  }, [activeTab, loadProviders, loadTransactions])

  // Save Settings Handler
  const handleSaveSettings = async (e) => {
    e?.preventDefault()
    const minBal = Number(minBalanceInput)
    if (isNaN(minBal) || minBal < 0) {
      showToast('Minimum wallet balance must be greater than or equal to 0', 'error')
      return
    }

    const comm = Number(commissionInput)
    if (isNaN(comm) || comm < 0 || comm > 100) {
      showToast('Commission percentage must be between 0 and 100', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await walletEligibilityApi.updateAdminSettings({
        minimumWalletBalance: minBal,
        commissionPercentage: comm,
        eligibilitySystemEnabled: eligibilityEnabled,
        commissionReservationEnabled: reservationEnabled,
        reason: 'Updated via Admin Wallet Eligibility Settings Panel',
      })
      const s = res?.data?.settings || {}
      setSettings(s)
      showToast('Wallet eligibility configuration saved successfully!')
      if (activeTab === 'providers') loadProviders()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save settings'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Interactive Sandbox Calculation
  const simAmountNum = Math.max(0, Number(simBookingAmount || 0))
  const simCommPercent = Math.max(0, Math.min(100, Number(commissionInput || 0)))
  const simMinBal = Math.max(0, Number(minBalanceInput || 0))
  const simCommission = Math.round((simAmountNum * simCommPercent) / 100)
  const simRequired = simMinBal + simCommission

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {toast.message ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`fixed left-4 right-4 top-20 z-50 mx-auto flex max-w-lg items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur-md ${
            toast.variant === 'error'
              ? 'border-rose-200 bg-rose-50/95 text-rose-900'
              : 'border-emerald-200 bg-emerald-50/95 text-emerald-900'
          }`}
        >
          {toast.variant === 'error' ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          )}
          {toast.message}
        </motion.div>
      ) : null}

      {/* Header Banner */}
      <GlassPanel className="relative overflow-hidden border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/20 text-brand-bright ring-1 ring-brand/40">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <span className="rounded-full bg-brand/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-bright">
                  Core Finance Architecture
                </span>
                <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                  Dynamic Minimum Wallet Balance & Booking Eligibility
                </h1>
              </div>
            </div>
            <p className="max-w-2xl text-xs text-slate-300">
              Configure minimum wallet thresholds, dynamic booking commission percentages, and atomic fund reservations required for service providers to accept new bookings.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadSettings()
                if (activeTab === 'providers') loadProviders()
                if (activeTab === 'transactions') loadTransactions()
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-white/20 active:scale-95"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Min Wallet Balance</p>
            <p className="mt-1 font-mono text-xl font-black text-white">{formatInr(settings.minimumWalletBalance)}</p>
            <p className="text-[10px] text-emerald-400">Guaranteed safety buffer</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Commission Rate</p>
            <p className="mt-1 font-mono text-xl font-black text-white">{settings.commissionPercentage}%</p>
            <p className="text-[10px] text-brand-bright">Applied to bookings</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Eligibility System</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  settings.eligibilitySystemEnabled ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-500'
                }`}
              />
              <span className="text-sm font-black text-white">
                {settings.eligibilitySystemEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Authoritative enforcement</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Commission Hold</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  settings.commissionReservationEnabled ? 'bg-blue-400 shadow-[0_0_8px_#60a5fa]' : 'bg-slate-500'
                }`}
              />
              <span className="text-sm font-black text-white">
                {settings.commissionReservationEnabled ? 'Active' : 'Off'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Atomic balance reservation</p>
          </div>
        </div>
      </GlassPanel>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-extrabold transition ${
            activeTab === 'settings'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Wallet Eligibility Settings
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('providers')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-extrabold transition ${
            activeTab === 'providers'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          Provider Eligibility Report
          {providerTotalCount > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {providerTotalCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-extrabold transition ${
            activeTab === 'transactions'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="h-4 w-4" />
          Reservation & Settlement Ledger
        </button>
      </div>

      {/* TAB 1: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Configuration Card */}
          <div className="space-y-6 lg:col-span-2">
            <GlassPanel className="p-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-black text-slate-900">Configurable Rules & Thresholds</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Update database-backed minimum thresholds and commission deductions. Changes take effect immediately for all new booking checks.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="mt-5 space-y-5">
                {/* 1. Minimum Wallet Balance */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      1. Minimum Wallet Balance (₹)
                    </label>
                    <span className="text-xs font-semibold text-slate-400">Default: ₹300</span>
                  </div>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 font-bold">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={minBalanceInput}
                      onChange={(e) => setMinBalanceInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-4 font-mono text-sm font-bold text-slate-900 shadow-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      placeholder="300"
                      required
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                    The baseline wallet balance every service provider must maintain before factoring in booking commission.
                  </p>
                </div>

                {/* 2. Commission Percentage */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      2. Booking Commission Percentage (%)
                    </label>
                    <span className="text-xs font-semibold text-slate-400">Default: 25%</span>
                  </div>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 font-bold">
                      %
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={commissionInput}
                      onChange={(e) => setCommissionInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 font-mono text-sm font-bold text-slate-900 shadow-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      placeholder="25"
                      required
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                    Percentage deducted from booking amount. Validated between 0% and 100%. Snapshotted per accepted booking.
                  </p>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                  {/* Eligibility System Toggle */}
                  <div className="flex items-start justify-between rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
                    <div className="space-y-1 pr-3">
                      <p className="text-xs font-black text-slate-900">3. Wallet Eligibility System</p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Enforce balance requirement for accepting new bookings.
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center shrink-0">
                      <input
                        type="checkbox"
                        checked={eligibilityEnabled}
                        onChange={(e) => setEligibilityEnabled(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-brand peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-['']" />
                    </label>
                  </div>

                  {/* Commission Reservation Toggle */}
                  <div className="flex items-start justify-between rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
                    <div className="space-y-1 pr-3">
                      <p className="text-xs font-black text-slate-900">4. Commission Reservation</p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Reserve estimated commission atomically on acceptance.
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center shrink-0">
                      <input
                        type="checkbox"
                        checked={reservationEnabled}
                        onChange={(e) => setReservationEnabled(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-['']" />
                    </label>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-brand/25 transition hover:brightness-105 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Configuration
                      </>
                    )}
                  </button>
                </div>
              </form>
            </GlassPanel>

            {/* Audit Log / History */}
            <GlassPanel className="p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-black text-slate-900">Configuration Change Audit Trail</h3>
                </div>
                <span className="text-xs text-slate-400">
                  {settings.auditLog?.length || 0} change event(s) recorded
                </span>
              </div>

              <div className="mt-4 divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {settings.auditLog && settings.auditLog.length > 0 ? (
                  settings.auditLog.slice().reverse().map((entry, idx) => (
                    <div key={idx} className="py-3 text-xs flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-800">{entry.reason || 'Configuration updated'}</p>
                        <p className="text-[11px] text-slate-400">
                          Min Balance: ₹{entry.newValues?.minimumWalletBalance ?? '—'} · Commission: {entry.newValues?.commissionPercentage ?? '—'}%
                        </p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {formatDate(entry.changedAt || entry.timestamp)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-xs text-slate-400">No previous configuration changes logged.</p>
                )}
              </div>
            </GlassPanel>
          </div>

          {/* Right Sidebar: Effective Configuration & Formula Sandbox */}
          <div className="space-y-6">
            {/* Effective Configuration Card */}
            <GlassPanel className="border-brand/20 bg-gradient-to-br from-white to-brand-50/20 p-5 shadow-md">
              <div className="flex items-center gap-2 text-brand">
                <ShieldCheck className="h-5 w-5" />
                <h3 className="text-sm font-black text-slate-900">5. Effective Configuration</h3>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                  <span className="text-slate-500">Active Min Balance:</span>
                  <span className="font-mono font-bold text-slate-900">{formatInr(settings.minimumWalletBalance)}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                  <span className="text-slate-500">Active Commission:</span>
                  <span className="font-mono font-bold text-slate-900">{settings.commissionPercentage}%</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                  <span className="text-slate-500">Eligibility System:</span>
                  <span
                    className={`font-bold ${
                      settings.eligibilitySystemEnabled ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  >
                    {settings.eligibilitySystemEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                  <span className="text-slate-500">Commission Reservation:</span>
                  <span
                    className={`font-bold ${
                      settings.commissionReservationEnabled ? 'text-blue-600' : 'text-slate-500'
                    }`}
                  >
                    {settings.commissionReservationEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                  <span className="text-slate-500">Last Updated By:</span>
                  <span className="font-semibold text-slate-800">
                    {settings.updatedBy?.fullName || settings.updatedBy?.email || 'Super Admin'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Last Modified:</span>
                  <span className="font-mono text-[11px] text-slate-600">{formatDate(settings.updatedAt)}</span>
                </div>
              </div>
            </GlassPanel>

            {/* Formula & Calculation Sandbox */}
            <GlassPanel className="p-5">
              <div className="flex items-center gap-2 text-slate-800">
                <HelpCircle className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-black">Calculation Formula Sandbox</h3>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200/90 bg-slate-50 p-3 font-mono text-[11px] text-slate-700 leading-relaxed space-y-1">
                <p>Commission = Amount × (Comm% / 100)</p>
                <p>Required = MinBalance + Commission</p>
                <p>Available = WalletBalance - Reserved</p>
                <p className="font-bold text-brand">Eligible: Available &gt;= Required</p>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Simulate Booking Amount (₹):</label>
                  <input
                    type="number"
                    min="1"
                    value={simBookingAmount}
                    onChange={(e) => setSimBookingAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900"
                    placeholder="1000"
                  />
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs space-y-1.5 font-medium text-slate-700">
                  <div className="flex justify-between">
                    <span>Booking Commission ({simCommPercent}%):</span>
                    <span className="font-mono font-bold text-slate-900">{formatInr(simCommission)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Minimum Required Balance:</span>
                    <span className="font-mono font-bold text-slate-900">{formatInr(simMinBal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-blue-200/60 pt-1.5 font-bold text-blue-900">
                    <span>Total Required to Accept:</span>
                    <span className="font-mono text-sm">{formatInr(simRequired)}</span>
                  </div>
                </div>
              </div>
            </GlassPanel>
          </div>
        </div>
      )}

      {/* TAB 2: PROVIDERS REPORT */}
      {activeTab === 'providers' && (
        <GlassPanel className="p-6 space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">Service Provider Eligibility Audit Table</h2>
              <p className="text-xs text-slate-500">
                Authoritative overview of provider wallets, reserved funds, available balances, and current booking acceptance eligibility.
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all', label: 'All Providers' },
                { key: 'eligible', label: 'Eligible (Pass)' },
                { key: 'low_balance', label: 'Low Balance (Blocked)' },
                { key: 'pending_reservations', label: 'With Active Holds' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setProviderFilter(f.key)
                    setProviderPage(1)
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                    providerFilter === f.key
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 left-0 ml-3.5 h-4 w-4 text-slate-400 self-center" />
            <input
              type="text"
              value={providerSearch}
              onChange={(e) => {
                setProviderSearch(e.target.value)
                setProviderPage(1)
              }}
              placeholder="Search provider by name, phone or email..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 shadow-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {/* Providers Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-3">Wallet Balance</th>
                  <th className="py-3 px-3">Reserved Holds</th>
                  <th className="py-3 px-3">Available Balance</th>
                  <th className="py-3 px-3">Min Required</th>
                  <th className="py-3 px-3">Eligibility Status</th>
                  <th className="py-3 px-3">Active Holds</th>
                  <th className="py-3 px-3">Last Recharge</th>
                  <th className="py-3 px-4">Total Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {providersLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand" />
                      <p className="mt-2 text-xs">Loading provider records...</p>
                    </td>
                  </tr>
                ) : providers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No service providers found matching current filters.
                    </td>
                  </tr>
                ) : (
                  providers.map((p) => {
                    const isEligible = p.eligibilityStatus === 'ELIGIBLE'
                    return (
                      <tr key={p.providerId} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4">
                          <p className="font-extrabold text-slate-900">{p.providerName}</p>
                          <p className="text-[11px] text-slate-400">{p.phone}</p>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                          {formatInr(p.walletBalance)}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-amber-600 font-bold">
                          {p.reservedAmount > 0 ? formatInr(p.reservedAmount) : '₹0'}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-black text-emerald-700">
                          {formatInr(p.availableBalance)}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-500">
                          {formatInr(p.minimumRequiredBalance)}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                              isEligible
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isEligible ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {isEligible ? 'Eligible' : 'Low Balance'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono">
                          {p.pendingReservationsCount > 0 ? (
                            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                              {p.pendingReservationsCount} pending
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {p.lastRechargeAmount ? (
                            <div>
                              <p className="font-mono font-bold text-slate-800">{formatInr(p.lastRechargeAmount)}</p>
                              <p className="text-[10px] text-slate-400">{formatDate(p.lastRechargeDate)}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {formatInr(p.totalCommissionCollected)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {providerTotalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
              <p>
                Page {providerPage} of {providerTotalPages} ({providerTotalCount} total providers)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={providerPage <= 1}
                  onClick={() => setProviderPage((p) => p - 1)}
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={providerPage >= providerTotalPages}
                  onClick={() => setProviderPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </GlassPanel>
      )}

      {/* TAB 3: RESERVATION & SETTLEMENT LEDGER */}
      {activeTab === 'transactions' && (
        <GlassPanel className="p-6 space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">Reservation & Settlement Ledger Audit</h2>
              <p className="text-xs text-slate-500">
                Immutable audit trail of booking commission reservations, completed settlements, cancellations releases, and recharges.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={txContext}
                onChange={(e) => {
                  setTxContext(e.target.value)
                  setTxPage(1)
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value="ALL">All Contexts</option>
                <option value="BOOKING_COMMISSION_RESERVE">Hold Reservations</option>
                <option value="BOOKING_COMMISSION_SETTLEMENT">Settled Commissions</option>
                <option value="BOOKING_COMMISSION_RELEASE">Released Reservations</option>
                <option value="WALLET_RECHARGE">Recharges</option>
              </select>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Tx ID & Date</th>
                  <th className="py-3 px-3">Provider</th>
                  <th className="py-3 px-3">Context</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Snapshots</th>
                  <th className="py-3 px-3">Balance Change</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {txLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand" />
                      <p className="mt-2 text-xs">Loading ledger entries...</p>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No financial ledger transactions found.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const isHold = t.context === 'BOOKING_COMMISSION_RESERVE'
                    const isSettle = t.context === 'BOOKING_COMMISSION_SETTLEMENT'
                    const isRelease = t.context === 'BOOKING_COMMISSION_RELEASE'
                    const isRecharge = t.context === 'WALLET_RECHARGE'

                    let badgeColor = 'bg-slate-100 text-slate-800'
                    if (isHold) badgeColor = 'bg-blue-100 text-blue-800'
                    if (isSettle) badgeColor = 'bg-emerald-100 text-emerald-800'
                    if (isRelease) badgeColor = 'bg-purple-100 text-purple-800'
                    if (isRecharge) badgeColor = 'bg-teal-100 text-teal-800'

                    return (
                      <tr key={t._id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4">
                          <p className="font-mono font-bold text-slate-900">{t.transactionId || String(t._id).slice(-8)}</p>
                          <p className="text-[10px] text-slate-400">{formatDate(t.createdAt)}</p>
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="font-bold text-slate-800">{t.userId?.fullName || '—'}</p>
                          <p className="text-[10px] text-slate-400">{t.userId?.phone}</p>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${badgeColor}`}>
                            {t.context.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-black text-slate-900">
                          {formatInr(t.amount)}
                        </td>
                        <td className="py-3.5 px-3 text-[11px] text-slate-500 font-mono">
                          {t.commissionPercentageSnapshot ? `${t.commissionPercentageSnapshot}% comm` : '—'}
                          {t.minimumBalanceSnapshot ? ` · ₹${t.minimumBalanceSnapshot} min` : ''}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[11px]">
                          {formatInr(t.balanceBefore)} → {formatInr(t.balanceAfter)}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                          {t.description || '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {txTotalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
              <p>
                Page {txPage} of {txTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => p - 1)}
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={txPage >= txTotalPages}
                  onClick={() => setTxPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </GlassPanel>
      )}
    </div>
  )
}
