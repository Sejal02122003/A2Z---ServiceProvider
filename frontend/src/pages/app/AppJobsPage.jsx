import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Clock, IndianRupee, MapPin, RotateCcw, Sparkles } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { KYC_STATUS } from '../../constants/userRoles.js'
import { AppEmptyState } from '../../components/app/AppEmptyState.jsx'
import { AppButton } from '../../components/app-ui/buttons/AppButton.jsx'
import { LabourAssignmentDetailModal } from '../../components/labour/LabourAssignmentDetailModal.jsx'
import { LabourJobActiveCard } from '../../components/labour/jobs/LabourJobActiveCard.jsx'
import { LabourJobHistoryCard } from '../../components/labour/jobs/LabourJobHistoryCard.jsx'
import { LabourJobOfferCard } from '../../components/labour/jobs/LabourJobOfferCard.jsx'
import { LabourJobsHero } from '../../components/labour/jobs/LabourJobsHero.jsx'
import { LabourJobsTabBar } from '../../components/labour/jobs/LabourJobsTabBar.jsx'
import {
  useGetLabourAssignmentsQuery,
  useRespondAssignmentMutation,
} from '../../store/api/workforceApi.js'
import { bookingsApi } from '../../api/bookingsApi.js'
import { B2cBookingCard } from '../../components/app/B2cBookingCard.jsx'
import {
  bucketsFromAssignments,
  loadJobDemoState,
  nowIso,
  resetJobDemoToSeed,
  saveJobDemoState,
  subscribeJobDemo,
} from '../../lib/labourJobDemoStorage.js'

function isApiAssignment(job) {
  return Boolean(job?.requestId) && /^[a-f0-9]{24}$/i.test(String(job.id))
}

export function AppJobsPage() {
  const { user } = useAuth()
  const reduce = useReducedMotion()
  const [tab, setTab] = useState('offers')
  const [localDemo, setLocalDemo] = useState(() => loadJobDemoState())
  const [b2cBookings, setB2cBookings] = useState([])

  useEffect(() => {
    bookingsApi.getMyBookings().then(res => {
      if (res.data?.bookings) setB2cBookings(res.data.bookings)
    }).catch(console.error)
  }, [])

  const { data: apiData, refetch } = useGetLabourAssignmentsQuery()
  const [respondAssignment] = useRespondAssignmentMutation()


  const apiBuckets = useMemo(
    () => bucketsFromAssignments(apiData?.assignments || []),
    [apiData?.assignments],
  )

  const demo = useMemo(
    () => ({
      offers: [...apiBuckets.offers],
      active: [...apiBuckets.active],
      history: [...apiBuckets.history],
    }),
    [apiBuckets],
  )
  const [confirmingOfferId, setConfirmingOfferId] = useState(null)
  const [detailJob, setDetailJob] = useState(null)
  const [detailKind, setDetailKind] = useState('offers')
  const [toast, setToast] = useState('')

  const kycOk = user?.labourProfile?.kycStatus === KYC_STATUS.VERIFIED

  useEffect(() => subscribeJobDemo(setLocalDemo), [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2800)
  }, [])

  const persist = useCallback((next) => {
    saveJobDemoState(next)
    setLocalDemo(next)
  }, [])

  const refreshDemo = useCallback(() => {
    setLocalDemo(loadJobDemoState())
    refetch()
  }, [refetch])

  const thisMonthCount = useMemo(() => {
    const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const adminCount = demo.history.filter((h) => String(h.completedAt || '').startsWith(ym)).length
    const b2cCount = b2cBookings.filter(b => (b.status === 'COMPLETED' || b.status === 'CANCELLED') && String(b.updatedAt || b.createdAt || '').startsWith(ym)).length
    return adminCount + b2cCount
  }, [demo.history, b2cBookings])

  const b2cOffers = useMemo(() => b2cBookings.filter(b => b.status === 'CREATED' || b.status === 'BROADCASTING'), [b2cBookings])
  const b2cActive = useMemo(() => b2cBookings.filter(b => b.status === 'ACCEPTED' || b.status === 'EN_ROUTE' || b.status === 'STARTED' || b.status === 'ASSIGNED'), [b2cBookings])
  const b2cHistory = useMemo(() => b2cBookings.filter(b => b.status === 'COMPLETED' || b.status === 'CANCELLED'), [b2cBookings])

  const tabCounts = useMemo(
    () => ({
      offers: demo.offers.length + b2cOffers.length,
      active: demo.active.length + b2cActive.length,
      history: demo.history.length + b2cHistory.length,
    }),
    [demo.offers.length, demo.active.length, demo.history.length, b2cOffers.length, b2cActive.length, b2cHistory.length],
  )

  const handleDeclineOffer = (id) => {
    const offer = demo.offers.find((o) => o.id === id)
    if (offer && isApiAssignment(offer)) respondAssignment({ id, action: 'decline' })
    else persist({ ...demo, offers: demo.offers.filter((o) => o.id !== id) })
    if (isApiAssignment(offer)) refreshDemo()
    setConfirmingOfferId(null)
    showToast('Offer declined.')
  }

  const handleStartAccept = (id) => {
    if (!kycOk) {
      showToast('Complete Aadhaar KYC to accept jobs.')
      return
    }
    setConfirmingOfferId((prev) => (prev === id ? null : id))
  }

  const handleConfirmAccept = (offer) => {
    if (!kycOk) return
    if (isApiAssignment(offer)) {
      respondAssignment({ id: offer.id, action: 'accept' })
      refreshDemo()
    } else {
      persist({
        ...demo,
        offers: demo.offers.filter((o) => o.id !== offer.id),
        active: [...demo.active, { ...offer, acceptedAt: nowIso() }],
      })
    }
    setConfirmingOfferId(null)
    showToast('Assignment accepted — head to Active and check in on site.')
    setTab('active')
  }

  const handleMarkOnSite = (id) => {
    const job = demo.active.find((a) => a.id === id)
    if (!job) return
    if (isApiAssignment(job)) {
      refreshDemo()
    } else {
      persist({
        ...demo,
        active: demo.active.map((a) => (a.id === id ? { ...a, status: 'on_site', onSiteAt: nowIso() } : a)),
      })
    }
    showToast('On site — attendance counts toward pay.')
  }

  const handleCompleteActive = (id) => {
    const job = demo.active.find((a) => a.id === id)
    if (!job) return
    if (isApiAssignment(job)) {
      refreshDemo()
    } else {
      const { acceptedAt, ...rest } = job
      persist({
        ...demo,
        active: demo.active.filter((a) => a.id !== id),
        history: [{ ...rest, acceptedAt, completedAt: nowIso() }, ...demo.history],
      })
    }
    showToast('Shift complete — see Earnings for payout.')
    setTab('history')
  }

  const openDetail = (job, kind = tab) => {
    setDetailJob(job)
    setDetailKind(kind)
  }

  const handleResetDemo = () => {
    setDemo(resetJobDemoToSeed())
    setConfirmingOfferId(null)
    showToast('Sample jobs reloaded.')
    setTab('offers')
  }

  const emptyCopy = useMemo(() => {
    if (tab === 'offers') {
      return {
        title: kycOk ? 'No open requests' : 'All caught up',
        subtitle: kycOk
          ? 'New requests and admin assignments will appear here. Reload samples to practice the flow.'
          : 'Reload sample requests to preview cards — verify KYC to accept.',
      }
    }
    if (tab === 'active') {
      return {
        title: 'No active site',
        subtitle: 'Accept an offer to see your deployment here with check-in and completion steps.',
      }
    }
    return {
      title: 'No completed shifts',
      subtitle: 'Finished jobs show here with pay rate and completion time.',
    }
  }, [tab, kycOk])

  return (
    <div className="space-y-4 pb-6">
      <AnimatePresence>
        {toast ? (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            className="fixed left-4 right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-[120] mx-auto max-w-md rounded-2xl border border-brand/30 bg-slate-900/95 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl backdrop-blur-md"
            role="status"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <LabourJobsHero offersCount={demo.offers.length} activeCount={demo.active.length} kycOk={kycOk} />

      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {thisMonthCount} completed this month
        </p>
      </div>

      <LabourJobsTabBar tab={tab} onChange={setTab} counts={tabCounts} />

      <motion.div
        key={tab}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="space-y-3"
      >
        {tab === 'offers' &&
          (demo.offers.length === 0 && b2cOffers.length === 0 ? (
            <div className="space-y-3 pt-2">
              <AppEmptyState icon={Sparkles} title={emptyCopy.title} subtitle={emptyCopy.subtitle} />
            </div>
          ) : (
            <>
              {demo.offers.map((offer, i) => (
                <motion.div
                  key={offer.id}
                  initial={reduce ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <LabourJobOfferCard
                    offer={offer}
                    kycOk={kycOk}
                    confirming={confirmingOfferId === offer.id}
                    onDecline={handleDeclineOffer}
                    onStartAccept={handleStartAccept}
                    onConfirmAccept={handleConfirmAccept}
                    onCancelConfirm={() => setConfirmingOfferId(null)}
                    onOpenDetail={(j) => openDetail(j, 'offers')}
                  />
                </motion.div>
              ))}
              {b2cOffers.map((booking, i) => (
                <motion.div
                  key={booking._id}
                  initial={reduce ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (demo.offers.length + i) * 0.04 }}
                >
                  <B2cBookingCard booking={booking} isLabour={true} />
                </motion.div>
              ))}
            </>
          ))}

        {tab === 'active' &&
          (demo.active.length === 0 && b2cActive.length === 0 ? (
            <AppEmptyState icon={MapPin} title={emptyCopy.title} subtitle={emptyCopy.subtitle} className="pt-2" />
          ) : (
            <>
              {demo.active.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <LabourJobActiveCard
                    job={job}
                    onMarkOnSite={handleMarkOnSite}
                    onOpenDetail={(j) => openDetail(j, 'active')}
                    onComplete={handleCompleteActive}
                  />
                </motion.div>
              ))}
              {b2cActive.map((booking, i) => (
                <motion.div
                  key={booking._id}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (demo.active.length + i) * 0.04 }}
                >
                  <B2cBookingCard booking={booking} isLabour={true} />
                </motion.div>
              ))}
            </>
          ))}

        {tab === 'history' &&
          (demo.history.length === 0 && b2cHistory.length === 0 ? (
            <AppEmptyState icon={CheckCircle2} title={emptyCopy.title} subtitle={emptyCopy.subtitle} className="pt-2" />
          ) : (
            <ul className="space-y-2 pt-1">
              {demo.history.map((job, i) => (
                <motion.div
                  key={`${job.id}-${job.completedAt}`}
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <LabourJobHistoryCard job={job} onOpenDetail={(j) => openDetail(j, 'history')} />
                </motion.div>
              ))}
              {b2cHistory.map((booking, i) => (
                <motion.div
                  key={booking._id}
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (demo.history.length + i) * 0.03 }}
                >
                  <B2cBookingCard booking={booking} isLabour={true} />
                </motion.div>
              ))}
            </ul>
          ))}
      </motion.div>

      <section className="grid grid-cols-1 gap-2 pt-1" aria-label="Quick links">
        <Link
          to="/serviceprovider/earnings"
          className="group flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/90 transition hover:border-brand/30 hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
            <IndianRupee className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <p className="text-xs font-extrabold text-slate-900">Earnings</p>
            <p className="text-[10px] text-slate-500">Withdraw</p>
          </span>
        </Link>
      </section>

      <LabourAssignmentDetailModal
        open={Boolean(detailJob)}
        onClose={() => setDetailJob(null)}
        job={detailJob}
        rawJob={detailJob}
        assignmentKind={detailKind === 'active' ? 'active' : 'offer'}
      />
    </div>
  )
}
