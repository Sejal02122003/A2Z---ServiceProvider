import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Wallet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
  History,
  HelpCircle,
} from 'lucide-react'
import { walletEligibilityApi } from '../../api/walletEligibilityApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'

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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadSettings().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [loadSettings])

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

      {/* SETTINGS */}
      {(
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
    </div>
  )
}
