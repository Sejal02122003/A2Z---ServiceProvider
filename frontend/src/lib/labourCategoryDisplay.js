import defaultCategoryImage from '../assets/default-category.svg'

/** Single bundled default shown when a category / subcategory / service has no (valid) image. */
export const DEFAULT_CATEGORY_IMAGE = defaultCategoryImage

/**
 * <img onError> handler: swap a broken image for the default (once, to avoid loops).
 * Usage: <img src={...} onError={onCategoryImgError} />
 */
export function onCategoryImgError(e) {
  const img = e.currentTarget
  if (img.dataset.fallbackApplied === '1') return
  img.dataset.fallbackApplied = '1'
  img.src = DEFAULT_CATEGORY_IMAGE
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
  const url = String(category?.imageUrl || category?.iconUrl || '').trim()
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
  return DEFAULT_CATEGORY_IMAGE
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
