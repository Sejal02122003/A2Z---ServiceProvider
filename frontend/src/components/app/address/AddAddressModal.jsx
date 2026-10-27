import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Briefcase,
  Camera,
  Check,
  ChevronRight,
  Home,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { uploadMedia } from '../../../api/uploadApi.js'
import { addSavedAddress, updateSavedAddress } from '../../../api/addressApi.js'
import { writeAppUserLocation } from '../../../lib/appUserLocationStorage.js'
import { useAuth } from '../../../hooks/useAuth.js'

export function AddAddressModal({
  open,
  onClose,
  initialAddress = null, // if passed, we are editing an existing address
  onSaved,
}) {
  const { user } = useAuth?.() || {}
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const geocoderRef = useRef(null)
  const autocompleteServiceRef = useRef(null)

  // Map & Location State
  const [coords, setCoords] = useState({
    lat: initialAddress?.lat || 22.7196,
    lng: initialAddress?.lng || 75.8577,
  })
  const [areaName, setAreaName] = useState(initialAddress?.areaName || initialAddress?.locationText?.split(',')[0] || '')
  const [locationText, setLocationText] = useState(initialAddress?.locationText || '')
  const [city, setCity] = useState(initialAddress?.city || '')
  const [stateName, setStateName] = useState(initialAddress?.state || '')
  const [pincode, setPincode] = useState(initialAddress?.pincode || '')
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [isGpsLocating, setIsGpsLocating] = useState(false)

  // Search autocomplete
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  // Form Fields
  const [addressDetails, setAddressDetails] = useState(initialAddress?.addressDetails || '')
  const [tag, setTag] = useState(initialAddress?.tag || 'Home')
  const [customTag, setCustomTag] = useState(initialAddress?.customTag || '')
  const [receiverName, setReceiverName] = useState(initialAddress?.receiverName || user?.fullName || '')
  const [receiverPhone, setReceiverPhone] = useState(initialAddress?.receiverPhone || user?.phone || '')
  const [isEditingReceiver, setIsEditingReceiver] = useState(false)

  // Door Image
  const [doorImageUrl, setDoorImageUrl] = useState(initialAddress?.doorImageUrl || '')
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef(null)

  // Submission State
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Sync state if initialAddress changes
  useEffect(() => {
    if (initialAddress) {
      setCoords({ lat: initialAddress.lat, lng: initialAddress.lng })
      setAreaName(initialAddress.areaName || initialAddress.locationText?.split(',')[0] || '')
      setLocationText(initialAddress.locationText || '')
      setCity(initialAddress.city || '')
      setStateName(initialAddress.state || '')
      setPincode(initialAddress.pincode || '')
      setAddressDetails(initialAddress.addressDetails || '')
      setTag(initialAddress.tag || 'Home')
      setCustomTag(initialAddress.customTag || '')
      setReceiverName(initialAddress.receiverName || user?.fullName || '')
      setReceiverPhone(initialAddress.receiverPhone || user?.phone || '')
      setDoorImageUrl(initialAddress.doorImageUrl || '')
    } else {
      setTag('Home')
      setCustomTag('')
      setAddressDetails('')
      setDoorImageUrl('')
      setReceiverName(user?.fullName || '')
      setReceiverPhone(user?.phone || '')
    }
    setErrorMessage('')
    setIsEditingReceiver(false)
  }, [initialAddress, user, open])

  // Prevent background scrolling when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Reverse geocoding helper
  const reverseGeocode = useCallback((lat, lng) => {
    if (!lat || !lng) return
    setIsGeocoding(true)

    if (window.google?.maps?.Geocoder) {
      if (!geocoderRef.current) {
        geocoderRef.current = new window.google.maps.Geocoder()
      }
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        setIsGeocoding(false)
        if (status === 'OK' && results?.[0]) {
          const res = results[0]
          const fullAddress = res.formatted_address || ''
          setLocationText(fullAddress)

          let locality = ''
          let sublocality = ''
          let extractedCity = ''
          let extractedState = ''
          let extractedPin = ''

          res.address_components?.forEach((comp) => {
            if (comp.types.includes('sublocality') || comp.types.includes('sublocality_level_1')) {
              sublocality = comp.long_name
            } else if (comp.types.includes('locality')) {
              extractedCity = comp.long_name
            } else if (comp.types.includes('administrative_area_level_1')) {
              extractedState = comp.long_name
            } else if (comp.types.includes('postal_code')) {
              extractedPin = comp.long_name
            } else if (comp.types.includes('neighborhood') || comp.types.includes('point_of_interest')) {
              if (!locality) locality = comp.long_name
            }
          })

          const primaryName = sublocality || locality || res.address_components?.[0]?.long_name || fullAddress.split(',')[0]
          setAreaName(primaryName)
          if (extractedCity) setCity(extractedCity)
          if (extractedState) setStateName(extractedState)
          if (extractedPin) setPincode(extractedPin)
        }
      })
    } else {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then((r) => r.json())
        .then((data) => {
          setIsGeocoding(false)
          if (data && data.display_name) {
            setLocationText(data.display_name)
            const suburb = data.address?.suburb || data.address?.neighbourhood || data.address?.road || ''
            setAreaName(suburb || data.display_name.split(',')[0])
            if (data.address?.city || data.address?.town) setCity(data.address.city || data.address.town)
            if (data.address?.state) setStateName(data.address.state)
            if (data.address?.postcode) setPincode(data.address.postcode)
          }
        })
        .catch(() => setIsGeocoding(false))
    }
  }, [])

  // Initialize Map
  useEffect(() => {
    if (!open) return

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      reverseGeocode(coords.lat, coords.lng)
      return
    }

    function initMap() {
      if (!mapContainerRef.current) return
      if (!window.google?.maps?.Map) return

      const center = { lat: coords.lat, lng: coords.lng }
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center,
        zoom: 16,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
      })

      mapInstanceRef.current = map

      let idleTimer = null
      map.addListener('idle', () => {
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          const newCenter = map.getCenter()
          if (newCenter) {
            const nextLat = newCenter.lat()
            const nextLng = newCenter.lng()
            setCoords({ lat: nextLat, lng: nextLng })
            reverseGeocode(nextLat, nextLng)
          }
        }, 200)
      })

      reverseGeocode(coords.lat, coords.lng)
    }

    if (window.google?.maps?.Map) {
      initMap()
    } else if (!document.querySelector('#google-maps-script')) {
      const script = document.createElement('script')
      script.id = 'google-maps-script'
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
      script.async = true
      script.onload = initMap
      document.head.appendChild(script)
    } else {
      const script = document.querySelector('#google-maps-script')
      script.addEventListener('load', initMap)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Use current location" handler
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.')
      return
    }

    setIsGpsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLocating(false)
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCoords({ lat, lng })
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo({ lat, lng })
          mapInstanceRef.current.setZoom(17)
        }
        reverseGeocode(lat, lng)
      },
      (err) => {
        setIsGpsLocating(false)
        console.error('GPS error:', err)
        setErrorMessage('Unable to retrieve current location. Please check GPS permissions.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  // Search input handler with Places Autocomplete
  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchQuery(val)
    if (!val.trim()) {
      setSearchSuggestions([])
      return
    }

    if (window.google?.maps?.places?.AutocompleteService) {
      if (!autocompleteServiceRef.current) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
      }
      setIsSearching(true)
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: val,
          componentRestrictions: { country: 'in' },
        },
        (predictions, status) => {
          setIsSearching(false)
          if (status === 'OK' && predictions) {
            setSearchSuggestions(predictions)
          } else {
            setSearchSuggestions([])
          }
        }
      )
    }
  }

  // Selecting a search suggestion
  const handleSelectSuggestion = (placeId, description) => {
    setSearchQuery('')
    setSearchSuggestions([])
    setLocationText(description)

    if (window.google?.maps?.Geocoder) {
      if (!geocoderRef.current) {
        geocoderRef.current = new window.google.maps.Geocoder()
      }
      geocoderRef.current.geocode({ placeId }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location
          const nextLat = loc.lat()
          const nextLng = loc.lng()
          setCoords({ lat: nextLat, lng: nextLng })
          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo({ lat: nextLat, lng: nextLng })
            mapInstanceRef.current.setZoom(17)
          }
          reverseGeocode(nextLat, nextLng)
        }
      })
    }
  }

  // Upload Door/Building Image
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingImage(true)
      setErrorMessage('')
      const res = await uploadMedia(file, 'general-media')
      const uploadedUrl = res?.data?.url || res?.url || ''
      if (uploadedUrl) {
        setDoorImageUrl(uploadedUrl)
      } else {
        setErrorMessage('Failed to upload image. Please try again.')
      }
    } catch (err) {
      console.error('Door image upload error:', err)
      setErrorMessage(err?.message || 'Error uploading image')
    } finally {
      setIsUploadingImage(false)
    }
  }

  // Save Address Handler
  const handleSaveAddress = async () => {
    if (!addressDetails.trim()) {
      setErrorMessage('Please enter Address details (e.g. Floor, Flat, Tower).')
      return
    }
    if (!locationText.trim() || coords.lat == null || coords.lng == null) {
      setErrorMessage('Please pinpoint your delivery location on the map.')
      return
    }

    try {
      setIsSaving(true)
      setErrorMessage('')

      const payload = {
        tag,
        customTag: tag === 'Other' ? customTag : '',
        addressDetails: addressDetails.trim(),
        locationText: locationText.trim(),
        areaName: areaName.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        lat: coords.lat,
        lng: coords.lng,
        receiverName: receiverName.trim() || user?.fullName || '',
        receiverPhone: receiverPhone.trim() || user?.phone || '',
        doorImageUrl,
        isDefault: Boolean(initialAddress?.isDefault || !initialAddress),
      }

      let res
      if (initialAddress?._id) {
        try {
          res = await updateSavedAddress(initialAddress._id, payload)
        } catch (updateErr) {
          // If address not found on server (404), fall back to adding it as a new address
          if (
            updateErr?.status === 404 ||
            updateErr?.response?.status === 404 ||
            updateErr?.message?.includes('not found')
          ) {
            console.warn('Address not found on update, creating new address instead:', updateErr)
            res = await addSavedAddress(payload)
          } else {
            throw updateErr
          }
        }
      } else {
        res = await addSavedAddress(payload)
      }

      // Sync active location in storage
      const fullDisplay = `${addressDetails.trim()}, ${locationText.trim()}`
      writeAppUserLocation({
        address: fullDisplay,
        lat: coords.lat,
        lng: coords.lng,
        city: city || null,
        addressId: res?.data?.address?._id || initialAddress?._id,
        tag,
        receiverName: payload.receiverName,
        receiverPhone: payload.receiverPhone,
      })
      window.dispatchEvent(new CustomEvent('lc-app-user-location-changed'))

      if (onSaved) onSaved(res?.data?.address || payload)
      onClose()
    } catch (err) {
      console.error('Save address error:', err)
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to save address.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[220] flex flex-col bg-white overflow-hidden"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        {/* TOP SEARCH BAR HEADER */}
        <header className="relative z-30 flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-xs">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="relative flex-1">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 transition focus-within:border-brand focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/20">
              <Search className="h-4 w-4 shrink-0 text-brand" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search for area, street name…"
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setSearchSuggestions([])
                  }}
                  className="rounded-full p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
                {searchSuggestions.map((item, idx) => (
                  <button
                    key={item.place_id || `sugg-${idx}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(item.place_id, item.description)}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-xs transition hover:bg-slate-50"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="font-semibold text-slate-800">{item.structured_formatting?.main_text || item.description}</p>
                      <p className="text-[11px] text-slate-500">{item.structured_formatting?.secondary_text || ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* INTERACTIVE MAP SECTION WITH PIN & TOOLTIP */}
        <div className="relative h-64 sm:h-72 w-full shrink-0 overflow-hidden bg-slate-100">
          <div ref={mapContainerRef} className="h-full w-full" />

          {/* Fallback pattern if offline or script loading */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10" />

          {/* EXACT CENTER PIN & FLOATING TOOLTIP */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {/* Tooltip with downwards triangle */}
            <div className="relative -top-3 flex flex-col items-center transition-transform">
              <div className="rounded-xl bg-slate-900/95 px-3.5 py-1.5 shadow-lg backdrop-blur-xs">
                <p className="text-[11px] font-bold tracking-tight text-white">
                  Move pin to your exact delivery location
                </p>
              </div>
              {/* Pointer triangle */}
              <div className="h-0 w-0 border-x-6 border-t-6 border-x-transparent border-t-slate-900/95" />
            </div>

            {/* Delivery Pin Icon in Brand Color */}
            <div className="relative -mt-1 flex flex-col items-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand shadow-xl ring-4 ring-white">
                <MapPin className="h-6 w-6 text-white fill-white" />
              </div>
              <div className="h-2 w-2 rounded-full bg-slate-900/40 blur-[1px] mt-0.5" />
            </div>
          </div>

          {/* Floating "Use current location" button */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isGpsLocating}
              className="flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-4 py-2 text-xs font-bold text-brand shadow-md transition active:scale-95 hover:bg-slate-50"
            >
              {isGpsLocating ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
              ) : (
                <Navigation className="h-4 w-4 text-brand fill-brand/20" />
              )}
              Use current location
            </button>
          </div>
        </div>

        {/* SLIDING BOTTOM FORM CONTAINER */}
        <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain bg-white px-4 pt-3 pb-24 shadow-2xl rounded-t-3xl border-t border-slate-100">
          {/* Top handle bar */}
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />

          {/* Location Summary Header */}
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <MapPin className="h-5 w-5 fill-brand text-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-900">
                  {isGeocoding ? 'Detecting area…' : areaName || 'Selected Location'}
                </h3>
                <p className="line-clamp-2 text-xs font-medium text-slate-500">
                  {locationText || 'Move pin on map to detect address'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          </div>

          {/* Address details* input */}
          <div className="mb-4">
            <label className="sr-only">Address details</label>
            <input
              type="text"
              value={addressDetails}
              onChange={(e) => setAddressDetails(e.target.value)}
              placeholder="Address details*"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <p className="mt-1 text-[11px] font-medium text-slate-400 pl-1">
              E.g. Floor, Company name, Tower, Flat no.
            </p>
          </div>

          {/* Receiver details for this address */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold text-slate-600">
              Receiver details for this address
            </label>

            {!isEditingReceiver ? (
              <button
                type="button"
                onClick={() => setIsEditingReceiver(true)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300"
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                  <Phone className="h-4 w-4 text-slate-600" />
                  <span>
                    {receiverName || 'Receiver'}, {receiverPhone || 'No phone set'}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/20">
                  <User className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Receiver Name"
                    className="w-full text-xs font-medium text-slate-800 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/20">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    maxLength={10}
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Receiver 10-digit Phone"
                    className="w-full text-xs font-medium text-slate-800 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingReceiver(false)}
                  className="w-full rounded-xl bg-brand py-2 text-xs font-bold text-white transition hover:bg-brand/90"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* Save address as: Home, Work, Other */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-bold text-slate-600">
              Save address as
            </label>
            <div className="flex items-center gap-2.5">
              {[
                { key: 'Home', icon: Home, label: 'Home' },
                { key: 'Work', icon: Briefcase, label: 'Work' },
                { key: 'Other', icon: MapPin, label: 'Other' },
              ].map((item) => {
                const Icon = item.icon
                const isSelected = tag === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTag(item.key)}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                      isSelected
                        ? 'border border-brand bg-brand/10 text-brand ring-1 ring-brand/30'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isSelected ? 'text-brand' : 'text-slate-400'}`} />
                    {item.label}
                  </button>
                )
              })}
            </div>

            {tag === 'Other' && (
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Label name (e.g. Gym, Parents, Villa)"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
              />
            )}
          </div>

          {/* Door/building image (optional) */}
          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-bold text-slate-600">
              Door/building image (optional)
            </label>

            {doorImageUrl ? (
              <div className="relative flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                <img
                  src={doorImageUrl}
                  alt="Door location"
                  className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800">Photo attached</p>
                  <p className="text-[11px] text-slate-500">Helps partner find exact entrance</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDoorImageUrl('')}
                  className="rounded-full p-2 text-rose-500 transition hover:bg-rose-50"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center transition hover:border-brand hover:bg-brand/5 active:scale-[0.99]"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand">
                  {isUploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  ) : (
                    <Camera className="h-4 w-4 text-brand" />
                  )}
                  {isUploadingImage ? 'Uploading photo…' : 'Add an image'}
                </div>
                <p className="mt-1 text-[11px] font-medium text-slate-500 max-w-xs">
                  This helps our delivery partners find your exact location faster
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
              {errorMessage}
            </div>
          )}
        </div>

        {/* STICKY BOTTOM BUTTON (Styled with App Brand Cyan/Teal Theme) */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-100 bg-white p-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl">
          <button
            type="button"
            onClick={handleSaveAddress}
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-bold text-white shadow-md shadow-brand/20 transition active:scale-[0.99] hover:bg-brand/90 disabled:opacity-70"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {isSaving ? 'Saving address…' : 'Save address'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
