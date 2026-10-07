import mongoose from 'mongoose'

const inventoryTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'STOCK_ADDED',
        'STOCK_REMOVED',
        'ISSUED_TO_VENDOR',
        'ALTERNATIVE_PRODUCT_ISSUED',
        'RETURNED_BY_VENDOR',
        'USED_BY_VENDOR',
        'STOCK_ADJUSTMENT',
      ],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaterialRequest',
      index: true,
    },
    originalProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
)

export function generateTransactionId() {
  return `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`
}

export const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema)
