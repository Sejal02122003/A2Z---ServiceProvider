import mongoose from 'mongoose'
import {
  DOCUMENT_TYPES,
  IDENTITY_PROVIDERS,
  IDENTITY_STATUS,
  NAME_MATCH_CONFIDENCE,
} from '../constants/identityConstants.js'

const identityVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      index: true,
    },
    // The preferred / user-entered display name
    submittedName: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      trim: true,
    },
    // The official name extracted and verified from documents or identity provider
    verifiedLegalName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(IDENTITY_STATUS),
      default: IDENTITY_STATUS.UNVERIFIED,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(IDENTITY_PROVIDERS),
      default: IDENTITY_PROVIDERS.MANUAL,
    },
    providerReference: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    documentType: {
      type: String,
      enum: Object.values(DOCUMENT_TYPES),
      default: DOCUMENT_TYPES.OTHER,
    },
    documentNumberMasked: {
      type: String,
      trim: true,
    },
    // Secured media references (never log or leak raw government ID numbers)
    documentUrls: [
      {
        type: String,
        maxlength: 2048,
      },
    ],
    nameMatchScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    nameMatchConfidence: {
      type: String,
      enum: Object.values(NAME_MATCH_CONFIDENCE),
      default: NAME_MATCH_CONFIDENCE.LOW,
    },
    riskScore: {
      type: Number,
      default: 0,
    },
    riskFlags: [
      {
        type: String,
        trim: true,
      },
    ],
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    appealNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    verifiedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
)

identityVerificationSchema.index({ userId: 1, createdAt: -1 })
identityVerificationSchema.index({ status: 1, role: 1 })
identityVerificationSchema.index({ normalizedName: 1 })

export const IdentityVerification = mongoose.model(
  'IdentityVerification',
  identityVerificationSchema
)
