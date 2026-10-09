import mongoose from 'mongoose'

const bookingCancellationSettingSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      default: 'master_cancellation_config',
      unique: true,
      index: true,
    },
    // Master Switch
    enabled: {
      type: Boolean,
      default: true,
    },
    // Cutoff in hours before service start time
    cutoffHours: {
      type: Number,
      default: 2,
      min: 0,
    },
    // Penalty calculation type: FIXED amount or PERCENTAGE of booking value
    penaltyType: {
      type: String,
      enum: ['FIXED', 'PERCENTAGE'],
      default: 'FIXED',
    },
    // Fixed penalty amount in INR (when penaltyType is FIXED)
    fixedPenaltyAmount: {
      type: Number,
      default: 200,
      min: 0,
    },
    // Percentage penalty rate (when penaltyType is PERCENTAGE)
    percentagePenaltyRate: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },
    // Action when cancellation occurs within cutoff (< cutoffHours remaining)
    lateCancellationAction: {
      type: String,
      enum: ['PENALIZE', 'REQUIRE_APPROVAL', 'BLOCK'],
      default: 'PENALIZE',
    },
    // Whether vendor is required to select/enter a cancellation reason
    requireReason: {
      type: Boolean,
      default: true,
    },
    // Configured standard reasons list
    allowedReasons: {
      type: [String],
      default: [
        'Emergency / Medical Issue',
        'Health or Personal Issue',
        'Vehicle Breakdown / Transport Issue',
        'Scheduling Conflict / Double Booked',
        'Unable to reach service location',
        'Customer Unreachable / Fake Address (Report Bogus)',
        'Customer Requested Cancellation',
        'Other',
      ],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const BookingCancellationSetting = mongoose.model(
  'BookingCancellationSetting',
  bookingCancellationSettingSchema
)
