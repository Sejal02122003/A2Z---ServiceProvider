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
    labourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    transactionId: {
      type: String,
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
        'CASH_BOOKING_SETTLEMENT',
        'COMMISSION_DEDUCTION',
        'PLATFORM_FEE_DEDUCTION',
        'GST_DEDUCTION',
        'WALLET_RECHARGE',
        'REVERSAL',
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
    chargesBreakdown: {
      commission: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      gst: { type: Number, default: 0 },
      totalDeducted: { type: Number, default: 0 },
    },
    referenceType: {
      type: String,
      enum: ['BOOKING', 'WELCOME_BONUS', 'ADMIN', 'MANUAL', 'WITHDRAWAL', 'REFUND', 'REVERSAL', 'PAYMENT', 'OTHER'],
      default: 'OTHER',
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction',
      index: true,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING', 'FAILED', 'REVERSED', 'PARTIAL'],
      default: 'COMPLETED',
    },
  },
  { timestamps: true }
)

// Index for audit trails and idempotency
walletTransactionSchema.index({ userId: 1, createdAt: -1 })
walletTransactionSchema.index({ labourId: 1, createdAt: -1 })
walletTransactionSchema.index({ referenceId: 1, context: 1 })
walletTransactionSchema.index({ bookingId: 1, context: 1 })

export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema)
