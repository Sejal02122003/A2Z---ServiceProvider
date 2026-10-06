import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { bookingsApi } from '../../api/bookingsApi.js'
import { AppPrimaryButton } from '../app/AppPrimaryButton.jsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock,
  HardHat,
  History,
  MapPin,
  Navigation,
  Phone,
  Timer,
  User,
  X,
  Camera,
  Loader2,
  Wallet,
  AlertOctagon,
} from 'lucide-react'
import { AppBadge } from '../app-ui/data-display/AppBadge.jsx'
import { AppSecondaryButton } from '../app/AppSecondaryButton.jsx'
import { GlassPanel } from '../ui/GlassPanel.jsx'
import { LabourBounceCancelModal } from './LabourBounceCancelModal.jsx'
import { buildAssignmentDetailSnapshot } from '../../lib/labourAssignmentDetail.js'
import { uploadMedia, assetUrlFromUpload } from '../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import { useSocket } from '../../context/SocketContext.jsx'
import { useSelector } from 'react-redux'

const STATUS_DOT = {
  brand: 'bg-brand',
  emerald: 'bg-blue-600',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  slate: 'bg-slate-300',
}

function JobCountdownTimer({ startedAt, hours }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isOvertime, setIsOvertime] = useState(false)

  useEffect(() => {
    if (!startedAt) return

    const totalMs = (hours || 1) * 60 * 60 * 1000
    const start = new Date(startedAt).getTime()
    
    const updateTimer = () => {
      const now = Date.now()
      const elapsed = now - start
      let remaining = totalMs - elapsed

      if (remaining < 0) {
        setIsOvertime(true)
        remaining = Math.abs(remaining)
      } else {
        setIsOvertime(false)
      }

      const h = Math.floor(remaining / (1000 * 60 * 60))
      const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
      const s = Math.floor((remaining % (1000 * 60)) / 1000)

      setTimeLeft(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      )
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [startedAt, hours])

  if (!startedAt) return null

  return (
    <div className={`mb-4 flex items-center justify-between rounded-xl border p-4 ${isOvertime ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-brand/20 bg-brand/5 text-brand'}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider">{isOvertime ? 'Overtime' : 'Time Remaining'}</p>
        <p className="text-2xl font-black tabular-nums tracking-tight">{timeLeft}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isOvertime ? 'bg-rose-100' : 'bg-brand/10'}`}>
        <Clock className={`h-6 w-6 ${isOvertime ? 'text-rose-600' : 'text-brand'}`} />
      </div>
    </div>
  )
}

/**
 * Full assignment brief — project timeline, site, supervisor, per-day attendance.
 */
export function LabourAssignmentDetailModal({ open, onClose, job, rawJob, assignmentKind = 'active', onRefresh }) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()

  const computedDetail = useMemo(() => {
    if (!open || !job) return null
    return buildAssignmentDetailSnapshot([], job, rawJob)
  }, [open, job, rawJob])

  const [cachedDetail, setCachedDetail] = useState(null)
  useEffect(() => {
    if (computedDetail) {
      setCachedDetail(computedDetail)
    }
  }, [computedDetail])

  const detail = computedDetail || cachedDetail

  const [cachedRawJob, setCachedRawJob] = useState(null)
  const [cachedAssignmentKind, setCachedAssignmentKind] = useState('active')

  useEffect(() => {
    if (rawJob) setCachedRawJob(rawJob)
  }, [rawJob])

  useEffect(() => {
    if (assignmentKind) setCachedAssignmentKind(assignmentKind)
  }, [assignmentKind])

  const activeRawJob = rawJob || cachedRawJob
  const displayKind = assignmentKind || cachedAssignmentKind

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [jobImage, setJobImage] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showPaymentWaiting, setShowPaymentWaiting] = useState(false)
  const [livePaymentStatus, setLivePaymentStatus] = useState(rawJob?.paymentStatus || 'PENDING')
  const [showCancelModal, setShowCancelModal] = useState(false)
  
  const socket = useSocket()
  const user = useSelector(state => state.auth.user)
  
  const assignment = activeRawJob?.assignments?.find(a => String(a.labourId?._id || a.labourId) === String(user?._id))
  const displayStatus = assignment ? assignment.status : activeRawJob?.status
  
  useEffect(() => {
    const handleStatusUpdate = (data) => {
      if (data.bookingId === activeRawJob?._id) {
        if (data.paymentStatus === 'PAID') {
          setLivePaymentStatus('PAID')
          setShowPaymentWaiting(true)
          setCachedRawJob(prev => prev ? { ...prev, paymentStatus: data.paymentStatus } : { ...activeRawJob, paymentStatus: data.paymentStatus })
        } else if (data.paymentStatus) {
          setLivePaymentStatus(data.paymentStatus)
          setCachedRawJob(prev => prev ? { ...prev, paymentStatus: data.paymentStatus } : { ...activeRawJob, paymentStatus: data.paymentStatus })
        }
      }
    }
    socket.on('BOOKING_STATUS_UPDATE', handleStatusUpdate)
    return () => { socket.off('BOOKING_STATUS_UPDATE', handleStatusUpdate) }
  }, [socket, activeRawJob?._id])

  useEffect(() => {
    if (!open) {
      setShowPaymentWaiting(false)
    } else if (activeRawJob) {
      setLivePaymentStatus(prev => prev === 'PAID' ? 'PAID' : (activeRawJob.paymentStatus || 'PENDING'))
    }
  }, [open, activeRawJob])

  useEffect(() => {
    if (open && displayStatus === 'COMPLETED') {
      setShowPaymentWaiting(true)
    }
  }, [open, displayStatus])

  const handleStatusUpdate = async (nextStatus, requireOtp) => {
    if (requireOtp && !otp) {
      setErrorMsg('OTP is required.')
      return
    }
    if (requireOtp && !jobImage) {
      setErrorMsg(nextStatus === 'STARTED' ? 'Before Work image is required.' : 'After Work image is required.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      let payload = nextStatus
      if (requireOtp) {
        payload = { status: nextStatus, otp }
        if (nextStatus === 'STARTED') payload.beforeImage = jobImage
        if (nextStatus === 'COMPLETED') payload.afterImage = jobImage
      }

      const res = await bookingsApi.updateBookingStatus(activeRawJob._id, payload)
      const updatedBooking = res?.data?.booking

      setOtp('')
      setJobImage(null)
      
      setCachedRawJob(updatedBooking || (prev => prev ? { ...prev, status: nextStatus, startedAt: updatedBooking?.startedAt || prev.startedAt } : (rawJob ? { ...rawJob, status: nextStatus, startedAt: updatedBooking?.startedAt || rawJob.startedAt } : null)))
      
      if (onRefresh) onRefresh()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update status.')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    setErrorMsg('')
    try {
      const uploaded = await uploadMedia(file, UPLOAD_FOLDERS.GENERAL_MEDIA)
      setJobImage(assetUrlFromUpload(uploaded))
    } catch (err) {
      setErrorMsg('Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  if (typeof document === 'undefined') return null

  const sheet = (
    <AnimatePresence>
      {open && detail ? (
        <motion.div
          className="fixed inset-0 z-[200] flex h-[100dvh] max-h-[100dvh] flex-col bg-slate-50"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-detail-title"
        >
          <motion.div className="relative shrink-0 overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-slate-950 text-white">
            <div
              className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=60')] bg-cover bg-center opacity-30"
              aria-hidden
            />
            <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-900/85 to-slate-900/60" aria-hidden />

            <div className="relative px-4 pb-5 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <motion.div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm"
                  aria-label="Close"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Assignment details</p>
                  <h1 id="assignment-detail-title" className="truncate text-lg font-extrabold">
                    {detail.job.siteName || detail.job.title}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white/80 hover:bg-white/10"
                  aria-label="Dismiss"
                >
                  <X className="h-5 w-5" />
                </button>
              </motion.div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm">
                  {displayKind === 'active' ? 'Active project' : 'Scheduled'}
                </span>
                {detail.job.projectCode ? (
                  <span className="rounded-full bg-brand/30 px-2.5 py-1 text-[10px] font-bold ring-1 ring-brand/40">
                    {detail.job.projectCode}
                  </span>
                ) : null}
                {detail.isMultiDay ? (
                  <span className="rounded-full bg-amber-400/90 px-2.5 py-1 text-[10px] font-black text-amber-950">
                    Day {detail.dayIndex} of {detail.durationDays}
                  </span>
                ) : null}
              </div>

              {detail.isMultiDay ? (
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-wide text-white/75">
                    <span>Project progress</span>
                    <span>
                      {detail.workedDays}/{detail.durationDays} days worked
                    </span>
                  </div>
                  <motion.div className="h-2.5 overflow-hidden rounded-full bg-white/15">
                    <motion.div
                      className="h-full rounded-full bg-linear-to-r from-brand-bright to-brand"
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${detail.progressPct}%` }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </motion.div>
                  <p className="mt-1.5 text-xs text-white/70">
                    {detail.startLabel} → {detail.endLabel} · {detail.daysRemaining} day
                    {detail.daysRemaining === 1 ? '' : 's'} left on calendar
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>

          <motion.div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <GlassPanel className="grid grid-cols-2 gap-3 border-slate-200/90 p-4 sm:grid-cols-4">
              {[
                { label: 'Role', value: detail.job.role, icon: HardHat },
                { label: 'Rate', value: detail.job.rateLabel || '—', icon: CheckCircle2 },
                { label: 'Shift', value: detail.job.shiftLabel, icon: Clock },
                { label: 'Total time', value: detail.totalWorkTime, icon: Timer },
              ].map((cell) => {
                const Icon = cell.icon
                return (
                  <div key={cell.label} className="min-w-0">
                    <Icon className="h-4 w-4 text-slate-400" aria-hidden />
                    <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">{cell.label}</p>
                    <p className="mt-0.5 text-xs font-extrabold text-slate-900">{cell.value}</p>
                  </div>
                )
              })}
            </GlassPanel>

            <section>
              <h2 className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Site & contractor
              </h2>
              <GlassPanel className="space-y-3 border-slate-200/90 p-4">
                <p className="flex items-start gap-2 text-sm font-bold text-slate-900">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  {detail.job.contractor}
                </p>
                <p className="flex items-start gap-2 text-sm text-slate-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  {detail.job.location}
                </p>
                {detail.gateInstruction ? (
                  <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-bold text-slate-800">Site entry:</span> {detail.gateInstruction}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {detail.job.facilities?.map((f) => (
                    <span
                      key={f}
                      className="rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-900"
                    >
                      {f}
                    </span>
                  ))}
                </div>
                <AppSecondaryButton
                  as="a"
                  href={`https://www.google.com/maps/search/?api=1&query=${detail.job.mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 text-sm"
                >
                  <Navigation className="h-4 w-4" aria-hidden />
                  Open in Google Maps
                </AppSecondaryButton>
              </GlassPanel>
            </section>

            {activeRawJob && displayKind === 'active' && !['COMPLETED', 'CANCELLED'].includes(displayStatus) ? (
              <section>
                <h2 className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wider text-brand">
                  Live Job Actions
                </h2>
                <GlassPanel className="space-y-3 border-brand/20 bg-brand/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">Current Status:</span>
                    <AppBadge variant="brand">{displayStatus}</AppBadge>
                  </div>
                  
                  {errorMsg && (
                    <p className="text-xs font-bold text-rose-600">{errorMsg}</p>
                  )}

                  {displayStatus === 'ACCEPTED' && (
                    <AppPrimaryButton 
                      type="button" 
                      onClick={() => handleStatusUpdate('EN_ROUTE', false)}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Updating...' : 'I am En Route'}
                    </AppPrimaryButton>
                  )}

                  {displayStatus === 'EN_ROUTE' && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-bold text-slate-800 mb-2">1. Upload Before Work Image</p>
                        {jobImage ? (
                          <div className="relative h-40 w-full overflow-hidden rounded-xl border border-slate-200">
                            <img src={jobImage} alt="Before work" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setJobImage(null)}
                              className="absolute right-2 top-2 rounded-full bg-slate-900/50 p-1.5 text-white backdrop-blur-sm"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white/50 text-slate-500 transition hover:border-brand hover:bg-brand/5 hover:text-brand">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={handleImageUpload}
                              disabled={uploadingImage}
                            />
                            {uploadingImage ? (
                              <Loader2 className="h-6 w-6 animate-spin text-brand" />
                            ) : (
                              <>
                                <Camera className="h-6 w-6" />
                                <span className="text-sm font-semibold">Tap to capture</span>
                              </>
                            )}
                          </label>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-bold text-slate-800 mb-2">2. Ask customer for Start OTP</p>
                        <input 
                          type="text" 
                          placeholder="Enter Start OTP" 
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold tracking-widest outline-hidden focus:border-brand focus:ring-1 focus:ring-brand"
                          maxLength={4}
                        />
                      </div>
                      <AppPrimaryButton 
                        type="button" 
                        onClick={() => handleStatusUpdate('STARTED', true)}
                        disabled={loading || otp.length < 4 || !jobImage || uploadingImage}
                        className="w-full"
                      >
                        {loading ? 'Updating...' : 'Start Job'}
                      </AppPrimaryButton>
                    </div>
                  )}

                  {displayStatus === 'STARTED' && (
                    <div className="space-y-4">
                      {(() => {
                        let startedAt = activeRawJob.startedAt;
                        let myExtraHours = activeRawJob.extraHours || 0;
                        if (activeRawJob.assignments && activeRawJob.assignments.length > 0 && user) {
                          const myAssignment = activeRawJob.assignments.find(a => {
                            const aId = typeof a.labourId === 'object' ? a.labourId._id : a.labourId;
                            return String(aId) === String(user._id);
                          });
                          if (myAssignment?.startedAt) startedAt = myAssignment.startedAt;
                          if (myAssignment?.extraHours) myExtraHours += myAssignment.extraHours;
                        }
                        // Default to now if not available yet but status is started
                        startedAt = startedAt || new Date();
                        const totalHours = (activeRawJob.hours || 1) + myExtraHours;
                        return <JobCountdownTimer startedAt={startedAt} hours={totalHours} />;
                      })()}
                      <div>
                        <p className="text-sm font-bold text-slate-800 mb-2">1. Upload After Work Image</p>
                        {jobImage ? (
                          <div className="relative h-40 w-full overflow-hidden rounded-xl border border-slate-200">
                            <img src={jobImage} alt="After work" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setJobImage(null)}
                              className="absolute right-2 top-2 rounded-full bg-slate-900/50 p-1.5 text-white backdrop-blur-sm"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white/50 text-slate-500 transition hover:border-blue-600 hover:bg-blue-600/5 hover:text-blue-600">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={handleImageUpload}
                              disabled={uploadingImage}
                            />
                            {uploadingImage ? (
                              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            ) : (
                              <>
                                <Camera className="h-6 w-6" />
                                <span className="text-sm font-semibold">Tap to capture</span>
                              </>
                            )}
                          </label>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-bold text-slate-800 mb-2">2. Ask customer for Completion OTP</p>
                        <input 
                          type="text" 
                          placeholder="Enter Completion OTP" 
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold tracking-widest outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                          maxLength={4}
                        />
                      </div>
                      <AppPrimaryButton 
                        type="button" 
                        onClick={() => handleStatusUpdate('COMPLETED', true)}
                        disabled={loading || otp.length < 4 || !jobImage || uploadingImage}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {loading ? 'Updating...' : 'Complete Job'}
                      </AppPrimaryButton>
                    </div>
                  )}

                  {['ACCEPTED', 'EN_ROUTE'].includes(displayStatus) && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => setShowCancelModal(true)}
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                      >
                        <AlertOctagon className="h-3.5 w-3.5" />
                        Cancel Assignment / Bounce Job
                      </button>
                    </div>
                  )}
                </GlassPanel>
              </section>
            ) : null}

            <section>
              <h2 className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">Supervisor</h2>
              <GlassPanel className="flex items-center gap-3 border-slate-200/90 p-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <User className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-slate-900">{detail.job.supervisor || '—'}</p>
                  <p className="text-xs text-slate-500">On-site contact for safety & directions</p>
                  {detail.job.supervisorPhone ? (
                    <a
                      href={`tel:${detail.job.supervisorPhone}`}
                      className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-brand"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      {detail.job.supervisorPhone}
                    </a>
                  ) : null}
                </div>
              </GlassPanel>
            </section>

            {(activeRawJob.quantity > 1 || (activeRawJob.contractorInfo?.services && activeRawJob.contractorInfo.services.length > 0)) && (
              <section>
                <h2 className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">Team Members</h2>
                <GlassPanel className="border-slate-200/90 p-4 space-y-3">
                  {Array.from({ length: activeRawJob.quantity || 1 }).map((_, idx) => {
                    const assignment = activeRawJob.assignments?.[idx];
                    const isMe = assignment && String(assignment.labourId?._id || assignment.labourId) === String(user?._id);
                    return (
                      <div key={idx} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3 text-sm text-slate-700">
                          <div className={`flex items-center justify-center w-7 h-7 rounded-full shadow-sm border shrink-0 ${isMe ? 'bg-brand/10 border-brand/20' : 'bg-slate-100 border-slate-200'}`}>
                            <User className={`h-4 w-4 ${isMe ? 'text-brand' : 'text-slate-400'}`} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Professional {idx + 1} {isMe && '(You)'}</span>
                            <span className={`font-bold leading-tight ${assignment ? 'text-slate-800' : 'text-slate-400'}`}>
                              {assignment 
                                ? `${assignment.labourId?.fullName || assignment.labourId?.name || 'Assigned'}`
                                : 'Pending Acceptance'}
                            </span>
                          </div>
                        </div>
                        {assignment && assignment.status && (
                          <div className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            {assignment.status}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </GlassPanel>
              </section>
            )}

            {detail.rawNotes ? (
              <section>
                <h2 className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">Instructions</h2>
                <GlassPanel className="border-slate-200/90 p-4 text-sm leading-relaxed text-slate-700">
                  {detail.rawNotes}
                </GlassPanel>
              </section>
            ) : null}


            <section>
              <h2 className="mb-2 flex items-center gap-1.5 px-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <History className="h-3.5 w-3.5" aria-hidden />
                Assignment history
              </h2>
              <ol className="relative border-l-2 border-slate-200/90 pl-4 ml-1">
                {detail.timeline.map((ev, i) => (
                  <li key={`${ev.at}-${i}`} className="relative pb-4 last:pb-0">
                    <span
                      className="absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-slate-50"
                      aria-hidden
                    />
                    <p className="text-sm font-extrabold text-slate-900">{ev.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{ev.body}</p>
                  </li>
                ))}
                      </ol>
            </section>
          </motion.div>
          
          {showPaymentWaiting && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl text-center border border-white/20"
              >
                {livePaymentStatus === 'PAID' ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="relative mx-auto mb-8 mt-2 flex h-28 w-28 items-center justify-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
                        className="relative z-10 flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-brand-bright to-brand shadow-xl shadow-brand/40"
                      >
                        <CheckCircle2 className="h-14 w-14 text-white" strokeWidth={2.5} />
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 rounded-full bg-brand"
                      />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                      Collect Money
                    </h3>
                    <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed px-4">
                      The customer has paid successfully. Collect your earnings from the wallet.
                    </p>

                    {/* Team Members List Inside Popup */}
                    {(activeRawJob.quantity > 1 || (activeRawJob.contractorInfo?.services && activeRawJob.contractorInfo.services.length > 0)) && (
                      <div className="mb-6 text-left border border-slate-100 rounded-xl p-3 bg-slate-50 overflow-y-auto max-h-40">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Team Members</p>
                        <div className="space-y-2">
                          {Array.from({ length: activeRawJob.quantity || 1 }).map((_, idx) => {
                            const a = activeRawJob.assignments?.[idx];
                            const isMe = a && String(a.labourId?._id || a.labourId) === String(user?._id);
                            return (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${isMe ? 'bg-brand/10 text-brand' : 'bg-slate-200 text-slate-500'}`}>
                                  <User className="h-3.5 w-3.5" />
                                </div>
                                <span className={`font-semibold ${a ? 'text-slate-800' : 'text-slate-400'} truncate`}>
                                  {a ? `${a.labourId?.fullName || a.labourId?.name || 'Assigned'}` : 'Pending'} {isMe && '(You)'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentWaiting(false)
                        onClose()
                        navigate('/app/earnings')
                      }}
                      className="w-full rounded-2xl bg-brand py-4 text-[15px] font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand/90 hover:shadow-xl active:scale-[0.98]"
                    >
                      Collect Money
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="relative mx-auto mb-8 mt-2 flex h-28 w-28 items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-brand/20 animate-ping" style={{ animationDuration: '3s' }} />
                      <div className="absolute inset-4 rounded-full bg-brand/30 animate-ping" style={{ animationDuration: '3s', animationDelay: '1.5s' }} />
                      
                      <motion.div 
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="relative z-10 flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-brand-bright to-brand shadow-xl shadow-brand/40"
                      >
                        <Wallet className="h-12 w-12 text-white" strokeWidth={2} />
                      </motion.div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                      Payment Request Sent
                    </h3>
                    <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed px-2">
                      Please wait while the customer completes the payment on their device...
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentWaiting(false)
                        onClose()
                      }}
                      className="w-full rounded-2xl bg-slate-100 py-4 text-[15px] font-bold text-slate-600 transition-all hover:bg-slate-200 active:scale-[0.98]"
                    >
                      Close
                    </button>
                  </motion.div>
                )}
              </motion.div>
            </div>
          )}

          <LabourBounceCancelModal
            open={showCancelModal}
            onClose={() => setShowCancelModal(false)}
            booking={activeRawJob}
            onCancelled={({ penaltyDeducted, reason }) => {
              setShowCancelModal(false)
              if (onRefresh) onRefresh()
              onClose()
            }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  if (!open) return null
  return createPortal(sheet, document.body)
}
