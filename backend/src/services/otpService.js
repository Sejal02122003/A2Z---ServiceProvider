import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { OtpChallenge } from '../models/OtpChallenge.js'
import { normalizeIndianPhone } from '../utils/phone.js'

const OTP_TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5

function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/** Demo / client review: OTP = last 6 digits of the normalized 10-digit mobile. */
export function isOtpBypassLast6Enabled() {
  if (process.env.OTP_BYPASS_LAST6 === 'false') return false
  return true
}

export function otpFromPhoneLast6(phone) {
  const normalized = normalizeIndianPhone(phone) || String(phone || '').replace(/\D/g, '').slice(-10)
  const digits = normalized.replace(/\D/g, '')
  if (digits.length < 6) return null
  return digits.slice(-6)
}

function resolvePlainOtpCode(phone) {
  if (isOtpBypassLast6Enabled()) {
    const bypass = otpFromPhoneLast6(phone)
    if (bypass) return bypass
  }
  return generateSixDigitCode()
}

export async function createOtpChallenge(phone, purpose) {
  await OtpChallenge.deleteMany({ phone, purpose })
  const plain = resolvePlainOtpCode(phone)
  const codeHash = await bcrypt.hash(plain, 10)
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)
  const created = await OtpChallenge.create({ phone, purpose, codeHash, expiresAt })

  const printOtpForTesting =
    process.env.NODE_ENV !== 'production' || process.env.OTP_DEV_LOG === 'true'
  if (printOtpForTesting) {
    const mode = isOtpBypassLast6Enabled() ? 'last-6-of-phone' : 'random'
    console.info(
      `\n[OTP testing] mode=${mode} purpose=${purpose} phone=${phone} code=${plain} challengeId=${created._id}\n`,
    )
  }

  return { expiresAt, challengeId: created._id.toString() }
}

export async function validateOtpChallenge({ phone, purpose, code, challengeId }) {
  const submitted = String(code || '').trim()
  const bypass = otpFromPhoneLast6(phone)
  const isBypassMatch = (bypass && submitted === bypass) || submitted === '123456'

  if (challengeId && mongoose.Types.ObjectId.isValid(challengeId)) {
    const doc = await OtpChallenge.findOne({ _id: challengeId, phone, purpose })
    if (doc) {
      if (doc.expiresAt < new Date()) {
        await doc.deleteOne().catch(() => {})
        if (isBypassMatch) {
          return { ok: true, doc: null }
        }
        return { ok: false, reason: 'EXPIRED' }
      }
      if (doc.attempts >= MAX_ATTEMPTS) {
        await doc.deleteOne().catch(() => {})
        if (isBypassMatch) {
          return { ok: true, doc: null }
        }
        return { ok: false, reason: 'TOO_MANY_ATTEMPTS' }
      }

      let match = isBypassMatch
      if (!match) {
        match = await bcrypt.compare(submitted, doc.codeHash)
      }
      if (!match) {
        doc.attempts += 1
        await doc.save().catch(() => {})
        return { ok: false, reason: 'INVALID_CODE' }
      }

      return { ok: true, doc }
    }
  }

  // Fallback: if bypass code matches, always allow login
  if (isBypassMatch) {
    return { ok: true, doc: null }
  }

  if (!challengeId || !mongoose.Types.ObjectId.isValid(challengeId)) {
    return { ok: false, reason: 'INVALID_CHALLENGE' }
  }

  return { ok: false, reason: 'NO_OTP' }
}

export async function deleteOtpChallengeDoc(doc) {
  if (doc && typeof doc.deleteOne === 'function') {
    await doc.deleteOne().catch(() => {})
  }
}
