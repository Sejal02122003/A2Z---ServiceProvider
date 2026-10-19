import { useState, useEffect } from 'react'
import { vendorTrialApi } from '../../api/vendorTrialApi.js'
import {
  Settings,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldAlert,
  Sliders,
  RefreshCw,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Building2,
  Edit2,
  Check,
  X,
} from 'lucide-react'

const SLOT_PRESETS = [
  { label: '08:00 AM – 10:00 AM', id: '08:00 AM - 10:00 AM', desc: 'Early Morning slot' },
  { label: '10:00 AM – 12:00 PM', id: '10:00 AM - 12:00 PM', desc: 'Morning slot' },
  { label: '12:00 PM – 02:00 PM', id: '12:00 PM - 02:00 PM', desc: 'Noon slot' },
  { label: '02:00 PM – 04:00 PM', id: '02:00 PM - 04:00 PM', desc: 'Afternoon slot' },
  { label: '04:00 PM – 06:00 PM', id: '04:00 PM - 06:00 PM', desc: 'Evening slot' },
  { label: '06:00 PM – 08:00 PM', id: '06:00 PM - 08:00 PM', desc: 'Late Evening slot' },
]

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
    partnerTrialSlots: [],
    defaultHubLocation: 'A2Z Partner Training & Evaluation Center, Sector 18, Noida',
  })

  // New slot form state
  const [newSlotLabel, setNewSlotLabel] = useState('')
  const [newSlotDesc, setNewSlotDesc] = useState('')
  const [slotPreset, setSlotPreset] = useState('')

  // Inline edit state
  const [editingSlotId, setEditingSlotId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDesc, setEditDesc] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await vendorTrialApi.getTrialSettings()
      if (res?.data?.settings) {
        const s = res.data.settings
        setForm({
          freeTrialCount: s.freeTrialCount ?? 5,
          passingRatingThreshold: s.passingRatingThreshold ?? 4,
          warningRatingThreshold: s.warningRatingThreshold ?? 3,
          finalChanceEnabled: s.finalChanceEnabled ?? true,
          finalChancePenaltyAmount: s.finalChancePenaltyAmount ?? 500,
          ratingWindowHours: s.ratingWindowHours ?? 48,
          adminApprovalRequired: s.adminApprovalRequired ?? true,
          finalFailureAutoBlock: s.finalFailureAutoBlock ?? false,
          evaluationMode: s.evaluationMode || 'INDIVIDUAL_TRIAL_RATING',
          partnerTrialSlots: Array.isArray(s.partnerTrialSlots) ? s.partnerTrialSlots : [],
          defaultHubLocation: s.defaultHubLocation || 'A2Z Partner Training & Evaluation Center, Sector 18, Noida',
        })
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to load trial settings')
    } finally {
      setLoading(false)
    }
  }

  const notifySlotsUpdated = () => {
    try {
      const bc = new BroadcastChannel('a2z_trial_slots_channel')
      bc.postMessage({ type: 'SLOTS_UPDATED', timestamp: Date.now() })
      bc.close()
    } catch {}
    try {
      localStorage.setItem('a2z_slots_last_updated', String(Date.now()))
    } catch {}
  }

  const persistSlots = async (slotsToPersist, hubLocation) => {
    try {
      setSaving(true)
      setErrorMsg('')
      const location = hubLocation !== undefined ? hubLocation : form.defaultHubLocation
      const res = await vendorTrialApi.updateTrialSettings({
        ...form,
        freeTrialCount: Number(form.freeTrialCount),
        passingRatingThreshold: Number(form.passingRatingThreshold),
        warningRatingThreshold: Number(form.warningRatingThreshold),
        finalChancePenaltyAmount: Number(form.finalChancePenaltyAmount),
        ratingWindowHours: Number(form.ratingWindowHours),
        partnerTrialSlots: slotsToPersist,
        defaultHubLocation: location.trim(),
      })
      if (res?.data?.settings) {
        setForm((prev) => ({
          ...prev,
          partnerTrialSlots: res.data.settings.partnerTrialSlots || slotsToPersist,
          defaultHubLocation: res.data.settings.defaultHubLocation || location,
        }))
      }
      notifySlotsUpdated()
      setSuccessMsg('✓ Live partner trial slots updated & saved!')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save slots')
    } finally {
      setSaving(false)
    }
  }

  const handleAddSlot = async (e) => {
    if (e) e.preventDefault()
    const label = newSlotLabel.trim()
    if (!label) return

    const id = label.replace('–', '-').trim()
    if (form.partnerTrialSlots.some((s) => s.id === id || s.label === label)) {
      setErrorMsg('This time slot already exists')
      setTimeout(() => setErrorMsg(''), 3000)
      return
    }

    const newSlot = {
      id,
      label,
      desc: newSlotDesc.trim() || 'Scheduled evaluation slot',
      isActive: true,
    }

    const updated = [...form.partnerTrialSlots, newSlot]
    setForm((prev) => ({
      ...prev,
      partnerTrialSlots: updated,
    }))

    setNewSlotLabel('')
    setNewSlotDesc('')
    setSlotPreset('')
    await persistSlots(updated)
  }

  const handleStartEdit = (slot) => {
    setEditingSlotId(slot.id)
    setEditLabel(slot.label)
    setEditDesc(slot.desc || '')
  }

  const handleSaveEdit = async (slotId) => {
    const label = editLabel.trim()
    if (!label) return
    const id = label.replace('–', '-').trim()

    const updated = form.partnerTrialSlots.map((s) =>
      s.id === slotId ? { ...s, id, label, desc: editDesc.trim() } : s
    )
    setForm((prev) => ({
      ...prev,
      partnerTrialSlots: updated,
    }))
    setEditingSlotId(null)
    await persistSlots(updated)
  }

  const handleCancelEdit = () => {
    setEditingSlotId(null)
    setEditLabel('')
    setEditDesc('')
  }

  const handleToggleSlotActive = async (id) => {
    const updated = form.partnerTrialSlots.map((s) =>
      s.id === id ? { ...s, isActive: !s.isActive } : s
    )
    setForm((prev) => ({
      ...prev,
      partnerTrialSlots: updated,
    }))
    await persistSlots(updated)
  }

  const handleRemoveSlot = async (id) => {
    const updated = form.partnerTrialSlots.filter((s) => s.id !== id)
    setForm((prev) => ({
      ...prev,
      partnerTrialSlots: updated,
    }))
    await persistSlots(updated)
  }

  const handleClearAllSlots = async () => {
    if (window.confirm('Are you sure you want to clear all trial slots? Partners will not see any slots until you add new ones.')) {
      setForm((prev) => ({
        ...prev,
        partnerTrialSlots: [],
      }))
      await persistSlots([])
    }
  }

  const handlePresetSelect = (val) => {
    setSlotPreset(val)
    const found = SLOT_PRESETS.find((p) => p.id === val)
    if (found) {
      setNewSlotLabel(found.label)
      setNewSlotDesc(found.desc)
    }
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    // Auto-flush any slot currently being edited
    let slotsToSave = [...form.partnerTrialSlots]
    if (editingSlotId && editLabel.trim()) {
      const label = editLabel.trim()
      const id = label.replace('–', '-').trim()
      slotsToSave = slotsToSave.map((s) =>
        s.id === editingSlotId ? { ...s, id, label, desc: editDesc.trim() } : s
      )
      setEditingSlotId(null)
    }

    // Auto-flush any slot currently typed in input box
    if (newSlotLabel.trim()) {
      const label = newSlotLabel.trim()
      const id = label.replace('–', '-').trim()
      if (!slotsToSave.some((s) => s.id === id || s.label === label)) {
        slotsToSave.push({
          id,
          label,
          desc: newSlotDesc.trim() || 'Scheduled evaluation slot',
          isActive: true,
        })
      }
      setNewSlotLabel('')
      setNewSlotDesc('')
      setSlotPreset('')
    }

    try {
      const res = await vendorTrialApi.updateTrialSettings({
        ...form,
        freeTrialCount: Number(form.freeTrialCount),
        passingRatingThreshold: Number(form.passingRatingThreshold),
        warningRatingThreshold: Number(form.warningRatingThreshold),
        finalChancePenaltyAmount: Number(form.finalChancePenaltyAmount),
        ratingWindowHours: Number(form.ratingWindowHours),
        partnerTrialSlots: slotsToSave,
        defaultHubLocation: form.defaultHubLocation.trim(),
      })
      if (res?.data?.settings) {
        setForm((prev) => ({
          ...prev,
          partnerTrialSlots: res.data.settings.partnerTrialSlots || slotsToSave,
          defaultHubLocation: res.data.settings.defaultHubLocation || form.defaultHubLocation,
        }))
      }
      notifySlotsUpdated()
      setSuccessMsg('Trial settings and partner slot timings updated successfully!')
      setTimeout(() => setSuccessMsg(''), 4500)
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

        {/* Card 4: Partner Practical Demonstration Slots & Evaluation Hubs (Step 4 Onboarding) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Partner Practical Demonstration Slots & Evaluation Hubs</h2>
              <p className="text-xs text-slate-500">
                Configure trial time slot timings and hub evaluation center addresses shown during partner registration (Step 4)
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Hub Center Address */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Evaluation Hub / Center Address
              </label>
              <p className="mb-2 text-xs text-slate-500">
                The training and practical demo center address displayed to new service partners.
              </p>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-cyan-600" />
                <input
                  type="text"
                  required
                  value={form.defaultHubLocation}
                  onChange={(e) => setForm({ ...form, defaultHubLocation: e.target.value })}
                  placeholder="e.g. A2Z Partner Training & Evaluation Center, Sector 18, Noida"
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-sm shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Trial Time Slots List */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Configured Trial Time Slots ({form.partnerTrialSlots.length})
                  </label>
                  <p className="text-xs text-slate-500">
                    Active slots are displayed immediately to registering partners in Step 4.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {form.partnerTrialSlots.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllSlots}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                    >
                      Clear All Slots
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-cyan-700 transition disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    <span>Save Slots Now</span>
                  </button>
                </div>
              </div>

              {/* Slot Cards List */}
              <div className="space-y-2 mt-2">
                {form.partnerTrialSlots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    No trial slots configured. Use the form below to add available time slots.
                  </div>
                ) : (
                  form.partnerTrialSlots.map((slot) => {
                    const isEditing = editingSlotId === slot.id
                    return (
                      <div
                        key={slot.id}
                        className={`rounded-xl border p-3 transition ${
                          slot.isActive
                            ? 'border-slate-200 bg-white hover:border-slate-300'
                            : 'border-slate-200 bg-slate-50/60 opacity-60'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                  Timing Label:
                                </label>
                                <input
                                  type="text"
                                  value={editLabel}
                                  onChange={(e) => setEditLabel(e.target.value)}
                                  className="w-full rounded-lg border border-cyan-400 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                  Description / Tag:
                                </label>
                                <input
                                  type="text"
                                  value={editDesc}
                                  onChange={(e) => setEditDesc(e.target.value)}
                                  className="w-full rounded-lg border border-cyan-400 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                              >
                                <X className="h-3 w-3" /> Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(slot.id)}
                                className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white hover:bg-cyan-700"
                              >
                                <Check className="h-3 w-3" /> Done
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                  slot.isActive ? 'bg-cyan-50 text-cyan-600' : 'bg-slate-200 text-slate-500'
                                }`}
                              >
                                <Clock className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900">{slot.label}</span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                      slot.isActive
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {slot.isActive ? 'Active' : 'Disabled'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">{slot.desc || 'Scheduled slot'}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleStartEdit(slot)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition"
                                title="Edit timing or label"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>

                              {/* Toggle Active Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleSlotActive(slot.id)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                  slot.isActive
                                    ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                              >
                                {slot.isActive ? 'Disable' : 'Enable'}
                              </button>

                              {/* Remove Slot */}
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(slot.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                title="Delete slot"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Add New Slot Sub-card */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-cyan-600" /> Add New Trial Time Slot
                </p>

                {/* Quick Presets */}
                <div className="mb-3">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Quick Preset or Custom Time:
                  </label>
                  <select
                    value={slotPreset}
                    onChange={(e) => handlePresetSelect(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Choose a standard preset or type below --</option>
                    {SLOT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} ({p.desc})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Time Slot Timing Label *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 09:00 AM – 11:00 AM"
                      value={newSlotLabel}
                      onChange={(e) => setNewSlotLabel(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Slot Description / Tag
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Morning slot or Practical demo session"
                      value={newSlotDesc}
                      onChange={(e) => setNewSlotDesc(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    disabled={!newSlotLabel.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-cyan-700 transition disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Slot to List
                  </button>
                </div>
              </div>
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
