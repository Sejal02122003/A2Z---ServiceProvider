import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { USER_ROLES, KYC_STATUS } from '../constants/roles.js'
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
    kycFrontImageDataUrl: { type: String },
    kycBackImageDataUrl: { type: String },
    kycReviewNote: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
)

const welcomeKitSchema = new mongoose.Schema(
  {
    uniformIssued: { type: Boolean, default: false },
    idCardIssued: { type: Boolean, default: false },
    bagIssued: { type: Boolean, default: false },
    issuedAt: { type: Date, default: null },
  },
  { _id: false },
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
  if (!options.includeLabourKycImages && o.labourProfile) {
    const lp = { ...o.labourProfile }
    delete lp.kycFrontImageDataUrl
    delete lp.kycBackImageDataUrl
    delete lp.kycFrontImageUrl
    delete lp.kycBackImageUrl
    o.labourProfile = lp
  }
  if (!options.includeLabourKycImages && o.contractorProfile) {
    const cp = { ...o.contractorProfile }
    delete cp.kycFrontImageDataUrl
    delete cp.kycBackImageDataUrl
    delete cp.kycFrontImageUrl
    delete cp.kycBackImageUrl
    o.contractorProfile = cp
  }
  return o
}

export const User = mongoose.model('User', userSchema)
