import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { AppStackScreenHeader } from '../../../components/app/AppStackScreenHeader.jsx'
import { IndividualBookingDetail } from '../../../components/app/booking/IndividualBookingDetail.jsx'
import { IndividualBookingHistoryList } from '../../../components/app/booking/IndividualBookingHistoryList.jsx'
import {
  displayBookingsList,
  findBookingByRef,
  loadIndividualBookings,
  rebookDraftFromRecord,
  saveIndividualBookings,
} from '../../../lib/individualBookings.js'
import { writeBookingDraft } from '../../../lib/individualBookingDraft.js'
import { buildBookingFlowPath } from '../../../lib/bookingFlowNavigation.js'

const BTN_PRIMARY =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition active:opacity-90 disabled:opacity-50'

/** History + track detail — new bookings start from Home search or category tiles. */
export function IndividualHomeownerBookings() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [history, setHistory] = useState(() => loadIndividualBookings())

  const detailRef = searchParams.get('ref')?.trim() || ''
  const displayHistory = useMemo(() => displayBookingsList(history), [history])
  const isDemoHistory = history.length === 0
  const detailBooking = useMemo(
    () => (detailRef ? findBookingByRef(displayHistory, detailRef) : null),
    [detailRef, displayHistory],
  )

  useEffect(() => {
    const rebook = searchParams.get('rebookFrom')?.trim()
    if (!rebook) return
    const found = findBookingByRef(displayHistory, rebook)
    if (found) {
      const legacy = rebookDraftFromRecord(found)
      const line = found.lines?.[0]
      writeBookingDraft({
        entryPoint: 'search',
        bookingType: legacy.bookingType,
        serviceDate: legacy.serviceDate,
        durationDays: legacy.durationDays,
        durationKind: found.durationKind || 'few_hours',
        address: legacy.address,
        lat: legacy.lat,
        lng: legacy.lng,
        notes: legacy.notes,
        groupId: line?.groupId || '',
        categoryId: line?.categoryId || '',
        groupName: line?.groupName || '',
        categoryName: line?.categoryName || '',
        matchMode: found.matchMode || 'smart',
        selectedWorkers: found.selectedWorkers || [],
        paymentTiming: 'after_work',
      })
      navigate(buildBookingFlowPath('type'), { replace: true })
      return
    }
    const next = new URLSearchParams(searchParams)
    next.delete('rebookFrom')
    setSearchParams(next, { replace: true })
  }, [searchParams, displayHistory, navigate, setSearchParams])

  useEffect(() => {
    const type = searchParams.get('type')
    if (type !== 'instant' && type !== 'scheduled') return
    writeBookingDraft({ bookingType: type, entryPoint: 'search', matchMode: 'smart' })
    navigate('/user/search', { replace: true })
  }, [searchParams, navigate])

  const clearDetailRef = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('ref')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const handleTrack = useCallback(
    (ref) => {
      const booking = findBookingByRef(displayHistory, ref)
      if (
        booking &&
        (booking.status === 'searching' || booking.status === 'accepted' || booking.status === 'assigned')
      ) {
        navigate(buildBookingFlowPath('active', { ref }))
        return
      }
      const next = new URLSearchParams(searchParams)
      next.set('ref', ref)
      setSearchParams(next)
    },
    [displayHistory, navigate, searchParams, setSearchParams],
  )

  const handleRebook = useCallback(
    (booking) => {
      const legacy = rebookDraftFromRecord(booking)
      const line = booking.lines?.[0]
      writeBookingDraft({
        entryPoint: 'search',
        bookingType: legacy.bookingType,
        serviceDate: legacy.serviceDate,
        durationDays: legacy.durationDays,
        durationKind: booking.durationKind || 'few_hours',
        address: legacy.address,
        lat: legacy.lat,
        lng: legacy.lng,
        notes: legacy.notes,
        groupId: line?.groupId || '',
        categoryId: line?.categoryId || '',
        groupName: line?.groupName || '',
        categoryName: line?.categoryName || '',
        matchMode: 'smart',
        selectedWorkers: [],
      })
      navigate(buildBookingFlowPath('type'))
    },
    [navigate],
  )

  const handleAdvancePipeline = useCallback((booking) => {
    const order = ['pending', 'finding', 'assigned', 'in_progress', 'completed']
    const idx = order.indexOf(booking.status)
    const newStatus = order[Math.min(idx + 1, order.length - 1)] || 'pending'
    const stored = loadIndividualBookings()
    const updated = stored.map((b) => (b.id === booking.id ? { ...b, status: newStatus } : b))
    saveIndividualBookings(updated)
    setHistory(updated)
  }, [])

  if (detailRef) {
    return (
      <div className="space-y-4">
        <AppStackScreenHeader title="Booking details" onBack={clearDetailRef} />
        {!detailBooking ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-800">Booking not found</p>
            <button type="button" className={`${BTN_PRIMARY} mt-4`} onClick={clearDetailRef}>
              Back to list
            </button>
          </div>
        ) : (
          <IndividualBookingDetail
            booking={detailBooking}
            onBack={clearDetailRef}
            onRebook={handleRebook}
            onAdvancePipeline={handleAdvancePipeline}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <AppStackScreenHeader title="My bookings" backTo="/user" />

      <button type="button" className={BTN_PRIMARY} onClick={() => navigate('/user/search')}>
        <Plus className="h-4 w-4" aria-hidden />
        New booking
      </button>

      {isDemoHistory ? (
        <p className="text-center text-xs text-slate-500">Sample list — real bookings appear after you confirm one.</p>
      ) : null}

      <IndividualBookingHistoryList
        items={displayHistory}
        isDemo={isDemoHistory}
        onTrack={handleTrack}
        onRebook={handleRebook}
      />
    </div>
  )
}
