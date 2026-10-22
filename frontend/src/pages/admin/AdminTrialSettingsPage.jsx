import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { vendorTrialApi } from '../../api/vendorTrialApi.js'
import { adminZonesApi } from '../../api/adminZonesApi.js'
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
  Award,
  ArrowRight,
  Globe,
  Filter,
  CalendarDays,
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

  // Active Zones from DB
  const [zones, setZones] = useState([])

  // Slot List Filter States
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('ALL')
  const [selectedDateFilter, setSelectedDateFilter] = useState('')

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

  // Active Zone Tab selection (defaults to 'ALL')
  const [activeZoneTab, setActiveZoneTab] = useState('ALL')
  // Zone-specific venue address map: { [zoneId]: venueAddress }
  const [zoneVenuesMap, setZoneVenuesMap] = useState({})
  const [currentZoneVenue, setCurrentZoneVenue] = useState('')
  const [savingZoneVenue, setSavingZoneVenue] = useState(false)

  // New slot form state (with Zone, Date, & Center Address)
  const [newSlotLabel, setNewSlotLabel] = useState('')
  const [newSlotDesc, setNewSlotDesc] = useState('')
  const [slotPreset, setSlotPreset] = useState('')
  const [newSlotZoneId, setNewSlotZoneId] = useState('ALL')
  const [newSlotDateType, setNewSlotDateType] = useState('ALL') // 'ALL' = recurring / everyday, 'SPECIFIC' = specific date
  const [newSlotDate, setNewSlotDate] = useState('')
  const [newSlotCenterAddress, setNewSlotCenterAddress] = useState('')

  // Inline edit state (with Zone, Date, & Center Address)
  const [editingSlotId, setEditingSlotId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editZoneId, setEditZoneId] = useState('ALL')
  const [editDate, setEditDate] = useState('')
  const [editCenterAddress, setEditCenterAddress] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [res, zonesRes] = await Promise.all([
        vendorTrialApi.getTrialSettings(),
        adminZonesApi.getAllZones({ limit: 100 }).catch(() =>
          adminZonesApi.getActiveZones().catch(() => ({ data: { zones: [] } }))
        ),
      ])

      let loadedZones = []
      if (Array.isArray(res?.data?.zones) && res.data.zones.length > 0) {
        loadedZones = res.data.zones
      } else if (Array.isArray(zonesRes?.data?.zones) && zonesRes.data.zones.length > 0) {
        loadedZones = zonesRes.data.zones
      } else if (Array.isArray(zonesRes?.zones) && zonesRes.zones.length > 0) {
        loadedZones = zonesRes.zones
      }
      setZones(loadedZones)

      if (res?.data?.settings) {
        const s = res.data.settings
        const defaultHub = s.defaultHubLocation || 'A2Z Partner Training & Evaluation Center, Sector 18, Noida'
        const zvMap = {}
        if (Array.isArray(s.zoneVenues)) {
          s.zoneVenues.forEach((zv) => {
            if (zv.zoneId) zvMap[zv.zoneId] = zv.venueAddress
          })
        }
        setZoneVenuesMap(zvMap)

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
          defaultHubLocation: defaultHub,
          zoneVenues: Array.isArray(s.zoneVenues) ? s.zoneVenues : [],
        })

        const initialVenue = activeZoneTab === 'ALL' ? defaultHub : (zvMap[activeZoneTab] || defaultHub)
        setCurrentZoneVenue(initialVenue)
        setNewSlotCenterAddress((prev) => prev || initialVenue)
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

  const persistSlots = async (slotsToPersist, hubLocation, customZvMap) => {
    try {
      setSaving(true)
      setErrorMsg('')
      const location = hubLocation !== undefined ? hubLocation : form.defaultHubLocation
      const zvMap = customZvMap !== undefined ? customZvMap : zoneVenuesMap
      const zvArray = Object.entries(zvMap).map(([zId, vAddr]) => {
        const zObj = zones.find((z) => String(z._id) === String(zId))
        return {
          zoneId: zId,
          zoneName: zObj?.name || 'Zone',
          venueAddress: vAddr,
        }
      })

      const res = await vendorTrialApi.updateTrialSettings({
        ...form,
        freeTrialCount: Number(form.freeTrialCount),
        passingRatingThreshold: Number(form.passingRatingThreshold),
        warningRatingThreshold: Number(form.warningRatingThreshold),
        finalChancePenaltyAmount: Number(form.finalChancePenaltyAmount),
        ratingWindowHours: Number(form.ratingWindowHours),
        partnerTrialSlots: slotsToPersist,
        defaultHubLocation: location.trim(),
        zoneVenues: zvArray,
      })
      if (res?.data?.settings) {
        setForm((prev) => ({
          ...prev,
          partnerTrialSlots: res.data.settings.partnerTrialSlots || slotsToPersist,
          defaultHubLocation: res.data.settings.defaultHubLocation || location,
          zoneVenues: res.data.settings.zoneVenues || zvArray,
        }))
      }
      notifySlotsUpdated()
      setSuccessMsg('✓ Live partner trial slots & zone venues updated & saved!')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save slots')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectZoneTab = (zoneId) => {
    setActiveZoneTab(zoneId)
    setSelectedZoneFilter(zoneId)
    setNewSlotZoneId(zoneId)
    const venue = zoneId === 'ALL'
      ? (form.defaultHubLocation || 'A2Z Partner Training & Evaluation Center, Sector 18, Noida')
      : (zoneVenuesMap[zoneId] || form.defaultHubLocation || '')
    setCurrentZoneVenue(venue)
    setNewSlotCenterAddress(venue)
  }

  const handleSaveActiveZoneVenue = async () => {
    try {
      setSavingZoneVenue(true)
      const venueToSave = currentZoneVenue.trim() || form.defaultHubLocation
      const isGlobal = activeZoneTab === 'ALL'
      const activeZoneObj = zones.find((z) => String(z._id) === String(activeZoneTab))
      const zoneName = isGlobal ? 'All Zones' : (activeZoneObj?.name || 'Selected Zone')

      if (isGlobal) {
        await persistSlots(form.partnerTrialSlots, venueToSave, zoneVenuesMap)
      } else {
        const updatedZvMap = { ...zoneVenuesMap, [activeZoneTab]: venueToSave }
        setZoneVenuesMap(updatedZvMap)
        // Also update any existing slots in this zone with the new venue
        const updatedSlots = form.partnerTrialSlots.map((s) => {
          if (String(s.zoneId) === String(activeZoneTab)) {
            return { ...s, centerAddress: venueToSave }
          }
          return s
        })
        setForm((prev) => ({ ...prev, partnerTrialSlots: updatedSlots }))
        await persistSlots(updatedSlots, form.defaultHubLocation, updatedZvMap)
      }
      setSuccessMsg(`✓ Venue address saved for ${zoneName}!`)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save zone venue')
    } finally {
      setSavingZoneVenue(false)
    }
  }

  const handleAddSlot = async (e) => {
    if (e) e.preventDefault()
    const label = newSlotLabel.trim()
    if (!label) return

    const cleanLabel = label.replace(/–/g, '-').trim()
    const zoneObj = zones.find((z) => String(z._id) === String(newSlotZoneId))
    const zoneName = newSlotZoneId === 'ALL' ? 'All Zones' : (zoneObj?.name || 'Selected Zone')
    const slotDate = newSlotDateType === 'SPECIFIC' ? newSlotDate.trim() : ''

    // Check duplicate for matching timing + zone + date
    const isDuplicate = form.partnerTrialSlots.some((s) => {
      const sZone = s.zoneId || 'ALL'
      const sDate = s.date || ''
      const sLabel = (s.label || s.id || '').replace(/–/g, '-').trim()
      return sLabel.toLowerCase() === cleanLabel.toLowerCase() && sZone === newSlotZoneId && sDate === slotDate
    })

    if (isDuplicate) {
      setErrorMsg(`This slot timing already exists for ${zoneName} ${slotDate ? `on ${slotDate}` : '(Recurring / All Dates)'}`)
      setTimeout(() => setErrorMsg(''), 4000)
      return
    }

    const uniqueId = `${cleanLabel}_${newSlotZoneId}_${slotDate || 'ALL'}_${Date.now()}`
    const centerAddress = (newSlotCenterAddress || form.defaultHubLocation || '').trim()
    const newSlot = {
      id: uniqueId,
      label,
      desc: newSlotDesc.trim() || 'Scheduled evaluation slot',
      zoneId: newSlotZoneId,
      zoneName,
      date: slotDate,
      centerAddress,
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
    setEditZoneId(slot.zoneId || 'ALL')
    setEditDate(slot.date || '')
    setEditCenterAddress(slot.centerAddress || form.defaultHubLocation || '')
  }

  const handleSaveEdit = async (slotId) => {
    const label = editLabel.trim()
    if (!label) return
    const zoneObj = zones.find((z) => String(z._id) === String(editZoneId))
    const zoneName = editZoneId === 'ALL' ? 'All Zones' : (zoneObj?.name || 'Selected Zone')

    const updated = form.partnerTrialSlots.map((s) =>
      s.id === slotId
        ? {
            ...s,
            label,
            desc: editDesc.trim(),
            zoneId: editZoneId,
            zoneName,
            date: editDate.trim(),
            centerAddress: (editCenterAddress || form.defaultHubLocation || '').trim(),
          }
        : s
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
    setEditZoneId('ALL')
    setEditDate('')
    setEditCenterAddress('')
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
      const zoneObj = zones.find((z) => String(z._id) === String(editZoneId))
      const zoneName = editZoneId === 'ALL' ? 'All Zones' : (zoneObj?.name || 'Selected Zone')
      slotsToSave = slotsToSave.map((s) =>
        s.id === editingSlotId
          ? {
              ...s,
              label,
              desc: editDesc.trim(),
              zoneId: editZoneId,
              zoneName,
              date: editDate.trim(),
              centerAddress: (editCenterAddress || form.defaultHubLocation || '').trim(),
            }
          : s
      )
      setEditingSlotId(null)
    }

    // Auto-flush any slot currently typed in input box
    if (newSlotLabel.trim()) {
      const label = newSlotLabel.trim()
      const cleanLabel = label.replace(/–/g, '-').trim()
      const zoneObj = zones.find((z) => String(z._id) === String(newSlotZoneId))
      const zoneName = newSlotZoneId === 'ALL' ? 'All Zones' : (zoneObj?.name || 'Selected Zone')
      const slotDate = newSlotDateType === 'SPECIFIC' ? newSlotDate.trim() : ''
      const centerAddress = (newSlotCenterAddress || form.defaultHubLocation || '').trim()

      const isDuplicate = slotsToSave.some((s) => {
        const sZone = s.zoneId || 'ALL'
        const sDate = s.date || ''
        const sLabel = (s.label || s.id || '').replace(/–/g, '-').trim()
        return sLabel.toLowerCase() === cleanLabel.toLowerCase() && sZone === newSlotZoneId && sDate === slotDate
      })

      if (!isDuplicate) {
        slotsToSave.push({
          id: `${cleanLabel}_${newSlotZoneId}_${slotDate || 'ALL'}_${Date.now()}`,
          label,
          desc: newSlotDesc.trim() || 'Scheduled evaluation slot',
          zoneId: newSlotZoneId,
          zoneName,
          date: slotDate,
          centerAddress,
          isActive: true,
        })
      }
      setNewSlotLabel('')
      setNewSlotDesc('')
      setSlotPreset('')
    }

    try {
      const zvArray = Object.entries(zoneVenuesMap).map(([zId, vAddr]) => {
        const zObj = zones.find((z) => String(z._id) === String(zId))
        return {
          zoneId: zId,
          zoneName: zObj?.name || 'Zone',
          venueAddress: vAddr,
        }
      })

      const res = await vendorTrialApi.updateTrialSettings({
        ...form,
        freeTrialCount: Number(form.freeTrialCount),
        passingRatingThreshold: Number(form.passingRatingThreshold),
        warningRatingThreshold: Number(form.warningRatingThreshold),
        finalChancePenaltyAmount: Number(form.finalChancePenaltyAmount),
        ratingWindowHours: Number(form.ratingWindowHours),
        partnerTrialSlots: slotsToSave,
        defaultHubLocation: form.defaultHubLocation.trim(),
        zoneVenues: zvArray,
      })
      if (res?.data?.settings) {
        setForm((prev) => ({
          ...prev,
          partnerTrialSlots: res.data.settings.partnerTrialSlots || slotsToSave,
          defaultHubLocation: res.data.settings.defaultHubLocation || form.defaultHubLocation,
          zoneVenues: res.data.settings.zoneVenues || zvArray,
        }))
      }
      notifySlotsUpdated()
      setSuccessMsg('Trial settings, partner slot timings, and zone venues updated successfully!')
      setTimeout(() => setSuccessMsg(''), 4500)
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to update trial settings')
    } finally {
      setSaving(false)
    }
  }

  const activeZoneObj = zones.find((z) => String(z._id) === String(activeZoneTab))
  const activeZoneName = activeZoneTab === 'ALL' ? 'All Zones (Global)' : (activeZoneObj?.name || 'Selected Zone')

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

          {/* Action Link to Candidate Evaluation Roster */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-white p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white shrink-0 shadow-sm">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-cyan-950">Evaluating Practical Trial Candidates</h3>
                <p className="text-xs text-cyan-800">
                  When partners select these slots, grade their demo and confirm their joining in the Service Provider KYC Hub.
                </p>
              </div>
            </div>
            <Link
              to="/admin/labour?trial=scheduled"
              className="inline-flex items-center gap-1.5 shrink-0 rounded-xl bg-cyan-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-800 transition active:scale-95"
            >
              <span>Evaluate Candidates</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
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
                    Create slots differently for specific zones and dates. Active slots are immediately displayed to candidates in Step 4.
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

              {/* Operational Zones Showcase & Selector */}
              <div className="mb-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <Building2 className="h-4 w-4 text-cyan-600" /> Operational Zones ({zones.length} Zones Available)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Click any created zone below to view its slots, set its evaluation center address, and configure slot timings.
                    </p>
                  </div>
                  {zones.length === 0 && (
                    <Link
                      to="/admin/zones"
                      className="text-xs font-bold text-cyan-600 hover:text-cyan-700 underline flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Create Zones in Zone Manager
                    </Link>
                  )}
                </div>

                {/* Zone Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {/* All Zones (Global) Tab */}
                  <button
                    type="button"
                    onClick={() => handleSelectZoneTab('ALL')}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition cursor-pointer ${
                      activeZoneTab === 'ALL'
                        ? 'border-cyan-500 bg-cyan-50/80 ring-2 ring-cyan-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-900">
                        <Globe className="h-3.5 w-3.5 text-purple-600" /> All Zones
                      </span>
                      <span
                        className={`text-[10px] font-extrabold rounded-full px-1.5 py-0.2 ${
                          activeZoneTab === 'ALL'
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {form.partnerTrialSlots.length} slots
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 truncate">Global across all cities</span>
                  </button>

                  {/* Each Created Zone from DB */}
                  {zones.map((z) => {
                    const zoneSlotsCount = form.partnerTrialSlots.filter(
                      (s) => String(s.zoneId) === String(z._id)
                    ).length
                    const isSelected = activeZoneTab === String(z._id)
                    const hasVenue = Boolean(zoneVenuesMap[z._id])

                    return (
                      <button
                        type="button"
                        key={z._id}
                        onClick={() => handleSelectZoneTab(String(z._id))}
                        className={`flex flex-col text-left p-2.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-50/80 ring-2 ring-cyan-500/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="flex items-center gap-1 text-xs font-bold text-slate-900 truncate">
                            <Building2 className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                            <span className="truncate">{z.name}</span>
                          </span>
                          <span
                            className={`text-[10px] font-extrabold rounded-full px-1.5 py-0.2 shrink-0 ${
                              zoneSlotsCount > 0
                                ? isSelected
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-cyan-100 text-cyan-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {zoneSlotsCount} {zoneSlotsCount === 1 ? 'slot' : 'slots'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="truncate">{z.city || z.state || 'Operational'}</span>
                          {hasVenue ? (
                            <span className="text-emerald-600 font-semibold text-[9px]">📍 Venue Set</span>
                          ) : (
                            <span className="text-amber-600 text-[9px]">📍 Default Hub</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Active Zone Control & Venue Address Banner */}
              <div className="mb-4 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50/80 via-white to-blue-50/40 p-3.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600 text-white shadow-xs">
                        {activeZoneTab === 'ALL' ? <Globe className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          {activeZoneTab === 'ALL'
                            ? 'All Zones (Global Configuration)'
                            : `${activeZoneObj?.name || 'Selected Zone'} (${activeZoneObj?.city || activeZoneObj?.state || 'Zone'})`}
                          <span className="text-[10px] font-semibold text-cyan-700 bg-cyan-100/80 px-2 py-0.5 rounded-full">
                            Active Selection
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {activeZoneTab === 'ALL'
                            ? 'Manage trial slots and evaluation venue applicable across all operational regions.'
                            : `Set the specific evaluation venue and trial slots available to candidates in ${activeZoneObj?.name}.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Date Filter for this Zone */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={selectedDateFilter}
                      onChange={(e) => setSelectedDateFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-cyan-500 shadow-2xs"
                    >
                      <option value="">All Dates & Recurring</option>
                      <option value="RECURRING">🔄 Recurring (Everyday)</option>
                      {Array.from(
                        new Set(form.partnerTrialSlots.map((s) => s.date).filter(Boolean))
                      ).sort().map((d) => (
                        <option key={d} value={d}>
                          📅 {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Venue Address Setting for this Active Zone */}
                <div className="mt-3 pt-3 border-t border-cyan-100/80">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-cyan-600" />
                      Evaluation Venue / Center Address for {activeZoneTab === 'ALL' ? 'All Zones (Default)' : activeZoneObj?.name || 'this Zone'}:
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">
                      Candidates in this zone report here
                    </span>
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={currentZoneVenue}
                      onChange={(e) => {
                        const val = e.target.value
                        setCurrentZoneVenue(val)
                        setNewSlotCenterAddress(val)
                      }}
                      placeholder={`e.g. ${form.defaultHubLocation || 'A2Z Evaluation Hub'}`}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-500 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={handleSaveActiveZoneVenue}
                      disabled={savingZoneVenue}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-cyan-700 transition shadow-2xs disabled:opacity-50"
                    >
                      {savingZoneVenue ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Save Venue</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Slot Cards List */}
              <div className="space-y-2 mt-2">
                {form.partnerTrialSlots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    No trial slots configured. Use the form below to add available time slots.
                  </div>
                ) : (
                  (() => {
                    const filteredSlots = form.partnerTrialSlots.filter((slot) => {
                      if (activeZoneTab !== 'ALL') {
                        const sZone = slot.zoneId || 'ALL'
                        if (sZone !== activeZoneTab) return false
                      }
                      if (selectedDateFilter === 'RECURRING') {
                        if (slot.date) return false
                      } else if (selectedDateFilter) {
                        if (slot.date !== selectedDateFilter) return false
                      }
                      return true
                    })

                    if (filteredSlots.length === 0) {
                      return (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
                          <p className="font-semibold text-slate-700">No trial slots configured for {activeZoneName}</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Set slot timings, date, and venue in the form below to create slots for candidates in {activeZoneName}.
                          </p>
                        </div>
                      )
                    }

                    return filteredSlots.map((slot) => {
                      const isEditing = editingSlotId === slot.id
                      return (
                        <div
                          key={slot.id}
                          className={`rounded-xl border p-3.5 transition ${
                            slot.isActive
                              ? 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                              : 'border-slate-200 bg-slate-50/60 opacity-60'
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                    Zone Assignment:
                                  </label>
                                  <select
                                    value={editZoneId}
                                    onChange={(e) => setEditZoneId(e.target.value)}
                                    className="w-full rounded-lg border border-cyan-400 bg-white px-2.5 py-1 text-xs text-slate-800 outline-none"
                                  >
                                    <option value="ALL">🌐 All Zones (Global)</option>
                                    {zones.map((z) => (
                                      <option key={z._id} value={z._id}>
                                        🏢 {z.name} ({z.city || z.state})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                    Date (Leave blank for Recurring/Everyday):
                                  </label>
                                  <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="w-full rounded-lg border border-cyan-400 bg-white px-2.5 py-1 text-xs text-slate-800 outline-none"
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-cyan-600" /> Evaluation Center Address:
                                  </label>
                                  <input
                                    type="text"
                                    value={editCenterAddress}
                                    onChange={(e) => setEditCenterAddress(e.target.value)}
                                    placeholder={form.defaultHubLocation || 'e.g. A2Z Training Center, Sector 18, Noida'}
                                    className="w-full rounded-lg border border-cyan-400 bg-white px-2.5 py-1 text-xs text-slate-800 outline-none"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mt-0.5 ${
                                    slot.isActive ? 'bg-cyan-50 text-cyan-600' : 'bg-slate-200 text-slate-500'
                                  }`}
                                >
                                  <Clock className="h-4.5 w-4.5" />
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900">{slot.label}</span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                                        slot.isActive
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-slate-200 text-slate-600'
                                      }`}
                                    >
                                      {slot.isActive ? 'Active' : 'Disabled'}
                                    </span>
                                  </div>

                                  {/* Zone & Date Badges */}
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                    {/* Zone Badge */}
                                    {(!slot.zoneId || slot.zoneId === 'ALL') ? (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200/80 px-2 py-0.5 font-bold text-purple-700">
                                        <Globe className="h-3 w-3" /> All Zones
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 border border-cyan-200/80 px-2 py-0.5 font-bold text-cyan-800">
                                        <Building2 className="h-3 w-3" /> {slot.zoneName || 'Specific Zone'}
                                      </span>
                                    )}

                                    {/* Date Badge */}
                                    {slot.date ? (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200/80 px-2 py-0.5 font-bold text-amber-900">
                                        <Calendar className="h-3 w-3" /> {slot.date}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 font-bold text-emerald-800">
                                        🔄 Recurring (Everyday)
                                      </span>
                                    )}
                                  </div>

                                  {/* Center Address with MapPin */}
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
                                    <MapPin className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                                    <span className="truncate">{slot.centerAddress || form.defaultHubLocation}</span>
                                  </div>

                                  <p className="text-xs text-slate-500 truncate">{slot.desc || 'Scheduled evaluation slot'}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(slot)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition"
                                  title="Edit timing, zone, or date"
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
                  })()
                )}
              </div>

              {/* Add New Slot Sub-card with Zone & Date Selection */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4.5 shadow-2xs">
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-cyan-600" /> Add New Trial Time Slot for {activeZoneName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Configure evaluation time slots specifically for candidates in {activeZoneName} or keep them global across all zones.
                  </p>
                </div>

                {/* Zone & Date Selection Row */}
                <div className="mb-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Zone Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      1. Select Target Zone / Region *
                    </label>
                    <select
                      value={newSlotZoneId}
                      onChange={(e) => {
                        const val = e.target.value
                        setNewSlotZoneId(val)
                        const v = val === 'ALL'
                          ? (form.defaultHubLocation || 'A2Z Partner Training & Evaluation Center, Sector 18, Noida')
                          : (zoneVenuesMap[val] || form.defaultHubLocation || '')
                        setNewSlotCenterAddress(v)
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-500 shadow-2xs"
                    >
                      <option value="ALL">🌐 All Zones (Global slot for all cities)</option>
                      {zones.map((z) => (
                        <option key={z._id} value={z._id}>
                          🏢 {z.name} ({z.city || z.state || 'Active Zone'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Applicability */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      2. Slot Date Applicability *
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setNewSlotDateType('ALL')
                          setNewSlotDate('')
                        }}
                        className={`flex-1 rounded-xl py-2 px-2 text-[11px] font-bold transition ${
                          newSlotDateType === 'ALL'
                            ? 'bg-cyan-600 text-white shadow-2xs'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        🔄 Everyday (Recurring)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewSlotDateType('SPECIFIC')
                          if (!newSlotDate) {
                            const d = new Date()
                            d.setDate(d.getDate() + 1)
                            setNewSlotDate(d.toISOString().split('T')[0])
                          }
                        }}
                        className={`flex-1 rounded-xl py-2 px-2 text-[11px] font-bold transition ${
                          newSlotDateType === 'SPECIFIC'
                            ? 'bg-cyan-600 text-white shadow-2xs'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        📅 Specific Date
                      </button>
                    </div>
                    {newSlotDateType === 'SPECIFIC' && (
                      <input
                        type="date"
                        value={newSlotDate}
                        onChange={(e) => setNewSlotDate(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 shadow-2xs"
                      />
                    )}
                  </div>
                </div>

                {/* Center / Evaluation Hub Address */}
                <div className="mb-3.5">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-cyan-600" /> 3. Evaluation Center / Venue Address (for this slot) *
                  </label>
                  <input
                    type="text"
                    value={newSlotCenterAddress}
                    onChange={(e) => setNewSlotCenterAddress(e.target.value)}
                    placeholder={form.defaultHubLocation || 'e.g. A2Z Training Center, Sector 18, Noida'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-500 shadow-2xs"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    The specific training or evaluation center location candidates selecting this slot must visit.
                  </p>
                </div>

                {/* Quick Presets */}
                <div className="mb-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Quick Preset or Custom Time:
                  </label>
                  <select
                    value={slotPreset}
                    onChange={(e) => handlePresetSelect(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-cyan-500 shadow-2xs"
                  >
                    <option value="">-- Choose a standard preset or type custom timing below --</option>
                    {SLOT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} ({p.desc})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Time Slot Timing Label *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 09:00 AM – 11:00 AM"
                      value={newSlotLabel}
                      onChange={(e) => setNewSlotLabel(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-cyan-500 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Slot Description / Tag
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Morning demo session or Evaluation round 1"
                      value={newSlotDesc}
                      onChange={(e) => setNewSlotDesc(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-cyan-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="mt-3.5 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    disabled={!newSlotLabel.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition disabled:opacity-40 active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Slot to {newSlotZoneId === 'ALL' ? 'All Zones' : (zones.find(z => String(z._id) === String(newSlotZoneId))?.name || 'Selected Zone')}
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
