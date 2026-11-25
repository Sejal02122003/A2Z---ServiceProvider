/**
 * Welcome Kit fee shown to a partner/admin.
 * - Not paid yet  -> the current fee set by admin (Settings → Welcome Kit Fee)
 * - Already paid  -> the amount locked in when they paid (later fee changes don't alter it)
 */
export function getWelcomeKitAmount(kit, currentFee = 999) {
  const paid = Boolean(kit?.paidAt) || (kit?.status && kit.status !== 'PENDING_PAYMENT')
  if (paid && Number.isFinite(Number(kit?.paymentAmount))) return Number(kit.paymentAmount)
  return Number(currentFee)
}
