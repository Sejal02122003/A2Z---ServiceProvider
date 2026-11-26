import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Loader2, MapPin, Navigation } from 'lucide-react'
import {
  hasAppUserLocation,
  readAppUserLocation,
  writeAppUserLocation,
} from '../../lib/appUserLocationStorage.js'

// One prompt per app launch (sessionStorage is cleared when the app is closed)
const PROMPTED_KEY = 'a2z_location_prompted'

async function reverseGeocode(lat, lng) {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) return { address: '', city: '' }
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
    const data = await res.json()
    if (data.status === 'OK' && data.results?.[0]) {
      const comps = data.results[0].address_components || []
      const city = comps.find((c) => c.types.includes('locality'))?.long_name || ''
      return { address: data.results[0].formatted_address || '', city }
    }
  } catch {
    /* fall through: coordinates alone are still saved */
  }
  return { address: '', city: '' }
}

function getPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('unsupported'), { code: 0 }))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

/**
 * Asks for the user's location every time the app is opened (once per launch).
 *  - permission already granted -> quietly refreshes GPS (never overrides a saved address the user picked)
 *  - permission not decided      -> shows an in-app prompt, then the browser/OS permission dialog
 *  - permission denied / failed  -> opens the address picker so the location can be chosen manually
 */
export function LocationLaunchPrompt({ onChooseManually, onLocated }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')

  const saveFromPosition = useCallback(
    async (pos, { keepSelectedAddress = false } = {}) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const stored = readAppUserLocation()
      // Keep an address the user explicitly picked; only refresh coordinates for it
      if (keepSelectedAddress && stored?.addressId) {
        writeAppUserLocation({ ...stored, lat, lng })
      } else {
        const { address, city } = await reverseGeocode(lat, lng)
        writeAppUserLocation({ address, lat, lng, city })
      }
      window.dispatchEvent(new CustomEvent('lc-app-user-location-changed'))
      onLocated?.()
    },
    [onLocated],
  )

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PROMPTED_KEY)) return
      sessionStorage.setItem(PROMPTED_KEY, '1')
    } catch {
      /* storage unavailable: prompt may repeat, which is harmless */
    }

    const run = async () => {
      let state = 'prompt'
      try {
        const status = await navigator.permissions?.query({ name: 'geolocation' })
        if (status?.state) state = status.state
      } catch {
        /* Permissions API unsupported: treat as undecided */
      }

      if (state === 'granted') {
        try {
          const pos = await getPosition({ enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 })
          await saveFromPosition(pos, { keepSelectedAddress: true })
        } catch {
          if (!hasAppUserLocation(readAppUserLocation())) onChooseManually?.()
        }
        return
      }

      if (state === 'denied') {
        if (!hasAppUserLocation(readAppUserLocation())) onChooseManually?.()
        return
      }

      setOpen(true)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allow = async () => {
    setBusy(true)
    setHint('')
    try {
      const pos = await getPosition({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
      await saveFromPosition(pos)
      setOpen(false)
    } catch (err) {
      setHint(
        err?.code === 1
          ? 'Location permission was denied. Please choose your location manually.'
          : 'Could not get your location. Please choose it manually.',
      )
      setOpen(false)
      onChooseManually?.()
    } finally {
      setBusy(false)
    }
  }

  const manual = () => {
    setOpen(false)
    onChooseManually?.()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="location-launch-prompt"
          className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="loc-launch-title"
        >
          <motion.div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
            initial={reduce ? false : { y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/15">
              <MapPin className="h-7 w-7" aria-hidden />
            </div>
            <h2 id="loc-launch-title" className="mt-4 text-center text-lg font-black text-slate-900">
              Allow location access
            </h2>
            <p className="mt-1.5 text-center text-sm font-medium leading-relaxed text-slate-500">
              We use your location to show services and service providers available near you.
            </p>
            {hint ? <p className="mt-3 text-center text-xs font-semibold text-rose-600">{hint}</p> : null}

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={allow}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-brand to-blue-800 py-3.5 text-sm font-black text-white shadow-lg shadow-brand/25 transition active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Navigation className="h-4 w-4" aria-hidden />}
                Use my current location
              </button>
              <button
                type="button"
                onClick={manual}
                disabled={busy}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Enter location manually
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
