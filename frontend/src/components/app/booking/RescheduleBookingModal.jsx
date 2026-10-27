import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Clock, CheckCircle2, AlertCircle, X, Loader2, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { bookingsApi } from '../../../api/bookingsApi.js'
import { ApiError } from '../../../api/http.js'

const STANDARD_TIME_SLOTS = [
  { label: 'Morning', time: '09:00 AM - 11:00 AM' },
  { label: 'Midday', time: '11:00 AM - 01:00 PM' },
  { label: 'Afternoon', time: '01:00 PM - 03:00 PM' },
  { label: 'Late Afternoon', time: '03:00 PM - 05:00 PM' },
  { label: 'Evening', time: '05:00 PM - 07:00 PM' },
  { label: 'Night', time: '07:00 PM - 09:00 PM' },
]

const RESCHEDULE_REASONS = [
  'Change of plans',
  'Not available at home',
  'Need service earlier / later',
  'Emergency came up',
  'Other',
]

/**
 * Helper to format date as YYYY-MM-DD in local time
 */
function toLocalDateInputValue(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Format date for human friendly display
 */
function formatHumanDate(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return dateString
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * RescheduleBookingModal
 * Props:
 *   open        - boolean
 *   booking     - booking object
 *   onClose     - fn(), dismiss modal
 *   onSuccess   - fn(updatedBooking), called on reschedule success
 */
export function RescheduleBookingModal({ open, booking, onClose, onSuccess }) {
  const todayStr = useMemo(() => toLocalDateInputValue(new Date()), [])

  // Calculate quick date choices (Today, Tomorrow, Day After, Day +3)
  const quickDates = useMemo(() => {
    const list = []
    for (let i = 0; i < 4; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dateStr = toLocalDateInputValue(d)
      let label = 'Today'
      if (i === 1) label = 'Tomorrow'
      else if (i === 2) {
        label = d.toLocaleDateString('en-IN', { weekday: 'short' })
      } else {
        label = d.toLocaleDateString('en-IN', { weekday: 'short' })
      }
      list.push({
        dateStr,
        label,
        subLabel: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      })
    }
    return list
  }, [])

  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [selectedReason, setSelectedReason] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successResult, setSuccessResult] = useState(null)

  // Initialize defaults whenever modal opens or booking changes
  useEffect(() => {
    if (!open || !booking) {
      setError('')
      setSubmitting(false)
      setSuccessResult(null)
      return
    }

    setError('')
    setSubmitting(false)
    setSuccessResult(null)
    setSelectedReason('')
    setReasonNote('')

    // Default selected date to tomorrow or existing scheduled date if upcoming
    if (booking.scheduledAt) {
      const scheduledDate = new Date(booking.scheduledAt)
      if (scheduledDate > new Date()) {
        setSelectedDate(toLocalDateInputValue(scheduledDate))
      } else {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setSelectedDate(toLocalDateInputValue(tomorrow))
      }
    } else {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setSelectedDate(toLocalDateInputValue(tomorrow))
    }

    // Default selected slot
    if (booking.timeSlot) {
      setSelectedSlot(booking.timeSlot)
    } else {
      setSelectedSlot(STANDARD_TIME_SLOTS[0].time)
    }
  }, [open, booking?._id])

  if (!open || !booking) return null

  const shortCode = String(booking._id).slice(-6).toUpperCase()
  const serviceTitle =
    booking.serviceId?.name ||
    booking.subcategoryId?.name ||
    booking.packageBooking?.packageName ||
    'Service'

  // Format existing booking time
  const currentScheduledDisplay = booking.scheduledAt
    ? `${formatHumanDate(booking.scheduledAt)}${booking.timeSlot ? ` at ${booking.timeSlot}` : ''}`
    : booking.date
    ? `${booking.date}${booking.timeSlot ? ` at ${booking.timeSlot}` : ''}`
    : 'Instant / Unscheduled'

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!selectedDate) {
      setError('Please select a date for your service.')
      return
    }
    if (!selectedSlot) {
      setError('Please select a preferred time slot.')
      return
    }

    // Check if the user didn't change anything
    const existingDateStr = booking.scheduledAt ? toLocalDateInputValue(booking.scheduledAt) : ''
    const existingSlot = booking.timeSlot || ''
    if (existingDateStr === selectedDate && existingSlot === selectedSlot) {
      setError('Please select a different date or time slot than your current schedule.')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const payload = {
        scheduledAt: selectedDate,
        timeSlot: selectedSlot,
        reason: selectedReason || 'Customer requested reschedule',
        reasonNote: selectedReason === 'Other' ? reasonNote.trim() : undefined,
      }

      const res = await bookingsApi.rescheduleBooking(booking._id, payload)
      const data = res.data || {}
      const updatedBooking = data.booking || {
        ...booking,
        scheduledAt: data.scheduledAt || selectedDate,
        timeSlot: selectedSlot,
        date: selectedDate,
        isRescheduled: true,
      }

      setSuccessResult({
        booking: updatedBooking,
        formattedTimeStr: data.formattedTimeStr || `${formatHumanDate(selectedDate)} at ${selectedSlot}`,
      })

      if (onSuccess) {
        onSuccess(updatedBooking)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to reschedule booking. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const modalContent = (
    <AnimatePresence>
      <div key="reschedule-booking-wrapper" className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          key="reschedule-booking-modal"
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-white sticky top-0 z-10">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                  Reschedule Booking
                </h2>
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Booking #{shortCode} • {serviceTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {successResult ? (
              // Success Screen
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 flex flex-col items-center text-center space-y-3"
              >
                <div className="h-16 w-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Booking Rescheduled!
                </h3>
                <p className="text-sm font-medium text-slate-600 max-w-xs">
                  Your appointment #{shortCode} has been updated to your preferred time slot.
                </p>

                {/* New Schedule Box */}
                <div className="w-full mt-3 rounded-2xl bg-brand/5 border border-brand/20 p-4 text-left space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand uppercase tracking-wider">
                    <Sparkles className="h-4 w-4" />
                    <span>Updated Appointment</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-900 font-extrabold text-base">
                    <Calendar className="h-5 w-5 text-brand shrink-0" />
                    <span>{formatHumanDate(selectedDate)}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700 font-semibold text-sm">
                    <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{selectedSlot}</span>
                  </div>
                </div>

                <div className="w-full rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-left text-xs text-slate-600 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Your service partner and automated arrival reminders have been updated accordingly.
                  </span>
                </div>

                <div className="w-full pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            ) : (
              // Reschedule Form
              <>
                {/* Error Banner */}
                {error && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 flex items-center gap-2 text-rose-800 text-xs font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Current Schedule Banner */}
                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Current Schedule
                    </span>
                    <span className="text-xs font-bold text-slate-700 mt-0.5 block">
                      {currentScheduledDisplay}
                    </span>
                  </div>
                  <span className="rounded-lg bg-slate-200/60 px-2 py-1 text-[11px] font-bold text-slate-600">
                    Existing
                  </span>
                </div>

                {/* 1. Date Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Select New Date
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {formatHumanDate(selectedDate)}
                    </span>
                  </div>

                  {/* Quick Date Pills */}
                  <div className="grid grid-cols-4 gap-2 mb-2.5">
                    {quickDates.map((item) => {
                      const isSelected = selectedDate === item.dateStr
                      return (
                        <button
                          key={item.dateStr}
                          type="button"
                          onClick={() => {
                            setSelectedDate(item.dateStr)
                            if (error) setError('')
                          }}
                          className={`rounded-2xl p-2.5 text-center border transition ${
                            isSelected
                              ? 'border-brand bg-brand text-white shadow-sm ring-2 ring-brand/20'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <span className={`block text-xs font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {item.label}
                          </span>
                          <span className={`block text-[10px] font-medium mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                            {item.subLabel}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom Date Input Picker */}
                  <div className="relative">
                    <input
                      type="date"
                      min={todayStr}
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value)
                        if (error) setError('')
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-brand focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>

                {/* 2. Time Slot Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Select Time Slot
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {selectedSlot}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STANDARD_TIME_SLOTS.map((slot) => {
                      const isSelected = selectedSlot === slot.time
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot.time)
                            if (error) setError('')
                          }}
                          className={`flex items-center justify-between p-3 rounded-xl border text-left transition ${
                            isSelected
                              ? 'border-brand bg-brand/5 shadow-sm text-brand-900 ring-1 ring-brand'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div>
                            <span className="block text-xs font-bold text-slate-900">
                              {slot.label}
                            </span>
                            <span className="block text-[11px] font-medium text-slate-500 mt-0.5">
                              {slot.time}
                            </span>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 3. Reason Selection (Optional chips) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Reason for Rescheduling <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {RESCHEDULE_REASONS.map((reason) => {
                      const isSelected = selectedReason === reason
                      return (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => {
                            setSelectedReason(isSelected ? '' : reason)
                            if (error) setError('')
                          }}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                            isSelected
                              ? 'border-brand bg-brand text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {reason}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Reason Note (if other selected) */}
                {selectedReason === 'Other' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5"
                  >
                    <textarea
                      rows={2}
                      value={reasonNote}
                      onChange={(e) => setReasonNote(e.target.value)}
                      placeholder="Please mention your reason (optional)..."
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </motion.div>
                )}

                {/* Summary Box */}
                {selectedDate && selectedSlot && (
                  <div className="rounded-2xl border border-brand/20 bg-brand/5 p-3.5 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                      New Booking Timing
                    </span>
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
                      <Calendar className="h-4 w-4 text-brand" />
                      <span>{formatHumanDate(selectedDate)}</span>
                      <ArrowRight className="h-3 w-3 text-slate-400 mx-0.5" />
                      <Clock className="h-4 w-4 text-brand" />
                      <span>{selectedSlot}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Free reschedule. Your service partner will be informed instantly.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          {!successResult && (
            <div className="border-t border-slate-100 px-5 py-3.5 bg-slate-50 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-xl bg-white border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Keep Current
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !selectedDate || !selectedSlot}
                className="flex-1 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-sm hover:bg-brand/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Rescheduling...</span>
                  </>
                ) : (
                  <span>Confirm Reschedule</span>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}
