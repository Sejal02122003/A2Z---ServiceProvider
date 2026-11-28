/**
 * Dropdown suggestions for the central inventory product form.
 * These are starting points only: every field also accepts a typed value.
 */

// [product name, unit of measure]
const CATALOG = [
  {
    category: 'AC & Refrigeration',
    code: 'ACC',
    products: [
      ['AC Cleaner Foam Spray', 'Can'],
      ['AC Gas Refill R32', 'Kg'],
      ['AC Gas Refill R410A', 'Kg'],
      ['AC Copper Pipe', 'Meter'],
      ['AC Capacitor', 'Piece'],
      ['AC Drain Pipe', 'Meter'],
      ['AC Outdoor Unit Stand', 'Set'],
      ['AC Pipe Insulation Tape', 'Roll'],
    ],
  },
  {
    category: 'Home Appliances',
    code: 'APP',
    products: [
      ['Washing Machine Inlet Pipe', 'Piece'],
      ['Washing Machine Drain Pipe', 'Piece'],
      ['Refrigerator Thermostat', 'Piece'],
      ['Geyser Heating Element', 'Piece'],
      ['Geyser Thermostat', 'Piece'],
      ['RO Filter Cartridge', 'Set'],
      ['RO Membrane', 'Piece'],
      ['Chimney Degreaser Spray', 'Bottle'],
    ],
  },
  {
    category: 'Electrical',
    code: 'ELC',
    products: [
      ['Electrical Wire 1.5 sq mm', 'Meter'],
      ['Electrical Wire 2.5 sq mm', 'Meter'],
      ['Modular Switch', 'Piece'],
      ['Power Socket', 'Piece'],
      ['MCB', 'Piece'],
      ['LED Bulb', 'Piece'],
      ['Fan Regulator', 'Piece'],
      ['Insulation Tape', 'Roll'],
    ],
  },
  {
    category: 'Plumbing',
    code: 'PLB',
    products: [
      ['PVC Pipe', 'Meter'],
      ['CPVC Elbow Joint', 'Piece'],
      ['Water Tap', 'Piece'],
      ['Angle Valve', 'Piece'],
      ['Flexible Connection Pipe', 'Piece'],
      ['Teflon Tape', 'Roll'],
      ['Silicone Sealant', 'Tube'],
      ['Flush Tank Repair Kit', 'Set'],
    ],
  },
  {
    category: 'Cleaning',
    code: 'CLN',
    products: [
      ['Floor Cleaner Liquid', 'Liter'],
      ['Bathroom Cleaner', 'Liter'],
      ['Glass Cleaner Spray', 'Bottle'],
      ['Kitchen Degreaser', 'Bottle'],
      ['Disinfectant Spray', 'Bottle'],
      ['Microfiber Cloth', 'Pack'],
      ['Scrub Pad', 'Pack'],
      ['Garbage Bags', 'Pack'],
    ],
  },
  {
    category: 'Salon & Beauty',
    code: 'SAL',
    products: [
      ['Waxing Strips', 'Pack'],
      ['Body Wax', 'Jar'],
      ['Facial Kit', 'Set'],
      ['Hair Color', 'Tube'],
      ['Hair Spa Cream', 'Jar'],
      ['Shampoo', 'Bottle'],
      ['Disposable Towel', 'Pack'],
      ['Beard Oil', 'Bottle'],
    ],
  },
  {
    category: 'Painting',
    code: 'PNT',
    products: [
      ['Interior Wall Paint', 'Liter'],
      ['Wall Primer', 'Liter'],
      ['Wall Putty', 'Kg'],
      ['Paint Roller', 'Piece'],
      ['Paint Brush', 'Piece'],
      ['Sand Paper', 'Sheet'],
      ['Masking Tape', 'Roll'],
    ],
  },
  {
    category: 'Carpentry',
    code: 'CRP',
    products: [
      ['Wood Adhesive', 'Kg'],
      ['Door Hinge', 'Pair'],
      ['Door Lock', 'Piece'],
      ['Drawer Channel', 'Pair'],
      ['Wood Screws', 'Box'],
      ['Door Handle', 'Piece'],
    ],
  },
  {
    category: 'Pest Control',
    code: 'PST',
    products: [
      ['Cockroach Gel', 'Tube'],
      ['Termite Control Chemical', 'Liter'],
      ['General Insecticide', 'Liter'],
      ['Rodent Bait', 'Packet'],
      ['Mosquito Larvicide', 'Bottle'],
    ],
  },
]

const UNITS = [
  'Piece', 'Pair', 'Set', 'Pack', 'Packet', 'Box', 'Bag', 'Bottle', 'Can', 'Jar', 'Tube', 'Sachet',
  'Roll', 'Sheet', 'Meter', 'Feet', 'Liter', 'Milliliter', 'Kg', 'Gram',
]

const PRICES = [0, 50, 100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 3000, 5000]

export const UNIT_OPTIONS = UNITS.map((value) => ({ value }))
export const PRICE_OPTIONS = PRICES.map((value) => ({ value, label: `₹${value.toLocaleString('en-IN')}` }))

const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
const findGroup = (category) => CATALOG.find((g) => sameText(g.category, category))

/** Preset categories plus any already used by saved products */
export function getCategoryOptions(savedCategories = []) {
  const names = ['General', ...CATALOG.map((g) => g.category)]
  savedCategories.forEach((c) => {
    if (c && !names.some((n) => sameText(n, c))) names.push(c)
  })
  return names.map((value) => ({ value }))
}

export const findProductByName = (name, products = []) => products.find((p) => sameText(p.name, name))

/**
 * Product names of the chosen category: saved products first (if `includeSaved`), then preset ones not yet saved.
 * General lists every category, and so does a custom category that has nothing to show of its own.
 */
export function getProductNameOptions(category, savedProducts = [], { includeSaved = false } = {}) {
  const group = findGroup(category)
  const showAll = !category?.trim() || sameText(category, 'General')

  const saved = includeSaved
    ? savedProducts
        .filter((p) => showAll || sameText(p.category, category))
        // One entry per name
        .filter((p, i, list) => findProductByName(p.name, list) === p)
        .map((p) => ({
          value: p.name,
          hint: `Added · ${p.currentStock ?? 0} ${p.unit}`,
          unit: p.unit,
          category: p.category,
        }))
    : []

  if (!group && !showAll && saved.length) return saved

  const presets = (group ? [group] : CATALOG).flatMap((g) =>
    g.products
      .filter(([name]) => !findProductByName(name, savedProducts))
      .map(([name, unit]) => ({ value: name, hint: group ? unit : g.category, unit, category: g.category })),
  )
  return [...saved, ...presets]
}

const categoryCode = (category) =>
  findGroup(category)?.code ||
  String(category || '').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() ||
  'GEN'

/** First unused SKU such as PRD-ACC-01 */
export function nextSku(category, savedProducts = []) {
  const used = new Set(savedProducts.map((p) => String(p.sku || '').toUpperCase()))
  const prefix = `PRD-${categoryCode(category)}-`
  let n = 1
  while (used.has(`${prefix}${String(n).padStart(2, '0')}`)) n += 1
  return `${prefix}${String(n).padStart(2, '0')}`
}

/** The next free SKU of the chosen category first, then those of the other categories */
export function getSkuOptions(category, savedProducts = []) {
  const categories = [category || 'General', 'General', ...CATALOG.map((g) => g.category)]
  const seen = new Set()
  return categories.reduce((options, c) => {
    const value = nextSku(c, savedProducts)
    if (!seen.has(value)) {
      seen.add(value)
      options.push({ value, hint: c })
    }
    return options
  }, [])
}
