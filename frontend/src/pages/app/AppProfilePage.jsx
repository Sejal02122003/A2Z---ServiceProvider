import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Camera,
  ChevronRight,
  ClipboardList,
  FileText,
  Fingerprint,
  HardHat,
  Home,
  IdCard,
  LifeBuoy,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Package,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  Wrench,
  Trash2,
  AlertTriangle,
  Wallet,
} from 'lucide-react'
import { KitStatusBadge } from '../../components/admin/welcomeKit/KitStatusBadge.jsx'
import { BOOT_ROUTES } from '../../constants/bootFlow.js'
import { useAuth } from '../../hooks/useAuth.js'
import {
  KYC_STATUS,
  ROLE_LABELS,
  USER_ROLES,
} from '../../constants/userRoles.js'
import { adminInitials, formatLastLoginRelative } from '../../lib/formatAdminLastLogin.js'
import { assetUrlFromUpload, uploadMedia } from '../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import { AppBadge } from '../../components/app-ui/data-display/AppBadge.jsx'
import { AppSectionHeader } from '../../components/app-ui/layout/AppSectionHeader.jsx'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { AppModal } from '../../components/app-ui/feedback/AppModal.jsx'
import { AppTextInput } from '../../components/app-ui/inputs/AppTextInput.jsx'
import { AppButton } from '../../components/app-ui/buttons/AppButton.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { patchCurrentUser, deleteCurrentUser } from '../../api/userProfileApi.js'
import { ApiError } from '../../api/http.js'
import { writeAppUserLocation } from '../../lib/appUserLocationStorage.js'
import { setUser } from '../../store/slices/authSlice.js'

function openAppDrawer() {
  window.dispatchEvent(new Event('lc-open-app-drawer'))
}

function roleStatusPill(user) {
  const role = user?.role
  if (role === USER_ROLES.LABOUR && user?.labourProfile?.kycStatus) {
    const k = user.labourProfile.kycStatus
    if (k === KYC_STATUS.PENDING) return { label: 'KYC pending', variant: 'amber' }
    if (k === KYC_STATUS.FAILED) return { label: 'KYC needs attention', variant: 'rose' }
    if (k === KYC_STATUS.VERIFIED) return { label: 'KYC verified', variant: 'emerald' }
  }
  return null
}



function StatTile({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-800 ring-slate-200/80',
    brand: 'bg-brand/8 text-brand ring-brand/20',
    emerald: 'bg-blue-50 text-blue-900 ring-blue-200/80',
    amber: 'bg-amber-50 text-amber-950 ring-amber-200/80',
  }
  return (
    <div className={`rounded-2xl px-3 py-2.5 ring-1 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <p className="mt-1 text-xs font-bold leading-snug">{value}</p>
    </div>
  )
}

function DetailRow({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100/90 py-3.5 last:border-0">
      <div className="flex min-w-0 items-start gap-2.5 text-slate-500">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-slate-200/80">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wide">{label}</span>
          {sub ? <span className="mt-0.5 block text-[10px] font-medium normal-case text-slate-400">{sub}</span> : null}
        </div>
      </div>
      <span className="max-w-[58%] shrink-0 text-right text-sm font-semibold text-slate-900">{value}</span>
    </div>
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

export function AppProfilePage() {
  const { user, token, logout, setBootRole } = useAuth()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const reduce = useReducedMotion()
  const photoInputRef = useRef(null)

  const [photoSaving, setPhotoSaving] = useState(false)
  const [photoErr, setPhotoErr] = useState('')
  const [localPreview, setLocalPreview] = useState(null)

  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [editPhoneValue, setEditPhoneValue] = useState('')
  const [editEmailValue, setEditEmailValue] = useState('')
  const [editPermanentAddress, setEditPermanentAddress] = useState('')
  const [editCurrentLocation, setEditCurrentLocation] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editCountry, setEditCountry] = useState('')
  const [editExperienceYears, setEditExperienceYears] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileErr, setProfileErr] = useState('')
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)

  const cityInputRef = useRef(null)
  const stateInputRef = useRef(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')

  useEffect(() => {
    if (!editProfileOpen) return
    
    const initAutocomplete = () => {
      if (!window.google?.maps?.places) return
      
      if (cityInputRef.current) {
        const cityAutocomplete = new window.google.maps.places.Autocomplete(cityInputRef.current, {
          types: ['(cities)'],
          componentRestrictions: { country: 'in' },
          fields: ['address_components', 'name']
        })
        
        cityAutocomplete.addListener('place_changed', () => {
          const place = cityAutocomplete.getPlace()
          if (!place.address_components) return
          
          let cityName = ''
          let stateName = ''
          let countryName = ''
          
          place.address_components.forEach(comp => {
            if (comp.types.includes('locality')) cityName = comp.long_name
            if (comp.types.includes('administrative_area_level_1')) stateName = comp.long_name
            if (comp.types.includes('country')) countryName = comp.long_name
          })
          
          if (cityName) setEditCity(cityName)
          else if (place.name) setEditCity(place.name)
          
          if (stateName) setEditState(stateName)
          if (countryName) setEditCountry(countryName)
        })
      }
      
      if (stateInputRef.current) {
        const stateAutocomplete = new window.google.maps.places.Autocomplete(stateInputRef.current, {
          types: ['(regions)'],
          componentRestrictions: { country: 'in' },
          fields: ['address_components', 'name']
        })
        
        stateAutocomplete.addListener('place_changed', () => {
          const place = stateAutocomplete.getPlace()
          if (!place.address_components) return
          
          let stateName = ''
          place.address_components.forEach(comp => {
            if (comp.types.includes('administrative_area_level_1')) stateName = comp.long_name
          })
          
          if (stateName) setEditState(stateName)
          else if (place.name) setEditState(place.name)
        })
      }
    }
    
    if (window.google?.maps?.places) {
      initAutocomplete()
    } else {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      if (!apiKey) return
      
      if (!document.querySelector('#google-maps-script')) {
        const script = document.createElement('script')
        script.id = 'google-maps-script'
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
        script.async = true
        script.defer = true
        script.onload = initAutocomplete
        document.head.appendChild(script)
      } else {
        setTimeout(initAutocomplete, 500)
      }
    }
  }, [editProfileOpen])

  const handleFetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setProfileErr('Geolocation is not supported by your browser')
      return
    }
    
    setIsFetchingLocation(true)
    setProfileErr('')
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        
        if (!window.google?.maps?.Geocoder) {
          setIsFetchingLocation(false)
          setProfileErr('Google Maps not loaded')
          return
        }
        
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
          setIsFetchingLocation(false)
          if (status === 'OK' && results[0]) {
            const addressComponents = results[0].address_components
            let city = ''
            let state = ''
            let country = ''
            
            addressComponents.forEach(comp => {
              if (comp.types.includes('locality')) city = comp.long_name
              if (comp.types.includes('administrative_area_level_1')) state = comp.long_name
              if (comp.types.includes('country')) country = comp.long_name
            })
            
            setEditCurrentLocation(results[0].formatted_address)
            if (city) setEditCity(city)
            if (state) setEditState(state)
            if (country) setEditCountry(country)
          } else {
            setProfileErr('Could not determine location from coordinates')
          }
        })
      },
      (error) => {
        setIsFetchingLocation(false)
        setProfileErr(error.message)
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [])

  const labourCategories = user?.labourProfile?.categoryIds
  const labourKyc = user?.labourProfile?.kycStatus
  const statusPill = roleStatusPill(user)
  const initials = adminInitials(user)
  const lastActive = formatLastLoginRelative(user?.lastLoginAt)
  const memberSince =
    user?.createdAt && !Number.isNaN(new Date(user.createdAt).getTime())
      ? new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
      : '—'

  const savedPhoto = user?.profileImageUrl?.trim() || ''
  const displayPhoto = localPreview || savedPhoto

  const saveProfilePhoto = useCallback(
    async (imageUrl) => {
      setPhotoErr('')
      setPhotoSaving(true)
      try {
        const res = await patchCurrentUser({ profileImageUrl: imageUrl })
        dispatch(setUser(res.data.user))
        setLocalPreview(null)
      } catch (e) {
        setPhotoErr(e instanceof ApiError ? e.message : 'Could not save profile photo')
        setLocalPreview(null)
      } finally {
        setPhotoSaving(false)
      }
    },
    [dispatch],
  )

  const onPickPhoto = useCallback(
    async (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      setPhotoErr('')
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setPhotoErr('Please choose a photo (JPG, PNG, or WebP) from your device.')
        return
      }
      const previewUrl = URL.createObjectURL(file)
      setLocalPreview(previewUrl)
      try {
        const uploaded = await uploadMedia(file, UPLOAD_FOLDERS.PROFILES)
        const url = assetUrlFromUpload(uploaded)
        if (!url) {
          setPhotoErr('Upload failed — no URL returned.')
          setLocalPreview(null)
          return
        }
        await saveProfilePhoto(url)
      } catch (err) {
        setPhotoErr(err instanceof ApiError ? err.message : 'Could not upload photo.')
        setLocalPreview(null)
      } finally {
        URL.revokeObjectURL(previewUrl)
      }
    },
    [saveProfilePhoto],
  )

  const removePhoto = useCallback(async () => {
    setPhotoErr('')
    setLocalPreview(null)
    setPhotoSaving(true)
    try {
      const res = await patchCurrentUser({ profileImageUrl: null })
      dispatch(setUser(res.data.user))
    } catch (e) {
      setPhotoErr(e instanceof ApiError ? e.message : 'Could not remove photo')
    } finally {
      setPhotoSaving(false)
    }
  }, [dispatch])

  const handleEditProfileOpen = useCallback(() => {
    setEditNameValue(user?.fullName || '')
    setEditPhoneValue(user?.phone || '')
    setEditEmailValue(user?.email || '')
    setEditPermanentAddress(user?.permanentAddress || '')
    setEditCurrentLocation(user?.currentLocation || '')
    setEditCity(user?.city || '')
    setEditState(user?.state || '')
    setEditCountry(user?.country || 'India')
    setEditExperienceYears(user?.labourProfile?.experienceYears ?? '')
    setProfileErr('')
    setEditProfileOpen(true)
  }, [user])

  const handleSaveProfile = useCallback(async (e) => {
    e.preventDefault()
    const trimmedName = editNameValue.trim()
    const trimmedPhone = editPhoneValue.trim()
    const trimmedEmail = editEmailValue.trim()
    
    if (!trimmedName) {
      setProfileErr('Name cannot be empty')
      return
    }
    if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
      setProfileErr('Enter a valid 10-digit phone number')
      return
    }
    
    setSavingProfile(true)
    setProfileErr('')
    try {
      const res = await patchCurrentUser({ 
        fullName: trimmedName,
        phone: trimmedPhone || undefined,
        email: trimmedEmail || undefined,
        permanentAddress: editPermanentAddress.trim() || undefined,
        currentLocation: editCurrentLocation.trim() || undefined,
        city: editCity.trim() || undefined,
        state: editState.trim() || undefined,
        country: editCountry.trim() || undefined,
        ...(user?.role === USER_ROLES.LABOUR ? {
          labourProfile: {
            experienceYears: editExperienceYears !== '' ? Number(editExperienceYears) : undefined
          }
        } : {})
      })
      dispatch(setUser(res.data.user))
      
      // Update local storage so Home Page reflects this location
      if (editCurrentLocation.trim()) {
        writeAppUserLocation({ 
          address: editCurrentLocation.trim(),
          city: editCity.trim() || undefined
        })
        window.dispatchEvent(new CustomEvent('lc-app-user-location-changed'))
      }

      setEditProfileOpen(false)
    } catch (err) {
      setProfileErr(err instanceof ApiError ? err.message : 'Could not save profile')
    } finally {
      setSavingProfile(false)
    }
  }, [editNameValue, editPhoneValue, editEmailValue, editPermanentAddress, editCurrentLocation, editCity, editState, editCountry, editExperienceYears, user, dispatch])

  const handleToggleRole = useCallback(async () => {
    const newRole = user?.role === USER_ROLES.CUSTOMER ? USER_ROLES.CONTRACTOR : USER_ROLES.CUSTOMER
    try {
      const res = await patchCurrentUser({ role: newRole })
      dispatch(setUser(res.data.user))
    } catch (err) {
      console.error(err)
    }
  }, [user, dispatch])

  const handleSignOut = async () => {
    const role = user?.role
    await logout()
    navigate(role === USER_ROLES.LABOUR ? '/labours/auth' : '/users/auth', { replace: true })
  }

  const handleDeleteAccount = useCallback(async () => {
    setDeletingAccount(true)
    setDeleteErr('')
    try {
      const role = user?.role
      await deleteCurrentUser()
      await logout()
      navigate(role === USER_ROLES.LABOUR ? '/labours/auth' : '/users/auth', { replace: true })
    } catch (err) {
      setDeleteErr(err instanceof ApiError ? err.message : 'Could not delete account')
      setDeletingAccount(false)
    }
  }, [logout, navigate, user?.role])

  const quickLinks = []
  quickLinks.push({ to: '/app', icon: Home, label: 'Home' })
  if (user?.role === USER_ROLES.LABOUR) {
    quickLinks.push({ to: '/app/jobs', icon: HardHat, label: 'Jobs & assignments' })
    quickLinks.push({ to: '/app/my-bookings', icon: CalendarClock, label: 'My Bookings (Direct)' })
    quickLinks.push({ to: '/app/kyc', icon: Fingerprint, label: 'Aadhaar KYC' })
    quickLinks.push({ to: '/app/earnings', icon: Sparkles, label: 'Earnings & payouts' })
  } else {
    quickLinks.push({
      to: '/app/my-bookings',
      icon: CalendarClock,
      label: user?.role === USER_ROLES.CONTRACTOR ? 'Bookings & requests' : 'Bookings',
    })
    quickLinks.push({ to: '/app/wallet', icon: Wallet, label: 'My Wallet' })
  }
  if (user?.role === USER_ROLES.CONTRACTOR) {
    quickLinks.push({ to: '/app/billing', icon: FileText, label: 'Billing & contracts' })
  }
  if (user?.role === USER_ROLES.CONTRACTOR) {
    quickLinks.push({ to: '/app/workforce', icon: ClipboardList, label: 'Workforce' })
  }
  quickLinks.push({ to: '/app/support', icon: LifeBuoy, label: 'Support' })

  return (
    <motion.div
      className="w-full min-w-0 max-w-full space-y-5 overflow-x-hidden bg-linear-to-b from-slate-50/95 via-white to-blue-50/15 pb-28 pt-1"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="mb-4 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button 
            onClick={() => navigate('/app')}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-col justify-center">
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900 leading-none mb-1.5">Profile</h1>
            <p className="text-[13px] font-medium text-slate-500 leading-none">Manage your account and settings</p>
          </div>
        </div>
      </div>

      <motion.section
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-3xl border border-slate-200/90 bg-linear-to-br from-white via-white to-brand/[0.07] p-4 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.18)] ring-1 ring-slate-100/90"
      >
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoSaving}
            className="group relative shrink-0 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-70"
            aria-label="Change profile photo"
          >
            <span className="relative block h-24 w-24 overflow-hidden rounded-3xl bg-linear-to-br from-brand-bright to-brand text-2xl font-black text-white shadow-[0_16px_40px_-12px_rgba(0,43,92,0.55)] ring-2 ring-white">
              {displayPhoto ? (
                <img src={displayPhoto} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">{initials}</span>
              )}
              {photoSaving ? (
                <span className="absolute inset-0 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
                  <Loader2 className="h-7 w-7 animate-spin text-white" aria-hidden />
                </span>
              ) : null}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-2 ring-white transition group-hover:scale-105">
              <Pencil className="h-4 w-4" aria-hidden />
            </span>
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="sr-only"
            onChange={(e) => void onPickPhoto(e)}
          />

          <div className="mt-4 min-w-0 flex-1 sm:mt-0 sm:ml-4">
            <p className="truncate text-xl font-black tracking-tight text-slate-900">
              {user?.fullName || 'Your profile'}
            </p>
            <p className="mt-1 text-sm font-semibold text-brand">{ROLE_LABELS[user?.role] || user?.role || '—'}</p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-500 sm:justify-start">
              <Camera className="h-3.5 w-3.5" aria-hidden />
              Tap photo to upload from your device
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {user?.isPhoneVerified ? (
                <AppBadge variant="emerald" uppercase={false}>
                  Phone verified
                </AppBadge>
              ) : (
                <AppBadge variant="amber" uppercase={false}>
                  Phone not verified
                </AppBadge>
              )}
              {statusPill ? (
                <AppBadge variant={statusPill.variant} uppercase={false}>
                  {statusPill.label}
                </AppBadge>
              ) : null}
              {user?.isActive === false ? (
                <AppBadge variant="rose" uppercase={false}>
                  Inactive
                </AppBadge>
              ) : null}
            </div>
            {displayPhoto && !photoSaving ? (
              <button
                type="button"
                onClick={() => void removePhoto()}
                className="mt-2 text-[11px] font-bold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline"
              >
                Remove photo
              </button>
            ) : null}
            {photoErr ? <p className="mt-2 text-xs font-medium text-rose-700">{photoErr}</p> : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
          {/* <StatTile
            icon={Phone}
            label="Mobile"
            value={user?.phone ? `+91 ${user.phone.slice(-10)}` : '—'}
            tone={user?.isPhoneVerified ? 'emerald' : 'amber'}
          /> */}
          <StatTile icon={CalendarClock} label="Member" value={memberSince} />
          <StatTile icon={ShieldCheck} label="Active" value={lastActive || '—'} />
        </div>
      </motion.section>

      {user?.role === USER_ROLES.LABOUR ? (
        <Link
          to="/app/kyc"
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 shadow-sm transition active:scale-[0.99] ${
            labourKyc === KYC_STATUS.VERIFIED
              ? 'border-blue-200/80 bg-blue-50/80'
              : labourKyc === KYC_STATUS.FAILED
                ? 'border-rose-200/80 bg-rose-50/60'
                : 'border-amber-200/80 bg-amber-50/70'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Fingerprint className="h-5 w-5 shrink-0 text-brand" aria-hidden />
            <span className="text-left">
              <span className="block text-sm font-bold text-slate-900">Aadhaar verification</span>
              <span className="block text-[11px] font-medium text-slate-600">
                {labourKyc === KYC_STATUS.VERIFIED
                  ? user?.labourProfile?.aadhaarMasked || 'Verified on file'
                  : labourKyc === KYC_STATUS.FAILED
                    ? 'Needs resubmission'
                    : user?.labourProfile?.kycSubmittedAt
                      ? 'Under admin review'
                      : 'Submit documents to get jobs'}
              </span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        </Link>
      ) : null}

      {user?.role === USER_ROLES.LABOUR ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-brand" />
              <span className="text-sm font-bold text-slate-900">Welcome Kit & Uniform</span>
            </div>
            <KitStatusBadge welcomeKit={user?.welcomeKit} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className={`p-2 rounded-xl border ${user?.welcomeKit?.uniformIssued ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
              Uniform {user?.welcomeKit?.uniformIssued ? '✓' : '✗'}
            </div>
            <div className={`p-2 rounded-xl border ${user?.welcomeKit?.idCardIssued ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
              ID Card {user?.welcomeKit?.idCardIssued ? '✓' : '✗'}
            </div>
            <div className={`p-2 rounded-xl border ${user?.welcomeKit?.bagIssued ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
              Bag {user?.welcomeKit?.bagIssued ? '✓' : '✗'}
            </div>
          </div>
        </div>
      ) : null}

      {user?.role === USER_ROLES.CONTRACTOR ? (
        <Link
          to="/app/kyc"
          className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 shadow-sm transition active:scale-[0.99] border-amber-200/80 bg-amber-50/70"
        >
          <span className="flex items-center gap-2.5">
            <IdCard className="h-5 w-5 shrink-0 text-brand" aria-hidden />
            <span className="text-left">
              <span className="block text-sm font-bold text-slate-900">ID - Proof verification</span>
              <span className="block text-[11px] font-medium text-slate-600">
                Submit documents to verify your business
              </span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        </Link>
      ) : null}

      <GlassPanel className="border-slate-200/90 p-4 ring-1 ring-slate-100/90">
        <div className="flex justify-between items-center mb-3">
          <AppSectionHeader title="Account details" className="mb-0" />
          {!editProfileOpen && (
            <button
              type="button"
              onClick={handleEditProfileOpen}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 transition hover:bg-brand/10 hover:text-brand"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
        </div>

        {editProfileOpen ? (
          <form onSubmit={handleSaveProfile} className="space-y-4 pt-2 border-t border-slate-100/90">
            <div>
              <label htmlFor="edit-full-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Full Name
              </label>
              <AppTextInput
                id="edit-full-name"
                placeholder="e.g. Rahul Kumar"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                disabled={savingProfile}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="edit-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Mobile Number
              </label>
              <AppTextInput
                id="edit-phone"
                type="tel"
                placeholder="10-digit number"
                value={editPhoneValue}
                onChange={(e) => setEditPhoneValue(e.target.value.replace(/\D/g, '').slice(0, 10))}
                disabled={savingProfile}
              />
            </div>
            <div>
              <label htmlFor="edit-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Email Address
              </label>
              <AppTextInput
                id="edit-email"
                type="email"
                placeholder="e.g. rahul@example.com"
                value={editEmailValue}
                onChange={(e) => setEditEmailValue(e.target.value)}
                disabled={savingProfile}
              />
            </div>
            <div>
              <label htmlFor="edit-permanent-address" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Permanent Address
              </label>
              <AppTextInput
                id="edit-permanent-address"
                type="text"
                placeholder="e.g. 123 Main St, Apt 4"
                value={editPermanentAddress}
                onChange={(e) => setEditPermanentAddress(e.target.value)}
                disabled={savingProfile}
              />
            </div>
            <div>
              <label htmlFor="edit-current-location" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Current Location / Zone
              </label>
              <AppTextInput
                id="edit-current-location"
                type="text"
                placeholder="e.g. MG Road Area"
                value={editCurrentLocation}
                onChange={(e) => setEditCurrentLocation(e.target.value)}
                disabled={savingProfile || isFetchingLocation}
                rightSlot={
                  <button
                    type="button"
                    onClick={handleFetchLocation}
                    disabled={savingProfile || isFetchingLocation}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand transition hover:bg-brand/20 disabled:opacity-50"
                    title="Fetch current location"
                  >
                    {isFetchingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  </button>
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-city" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  City
                </label>
                <AppTextInput
                  id="edit-city"
                  ref={cityInputRef}
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  disabled={savingProfile}
                />
              </div>
              <div>
                <label htmlFor="edit-state" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  State
                </label>
                <AppTextInput
                  id="edit-state"
                  ref={stateInputRef}
                  type="text"
                  placeholder="e.g. Maharashtra"
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                  disabled={savingProfile}
                />
              </div>
            </div>
            <div>
              <label htmlFor="edit-country" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                Country
              </label>
              <AppTextInput
                id="edit-country"
                type="text"
                placeholder="e.g. India"
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
                disabled={savingProfile}
              />
            </div>
            {user?.role === USER_ROLES.LABOUR ? (
              <div>
                <label htmlFor="edit-experience" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Experience (Years)
                </label>
                <AppTextInput
                  id="edit-experience"
                  type="number"
                  min="0"
                  placeholder="e.g. 5"
                  value={editExperienceYears}
                  onChange={(e) => setEditExperienceYears(e.target.value)}
                  disabled={savingProfile}
                />
              </div>
            ) : null}
            
            {profileErr ? <p className="mt-1.5 text-xs font-medium text-rose-600">{profileErr}</p> : null}
            
            <div className="flex gap-3 pt-4">
              <AppButton 
                type="button" 
                variant="secondary" 
                onClick={() => setEditProfileOpen(false)} 
                disabled={savingProfile}
              >
                Cancel
              </AppButton>
              <AppButton type="submit" loading={savingProfile}>
                Save changes
              </AppButton>
            </div>
          </form>
        ) : (
          <div className="space-y-1">
            <DetailRow 
              icon={Sparkles} 
              label="Full name" 
              value={<span className="truncate">{user?.fullName || '—'}</span>} 
            />
            <DetailRow
              icon={Phone}
              label="Mobile"
              value={<span className="truncate">{user?.phone ? `+91 ${user.phone}` : '—'}</span>}
              sub="Used for OTP sign-in"
            />
            <DetailRow 
              icon={Mail} 
              label="Email" 
              value={<span className="truncate">{user?.email?.trim() || '—'}</span>} 
              sub="Optional on your account" 
            />
            <DetailRow 
              icon={Home} 
              label="Permanent Address" 
              value={<span className="truncate max-w-[200px]">{user?.permanentAddress?.trim() || '—'}</span>} 
            />
            <DetailRow 
              icon={Building2} 
              label="Location/Zone" 
              value={<span className="truncate max-w-[200px]">{user?.currentLocation?.trim() || '—'}</span>} 
            />
            <DetailRow 
              icon={Building2} 
              label="City, State, Country" 
              value={
                <span className="truncate max-w-[200px]">
                  {[user?.city, user?.state, user?.country].filter(Boolean).join(', ') || '—'}
                </span>
              } 
            />
            {user?.role === USER_ROLES.LABOUR ? (
              <DetailRow 
                icon={Wrench} 
                label="Experience" 
                value={<span className="truncate">{user?.labourProfile?.experienceYears != null ? `${user.labourProfile.experienceYears} Years` : '—'}</span>} 
              />
            ) : null}
            <DetailRow icon={ShieldCheck} label="Last session" value={lastActive || '—'} />
          </div>
        )}
      </GlassPanel>

      {(user?.role === USER_ROLES.CUSTOMER || user?.role === USER_ROLES.CONTRACTOR) && (
        <GlassPanel className="border-slate-200/90 p-4 ring-1 ring-slate-100/90 flex flex-col items-center justify-center text-center">
          <Building2 className="h-8 w-8 text-brand mb-2" />
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            {user?.role === USER_ROLES.CUSTOMER ? 'Looking for bulk bookings?' : 'Looking for individual bookings?'}
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            {user?.role === USER_ROLES.CUSTOMER
              ? 'Switch to Contractor mode to book multiple workers and manage bulk projects.'
              : 'Switch to Individual mode for regular home services and single bookings.'}
          </p>
          <AppButton type="button" variant="secondary" onClick={handleToggleRole} className="w-full">
            Switch to {user?.role === USER_ROLES.CUSTOMER ? 'Contractor Mode' : 'Individual Mode'}
          </AppButton>
        </GlassPanel>
      )}


      {user?.role === USER_ROLES.LABOUR ? (
        <GlassPanel className="border-slate-200/90 p-4 ring-1 ring-slate-100/90">
          <AppSectionHeader title="Worker profile" className="mb-3" />
          {labourCategories?.length ? (
            <>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Work types</p>
              <div className="flex flex-wrap gap-2">
                {labourCategories.map((c) => (
                  <span
                    key={typeof c === 'object' && c?._id ? c._id : String(c)}
                    className="rounded-full border border-brand/20 bg-brand/8 px-3 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-brand/10"
                  >
                    {typeof c === 'object' && c?.name ? c.name : '…'}
                  </span>
                ))}
              </div>
              <Link
                to="/app/work-categories"
                className="mt-4 flex items-center justify-center gap-1 rounded-xl border border-brand/25 bg-brand/8 py-2.5 text-sm font-bold text-brand transition hover:bg-brand/12"
              >
                Update work types
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/80 p-4 text-center">
              <p className="text-sm font-semibold text-slate-800">Choose your trades</p>
              <p className="mt-1 text-xs text-slate-600">Pick categories so we can match you to the right jobs.</p>
              <Link
                to="/app/work-categories"
                className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand"
              >
                <Wrench className="h-4 w-4" aria-hidden />
                Set work types
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          )}
        </GlassPanel>
      ) : null}

      <section>
        <AppSectionHeader title="Shortcuts" className="mb-3 px-0.5" />
        <ul className="space-y-2">
          {quickLinks.map((link) => (
            <li key={link.to}>
              <QuickLinkCard to={link.to} icon={link.icon} label={link.label} />
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out
      </button>

      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200/90 bg-rose-50/90 py-3.5 text-sm font-bold text-rose-900 shadow-sm transition hover:bg-rose-50 active:scale-[0.99]"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete account
      </button>


      <AppModal 
        open={deleteOpen} 
        onClose={() => !deletingAccount && setDeleteOpen(false)} 
        title="Delete Account"
      >
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
             <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
               <AlertTriangle className="size-5" />
             </div>
             <div>
               <p className="text-sm text-slate-600">
                 Are you sure you want to delete your account? This action cannot be undone and will permanently remove your data, verified documents, and access.
               </p>
             </div>
          </div>
          {deleteErr ? <p className="mt-1.5 text-xs font-medium text-rose-600">{deleteErr}</p> : null}
          <div className="flex gap-3 pt-2">
            <AppButton 
              type="button" 
              variant="secondary" 
              onClick={() => setDeleteOpen(false)} 
              disabled={deletingAccount}
            >
              Cancel
            </AppButton>
            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              {deletingAccount ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete
            </button>
          </div>
        </div>
      </AppModal>
    </motion.div>
  )
}
