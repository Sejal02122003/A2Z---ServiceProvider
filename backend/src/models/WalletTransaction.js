import mongoose from 'mongoose'

const walletTransactionSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    targetWallet: {
      type: String,
      enum: ['SELF', 'ADMIN', 'BANK'],
      default: 'SELF',
    },
    context: {
      type: String,
      enum: [
        'BOOKING',
        'CLEARANCE',
        'INCENTIVE',
        'PENALTY',
        'PAYOUT',
        'MANUAL',
        'WITHDRAWAL',
        'REFUND',
        'WELCOME_BONUS',
        'SERVICE_DISCOUNT',
        'ADMIN_ADJUSTMENT',
      ],
      required: true,
    },
    balanceBefore: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    referenceType: {
      type: String,
      enum: ['BOOKING', 'WELCOME_BONUS', 'ADMIN', 'MANUAL', 'WITHDRAWAL', 'REFUND', 'OTHER'],
      default: 'OTHER',
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING', 'FAILED'],
      default: 'COMPLETED',
    },
  },
  { timestamps: true }
)

// Index for audit trails and idempotency
walletTransactionSchema.index({ userId: 1, createdAt: -1 })
walletTransactionSchema.index({ referenceId: 1, context: 1 })

export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema)
