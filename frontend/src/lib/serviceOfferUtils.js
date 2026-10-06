/**
 * Service offer and discount computation utilities
 */

/**
 * Computes discount, discounted price, savings, and display badges for a service.
 * @param {Object} service - Service object from API or database
 * @returns {Object} Computed offer details
 */
export function getServiceOfferDetails(service) {
  if (!service) {
    return {
      hasOffer: false,
      originalPrice: 0,
      discountedPrice: 0,
      savings: 0,
      discountType: 'PERCENTAGE',
      discountValue: 0,
      offerBadge: '',
      offerDescription: '',
      unitLabel: '/hr',
      displayPrice: '₹0',
      displayOriginalPrice: '₹0',
      displaySavings: '₹0',
    }
  }

  const originalPrice = Number(service.hourlyPrice ?? service.basePrice ?? 0)
  const discountType = service.discountType || 'PERCENTAGE'
  const discountValue = Number(service.discountValue || 0)
  const isHalfHour = service.minHours === 0.5
  const unitLabel = isHalfHour ? '/30min' : '/hr'
  const unitDivider = isHalfHour ? 2 : 1

  const hasOffer = discountValue > 0 && originalPrice > 0

  let discountedPrice = originalPrice
  if (hasOffer) {
    if (discountType === 'PERCENTAGE') {
      discountedPrice = Math.max(0, Math.round(originalPrice * (1 - discountValue / 100)))
    } else {
      discountedPrice = Math.max(0, originalPrice - discountValue)
    }
  }

  const savings = Math.max(0, originalPrice - discountedPrice)

  // Compute nice badge text
  let offerBadge = service.offerBadge
  if (!offerBadge && hasOffer) {
    offerBadge = discountType === 'PERCENTAGE' ? `${discountValue}% OFF` : `₹${discountValue} OFF`
  }

  const displayOriginalPrice = `₹${Math.round(originalPrice / unitDivider)}`
  const displayPrice = `₹${Math.round(discountedPrice / unitDivider)}`
  const displaySavings = `₹${Math.round(savings / unitDivider)}`

  return {
    hasOffer,
    originalPrice,
    discountedPrice,
    savings,
    discountType,
    discountValue,
    offerBadge: offerBadge || '',
    offerDescription: service.offerDescription || '',
    isHalfHour,
    unitLabel,
    displayPrice: `${displayPrice}${unitLabel}`,
    rawDisplayPrice: displayPrice,
    displayOriginalPrice,
    displaySavings,
  }
}
