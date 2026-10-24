import { LabourCategoryGroup, LABOUR_GROUP_KIND } from '../models/LabourCategoryGroup.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'

/** GET /labour-categories/grouped — active catalogue for worker UI & admin */
export const listGrouped = asyncHandler(async (req, res) => {
  const { lat, lng, city, address } = req.query
  let userZoneId = null
  console.log('listGrouped hit! query:', req.query);

  const Zone = (await import('../models/Zone.js')).Zone

  if (city) {
    const zone = await Zone.findOne({
      isActive: true,
      city: { $regex: new RegExp(`^${city}$`, 'i') }
    }).lean()
    if (zone) {
      userZoneId = String(zone._id)
    }
  }
  
  if (!userZoneId && address) {
    // Fallback: Check if address contains the zone's city name
    const activeZones = await Zone.find({ isActive: true }).lean()
    const matchedZone = activeZones.find(z => address.toLowerCase().includes(z.city.toLowerCase()))
    if (matchedZone) {
      userZoneId = String(matchedZone._id)
    }
  }

  const categories = await LabourCategory.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean()

  const subcats = await import('../models/LabourSubcategory.js').then(m => m.LabourSubcategory.find({ isActive: true }).sort({ name: 1 }).lean())
  
  const serviceFilter = { isActive: true }
  if (userZoneId) {
    serviceFilter.$or = [
      { isAllZones: true },
      { "zones.zone": userZoneId }
    ]
  }
  
  const services = await import('../models/LabourService.js').then(m => m.LabourService.find(serviceFilter).sort({ name: 1 }).lean())

  const servicesBySubcat = new Map()
  for (const s of services) {
    const effectivePrice = Number(s.hourlyPrice || s.basePrice || s.pricePerUnit || 0)
    if (userZoneId && s.zones && s.zones.length > 0) {
      const zonePricing = s.zones.find(z => String(z.zone) === userZoneId)
      if (zonePricing && typeof zonePricing.price === 'number' && Number(zonePricing.price) > 0) {
        s.hourlyPrice = Number(zonePricing.price)
        s.basePrice = Number(zonePricing.price)
      } else {
        if (!s.hourlyPrice && effectivePrice) s.hourlyPrice = effectivePrice
        if (!s.basePrice && effectivePrice) s.basePrice = effectivePrice
      }
    } else {
      if (!s.hourlyPrice && effectivePrice) s.hourlyPrice = effectivePrice
      if (!s.basePrice && effectivePrice) s.basePrice = effectivePrice
    }

    if ((!s.hourlyPrice || s.hourlyPrice <= 0) && effectivePrice > 0) s.hourlyPrice = effectivePrice
    if ((!s.basePrice || s.basePrice <= 0) && effectivePrice > 0) s.basePrice = effectivePrice

    const k = String(s.subcategoryId)
    if (!servicesBySubcat.has(k)) servicesBySubcat.set(k, [])
    servicesBySubcat.get(k).push(s)
  }
  
  const subcatsByCat = new Map()
  for (const sc of subcats) {
    sc.services = servicesBySubcat.get(String(sc._id)) ?? []
    const k = String(sc.categoryId)
    if (!subcatsByCat.has(k)) subcatsByCat.set(k, [])
    subcatsByCat.get(k).push({
      _id: sc._id,
      name: sc.name,
      slug: sc.slug || sc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      subtitle: sc.description || '',
      imageUrl: sc.iconUrl || '',
      sortOrder: sc.sortOrder || 0,
      services: sc.services
    })
  }

  const data = {
    groups: categories.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      description: c.subtitle || '',
      helperText: '',
      kind: LABOUR_GROUP_KIND.TRADE, // Mock as trade so frontend picks it up
      sortOrder: c.sortOrder,
      imageUrl: c.imageUrl || '',
      gstPercentage: c.gstPercentage || 0,
      isGstActive: c.isGstActive !== false,
      categories: subcatsByCat.get(String(c._id)) ?? [],
    })),
    meta: {
      profileKind: LABOUR_GROUP_KIND.PROFILE,
      tradeKind: LABOUR_GROUP_KIND.TRADE,
    },
  }

  return sendSuccess(res, { data })
})
