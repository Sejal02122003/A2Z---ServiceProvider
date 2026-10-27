import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Briefcase,
  Camera,
  Check,
  ChevronRight,
  ExternalLink,
  Home,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import {
  deleteSavedAddress,
  getSavedAddresses,
  setDefaultSavedAddress,
} from '../../../api/addressApi.js'
import {
  readAppUserLocation,
  writeAppUserLocation,
} from '../../../lib/appUserLocationStorage.js'
import { calculateDistanceKm } from '../../../utils/distance.js'
import { AddAddressModal } from './AddAddressModal.jsx'
import { useAuth } from '../../../hooks/useAuth.js'

export function SelectAddressSheet({
  open,
  onClose,
  onSelectAddress,
}) {
  const { user } = useAuth?.() || {}
  const [addresses, setAddresses] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [actionMenuId, setActionMenuId] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  // Add/Edit Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)

  // Door Image Preview Modal
  const [previewImageUrl, setPreviewImageUrl] = useState(null)

  // User's current GPS location for dynamic distance calculation
  const [currentGps, setCurrentGps] = useState(null)

  // Read current GPS on mount or open
  useEffect(() => {
    if (!open) return
    const stored = readAppUserLocation()
    if (stored?.lat && stored?.lng) {
      setCurrentGps({ lat: stored.lat, lng: stored.lng })
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentGps({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        () => {},
        { timeout: 8000 }
      )
    }
  }, [open])

  // Fetch addresses on open
  const fetchAddresses = async () => {
    try {
      setIsLoading(true)
      const res = await getSavedAddresses()
      const list = res?.data?.addresses || []
      setAddresses(list)
    } catch (err) {
      console.error('Failed to load addresses:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchAddresses()
      setActionMenuId(null)
    }
  }, [open])

  // Toast auto-clear
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(''), 3000)
    return () => clearTimeout(t)
  }, [toastMessage])

  // Active address ID from local storage
  const activeAddressId = useMemo(() => {
    const loc = readAppUserLocation()
    return loc?.addressId || null
  }, [open, addresses])

  // Handle selecting an address
  const handleSelect = (addr) => {
    const fullText = addr.addressDetails
      ? `${addr.addressDetails}, ${addr.locationText}`
      : addr.locationText

    writeAppUserLocation({
      address: fullText,
      lat: addr.lat,
      lng: addr.lng,
      city: addr.city || null,
      addressId: addr._id,
      tag: addr.tag,
      receiverName: addr.receiverName,
      receiverPhone: addr.receiverPhone,
    })

    window.dispatchEvent(new CustomEvent('lc-app-user-location-changed'))

    if (onSelectAddress) {
      onSelectAddress(addr)
    }
    onClose()
  }

  // Handle Set Default
  const handleSetDefault = async (addressId, e) => {
    e?.stopPropagation()
    setActionMenuId(null)
    try {
      const res = await setDefaultSavedAddress(addressId)
      setAddresses(res?.data?.addresses || [])
      setToastMessage('Default address updated')
    } catch (err) {
      console.error('Set default error:', err)
      setToastMessage('Could not update default address')
    }
  }

  // Handle Delete Address
  const handleDelete = async (addressId, e) => {
    e?.stopPropagation()
    setActionMenuId(null)
    try {
      const res = await deleteSavedAddress(addressId)
      setAddresses(res?.data?.addresses || [])
      setToastMessage('Address removed')
    } catch (err) {
      console.error('Delete address error:', err)
      setToastMessage('Could not delete address')
    }
  }

  // Handle Edit Address
  const handleEdit = (addr, e) => {
    e?.stopPropagation()
    setActionMenuId(null)
    setEditingAddress(addr)
    setIsAddModalOpen(true)
  }

  // Handle Share Address
  const handleShare = async (addr, e) => {
    e?.stopPropagation()
    const fullText = `${addr.tag || 'Saved Address'}: ${addr.addressDetails ? `${addr.addressDetails}, ` : ''}${addr.locationText}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Address on A2Z Service Hub',
          text: fullText,
        })
        return
      } catch {
        // User cancelled or unsupported
      }
    }

    try {
      await navigator.clipboard.writeText(fullText)
      setToastMessage('Address copied to clipboard!')
    } catch {
      setToastMessage('Could not copy address')
    }
  }

  if (!open && !isAddModalOpen && !previewImageUrl) return null

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <div
            key="select-address-wrapper"
            className="fixed inset-0 z-[210] flex items-end sm:items-center sm:justify-center overflow-hidden"
          >
            {/* Backdrop */}
            <motion.div
              key="select-address-backdrop"
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />

            {/* Bottom Sheet Modal */}
            <motion.div
              key="select-address-panel"
              className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-[28px] sm:rounded-3xl bg-[#f8f9fa] shadow-2xl overflow-hidden"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            >
          {/* HEADER */}
          <div className="relative flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              Select an address
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-xs transition hover:bg-slate-800 active:scale-95"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-12 space-y-4">
            {/* ACTION CARD: + Add Address */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setEditingAddress(null)
                  setIsAddModalOpen(true)
                }}
                className="flex w-full items-center justify-between px-4 py-3.5 transition hover:bg-slate-50 active:bg-slate-100 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center text-brand font-extrabold text-xl leading-none">
                    +
                  </span>
                  <span className="text-sm font-bold text-brand">
                    Add Address
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* SAVED ADDRESSES SECTION */}
            <div>
              <p className="px-1 mb-2.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                SAVED ADDRESSES
              </p>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                  <p className="mt-2 text-xs font-semibold">Loading saved addresses…</p>
                </div>
              ) : addresses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
                  <MapPin className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs font-bold text-slate-700">No saved addresses yet</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Add your home or work address for quick bookings!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAddress(null)
                      setIsAddModalOpen(true)
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-brand/90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Address Now
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr, index) => {
                    const isSelected = activeAddressId && addr._id && activeAddressId === addr._id
                    const distance = calculateDistanceKm(
                      currentGps?.lat,
                      currentGps?.lng,
                      addr.lat,
                      addr.lng
                    )

                    const isHome = addr.tag === 'Home'
                    const isWork = addr.tag === 'Work'
                    const TagIcon = isHome ? Home : isWork ? Briefcase : MapPin

                    return (
                      <div
                        key={addr._id || `addr-${index}-${addr.lat || 0}-${addr.lng || 0}`}
                        onClick={() => handleSelect(addr)}
                        className={`group relative cursor-pointer rounded-2xl border bg-white p-4 transition shadow-xs hover:border-slate-300 ${
                          isSelected
                            ? 'border-brand ring-2 ring-brand/25 bg-brand/5'
                            : 'border-slate-200/90'
                        }`}
                      >
                        {/* Top Badge: DELIVERS TO */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black tracking-wide text-brand uppercase">
                            DELIVERS TO
                          </span>
                          {addr.isDefault && (
                            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                              Default
                            </span>
                          )}
                        </div>

                        {/* Card Content Row */}
                        <div className="flex items-start gap-3.5">
                          {/* Left Column: Icon + Distance */}
                          <div className="flex flex-col items-center shrink-0 pt-0.5 w-12 text-center">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isSelected ? 'bg-brand/15 text-brand' : 'bg-slate-100 text-slate-700'}`}>
                              <TagIcon className="h-5 w-5 stroke-[1.75]" />
                            </div>
                            {distance && (
                              <span className="mt-1 text-[10px] font-bold text-slate-500 whitespace-nowrap">
                                {distance}
                              </span>
                            )}
                          </div>

                          {/* Middle Column: Tag, Full Address, Phone */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                              {addr.tag === 'Other' && addr.customTag ? addr.customTag : addr.tag || 'Address'}
                            </h4>
                            <p className="text-xs font-medium text-slate-600 leading-snug">
                              {addr.addressDetails ? `${addr.addressDetails}, ` : ''}
                              {addr.locationText}
                            </p>
                            <p className="text-xs font-semibold text-slate-700 pt-0.5">
                              Phone number: {addr.receiverPhone ? `+91-${addr.receiverPhone}` : user?.phone ? `+91-${user.phone}` : 'Not provided'}
                            </p>
                          </div>
                        </div>

                        {/* BOTTOM ACTION BUTTONS ROW: ···, ➦, 📷 */}
                        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100 pl-14">
                          {/* Options Menu Button (···) */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActionMenuId(actionMenuId === addr._id ? null : addr._id)
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 active:scale-95"
                              aria-label="More options"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>

                            {/* Options dropdown */}
                            {actionMenuId === addr._id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute left-0 bottom-full z-50 mb-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => handleEdit(addr, e)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Edit address
                                </button>
                                {!addr.isDefault && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleSetDefault(addr._id, e)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Set as default
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(addr._id, e)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Share Button (➦) */}
                          <button
                            type="button"
                            onClick={(e) => handleShare(addr, e)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 active:scale-95"
                            aria-label="Share address"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Door Image Indicator / Preview (📷) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (addr.doorImageUrl) {
                                setPreviewImageUrl(addr.doorImageUrl)
                              } else {
                                handleEdit(addr, e)
                              }
                            }}
                            className={`flex h-8 w-8 items-center justify-center rounded-full border transition active:scale-95 ${
                              addr.doorImageUrl
                                ? 'border-brand/40 bg-brand/10 text-brand'
                                : 'border-slate-200 text-slate-400 hover:bg-slate-100'
                            }`}
                            aria-label="View door photo"
                            title={addr.doorImageUrl ? 'View entrance photo' : 'Add entrance photo'}
                          >
                            <Camera className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* FLOATING TOAST NOTIFICATION */}
          {toastMessage && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xl animate-fade-in">
              {toastMessage}
            </div>
          )}
        </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD / EDIT ADDRESS MODAL */}
      <AddAddressModal
        key="add-address-modal"
        open={isAddModalOpen}
        initialAddress={editingAddress}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingAddress(null)
        }}
        onSaved={(savedAddr) => {
          fetchAddresses()
          if (onSelectAddress) {
            onSelectAddress(savedAddr)
          }
        }}
      />

      {/* DOOR PHOTO PREVIEW MODAL */}
      <AnimatePresence>
        {previewImageUrl && (
          <motion.div
            key="door-preview-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImageUrl(null)}
            className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-sm w-full overflow-hidden rounded-2xl bg-white p-3 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2">
                <p className="text-xs font-bold text-slate-800">Entrance / Door Photo</p>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <img
                src={previewImageUrl}
                alt="Entrance"
                className="w-full rounded-xl object-contain max-h-80"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}
