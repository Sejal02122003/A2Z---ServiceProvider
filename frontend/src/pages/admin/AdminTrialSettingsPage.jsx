import { useState, useEffect } from 'react'
import { vendorTrialApi } from '../../api/vendorTrialApi.js'
import { Settings, CheckCircle2, AlertCircle, Save, ShieldAlert, Sliders, RefreshCw } from 'lucide-react'

export function AdminTrialSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [form, setForm] = useState({
    freeTrialCount: 5,
    passingRatingThreshold: 4,
    warningRatingThreshold: 3,
    finalChanceEnabled: true,
    finalChancePenaltyAmount: 500,
    ratingWindowHours: 48,
    adminApprovalRequired: true,
    finalFailureAutoBlock: false,
    evaluationMode: 'INDIVIDUAL_TRIAL_RATING',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await vendorTrialApi.getTrialSettings()
      if (res?.data?.settings) {
        setForm({
          freeTrialCount: res.data.settings.freeTrialCount ?? 5,
          passingRatingThreshold: res.data.settings.passingRatingThreshold ?? 4,
          warningRatingThreshold: res.data.settings.warningRatingThreshold ?? 3,
          finalChanceEnabled: res.data.settings.finalChanceEnabled ?? true,
          finalChancePenaltyAmount: res.data.settings.finalChancePenaltyAmount ?? 500,
          ratingWindowHours: res.data.settings.ratingWindowHours ?? 48,
          adminApprovalRequired: res.data.settings.adminApprovalRequired ?? true,
          finalFailureAutoBlock: res.data.settings.finalFailureAutoBlock ?? false,
          evaluationMode: res.data.settings.evaluationMode || 'INDIVIDUAL_TRIAL_RATING',
        })
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to load trial settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      await vendorTrialApi.updateTrialSettings({
        ...form,
        freeTrialCount: Number(form.freeTrialCount),
        passingRatingThreshold: Number(form.passingRatingThreshold),
        warningRatingThreshold: Number(form.warningRatingThreshold),
        finalChancePenaltyAmount: Number(form.finalChancePenaltyAmount),
        ratingWindowHours: Number(form.ratingWindowHours),
      })
      setSuccessMsg('Trial settings updated successfully!')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to update trial settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
          <span>Loading trial configuration...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vendor Trial Configuration</h1>
          <p className="text-sm text-slate-500">
            Configure free trial quotas, passing rating thresholds, low-performance warnings, and final chance penalties.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSettings}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Trial Counts & Ratings */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Trial Rules & Rating Thresholds</h2>
              <p className="text-xs text-slate-500">Define the number of trial services and passing criteria</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Configured Free Trial Count
              </label>
              <p className="mb-1 text-xs text-slate-500">Number of free trial bookings required per verified vendor</p>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={form.freeTrialCount}
                onChange={(e) => setForm({ ...form, freeTrialCount: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Passing Rating Threshold (Stars)
              </label>
              <p className="mb-1 text-xs text-slate-500">Ratings equal to or above this count as PASS (Default: 4 ⭐)</p>
              <select
                value={form.passingRatingThreshold}
                onChange={(e) => setForm({ ...form, passingRatingThreshold: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value={3}>3 Stars & Above (Pass on 3, 4, 5)</option>
                <option value={4}>4 Stars & Above (Pass on 4, 5)</option>
                <option value={5}>5 Stars Only (Strict)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Warning Rating Threshold (Stars)
              </label>
              <p className="mb-1 text-xs text-slate-500">Ratings equal to or below this trigger a Warning (Default: 3 ⭐)</p>
              <select
                value={form.warningRatingThreshold}
                onChange={(e) => setForm({ ...form, warningRatingThreshold: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value={1}>1 Star (Only lowest rating)</option>
                <option value={2}>2 Stars & Below</option>
                <option value={3}>3 Stars & Below (Standard)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Customer Rating Window (Hours)
              </label>
              <p className="mb-1 text-xs text-slate-500">Time allotted for customer to submit rating after job completion</p>
              <input
                type="number"
                min="1"
                max="168"
                required
                value={form.ratingWindowHours}
                onChange={(e) => setForm({ ...form, ratingWindowHours: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Final Chance & Penalties */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Final Chance & Penalty Management</h2>
              <p className="text-xs text-slate-500">Configure recovery opportunities for low-performing vendors</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Enable Final Chance Opportunity</p>
                <p className="text-xs text-slate-500">Allow vendors with final failure to request a paid final chance</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={form.finalChanceEnabled}
                  onChange={(e) => setForm({ ...form, finalChanceEnabled: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full peer-focus:outline-none"></div>
              </label>
            </div>

            {form.finalChanceEnabled && (
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Final Chance Penalty Amount (₹ INR)
                </label>
                <p className="mb-1 text-xs text-slate-500">Admin-configured penalty fee vendor must pay to activate final chance</p>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={form.finalChancePenaltyAmount}
                    onChange={(e) => setForm({ ...form, finalChancePenaltyAmount: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 pl-8 pr-3.5 py-2.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Administrative Control & Confirmation Policy */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Confirmation & State Control</h2>
              <p className="text-xs text-slate-500">Requirement 45: Admin review and final joining confirmation policy</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Mandatory Admin Review (Recommended)</p>
                <p className="text-xs text-slate-500">
                  Completed trials transition to <code>PENDING_ADMIN_CONFIRMATION</code> rather than auto-confirming.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={form.adminApprovalRequired}
                  onChange={(e) => setForm({ ...form, adminApprovalRequired: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full peer-focus:outline-none"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Evaluation Mode</label>
              <select
                value={form.evaluationMode}
                onChange={(e) => setForm({ ...form, evaluationMode: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="INDIVIDUAL_TRIAL_RATING">Individual Trial Rating (Default)</option>
                <option value="AVERAGE_RATING">Average Rating Evaluation</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
