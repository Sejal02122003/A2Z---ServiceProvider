import { useCallback, useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Plus, Search, RefreshCw, Edit2, Trash2, Wrench, Eye, X, AlertTriangle, Package } from 'lucide-react'

import {
  fetchAdminLabourCategoryTree,
  createAdminLabourService,
  updateAdminLabourService,
  deleteAdminLabourService,
  getAdminLabourServiceById,
} from '../../api/adminLabourCategoriesApi.js'
import { adminZonesApi } from '../../api/adminZonesApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { SearchableSelect } from '../../components/ui/SearchableSelect.jsx'
import { MultiSearchableSelect } from '../../components/ui/MultiSearchableSelect.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { getCategoryImageUrl } from '../../lib/labourCategoryDisplay.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import { assetUrlFromUpload, uploadMedia } from '../../api/uploadApi.js'

function AddServiceModal({ open, subcategories, activeZones = [], onClose, onSaved, busy, setBusy }) {
  const [name, setName] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [chargeType, setChargeType] = useState('PER_HOUR')
  const [unitName, setUnitName] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState(0)
  const [basePrice, setBasePrice] = useState(0)
  const [hourlyPrice, setHourlyPrice] = useState(0)
  const [minHours, setMinHours] = useState(1)
  const [maxHours, setMaxHours] = useState(24)
  const [discountType, setDiscountType] = useState('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState(0)
  const [zones, setZones] = useState([])
  const [iconUrl, setIconUrl] = useState('')
  const [subServices, setSubServices] = useState([])
  const [isActive, setIsActive] = useState(true)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setSubcategoryId(subcategories[0]?._id ?? '')
      setDescription('')
      setChargeType('PER_HOUR')
      setUnitName('')
      setPricePerUnit(0)
      setBasePrice(0)
      setHourlyPrice(0)
      setMinHours(1)
      setMaxHours(24)
      setDiscountType('PERCENTAGE')
      setDiscountValue(0)
      setZones([])
      setIconUrl('')
      setSubServices([])
      setIsActive(true)
      setError('')
    }
  }, [open, subcategories])

  if (!open) return null

  async function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    setError('')
    setUploadBusy(true)
    try {
      const uploaded = await uploadMedia(file, UPLOAD_FOLDERS.LABOUR_CATEGORIES)
      const url = assetUrlFromUpload(uploaded)
      if (url) setIconUrl(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !subcategoryId) {
      setError('Name and sub-category are required.')
      return
    }
    setError('')
    setBusy(true)
    try {
      let resolvedBasePrice = 0
      let resolvedHourlyPrice = 0
      let resolvedPricePerUnit = 0

      if (chargeType === 'PER_HOUR') {
        resolvedHourlyPrice = Number(hourlyPrice) || 0
        resolvedBasePrice = resolvedHourlyPrice
      } else if (chargeType === 'UNIT_WISE') {
        resolvedPricePerUnit = Number(pricePerUnit) || 0
        resolvedBasePrice = resolvedPricePerUnit
      } else {
        resolvedBasePrice = Number(basePrice) || 0
      }

      const payload = {
        name: name.trim(),
        subcategoryId,
        description: description.trim(),
        chargeType,
        unitName: chargeType === 'UNIT_WISE' ? unitName.trim() : '',
        pricePerUnit: resolvedPricePerUnit,
        basePrice: resolvedBasePrice,
        hourlyPrice: resolvedHourlyPrice,
        minHours: chargeType === 'PER_HOUR' ? (parseFloat(minHours) || 0.5) : 1,
        maxHours: chargeType === 'PER_HOUR' ? Number(maxHours || 24) : 24,
        discountType,
        discountValue: Number(discountValue),
        isAllZones: zones.length === activeZones.length,
        zones: zones
          .filter(z => (typeof z.zone === 'object' ? z.zone?._id : z.zone))
          .map(z => ({
            zone: typeof z.zone === 'object' ? z.zone._id : z.zone,
            price: Number(z.price) > 0 ? Number(z.price) : Number(resolvedBasePrice || resolvedHourlyPrice || 0)
          })),
        subServices: subServices
          .filter((ss) => ss.name && ss.name.trim())
          .map((ss) => {
            const fallbackP = Number(resolvedBasePrice || resolvedHourlyPrice || 0)
            const p = Number(ss.price) > 0 ? Number(ss.price) : fallbackP
            const op = Number(ss.originalPrice) > 0 ? Number(ss.originalPrice) : p
            return {
              name: ss.name.trim(),
              description: String(ss.description || '').trim(),
              price: p,
              originalPrice: op,
              estimatedDurationMins: Number(ss.estimatedDurationMins || 30),
              isActive: ss.isActive !== false,
            }
          }),
        iconUrl: iconUrl.trim() || undefined,
        isActive
      }
      await createAdminLabourService(payload)
      setBusy(false)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save service')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={() => !busy && !uploadBusy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4 flex justify-between items-center">
          <h3 className="text-lg font-extrabold text-slate-900">Add Service</h3>
          <button onClick={() => !busy && !uploadBusy && onClose()} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5 max-h-[80vh] overflow-y-auto">
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Sub-Category</label>
              <SearchableSelect
                value={subcategoryId}
                onChange={setSubcategoryId}
                options={subcategories.map(sc => ({ value: sc._id, label: `${sc.name} (${sc.categoryName})` }))}
                placeholder="Select a sub-category"
              />
            </div>
            
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                placeholder="Optional description"
              />
            </div>

            {/* Charges Option: 3 options */}
            <div className="col-span-2">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Charges Option</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setChargeType('PER_HOUR')}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition ${
                    chargeType === 'PER_HOUR'
                      ? 'border-brand bg-brand/5 text-brand ring-2 ring-brand/20 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base">⏱️</span>
                  <span className="text-xs font-bold">Per Hour</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChargeType('UNIT_WISE')}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition ${
                    chargeType === 'UNIT_WISE'
                      ? 'border-brand bg-brand/5 text-brand ring-2 ring-brand/20 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base">📦</span>
                  <span className="text-xs font-bold">Unit Wise</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChargeType('NONE')}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition ${
                    chargeType === 'NONE'
                      ? 'border-brand bg-brand/5 text-brand ring-2 ring-brand/20 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base">🏷️</span>
                  <span className="text-xs font-bold">Fixed / Flat</span>
                </button>
              </div>
            </div>

            {/* Dynamic Charge Inputs */}
            {chargeType === 'PER_HOUR' && (
              <>
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Hourly Rate (₹/hr)</label>
                  <input
                    type="number"
                    min="0"
                    value={hourlyPrice}
                    onChange={(e) => setHourlyPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Min Hours <span className="normal-case font-normal text-slate-400">(0.5 = 30 min)</span></label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={minHours}
                    onChange={(e) => setMinHours(parseFloat(e.target.value) || 0.5)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Max Hours</label>
                  <input
                    type="number"
                    min="1"
                    value={maxHours}
                    onChange={(e) => setMaxHours(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                  />
                </div>
              </>
            )}

            {chargeType === 'UNIT_WISE' && (
              <>
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Unit Name</label>
                  <input
                    type="text"
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    placeholder="e.g. sq ft, piece, room, tap"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {['sq ft', 'piece', 'item', 'room', 'tap', 'point', 'appliance', 'kg'].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setUnitName(chip)}
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition ${
                          unitName === chip ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
                    Price per {unitName || 'Unit'} (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                  />
                </div>
              </>
            )}

            {chargeType === 'NONE' && (
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Fixed / Flat Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Discount Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 bg-white"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
                Discount {discountType === 'PERCENTAGE' ? '(%)' : '(₹)'}
              </label>
              <input
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
              />
            </div>

            <div className="col-span-2 space-y-3">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Zone Availability & Pricing</label>
              {zones.map((zoneItem, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1">
                    <select
                      value={typeof zoneItem.zone === 'object' ? zoneItem.zone._id : (zoneItem.zone || '')}
                      onChange={(e) => {
                        const newZones = [...zones];
                        newZones[idx].zone = e.target.value;
                        setZones(newZones);
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 bg-white"
                    >
                      <option value="">Select Zone</option>
                      {activeZones.map(z => (
                        <option key={z._id} value={z._id}>{z.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={zoneItem.price}
                      onChange={(e) => {
                        const newZones = [...zones];
                        newZones[idx].price = Number(e.target.value);
                        setZones(newZones);
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newZones = zones.filter((_, i) => i !== idx);
                      setZones(newZones);
                    }}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setZones([...zones, { zone: '', price: 0 }])}
                className="flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand/80"
              >
                <Plus className="h-4 w-4" />
                Add Zone Price
              </button>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35"
                />
                <span className="text-sm font-semibold text-slate-700">Active</span>
              </label>
            </div>

            <div className="col-span-2 space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500">Icon</label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-2 ring-slate-200">
                  {iconUrl ? (
                    <img src={getCategoryImageUrl({ name, imageUrl: iconUrl })} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-slate-400">None</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex gap-2">
                    <input type="file" accept="image/*" onChange={handleFilePick} className="hidden" id="add-svc-img" />
                    <label
                      htmlFor="add-svc-img"
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {uploadBusy ? 'Uploading...' : 'Upload'}
                    </label>
                    {iconUrl && (
                      <button
                        type="button"
                        onClick={() => setIconUrl('')}
                        className="text-[11px] font-bold text-rose-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="Or paste URL"
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand/35"
                  />
                </div>
              </div>
            </div>

            {/* Sub-Services / Variants Section */}
            <div className="col-span-2 space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-indigo-950">
                    Sub-Services / Variants
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Add specific sub-services or options (e.g. Split AC, Window AC, Beard Trim) with their own pricing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubServices([...subServices, { name: '', price: Number(hourlyPrice || basePrice || pricePerUnit || 0), estimatedDurationMins: 30, description: '', isActive: true }])}
                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Sub-Service
                </button>
              </div>

              {subServices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-indigo-200 bg-white/60 p-4 text-center">
                  <p className="text-xs text-slate-500">No sub-services added yet. Click &quot;Add Sub-Service&quot; to configure options.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {subServices.map((subItem, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Sub-Service #{idx + 1}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600">
                            <input
                              type="checkbox"
                              checked={subItem.isActive !== false}
                              onChange={(e) => {
                                const next = [...subServices];
                                next[idx].isActive = e.target.checked;
                                setSubServices(next);
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Active
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setSubServices(subServices.filter((_, i) => i !== idx));
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1"
                            title="Remove Sub-Service"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Sub-Service Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Split AC Deep Cleaning"
                            value={subItem.name}
                            onChange={(e) => {
                              const next = [...subServices];
                              next[idx].name = e.target.value;
                              setSubServices(next);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Price (₹)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Price"
                            value={subItem.price}
                            onChange={(e) => {
                              const next = [...subServices];
                              next[idx].price = Number(e.target.value);
                              setSubServices(next);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Duration (mins)</label>
                          <input
                            type="number"
                            min="5"
                            placeholder="30"
                            value={subItem.estimatedDurationMins || 30}
                            onChange={(e) => {
                              const next = [...subServices];
                              next[idx].estimatedDurationMins = Number(e.target.value);
                              setSubServices(next);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Description (Optional)</label>
                          <input
                            type="text"
                            placeholder="Short details or inclusions"
                            value={subItem.description || ''}
                            onChange={(e) => {
                              const next = [...subServices];
                              next[idx].description = e.target.value;
                              setSubServices(next);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => !busy && !uploadBusy && onClose()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <AppPrimaryButton type="submit" disabled={busy || uploadBusy} className="!w-auto px-6">
              {busy ? 'Creating...' : 'Create Service'}
            </AppPrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function EditServiceModal({ open, service, subcategories, activeZones = [], onClose, onSaved, busy, setBusy }) {
  const [name, setName] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [chargeType, setChargeType] = useState('PER_HOUR')
  const [unitName, setUnitName] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState(0)
  const [basePrice, setBasePrice] = useState(0)
  const [hourlyPrice, setHourlyPrice] = useState(0)
  const [minHours, setMinHours] = useState(1)
  const [maxHours, setMaxHours] = useState(24)
  const [discountType, setDiscountType] = useState('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState(0)
  const [zones, setZones] = useState([])
  const [iconUrl, setIconUrl] = useState('')
  const [subServices, setSubServices] = useState([])
  const [isActive, setIsActive] = useState(true)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && service) {
      setName(service.name || '')
      setSubcategoryId(service.subcategoryId || (subcategories[0]?._id ?? ''))
      setDescription(service.description || '')
      setChargeType(service.chargeType || 'PER_HOUR')
      setUnitName(service.unitName || '')
      setPricePerUnit(service.pricePerUnit ?? service.basePrice ?? 0)
      setBasePrice(service.basePrice ?? service.hourlyPrice ?? 0)
      setHourlyPrice(service.hourlyPrice ?? service.basePrice ?? 0)
      setMinHours(service.minHours ?? 1)
      setMaxHours(service.maxHours ?? 24)
      setDiscountType(service.discountType ?? 'PERCENTAGE')
      setDiscountValue(service.discountValue ?? 0)
      
      const safeZones = (service.zones ?? []).map(z => {
        if (typeof z === 'string') return { zone: z, price: service.hourlyPrice ?? 0 }
        return z
      })
      setZones(safeZones)
      
      setIconUrl(service.iconUrl || '')
      setSubServices(Array.isArray(service.subServices) ? service.subServices.map(ss => ({ ...ss })) : [])
      setIsActive(service.isActive ?? true)
      setError('')
    }
  }, [open, service, subcategories])

  if (!open || !service) return null

  async function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    setError('')
    setUploadBusy(true)
    try {
      const uploaded = await uploadMedia(file, UPLOAD_FOLDERS.LABOUR_CATEGORIES)
      const url = assetUrlFromUpload(uploaded)
      if (url) setIconUrl(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !subcategoryId) {
      setError('Name and sub-category are required.')
      return
    }
    setError('')
    setBusy(true)
    try {
      let resolvedBasePrice = 0
      let resolvedHourlyPrice = 0
      let resolvedPricePerUnit = 0

      if (chargeType === 'PER_HOUR') {
        resolvedHourlyPrice = Number(hourlyPrice) || 0
        resolvedBasePrice = resolvedHourlyPrice
      } else if (chargeType === 'UNIT_WISE') {
        resolvedPricePerUnit = Number(pricePerUnit) || 0
        resolvedBasePrice = resolvedPricePerUnit
      } else {
        resolvedBasePrice = Number(basePrice) || 0
      }

      const payload = {
        name: name.trim(),
        subcategoryId,
        description: description.trim(),
        chargeType,
        unitName: chargeType === 'UNIT_WISE' ? unitName.trim() : '',
        pricePerUnit: resolvedPricePerUnit,
        basePrice: resolvedBasePrice,
        hourlyPrice: resolvedHourlyPrice,
        minHours: chargeType === 'PER_HOUR' ? (parseFloat(minHours) || 0.5) : 1,
        maxHours: chargeType === 'PER_HOUR' ? Number(maxHours || 24) : 24,
        discountType,
        discountValue: Number(discountValue),
        isAllZones: zones.length === activeZones.length,
        zones: zones
          .filter(z => (typeof z.zone === 'object' ? z.zone?._id : z.zone))
          .map(z => ({
            zone: typeof z.zone === 'object' ? z.zone._id : z.zone,
            price: Number(z.price) > 0 ? Number(z.price) : Number(resolvedBasePrice || resolvedHourlyPrice || 0)
          })),
        subServices: subServices
          .filter((ss) => ss.name && ss.name.trim())
          .map((ss) => {
            const fallbackP = Number(resolvedBasePrice || resolvedHourlyPrice || 0)
            const p = Number(ss.price) > 0 ? Number(ss.price) : fallbackP
            const op = Number(ss.originalPrice) > 0 ? Number(ss.originalPrice) : p
            return {
              ...(ss._id ? { _id: ss._id } : {}),
              name: ss.name.trim(),
              description: String(ss.description || '').trim(),
              price: p,
              originalPrice: op,
              estimatedDurationMins: Number(ss.estimatedDurationMins || 30),
              isActive: ss.isActive !== false,
            }
          }),
        iconUrl: iconUrl.trim() || undefined,
        isActive
      }
      await updateAdminLabourService(service._id, payload)
      setBusy(false)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save service')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={() => !busy && !uploadBusy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4 flex justify-between items-center">
          <h3 className="text-lg font-extrabold text-slate-900">Edit Service</h3>
          <button onClick={() => !busy && !uploadBusy && onClose()} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5 max-h-[80vh] overflow-y-auto">
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Sub-Category</label>
              <SearchableSelect
                value={subcategoryId}
                onChange={setSubcategoryId}
                options={subcategories.map(sc => ({ value: sc._id, label: `${sc.name} (${sc.categoryName})` }))}
                placeholder="Select a sub-category"
              />
            </div>
            
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                placeholder="Optional description"
              />
            </div>

            {/* Charges Option: 3 options */}
            <div className="col-span-2">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Charges Option</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setChargeType('PER_HOUR')}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition ${
                    chargeType === 'PER_HOUR'
                      ? 'border-brand bg-brand/5 text-brand ring-2 ring-brand/20 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base">⏱️</span>
                  <span className="text-xs font-bold">Per Hour</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChargeType('UNIT_WISE')}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition ${
                    chargeType === 'UNIT_WISE'
                      ? 'border-brand bg-brand/5 text-brand ring-2 ring-brand/20 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base">📦</span>
                  <span className="text-xs font-bold">Unit Wise</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChargeType('NONE')}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition ${
                    chargeType === 'NONE'
                      ? 'border-brand bg-brand/5 text-brand ring-2 ring-brand/20 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base">🏷️</span>
                  <span className="text-xs font-bold">Fixed / Flat</span>
                </button>
              </div>
            </div>

            {/* Dynamic Charge Inputs */}
            {chargeType === 'PER_HOUR' && (
              <>
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Hourly Rate (₹/hr)</label>
                  <input
                    type="number"
                    min="0"
                    value={hourlyPrice}
                    onChange={(e) => setHourlyPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Min Hours <span className="normal-case font-normal text-slate-400">(0.5 = 30 min)</span></label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={minHours}
                    onChange={(e) => setMinHours(parseFloat(e.target.value) || 0.5)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Max Hours</label>
                  <input
                    type="number"
                    min="1"
                    value={maxHours}
                    onChange={(e) => setMaxHours(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                  />
                </div>
              </>
            )}

            {chargeType === 'UNIT_WISE' && (
              <>
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Unit Name</label>
                  <input
                    type="text"
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    placeholder="e.g. sq ft, piece, room, tap"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {['sq ft', 'piece', 'item', 'room', 'tap', 'point', 'appliance', 'kg'].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setUnitName(chip)}
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition ${
                          unitName === chip ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
                    Price per {unitName || 'Unit'} (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                  />
                </div>
              </>
            )}

            {chargeType === 'NONE' && (
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Fixed / Flat Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Discount Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 bg-white"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
                Discount {discountType === 'PERCENTAGE' ? '(%)' : '(₹)'}
              </label>
              <input
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
              />
            </div>

            <div className="col-span-2 space-y-3">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Zone Availability & Pricing</label>
              {zones.map((zoneItem, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1">
                    <select
                      value={typeof zoneItem.zone === 'object' ? zoneItem.zone._id : (zoneItem.zone || '')}
                      onChange={(e) => {
                        const newZones = [...zones];
                        newZones[idx].zone = e.target.value;
                        setZones(newZones);
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 bg-white"
                    >
                      <option value="">Select Zone</option>
                      {activeZones.map(z => (
                        <option key={z._id} value={z._id}>{z.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={zoneItem.price}
                      onChange={(e) => {
                        const newZones = [...zones];
                        newZones[idx].price = Number(e.target.value);
                        setZones(newZones);
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newZones = zones.filter((_, i) => i !== idx);
                      setZones(newZones);
                    }}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setZones([...zones, { zone: '', price: 0 }])}
                className="flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand/80"
              >
                <Plus className="h-4 w-4" />
                Add Zone Price
              </button>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35"
                />
                <span className="text-sm font-semibold text-slate-700">Active</span>
              </label>
            </div>

            <div className="col-span-2 space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500">Icon</label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-2 ring-slate-200">
                  {iconUrl ? (
                    <img src={getCategoryImageUrl({ name, imageUrl: iconUrl })} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-slate-400">None</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex gap-2">
                    <input type="file" accept="image/*" onChange={handleFilePick} className="hidden" id="edit-svc-img" />
                    <label
                      htmlFor="edit-svc-img"
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {uploadBusy ? 'Uploading...' : 'Upload'}
                    </label>
                    {iconUrl && (
                      <button
                        type="button"
                        onClick={() => setIconUrl('')}
                        className="text-[11px] font-bold text-rose-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="Or paste URL"
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand/35"
                  />
                </div>
              </div>
            </div>

            {/* Sub-Services / Variants Section */}
            <div className="col-span-2 space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-indigo-950">
                    Sub-Services / Variants
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Add specific sub-services or options (e.g. Split AC, Window AC, Beard Trim) with their own pricing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubServices([...subServices, { name: '', price: Number(hourlyPrice || basePrice || pricePerUnit || 0), estimatedDurationMins: 30, description: '', isActive: true }])}
                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Sub-Service
                </button>
              </div>

              {subServices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-indigo-200 bg-white/60 p-4 text-center">
                  <p className="text-xs text-slate-500">No sub-services configured for this service. Click &quot;Add Sub-Service&quot; to configure options.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {subServices.map((subItem, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Sub-Service #{idx + 1}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600">
                            <input
                              type="checkbox"
                              checked={subItem.isActive !== false}
                              onChange={(e) => {
                                const next = [...subServices];
                                next[idx].isActive = e.target.checked;
                                setSubServices(next);
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Active
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setSubServices(subServices.filter((_, i) => i !== idx));
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1"
                            title="Remove Sub-Service"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Sub-Service Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Split AC Deep Cleaning"
                            value={subItem.name}
                            onChange={(e) => {
                              const next = [...subServices];
                              next[idx].name = e.target.value;
                              setSubServices(next);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Price (₹)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Price"
                            value={subItem.price}
                            onChange={(e) => {
                              const next = [...subServices];
                              next[idx].price = Number(e.target.value);
                              setSubServices(next);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Duration (mins)</label>
                          <input
                            type="number"
                            min="5"
                            placeholder="30"
                            value={subItem.estimatedDurationMins || 30}
                            onChange={(e) => {
                              const next = [...subServices];
                              next[idx].estimatedDurationMins = Number(e.target.value);
                              setSubServices(next);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Description (Optional)</label>
                          <input
                            type="text"
                            placeholder="Short details or inclusions"
                            value={subItem.description || ''}
                            onChange={(e) => {
                              const next = [...subServices];
                              next[idx].description = e.target.value;
                              setSubServices(next);
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => !busy && !uploadBusy && onClose()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <AppPrimaryButton type="submit" disabled={busy || uploadBusy} className="!w-auto px-6">
              {busy ? 'Saving...' : 'Save Changes'}
            </AppPrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function ViewServiceModal({ open, service, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && service?._id) {
      setLoading(true)
      setError('')
      getAdminLabourServiceById(service._id)
        .then(res => setData(res.data.service))
        .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to fetch details'))
        .finally(() => setLoading(false))
    } else {
      setData(null)
    }
  }, [open, service])

  if (!open || !service) return null
  
  const displayData = data || service
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
      >
        <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex justify-between items-center">
          <h3 className="text-lg font-extrabold text-slate-900">Service Details</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-slate-500">Loading details...</div>
          ) : error ? (
            <div className="text-center py-10 text-rose-500">{error}</div>
          ) : (
            <>
              <div className="flex justify-center">
                 <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100 ring-4 ring-slate-50 shadow-sm flex items-center justify-center">
                    {displayData.iconUrl ? (
                      <img src={getCategoryImageUrl({ name: displayData.name, imageUrl: displayData.iconUrl })} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Wrench className="h-8 w-8 text-slate-300" />
                    )}
                 </div>
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-xl font-bold text-slate-900">{displayData.name}</h4>
                <p className="text-sm font-semibold text-brand">{displayData.subcategoryName}</p>
                <p className="text-xs text-slate-500">{displayData.categoryName}</p>
              </div>
              
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Description</p>
                  <p className="text-sm font-medium text-slate-700">{displayData.description || '—'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Charge Type</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {displayData.chargeType === 'UNIT_WISE'
                        ? '📦 Unit Wise'
                        : displayData.chargeType === 'NONE'
                        ? '🏷️ Fixed / Flat'
                        : '⏱️ Per Hour'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Price / Rate</p>
                    <p className="text-sm font-bold text-blue-600 font-mono">
                      {displayData.chargeType === 'UNIT_WISE'
                        ? `₹${displayData.pricePerUnit || displayData.basePrice || 0} / ${displayData.unitName || 'unit'}`
                        : displayData.chargeType === 'NONE'
                        ? `₹${displayData.basePrice || displayData.hourlyPrice || 0} (Fixed)`
                        : `₹${displayData.hourlyPrice || displayData.basePrice || 0}/hr`}
                    </p>
                  </div>
                  {displayData.chargeType === 'PER_HOUR' && (
                    <>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Min Hours</p>
                        <p className="text-sm font-medium text-slate-700">{displayData.minHours || 1} hr</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Max Hours</p>
                        <p className="text-sm font-medium text-slate-700">{displayData.maxHours || 24} hrs</p>
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                    displayData.isActive ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                  }`}>
                    {displayData.isActive ? 'Active' : 'Hidden'}
                  </span>
                </div>

                {/* Sub-Services / Variants */}
                <div className="pt-3 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Sub-Services / Variants
                    </p>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      {(displayData.subServices || []).length} items
                    </span>
                  </div>

                  {(displayData.subServices || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No sub-services configured for this service.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {displayData.subServices.map((ss, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-bold text-slate-800 truncate">{ss.name}</p>
                            {ss.description && <p className="text-[10px] text-slate-500 truncate mt-0.5">{ss.description}</p>}
                            <span className="inline-block text-[10px] text-slate-400 font-medium mt-0.5">⏱️ {ss.estimatedDurationMins || 30} mins</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-blue-600 font-mono">₹{ss.price}</span>
                            <span className={`block text-[9px] font-bold ${ss.isActive !== false ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {ss.isActive !== false ? 'Active' : 'Hidden'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="bg-slate-50 px-5 py-4 text-right">
          <button
            onClick={onClose}
            className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function DeleteServiceModal({ open, service, onClose, onDeleted, busy, setBusy }) {
  if (!open || !service) return null

  async function handleConfirm() {
    setBusy(true)
    try {
      await deleteAdminLabourService(service._id)
      setBusy(false)
      onDeleted()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Delete failed')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-4">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Delete Service?</h3>
        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to delete <span className="font-bold text-slate-900">{service.name}</span>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function BulkDeleteServiceModal({ open, count, onClose, onConfirmed, busy }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-4">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Delete {count} {count === 1 ? 'Service' : 'Services'}?</h3>
        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to delete <span className="font-bold text-slate-900">{count} selected {count === 1 ? 'service' : 'services'}</span>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmed}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? 'Deleting...' : 'Delete All'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export function AdminServicesPage() {
  const reduce = useReducedMotion()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [subcategories, setSubcategories] = useState([])
  const [services, setServices] = useState([])

  // Selection state for multiple delete
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false)
  
  // Filters & Search
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [subcategoryFilter, setSubcategoryFilter] = useState('all')
  const [zoneFilter, setZoneFilter] = useState('all')

  // Pagination
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  
  // Modals state
  const [modalBusy, setModalBusy] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editService, setEditService] = useState(null)
  const [viewService, setViewService] = useState(null)
  const [deleteService, setDeleteService] = useState(null)
  const [activeZones, setActiveZones] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [treeRes, zonesRes] = await Promise.all([
        fetchAdminLabourCategoryTree(),
        adminZonesApi.getActiveZones().catch(() => ({ data: { zones: [] } }))
      ])
      
      const fetchedCategories = treeRes.data?.categories || []
      setActiveZones(zonesRes.data?.zones || [])
      
      const flatSubcategories = fetchedCategories.flatMap(c => 
        (c.subcategories || []).map(sc => ({
          ...sc,
          categoryId: c._id,
          categoryName: c.name
        }))
      )
      setSubcategories(flatSubcategories)

      const flatServices = flatSubcategories.flatMap(sc => 
        (sc.services || []).map(s => ({
          ...s,
          subcategoryId: sc._id,
          subcategoryName: sc.name,
          categoryName: sc.categoryName
        }))
      )
      setServices(flatServices)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load services')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, subcategoryFilter, zoneFilter, limit])

  const filteredServices = useMemo(() => {
    let result = services

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.subcategoryName.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
      )
    }

    if (statusFilter === 'active') result = result.filter(s => s.isActive)
    else if (statusFilter === 'hidden') result = result.filter(s => !s.isActive)

    if (subcategoryFilter !== 'all') {
      result = result.filter(s => s.subcategoryId === subcategoryFilter)
    }

    if (zoneFilter !== 'all') {
      result = result.filter(s => {
        if (s.isAllZones) return true;
        return (s.zones || []).some(z => {
          const zid = typeof z === 'string' ? z : (typeof z.zone === 'object' ? z.zone?._id : z.zone);
          return String(zid) === zoneFilter;
        });
      });
    }

    return result
  }, [services, debouncedSearch, statusFilter, subcategoryFilter, zoneFilter])

  const totalPages = Math.ceil(filteredServices.length / limit) || 1
  const paginatedServices = filteredServices.slice((page - 1) * limit, page * limit)
  const activeCount = services.filter(s => s.isActive).length

  const isAllCurrentSelected = paginatedServices.length > 0 && paginatedServices.every(s => selectedIds.includes(s._id))

  const toggleSelectAll = () => {
    if (isAllCurrentSelected) {
      setSelectedIds(prev => prev.filter(id => !paginatedServices.some(s => s._id === id)))
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...paginatedServices.map(s => s._id)])))
    }
  }

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) return
    setBulkDeleteBusy(true)
    try {
      const results = await Promise.allSettled(
        selectedIds.map(id => deleteAdminLabourService(id))
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        alert(`Failed to delete ${failed.length} services. Some may be in use.`)
      }
      setSelectedIds([])
      setBulkDeleteModalOpen(false)
      load()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Bulk delete failed')
    } finally {
      setBulkDeleteBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Services</h2>
          <p className="mt-1 text-sm text-slate-600">Manage individual services mapped to sub-categories.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <AppPrimaryButton onClick={() => setAddModalOpen(true)} className="!w-auto px-4 shadow-md">
            <Plus className="h-4 w-4" />
            Add Service
          </AppPrimaryButton>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GlassPanel className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Services</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{services.length}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Active</p>
          <p className="mt-2 text-3xl font-black text-blue-600">{activeCount}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Sub-Categories</p>
          <p className="mt-2 text-3xl font-black text-brand">{subcategories.length}</p>
        </GlassPanel>
      </div>


      <GlassPanel className="relative z-20 p-4 md:p-5 space-y-3">
        {/* Search bar — full width */}
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services by name, sub-category or description..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-[190px]">
            <SearchableSelect
              value={zoneFilter}
              onChange={setZoneFilter}
              options={[{ value: 'all', label: 'All Zones (Global)' }, ...activeZones.map(z => ({ value: z._id, label: z.name }))]}
            />
          </div>
          <div className="w-[210px]">
            <SearchableSelect
              value={subcategoryFilter}
              onChange={setSubcategoryFilter}
              options={[{ value: 'all', label: 'All Sub-Categories' }, ...subcategories.map(sc => ({ value: sc._id, label: sc.name }))]}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-brand/35"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="hidden">Hidden Only</option>
          </select>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-brand/35"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>

          {/* Active filter indicators */}
          {(search || subcategoryFilter !== 'all' || zoneFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSubcategoryFilter('all'); setZoneFilter('all'); setStatusFilter('all') }}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </GlassPanel>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700 font-bold text-xs">
              {selectedIds.length}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-rose-950">
                {selectedIds.length === 1 ? '1 service selected' : `${selectedIds.length} services selected`}
              </span>
              {selectedIds.length < filteredServices.length && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(filteredServices.map(s => s._id))}
                  className="text-xs font-semibold text-rose-700 underline hover:text-rose-900 transition ml-1"
                >
                  Select all {filteredServices.length} matching
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected ({selectedIds.length})
            </button>
          </div>
        </motion.div>
      )}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>
      ) : null}

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35 cursor-pointer accent-brand"
                    title="Select all on current page"
                  />
                </th>
                <th className="px-4 py-3">Icon</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Sub-Category</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Charges / Rate</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && services.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">Loading...</td>
                </tr>
              ) : paginatedServices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">No services found.</td>
                </tr>
              ) : (
                paginatedServices.map(s => (
                  <tr
                    key={s._id}
                    className={`border-b border-slate-100 transition ${
                      selectedIds.includes(s._id) ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s._id)}
                        onChange={() => toggleSelectOne(s._id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35 cursor-pointer accent-brand"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-10 w-10 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center">
                        {s.iconUrl ? (
                          <img src={getCategoryImageUrl({ name: s.name, imageUrl: s.iconUrl })} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Wrench className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        {Array.isArray(s.subServices) && s.subServices.length > 0 && (
                          <span
                            title={s.subServices.map(ss => `${ss.name} (₹${ss.price})`).join(', ')}
                            className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/70"
                          >
                            {s.subServices.length} sub-svc
                          </span>
                        )}
                      </div>
                      {s.description && <p className="text-xs text-slate-500 truncate max-w-[200px]">{s.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {s.subcategoryName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[11px] font-semibold text-slate-700">{s.categoryName}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
                      {(() => {
                        const ct = s.chargeType || 'PER_HOUR';
                        let displayPrice = ct === 'UNIT_WISE'
                          ? (s.pricePerUnit || s.basePrice || s.hourlyPrice || 0)
                          : ct === 'NONE'
                          ? (s.basePrice || s.hourlyPrice || 0)
                          : (s.hourlyPrice || s.basePrice || 0);
                        let isZonePrice = false;
                        if (zoneFilter !== 'all') {
                          const matchedZone = (s.zones || []).find(z => {
                            const zid = typeof z === 'string' ? z : (typeof z.zone === 'object' ? z.zone?._id : z.zone);
                            return String(zid) === zoneFilter;
                          });
                          if (matchedZone && typeof matchedZone.price === 'number') {
                            displayPrice = matchedZone.price;
                            isZonePrice = true;
                          }
                        }
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <div className="font-bold text-slate-900">
                              ₹{displayPrice}
                              <span className="text-xs font-normal text-slate-500 ml-0.5">
                                {ct === 'UNIT_WISE' ? `/${s.unitName || 'unit'}` : ct === 'NONE' ? ' (flat)' : '/hr'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                                {ct === 'UNIT_WISE' ? '📦 Unit' : ct === 'NONE' ? '🏷️ Fixed' : '⏱️ Hourly'}
                              </span>
                              {zoneFilter !== 'all' ? (
                                isZonePrice ? (
                                  <span className="rounded bg-brand/10 px-1 py-0.5 text-[9px] font-bold text-brand uppercase tracking-wider">Zone</span>
                                ) : (
                                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Global</span>
                                )
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                        s.isActive ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                      }`}>
                        {s.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/admin/inventory?tab=service-materials`}
                          title="Configure Required Materials"
                          className="rounded-lg border border-transparent p-1.5 text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition"
                        >
                          <Package className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => setViewService(s)}
                          title="View Details"
                          className="rounded-lg border border-transparent p-1.5 text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-sky-600 transition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditService(s)}
                          title="Edit Service"
                          className="rounded-lg border border-transparent p-1.5 text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-brand transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteService(s)}
                          title="Delete Service"
                          className="rounded-lg border border-transparent p-1.5 text-slate-400 hover:border-slate-200 hover:bg-rose-50 hover:text-rose-600 transition"
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
          
          {totalPages > 1 && (
             <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3">
               <p className="text-xs font-semibold text-slate-500">
                 Showing {(page - 1) * limit + 1} to {Math.min(page * limit, filteredServices.length)} of {filteredServices.length}
               </p>
               <div className="flex items-center gap-2">
                 <button
                   onClick={() => setPage(p => Math.max(1, p - 1))}
                   disabled={page === 1}
                   className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                 >
                   Prev
                 </button>
                 <span className="text-xs font-bold text-slate-700">
                   {page} / {totalPages}
                 </span>
                 <button
                   onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                   disabled={page === totalPages}
                   className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                 >
                   Next
                 </button>
               </div>
             </div>
          )}
        </div>
      </GlassPanel>

        <AddServiceModal
          open={addModalOpen}
          subcategories={subcategories}
          activeZones={activeZones}
          onClose={() => setAddModalOpen(false)}
          onSaved={() => {
            setAddModalOpen(false)
            load()
          }}
          busy={modalBusy}
          setBusy={setModalBusy}
        />
        <EditServiceModal
          open={!!editService}
          service={editService}
          subcategories={subcategories}
          activeZones={activeZones}
          onClose={() => setEditService(null)}
          onSaved={() => {
            setEditService(null)
            load()
          }}
          busy={modalBusy}
          setBusy={setModalBusy}
        />

      <ViewServiceModal
        open={!!viewService}
        service={viewService}
        onClose={() => setViewService(null)}
      />

      <DeleteServiceModal
        open={!!deleteService}
        service={deleteService}
        onClose={() => setDeleteService(null)}
        onDeleted={() => {
          setDeleteService(null)
          setModalBusy(false)
          load()
        }}
        busy={modalBusy}
        setBusy={setModalBusy}
      />

      <BulkDeleteServiceModal
        open={bulkDeleteModalOpen}
        count={selectedIds.length}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirmed={handleBulkDelete}
        busy={bulkDeleteBusy}
      />
    </div>
  )
}
