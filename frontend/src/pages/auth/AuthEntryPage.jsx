import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  HardHat,
  Home,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react'
import { MobileShell } from '../../layouts/MobileShell.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { LabourCategorySetup } from '../../components/auth/LabourCategorySetup.jsx'
import { ROLE_LABELS, USER_ROLES } from '../../constants/userRoles.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'
import { requestLoginOtp, requestRegisterOtp, verifyLogin, verifyRegister } from '../../api/authApi.js'
import { useAuth } from '../../hooks/useAuth.js'
import { useBranding } from '../../context/BrandingContext.jsx'
import { ApiError } from '../../api/http.js'

const ROLE_OPTIONS = [
  {
    role: USER_ROLES.CUSTOMER,
    icon: Home,
    desc: 'Hire verified experts for salon, home appliances & repairs',
  },
  {
    role: USER_ROLES.LABOUR,
    icon: HardHat,
    desc: 'Get matched to service requests and earn money',
  },
]

function isValidIndianMobile(digits) {
  return digits.length === 10 && /^[6-9]\d{9}$/.test(digits)
}

const OTP_BYPASS_HINT = import.meta.env.VITE_OTP_BYPASS_HINT === 'true'

function demoOtpFromPhone(digits) {
  if (!digits || digits.length < 6) return null
  return digits.slice(-6)
}

function FeedbackBanner({ variant, children }) {
  if (!children) return null
  const styles =
    variant === 'error'
      ? 'border-amber-200/90 bg-amber-50 text-amber-950 ring-amber-100'
      : 'border-blue-200/90 bg-blue-50 text-slate-950 ring-blue-100'
  return (
    <p role="alert" className={`rounded-2xl border px-4 py-3 text-sm font-medium leading-relaxed ring-1 ${styles}`}>
      {children}
    </p>
  )
}

function AuthField({ label, hint, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
        {hint}
      </div>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-full border border-slate-100 bg-slate-50 px-5 py-3 text-[15px] font-medium text-slate-900 outline-none transition focus:border-brand/30 focus:ring-2 focus:ring-brand/20 placeholder:text-slate-400'

export function AuthEntryPage({ authGroup = 'users' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { applySession } = useAuth()
  const { logoUrl } = useBranding()
  const reduce = useReducedMotion()
  const otpInputRefs = useRef([])

  const [mode, setMode] = useState('login')
  const [step, setStep] = useState('form')
  const allowedRoles = authGroup === 'labours' ? [USER_ROLES.LABOUR] : [USER_ROLES.CUSTOMER, USER_ROLES.CONTRACTOR]
  const [role, setRole] = useState(location.state?.defaultRole && allowedRoles.includes(location.state.defaultRole) ? location.state.defaultRole : allowedRoles[0])
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [gstNumber, setGstNumber] = useState('')
  const [otpCells, setOtpCells] = useState(() => Array(6).fill(''))
  const [challengeId, setChallengeId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)

  const p = isValidIndianMobile(phone) ? phone : null
  const code = otpCells.join('')
  const phoneComplete = phone.length === 10

  function clearOtpError() {
    setBanner((b) => (b?.variant === 'error' ? null : b))
  }

  function digitsToOtpCells(raw) {
    const d = String(raw ?? '').replace(/\D/g, '').slice(0, 6)
    const out = Array(6).fill('')
    for (let k = 0; k < d.length; k++) out[k] = d[k]
    return out
  }

  function handleOtpPaste(e) {
    e.preventDefault()
    const cells = digitsToOtpCells(e.clipboardData.getData('text/plain'))
    setOtpCells(cells)
    clearOtpError()
    const nextEmpty = cells.findIndex((c) => c === '')
    queueMicrotask(() => {
      otpInputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus()
    })
  }

  useEffect(() => {
    if (step !== 'otp') return
    queueMicrotask(() => {
      otpInputRefs.current[0]?.focus()
    })
  }, [step])

  function setPhoneDigits(value) {
    const digits = String(value).replace(/\D/g, '').slice(0, 10)
    setPhone(digits)
    if (banner?.variant === 'error') setBanner(null)
  }

  function resetFlowToForm() {
    setStep('form')
    setChallengeId(null)
    setBanner(null)
    setOtpCells(Array(6).fill(''))
  }

  function switchMode(next) {
    setMode(next)
    resetFlowToForm()
  }

  async function handleSendOtp() {
    setBanner(null)
    setChallengeId(null)
    if (!isValidIndianMobile(phone)) {
      setBanner({
        variant: 'error',
        message: 'Enter exactly 10 digits starting with 6, 7, 8, or 9.',
      })
      return
    }
    
    if (mode === 'register' && !termsAccepted) {
      setBanner({ variant: 'error', message: 'You must agree to the Terms of Service to register.' })
      return
    }

    setBusy(true)
    try {
      if (mode === 'login') {
        const res = await requestLoginOtp({ phone: p, authGroup })
        setChallengeId(res.data?.challengeId ?? null)
      } else {
        const res = await requestRegisterOtp({
          phone: p,
          role,
          fullName: fullName.trim() || undefined,
        })
        setChallengeId(res.data?.challengeId ?? null)
      }
      setOtpCells(Array(6).fill(''))
      setStep('otp')
      setBanner({
        variant: 'success',
        message: OTP_BYPASS_HINT && p
          ? `Demo OTP: enter the last 6 digits of ${p} (${demoOtpFromPhone(p)}).`
          : 'OTP sent. Check SMS — in development it may appear in the server terminal.',
      })
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'USER_NOT_FOUND' || e.statusCode === 404)) {
        setBanner({
          variant: 'error',
          message: 'No account found for this mobile number. Please tap "Register" above to create an account.',
        })
      } else {
        setBanner({
          variant: 'error',
          message: e instanceof ApiError ? e.message : 'Could not send OTP. Try again.',
        })
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyOtp() {
    setBanner(null)
    if (code.length !== 6) {
      setBanner({ variant: 'error', message: 'Enter all 6 digits of the OTP.' })
      return
    }
    if (!challengeId) {
      setBanner({ variant: 'error', message: 'Session expired. Go back and tap Send OTP again.' })
      return
    }
    if (!p) {
      setBanner({ variant: 'error', message: 'Phone number is invalid. Go back and fix it.' })
      return
    }
    setBusy(true)
    try {
      let signedInUser
      if (mode === 'login') {
        const res = await verifyLogin({ phone: p, code, challengeId })
        const { token, user } = res.data
        applySession(token, user)
        signedInUser = user
      } else {
        if (!fullName.trim()) {
          setBanner({ variant: 'error', message: 'Full name is required to complete registration.' })
          setBusy(false)
          return
        }
        const body = {
          phone: p,
          role,
          code,
          challengeId,
          fullName: fullName.trim(),
        }
        const res = await verifyRegister(body)
        const { token, user } = res.data
        applySession(token, user)
        signedInUser = user
      }

        let returnPath = location.state?.from || getRoleHomePath(signedInUser.role)
        if (mode === 'register' && (signedInUser.role === USER_ROLES.CUSTOMER || signedInUser.role === USER_ROLES.CONTRACTOR)) {
          returnPath = '/app/profile'
        }
        if (mode === 'register' && signedInUser.role === USER_ROLES.LABOUR) {
          returnPath = '/app/profile'
          navigate(returnPath, { replace: true })
          return
        }

        const needsWorkSetup =
          signedInUser.role === USER_ROLES.LABOUR && !(signedInUser.labourProfile?.categoryIds?.length > 0)
        if (needsWorkSetup) {
          setStep('work-setup')
          setBanner(null)
        } else {
          navigate(returnPath, { replace: true })
        }
    } catch (e) {
      setBanner({
        variant: 'error',
        message: e instanceof ApiError ? e.message : 'Verification failed. Check the code and try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  if (step === 'work-setup') {
    return (
      <>
        <MobileShell transparent className="pb-0 pt-4">
          <LabourCategorySetup variant="auth" onComplete={() => {
            const returnPath = location.state?.from || getRoleHomePath(USER_ROLES.LABOUR)
            navigate(returnPath, { replace: true })
          }} />
        </MobileShell>
      </>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white selection:bg-brand/20 overflow-hidden overscroll-none touch-none">
      {/* Top Header Section with Wave */}
      <div className="relative flex flex-col pt-10 pb-10 text-white bg-linear-to-b from-brand to-brand-bright overflow-hidden shrink-0">
        {/* Wave SVG */}
        <div className="absolute -bottom-1 left-0 right-0 w-full overflow-hidden leading-[0]">
          <svg viewBox="0 0 1440 320" className="relative block w-[120%] h-[50px] sm:h-[70px] left-[-10%]" preserveAspectRatio="none">
            <path fill="#ffffff" d="M0,160L48,138.7C96,117,192,75,288,69.3C384,64,480,96,576,128C672,160,768,192,864,186.7C960,181,1056,139,1152,122.7C1248,107,1344,117,1392,122.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>

        <div className="mt-2 flex flex-col items-center relative z-10">
          <div className="flex justify-center mb-0">
            <div className="rounded-3xl bg-white p-2 shadow-xl shadow-cyan-950/20 ring-4 ring-white/40">
              <img src="/logo.png" alt="A2Z Services Hub" className="h-28 sm:h-32 w-auto object-contain" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pt-2 pb-6 text-center shrink-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
          {step === 'otp' ? 'Verify OTP' : mode === 'login' ? 'Welcome back !' : 'Welcome !'}
        </h1>
        <p className="mt-1.5 text-sm font-medium text-slate-500">
          {step === 'otp' ? 'Secure verification' : mode === 'login' ? 'Sign in to continue' : 'Join A2Z today'}
        </p>
      </div>

      {/* Bottom Form Section */}
      <div className="flex-1 bg-white px-6 pb-4 overflow-y-auto overscroll-contain touch-pan-y">
        <div className="mx-auto max-w-lg h-full flex flex-col">


        {step === 'form' ? (
          <div className="mb-6 flex gap-1 rounded-full bg-slate-100 p-1 shrink-0">
            <button
              type="button"
              className={`flex-1 rounded-full py-3 text-[14px] font-bold transition ${mode === 'login' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              onClick={() => switchMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`flex-1 rounded-full py-3 text-[14px] font-bold transition ${mode === 'register'
                ? 'bg-white text-brand shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
                }`}
              onClick={() => switchMode('register')}
            >
              Register
            </button>
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {step === 'form' ? (
              <motion.div
              key="form"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? false : { opacity: 0, y: -8 }}
              className="flex flex-col"
            >
              {mode === 'register' ? (
                <div className="shrink-0 mb-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">I am a</p>
                  {authGroup === 'users' && (
                    <div className="space-y-3">
                      {ROLE_OPTIONS.filter(r => allowedRoles.includes(r.role)).map((r) => (
                        <label
                          key={r.role}
                          className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all ${
                            role === r.role
                              ? 'border-brand bg-brand/5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ring-1 ring-brand'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="pt-1">
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                role === r.role ? 'border-brand bg-brand' : 'border-slate-300'
                              }`}
                            >
                              {role === r.role && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>
                          </div>
                          <input
                            type="radio"
                            className="hidden"
                            name="role"
                            value={r.role}
                            checked={role === r.role}
                            onChange={() => setRole(r.role)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
                              <r.icon className="h-4 w-4 text-brand" />
                              {ROLE_LABELS[r.role]}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{r.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="space-y-4 shrink-0">
                <AuthField
                  label="Mobile number"
                  hint={
                    mode === 'register' ? (
                      <span className={`text-xs tabular-nums ${phoneComplete ? 'font-bold text-brand' : 'text-slate-400'}`}>
                        {phone.length}/10
                      </span>
                    ) : null
                  }
                >
                  <div
                    className={`flex overflow-hidden rounded-full border border-slate-100 bg-slate-50 transition focus-within:ring-2 ${banner?.variant === 'error' && phone.length > 0 && !phoneComplete
                      ? 'ring-amber-300'
                      : 'focus-within:ring-brand/20 focus-within:border-brand/30'
                      }`}
                  >
                    <span className="flex items-center border-r border-slate-200/60 bg-transparent px-5 text-[15px] font-bold text-slate-500">
                      +91
                    </span>
                    <input
                      id="auth-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      placeholder="9876543210"
                      className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-[15px] font-semibold tracking-wide text-slate-900 outline-none placeholder:text-slate-400"
                      value={phone}
                      onChange={(e) => setPhoneDigits(e.target.value)}
                      onKeyDown={(e) => {
                        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
                        if (allowed.includes(e.key)) return
                        if (e.ctrlKey || e.metaKey) return
                        if (!/^\d$/.test(e.key)) e.preventDefault()
                      }}
                    />
                  </div>
                </AuthField>

                {mode === 'register' ? (
                  <>
                    <AuthField label="Full name">
                      <input
                        type="text"
                        className={inputClass}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="As on your ID"
                        autoComplete="name"
                      />
                    </AuthField>
                  </>
                ) : null}
              </div>

              {mode === 'login' ? null : (
                <div className="mt-4 mb-2 flex items-center px-1">
                  <label className="flex items-start gap-2.5 text-[13px] font-medium text-slate-500 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand accent-brand" 
                      checked={termsAccepted}
                      onChange={(e) => {
                        setTermsAccepted(e.target.checked)
                        if (e.target.checked && banner?.variant === 'error') setBanner(null)
                      }}
                    />
                    <span>
                      I agree to the <a href="#" onClick={(e) => e.preventDefault()} className="font-bold text-brand hover:underline">Terms of Service</a> and <a href="#" onClick={(e) => e.preventDefault()} className="font-bold text-brand hover:underline">Privacy Policy</a>
                    </span>
                  </label>
                </div>
              )}

              <div className="mt-6 pt-2 pb-6">
                <FeedbackBanner variant={banner?.variant}>{banner?.message}</FeedbackBanner>
                <AppPrimaryButton type="button" disabled={busy} className="w-full !rounded-full py-3.5 text-[14px] font-bold shadow-lg shadow-brand/20 mt-3" onClick={() => void handleSendOtp()}>
                  {busy ? 'Please wait…' : 'Send OTP'}
                  <Phone className="h-4 w-4" aria-hidden />
                </AppPrimaryButton>
  
                {mode === 'login' ? (
                  <p className="mt-4 text-center text-[12px] font-medium text-slate-500">
                    New user? <button type="button" onClick={() => switchMode('register')} className="font-bold text-brand hover:underline">Sign Up</button>
                  </p>
                ) : (
                  <p className="mt-4 text-center text-[12px] font-medium text-slate-500">
                    Already have an account? <button type="button" onClick={() => switchMode('login')} className="font-bold text-brand hover:underline">Login</button>
                  </p>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? false : { opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <GlassPanel className="border-slate-200/90 p-4 ring-1 ring-slate-100/90">
                <p className="text-sm text-slate-600">
                  Code sent to{' '}
                  <span className="font-bold tabular-nums text-slate-900">+91 {phone}</span>
                </p>
                {OTP_BYPASS_HINT && p ? (
                  <p className="mt-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-xs font-semibold text-brand">
                    Demo: OTP is the last 6 digits of your number ({demoOtpFromPhone(p)}).
                  </p>
                ) : null}
                <p className="mt-4 mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Enter OTP</p>
                <div className="flex gap-2" onPaste={handleOtpPaste}>
                  {otpCells.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpInputRefs.current[i] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      aria-label={`OTP digit ${i + 1} of 6`}
                      className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50 py-4 text-center font-mono text-xl font-bold tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand/30"
                      value={digit}
                      onPaste={handleOtpPaste}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, '').slice(-1)
                        const next = [...otpCells]
                        if (d) {
                          next[i] = d
                          setOtpCells(next)
                          clearOtpError()
                          if (i < 5) otpInputRefs.current[i + 1]?.focus()
                        } else {
                          next[i] = ''
                          setOtpCells(next)
                          clearOtpError()
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (!busy) void handleVerifyOtp()
                          return
                        }
                        if (e.key === 'Backspace') {
                          e.preventDefault()
                          if (otpCells[i]) {
                            const next = [...otpCells]
                            next[i] = ''
                            setOtpCells(next)
                            clearOtpError()
                          } else if (i > 0) {
                            const next = [...otpCells]
                            next[i - 1] = ''
                            setOtpCells(next)
                            clearOtpError()
                            otpInputRefs.current[i - 1]?.focus()
                          }
                          return
                        }
                        if (e.key === 'ArrowLeft' && i > 0) {
                          e.preventDefault()
                          otpInputRefs.current[i - 1]?.focus()
                          return
                        }
                        if (e.key === 'ArrowRight' && i < 5) {
                          e.preventDefault()
                          otpInputRefs.current[i + 1]?.focus()
                          return
                        }
                        if (e.ctrlKey || e.metaKey) return
                        if (!/^\d$/.test(e.key) && e.key.length === 1) e.preventDefault()
                      }}
                    />
                  ))}
                </div>
              </GlassPanel>

              <FeedbackBanner variant={banner?.variant}>{banner?.message}</FeedbackBanner>
              <AppPrimaryButton
                type="button"
                disabled={busy}
                className="w-full !rounded-full py-4 text-[15px] font-bold shadow-lg shadow-brand/20 mt-4"
                onClick={() => void handleVerifyOtp()}
              >
                {busy ? 'Verifying…' : mode === 'login' ? 'Verify & login' : 'Verify & continue'}
                <User className="h-4 w-4" aria-hidden />
              </AppPrimaryButton>
              <button
                type="button"
                className="w-full py-3 text-[13px] font-bold text-slate-500 hover:text-slate-800 transition mt-2"
                onClick={resetFlowToForm}
              >
                Edit mobile number
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        </div>
      </div>
    </div>
  )
}
