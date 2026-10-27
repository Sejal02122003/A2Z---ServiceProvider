import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { USER_ROLES, KYC_STATUS } from '../constants/roles.js'
import { IDENTITY_STATUS } from '../constants/identityConstants.js'
import { BILLING_MODE } from '../constants/workforceConstants.js'
const documentSchema = new mongoose.Schema(
  {
    documentType: { type: String, trim: true },
    label: { type: String, trim: true },
    url: { type: String, maxlength: 2048 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
)


const labourProfileSchema = new mongoose.Schema(
  {
    kycStatus: {
      type: String,
      enum: Object.values(KYC_STATUS),
      default: KYC_STATUS.PENDING,
    },
    aadhaarMasked: String,
    panMasked: String,
    /** When worker submitted Aadhaar/PAN video KYC for admin review */
    kycSubmittedAt: Date,
    /** Free trial tracking */
    trialStartedAt: Date,
    trialEndsAt: Date,
    /** Cloudinary video URL for manual Aadhaar + PAN review */
    kycVideoUrl: { type: String, maxlength: 2048 },
    kycVideoMeta: {
      publicId: { type: String, maxlength: 512 },
      resourceType: { type: String, maxlength: 32 },
      format: { type: String, maxlength: 32 },
      bytes: Number,
      duration: Number,
      uploadedAt: Date,
    },
    /** Cloudinary HTTPS URLs (preferred) */
    kycFrontImageUrl: { type: String, maxlength: 2048 },
    kycBackImageUrl: { type: String, maxlength: 2048 },
    /** Multi-document/photo uploads for KYC */
    kycDocumentUrls: [{ type: String, maxlength: 2048 }],
    /** Legacy base64 data URLs — kept for older submissions */
    kycFrontImageDataUrl: { type: String },
    kycBackImageDataUrl: { type: String },
    kycReviewNote: { type: String, trim: true, maxlength: 500 },
    /** @deprecated prefer categoryIds — kept for backward compatibility */
    skills: [{ type: String, trim: true }],
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategory' }],
    subcategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabourSubcategory' }],
    serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabourService' }],
    servicePricing: [
      {
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourService' },
        subcategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourSubcategory' },
        minPrice: { type: Number, min: 0 },
        maxPrice: { type: Number, min: 0 },
      }
    ],
    minAcceptedPrice: { type: Number, min: 0 },
    maxAcceptedPrice: { type: Number, min: 0 },
    experienceYears: { type: Number, min: 0 },
    availabilityStatus: {
      type: String,
      enum: ['available', 'busy', 'offline'],
      default: 'available',
    },
    schedule: {
      type: [
        {
          day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], required: true },
          startTime: { type: String, default: '09:00' },
          endTime: { type: String, default: '17:00' },
          isAvailable: { type: Boolean, default: true }
        }
      ],
      default: [
        { day: 'Monday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Tuesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Wednesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Thursday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Friday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Saturday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        { day: 'Sunday', startTime: '09:00', endTime: '17:00', isAvailable: false },
      ]
    },
    currentLatitude: { type: Number },
    currentLongitude: { type: Number },
    lastLocationUpdatedAt: { type: Date },
    trialSlot: {
      date: { type: String, trim: true },
      timeSlot: { type: String, trim: true },
      location: { type: String, trim: true },
      zoneId: { type: String, trim: true },
      zoneName: { type: String, trim: true },
      status: {
        type: String,
        enum: ['NOT_SCHEDULED', 'SCHEDULED', 'COMPLETED', 'PASSED', 'FAILED'],
        default: 'NOT_SCHEDULED',
      },
      scheduledAt: { type: Date },
      completedAt: { type: Date },
      notes: { type: String, trim: true },
    },
    lifetimeBroadcastsReceived: { type: Number, default: 0 },
    lifetimeBroadcastsAccepted: { type: Number, default: 0 },
  },
  { _id: false },
)

const contractorProfileSchema = new mongoose.Schema(
  {
    kycStatus: {
      type: String,
      enum: Object.values(KYC_STATUS),
      default: KYC_STATUS.PENDING,
    },
    aadhaarMasked: String,
    panMasked: String,
    kycSubmittedAt: Date,
    kycVideoUrl: { type: String, maxlength: 2048 },
    kycVideoMeta: {
      publicId: { type: String, maxlength: 512 },
      resourceType: { type: String, maxlength: 32 },
      format: { type: String, maxlength: 32 },
      bytes: Number,
      duration: Number,
      uploadedAt: Date,
    },
    kycFrontImageUrl: { type: String, maxlength: 2048 },
    kycBackImageUrl: { type: String, maxlength: 2048 },
    /** Multi-document/photo uploads for KYC */
    kycDocumentUrls: [{ type: String, maxlength: 2048 }],
    kycFrontImageDataUrl: { type: String },
    kycBackImageDataUrl: { type: String },
    kycReviewNote: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
)

const welcomeKitAddressSchema = new mongoose.Schema(
  {
    recipientName: { type: String, trim: true, default: '' },
    recipientPhone: { type: String, trim: true, default: '' },
    mobileNumber: { type: String, trim: true, default: '' },
    houseNumber: { type: String, trim: true, default: '' },
    houseBuilding: { type: String, trim: true, default: '' },
    streetArea: { type: String, trim: true, default: '' },
    landmark: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const welcomeKitDispatchSchema = new mongoose.Schema(
  {
    courierCompany: { type: String, trim: true, default: '' },
    trackingNumber: { type: String, trim: true, default: '' },
    trackingUrl: { type: String, trim: true, default: '' },
    dispatchDate: { type: Date, default: null },
    estimatedDeliveryDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dispatchedAt: { type: Date, default: null },
  },
  { _id: false },
)

const welcomeKitDeliveryConfirmationSchema = new mongoose.Schema(
  {
    isConfirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const welcomeKitAuditItemSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    performedByName: { type: String, default: '' },
    performedByRole: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    details: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
)

const welcomeKitSchema = new mongoose.Schema(
  {
    uniformIssued: { type: Boolean, default: false },
    idCardIssued: { type: Boolean, default: false },
    bagIssued: { type: Boolean, default: false },
    productsIssued: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'PAYMENT_SUBMITTED',
        'PAID',
        'PAYMENT_REJECTED',
        'READY_FOR_DISPATCH',
        'DISPATCHED',
        'DELIVERED',
      ],
      default: 'PENDING_PAYMENT',
    },
    paymentMethod: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'NONE'],
      default: 'NONE',
    },
    paymentAmount: { type: Number, default: 999 },
    paymentReceiptUrl: { type: String, maxlength: 2048 },
    paymentNotes: { type: String, trim: true },
    paymentRejectionReason: { type: String, trim: true, default: '' },
    paymentVerifiedAt: { type: Date, default: null },
    paymentVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paidAt: { type: Date, default: null },

    // Address Workflow
    addressStatus: {
      type: String,
      enum: ['NOT_SUBMITTED', 'SUBMITTED', 'CORRECTION_REQUESTED', 'CONFIRMED'],
      default: 'NOT_SUBMITTED',
    },
    address: {
      type: welcomeKitAddressSchema,
      default: () => ({}),
    },
    addressSubmittedAt: { type: Date, default: null },
    addressCorrectionReason: { type: String, trim: true, default: '' },
    addressCorrectionRequestedAt: { type: Date, default: null },
    addressCorrectionRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    addressConfirmedAt: { type: Date, default: null },
    addressConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    confirmedAddressSnapshot: {
      type: welcomeKitAddressSchema,
      default: null,
    },

    // Legacy fields for backward compatibility
    deliveryAddress: { type: String, trim: true },
    deliveryCity: { type: String, trim: true },
    deliveryPincode: { type: String, trim: true },

    // Dispatch Details (Informational, No Live Tracking)
    dispatchDetails: {
      type: welcomeKitDispatchSchema,
      default: () => ({}),
    },

    // Manual Delivery Confirmation (Admin only)
    deliveryConfirmation: {
      type: welcomeKitDeliveryConfirmationSchema,
      default: () => ({}),
    },

    isReceived: { type: Boolean, default: false },
    receivedAt: { type: Date, default: null },
    issuedAt: { type: Date, default: null },

    // Audit Trail
    auditTrail: {
      type: [welcomeKitAuditItemSchema],
      default: [],
    },
  },
  { _id: false },
)

const savedAddressItemSchema = new mongoose.Schema(
  {
    tag: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home',
    },
    customTag: { type: String, trim: true, default: '' },
    addressDetails: { type: String, trim: true, default: '' }, // e.g. Floor, Company name, Tower, Flat no.
    locationText: { type: String, trim: true, required: true }, // e.g. Inno EYE Office, Chhoti Gwaltol, Indore
    areaName: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    receiverName: { type: String, trim: true, default: '' },
    receiverPhone: { type: String, trim: true, default: '' },
    doorImageUrl: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
)

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      minlength: 10,
      maxlength: 10,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
    },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
      index: true,
    },
    fullName: { type: String, trim: true },
    /** Optional profile photo (https URL); shown in app header when set */
    profileImageUrl: { type: String, maxlength: 2048 },
    isActive: { type: Boolean, default: true },
    isPhoneVerified: { type: Boolean, default: false },
    lastLoginAt: Date,
    savedAddress: {
      text: { type: String, trim: true, maxlength: 500 },
      lat: Number,
      lng: Number
    },
    savedAddresses: {
      type: [savedAddressItemSchema],
      default: [],
    },
    permanentAddress: { type: String, trim: true },
    currentLocation: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    fcmTokens: {
      type: [String],
      default: []
    },
    fcmTokenMobile: {
      type: [String],
      default: []
    },
    welcomeKit: {
      type: welcomeKitSchema,
      default: () => ({
        uniformIssued: false,
        idCardIssued: false,
        bagIssued: false,
        issuedAt: null,
      }),
    },
    welcomeBonusCredited: {
      type: Boolean,
      default: false,
      index: true,
    },
    vendorStatus: {
      type: String,
      enum: [
        'NOT_STARTED',
        'TRIAL_ACTIVE',
        'TRIAL_PAUSED',
        'WARNING',
        'TRIAL_COMPLETED',
        'PENDING_ADMIN_CONFIRMATION',
        'ADMIN_REVIEW_REQUIRED',
        'CONFIRMED',
        'FINAL_FAILURE',
        'FINAL_CHANCE_PAYMENT_PENDING',
        'FINAL_CHANCE_PAYMENT_FAILED',
        'FINAL_CHANCE_ACTIVE',
        'BLOCKED',
        'REJECTED',
      ],
      default: 'NOT_STARTED',
      index: true,
    },
    identityStatus: {
      type: String,
      enum: Object.values(IDENTITY_STATUS),
      default: IDENTITY_STATUS.UNVERIFIED,
      index: true,
    },
    /** Generated Official Partner ID Code (e.g. A2Z-SP-XXXX) */
    partnerIdCode: {
      type: String,
      trim: true,
      index: true,
    },
    idCardGeneratedAt: {
      type: Date,
      default: null,
    },
    verifiedLegalName: {
      type: String,
      trim: true,
    },
    identityVerificationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IdentityVerification',
    },
    identityRiskScore: {
      type: Number,
      default: 0,
    },
    identityRiskFlags: {
      type: [String],
      default: [],
    },
    customerCancellationRestriction: {
      isRestricted: { type: Boolean, default: false, index: true },
      restrictedAt: { type: Date, default: null },
      restrictedUntil: { type: Date, default: null },
      restrictionReason: { type: String, trim: true },
      restrictedBy: { type: String, enum: ['SYSTEM_POLICY', 'ADMIN'], default: 'SYSTEM_POLICY' },
      adminNote: { type: String, trim: true },
      warningCount: { type: Number, default: 0 },
      lastWarningAt: { type: Date, default: null },
      lastWarningThreshold: { type: Number, default: 0 },
      history: [
        {
          action: { type: String, enum: ['RESTRICTED', 'UNRESTRICTED', 'WARNED', 'FLAGGED_FOR_REVIEW'] },
          reason: String,
          restrictedUntil: Date,
          performedBy: { type: String, enum: ['SYSTEM_POLICY', 'ADMIN'], default: 'SYSTEM_POLICY' },
          adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },
    welcomeBonusCredited: {
      type: Boolean,
      default: false,
      index: true,
    },
    welcomeBonusAmount: {
      type: Number,
      default: 0,
    },
    welcomeBonusCreditedAt: {
      type: Date,
      default: null,
    },
    labourProfile: labourProfileSchema,
    contractorProfile: contractorProfileSchema,
  },
  { timestamps: true },
)

userSchema.methods.comparePassword = async function comparePassword(plain) {
  if (!this.passwordHash) return false
  return bcrypt.compare(plain, this.passwordHash)
}

userSchema.methods.toSafeObject = function toSafeObject(options = {}) {
  const o = this.toObject({ virtuals: true })
  delete o.passwordHash

  // Safe backward compatibility for older accounts without identityStatus
  if (!o.identityStatus || o.identityStatus === IDENTITY_STATUS.UNVERIFIED) {
    if (o.labourProfile?.kycStatus === KYC_STATUS.VERIFIED || o.contractorProfile?.kycStatus === KYC_STATUS.VERIFIED) {
      o.identityStatus = IDENTITY_STATUS.VERIFIED
    } else if (o.isPhoneVerified) {
      o.identityStatus = IDENTITY_STATUS.CONTACT_VERIFIED
    } else {
      o.identityStatus = IDENTITY_STATUS.UNVERIFIED
    }
  }

  if (!options.includeLabourKycImages && o.labourProfile) {
    const lp = { ...o.labourProfile }
    delete lp.kycFrontImageDataUrl
    delete lp.kycBackImageDataUrl
    o.labourProfile = lp
  }
  if (!options.includeLabourKycImages && o.contractorProfile) {
    const cp = { ...o.contractorProfile }
    delete cp.kycFrontImageDataUrl
    delete cp.kycBackImageDataUrl
    o.contractorProfile = cp
  }

  // Ensure human-readable trial slot timing format
  if (o.labourProfile?.trialSlot?.timeSlot && typeof o.labourProfile.trialSlot.timeSlot === 'string') {
    if (o.labourProfile.trialSlot.timeSlot.includes('_')) {
      o.labourProfile.trialSlot = {
        ...o.labourProfile.trialSlot,
        timeSlot: o.labourProfile.trialSlot.timeSlot.split('_')[0].trim(),
      }
    }
  }
  if (o.contractorProfile?.trialSlot?.timeSlot && typeof o.contractorProfile.trialSlot.timeSlot === 'string') {
    if (o.contractorProfile.trialSlot.timeSlot.includes('_')) {
      o.contractorProfile.trialSlot = {
        ...o.contractorProfile.trialSlot,
        timeSlot: o.contractorProfile.trialSlot.timeSlot.split('_')[0].trim(),
      }
    }
  }

  // Ensure unique partnerIdCode is available for verified/registered service providers
  if (!o.partnerIdCode && o._id) {
    o.partnerIdCode = `A2Z-SP-${String(o._id).slice(-6).toUpperCase()}`
  }

  // Ensure city is populated from known partner location fields if empty
  if (!o.city || typeof o.city !== 'string' || !o.city.trim() || o.city.trim() === 'Noida, NCR') {
    const resolvedCity =
      o.welcomeKit?.confirmedAddressSnapshot?.city ||
      o.welcomeKit?.address?.city ||
      o.welcomeKit?.deliveryCity ||
      o.savedAddresses?.find((a) => a.isDefault && a.city?.trim())?.city ||
      o.savedAddresses?.find((a) => a.city?.trim())?.city ||
      o.currentLocation ||
      ''
    if (resolvedCity && resolvedCity.trim() && resolvedCity.trim() !== 'Noida, NCR') {
      o.city = resolvedCity.trim()
    }
  }

  return o
}

export const User = mongoose.model('User', userSchema)
