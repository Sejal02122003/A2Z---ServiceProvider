import mongoose from 'mongoose'

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    laborId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourSubcategory',
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourService',
      required: true,
    },
    type: {
      type: String,
      enum: ['INSTANT', 'SCHEDULED'],
      required: true,
    },
    date: {
      type: String,
    },
    scheduledAt: {
      type: Date,
    },
    timeSlot: {
      type: String,
    },
    endTime: {
      type: String,
    },
    images: {
      type: [String],
      default: []
    },
    notes: { 
      type: String, 
      trim: true 
    },
    durationKind: {
      type: String,
      enum: ['few_hours', 'full_day', 'multi_day'],
      default: 'few_hours'
    },
    hours: {
      type: Number,
      default: 1,
      min: 0.5 // supports 30-min (0.5) bookings
    },
    extraHours: {
      type: Number,
      default: 0
    },
    extraAmount: {
      type: Number,
      default: 0
    },
    maxHourDiscount: {
      type: Number,
      default: 0
    },
    address: {
      locationText: { type: String, required: true, trim: true },
      // Could add lat/lng for geospatial querying
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] },
      },
    },
    basePrice: { type: Number, required: true },
    platformFee: { type: Number, required: true, default: 0 },
    taxes: { type: Number, default: 0 },
    walletDiscount: {
      applied: { type: Boolean, default: false },
      amount: { type: Number, default: 0 },
      walletTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
    },
    totalAmount: { type: Number, required: true },
    commissionAmount: { type: Number, required: true, default: 0 },
    laborShare: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['ONLINE', 'CASH'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'REFUNDED'],
      default: 'PENDING',
    },
    adminSettlementStatus: {
      type: String,
      enum: ['PENDING', 'SETTLED'],
      default: 'PENDING',
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'CREATED',
        'BROADCASTING',
        'ACCEPTED',
        'ASSIGNED',
        'EN_ROUTE',
        'STARTED',
        'COMPLETED',
        'CANCELLED',
        'CANCELLATION_REQUESTED',
        'REFUNDED',
        'FAILED',
      ],
      default: 'CREATED',
      index: true,
    },
    cancellationRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookingCancellationRecord',
    },
    broadcastRadius: { type: Number },
    eligibleLabourCount: { type: Number, default: 0 },
    
    // Support for Bulk Bookings (Contractor)
    quantity: { type: Number, default: 1, min: 1 },
    acceptedLabourIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Keep single acceptedLabourId for simple customer queries
    acceptedLabourId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Per-labourer assignments details for bulk
    assignments: [{
      labourId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourService' },
      serviceName: { type: String },         // snapshot of service name at booking time
      pricePerHour: { type: Number, default: 0 }, // snapshot of rate at booking time
      labourShare: { type: Number, default: 0 },   // calculated at acceptance time
      status: {
        type: String,
        enum: ['ACCEPTED', 'EN_ROUTE', 'STARTED', 'COMPLETED', 'REJECTED', 'CANCELLED'],
        default: 'ACCEPTED'
      },
      startOtp: String,
      completionOtp: String,
      startWorkImage: String,
      endWorkImage: String,
      startedAt: Date,
      completedAt: Date,
      extraHours: { type: Number, default: 0 },
      extraAmount: { type: Number, default: 0 },
      cancellationReason: String,
      penaltyDeducted: { type: Number, default: 0 },
    }],
    
    // Contractor Specific Details
    contractorInfo: {
      companyName: String,
      gstNumber: String,
      projectName: String,
      siteContactNumber: String,
      services: [{
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourService' },
        quantity: Number,
        price: Number
      }]
    },
    
    // Cancellation & Bounce Penalty Meta
    cancelledBy: {
      type: String,
      enum: ['CUSTOMER', 'LABOUR', 'ADMIN', 'SYSTEM'],
    },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true },
    penaltyDeducted: { type: Number, default: 0 },

    // Legacy fields (kept for backward compatibility or simple 1-to-1 bookings)
    startedAt: { type: Date },
    startOtp: { type: String },
    completionOtp: { type: String },
    startWorkImage: { type: String },
    endWorkImage: { type: String },
  },
  { timestamps: true }
)

bookingSchema.index({ 'address.coordinates': '2dsphere' })

export const Booking = mongoose.model('Booking', bookingSchema)
