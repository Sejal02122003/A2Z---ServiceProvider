import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { adminZonesApi } from '../../api/adminZonesApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { Map, Plus, Edit2, Trash2, Search, CheckCircle2, AlertTriangle, X, ChevronDown } from 'lucide-react'
import { Country, State, City } from 'country-state-city'

function Toast({ message, variant = 'success' }) {
  if (!message) return null
  const styles = variant === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-900'
    : 'border-blue-200 bg-blue-50 text-blue-900'
  const Icon = variant === 'error' ? AlertTriangle : CheckCircle2
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`fixed left-4 right-4 top-20 z-50 mx-auto flex max-w-lg items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${styles}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {message}
    </motion.div>
  )
}

function CustomSelect({ value, onChange, options, placeholder, emptyMessage = "No results found" }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownRef])

  const selectedOption = options.find(opt => opt.value === value)
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 100)

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm outline-none bg-white transition-colors ${isOpen ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200 hover:border-slate-300'}`}
      >
        <input
          type="text"
          className="w-full outline-none text-slate-900 bg-transparent placeholder-slate-400"
          placeholder={isOpen && selectedOption ? selectedOption.label : placeholder}
          value={isOpen ? searchQuery : (selectedOption ? selectedOption.label : '')}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onClick={() => setIsOpen(true)}
        />
        <ChevronDown 
          className={`h-4 w-4 text-slate-400 transition-transform cursor-pointer shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>
      
      {isOpen && (
        <div className="absolute z-[70] mt-1.5 w-full max-h-64 flex flex-col rounded-xl border border-slate-100 bg-white shadow-xl py-1">
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400 text-center">{emptyMessage}</div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <div
                  key={opt.value || idx}
                  onClick={() => {
                    onChange(opt.value)
                    setSearchQuery('')
                    setIsOpen(false)
                  }}
                  className={`cursor-pointer px-3 py-2 text-sm transition-colors ${value === opt.value ? 'bg-brand/10 text-brand font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ZoneModal({ open, zone, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [countryIso, setCountryIso] = useState('IN')
  const [stateIso, setStateIso] = useState('')
  const [cityName, setCityName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const countries = Country.getAllCountries()
  const states = State.getStatesOfCountry(countryIso)
  const cities = stateIso 
    ? City.getCitiesOfState(countryIso, stateIso) 
    : City.getCitiesOfCountry(countryIso)

  useEffect(() => {
    if (open) {
      const countriesList = Country.getAllCountries()
      setName(zone?.name || '')
      
      // Try to find the ISO code for the country from zone.country
      let foundCountryIso = 'IN'
      if (zone?.country) {
        const c = countriesList.find(x => x.name.toLowerCase() === zone.country.toLowerCase())
        if (c) foundCountryIso = c.isoCode
      }
      setCountryIso(foundCountryIso)

      let foundStateIso = ''
      if (zone?.state) {
        const sList = State.getStatesOfCountry(foundCountryIso)
        const s = sList.find(x => x.name.toLowerCase() === zone.state.toLowerCase())
        if (s) foundStateIso = s.isoCode
      }
      setStateIso(foundStateIso)
      
      setCityName(zone?.city || '')
      setIsActive(zone?.isActive ?? true)
      setError('')
    }
  }, [open, zone])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const countryName = countries.find(c => c.isoCode === countryIso)?.name || ''
    const stName = states.find(s => s.isoCode === stateIso)?.name || ''
    
    if (!name.trim() || !countryIso || !stateIso || !cityName) {
      setError('Zone Name, Country, State, and City are required.')
      return
    }

    const payload = {
      name: name.trim(),
      country: countryName,
      state: stName,
      city: cityName,
      isActive
    }

    setBusy(true)
    setError('')
    try {
      if (zone) {
        await adminZonesApi.updateZone(zone._id, payload)
      } else {
        await adminZonesApi.createZone(payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save zone')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{zone ? 'Edit Zone' : 'Add Zone'}</h3>
            <p className="text-sm text-slate-500">Create a new service coverage zone</p>
          </div>
          <button onClick={() => !busy && onClose()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{error}</div>}

          {/* LOCATION */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Location</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Country *</label>
                <CustomSelect
                  value={countryIso}
                  onChange={(val) => {
                    setCountryIso(val)
                    setStateIso('')
                    setCityName('')
                  }}
                  placeholder="Select Country"
                  options={countries.map(c => ({ value: c.isoCode, label: c.name }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">State *</label>
                <CustomSelect
                  value={stateIso}
                  onChange={(val) => {
                    setStateIso(val)
                    setCityName('')
                  }}
                  placeholder="Select State"
                  options={states.map(s => ({ value: s.isoCode, label: s.name }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">City *</label>
                <CustomSelect
                  value={cityName}
                  onChange={(val) => {
                    setCityName(val)
                    if (!stateIso) {
                      const selectedCity = cities.find(c => c.name === val)
                      if (selectedCity && selectedCity.stateCode) {
                        setStateIso(selectedCity.stateCode)
                      }
                    }
                  }}
                  placeholder="Select City"
                  options={cities.map(c => ({ 
                    value: c.name, 
                    label: stateIso ? c.name : `${c.name}, ${c.stateCode}` 
                  }))}
                  emptyMessage={!countryIso ? "Select Country first" : "No results found"}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Zone Name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 bg-white text-slate-900"
                  placeholder="e.g. Nanakheda Zone"
                  required
                />
              </div>
            </div>
          </div>

          {/* STATUS */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</h4>
            
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={isActive}
                  onChange={() => setIsActive(true)}
                  className="h-4 w-4 text-brand focus:ring-brand border-slate-300"
                />
                <span className="text-sm font-semibold text-slate-700">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={!isActive}
                  onChange={() => setIsActive(false)}
                  className="h-4 w-4 text-brand focus:ring-brand border-slate-300"
                />
                <span className="text-sm font-semibold text-slate-700">Inactive</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => !busy && onClose()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <AppPrimaryButton type="submit" disabled={busy} className="!w-auto px-6">
              {busy ? 'Saving...' : 'Create Zone'}
            </AppPrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export function AdminZoneManagementPage() {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState({ message: '', variant: 'success' })
  
  const [modalOpen, setModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState(null)

  const showToast = useCallback((message, variant = 'success') => {
    setToast({ message, variant })
    setTimeout(() => setToast({ message: '', variant: 'success' }), 3500)
  }, [])

  const loadZones = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminZonesApi.getAllZones({ search })
      setZones(res.data?.zones || [])
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to load zones', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, showToast])

  useEffect(() => {
    loadZones()
  }, [loadZones])

  const handleToggleStatus = async (zone) => {
    try {
      await adminZonesApi.toggleZoneStatus(zone._id)
      showToast(`Zone ${zone.isActive ? 'deactivated' : 'activated'} successfully`)
      loadZones()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to toggle status', 'error')
    }
  }

  const handleDelete = async (zone) => {
    if (!window.confirm(`Are you sure you want to delete ${zone.name}?`)) return
    try {
      await adminZonesApi.deleteZone(zone._id)
      showToast('Zone deleted successfully')
      loadZones()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to delete zone', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Toast message={toast.message} variant={toast.variant} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-brand text-white shadow-lg ring-4 ring-brand/10">
            <Map className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Zone Management</h1>
            <p className="text-sm text-slate-500">Create and manage operational zones and boundaries</p>
          </div>
        </div>

        <AppPrimaryButton 
          onClick={() => { setEditingZone(null); setModalOpen(true); }}
          className="!w-auto !py-2.5 shadow-md shadow-brand/20"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Zone
        </AppPrimaryButton>
      </div>

      <GlassPanel className="p-0 overflow-hidden flex flex-col min-h-[500px]">
        <div className="border-b border-slate-100 bg-white p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search zones by name, city, state..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 text-slate-900"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4">Zone Name</th>
                <th className="px-5 py-4">Location</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">Loading zones...</td>
                </tr>
              ) : zones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">No zones found.</td>
                </tr>
              ) : (
                zones.map(zone => (
                  <tr key={zone._id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-slate-900">{zone.name}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {zone.city}, {zone.state} <br/>
                      <span className="text-xs text-slate-400">{zone.country}</span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(zone)}
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 transition ${
                          zone.isActive 
                            ? 'bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-100' 
                            : 'bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {zone.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setEditingZone(zone); setModalOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-brand hover:bg-slate-100 rounded-lg transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(zone)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      <ZoneModal 
        open={modalOpen} 
        zone={editingZone} 
        onClose={() => setModalOpen(false)} 
        onSaved={() => { setModalOpen(false); loadZones(); }}
      />
    </div>
  )
}
