import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  HardHat,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  Wrench,
  Home,
} from 'lucide-react'
import { submitLabourKycDocuments } from '../../api/userKycApi.js'
import { ApiError } from '../../api/http.js'
import { KYC_STATUS, USER_ROLES } from '../../constants/userRoles.js'
import { useAuth } from '../../hooks/useAuth.js'
import { setUser } from '../../store/slices/authSlice.js'
import { assetUrlFromUpload, uploadMedia } from '../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import {
  getKycUiState,
  hasKycDetailsOnFile,
  KYC_BENEFITS,
  KYC_WORKFLOW,
  KYC_WORKFLOW_RESUBMIT,
  kycWorkflowStepIndex,
} from '../../lib/labourKycFlow.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { LabourKycHero } from '../../components/labour/kyc/LabourKycHero.jsx'
import { LabourKycWorkflowTimeline } from '../../components/labour/kyc/LabourKycWorkflowTimeline.jsx'
import { LabourKycVideoRecorder } from '../../components/labour/kyc/LabourKycVideoRecorder.jsx'

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '').slice(0, 12)
}

function normalizePan(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
}

const BENEFIT_ICONS = [HardHat, ShieldCheck, IndianRupee]
const KYC_DRAFT_KEY = 'lc-labour-kyc-draft'

async function videoFileForSubmit(videoFile, videoPreviewUrl) {
  if (videoFile) return videoFile
  if (!videoPreviewUrl) return null
  const res = await fetch(videoPreviewUrl)
  const blob = await res.blob()
  const rawType = blob.type || 'video/webm'
  const type = rawType.split(';')[0]
  const ext = type.includes('mp4') ? 'mp4' : 'webm'
  return new File([blob], `kyc-video-${Date.now()}.${ext}`, { type })
}

export function AppKycPage() {
  const reduce = useReducedMotion()
  const dispatch = useDispatch()
  const { user } = useAuth()

  const [aadhaar, setAadhaar] = useState('')
  const [pan, setPan] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)

  const isContractor = user?.role === USER_ROLES.CONTRACTOR
  const profile = isContractor ? user?.contractorProfile : user?.labourProfile
  const kyc = profile?.kycStatus || KYC_STATUS.PENDING
  const submittedAt = profile?.kycSubmittedAt
  const reviewNote = profile?.kycReviewNote
  const ui = getKycUiState(profile)
  const isResubmit = ui.phase === 'failed' && hasKycDetailsOnFile(profile)

  const aadhaarDigits = digitsOnly(aadhaar).length
  const normalizedPan = normalizePan(pan)
  const panValid = /^[A-Z]{5}\d{4}[A-Z]$/.test(normalizedPan)
  const hasRecordedVideo = Boolean(videoFile || videoPreviewUrl)
  const detailsReady = isResubmit || (aadhaarDigits === 12 && panValid)
  const canSubmit = detailsReady && hasRecordedVideo && !busy
  const workflowStep = kycWorkflowStepIndex({
    kycStatus: kyc,
    submittedAt,
    aadhaarDigits,
    panValid,
    detailsOnFile: isResubmit,
  })

  const phaseLabels = {
    verified: 'Verified',
    review: 'In review',
    failed: 'Action needed',
    submit: 'Not submitted',
  }

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    }
  }, [videoPreviewUrl])

  useEffect(() => {
    if (isResubmit || ui.phase === 'verified') return
    try {
      const raw = sessionStorage.getItem(KYC_DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (!aadhaar && draft.aadhaar) setAadhaar(digitsOnly(draft.aadhaar))
      if (!pan && draft.pan) setPan(normalizePan(draft.pan))
    } catch {
      /* ignore corrupt draft */
    }
  }, [isResubmit, ui.phase])

  useEffect(() => {
    if (isResubmit || ui.phase === 'verified') return
    sessionStorage.setItem(KYC_DRAFT_KEY, JSON.stringify({ aadhaar, pan }))
  }, [aadhaar, pan, isResubmit, ui.phase])

  const clearVideo = () => {
    setVideoFile(null)
    setVideoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
  }

  const handleRecorded = (file, previewUrl) => {
    setBanner(null)
    setVideoFile(file)
    setVideoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return previewUrl
    })
  }

  const handleSubmit = async () => {
    setBanner(null)
    const d = digitsOnly(aadhaar)
    if (!isResubmit) {
      if (d.length !== 12) {
        setBanner({ variant: 'error', message: 'Enter all 12 Aadhaar digits.' })
        return
      }
      if (!panValid) {
        setBanner({ variant: 'error', message: 'Enter a valid PAN number.' })
        return
      }
    } else if ((d.length > 0 && d.length !== 12) || (normalizedPan.length > 0 && !panValid)) {
      setBanner({ variant: 'error', message: 'Update Aadhaar and PAN only if you want to change them.' })
      return
    }
    if (!hasRecordedVideo) {
      setBanner({ variant: 'error', message: 'Record your KYC video before submitting.' })
      return
    }
    setBusy(true)
    try {
      const fileToUpload = await videoFileForSubmit(videoFile, videoPreviewUrl)
      if (!fileToUpload) {
        setBanner({ variant: 'error', message: 'Record your KYC video before submitting.' })
        return
      }
      const uploaded = await uploadMedia(fileToUpload, UPLOAD_FOLDERS.KYC_VIDEOS)
      const videoUrl = assetUrlFromUpload(uploaded)
      if (!videoUrl) {
        setBanner({ variant: 'error', message: 'Video upload failed — no URL returned.' })
        return
      }
      const payload = {
        videoUrl,
        videoMeta: uploaded.data?.asset,
      }
      if (!isResubmit || d.length === 12) payload.aadhaar = d
      if (!isResubmit || panValid) payload.pan = normalizedPan
      const res = await submitLabourKycDocuments(payload)
      if (res.data?.user) dispatch(setUser(res.data.user))
      setBanner({ variant: 'success', message: res.message || 'Submitted for admin review.' })
      sessionStorage.removeItem(KYC_DRAFT_KEY)
      clearVideo()
      if (!isResubmit) {
        setAadhaar('')
        setPan('')
      }
    } catch (e) {
      setBanner({
        variant: 'error',
        message: e instanceof ApiError ? e.message : 'KYC submission failed. Try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  const showForm = ui.phase === 'submit' || ui.phase === 'failed'
  const compactForm = false

  return (
    <div className="space-y-4 pb-8">
      <AnimatePresence>
        {banner ? (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className={`fixed left-6 right-6 top-[max(4.5rem,env(safe-area-inset-top))] z-120 mx-auto max-w-[27rem] rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white shadow-xl ${
              banner.variant === 'success' ? 'bg-blue-900/95 border border-blue-300/40' : 'bg-rose-900/95 border border-rose-300/40'
            }`}
            role="status"
          >
            {banner.message}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <LabourKycHero
        title={ui.title}
        subtitle={ui.subtitle}
        phaseLabel={phaseLabels[ui.phase]}
        tone={ui.tone}
        maskedAadhaar={
          ui.phase === 'verified' || ui.phase === 'review' || ui.phase === 'failed' ? profile?.aadhaarMasked : null
        }
        maskedPan={ui.phase === 'verified' || ui.phase === 'review' || ui.phase === 'failed' ? profile?.panMasked : null}
      />

      {ui.phase === 'verified' ? (
        <GlassPanel className="border-blue-200/80 bg-blue-50/50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-blue-600" aria-hidden />
          <p className="mt-3 text-sm text-slate-600">
            {isContractor ? 'You are cleared to hire verified workforce.' : 'You are cleared to accept jobs and check in on site.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {isContractor ? (
              <AppPrimaryButton as={Link} to="/user" className="py-2.5 text-xs">
                <Home className="h-3.5 w-3.5" aria-hidden />
                Home
              </AppPrimaryButton>
            ) : (
              <AppPrimaryButton as={Link} to="/serviceprovider/jobs" className="py-2.5 text-xs">
                <Briefcase className="h-3.5 w-3.5" aria-hidden />
                My jobs
              </AppPrimaryButton>
            )}
            <Link
              to={isContractor ? "/user/profile" : "/serviceprovider/profile"}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800"
            >
              Profile
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </GlassPanel>
      ) : null}

      {ui.phase === 'review' && !banner ? (
        <GlassPanel className="border-sky-200/80 bg-sky-50/50 p-4">
          <div className="flex gap-3">
            <Clock className="h-10 w-10 shrink-0 text-sky-600" aria-hidden />
            <div>
              <p className="text-sm font-extrabold text-sky-950">Submitted for review</p>
              <p className="mt-1 text-xs leading-relaxed text-sky-900/90">
                {submittedAt
                  ? new Date(submittedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—'}
                . Usually reviewed within 1–2 business days (demo).
              </p>
            </div>
          </div>
        </GlassPanel>
      ) : null}

      {ui.phase === 'failed' && reviewNote ? (
        <GlassPanel className="border-rose-200/80 bg-rose-50/50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-800">Admin note</p>
          <p className="mt-1 text-sm leading-relaxed text-rose-950">{reviewNote}</p>
        </GlassPanel>
      ) : null}

      {ui.phase !== 'review' ? (
        <>
          <GlassPanel className="border-slate-200/90 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verification journey</p>
            <div className="mt-3">
              <LabourKycWorkflowTimeline
                activeIndex={workflowStep}
                tone={ui.tone}
                steps={isResubmit ? KYC_WORKFLOW_RESUBMIT : KYC_WORKFLOW}
              />
            </div>
          </GlassPanel>

          <GlassPanel className="border-violet-200/50 bg-linear-to-br from-violet-50/80 to-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800/80">Why verify?</p>
            <ul className="mt-3 space-y-2.5">
              {KYC_BENEFITS.map((b, i) => {
                const Icon = BENEFIT_ICONS[i] || ShieldCheck
                return (
                  <li key={b.title} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{b.title}</p>
                      <p className="text-xs text-slate-600">{b.desc}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </GlassPanel>
        </>
      ) : null}

      {showForm ? (
        <GlassPanel className="border-slate-200/90 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {compactForm ? 'Replace submission' : 'Submit video KYC'}
          </p>
          {compactForm ? (
            <p className="mt-1 text-xs text-slate-600">Record a clearer video before admin decides.</p>
          ) : isResubmit ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Your previous Aadhaar and PAN are already saved. Record a new video showing both documents clearly, then submit again.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Please carry your Aadhaar card photo and PAN card photo. Record one live video showing the front and back of both documents.
            </p>
          )}

          {isResubmit ? (
            <div className="mt-4 rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Saved details</p>
              <p className="mt-1 font-mono text-sm text-slate-800">Aadhaar {profile.aadhaarMasked}</p>
              <p className="font-mono text-sm text-slate-800">PAN {profile.panMasked}</p>
              <p className="mt-2 text-[11px] text-slate-500">Only a new video is required for resubmission.</p>
            </div>
          ) : null}

          {!isResubmit ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500" htmlFor="aadhaar">
                Aadhaar number
              </label>
              <input
                id="aadhaar"
                inputMode="numeric"
                autoComplete="off"
                placeholder="XXXX XXXX XXXX"
                value={aadhaar}
                onChange={(e) => setAadhaar(digitsOnly(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-lg font-semibold tracking-[0.2em] text-slate-900 outline-none focus:ring-2 focus:ring-violet-400/40"
              />
              <p className="mt-1 text-right text-xs font-bold text-slate-400">{aadhaarDigits}/12</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500" htmlFor="pan">
                PAN number
              </label>
              <input
                id="pan"
                autoComplete="off"
                placeholder="ABCDE1234F"
                value={pan}
                onChange={(e) => setPan(normalizePan(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-lg font-semibold uppercase tracking-[0.18em] text-slate-900 outline-none focus:ring-2 focus:ring-violet-400/40"
              />
              <p className={`mt-1 text-right text-xs font-bold ${pan && !panValid ? 'text-rose-500' : 'text-slate-400'}`}>
                {normalizedPan.length}/10
              </p>
            </div>
          </div>
          ) : null}

          <div className="mt-4">
            <LabourKycVideoRecorder
              previewUrl={videoPreviewUrl}
              onRecorded={handleRecorded}
              onClear={clearVideo}
              disabled={busy}
            />
          </div>

          <AppPrimaryButton
            type="button"
            className="mt-5 w-full py-3.5 text-sm"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {compactForm || isResubmit ? (
              <>
                <RefreshCw className="h-4 w-4" aria-hidden />
                Submit again
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Submit for admin review
              </>
            )}
          </AppPrimaryButton>
        </GlassPanel>
      ) : null}

      <div className={isContractor ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
        {!isContractor && (
          <Link
            to="/serviceprovider/work-categories"
            className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100 transition hover:border-brand/30"
          >
            <Wrench className="h-5 w-5 text-brand" aria-hidden />
            <span className="text-xs font-bold text-slate-900">Update skills</span>
          </Link>
        )}
        <Link
          to={isContractor ? "/user/profile" : "/serviceprovider/profile"}
          className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100 transition hover:border-brand/30"
        >
          <ArrowRight className="h-5 w-5 text-slate-400" aria-hidden />
          <span className="text-xs font-bold text-slate-900">Profile</span>
        </Link>
      </div>
    </div>
  )
}
