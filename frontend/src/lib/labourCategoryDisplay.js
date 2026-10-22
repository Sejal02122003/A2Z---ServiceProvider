/** Default tile art when admin has not uploaded an image yet. */
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=70',
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&q=70',
  'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&q=70',
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&q=70',
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=70',
  'https://images.unsplash.com/photo-1595846519845-68bb3376c517?w=400&q=70',
  'https://images.unsplash.com/photo-1581578731548-7f23fd20fb2a?w=400&q=70',
  'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&q=70',
]

function hashSeed(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Flatten active trade subcategories from grouped API response.
 * @param {Array} tradeGroups
 */
export function flattenTradeSubcategories(tradeGroups) {
  const items = []
  for (const g of tradeGroups || []) {
    for (const c of g.categories || []) {
      items.push({
        _id: c._id,
        name: c.name,
        slug: c.slug,
        subtitle: c.subtitle,
        imageUrl: c.imageUrl || '',
        sortOrder: c.sortOrder ?? 0,
        groupId: g._id,
        groupName: g.name,
        services: c.services || [],
      })
    }
  }
  return items.sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.name).localeCompare(String(b.name)))
}

export function getCategoryImageUrl(category) {
  const url = String(category?.imageUrl || '').trim()
  if (url.startsWith('data:image/') || url.startsWith('https://') || url.startsWith('http://')) {
    return url
  }
  if (url.startsWith('/')) {
    try {
      const origin = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5005/api/v1').origin
      return `${origin}${url}`
    } catch (e) {
      // ignore
    }
  }
  const key = String(category?.slug || category?.name || 'x')
  return FALLBACK_IMAGES[hashSeed(key) % FALLBACK_IMAGES.length]
}

/** Cover image for a trade group tile — group imageUrl, else first subcategory, else fallback. */
export function getGroupImageUrl(group) {
  const groupUrl = String(group?.imageUrl || '').trim()
  if (groupUrl.startsWith('data:image/') || groupUrl.startsWith('https://') || groupUrl.startsWith('http://')) {
    return groupUrl
  }
  if (groupUrl.startsWith('/')) {
    try {
      const origin = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5005/api/v1').origin
      return `${origin}${groupUrl}`
    } catch (e) {
      // ignore
    }
  }
  const cats = group?.categories || []
  const withImage = cats.find((c) => String(c?.imageUrl || '').trim())
  const pick = withImage || cats[0]
  if (pick) {
    return getCategoryImageUrl(pick)
  }
  return getCategoryImageUrl({ slug: group?.slug, name: group?.name })
}
