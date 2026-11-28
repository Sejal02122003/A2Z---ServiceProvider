/**
 * Central charge calculation & role-applicability resolver for Platform Fee, GST, and Commission.
 * Supports independent toggles for User (added to Customer bill) and Service Provider (deducted from Provider share).
 */

function toCleanNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clampPct(value, fallback = 0) {
  return Math.max(0, Math.min(100, toCleanNumber(value, fallback)))
}

/**
 * Normalize raw SystemSetting document into explicit role flags without breaking legacy records.
 */
export function resolveChargeConfig(settingsDoc) {
  const s = settingsDoc?.toObject ? settingsDoc.toObject() : (settingsDoc || {})
  const pf = s.platformFee || {}
  const gst = s.gst || {}
  const comm = s.commission || {}

  const pfApplyToUser =
    pf.applyToUser !== undefined
      ? Boolean(pf.applyToUser)
      : pf.isActive !== undefined
        ? Boolean(pf.isActive)
        : true
  const pfApplyToProvider =
    pf.applyToProvider !== undefined ? Boolean(pf.applyToProvider) : false

  const gstApplyToUser =
    gst.applyToUser !== undefined
      ? Boolean(gst.applyToUser)
      : gst.isActive !== undefined
        ? Boolean(gst.isActive)
        : true
  const gstApplyToProvider =
    gst.applyToProvider !== undefined ? Boolean(gst.applyToProvider) : false
  const gstDefaultPct = clampPct(gst.defaultPercentage ?? s.gstPercentage ?? 0, 0)

  const commApplyToUser =
    comm.applyToUser !== undefined ? Boolean(comm.applyToUser) : false
  const commApplyToProvider =
    comm.applyToProvider !== undefined
      ? Boolean(comm.applyToProvider)
      : comm.isActive !== undefined
        ? Boolean(comm.isActive)
        : true

  return {
    platformFee: {
      type: pf.type === 'percentage' ? 'percentage' : 'fixed',
      value: Math.max(0, toCleanNumber(pf.value, 0)),
      isActive: pfApplyToUser || pfApplyToProvider,
      applyToUser: pfApplyToUser,
      applyToProvider: pfApplyToProvider,
    },
    gst: {
      defaultPercentage: gstDefaultPct,
      isActive: gstApplyToUser || gstApplyToProvider,
      applyToUser: gstApplyToUser,
      applyToProvider: gstApplyToProvider,
    },
    commission: {
      type: comm.type || 'global',
      globalPercentage: clampPct(comm.globalPercentage ?? 10, 10),
      isActive: commApplyToUser || commApplyToProvider,
      applyToUser: commApplyToUser,
      applyToProvider: commApplyToProvider,
    },
  }
}

/**
 * Resolve effective GST percentage from category with global default fallback.
 * Note: global GST role toggles act as master switches in computeBookingCharges.
 */
export function resolveCategoryGstPercentage(category, settingsDocOrConfig) {
  const config =
    settingsDocOrConfig?.gst?.defaultPercentage !== undefined
      ? settingsDocOrConfig
      : resolveChargeConfig(settingsDocOrConfig)
  const fallbackPct = config.gst.defaultPercentage

  if (!category) return fallbackPct
  if (category.isGstActive === false) return 0
  const catPct = toCleanNumber(category.gstPercentage, 0)
  return catPct > 0 ? catPct : fallbackPct
}

/**
 * Calculate user-billed and provider-deducted charges for a booking.
 * - Customer pays: basePrice + platformFee + taxes + userCommissionAmount
 * - Service Provider earns (laborShare): basePrice - commissionAmount - providerPlatformFee - providerTaxes
 */
export function computeBookingCharges({
  basePrice,
  settings,
  gstPercentage = 0,
  rawGstAmount = null,
}) {
  const safeBase = Math.max(0, toCleanNumber(basePrice, 0))
  const config = resolveChargeConfig(settings)

  const rawPlatformFee =
    config.platformFee.type === 'fixed'
      ? config.platformFee.value
      : (safeBase * config.platformFee.value) / 100

  const platformFee = config.platformFee.applyToUser ? rawPlatformFee : 0
  const providerPlatformFee = config.platformFee.applyToProvider ? rawPlatformFee : 0

  const baseGst =
    rawGstAmount !== null && rawGstAmount !== undefined
      ? Math.max(0, toCleanNumber(rawGstAmount, 0))
      : gstPercentage > 0
        ? (safeBase * gstPercentage) / 100
        : 0

  const taxes = config.gst.applyToUser ? baseGst : 0
  const providerTaxes = config.gst.applyToProvider ? baseGst : 0

  const baseCommission =
    config.commission.type === 'global'
      ? (safeBase * config.commission.globalPercentage) / 100
      : 0

  const userCommissionAmount = config.commission.applyToUser ? baseCommission : 0
  const commissionAmount = config.commission.applyToProvider ? baseCommission : 0

  const totalAmount = safeBase + platformFee + taxes + userCommissionAmount
  const totalProviderDeductions =
    commissionAmount + providerPlatformFee + providerTaxes
  const laborShare = Math.round(Math.max(0, safeBase - totalProviderDeductions))

  const effectiveGstPct =
    safeBase > 0 && baseGst > 0
      ? Math.round((baseGst / safeBase) * 10000) / 100
      : clampPct(gstPercentage || config.gst.defaultPercentage, 0)

  return {
    config,
    rawPlatformFee,
    baseGst,
    baseCommission,
    platformFee,
    taxes,
    userCommissionAmount,
    totalAmount,
    providerPlatformFee,
    providerTaxes,
    commissionAmount,
    totalProviderDeductions,
    laborShare,
    chargeConfigSnapshot: {
      platformFee: {
        applyToUser: config.platformFee.applyToUser,
        applyToProvider: config.platformFee.applyToProvider,
        type: config.platformFee.type,
        value: config.platformFee.value,
      },
      gst: {
        applyToUser: config.gst.applyToUser,
        applyToProvider: config.gst.applyToProvider,
        percentage: effectiveGstPct,
      },
      commission: {
        applyToUser: config.commission.applyToUser,
        applyToProvider: config.commission.applyToProvider,
        percentage: config.commission.globalPercentage,
      },
    },
  }
}

/**
 * Total platform charges (user-billed collected in cash + provider-side deductions)
 * that Admin recovers when settling a cash booking or auditing collections.
 */
export function getBookingTotalAdminRecovery(booking) {
  if (!booking) return 0
  return (
    Math.max(0, toCleanNumber(booking.platformFee, 0)) +
    Math.max(0, toCleanNumber(booking.providerPlatformFee, 0)) +
    Math.max(0, toCleanNumber(booking.taxes, 0)) +
    Math.max(0, toCleanNumber(booking.providerTaxes, 0)) +
    Math.max(0, toCleanNumber(booking.commissionAmount, 0)) +
    Math.max(0, toCleanNumber(booking.userCommissionAmount, 0))
  )
}
