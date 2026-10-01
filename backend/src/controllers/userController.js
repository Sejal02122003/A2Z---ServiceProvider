import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourCategoryGroup, LABOUR_GROUP_KIND } from '../models/LabourCategoryGroup.js'
import { KYC_STATUS, ROLE_LIST, USER_ROLES } from '../constants/roles.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { populateLabourCategories } from '../utils/populateLabourCategories.js'
import { isValidAadhaarLength, maskAadhaarLast4, normalizeAadhaar } from '../utils/aadhaar.js'
import { normalizeStoredMediaUrl } from '../utils/mediaUrl.js'

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
  return Boolean(lp?.kycVideoUrl?.trim())
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

  if (fullName != null) user.fullName = String(fullName).trim()
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

  const { services } = req.body
  const uniqueServices = []
  const uniqueSubcategoryIds = new Set()
  const uniqueServiceIds = []
  
  if (Array.isArray(services)) {
    const seen = new Set()
    for (const svc of services) {
      const sId = svc.serviceId || svc.subcategoryId // Fallback for backwards compatibility
      if (sId && !seen.has(String(sId))) {
        seen.add(String(sId))
        
        if (svc.serviceId) uniqueServiceIds.push(String(svc.serviceId))
        if (svc.subcategoryId) uniqueSubcategoryIds.add(String(svc.subcategoryId))
        
        uniqueServices.push({
          serviceId: svc.serviceId ? String(svc.serviceId) : undefined,
          subcategoryId: svc.subcategoryId ? String(svc.subcategoryId) : undefined,
          minPrice: Number(svc.minPrice) || 0,
          maxPrice: Number(svc.maxPrice) || 0,
        })
      }
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
  
  const servicesInDb = await LabourService.find({
    _id: { $in: uniqueServiceIds },
    isActive: true,
  })
  
  if (servicesInDb.length !== uniqueServiceIds.length && uniqueServiceIds.length > 0) {
    return sendError(res, {
      message: 'One or more services are invalid or inactive',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_SERVICES',
    })
  }

  const hasTrade = uniqueServices.length > 0
  if (!hasTrade) {
    return sendError(res, {
      message:
        'Choose at least one job type (for example plumber, electrician, or construction helper). Profile tags alone are not enough for worksite matching.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'TRADE_REQUIRED',
    })
  }

  const catIds = [...new Set(subcategories.map(s => String(s.categoryId?._id || s.categoryId)))]

  req.user.labourProfile = req.user.labourProfile || {}
  req.user.labourProfile.subcategoryIds = subcatIdArray
  req.user.labourProfile.categoryIds = catIds
  req.user.labourProfile.serviceIds = uniqueServiceIds
  req.user.labourProfile.servicePricing = uniqueServices
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

  const videoUrl = normalizeStoredMediaUrl(req.body.videoUrl)
  if (!videoUrl) {
    return sendError(res, {
      message: 'Record and upload a KYC video before submitting',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_KYC_VIDEO',
    })
  }

  const updateData = {
    [`${profileKey}.kycStatus`]: KYC_STATUS.PENDING,
    [`${profileKey}.kycVideoUrl`]: videoUrl,
    [`${profileKey}.kycVideoMeta`]: sanitizeKycVideoMeta(req.body.videoMeta),
    [`${profileKey}.kycSubmittedAt`]: new Date(),
  }
  if (hasAadhaarInput) updateData[`${profileKey}.aadhaarMasked`] = maskAadhaarLast4(normalizedAadhaar)
  if (hasPanInput) updateData[`${profileKey}.panMasked`] = maskPan(normalizedPan)

  req.user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateData, $unset: { [`${profileKey}.kycReviewNote`]: 1 } },
    { new: true, runValidators: false }
  )
  if (req.user.role === USER_ROLES.LABOUR) {
    await populateLabourCategories(req.user)
  }

  return sendSuccess(res, {
    message: 'KYC video submitted — an admin will review your Aadhaar and PAN shortly.',
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
        message: 'This user has not submitted a KYC video yet',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'NO_KYC_SUBMISSION',
      })
    }
    profile.kycStatus = KYC_STATUS.VERIFIED
    profile.kycReviewNote = undefined

    // Set Trial logic (only for labour for now, or both?)
    if (user.role === USER_ROLES.LABOUR) {
      const settings = await SystemSetting.findOne({ configKey: 'master_config' })
      const trialDays = settings?.freeTrialDays || 3
      const now = new Date()
      const trialEnds = new Date(now)
      trialEnds.setDate(now.getDate() + trialDays)
      
      profile.trialStartedAt = now
      profile.trialEndsAt = trialEnds
    }
  } else {
    profile.kycStatus = KYC_STATUS.FAILED
    profile.kycReviewNote = typeof note === 'string' ? note.trim().slice(0, 500) : ''
  }

  await user.save()
  if (user.role === USER_ROLES.LABOUR) {
    await populateLabourCategories(user)
  }

  return sendSuccess(res, {
    message: decision === 'approved' ? 'KYC approved' : 'KYC marked as rejected',
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
  const { search, role, status, kycStatus, freeTrialStatus, categoryId, location, kitStatus, page = 1, limit = 20 } = req.query
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
    if (kitStatus === 'complete') {
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
    if (!u.labourProfile) return u
    const lp = { ...u.labourProfile }
    delete lp.kycFrontImageDataUrl
    delete lp.kycBackImageDataUrl
    return { ...u, labourProfile: lp }
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

/** Admin: get one user (includes KYC document data URLs for review) */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  await populateLabourCategories(user)
  return sendSuccess(res, { data: { user: user.toSafeObject({ includeLabourKycImages: true }) } })
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
        body: body || 'This is a test notification from KaamExpert backend.',
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
    uniformIssued,
    idCardIssued,
    bagIssued,
    issuedAt,
  }

  await user.save()

  return sendSuccess(res, {
    message: 'Welcome kit updated successfully',
    data: {
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
    },
  })
})

