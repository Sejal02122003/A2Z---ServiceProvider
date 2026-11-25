import { ServicePackage } from '../models/ServicePackage.js'

/**
 * Which providers get a package booking?
 *
 * Package inclusions are often plain names with no linked service, so a package is tied to its
 * category / subcategory instead. A provider offers a package when:
 *   - one of its inclusions is linked to a service the provider offers, OR
 *   - the package has a subcategory and the provider works in that subcategory, OR
 *   - the package has no subcategory and the provider works in the package's category.
 */
export async function resolvePackageScope(booking) {
  const pb = booking?.packageBooking
  if (!pb?.isPackage) return null
  let categoryId = pb.categoryId || null
  let subcategoryId = pb.subcategoryId || booking.subcategoryId || null
  if (!categoryId && pb.packageId) {
    const pkg = await ServicePackage.findById(pb.packageId).select('categoryId subcategoryId').lean()
    if (pkg) {
      categoryId = pkg.categoryId || null
      subcategoryId = pkg.subcategoryId || subcategoryId
    }
  }
  return {
    categoryId: categoryId ? String(categoryId) : null,
    subcategoryId: subcategoryId ? String(subcategoryId) : null,
  }
}

export function providerOffersPackage(labourProfile, scope, inclusions = []) {
  const serviceIds = (labourProfile?.serviceIds || []).map(String)
  const subIds = (labourProfile?.subcategoryIds || []).map(String)
  const catIds = (labourProfile?.categoryIds || []).map(String)

  const linked = (inclusions || []).map((inc) => (inc?.serviceId ? String(inc.serviceId) : '')).filter(Boolean)
  if (linked.length > 0 && linked.some((id) => serviceIds.includes(id))) return true

  if (!scope) return false
  if (scope.subcategoryId) return subIds.includes(scope.subcategoryId)
  if (scope.categoryId) return catIds.includes(scope.categoryId)
  return false
}
