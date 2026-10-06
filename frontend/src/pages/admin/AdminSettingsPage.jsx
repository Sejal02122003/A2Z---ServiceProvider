import { useCallback, useEffect, useState, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Settings, Percent, IndianRupee, Wallet, Receipt, AlertTriangle, CheckCircle2, Loader2, Clock, Image as ImageIcon, Trash2, Radio } from 'lucide-react'
import { adminSettingsApi } from '../../api/adminSettingsApi.js'
import { fetchAdminLabourCategoryTree, updateAdminLabourCategoryGst } from '../../api/adminLabourCategoriesApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { AppModal } from '../../components/app-ui/feedback/AppModal.jsx'
import { AppButton } from '../../components/app-ui/buttons/AppButton.jsx'
import { SearchableSelect } from '../../components/ui/SearchableSelect.jsx'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'

const labelClass = 'text-xs font-bold uppercase tracking-wider text-slate-500'

function SettingsSection({ icon: Icon, title, description, children, accent = 'brand' }) {
  return (
    <GlassPanel className="overflow-hidden p-0">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${accent}/10 text-${accent}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </GlassPanel>
  )
}

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

export function AdminSettingsPage() {
  const reduce = useReducedMotion()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [toast, setToast] = useState({ message: '', variant: 'success' })

  const [rawSettings, setRawSettings] = useState(null)
  const fileInputRef = useRef(null)
  const [uploadType, setUploadType] = useState('logo')
  const [brandingLogo, setBrandingLogo] = useState(null)
  const [brandingFavicon, setBrandingFavicon] = useState(null)
  const [deleteConfirmType, setDeleteConfirmType] = useState(null)

  // Platform Fee
  const [feeType, setFeeType] = useState('percentage')
  const [feeValue, setFeeValue] = useState('')
  const [feeActive, setFeeActive] = useState(true)

  // Commission
  const [commissionType, setCommissionType] = useState('global')
  const [commissionPercent, setCommissionPercent] = useState('')
  const [commissionActive, setCommissionActive] = useState(true)

  // Sync Fee UI when booking type changes
  useEffect(() => {
    if (!rawSettings) return
    const s = rawSettings.platformFee
    if (s) {
      setFeeType(s.type || 'percentage')
      setFeeValue(String(s.value ?? ''))
      setFeeActive(s.isActive !== false)
    } else {
      setFeeType('percentage')
      setFeeValue('')
      setFeeActive(true)
    }
  }, [rawSettings])

  // Sync Commission UI when booking type changes
  useEffect(() => {
    if (!rawSettings) return
    const s = rawSettings.commission
    if (s) {
      setCommissionType(s.type || 'global')
      setCommissionPercent(String(s.globalPercentage ?? ''))
      setCommissionActive(s.isActive !== false)
    } else {
      setCommissionType('global')
      setCommissionPercent('')
      setCommissionActive(true)
    }
  }, [rawSettings])

  // GST
  const [gstPercentage, setGstPercentage] = useState('')

  // Categories for GST
  const [categories, setCategories] = useState([])
  const [selectedGstCategory, setSelectedGstCategory] = useState('')
  const [isGstActive, setIsGstActive] = useState(true)

  // Payment Modes
  const [cashEnabled, setCashEnabled] = useState(true)
  const [onlineEnabled, setOnlineEnabled] = useState(true)


  // Cancellation Penalty
  const [cancellationPenalty, setCancellationPenalty] = useState('')

  // Simulated Opportunities Toggle
  const [simulatedOpportunitiesEnabled, setSimulatedOpportunitiesEnabled] = useState(true)

  // Subscription Settings
  const [isUserSubscriptionEnabled, setIsUserSubscriptionEnabled] = useState(true)
  const [dailySubscriptionPrice, setDailySubscriptionPrice] = useState('')
  const [freeTrialDays, setFreeTrialDays] = useState('')
  const [freeTrialMessage, setFreeTrialMessage] = useState('')
  const [subscriptionStartHour, setSubscriptionStartHour] = useState('')
  const [subscriptionEndHour, setSubscriptionEndHour] = useState('')

  // Max-Hour Discount
  const [maxHourDiscountPercentage, setMaxHourDiscountPercentage] = useState('')



  const showToast = useCallback((message, variant = 'success') => {
    setToast({ message, variant })
    setTimeout(() => setToast({ message: '', variant: 'success' }), 3500)
  }, [])

  useEffect(() => {
    let cancelled = false
    adminSettingsApi.getSettings()
      .then((res) => {
        if (cancelled) return
        const s = res.data?.settings || {}
        setRawSettings(s)
        
        if (s.branding) {
          setBrandingLogo(s.branding.logoUrl)
          setBrandingFavicon(s.branding.faviconUrl)
        }
        
        // Payment Modes
        if (s.paymentModes) {
          if (s.paymentModes.cashEnabled != null) setCashEnabled(s.paymentModes.cashEnabled)
          if (s.paymentModes.onlineEnabled != null) setOnlineEnabled(s.paymentModes.onlineEnabled)
        }
        
        // GST Categories
        fetchAdminLabourCategoryTree().then(res => {
          if (!cancelled && res.data?.categories) {
            setCategories(res.data.categories)
          }
        }).catch(console.error)

        // Cancellation Penalty
        if (s.cancellationPenalty != null) {
          setCancellationPenalty(String(s.cancellationPenalty))
        }

        // Simulated Opportunities
        if (s.simulatedOpportunitiesEnabled != null) {
          setSimulatedOpportunitiesEnabled(Boolean(s.simulatedOpportunitiesEnabled))
        }

        // Subscription Settings
        if (s.isUserSubscriptionEnabled != null) setIsUserSubscriptionEnabled(s.isUserSubscriptionEnabled)
        if (s.dailySubscriptionPrice != null) setDailySubscriptionPrice(String(s.dailySubscriptionPrice))
        if (s.freeTrialDays != null) setFreeTrialDays(String(s.freeTrialDays))
        if (s.freeTrialMessage != null) setFreeTrialMessage(String(s.freeTrialMessage))
        if (s.subscriptionStartHour != null) setSubscriptionStartHour(String(s.subscriptionStartHour))
        if (s.subscriptionEndHour != null) setSubscriptionEndHour(String(s.subscriptionEndHour))
        
        // Max-Hour Discount
        if (s.maxHourDiscountPercentage != null) setMaxHourDiscountPercentage(String(s.maxHourDiscountPercentage))

      })
      .catch((err) => {
        if (!cancelled) showToast(err instanceof ApiError ? err.message : 'Failed to load settings', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [showToast])

  const handleSave = async (section, apiFn, payload) => {
    setSaving(section)
    try {
      await apiFn(payload)
      showToast(`${section} updated successfully`)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : `Failed to update ${section}`, 'error')
    } finally {
      setSaving('')
    }
  }

  const handleBrandingFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setSaving(`Branding ${uploadType}`)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', uploadType)
      
      const res = await adminSettingsApi.uploadBranding(formData)
      if (uploadType === 'logo') {
        setBrandingLogo(res.data.branding.logoUrl)
      } else {
        setBrandingFavicon(res.data.branding.faviconUrl)
        let link = document.querySelector("link[rel~='icon']")
        if (!link) {
          link = document.createElement('link')
          link.rel = 'icon'
          document.head.appendChild(link)
        }
        link.removeAttribute('type')
        link.href = res.data.branding.faviconUrl
      }
      showToast(`${uploadType} uploaded successfully`)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : `Failed to upload ${uploadType}`, 'error')
    } finally {
      setSaving('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteBranding = async (type) => {
    setSaving(`Deleting ${type}`)
    try {
      await adminSettingsApi.deleteBranding(type)
      if (type === 'logo') {
        setBrandingLogo(null)
      } else {
        setBrandingFavicon(null)
        let link = document.querySelector("link[rel~='icon']")
        if (link) {
          link.href = '/favicon.svg' // Revert to default
        }
      }
      showToast(`${type} deleted successfully`)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : `Failed to delete ${type}`, 'error')
    } finally {
      setSaving('')
      setDeleteConfirmType(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Toast message={toast.message} variant={toast.variant} />

      <AppModal
        open={!!deleteConfirmType}
        onClose={() => setDeleteConfirmType(null)}
        title="Delete Branding"
        description={`Are you sure you want to delete the uploaded ${deleteConfirmType}?`}
        footer={
          <div className="flex justify-end gap-3">
            <AppButton variant="secondary" onClick={() => setDeleteConfirmType(null)}>Cancel</AppButton>
            <AppButton 
              variant="danger" 
              loading={saving.startsWith('Deleting')}
              onClick={() => handleDeleteBranding(deleteConfirmType)}
            >
              Delete
            </AppButton>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          This action cannot be undone. The system will revert to using the default {deleteConfirmType}.
        </p>
      </AppModal>

      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleBrandingFileChange}
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-blue-800 text-white shadow-lg ring-4 ring-brand/10">
            <Settings className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Platform Settings</h1>
            <p className="text-sm text-slate-500">Configure fees, commission, wallet limits, GST, and penalties</p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Branding */}
        <SettingsSection
          icon={ImageIcon}
          title="Branding"
          description="Update application logo and favicon"
        >
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-6 gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 overflow-hidden relative">
                  {brandingLogo ? (
                    <img src={brandingLogo} alt="Logo" className="h-full w-full object-contain p-2" />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Logo</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">Logo</p>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-[200px]">Appears on auth and layout headers</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <AppPrimaryButton 
                  type="button" 
                  className="w-full sm:w-auto px-6 py-2.5 text-sm"
                  loading={saving === 'Branding logo'} 
                  onClick={() => { setUploadType('logo'); fileInputRef.current?.click(); }}
                >
                  Upload Logo
                </AppPrimaryButton>
                {brandingLogo && (
                  <button
                    type="button"
                    title="Delete Logo"
                    disabled={!!saving}
                    onClick={() => setDeleteConfirmType('logo')}
                    className="flex shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 overflow-hidden relative">
                  {brandingFavicon ? (
                    <img src={brandingFavicon} alt="Favicon" className="h-full w-full object-contain p-2" />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">No<br/>Favicon</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">Favicon</p>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-[200px]">Appears in the browser tab</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <AppPrimaryButton 
                  type="button" 
                  className="w-full sm:w-auto px-6 py-2.5 text-sm"
                  loading={saving === 'Branding favicon'} 
                  onClick={() => { setUploadType('favicon'); fileInputRef.current?.click(); }}
                >
                  Upload Favicon
                </AppPrimaryButton>
                {brandingFavicon && (
                  <button
                    type="button"
                    title="Delete Favicon"
                    disabled={!!saving}
                    onClick={() => setDeleteConfirmType('favicon')}
                    className="flex shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Platform Fee */}
        <SettingsSection
          icon={Percent}
          title="Platform Fee"
          description="Fee charged to customers on each booking"
        >

          <div>
            <label className={labelClass}>Fee Type</label>
            <SearchableSelect
              className="mt-1.5"
              value={feeType}
              onChange={(val) => setFeeType(val)}
              options={[
                { label: 'Percentage (%)', value: 'percentage' },
                { label: 'Fixed (₹)', value: 'fixed' }
              ]}
            />
          </div>
          <div>
            <label className={labelClass}>Value</label>
            <input
              className={inputClass + ' mt-1.5'}
              type="number"
              min={0}
              placeholder={feeType === 'percentage' ? 'e.g. 5' : 'e.g. 50'}
              value={feeValue}
              onChange={(e) => setFeeValue(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={feeActive}
              onClick={() => setFeeActive(!feeActive)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${feeActive ? 'bg-brand' : 'bg-slate-200'}`}
            >
              <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${feeActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <label className="text-sm font-medium text-slate-700 cursor-pointer" onClick={() => setFeeActive(!feeActive)}>Active</label>
          </div>
          <AppPrimaryButton
            type="button"
            loading={saving === 'Platform Fee'}
            onClick={() => handleSave('Platform Fee', adminSettingsApi.updatePlatformFees, {
              type: feeType,
              value: Number(feeValue),
              isActive: feeActive,
            })}
          >
            Save Platform Fee
          </AppPrimaryButton>
        </SettingsSection>

        {/* Commission */}
        <SettingsSection
          icon={IndianRupee}
          title="Commission"
          description="Percentage the platform takes from workers/vendors"
        >

          <div>
            <label className={labelClass}>Commission Percentage</label>
            <input
              className={inputClass + ' mt-1.5'}
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 10"
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={commissionActive}
              onClick={() => setCommissionActive(!commissionActive)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${commissionActive ? 'bg-brand' : 'bg-slate-200'}`}
            >
              <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${commissionActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <label className="text-sm font-medium text-slate-700 cursor-pointer" onClick={() => setCommissionActive(!commissionActive)}>Active</label>
          </div>
          <AppPrimaryButton
            type="button"
            loading={saving === 'Commission'}
            onClick={() => handleSave('Commission', adminSettingsApi.updateCommission, {
              type: commissionType,
              globalPercentage: Number(commissionPercent),
              isActive: commissionActive,
            })}
          >
            Save Commission
          </AppPrimaryButton>
        </SettingsSection>

        {/* GST */}
        <SettingsSection
          icon={Receipt}
          title="Category GST"
          description="Tax applied on booking based on service category"
        >
          <div>
            <label className={labelClass}>Select Category</label>
            <SearchableSelect
              className="mt-1.5"
              value={selectedGstCategory}
              placeholder="-- Choose Category --"
              options={categories.map(cat => ({ label: cat.name, value: cat._id }))}
              onChange={(val) => {
                 setSelectedGstCategory(val)
                 const cat = categories.find(c => c._id === val)
                 if (cat) {
                   setGstPercentage(String(cat.gstPercentage || 0))
                   setIsGstActive(cat.isGstActive !== false)
                 } else {
                   setGstPercentage('')
                   setIsGstActive(true)
                 }
              }}
            />
          </div>
          <div>
            <label className={labelClass}>GST (%)</label>
            <input
              className={inputClass + ' mt-1.5'}
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 18"
              value={gstPercentage}
              onChange={(e) => setGstPercentage(e.target.value)}
              disabled={!selectedGstCategory}
            />
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={isGstActive}
              disabled={!selectedGstCategory}
              onClick={() => setIsGstActive(!isGstActive)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${isGstActive ? 'bg-brand' : 'bg-slate-200'} ${!selectedGstCategory ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isGstActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <label className={`text-sm font-medium text-slate-700 ${!selectedGstCategory ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} onClick={() => { if(selectedGstCategory) setIsGstActive(!isGstActive) }}>Active</label>
          </div>
          <AppPrimaryButton
            type="button"
            loading={saving === 'GST'}
            disabled={!selectedGstCategory}
            onClick={() => {
              handleSave('GST', (payload) => updateAdminLabourCategoryGst(selectedGstCategory, payload), {
                gstPercentage: Number(gstPercentage),
                isGstActive: isGstActive,
              }).then(() => {
                // Update local state so it stays correctly configured when switching
                setCategories(prev => prev.map(c => c._id === selectedGstCategory ? { ...c, gstPercentage: Number(gstPercentage), isGstActive } : c))
              })
            }}
          >
            Save GST
          </AppPrimaryButton>
        </SettingsSection>

        {/* Payment Modes */}
        <SettingsSection
          icon={Wallet}
          title="Payment Modes"
          description="Enable or disable available payment modes for customers"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={cashEnabled}
                onClick={() => setCashEnabled(!cashEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${cashEnabled ? 'bg-brand' : 'bg-slate-200'}`}
              >
                <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cashEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <label className="text-sm font-medium text-slate-700 cursor-pointer" onClick={() => setCashEnabled(!cashEnabled)}>Cash Payments</label>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={onlineEnabled}
                onClick={() => setOnlineEnabled(!onlineEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${onlineEnabled ? 'bg-brand' : 'bg-slate-200'}`}
              >
                <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${onlineEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <label className="text-sm font-medium text-slate-700 cursor-pointer" onClick={() => setOnlineEnabled(!onlineEnabled)}>Online Payments</label>
            </div>
          </div>
          <AppPrimaryButton
            type="button"
            loading={saving === 'payment'}
            onClick={() => handleSave('Payment Modes', adminSettingsApi.updatePaymentModes, { cashEnabled, onlineEnabled })}
          >
            Save Payment Modes
          </AppPrimaryButton>
        </SettingsSection>

        {/* Cancellation Penalty */}
        <SettingsSection
          icon={AlertTriangle}
          title="Cancellation Penalty"
          description="Fixed penalty charged to labourers for cancelling an accepted job"
          accent="amber-600"
        >
          <div>
            <label className={labelClass}>Penalty Amount (₹)</label>
            <input
              className={inputClass + ' mt-1.5'}
              type="number"
              min={0}
              placeholder="e.g. 50"
              value={cancellationPenalty}
              onChange={(e) => setCancellationPenalty(e.target.value)}
            />
          </div>
          <AppPrimaryButton
            type="button"
            loading={saving === 'Penalty'}
            onClick={() => handleSave('Penalty', adminSettingsApi.updateCancellationPenalty, {
              cancellationPenalty: Number(cancellationPenalty),
            })}
          >
            Save Penalty
          </AppPrimaryButton>
        </SettingsSection>

        {/* Simulated Opportunity Alerts Global Toggle */}
        <SettingsSection
          icon={Radio}
          title="Simulated Opportunity Alerts"
          description="Global toggle for simulated booking alerts to engage vendors"
          accent="amber-600"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={simulatedOpportunitiesEnabled}
                onClick={() => setSimulatedOpportunitiesEnabled(!simulatedOpportunitiesEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${simulatedOpportunitiesEnabled ? 'bg-brand' : 'bg-slate-200'}`}
              >
                <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${simulatedOpportunitiesEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <div>
                <label className="text-sm font-bold text-slate-800 cursor-pointer" onClick={() => setSimulatedOpportunitiesEnabled(!simulatedOpportunitiesEnabled)}>
                  Simulated Opportunity Alerts
                </label>
                <p className="text-xs font-semibold text-slate-500">
                  {simulatedOpportunitiesEnabled ? 'Status: ON 🟢 — Alerts can be sent to vendors.' : 'Status: OFF 🔴 — Alerts are currently disabled.'}
                </p>
              </div>
            </div>
            <Link
              to="/admin/simulated-opportunities"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700 shadow-xs hover:bg-slate-100 transition shrink-0"
            >
              <Radio className="h-3.5 w-3.5 text-amber-600" />
              Manage & Send Alerts
            </Link>
          </div>
          <AppPrimaryButton
            type="button"
            loading={saving === 'Simulated'}
            onClick={() => handleSave('Simulated Opportunities', adminSettingsApi.updateSimulatedOpportunitiesToggle, {
              simulatedOpportunitiesEnabled,
            })}
          >
            Save Alert Setting
          </AppPrimaryButton>
        </SettingsSection>

        {/* Dynamic Subscription */}
        <SettingsSection
          icon={Clock}
          title="Daily Subscription"
          description="Configure the daily ₹19 model and active window"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isUserSubscriptionEnabled}
              onClick={() => setIsUserSubscriptionEnabled(!isUserSubscriptionEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${isUserSubscriptionEnabled ? 'bg-brand' : 'bg-slate-200'}`}
            >
              <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isUserSubscriptionEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <label className="text-sm font-medium text-slate-700 cursor-pointer" onClick={() => setIsUserSubscriptionEnabled(!isUserSubscriptionEnabled)}>Enable Daily Subscriptions</label>
          </div>
          <div>
            <label className={labelClass}>Daily Price (₹)</label>
            <input
              className={inputClass + ' mt-1.5'}
              type="number"
              min={0}
              placeholder="e.g. 19"
              value={dailySubscriptionPrice}
              onChange={(e) => setDailySubscriptionPrice(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Free Trial (Days)</label>
            <input
              className={inputClass + ' mt-1.5'}
              type="number"
              min={0}
              placeholder="e.g. 3"
              value={freeTrialDays}
              onChange={(e) => setFreeTrialDays(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Free Trial Message</label>
            <input
              className={inputClass + ' mt-1.5'}
              type="text"
              placeholder="e.g. Welcome! Enjoy your free trial period."
              value={freeTrialMessage}
              onChange={(e) => setFreeTrialMessage(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Hour (0-23)</label>
              <input
                className={inputClass + ' mt-1.5'}
                type="number"
                min={0} max={23}
                placeholder="e.g. 8"
                value={subscriptionStartHour}
                onChange={(e) => setSubscriptionStartHour(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>End Hour (0-23)</label>
              <input
                className={inputClass + ' mt-1.5'}
                type="number"
                min={0} max={23}
                placeholder="e.g. 20"
                value={subscriptionEndHour}
                onChange={(e) => setSubscriptionEndHour(e.target.value)}
              />
            </div>
          </div>
          <AppPrimaryButton
            type="button"
            loading={saving === 'Subscription'}
            onClick={() => {
              handleSave('Subscription Toggle', adminSettingsApi.updateUserSubscriptionToggle, {
                isUserSubscriptionEnabled
              })
              handleSave('Subscription Settings', adminSettingsApi.updateDynamicSubscriptionSettings, {
                dailySubscriptionPrice: Number(dailySubscriptionPrice),
                freeTrialDays: Number(freeTrialDays),
                freeTrialMessage,
                subscriptionStartHour: Number(subscriptionStartHour),
                subscriptionEndHour: Number(subscriptionEndHour),
              })
            }}
          >
            Save Subscription Settings
          </AppPrimaryButton>
        </SettingsSection>

        {/* Max Hour Discount */}
        <SettingsSection
          icon={Percent}
          title="Max-Hour Discount"
          description="Discount applied automatically when a customer books for 8+ hours"
          accent="emerald-600"
        >
          <div>
            <label className={labelClass}>Discount Percentage (%)</label>
            <input
              className={inputClass + ' mt-1.5'}
              type="number"
              min={0} max={100}
              placeholder="e.g. 10"
              value={maxHourDiscountPercentage}
              onChange={(e) => setMaxHourDiscountPercentage(e.target.value)}
            />
          </div>
          <AppPrimaryButton
            type="button"
            loading={saving === 'Discount'}
            onClick={() => handleSave('Discount', adminSettingsApi.updateMaxHourDiscount, {
              maxHourDiscountPercentage: Number(maxHourDiscountPercentage),
            })}
          >
            Save Discount
          </AppPrimaryButton>
        </SettingsSection>

      </div>
    </div>
  )
}
