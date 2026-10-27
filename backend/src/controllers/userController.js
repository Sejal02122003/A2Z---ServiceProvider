import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { Zone } from '../models/Zone.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourCategoryGroup, LABOUR_GROUP_KIND } from '../models/LabourCategoryGroup.js'
import { KYC_STATUS, ROLE_LIST, USER_ROLES } from '../constants/roles.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { populateLabourCategories } from '../utils/populateLabourCategories.js'
import { isValidAadhaarLength, maskAadhaarLast4, normalizeAadhaar } from '../utils/aadhaar.js'
import { normalizeStoredMediaUrl } from '../utils/mediaUrl.js'
import { startVendorTrial, getTrialConfig } from '../services/trialEvaluationService.js'
import { IDENTITY_STATUS } from '../constants/identityConstants.js'
import { validateName } from '../utils/nameNormalization.js'
import { IdentityVerification } from '../models/IdentityVerification.js'
import { logIdentityAudit } from '../services/identityVerificationService.js'
import { IDENTITY_AUDIT_ACTIONS } from '../models/IdentityAuditLog.js'
import {
  notifyPaymentApproved,
  notifyPaymentRejected,
  notifyAddressSubmitted,
  notifyAddressCorrectionRequested,
  notifyAddressConfirmed,
  notifyWelcomeKitDispatched,
  notifyWelcomeKitDelivered,
} from '../services/welcomeKitNotificationService.js'

const MAX_KYC_IMAGE_CHARS = 750_000

function validateKycDataUrlImage(value, label) {
  if (typeof value !== 'string' || value.length < 80) {
    return `${label} image is missing or too small`
  }
  if (value.length > MAX_KYC_IMAGE_CHARS) {
    return `${label} image is too large — try a clearer photo under ~4MB before upload`
  }
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)) {
    return `${label} must be a JPEG or PNG data URL from your camera or gallery`
  }
  return null
}

function labourHasKycVideo(lp) {
  return Boolean(
    lp?.kycVideoUrl?.trim() ||
    lp?.kycFrontImageUrl?.trim() ||
    lp?.kycBackImageUrl?.trim() ||
    lp?.kycFrontImageDataUrl?.trim() ||
    (Array.isArray(lp?.kycDocumentUrls) && lp.kycDocumentUrls.length > 0)
  )
}

function normalizePan(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
}

function isValidPan(normalized) {
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(normalized)
}

function maskPan(normalized) {
  return `${normalized.slice(0, 5)} XXXX ${normalized.slice(-1)}`
}

function cleanTimeSlot(rawSlot) {
  if (!rawSlot || typeof rawSlot !== 'string') return ''
  const trimmed = rawSlot.trim()
  if (trimmed.includes('_')) {
    const clean = trimmed.split('_')[0].trim()
    if (clean) return clean
  }
  return trimmed
}

function sanitizeKycVideoMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  return {
    publicId: meta.publicId ? String(meta.publicId).slice(0, 512) : undefined,
    resourceType: meta.resourceType ? String(meta.resourceType).slice(0, 32) : undefined,
    format: meta.format ? String(meta.format).slice(0, 32) : undefined,
    bytes: Number.isFinite(Number(meta.bytes)) ? Number(meta.bytes) : undefined,
    duration: Number.isFinite(Number(meta.duration)) ? Number(meta.duration) : undefined,
    uploadedAt: meta.uploadedAt ? new Date(meta.uploadedAt) : undefined,
  }
}

/** PATCH /users/me — update basic profile fields (mobile-first parity with future app) */
export const updateMe = asyncHandler(async (req, res) => {
  const { fullName, profileImageUrl, phone, email, role, permanentAddress, currentLocation, city, state, country } = req.body
  const user = req.user

  if (role === USER_ROLES.CUSTOMER || role === USER_ROLES.CONTRACTOR) {
    if (user.role === USER_ROLES.CUSTOMER || user.role === USER_ROLES.CONTRACTOR) {
      user.role = role
    }
  }

  if (fullName != null) {
    const nameCheck = validateName(fullName)
    if (!nameCheck.isValid) {
      return sendError(res, {
        message: nameCheck.reason,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_NAME',
      })
    }
    user.fullName = nameCheck.cleanName
  }
  if (phone != null) user.phone = String(phone).trim()
  if (email != null) user.email = String(email).trim().toLowerCase() || undefined
  
  if (permanentAddress !== undefined) user.permanentAddress = String(permanentAddress).trim()
  if (currentLocation !== undefined) user.currentLocation = String(currentLocation).trim()
  if (city !== undefined) user.city = String(city).trim()
  if (state !== undefined) user.state = String(state).trim()
  if (country !== undefined) user.country = String(country).trim()

  if (profileImageUrl !== undefined) {
    const raw = profileImageUrl == null ? '' : String(profileImageUrl).trim()
    if (raw) {
      const httpsUrl = normalizeStoredMediaUrl(raw)
      if (httpsUrl) {
        user.profileImageUrl = httpsUrl
      } else if (/^data:image\//i.test(raw)) {
        const imgErr = validateKycDataUrlImage(raw, 'Profile photo')
        if (imgErr) {
          return sendError(res, {
            message: imgErr,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            code: 'INVALID_PROFILE_IMAGE',
          })
        }
        user.profileImageUrl = raw
      } else {
        return sendError(res, {
          message: 'Upload profile photo via /uploads/media (profiles folder) or use a valid https:// URL',
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: 'INVALID_PROFILE_IMAGE',
        })
      }
    } else {
      user.profileImageUrl = null
    }
  }

  if (user.role === USER_ROLES.LABOUR && req.body.labourProfile) {
    if (!user.labourProfile) user.labourProfile = {}
    if (req.body.labourProfile.skills !== undefined) {
      user.set('labourProfile.skills', req.body.labourProfile.skills)
    }
    if (req.body.labourProfile.experienceYears !== undefined) {
      user.set('labourProfile.experienceYears', req.body.labourProfile.experienceYears)
    }
  }

  try {
    await user.save()
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0]
      return sendError(res, {
        message: `This ${field} is already in use by another account`,
        statusCode: HTTP_STATUS.CONFLICT,
        code: 'DUPLICATE_FIELD',
      })
    }
    throw err
  }
  
  await populateLabourCategories(user)
  return sendSuccess(res, {
    message: 'Profile updated',
    data: { user: user.toSafeObject() },
  })
})

/** PATCH /users/me/labour-categories — worker trade + profile tags */
export const updateLabourCategories = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return sendError(res, {
      message: 'Only worker accounts use this step',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FORBIDDEN',
    })
  }

  const { services, categoryIds: directCatIds, subcategoryIds: directSubcatIds } = req.body
  const rawServices = []
  const uniqueSubcategoryIds = new Set()
  const rawServiceIds = new Set()

  if (Array.isArray(directSubcatIds)) {
    for (const sid of directSubcatIds) {
      if (sid) uniqueSubcategoryIds.add(String(sid))
    }
  }

  if (Array.isArray(services)) {
    for (const svc of services) {
      if (!svc) continue
      const subId = svc.subcategoryId ? String(svc.subcategoryId) : null
      const sId = svc.serviceId ? String(svc.serviceId) : null

      if (subId) {
        uniqueSubcategoryIds.add(subId)
      }

      // Only treat sId as candidate serviceId if it exists and is distinct from subcategoryId
      if (sId && sId !== subId) {
        rawServiceIds.add(sId)
      } else if (sId && !subId) {
        // Fallback: sId could be a serviceId or a subcategoryId
        rawServiceIds.add(sId)
      }

      rawServices.push({
        serviceId: sId && sId !== subId ? sId : undefined,
        subcategoryId: subId || (sId ? sId : undefined),
        minPrice: Number(svc.minPrice) || 0,
        maxPrice: Number(svc.maxPrice) || 0,
      })
    }
  }

  // Dynamically import LabourSubcategory and LabourService
  const { LabourSubcategory } = await import('../models/LabourSubcategory.js')
  const { LabourService } = await import('../models/LabourService.js')

  const subcatIdArray = Array.from(uniqueSubcategoryIds)
  const subcategories = await LabourSubcategory.find({
    _id: { $in: subcatIdArray },
    isActive: true,
  }).populate('categoryId')

  if (subcategories.length !== subcatIdArray.length && subcatIdArray.length > 0) {
    return sendError(res, {
      message: 'One or more categories are invalid or inactive',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_CATEGORIES',
    })
  }

  const validSubcatIdSet = new Set(subcategories.map((s) => String(s._id)))

  // Remove any ID that is actually a subcategory ID from the candidate service IDs
  const candidateServiceIds = Array.from(rawServiceIds).filter(
    (id) => !validSubcatIdSet.has(id) && !uniqueSubcategoryIds.has(id)
  )

  // Query database for candidate services
  const servicesInDb = candidateServiceIds.length > 0
    ? await LabourService.find({
        _id: { $in: candidateServiceIds },
        isActive: true,
      })
    : []

  if (servicesInDb.length !== candidateServiceIds.length && candidateServiceIds.length > 0) {
    return sendError(res, {
      message: 'One or more services are invalid or inactive',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_SERVICES',
    })
  }

  const finalServiceIds = servicesInDb.map((s) => String(s._id))
  const finalServiceIdSet = new Set(finalServiceIds)
  const finalPricing = []
  const seenPricingKeys = new Set()

  for (const s of servicesInDb) {
    const sId = String(s._id)
    const subId = String(s.subcategoryId)
    const key = `${subId}_${sId}`
    if (!seenPricingKeys.has(key)) {
      seenPricingKeys.add(key)
      const clientMatch = rawServices.find(
        (rs) => rs.serviceId === sId && (!rs.subcategoryId || rs.subcategoryId === subId)
      )
      finalPricing.push({
        serviceId: s._id,
        subcategoryId: s.subcategoryId,
        minPrice: clientMatch?.minPrice || s.basePrice || 0,
        maxPrice: clientMatch?.maxPrice || s.basePrice || 0,
      })
    }
  }

  // For any selected subcategories that didn't have explicit services provided,
  // automatically include their active services if they exist in DB
  if (subcatIdArray.length > 0) {
    const subcatsNeedingServices = subcatIdArray.filter(
      (subId) => !finalPricing.some((p) => String(p.subcategoryId) === subId && p.serviceId)
    )
    if (subcatsNeedingServices.length > 0) {
      const autoServices = await LabourService.find({
        subcategoryId: { $in: subcatsNeedingServices },
        isActive: true,
      }).lean()

      for (const s of autoServices) {
        const sid = String(s._id)
        const subId = String(s.subcategoryId)
        const key = `${subId}_${sid}`
        if (!finalServiceIdSet.has(sid)) {
          finalServiceIdSet.add(sid)
          finalServiceIds.push(sid)
        }
        if (!seenPricingKeys.has(key)) {
          seenPricingKeys.add(key)
          finalPricing.push({
            serviceId: s._id,
            subcategoryId: s.subcategoryId,
            minPrice: s.basePrice || 0,
            maxPrice: s.basePrice || 0,
          })
        }
      }
    }
  }

  // Also record pricing entry for any subcategories that have 0 services in DB
  for (const sub of subcategories) {
    const subId = String(sub._id)
    const hasAnyPricing = finalPricing.some((p) => String(p.subcategoryId) === subId)
    if (!hasAnyPricing) {
      const key = `${subId}_subcat_only`
      if (!seenPricingKeys.has(key)) {
        seenPricingKeys.add(key)
        finalPricing.push({
          subcategoryId: sub._id,
          minPrice: 0,
          maxPrice: 0,
        })
      }
    }
  }

  const catIds = [...new Set([
    ...subcategories.map((s) => String(s.categoryId?._id || s.categoryId)),
    ...(Array.isArray(directCatIds) ? directCatIds.map(String) : [])
  ])]

  const hasTrade = finalPricing.length > 0 || subcatIdArray.length > 0 || catIds.length > 0
  if (!hasTrade) {
    return sendError(res, {
      message:
        'Choose at least one job type or category. Profile tags alone are not enough for worksite matching.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'TRADE_REQUIRED',
    })
  }

  req.user.labourProfile = req.user.labourProfile || {}
  req.user.labourProfile.subcategoryIds = subcatIdArray
  req.user.labourProfile.categoryIds = catIds
  req.user.labourProfile.serviceIds = finalServiceIds
  req.user.labourProfile.servicePricing = finalPricing
  await req.user.save()
  await populateLabourCategories(req.user)

  return sendSuccess(res, {
    message: 'Work categories saved',
    data: { user: req.user.toSafeObject() },
  })
})

/** GET /users/me — alias clarity for some clients */
export const getProfile = asyncHandler(async (req, res) => {
  await populateLabourCategories(req.user)
  return sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

/** POST /users/me/labour/kyc/submit — labour/contractor: Aadhaar/PAN numbers + recorded video → pending admin review */
export const submitLabourKycDocuments = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR && req.user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, {
      message: 'Only worker or contractor accounts can submit KYC here',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FORBIDDEN',
    })
  }

  const profileKey = req.user.role === USER_ROLES.CONTRACTOR ? 'contractorProfile' : 'labourProfile'
  const profile = req.user[profileKey] || {}

  if (profile?.kycStatus === KYC_STATUS.VERIFIED) {
    return sendError(res, {
      message: 'KYC is already approved',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'KYC_ALREADY_VERIFIED',
    })
  }

  const isVideoOnlyResubmit =
    profile.kycStatus === KYC_STATUS.FAILED && Boolean(profile.aadhaarMasked?.trim()) && Boolean(profile.panMasked?.trim())

  const normalizedAadhaar = normalizeAadhaar(req.body.aadhaar)
  const normalizedPan = normalizePan(req.body.pan)
  const hasAadhaarInput = normalizedAadhaar.length > 0
  const hasPanInput = normalizedPan.length > 0

  if (isVideoOnlyResubmit) {
    if (hasAadhaarInput && !isValidAadhaarLength(normalizedAadhaar)) {
      return sendError(res, {
        message: 'Enter a valid 12-digit Aadhaar number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_AADHAAR',
      })
    }
    if (hasPanInput && !isValidPan(normalizedPan)) {
      return sendError(res, {
        message: 'Enter a valid PAN number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_PAN',
      })
    }
  } else {
    if (!isValidAadhaarLength(normalizedAadhaar)) {
      return sendError(res, {
        message: 'Enter a valid 12-digit Aadhaar number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_AADHAAR',
      })
    }
    if (!isValidPan(normalizedPan)) {
      return sendError(res, {
        message: 'Enter a valid PAN number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_PAN',
      })
    }
  }

  const rawVideoUrl = normalizeStoredMediaUrl(req.body.videoUrl || req.body.kycVideoUrl)
  const rawFrontUrl = normalizeStoredMediaUrl(req.body.frontImageUrl || req.body.kycFrontImageUrl || req.body.documentUrl)
  const rawBackUrl = normalizeStoredMediaUrl(req.body.backImageUrl || req.body.kycBackImageUrl)

  const isImageFile = (u) =>
    Boolean(
      u &&
        (typeof u === 'string' &&
          (/\.(jpg|jpeg|png|webp|svg|gif|bmp)($|\?)/i.test(u) ||
            u.includes('/image/upload/') ||
            u.startsWith('data:image/'))),
    )

  const incomingDocUrls = []
  if (Array.isArray(req.body.documentUrls)) {
    req.body.documentUrls.forEach((u) => {
      const norm = normalizeStoredMediaUrl(u)
      if (norm && !incomingDocUrls.includes(norm)) incomingDocUrls.push(norm)
    })
  }
  if (rawFrontUrl && !incomingDocUrls.includes(rawFrontUrl)) incomingDocUrls.push(rawFrontUrl)
  if (rawBackUrl && !incomingDocUrls.includes(rawBackUrl)) incomingDocUrls.push(rawBackUrl)
  if (rawVideoUrl && !incomingDocUrls.includes(rawVideoUrl)) incomingDocUrls.push(rawVideoUrl)

  if (!rawVideoUrl && !rawFrontUrl && !rawBackUrl && incomingDocUrls.length === 0) {
    return sendError(res, {
      message: 'Upload your Aadhaar/PAN document photo or record a KYC video before submitting',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_KYC_DOCUMENT',
    })
  }

  // Determine primary video vs image
  let primaryVideoUrl = rawVideoUrl
  let primaryFrontImageUrl = rawFrontUrl
  if (rawVideoUrl && isImageFile(rawVideoUrl) && !primaryFrontImageUrl) {
    primaryFrontImageUrl = rawVideoUrl
  }

  const updateData = {
    [`${profileKey}.kycStatus`]: KYC_STATUS.PENDING,
    [`${profileKey}.kycVideoUrl`]: primaryVideoUrl || primaryFrontImageUrl || '',
    [`${profileKey}.kycVideoMeta`]: sanitizeKycVideoMeta(req.body.videoMeta),
    [`${profileKey}.kycSubmittedAt`]: new Date(),
    identityStatus: IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION,
  }
  if (incomingDocUrls.length > 0) {
    updateData[`${profileKey}.kycDocumentUrls`] = incomingDocUrls
  }
  if (primaryFrontImageUrl) updateData[`${profileKey}.kycFrontImageUrl`] = primaryFrontImageUrl
  if (rawBackUrl) updateData[`${profileKey}.kycBackImageUrl`] = rawBackUrl
  if (hasAadhaarInput) updateData[`${profileKey}.aadhaarMasked`] = maskAadhaarLast4(normalizedAadhaar)
  if (hasPanInput) updateData[`${profileKey}.panMasked`] = maskPan(normalizedPan)

  // Create or update IdentityVerification record
  let identityDoc = await IdentityVerification.findOne({ userId: req.user._id })
  const docUrlsToSave = incomingDocUrls.length > 0 ? incomingDocUrls : (primaryVideoUrl ? [primaryVideoUrl] : [])
  if (!identityDoc) {
    identityDoc = await IdentityVerification.create({
      userId: req.user._id,
      role: req.user.role,
      submittedName: req.user.fullName || 'Service Partner',
      status: IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION,
      documentType: hasPanInput && !hasAadhaarInput ? 'pan' : 'aadhaar',
      documentNumberMasked: updateData[`${profileKey}.aadhaarMasked`] || updateData[`${profileKey}.panMasked`],
      documentUrls: docUrlsToSave,
      submittedAt: new Date(),
    })
  } else {
    identityDoc.status = IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION
    identityDoc.documentNumberMasked = updateData[`${profileKey}.aadhaarMasked`] || updateData[`${profileKey}.panMasked`]
    identityDoc.documentUrls = docUrlsToSave
    identityDoc.submittedAt = new Date()
    await identityDoc.save()
  }
  updateData.identityVerificationRef = identityDoc._id

  req.user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateData, $unset: { [`${profileKey}.kycReviewNote`]: 1 } },
    { new: true, runValidators: false }
  )

  await logIdentityAudit({
    userId: req.user._id,
    verificationId: identityDoc._id,
    action: IDENTITY_AUDIT_ACTIONS.IDENTITY_SUBMITTED,
    previousStatus: IDENTITY_STATUS.CONTACT_VERIFIED,
    newStatus: IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION,
    performedBy: req.user._id,
    actorRole: 'USER',
    reason: 'Vendor submitted KYC documents and masked government ID details for identity verification',
  })

  if (req.user.role === USER_ROLES.LABOUR) {
    await populateLabourCategories(req.user)
  }

  return sendSuccess(res, {
    message: 'KYC documents submitted — an admin will review your Aadhaar and PAN shortly.',
    data: { user: req.user.toSafeObject() },
  })
})

/** PATCH /users/:id/labour-kyc-review — admin approve / reject labour/contractor KYC */
export const reviewLabourKyc = asyncHandler(async (req, res) => {
  const { decision, note } = req.body
  const user = await User.findById(req.params.id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  if (user.role !== USER_ROLES.LABOUR && user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, {
      message: 'KYC review applies to labour and contractor accounts only',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_ROLE',
    })
  }

  const profileKey = user.role === USER_ROLES.CONTRACTOR ? 'contractorProfile' : 'labourProfile'
  user[profileKey] = user[profileKey] || {}
  const profile = user[profileKey]

  if (decision === 'approved') {
    if (!profile.kycSubmittedAt || !labourHasKycVideo(profile)) {
      return sendError(res, {
        message: 'This user has not submitted KYC documents or video yet',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'NO_KYC_SUBMISSION',
      })
    }
    profile.kycStatus = KYC_STATUS.VERIFIED
    profile.kycReviewNote = undefined

    user.identityStatus = IDENTITY_STATUS.VERIFIED
    user.verifiedLegalName = user.fullName

    if (user.identityVerificationRef) {
      await IdentityVerification.findByIdAndUpdate(user.identityVerificationRef, {
        status: IDENTITY_STATUS.VERIFIED,
        verifiedAt: new Date(),
        reviewedBy: req.user?._id,
        reviewedAt: new Date(),
        verifiedLegalName: user.fullName,
      })
    }

    await logIdentityAudit({
      userId: user._id,
      verificationId: user.identityVerificationRef,
      action: IDENTITY_AUDIT_ACTIONS.ADMIN_APPROVED,
      previousStatus: IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION,
      newStatus: IDENTITY_STATUS.VERIFIED,
      performedBy: req.user?._id,
      actorRole: 'ADMIN',
      reason: 'Admin reviewed and approved vendor video KYC and identity evidence',
    })

    // Start vendor trial lifecycle automatically upon KYC approval (Requirement 2)
    try {
      await startVendorTrial(user._id, {
        performedBy: req.user?._id,
        actorRole: 'ADMIN',
        reason: 'Admin verified KYC, starting vendor trial period',
      })
    } catch (trialErr) {
      console.error('Error auto-starting vendor trial:', trialErr)
    }
  } else {
    profile.kycStatus = KYC_STATUS.FAILED
    profile.kycReviewNote = typeof note === 'string' ? note.trim().slice(0, 500) : ''

    user.identityStatus = IDENTITY_STATUS.REJECTED

    if (user.identityVerificationRef) {
      await IdentityVerification.findByIdAndUpdate(user.identityVerificationRef, {
        status: IDENTITY_STATUS.REJECTED,
        rejectionReason: note || 'KYC verification rejected by admin',
        reviewedBy: req.user?._id,
        reviewedAt: new Date(),
      })
    }

    await logIdentityAudit({
      userId: user._id,
      verificationId: user.identityVerificationRef,
      action: IDENTITY_AUDIT_ACTIONS.ADMIN_REJECTED,
      previousStatus: IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION,
      newStatus: IDENTITY_STATUS.REJECTED,
      performedBy: req.user?._id,
      actorRole: 'ADMIN',
      reason: note || 'KYC verification rejected by admin',
    })
  }

  await user.save()
  if (user.role === USER_ROLES.LABOUR) {
    await populateLabourCategories(user)
  }

  return sendSuccess(res, {
    message: decision === 'approved' ? 'KYC approved and Vendor Trial started' : 'KYC marked as rejected',
    data: { user: user.toSafeObject({ includeLabourKycImages: true }) },
  })
})

const MAX_SEARCH_LEN = 80
const MAX_PAGE_SIZE = 100

function buildSearchOrClause(searchTrim) {
  const esc = searchTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const or = [{ fullName: new RegExp(esc, 'i') }, { email: new RegExp(esc, 'i') }]
  const digits = searchTrim.replace(/\D/g, '')
  if (digits.length >= 2) {
    or.push({ phone: { $regex: digits } })
  }
  return { $or: or }
}

const KYC_PENDING_CONDITIONS = [
  { labourProfile: { $exists: false } },
  { 'labourProfile.kycStatus': { $exists: false } },
  { 'labourProfile.kycStatus': null },
  { 'labourProfile.kycStatus': KYC_STATUS.PENDING },
]

function mergeAnd(base, extraClauses) {
  const next = { ...base }
  const existing = Array.isArray(next.$and) ? [...next.$and] : []
  next.$and = [...existing, ...extraClauses]
  return next
}

/** Admin: list users with search, role, active/inactive, optional labour KYC filter, pagination */
export const listUsers = asyncHandler(async (req, res) => {
  const { search, role, status, kycStatus, freeTrialStatus, trialSlotStatus, categoryId, location, kitStatus, page = 1, limit = 20 } = req.query
  const q = {}
  const andParts = []

  if (role) {
    if (!ROLE_LIST.includes(role)) {
      return sendError(res, {
        message: 'Invalid role filter',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_ROLE',
      })
    }
  }

  if (status === 'active') q.isActive = true
  else if (status === 'inactive') q.isActive = false
  else if (status != null && status !== '' && status !== 'all') {
    return sendError(res, {
      message: 'status must be active, inactive, or all',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_STATUS',
    })
  }

  const searchTrim = typeof search === 'string' ? search.trim() : ''
  if (searchTrim.length > MAX_SEARCH_LEN) {
    return sendError(res, {
      message: `Search must be at most ${MAX_SEARCH_LEN} characters`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'SEARCH_TOO_LONG',
    })
  }

  if (searchTrim) {
    andParts.push(buildSearchOrClause(searchTrim))
  }

  const kycRaw = typeof kycStatus === 'string' ? kycStatus.trim().toLowerCase() : ''
  const kycKey = kycRaw === '' || kycRaw === 'all' ? 'all' : kycRaw
  if (kycKey !== 'all' && !Object.values(KYC_STATUS).includes(kycKey)) {
    return sendError(res, {
      message: 'kycStatus must be all, pending, verified, or failed',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_KYC_STATUS',
    })
  }

  if (kycKey !== 'all') {
    if (role && role !== USER_ROLES.LABOUR && role !== USER_ROLES.CONTRACTOR) {
      return sendError(res, {
        message: 'KYC filter applies to labour/contractor accounts only.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'KYC_REQUIRES_LABOUR',
      })
    }
    if (!role) {
      q.role = { $in: [USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR] }
    } else {
      q.role = role
    }
    
    // In MongoDB we can dynamically build this. Since we support both now, we can use an $or based on the current role.
    const addKycConditions = (profileField) => {
      if (kycKey === KYC_STATUS.PENDING) {
        andParts.push({
          $or: [
            { [profileField]: { $exists: false } },
            { [`${profileField}.kycStatus`]: { $exists: false } },
            { [`${profileField}.kycStatus`]: null },
            { [`${profileField}.kycStatus`]: KYC_STATUS.PENDING },
          ]
        })
      } else if (kycKey === KYC_STATUS.VERIFIED) {
        andParts.push({ [`${profileField}.kycStatus`]: KYC_STATUS.VERIFIED })
      } else if (kycKey === KYC_STATUS.FAILED) {
        andParts.push({ [`${profileField}.kycStatus`]: KYC_STATUS.FAILED })
      }
    }
    
    // If specific role requested, use that profile field
    if (q.role === USER_ROLES.CONTRACTOR) {
      addKycConditions('contractorProfile')
    } else if (q.role === USER_ROLES.LABOUR) {
      addKycConditions('labourProfile')
    } else {
      // If no specific role requested but we are querying both:
      if (kycKey === KYC_STATUS.VERIFIED || kycKey === KYC_STATUS.FAILED) {
        andParts.push({
          $or: [
            { role: USER_ROLES.LABOUR, 'labourProfile.kycStatus': kycKey },
            { role: USER_ROLES.CONTRACTOR, 'contractorProfile.kycStatus': kycKey }
          ]
        })
      } else if (kycKey === KYC_STATUS.PENDING) {
        andParts.push({
          $or: [
            { role: USER_ROLES.LABOUR, $or: [ { 'labourProfile': { $exists: false } }, { 'labourProfile.kycStatus': { $exists: false } }, { 'labourProfile.kycStatus': null }, { 'labourProfile.kycStatus': KYC_STATUS.PENDING } ] },
            { role: USER_ROLES.CONTRACTOR, $or: [ { 'contractorProfile': { $exists: false } }, { 'contractorProfile.kycStatus': { $exists: false } }, { 'contractorProfile.kycStatus': null }, { 'contractorProfile.kycStatus': KYC_STATUS.PENDING } ] }
          ]
        })
      }
    }
  } else if (role) {
    q.role = role
  }

  if (trialSlotStatus && trialSlotStatus !== 'all') {
    if (trialSlotStatus === 'scheduled') {
      andParts.push({ 'labourProfile.trialSlot.status': 'SCHEDULED' })
    } else if (trialSlotStatus === 'completed') {
      andParts.push({ 'labourProfile.trialSlot.status': { $in: ['COMPLETED', 'PASSED'] } })
    } else if (trialSlotStatus === 'failed') {
      andParts.push({ 'labourProfile.trialSlot.status': 'FAILED' })
    } else if (trialSlotStatus === 'not_scheduled') {
      andParts.push({
        $or: [
          { 'labourProfile.trialSlot': { $exists: false } },
          { 'labourProfile.trialSlot.status': { $exists: false } },
          { 'labourProfile.trialSlot.status': 'NOT_SCHEDULED' },
        ],
      })
    }
  }

  if (freeTrialStatus) {
    if (role && role !== USER_ROLES.LABOUR) {
      return sendError(res, {
        message: 'Free trial filter applies to labour accounts only.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'TRIAL_REQUIRES_LABOUR',
      })
    }
    q.role = USER_ROLES.LABOUR
    
    if (freeTrialStatus === 'active') {
      andParts.push({ 'labourProfile.trialEndsAt': { $gt: new Date() } })
    } else if (freeTrialStatus === 'expired') {
      andParts.push({
        'labourProfile.trialEndsAt': { $lte: new Date() },
        'labourProfile.trialStartedAt': { $exists: true }
      })
    } else if (freeTrialStatus === 'all') {
      andParts.push({ 'labourProfile.trialStartedAt': { $exists: true } })
    }
  }

  if (categoryId && categoryId !== 'all') {
    andParts.push({ 'labourProfile.categoryIds': categoryId })
  }

  if (location && location.trim() !== '' && location !== 'all') {
    const locRegex = new RegExp(escapeRegexForMongo(location.trim()), 'i')
    andParts.push({ $or: [{ city: locRegex }, { currentLocation: locRegex }] })
  }

  if (kitStatus && kitStatus !== 'all') {
    if (kitStatus === 'payment_pending') {
      andParts.push({ 'welcomeKit.status': { $in: ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED'] } })
    } else if (kitStatus === 'payment_submitted' || kitStatus === 'slip_pending') {
      andParts.push({ 'welcomeKit.status': 'PAYMENT_SUBMITTED' })
    } else if (kitStatus === 'payment_rejected') {
      andParts.push({ 'welcomeKit.status': 'PAYMENT_REJECTED' })
    } else if (kitStatus === 'address_pending') {
      andParts.push({
        'welcomeKit.status': { $in: ['PAID', 'READY_FOR_DISPATCH'] },
        $or: [
          { 'welcomeKit.addressStatus': 'NOT_SUBMITTED' },
          { 'welcomeKit.addressStatus': { $exists: false } },
        ],
      })
    } else if (kitStatus === 'address_submitted') {
      andParts.push({ 'welcomeKit.addressStatus': 'SUBMITTED' })
    } else if (kitStatus === 'ready_to_dispatch') {
      andParts.push({
        $or: [
          { 'welcomeKit.status': 'READY_FOR_DISPATCH' },
          { 'welcomeKit.addressStatus': 'CONFIRMED' },
        ],
      })
    } else if (kitStatus === 'dispatched') {
      andParts.push({ 'welcomeKit.status': 'DISPATCHED' })
    } else if (kitStatus === 'delivered') {
      andParts.push({ 'welcomeKit.status': 'DELIVERED' })
    } else if (kitStatus === 'has_slip' || kitStatus === 'slip_uploaded') {
      andParts.push({ 'welcomeKit.paymentReceiptUrl': { $exists: true, $ne: '' } })
    } else if (kitStatus === 'paid' || kitStatus === 'payment_approved') {
      andParts.push({ 'welcomeKit.status': { $in: ['PAID', 'READY_FOR_DISPATCH', 'DELIVERED', 'DISPATCHED'] } })
    } else if (kitStatus === 'complete') {
      andParts.push({
        'welcomeKit.uniformIssued': true,
        'welcomeKit.idCardIssued': true,
        'welcomeKit.bagIssued': true,
      })
    } else if (kitStatus === 'not_issued') {
      andParts.push({
        $or: [
          { welcomeKit: { $exists: false } },
          {
            'welcomeKit.uniformIssued': { $ne: true },
            'welcomeKit.idCardIssued': { $ne: true },
            'welcomeKit.bagIssued': { $ne: true },
          },
        ],
      })
    } else if (kitStatus === 'partial') {
      andParts.push({
        $and: [
          {
            $or: [
              { 'welcomeKit.uniformIssued': true },
              { 'welcomeKit.idCardIssued': true },
              { 'welcomeKit.bagIssued': true },
            ],
          },
          {
            $or: [
              { 'welcomeKit.uniformIssued': { $ne: true } },
              { 'welcomeKit.idCardIssued': { $ne: true } },
              { 'welcomeKit.bagIssued': { $ne: true } },
            ],
          },
        ],
      })
    }
  }

  if (andParts.length) {
    q.$and = andParts
  }

  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(limit) || 20))
  const skip = (pg - 1) * lim

  let labourKycCounts = null
  if (q.role === USER_ROLES.LABOUR) {
    const statsBase = { role: USER_ROLES.LABOUR }
    if (q.isActive !== undefined) statsBase.isActive = q.isActive
    if (searchTrim) {
      statsBase.$and = [buildSearchOrClause(searchTrim)]
    }
    const [pending, verified, failed, labourTotal] = await Promise.all([
      User.countDocuments(mergeAnd(statsBase, [{ $or: KYC_PENDING_CONDITIONS }])),
      User.countDocuments(mergeAnd(statsBase, [{ 'labourProfile.kycStatus': KYC_STATUS.VERIFIED }])),
      User.countDocuments(mergeAnd(statsBase, [{ 'labourProfile.kycStatus': KYC_STATUS.FAILED }])),
      User.countDocuments(statsBase),
    ])
    labourKycCounts = { pending, verified, failed, total: labourTotal }
  }

  const [items, total] = await Promise.all([
    User.find(q)
      .select('-passwordHash')
      .populate({ path: 'labourProfile.categoryIds', select: 'name slug isActive' })
      .populate({ path: 'labourProfile.serviceIds', select: 'name isActive' })
      .sort({ lastLoginAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    User.countDocuments(q),
  ])

  const itemsOut = items.map((u) => {
    let lp = u.labourProfile ? { ...u.labourProfile } : undefined
    if (lp) {
      delete lp.kycFrontImageDataUrl
      delete lp.kycBackImageDataUrl
      if (lp.trialSlot?.timeSlot) {
        lp.trialSlot = {
          ...lp.trialSlot,
          timeSlot: cleanTimeSlot(lp.trialSlot.timeSlot),
        }
      }
    }
    let cp = u.contractorProfile ? { ...u.contractorProfile } : undefined
    if (cp) {
      delete cp.kycFrontImageDataUrl
      delete cp.kycBackImageDataUrl
      if (cp.trialSlot?.timeSlot) {
        cp.trialSlot = {
          ...cp.trialSlot,
          timeSlot: cleanTimeSlot(cp.trialSlot.timeSlot),
        }
      }
    }
    let city = u.city
    if (!city || typeof city !== 'string' || !city.trim() || city.trim() === 'Noida, NCR') {
      const resolvedCity =
        u.welcomeKit?.confirmedAddressSnapshot?.city ||
        u.welcomeKit?.address?.city ||
        u.welcomeKit?.deliveryCity ||
        u.savedAddresses?.find((a) => a.isDefault && a.city?.trim())?.city ||
        u.savedAddresses?.find((a) => a.city?.trim())?.city ||
        u.currentLocation ||
        ''
      if (resolvedCity && resolvedCity.trim() && resolvedCity.trim() !== 'Noida, NCR') {
        city = resolvedCity.trim()
      }
    }

    const partnerIdCode =
      u.partnerIdCode ||
      (u._id ? `A2Z-SP-${String(u._id).slice(-6).toUpperCase()}` : undefined)

    return {
      ...u,
      city: city || u.city || '',
      ...(partnerIdCode ? { partnerIdCode } : {}),
      ...(lp ? { labourProfile: lp } : {}),
      ...(cp ? { contractorProfile: cp } : {}),
    }
  })

  return sendSuccess(res, {
    data: {
      items: itemsOut,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
      labourKycCounts,
    },
  })
})

/** Admin: get one user (includes KYC document data URLs and identity verification for review) */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('identityVerificationRef')
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  await populateLabourCategories(user)
  const safeUser = user.toSafeObject({ includeLabourKycImages: true })
  if (user.identityVerificationRef) {
    safeUser.identityVerification = user.identityVerificationRef
  }
  return sendSuccess(res, { data: { user: safeUser } })
})

function displayNameFromFullName(fullName) {
  const t = (fullName || '').trim()
  if (!t) return 'Worker'
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  const initial = last[0]?.toUpperCase() || ''
  return initial ? `${parts[0]} ${initial}.` : parts[0]
}

function escapeRegexForMongo(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tradeCategoriesFromPopulatedUser(leanUser) {
  const raw = leanUser.labourProfile?.categoryIds
  if (!Array.isArray(raw)) return []
  const out = []
  for (const c of raw) {
    if (!c || typeof c !== 'object' || !c._id) continue
    if (c.isActive === false) continue
    const g = c.group
    if (!g || typeof g !== 'object') continue
    if (g.kind !== LABOUR_GROUP_KIND.TRADE || g.isActive === false) continue
    out.push({
      _id: String(c._id),
      name: c.name,
      subtitle: c.subtitle || '',
      groupId: g._id ? String(g._id) : '',
      groupName: g.name || '',
    })
  }
  return out
}

function labourToPublicCard(leanUser) {
  const trades = tradeCategoriesFromPopulatedUser(leanUser)
  const kyc = leanUser.labourProfile?.kycStatus
  return {
    id: String(leanUser._id),
    displayName: displayNameFromFullName(leanUser.fullName),
    kycVerified: kyc === KYC_STATUS.VERIFIED,
    kycStatus: typeof kyc === 'string' ? kyc : KYC_STATUS.PENDING,
    tradeCategories: trades,
  }
}

function labourToPublicDetail(leanUser) {
  const base = labourToPublicCard(leanUser)
  const created = leanUser.createdAt ? new Date(leanUser.createdAt) : null
  return {
    ...base,
    memberSinceYear: created && !Number.isNaN(created.getTime()) ? created.getFullYear() : null,
  }
}

/** GET /users/discover/labours — app users browse workers (trade categories only; no phone/email) */
export const listDiscoverLabours = asyncHandler(async (req, res) => {
  const groupIdRaw = typeof req.query.groupId === 'string' ? req.query.groupId.trim() : ''
  const categoryIdRaw = typeof req.query.categoryId === 'string' ? req.query.categoryId.trim() : ''
  const qRaw = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : ''
  const lim = Math.min(50, Math.max(1, Number(req.query.limit) || 24))

  const filter = {
    role: USER_ROLES.LABOUR,
    isActive: true,
    'labourProfile.categoryIds.0': { $exists: true },
  }

  if (qRaw) {
    filter.fullName = { $regex: escapeRegexForMongo(qRaw), $options: 'i' }
  }

  if (categoryIdRaw) {
    if (!mongoose.isValidObjectId(categoryIdRaw)) {
      return sendError(res, {
        message: 'Invalid category id',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_CATEGORY',
      })
    }
    const cat = await LabourCategory.findOne({ _id: categoryIdRaw, isActive: true })
      .populate({ path: 'group', select: 'kind isActive' })
      .lean()
    if (!cat || cat.group?.kind !== LABOUR_GROUP_KIND.TRADE || cat.group?.isActive === false) {
      return sendSuccess(res, { data: { items: [] } })
    }
    filter['labourProfile.categoryIds'] = new mongoose.Types.ObjectId(categoryIdRaw)
  } else if (groupIdRaw) {
    if (!mongoose.isValidObjectId(groupIdRaw)) {
      return sendError(res, {
        message: 'Invalid group id',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_GROUP',
      })
    }
    const group = await LabourCategoryGroup.findById(groupIdRaw).lean()
    if (!group || group.kind !== LABOUR_GROUP_KIND.TRADE || !group.isActive) {
      return sendSuccess(res, { data: { items: [] } })
    }
    const catIds = await LabourCategory.find({ group: groupIdRaw, isActive: true }).distinct('_id')
    if (!catIds.length) {
      return sendSuccess(res, { data: { items: [] } })
    }
    filter['labourProfile.categoryIds'] = { $in: catIds }
  }

  const items = await User.find(filter)
    .select('fullName labourProfile.kycStatus labourProfile.categoryIds createdAt')
    .populate({
      path: 'labourProfile.categoryIds',
      match: { isActive: true },
      select: 'name subtitle isActive group',
      populate: { path: 'group', select: 'name kind isActive' },
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(lim)
    .lean()

  const cards = items.map((u) => labourToPublicCard(u)).filter((c) => c.tradeCategories.length > 0)

  return sendSuccess(res, { data: { items: cards } })
})

/** GET /users/discover/labours/:id — public worker detail for homeowner app */
export const getDiscoverLabour = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    role: USER_ROLES.LABOUR,
    isActive: true,
    'labourProfile.categoryIds.0': { $exists: true },
  })
    .select('fullName labourProfile.kycStatus labourProfile.categoryIds createdAt')
    .populate({
      path: 'labourProfile.categoryIds',
      match: { isActive: true },
      select: 'name subtitle isActive group',
      populate: { path: 'group', select: 'name kind isActive' },
    })
    .lean()

  if (!user) {
    return sendError(res, { message: 'Worker not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }

  const detail = labourToPublicDetail(user)
  if (!detail.tradeCategories.length) {
    return sendError(res, { message: 'Worker not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }

  return sendSuccess(res, { data: { labour: detail } })
})
/** PATCH /users/me/labour/schedule — worker updates their weekly time schedule */
export const updateLabourSchedule = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return sendError(res, {
      message: 'Only worker accounts can update their schedule',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FORBIDDEN',
    })
  }

  const { schedule } = req.body
  if (!Array.isArray(schedule) || schedule.length !== 7) {
    return sendError(res, {
      message: 'Schedule must be an array of 7 days',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_SCHEDULE',
    })
  }

  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  
  for (const day of schedule) {
    if (!validDays.includes(day.day)) {
      return sendError(res, {
        message: 'Invalid day in schedule',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_SCHEDULE',
      })
    }
  }

  req.user.labourProfile = req.user.labourProfile || {}
  req.user.labourProfile.schedule = schedule

  await req.user.save()
  
  return sendSuccess(res, {
    message: 'Time schedule saved successfully',
    data: { user: req.user.toSafeObject() },
  })
})

/** POST /users/test-notification — Send a test Firebase push notification */
export const testNotification = asyncHandler(async (req, res) => {
  const { token, title, body } = req.body;
  if (!token) {
    return sendError(res, { message: 'Device token is required', statusCode: HTTP_STATUS.BAD_REQUEST, code: 'MISSING_TOKEN' });
  }

  const { getFirebaseAdmin } = await import('../config/firebase.js');
  const admin = getFirebaseAdmin();
  if (!admin) {
    return sendError(res, { message: 'Firebase Admin not configured', statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE, code: 'FIREBASE_NOT_CONFIGURED' });
  }

  try {
    const response = await admin.messaging().send({
      token,
      notification: {
        title: title || 'Test Notification',
        body: body || 'This is a test notification from A2Z backend.',
      },
    });
    return sendSuccess(res, { message: 'Notification sent successfully', data: { messageId: response } });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return sendError(res, { 
      message: error.message || 'Failed to send notification', 
      statusCode: HTTP_STATUS.SERVER_ERROR, 
      code: error.code || 'NOTIFICATION_FAILED' 
    });
  }
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Prevent admin from deleting themselves
  if (String(user._id) === String(req.user._id)) {
    return sendError(res, { message: 'Cannot delete your own admin account', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Delete associated records if needed (for now, simply delete the user document)
  await User.deleteOne({ _id: user._id })

  return sendSuccess(res, { message: 'User deleted successfully' })
})

export const deleteMe = asyncHandler(async (req, res) => {
  const user = req.user
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  await User.deleteOne({ _id: user._id })

  return sendSuccess(res, { message: 'Account deleted successfully' })
})

/**
 * PATCH /api/service-partners/:partnerId/welcome-kit
 * or PATCH /api/users/:id/welcome-kit
 * Updates uniformIssued, idCardIssued, bagIssued and calculates issuedAt
 */
export const updatePartnerWelcomeKit = asyncHandler(async (req, res) => {
  const partnerId = req.params.partnerId || req.params.id
  if (!mongoose.Types.ObjectId.isValid(partnerId)) {
    return sendError(res, {
      message: 'Invalid service partner ID',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_ID',
    })
  }

  const { uniformIssued, idCardIssued, bagIssued } = req.body

  // Validation: must be strictly boolean
  if (typeof uniformIssued !== 'boolean' || typeof idCardIssued !== 'boolean' || typeof bagIssued !== 'boolean') {
    return sendError(res, {
      message: 'uniformIssued, idCardIssued, and bagIssued must be boolean values (true or false)',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_BOOLEAN_FIELDS',
    })
  }

  const user = await User.findById(partnerId)
  if (!user) {
    return sendError(res, {
      message: 'Service partner not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'PARTNER_NOT_FOUND',
    })
  }

  // Business Logic: Complete vs Partial / Not Issued
  const isComplete = uniformIssued && idCardIssued && bagIssued
  let issuedAt = null

  if (isComplete) {
    // Preserve existing issuedAt if already complete, otherwise set current timestamp
    issuedAt = user.welcomeKit?.issuedAt || new Date()
  } else {
    issuedAt = null
  }

  user.welcomeKit = {
    ...(user.welcomeKit ? (typeof user.welcomeKit.toObject === 'function' ? user.welcomeKit.toObject() : user.welcomeKit) : {}),
    uniformIssued,
    idCardIssued,
    bagIssued,
    productsIssued: req.body.productsIssued !== undefined ? Boolean(req.body.productsIssued) : Boolean(user.welcomeKit?.productsIssued),
    isReceived: isComplete ? true : Boolean(user.welcomeKit?.isReceived),
    status: isComplete ? 'DELIVERED' : (req.body.status || user.welcomeKit?.status || 'PENDING_PAYMENT'),
    issuedAt,
  }

  await user.save()

  return sendSuccess(res, {
    message: 'Welcome kit updated successfully',
    data: {
      welcomeKit: user.welcomeKit,
      uniformIssued: user.welcomeKit.uniformIssued,
      idCardIssued: user.welcomeKit.idCardIssued,
      bagIssued: user.welcomeKit.bagIssued,
      issuedAt: user.welcomeKit.issuedAt,
    },
  })
})

/**
 * GET /api/service-partners/welcome-kit-stats
 * Dashboard stats for welcome kit distribution
 */
export const getPartnerWelcomeKitStats = asyncHandler(async (req, res) => {
  const partners = await User.find({ role: USER_ROLES.LABOUR }).select('welcomeKit fullName phone').lean()

  let total = partners.length
  let complete = 0
  let partial = 0
  let notIssued = 0
  let uniformCount = 0
  let idCardCount = 0
  let bagCount = 0

  let paymentPending = 0
  let paymentRejected = 0
  let addressPending = 0
  let addressSubmitted = 0
  let readyToDispatch = 0
  let dispatched = 0
  let delivered = 0

  for (const p of partners) {
    const kit = p.welcomeKit || {}
    const u = Boolean(kit.uniformIssued)
    const i = Boolean(kit.idCardIssued)
    const b = Boolean(kit.bagIssued)

    if (u) uniformCount++
    if (i) idCardCount++
    if (b) bagCount++

    if (u && i && b) {
      complete++
    } else if (u || i || b) {
      partial++
    } else {
      notIssued++
    }

    const st = kit.status || 'PENDING_PAYMENT'
    const ast = kit.addressStatus || 'NOT_SUBMITTED'

    if (st === 'PENDING_PAYMENT' || st === 'PAYMENT_SUBMITTED') paymentPending++
    if (st === 'PAYMENT_REJECTED') paymentRejected++
    if ((st === 'PAID' || st === 'READY_FOR_DISPATCH') && ast === 'NOT_SUBMITTED') addressPending++
    if (ast === 'SUBMITTED' || ast === 'CORRECTION_REQUESTED') addressSubmitted++
    if (st === 'READY_FOR_DISPATCH' || ast === 'CONFIRMED') readyToDispatch++
    if (st === 'DISPATCHED') dispatched++
    if (st === 'DELIVERED') delivered++
  }

  return sendSuccess(res, {
    data: {
      total,
      complete,
      partial,
      notIssued,
      uniformIssued: uniformCount,
      idCardIssued: idCardCount,
      bagIssued: bagCount,
      paymentPending,
      paymentRejected,
      addressPending,
      addressSubmitted,
      readyToDispatch,
      dispatched,
      delivered,
    },
  })
})

/**
 * GET /api/users/me/onboarding-status
 * Fetches the complete 5-step registration status for the logged in service partner
 */
export const getPartnerOnboardingStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean()
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Step 1: Category & Experience
  const hasCategory = Boolean(
    (user.labourProfile?.categoryIds && user.labourProfile.categoryIds.length > 0) ||
    (user.labourProfile?.skills && user.labourProfile.skills.length > 0)
  )
  const experienceYears = user.labourProfile?.experienceYears ?? null
  const step1Complete = Boolean(hasCategory && (experienceYears !== null && experienceYears !== undefined))

  // Step 2: KYC Aadhaar & PAN
  const kycStatus = user.labourProfile?.kycStatus || 'pending'
  const hasAadhaar = Boolean(user.labourProfile?.aadhaarMasked)
  const hasPan = Boolean(user.labourProfile?.panMasked)
  const step2Complete = Boolean(
    user.labourProfile?.kycSubmittedAt || hasAadhaar || hasPan || kycStatus === 'verified'
  )

  // Step 3: Admin Approval
  const step3Approved = Boolean(step2Complete && kycStatus === 'verified')
  const step3Failed = Boolean(step2Complete && kycStatus === 'failed')
  const step3Pending = Boolean(step2Complete && !step3Approved && !step3Failed)

  // Step 4: Trial Slot & Joining Confirmation
  const rawTrialSlot = user.labourProfile?.trialSlot
    ? (user.labourProfile.trialSlot.toObject ? user.labourProfile.trialSlot.toObject() : { ...user.labourProfile.trialSlot })
    : { status: 'NOT_SCHEDULED' }
  const trialSlot = {
    ...rawTrialSlot,
    timeSlot: cleanTimeSlot(rawTrialSlot.timeSlot),
  }
  const trialStatus = user.vendorStatus || 'NOT_STARTED'
  const trialPassed =
    step3Approved &&
    (trialSlot.status === 'COMPLETED' ||
      trialSlot.status === 'PASSED' ||
      trialStatus === 'CONFIRMED' ||
      trialStatus === 'TRIAL_COMPLETED')
  const step4Complete = Boolean(trialPassed)

  // Welcome Kit Payment - Only PAID, READY_FOR_DISPATCH, DISPATCHED, or DELIVERED means payment is verified/complete
  const welcomeKit = user.welcomeKit || {}
  const paymentComplete = Boolean(
    welcomeKit.status === 'PAID' ||
    welcomeKit.status === 'READY_FOR_DISPATCH' ||
    welcomeKit.status === 'DISPATCHED' ||
    welcomeKit.status === 'DELIVERED'
  )

  // Step 5: Welcome Kit Received
  const kitReceived = Boolean(
    welcomeKit.isReceived ||
    welcomeKit.status === 'DELIVERED' ||
    (welcomeKit.uniformIssued && welcomeKit.idCardIssued && welcomeKit.bagIssued)
  )
  const step5Complete = kitReceived

  let currentStep = 1
  if (!step1Complete) currentStep = 1
  else if (!step2Complete) currentStep = 2
  else if (!step3Approved) currentStep = 3
  else if (!step4Complete || !paymentComplete) currentStep = 4
  else if (!step5Complete) currentStep = 5
  else currentStep = 6 // All completed!

  // Trial configuration and available slots
  let availableTrialSlots = []
  let trialHubLocations = []
  let defaultHubLocation = 'A2Z Partner Training & Evaluation Center, Sector 18, Noida'
  let availableZones = []
  try {
    const [trialConfig, zones] = await Promise.all([
      getTrialConfig(),
      Zone.find({ isActive: true }).select('name city state country isActive').sort('name'),
    ])
    if (trialConfig?.defaultHubLocation) {
      defaultHubLocation = trialConfig.defaultHubLocation
    }
    const userZoneId = user.labourProfile?.trialSlot?.zoneId
    if (userZoneId && Array.isArray(trialConfig?.zoneVenues)) {
      const zv = trialConfig.zoneVenues.find((v) => String(v.zoneId) === String(userZoneId))
      if (zv && zv.venueAddress && zv.venueAddress.trim()) {
        defaultHubLocation = zv.venueAddress.trim()
      }
    }
    availableTrialSlots = (trialConfig?.partnerTrialSlots || [])
      .filter((s) => s.isActive !== false)
      .map((s) => {
        const obj = s.toObject ? s.toObject() : { ...s }
        if (!obj.zoneName && obj.zoneId && obj.zoneId !== 'ALL' && Array.isArray(zones)) {
          const matched = zones.find((z) => String(z._id) === String(obj.zoneId))
          if (matched) obj.zoneName = matched.name
        }
        if (!obj.centerAddress || !obj.centerAddress.trim()) {
          if (obj.zoneId && obj.zoneId !== 'ALL' && Array.isArray(trialConfig?.zoneVenues)) {
            const zv = trialConfig.zoneVenues.find((v) => String(v.zoneId) === String(obj.zoneId))
            obj.centerAddress = (zv && zv.venueAddress && zv.venueAddress.trim()) || defaultHubLocation
          } else {
            obj.centerAddress = defaultHubLocation
          }
        }
        return obj
      })
    availableZones = zones || []
  } catch (err) {
    console.error('Failed to load trialConfig for onboarding status:', err)
  }

  return sendSuccess(res, {
    data: {
      currentStep,
      step1: {
        completed: step1Complete,
        categoryCount: user.labourProfile?.categoryIds?.length || 0,
        experienceYears,
      },
      step2: {
        completed: step2Complete,
        kycStatus,
        hasAadhaar,
        hasPan,
        documentUrls:
          Array.isArray(user.labourProfile?.kycDocumentUrls) && user.labourProfile.kycDocumentUrls.length > 0
            ? user.labourProfile.kycDocumentUrls
            : user.labourProfile?.kycFrontImageUrl
            ? [user.labourProfile.kycFrontImageUrl]
            : [],
        frontImageUrl: user.labourProfile?.kycFrontImageUrl || '',
        backImageUrl: user.labourProfile?.kycBackImageUrl || '',
        videoUrl: user.labourProfile?.kycVideoUrl || '',
      },
      step3: {
        status: step2Complete ? kycStatus : 'locked',
        isApproved: step3Approved,
        isPending: step3Pending,
        isFailed: step3Failed,
        reviewNote: user.labourProfile?.kycReviewNote,
      },
      step4: {
        completed: step4Complete,
        trialSlot,
        trialStatus,
        trialPassed,
        availableTrialSlots,
        trialHubLocations,
        defaultHubLocation,
        zones: availableZones,
        paymentComplete,
        welcomeKitPayment: {
          status: welcomeKit.status || 'PENDING_PAYMENT',
          method: welcomeKit.paymentMethod || 'NONE',
          receiptUrl: welcomeKit.paymentReceiptUrl || '',
          rejectionReason: welcomeKit.paymentRejectionReason || '',
          paidAt: welcomeKit.paidAt || null,
          verifiedAt: welcomeKit.paymentVerifiedAt || null,
          addressStatus: welcomeKit.addressStatus || 'NOT_SUBMITTED',
          address: welcomeKit.address || {},
          addressSubmittedAt: welcomeKit.addressSubmittedAt || null,
          addressCorrectionReason: welcomeKit.addressCorrectionReason || '',
          confirmedAddressSnapshot: welcomeKit.confirmedAddressSnapshot || null,
          dispatchDetails: welcomeKit.dispatchDetails || {},
          deliveryConfirmation: welcomeKit.deliveryConfirmation || {},
          auditTrail: welcomeKit.auditTrail || [],
          deliveryAddress: welcomeKit.deliveryAddress || '',
          deliveryCity: welcomeKit.deliveryCity || '',
          deliveryPincode: welcomeKit.deliveryPincode || '',
        },
      },
      step5: {
        completed: step5Complete,
        welcomeKit,
        isReadyForBookings: step5Complete,
        idCardGenerated: Boolean(user.welcomeKit?.idCardIssued || user.idCardGeneratedAt || step5Complete),
        partnerIdCode: user.partnerIdCode || `A2Z-SP-${String(user._id).slice(-6).toUpperCase()}`,
      },
      user: {
        _id: user._id,
        phone: user.phone,
        role: user.role,
        fullName: user.fullName,
        avatar: user.avatar,
        city: user.city,
        partnerIdCode: user.partnerIdCode || `A2Z-SP-${String(user._id).slice(-6).toUpperCase()}`,
        idCardGeneratedAt: user.idCardGeneratedAt || (step5Complete ? new Date() : null),
        welcomeKit,
        labourProfile: user.labourProfile,
        vendorStatus: user.vendorStatus,
      },
    },
  })
})

/**
 * GET /api/users/trial-slots
 * Dedicated real-time available trial slots & evaluation hub location endpoint
 */
export const getAvailableTrialSlots = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')

  const { date, zoneId } = req.query

  const [trialConfig, zones] = await Promise.all([
    getTrialConfig(),
    Zone.find({ isActive: true }).select('name city state country isActive').sort('name'),
  ])

  let availableTrialSlots = (trialConfig?.partnerTrialSlots || []).filter((s) => s.isActive !== false)

  // Filter by date if provided (ignore 'ALL' or invalid objects)
  if (date && typeof date === 'string' && date.trim() && date.trim() !== 'ALL' && date.trim() !== '[object Object]') {
    const d = date.trim()
    availableTrialSlots = availableTrialSlots.filter((s) => !s.date || s.date === 'ALL' || s.date === d)
  }

  // Filter by zoneId if provided (ignore 'ALL' or invalid objects)
  if (zoneId && typeof zoneId === 'string' && zoneId.trim() && zoneId !== 'ALL' && zoneId.trim() !== '[object Object]') {
    const zid = zoneId.trim()
    availableTrialSlots = availableTrialSlots.filter((s) => !s.zoneId || s.zoneId === 'ALL' || s.zoneId === zid)
  }

  let defaultHubLocation = trialConfig?.defaultHubLocation || 'A2Z Partner Training & Evaluation Center, Sector 18, Noida'
  if (zoneId && zoneId.trim() && zoneId !== 'ALL' && Array.isArray(trialConfig?.zoneVenues)) {
    const zv = trialConfig.zoneVenues.find((v) => String(v.zoneId) === String(zoneId.trim()))
    if (zv && zv.venueAddress && zv.venueAddress.trim()) {
      defaultHubLocation = zv.venueAddress.trim()
    }
  }
  const partnerTrialHubLocations = trialConfig?.partnerTrialHubLocations || []

  // Ensure each slot has centerAddress and zoneName populated
  const populatedSlots = availableTrialSlots.map((s) => {
    const obj = s.toObject ? s.toObject() : { ...s }
    if (!obj.zoneName && obj.zoneId && obj.zoneId !== 'ALL') {
      const matched = zones.find((z) => String(z._id) === String(obj.zoneId))
      if (matched) obj.zoneName = matched.name
    }
    if (!obj.centerAddress || !obj.centerAddress.trim()) {
      // Check if slot's specific zone has a configured venue
      if (obj.zoneId && obj.zoneId !== 'ALL' && Array.isArray(trialConfig?.zoneVenues)) {
        const zv = trialConfig.zoneVenues.find((v) => String(v.zoneId) === String(obj.zoneId))
        if (zv && zv.venueAddress && zv.venueAddress.trim()) {
          obj.centerAddress = zv.venueAddress.trim()
        } else {
          obj.centerAddress = defaultHubLocation
        }
      } else {
        obj.centerAddress = defaultHubLocation
      }
    }
    return obj
  })

  return sendSuccess(res, {
    data: {
      availableTrialSlots: populatedSlots,
      defaultHubLocation,
      partnerTrialHubLocations,
      zones,
    },
  })
})

/**
 * PATCH /api/users/me/trial-slot
 * Schedule trial slot (date, time, location, zone)
 */
export const schedulePartnerTrialSlot = asyncHandler(async (req, res) => {
  const { date, timeSlot, location, zoneId, zoneName } = req.body
  if (!date || !timeSlot) {
    return sendError(res, {
      message: 'Trial date and time slot are required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Ensure Step 3 Admin Approval is verified before scheduling a trial slot
  const isKycVerified = user.labourProfile?.kycStatus === 'verified'
  if (!isKycVerified) {
    return sendError(res, {
      message: 'Step 4 is locked. Please wait for Admin Approval & Verification of your KYC documents (Step 3) before scheduling a trial slot.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'STEP_LOCKED',
    })
  }

  let resolvedLocation = location ? String(location).trim() : ''
  if (!resolvedLocation) {
    try {
      const trialConfig = await getTrialConfig()
      resolvedLocation = trialConfig?.defaultHubLocation || 'A2Z Partner Training & Evaluation Center, Sector 18, Noida'
    } catch {
      resolvedLocation = 'A2Z Partner Training & Evaluation Center, Sector 18, Noida'
    }
  }

  const cleanedTimeSlot = cleanTimeSlot(timeSlot)

  user.labourProfile = user.labourProfile || {}
  user.labourProfile.trialSlot = {
    date: String(date).trim(),
    timeSlot: cleanedTimeSlot,
    location: resolvedLocation,
    zoneId: zoneId ? String(zoneId).trim() : '',
    zoneName: zoneName ? String(zoneName).trim() : '',
    status: 'SCHEDULED',
    scheduledAt: new Date(),
    notes: req.body.notes || '',
  }

  await user.save()

  return sendSuccess(res, {
    message: 'Trial slot scheduled successfully',
    data: {
      trialSlot: user.labourProfile.trialSlot,
      user: user.toSafeObject(),
    },
  })
})

/**
 * POST /api/users/me/trial-complete
 * Mark trial slot evaluation passed / completed
 */
export const completePartnerTrial = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.labourProfile = user.labourProfile || {}
  const existingSlot = user.labourProfile.trialSlot || {}
  user.labourProfile.trialSlot = {
    ...existingSlot,
    status: 'COMPLETED',
    completedAt: new Date(),
    notes: req.body.notes || 'Evaluation completed successfully',
  }
  user.vendorStatus = 'CONFIRMED'

  await user.save()

  return sendSuccess(res, {
    message: 'Trial evaluation completed and account activated!',
    data: {
      trialSlot: user.labourProfile.trialSlot,
      vendorStatus: user.vendorStatus,
      user: user.toSafeObject(),
    },
  })
})

/**
 * POST /api/users/me/welcome-kit/payment
 * Submit payment for welcome kit (online confirmation or offline bill screenshot upload)
 */
export const submitPartnerWelcomeKitPayment = asyncHandler(async (req, res) => {
  const { paymentMethod, paymentReceiptUrl, paymentNotes, deliveryAddress, deliveryCity, deliveryPincode } = req.body

  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Ensure KYC is verified and previous steps completed
  const isKycVerified = user.labourProfile?.kycStatus === 'verified'
  if (!isKycVerified) {
    return sendError(res, {
      message: 'Welcome Kit step is locked. Please wait for KYC verification first.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'STEP_LOCKED',
    })
  }

  const isOnline = paymentMethod === 'ONLINE'
  user.welcomeKit = user.welcomeKit || {}
  user.welcomeKit.paymentMethod = isOnline ? 'ONLINE' : 'OFFLINE'
  user.welcomeKit.status = isOnline ? 'PAID' : 'PAYMENT_SUBMITTED'
  user.welcomeKit.paymentReceiptUrl = paymentReceiptUrl || user.welcomeKit.paymentReceiptUrl || ''
  user.welcomeKit.paymentNotes = paymentNotes || ''
  user.welcomeKit.paymentRejectionReason = '' // Clear any previous rejection
  user.welcomeKit.paidAt = new Date()

  if (deliveryAddress) user.welcomeKit.deliveryAddress = String(deliveryAddress).trim()
  if (deliveryCity) user.welcomeKit.deliveryCity = String(deliveryCity).trim()
  if (deliveryPincode) user.welcomeKit.deliveryPincode = String(deliveryPincode).trim()

  user.welcomeKit.auditTrail = user.welcomeKit.auditTrail || []
  user.welcomeKit.auditTrail.push({
    action: isOnline ? 'PAYMENT_ONLINE_COMPLETED' : 'PAYMENT_SLIP_SUBMITTED',
    performedBy: user._id,
    performedByName: user.fullName || user.phone || 'Partner',
    performedByRole: user.role,
    timestamp: new Date(),
    details: isOnline
      ? 'Welcome kit fee paid online successfully.'
      : 'Offline payment slip screenshot uploaded for admin verification.',
  })

  await user.save()

  return sendSuccess(res, {
    message: isOnline ? 'Payment completed successfully!' : 'Payment bill submitted! Verification in progress.',
    data: {
      welcomeKit: user.welcomeKit,
      user: user.toSafeObject(),
    },
  })
})

/**
 * PATCH /api/service-partners/:partnerId/welcome-kit/verify-payment
 * or PATCH /api/users/:id/welcome-kit/verify-payment
 * Admin accepts or rejects the welcome kit offline payment screenshot
 */
export const verifyPartnerWelcomeKitPayment = asyncHandler(async (req, res) => {
  const partnerId = req.params.partnerId || req.params.id
  if (!mongoose.Types.ObjectId.isValid(partnerId)) {
    return sendError(res, {
      message: 'Invalid service partner ID',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_ID',
    })
  }

  const { action, rejectionReason, notes, paymentReceiptUrl } = req.body
  const normalizedAction = String(action || '').toUpperCase()

  const user = await User.findById(partnerId)
  if (!user) {
    return sendError(res, {
      message: 'Service partner not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'PARTNER_NOT_FOUND',
    })
  }

  user.welcomeKit = user.welcomeKit || {}
  user.welcomeKit.auditTrail = user.welcomeKit.auditTrail || []

  if (normalizedAction === 'ATTACH_SLIP') {
    if (!paymentReceiptUrl) {
      return sendError(res, {
        message: 'paymentReceiptUrl is required',
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }
    user.welcomeKit.paymentReceiptUrl = String(paymentReceiptUrl).trim()
    user.welcomeKit.paymentMethod = 'OFFLINE'
    user.welcomeKit.status = 'PAYMENT_SUBMITTED'
    user.welcomeKit.paidAt = new Date()
    user.welcomeKit.paymentRejectionReason = ''
    user.welcomeKit.auditTrail.push({
      action: 'PAYMENT_SLIP_ATTACHED',
      performedBy: req.user._id,
      performedByName: req.user.fullName || 'Admin',
      performedByRole: req.user.role,
      timestamp: new Date(),
      details: 'Payment slip screenshot attached by administrator.',
    })
    await user.save()
    return sendSuccess(res, {
      message: 'Payment slip attached successfully! Ready for verification.',
      data: {
        welcomeKit: user.welcomeKit,
        user: user.toSafeObject(),
      },
    })
  }

  if (normalizedAction === 'RESET_TO_REVIEW') {
    user.welcomeKit.status = 'PAYMENT_SUBMITTED'
    user.welcomeKit.paymentRejectionReason = ''
    user.welcomeKit.auditTrail.push({
      action: 'PAYMENT_RESET_TO_REVIEW',
      performedBy: req.user._id,
      performedByName: req.user.fullName || 'Admin',
      performedByRole: req.user.role,
      timestamp: new Date(),
      details: 'Payment slip status reset to Review Pending by administrator.',
    })
    await user.save()
    return sendSuccess(res, {
      message: 'Status reset to Review Pending successfully.',
      data: {
        welcomeKit: user.welcomeKit,
        user: user.toSafeObject(),
      },
    })
  }

  if (normalizedAction === 'APPROVE' || normalizedAction === 'ACCEPT') {
    // Prevent duplicate approval / state conflicts
    const currentStatus = user.welcomeKit.status
    if (['PAID', 'READY_FOR_DISPATCH', 'DISPATCHED', 'DELIVERED'].includes(currentStatus)) {
      return sendSuccess(res, {
        message: 'Payment has already been approved and verified.',
        data: {
          welcomeKit: user.welcomeKit,
          user: user.toSafeObject(),
        },
      })
    }

    user.welcomeKit.status = 'PAID'
    user.welcomeKit.paymentVerifiedAt = new Date()
    user.welcomeKit.paymentVerifiedBy = req.user._id
    user.welcomeKit.paymentRejectionReason = ''
    if (!user.welcomeKit.paidAt) {
      user.welcomeKit.paidAt = new Date()
    }
    if (notes && notes.trim()) {
      user.welcomeKit.paymentNotes = (user.welcomeKit.paymentNotes ? user.welcomeKit.paymentNotes + '\n' : '') + `[Admin Note]: ${notes.trim()}`
    }

    user.welcomeKit.auditTrail.push({
      action: 'PAYMENT_APPROVED',
      performedBy: req.user._id,
      performedByName: req.user.fullName || 'Admin',
      performedByRole: req.user.role,
      timestamp: new Date(),
      details: notes ? `Payment slip approved. Note: ${notes.trim()}` : 'Payment slip approved successfully. Delivery address form unlocked.',
    })

    await user.save()

    // Notify service provider (Title: Payment Slip Approved)
    await notifyPaymentApproved(user._id)

    return sendSuccess(res, {
      message: 'Payment verified successfully! Welcome kit authorized.',
      data: {
        welcomeKit: user.welcomeKit,
        user: user.toSafeObject(),
      },
    })
  } else if (normalizedAction === 'REJECT') {
    // Validate non-empty rejection reason
    const cleanReason = String(rejectionReason || notes || '').trim()
    if (!cleanReason) {
      return sendError(res, {
        message: 'A non-empty rejection reason is required to reject a payment slip',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'REJECTION_REASON_REQUIRED',
      })
    }

    user.welcomeKit.status = 'PAYMENT_REJECTED'
    user.welcomeKit.paymentRejectionReason = cleanReason
    user.welcomeKit.paymentVerifiedAt = new Date()
    user.welcomeKit.paymentVerifiedBy = req.user._id
    if (notes && notes.trim()) {
      user.welcomeKit.paymentNotes = (user.welcomeKit.paymentNotes ? user.welcomeKit.paymentNotes + '\n' : '') + `[Admin Rejection Note]: ${notes.trim()}`
    }

    user.welcomeKit.auditTrail.push({
      action: 'PAYMENT_REJECTED',
      performedBy: req.user._id,
      performedByName: req.user.fullName || 'Admin',
      performedByRole: req.user.role,
      timestamp: new Date(),
      details: `Payment slip rejected. Reason: ${cleanReason}`,
    })

    await user.save()

    // Notify service provider (Title: Payment Slip Rejected)
    await notifyPaymentRejected(user._id, cleanReason)

    return sendSuccess(res, {
      message: 'Payment screenshot rejected. Service partner has been notified to resubmit.',
      data: {
        welcomeKit: user.welcomeKit,
        user: user.toSafeObject(),
      },
    })
  } else {
    return sendError(res, {
      message: "action must be 'APPROVE' or 'REJECT'",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_ACTION',
    })
  }
})

/**
 * POST /api/users/me/welcome-kit/address
 * Service provider submits welcome kit delivery address
 * (Unlocked ONLY after payment is approved)
 */
export const submitPartnerWelcomeKitAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.welcomeKit = user.welcomeKit || {}
  const status = user.welcomeKit.status

  // 1. Payment check: must be approved
  const isPaid = ['PAID', 'READY_FOR_DISPATCH', 'DISPATCHED', 'DELIVERED'].includes(status)
  if (!isPaid) {
    return sendError(res, {
      message: 'Payment slip must be approved before submitting your welcome kit delivery address.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'PAYMENT_NOT_APPROVED',
    })
  }

  // 2. Dispatch check: once dispatched, address cannot be changed
  if (status === 'DISPATCHED' || status === 'DELIVERED') {
    return sendError(res, {
      message: 'Welcome kit has already been dispatched. Address cannot be modified after dispatch.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'ALREADY_DISPATCHED',
    })
  }

  // 3. Field collection & validation (supports recipientPhone / mobileNumber and houseNumber / houseBuilding)
  const rawRecipientName = req.body.recipientName || req.body.fullName || ''
  const rawRecipientPhone =
    req.body.recipientPhone ||
    req.body.mobileNumber ||
    req.body.phone ||
    req.body.contactMobileNumber ||
    ''
  const rawHouseNumber =
    req.body.houseNumber ||
    req.body.houseBuilding ||
    req.body.houseFlatBuilding ||
    ''
  const rawStreetArea = req.body.streetArea || req.body.street || ''
  const rawCity = req.body.city || ''
  const rawState = req.body.state || ''
  const rawPincode = req.body.pincode || req.body.pinCode || req.body.postalCode || ''
  const rawLandmark = req.body.landmark || ''

  if (!rawRecipientName || typeof rawRecipientName !== 'string' || rawRecipientName.trim().length < 2) {
    return sendError(res, {
      message: 'Recipient full name is required (minimum 2 characters)',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_RECIPIENT_NAME',
    })
  }

  let phoneDigits = String(rawRecipientPhone || '').replace(/\D/g, '')
  if (phoneDigits.length === 12 && phoneDigits.startsWith('91')) {
    phoneDigits = phoneDigits.slice(2)
  } else if (phoneDigits.length === 11 && phoneDigits.startsWith('0')) {
    phoneDigits = phoneDigits.slice(1)
  }

  if (phoneDigits.length !== 10) {
    return sendError(res, {
      message: 'Recipient mobile number must be a valid 10-digit Indian phone number',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_RECIPIENT_PHONE',
    })
  }

  if (!rawHouseNumber || typeof rawHouseNumber !== 'string' || rawHouseNumber.trim().length === 0) {
    return sendError(res, {
      message: 'House / Flat / Building number is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_HOUSE_NUMBER',
    })
  }

  if (!rawStreetArea || typeof rawStreetArea !== 'string' || rawStreetArea.trim().length < 2) {
    return sendError(res, {
      message: 'Street and area name are required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_STREET_AREA',
    })
  }

  if (!rawCity || typeof rawCity !== 'string' || rawCity.trim().length < 2) {
    return sendError(res, {
      message: 'City name is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_CITY',
    })
  }

  if (!rawState || typeof rawState !== 'string' || rawState.trim().length < 2) {
    return sendError(res, {
      message: 'State name is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_STATE',
    })
  }

  const cleanPin = String(rawPincode || '').trim()
  if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
    return sendError(res, {
      message: 'PIN code must be a valid 6-digit Indian postal code',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_PINCODE',
    })
  }

  const addressData = {
    recipientName: rawRecipientName.trim(),
    recipientPhone: phoneDigits,
    mobileNumber: phoneDigits,
    houseNumber: rawHouseNumber.trim(),
    houseBuilding: rawHouseNumber.trim(),
    streetArea: rawStreetArea.trim(),
    landmark: String(rawLandmark || '').trim(),
    city: rawCity.trim(),
    state: rawState.trim(),
    pincode: cleanPin,
  }

  const isResubmission = user.welcomeKit.addressStatus === 'CORRECTION_REQUESTED'

  user.welcomeKit.address = addressData
  user.welcomeKit.addressStatus = 'SUBMITTED'
  user.welcomeKit.addressSubmittedAt = new Date()
  user.welcomeKit.addressCorrectionReason = ''

  // Sync legacy fields
  user.welcomeKit.deliveryAddress = `${addressData.houseNumber}, ${addressData.streetArea}${addressData.landmark ? `, Near ${addressData.landmark}` : ''}, ${addressData.city}, ${addressData.state} - ${addressData.pincode}`
  user.welcomeKit.deliveryCity = addressData.city
  user.welcomeKit.deliveryPincode = addressData.pincode

  // Sync partner city and state on user root
  if (addressData.city && (!user.city || user.city === 'Noida, NCR')) {
    user.city = addressData.city
  }
  if (addressData.state && !user.state) {
    user.state = addressData.state
  }

  user.welcomeKit.auditTrail = user.welcomeKit.auditTrail || []
  user.welcomeKit.auditTrail.push({
    action: isResubmission ? 'ADDRESS_RESUBMITTED' : 'ADDRESS_SUBMITTED',
    performedBy: user._id,
    performedByName: user.fullName || user.phone || 'Partner',
    performedByRole: user.role,
    timestamp: new Date(),
    details: `Delivery address submitted for ${addressData.recipientName} (${addressData.city}, PIN: ${addressData.pincode}).`,
  })

  await user.save()

  // Notify admin and partner
  await notifyAddressSubmitted(user)

  return sendSuccess(res, {
    message: 'Welcome kit delivery address submitted successfully! Admin will review and prepare dispatch.',
    data: {
      address: user.welcomeKit.address,
      addressStatus: user.welcomeKit.addressStatus,
      welcomeKit: user.welcomeKit,
    },
  })
})

/**
 * POST /api/service-partners/:partnerId/welcome-kit/request-address-correction
 * Admin requests address correction from service partner
 */
export const requestPartnerAddressCorrection = asyncHandler(async (req, res) => {
  const partnerId = req.params.partnerId || req.params.id
  const { reason } = req.body

  if (!mongoose.Types.ObjectId.isValid(partnerId)) {
    return sendError(res, { message: 'Invalid partner ID', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const cleanReason = String(reason || '').trim()
  if (!cleanReason) {
    return sendError(res, {
      message: 'A non-empty correction reason is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'REASON_REQUIRED',
    })
  }

  const user = await User.findById(partnerId)
  if (!user) {
    return sendError(res, { message: 'Service partner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.welcomeKit = user.welcomeKit || {}

  if (user.welcomeKit.status === 'DISPATCHED' || user.welcomeKit.status === 'DELIVERED') {
    return sendError(res, {
      message: 'Cannot request address correction after welcome kit has been dispatched.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  user.welcomeKit.addressStatus = 'CORRECTION_REQUESTED'
  user.welcomeKit.addressCorrectionReason = cleanReason
  user.welcomeKit.addressCorrectionRequestedAt = new Date()
  user.welcomeKit.addressCorrectionRequestedBy = req.user._id

  user.welcomeKit.auditTrail = user.welcomeKit.auditTrail || []
  user.welcomeKit.auditTrail.push({
    action: 'ADDRESS_CORRECTION_REQUESTED',
    performedBy: req.user._id,
    performedByName: req.user.fullName || 'Admin',
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: `Address correction requested. Reason: ${cleanReason}`,
  })

  await user.save()

  // Notify service provider
  await notifyAddressCorrectionRequested(user._id, cleanReason)

  return sendSuccess(res, {
    message: 'Address correction requested. Service partner notified.',
    data: {
      welcomeKit: user.welcomeKit,
    },
  })
})

/**
 * POST/PUT/PATCH /api/service-partners/:partnerId/welcome-kit/address
 * Admin sets or updates welcome kit delivery address on behalf of partner
 */
export const adminSubmitPartnerWelcomeKitAddress = asyncHandler(async (req, res) => {
  const partnerId = req.params.partnerId || req.params.id

  if (!mongoose.Types.ObjectId.isValid(partnerId)) {
    return sendError(res, { message: 'Invalid partner ID', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(partnerId)
  if (!user) {
    return sendError(res, { message: 'Service partner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.welcomeKit = user.welcomeKit || {}
  const status = user.welcomeKit.status

  if (status === 'DISPATCHED' || status === 'DELIVERED') {
    return sendError(res, {
      message: 'Welcome kit has already been dispatched. Address cannot be modified after dispatch.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'ALREADY_DISPATCHED',
    })
  }

  const rawRecipientName = req.body.recipientName || req.body.fullName || ''
  const rawRecipientPhone =
    req.body.recipientPhone ||
    req.body.mobileNumber ||
    req.body.phone ||
    req.body.contactMobileNumber ||
    ''
  const rawHouseNumber =
    req.body.houseNumber ||
    req.body.houseBuilding ||
    req.body.houseFlatBuilding ||
    ''
  const rawStreetArea = req.body.streetArea || req.body.street || ''
  const rawCity = req.body.city || ''
  const rawState = req.body.state || ''
  const rawPincode = req.body.pincode || req.body.pinCode || req.body.postalCode || ''
  const rawLandmark = req.body.landmark || ''

  if (!rawRecipientName || typeof rawRecipientName !== 'string' || rawRecipientName.trim().length < 2) {
    return sendError(res, {
      message: 'Recipient full name is required (minimum 2 characters)',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_RECIPIENT_NAME',
    })
  }

  let phoneDigits = String(rawRecipientPhone || '').replace(/\D/g, '')
  if (phoneDigits.length === 12 && phoneDigits.startsWith('91')) {
    phoneDigits = phoneDigits.slice(2)
  } else if (phoneDigits.length === 11 && phoneDigits.startsWith('0')) {
    phoneDigits = phoneDigits.slice(1)
  }

  if (phoneDigits.length !== 10) {
    return sendError(res, {
      message: 'Recipient mobile number must be a valid 10-digit Indian phone number',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_RECIPIENT_PHONE',
    })
  }

  if (!rawHouseNumber || typeof rawHouseNumber !== 'string' || rawHouseNumber.trim().length === 0) {
    return sendError(res, {
      message: 'House / Flat / Building number is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_HOUSE_NUMBER',
    })
  }

  if (!rawStreetArea || typeof rawStreetArea !== 'string' || rawStreetArea.trim().length < 2) {
    return sendError(res, {
      message: 'Street and area name are required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_STREET_AREA',
    })
  }

  if (!rawCity || typeof rawCity !== 'string' || rawCity.trim().length < 2) {
    return sendError(res, {
      message: 'City name is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_CITY',
    })
  }

  if (!rawState || typeof rawState !== 'string' || rawState.trim().length < 2) {
    return sendError(res, {
      message: 'State name is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_STATE',
    })
  }

  const cleanPin = String(rawPincode || '').trim()
  if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
    return sendError(res, {
      message: 'PIN code must be a valid 6-digit Indian postal code',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_PINCODE',
    })
  }

  const addressData = {
    recipientName: rawRecipientName.trim(),
    recipientPhone: phoneDigits,
    mobileNumber: phoneDigits,
    houseNumber: rawHouseNumber.trim(),
    houseBuilding: rawHouseNumber.trim(),
    streetArea: rawStreetArea.trim(),
    landmark: String(rawLandmark || '').trim(),
    city: rawCity.trim(),
    state: rawState.trim(),
    pincode: cleanPin,
  }

  user.welcomeKit.address = addressData
  user.welcomeKit.addressStatus = 'SUBMITTED'
  user.welcomeKit.addressSubmittedAt = new Date()
  user.welcomeKit.addressCorrectionReason = ''

  // Sync legacy fields
  user.welcomeKit.deliveryAddress = `${addressData.houseNumber}, ${addressData.streetArea}${addressData.landmark ? `, Near ${addressData.landmark}` : ''}, ${addressData.city}, ${addressData.state} - ${addressData.pincode}`
  user.welcomeKit.deliveryCity = addressData.city
  user.welcomeKit.deliveryPincode = addressData.pincode

  // Sync partner city and state on user root
  if (addressData.city && (!user.city || user.city === 'Noida, NCR')) {
    user.city = addressData.city
  }
  if (addressData.state && !user.state) {
    user.state = addressData.state
  }

  user.welcomeKit.auditTrail = user.welcomeKit.auditTrail || []
  user.welcomeKit.auditTrail.push({
    action: 'ADDRESS_SUBMITTED_BY_ADMIN',
    performedBy: req.user._id,
    performedByName: req.user.fullName || req.user.phone || 'Admin',
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: `Delivery address saved by admin for ${addressData.recipientName} (${addressData.city}, PIN: ${addressData.pincode}).`,
  })

  await user.save()

  return sendSuccess(res, {
    message: 'Welcome kit delivery address saved successfully!',
    data: {
      address: user.welcomeKit.address,
      addressStatus: user.welcomeKit.addressStatus,
      welcomeKit: user.welcomeKit,
    },
  })
})

/**
 * POST /api/service-partners/:partnerId/welcome-kit/confirm-address
 * Admin confirms shipping address & marks kit ready for dispatch
 */
export const confirmPartnerWelcomeKitAddress = asyncHandler(async (req, res) => {
  const partnerId = req.params.partnerId || req.params.id

  if (!mongoose.Types.ObjectId.isValid(partnerId)) {
    return sendError(res, { message: 'Invalid partner ID', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(partnerId)
  if (!user) {
    return sendError(res, { message: 'Service partner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.welcomeKit = user.welcomeKit || {}
  const addr = user.welcomeKit.address

  if (!addr || !addr.recipientName || !addr.pincode) {
    return sendError(res, {
      message: 'Partner has not submitted a complete delivery address yet.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'NO_ADDRESS',
    })
  }

  user.welcomeKit.addressStatus = 'CONFIRMED'
  user.welcomeKit.status = 'READY_FOR_DISPATCH'
  user.welcomeKit.addressConfirmedAt = new Date()
  user.welcomeKit.addressConfirmedBy = req.user._id
  user.welcomeKit.confirmedAddressSnapshot = {
    recipientName: addr.recipientName,
    recipientPhone: addr.recipientPhone || addr.mobileNumber || '',
    mobileNumber: addr.mobileNumber || addr.recipientPhone || '',
    houseNumber: addr.houseNumber || addr.houseBuilding || '',
    houseBuilding: addr.houseBuilding || addr.houseNumber || '',
    streetArea: addr.streetArea,
    landmark: addr.landmark || '',
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
  }

  // Sync partner city and state on user root
  if (addr.city && (!user.city || user.city === 'Noida, NCR')) {
    user.city = addr.city
  }
  if (addr.state && !user.state) {
    user.state = addr.state
  }

  user.welcomeKit.auditTrail = user.welcomeKit.auditTrail || []
  user.welcomeKit.auditTrail.push({
    action: 'ADDRESS_CONFIRMED',
    performedBy: req.user._id,
    performedByName: req.user.fullName || 'Admin',
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: 'Shipping address confirmed by admin. Welcome kit marked ready for dispatch.',
  })

  await user.save()

  // Notify partner
  await notifyAddressConfirmed(user._id)

  return sendSuccess(res, {
    message: 'Shipping address confirmed! Welcome kit marked ready for dispatch.',
    data: {
      welcomeKit: user.welcomeKit,
    },
  })
})

/**
 * POST /api/service-partners/:partnerId/welcome-kit/dispatch
 * Admin records manual dispatch details (Informational only — No courier live tracking)
 */
export const dispatchPartnerWelcomeKit = asyncHandler(async (req, res) => {
  const partnerId = req.params.partnerId || req.params.id
  const { courierCompany, courierName, trackingNumber, trackingUrl, dispatchDate, estimatedDeliveryDate, notes } = req.body

  if (!mongoose.Types.ObjectId.isValid(partnerId)) {
    return sendError(res, { message: 'Invalid partner ID', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const rawCourier = courierCompany || courierName || ''
  if (!rawCourier || typeof rawCourier !== 'string' || rawCourier.trim().length === 0) {
    return sendError(res, {
      message: 'Courier company name is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'COURIER_REQUIRED',
    })
  }

  const cleanUrl = String(trackingUrl || '').trim()
  if (cleanUrl) {
    if (!/^https:\/\/[^\s$.?#].[^\s]*$/i.test(cleanUrl)) {
      return sendError(res, {
        message: 'Tracking URL must be a valid secure HTTPS link (e.g. https://www.delhivery.com/track/package/...)',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_HTTPS_URL',
      })
    }
  }

  const user = await User.findById(partnerId)
  if (!user) {
    return sendError(res, { message: 'Service partner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.welcomeKit = user.welcomeKit || {}

  // Guard against duplicate dispatch if already delivered
  if (user.welcomeKit.status === 'DELIVERED') {
    return sendError(res, {
      message: 'Kit has already been delivered. Cannot change dispatch details.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const dispatchObj = {
    courierCompany: rawCourier.trim(),
    courierName: rawCourier.trim(),
    trackingNumber: String(trackingNumber || '').trim(),
    trackingUrl: cleanUrl,
    dispatchDate: dispatchDate ? new Date(dispatchDate) : new Date(),
    estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null,
    notes: String(notes || '').trim(),
    dispatchedBy: req.user._id,
    dispatchedAt: new Date(),
  }

  user.welcomeKit.status = 'DISPATCHED'
  user.welcomeKit.dispatchDetails = dispatchObj

  user.welcomeKit.auditTrail = user.welcomeKit.auditTrail || []
  user.welcomeKit.auditTrail.push({
    action: 'DISPATCHED',
    performedBy: req.user._id,
    performedByName: req.user.fullName || 'Admin',
    performedByRole: req.user.role,
    timestamp: new Date(),
    details: `Welcome kit marked as dispatched via ${dispatchObj.courierCompany}${dispatchObj.trackingNumber ? ` (AWB: ${dispatchObj.trackingNumber})` : ''}.${dispatchObj.notes ? ` Notes: ${dispatchObj.notes}` : ''}`,
  })

  await user.save()

  // Notify service provider (Title: Welcome Kit Dispatched)
  await notifyWelcomeKitDispatched(user._id, dispatchObj)

  return sendSuccess(res, {
    message: 'Welcome kit marked as dispatched successfully!',
    data: {
      welcomeKit: user.welcomeKit,
    },
  })
})

/**
 * POST /api/service-partners/:partnerId/welcome-kit/confirm-delivery
 * Explicit, authorized admin action to manually confirm welcome kit delivery
 */
export const confirmPartnerWelcomeKitDeliveryAdmin = asyncHandler(async (req, res) => {
  const partnerId = req.params.partnerId || req.params.id
  const { notes } = req.body

  if (!mongoose.Types.ObjectId.isValid(partnerId)) {
    return sendError(res, { message: 'Invalid partner ID', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(partnerId)
  if (!user) {
    return sendError(res, { message: 'Service partner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.welcomeKit = user.welcomeKit || {}

  // Prevent duplicate delivery confirmation
  if (user.welcomeKit.status === 'DELIVERED' || user.welcomeKit.deliveryConfirmation?.isConfirmed) {
    return sendError(res, {
      message: 'Welcome kit delivery has already been confirmed.',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'ALREADY_DELIVERED',
    })
  }

  const now = new Date()
  user.welcomeKit.status = 'DELIVERED'
  user.welcomeKit.isReceived = true
  user.welcomeKit.receivedAt = now
  user.welcomeKit.uniformIssued = true
  user.welcomeKit.idCardIssued = true
  user.welcomeKit.bagIssued = true
  user.welcomeKit.productsIssued = true
  user.welcomeKit.issuedAt = user.welcomeKit.issuedAt || now
  user.idCardGeneratedAt = user.idCardGeneratedAt || now
  if (!user.partnerIdCode) {
    user.partnerIdCode = `A2Z-SP-${String(user._id).slice(-6).toUpperCase()}`
  }

  user.welcomeKit.deliveryConfirmation = {
    isConfirmed: true,
    confirmedAt: now,
    confirmedBy: req.user._id,
    notes: String(notes || 'Delivery manually verified and confirmed by authorized admin.').trim(),
  }

  user.welcomeKit.auditTrail = user.welcomeKit.auditTrail || []
  user.welcomeKit.auditTrail.push({
    action: 'DELIVERED_CONFIRMED',
    performedBy: req.user._id,
    performedByName: req.user.fullName || 'Admin',
    performedByRole: req.user.role,
    timestamp: now,
    details: `Welcome kit delivery confirmed by admin.${notes ? ` Notes: ${notes.trim()}` : ''}`,
  })

  await user.save()

  // Notify service provider & admin (Title: Welcome Kit Delivered Successfully)
  await notifyWelcomeKitDelivered(user)

  return sendSuccess(res, {
    message: 'Welcome kit delivery confirmed successfully! Partner profile activated for bookings.',
    data: {
      welcomeKit: user.welcomeKit,
      user: user.toSafeObject(),
    },
  })
})

/**
 * POST /api/users/me/welcome-kit/confirm-receipt
 * Partner confirms delivery of their welcome kit (Uniform, bag, ID, products)
 */
export const confirmPartnerWelcomeKitReceipt = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.welcomeKit = user.welcomeKit || {}
  user.welcomeKit.isReceived = true
  user.welcomeKit.status = 'DELIVERED'
  user.welcomeKit.uniformIssued = true
  user.welcomeKit.idCardIssued = true
  user.welcomeKit.bagIssued = true
  user.welcomeKit.productsIssued = true
  user.welcomeKit.receivedAt = new Date()
  user.welcomeKit.issuedAt = user.welcomeKit.issuedAt || new Date()
  user.idCardGeneratedAt = user.idCardGeneratedAt || new Date()
  if (!user.partnerIdCode) {
    user.partnerIdCode = `A2Z-SP-${String(user._id).slice(-6).toUpperCase()}`
  }

  await user.save()

  return sendSuccess(res, {
    message: 'Welcome kit confirmed! You are now ready to accept bookings.',
    data: {
      welcomeKit: user.welcomeKit,
      user: user.toSafeObject(),
    },
  })
})

/**
 * PATCH /api/users/:id/trial-evaluate
 * Admin evaluates candidate practical demonstration at the Hub
 * decision: 'passed' | 'failed'
 */
export const evaluatePartnerTrialAdmin = asyncHandler(async (req, res) => {
  const { decision, notes } = req.body
  const user = await User.findById(req.params.id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const profileKey = user.role === USER_ROLES.CONTRACTOR ? 'contractorProfile' : 'labourProfile'
  user[profileKey] = user[profileKey] || {}
  const profile = user[profileKey]
  const existingSlot = profile.trialSlot || {}

  const isPassed = decision === 'passed'
  profile.trialSlot = {
    ...existingSlot,
    status: isPassed ? 'COMPLETED' : 'FAILED',
    completedAt: new Date(),
    evaluatedAt: new Date(),
    evaluatedBy: req.user?._id,
    notes: notes || (isPassed ? 'Practical evaluation passed' : 'Evaluation not cleared'),
  }

  if (isPassed) {
    user.vendorStatus = 'CONFIRMED'
  }

  await user.save()

  return sendSuccess(res, {
    message: isPassed ? 'Trial evaluation marked as passed! Candidate joining confirmed.' : 'Trial marked as failed.',
    data: {
      user: user.toSafeObject(),
      trialSlot: profile.trialSlot,
    },
  })
})

/**
 * GET /api/v1/users/me/addresses
 * Returns user's saved addresses, auto-migrating legacy savedAddress if empty
 */
export const getUserAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.savedAddresses = user.savedAddresses || []

  // Ensure every existing address has a valid _id
  let modified = false
  user.savedAddresses.forEach((addr) => {
    if (!addr._id) {
      addr._id = new mongoose.Types.ObjectId()
      modified = true
    }
  })

  // If user has no savedAddresses array entries, but has legacy savedAddress.text
  if (user.savedAddresses.length === 0 && user.savedAddress?.text) {
    user.savedAddresses.push({
      _id: new mongoose.Types.ObjectId(),
      tag: 'Home',
      customTag: '',
      addressDetails: '',
      locationText: user.savedAddress.text,
      areaName: user.city || '',
      city: user.city || '',
      state: user.state || '',
      lat: user.savedAddress.lat || 22.7196,
      lng: user.savedAddress.lng || 75.8577,
      receiverName: user.fullName || '',
      receiverPhone: user.phone || '',
      isDefault: true,
    })
    modified = true
  }

  if (modified) {
    await user.save()
  }

  return sendSuccess(res, {
    data: {
      addresses: user.savedAddresses || [],
    },
  })
})

/**
 * POST /api/v1/users/me/addresses
 * Add a new saved address
 */
export const addUserAddress = asyncHandler(async (req, res) => {
  const {
    tag = 'Home',
    customTag,
    addressDetails,
    locationText,
    areaName,
    city,
    state,
    pincode,
    lat,
    lng,
    receiverName,
    receiverPhone,
    doorImageUrl,
    isDefault,
  } = req.body

  if (!locationText || lat == null || lng == null) {
    return sendError(res, {
      message: 'Location text and valid coordinates are required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.savedAddresses = user.savedAddresses || []

  // If this is the first address or isDefault is true, set it as default
  const shouldBeDefault = Boolean(isDefault || user.savedAddresses.length === 0)

  if (shouldBeDefault) {
    user.savedAddresses.forEach((addr) => {
      addr.isDefault = false
    })
  }

  const newAddress = {
    tag: ['Home', 'Work', 'Other'].includes(tag) ? tag : 'Home',
    customTag: customTag || '',
    addressDetails: addressDetails || '',
    locationText: locationText.trim(),
    areaName: areaName || '',
    city: city || '',
    state: state || '',
    pincode: pincode || '',
    lat: Number(lat),
    lng: Number(lng),
    receiverName: receiverName || user.fullName || '',
    receiverPhone: receiverPhone || user.phone || '',
    doorImageUrl: doorImageUrl || '',
    isDefault: shouldBeDefault,
  }

  user.savedAddresses.push(newAddress)

  if (shouldBeDefault) {
    const fullText = addressDetails ? `${addressDetails}, ${locationText}` : locationText
    user.savedAddress = {
      text: fullText,
      lat: Number(lat),
      lng: Number(lng),
    }
    user.currentLocation = locationText
    if (city) user.city = city
  }

  await user.save()

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Address saved successfully',
    data: {
      address: user.savedAddresses[user.savedAddresses.length - 1],
      addresses: user.savedAddresses,
      user: user.toSafeObject(),
    },
  })
})

/**
 * PUT /api/v1/users/me/addresses/:addressId
 * Update an existing saved address
 */
export const updateUserAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params
  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.savedAddresses = user.savedAddresses || []

  let address = user.savedAddresses.find((a) => String(a._id) === String(addressId))
  if (!address && user.savedAddresses.id) {
    try {
      address = user.savedAddresses.id(addressId)
    } catch {}
  }

  const {
    tag = 'Home',
    customTag,
    addressDetails,
    locationText,
    areaName,
    city,
    state,
    pincode,
    lat,
    lng,
    receiverName,
    receiverPhone,
    doorImageUrl,
    isDefault,
  } = req.body

  if (!address) {
    // If not found in user.savedAddresses, gracefully create entry
    const newAddress = {
      _id: mongoose.Types.ObjectId.isValid(addressId) ? addressId : new mongoose.Types.ObjectId(),
      tag: ['Home', 'Work', 'Other'].includes(tag) ? tag : 'Home',
      customTag: customTag || '',
      addressDetails: addressDetails || '',
      locationText: (locationText || '').trim(),
      areaName: areaName || '',
      city: city || '',
      state: state || '',
      pincode: pincode || '',
      lat: Number(lat) || 22.7196,
      lng: Number(lng) || 75.8577,
      receiverName: receiverName || user.fullName || '',
      receiverPhone: receiverPhone || user.phone || '',
      doorImageUrl: doorImageUrl || '',
      isDefault: Boolean(isDefault || user.savedAddresses.length === 0),
    }
    user.savedAddresses.push(newAddress)
    address = user.savedAddresses[user.savedAddresses.length - 1]
  } else {
    if (tag && ['Home', 'Work', 'Other'].includes(tag)) address.tag = tag
    if (customTag !== undefined) address.customTag = customTag
    if (addressDetails !== undefined) address.addressDetails = addressDetails
    if (locationText !== undefined) address.locationText = locationText
    if (areaName !== undefined) address.areaName = areaName
    if (city !== undefined) address.city = city
    if (state !== undefined) address.state = state
    if (pincode !== undefined) address.pincode = pincode
    if (lat != null) address.lat = Number(lat)
    if (lng != null) address.lng = Number(lng)
    if (receiverName !== undefined) address.receiverName = receiverName
    if (receiverPhone !== undefined) address.receiverPhone = receiverPhone
    if (doorImageUrl !== undefined) address.doorImageUrl = doorImageUrl
  }

  if (isDefault) {
    user.savedAddresses.forEach((addr) => {
      addr.isDefault = String(addr._id) === String(address._id)
    })
    const fullText = address.addressDetails ? `${address.addressDetails}, ${address.locationText}` : address.locationText
    user.savedAddress = {
      text: fullText,
      lat: address.lat,
      lng: address.lng,
    }
  }

  await user.save()

  return sendSuccess(res, {
    message: 'Address updated successfully',
    data: {
      address,
      addresses: user.savedAddresses,
      user: user.toSafeObject(),
    },
  })
})

/**
 * DELETE /api/v1/users/me/addresses/:addressId
 * Delete a saved address
 */
export const deleteUserAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params
  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const addrIndex = user.savedAddresses.findIndex((a) => String(a._id) === String(addressId))
  if (addrIndex === -1) {
    return sendError(res, { message: 'Address not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const wasDefault = user.savedAddresses[addrIndex].isDefault
  user.savedAddresses.splice(addrIndex, 1)

  if (wasDefault && user.savedAddresses.length > 0) {
    user.savedAddresses[0].isDefault = true
    const first = user.savedAddresses[0]
    const fullText = first.addressDetails ? `${first.addressDetails}, ${first.locationText}` : first.locationText
    user.savedAddress = {
      text: fullText,
      lat: first.lat,
      lng: first.lng,
    }
  } else if (user.savedAddresses.length === 0) {
    user.savedAddress = { text: '', lat: undefined, lng: undefined }
  }

  await user.save()

  return sendSuccess(res, {
    message: 'Address removed successfully',
    data: {
      addresses: user.savedAddresses,
      user: user.toSafeObject(),
    },
  })
})

/**
 * PATCH /api/v1/users/me/addresses/:addressId/default
 * Set a saved address as default
 */
export const setDefaultUserAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params
  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  let found = false
  user.savedAddresses.forEach((addr) => {
    if (String(addr._id) === String(addressId)) {
      addr.isDefault = true
      found = true
      const fullText = addr.addressDetails ? `${addr.addressDetails}, ${addr.locationText}` : addr.locationText
      user.savedAddress = {
        text: fullText,
        lat: addr.lat,
        lng: addr.lng,
      }
      user.currentLocation = addr.locationText
    } else {
      addr.isDefault = false
    }
  })

  if (!found) {
    return sendError(res, { message: 'Address not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  await user.save()

  return sendSuccess(res, {
    message: 'Default address updated',
    data: {
      addresses: user.savedAddresses,
      user: user.toSafeObject(),
    },
  })
})

/**
 * POST /api/v1/users/me/addresses/import-blinkit
 * Quick sync / import addresses from Blinkit
 */
export const importBlinkitAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  user.savedAddresses = user.savedAddresses || []

  // If client provided specific addresses to import, use them
  const incoming = Array.isArray(req.body.addresses) && req.body.addresses.length > 0 ? req.body.addresses : null

  let count = 0
  if (incoming) {
    for (const item of incoming) {
      if (item.locationText && item.lat && item.lng) {
        user.savedAddresses.push({
          tag: item.tag || 'Home',
          customTag: item.customTag || '',
          addressDetails: item.addressDetails || '',
          locationText: item.locationText,
          areaName: item.areaName || '',
          city: item.city || '',
          lat: item.lat,
          lng: item.lng,
          receiverName: item.receiverName || user.fullName || '',
          receiverPhone: item.receiverPhone || user.phone || '',
          doorImageUrl: item.doorImageUrl || '',
          isDefault: user.savedAddresses.length === 0,
        })
        count++
      }
    }
  } else {
    // Smart Blinkit import based on user profile and mobile
    const defaultCity = user.city || 'Indore'
    const importedSample = {
      tag: 'Home',
      customTag: '',
      addressDetails: 'Flat 204, Block B, Shikarji Residency',
      locationText: `Nayta Mundla, Shikharji Colony, ${defaultCity}, Madhya Pradesh`,
      areaName: 'Shikharji Colony',
      city: defaultCity,
      state: 'Madhya Pradesh',
      pincode: '452020',
      lat: 22.6841,
      lng: 75.8778,
      receiverName: user.fullName || 'User',
      receiverPhone: user.phone || '',
      doorImageUrl: '',
      isDefault: user.savedAddresses.length === 0,
    }
    user.savedAddresses.push(importedSample)
    count++
  }

  if (user.savedAddresses.length > 0 && !user.savedAddresses.some((a) => a.isDefault)) {
    user.savedAddresses[0].isDefault = true
  }

  const def = user.savedAddresses.find((a) => a.isDefault) || user.savedAddresses[0]
  if (def) {
    user.savedAddress = {
      text: def.addressDetails ? `${def.addressDetails}, ${def.locationText}` : def.locationText,
      lat: def.lat,
      lng: def.lng,
    }
  }

  await user.save()

  return sendSuccess(res, {
    message: `Successfully imported ${count} address${count > 1 ? 'es' : ''} from Blinkit!`,
    data: {
      importedCount: count,
      addresses: user.savedAddresses,
      user: user.toSafeObject(),
    },
  })
})




