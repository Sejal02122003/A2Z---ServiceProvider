import { NAME_MATCH_CONFIDENCE, PROHIBITED_NAME_TERMS } from '../constants/identityConstants.js'

/**
 * Common honorifics and titles to ignore during normalized comparison.
 * Must NOT be used to infer gender, only to strip prefixes during matching.
 */
const COMMON_HONORIFICS = new Set([
  'mr',
  'mrs',
  'ms',
  'miss',
  'dr',
  'prof',
  'shri',
  'shree',
  'smt',
  'shrimati',
  'km',
  'kumari',
])

/**
 * Validates a user-entered full name according to policy.
 * Supports Unicode, regional Indian scripts, spaces, hyphens, and apostrophes.
 * Rejects empty, numeric-only, control characters, excessively long, or prohibited names.
 */
export function validateName(rawName) {
  if (typeof rawName !== 'string') {
    return { isValid: false, reason: 'Name must be a valid text string' }
  }

  const trimmed = rawName.trim()

  if (!trimmed || trimmed.length < 2) {
    return { isValid: false, reason: 'Name must be at least 2 characters long' }
  }

  if (trimmed.length > 100) {
    return { isValid: false, reason: 'Name cannot exceed 100 characters' }
  }

  // Reject control characters (ASCII 0-31, 127)
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return { isValid: false, reason: 'Name contains invalid control characters' }
  }

  // Reject purely numeric or symbol-only names
  const withoutDigitsAndSymbols = trimmed.replace(/[\d\s\-'.]/g, '')
  if (!withoutDigitsAndSymbols) {
    return { isValid: false, reason: 'Name must contain letters and cannot be numeric-only' }
  }

  // Must contain at least one letter in any Unicode script (\p{L})
  const hasLetter = /\p{L}/u.test(trimmed)
  if (!hasLetter) {
    return { isValid: false, reason: 'Name must contain valid alphabetical characters' }
  }

  // Reject deceptive / prohibited / reserved system names
  const lower = trimmed.toLowerCase()
  for (const prohibited of PROHIBITED_NAME_TERMS) {
    if (lower === prohibited || lower.startsWith(`${prohibited} `) || lower.endsWith(` ${prohibited}`)) {
      return { isValid: false, reason: `The name '${trimmed}' is reserved or not allowed` }
    }
  }

  return { isValid: true, cleanName: trimmed }
}

/**
 * Normalizes a name for consistent comparison without altering the display name.
 * - Applies Unicode NFKC normalization
 * - Converts to lower-case
 * - Strips punctuation and accents
 * - Collapses whitespace
 * - Strips common non-discriminating honorifics
 */
export function normalizeName(name) {
  if (!name || typeof name !== 'string') return ''

  let normalized = name.normalize('NFKC').toLowerCase().trim()

  // Remove diacritics/accents
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Replace punctuation like dots, dashes, hyphens with spaces
  normalized = normalized.replace(/[-'.,_]/g, ' ')

  // Split into tokens
  const tokens = normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)

  // Filter out leading honorifics
  const filteredTokens = tokens.filter((t, idx) => {
    if (idx === 0 && COMMON_HONORIFICS.has(t)) return false
    return true
  })

  return filteredTokens.join(' ')
}

/**
 * Computes Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Computes Jaro-Winkler similarity (0 to 1)
 */
function jaroWinklerSimilarity(s1, s2) {
  let m = 0
  if (s1.length === 0 || s2.length === 0) return 0
  if (s1 === s2) return 1

  const range = Math.floor(Math.max(s1.length, s2.length) / 2) - 1
  const s1Matches = new Array(s1.length).fill(false)
  const s2Matches = new Array(s2.length).fill(false)

  for (let i = 0; i < s1.length; i++) {
    const low = i >= range ? i - range : 0
    const high = i + range <= s2.length - 1 ? i + range : s2.length - 1
    for (let j = low; j <= high; j++) {
      if (!s1Matches[i] && !s2Matches[j] && s1[i] === s2[j]) {
        m++
        s1Matches[i] = true
        s2Matches[j] = true
        break
      }
    }
  }

  if (m === 0) return 0

  let k = 0
  let numTransposed = 0
  for (let i = 0; i < s1.length; i++) {
    if (s1Matches[i]) {
      let j = k
      while (j < s2.length && !s2Matches[j]) j++
      if (j < s2.length && s1[i] !== s2[j]) {
        numTransposed++
      }
      k = j + 1
    }
  }

  const weight = (m / s1.length + m / s2.length + (m - numTransposed / 2) / m) / 3
  let l = 0
  const maxPrefix = 4
  while (s1[l] === s2[l] && l < maxPrefix) {
    l++
  }

  return weight + l * 0.1 * (1 - weight)
}

/**
 * Compares two names and calculates similarity score and confidence level.
 * Order-independent token matching accommodates "First Last" vs "Last First".
 * Returns score (0-100), confidence, isMatch boolean, and explanations.
 */
export function calculateNameSimilarity(submittedName, verifiedName) {
  const normSub = normalizeName(submittedName)
  const normVer = normalizeName(verifiedName)

  if (!normSub || !normVer) {
    return {
      score: 0,
      confidence: NAME_MATCH_CONFIDENCE.MISMATCH,
      isMatch: false,
      reasons: ['One or both names are empty or could not be normalized'],
    }
  }

  // Exact normalized match
  if (normSub === normVer) {
    return {
      score: 100,
      confidence: NAME_MATCH_CONFIDENCE.EXACT,
      isMatch: true,
      reasons: ['Exact name match'],
    }
  }

  const tokensSub = normSub.split(/\s+/).filter(Boolean)
  const tokensVer = normVer.split(/\s+/).filter(Boolean)

  // Token set match (e.g. "Rahul Kumar" vs "Kumar Rahul")
  const setSub = new Set(tokensSub)
  const setVer = new Set(tokensVer)
  const intersection = tokensSub.filter((t) => setVer.has(t))
  const union = new Set([...tokensSub, ...tokensVer])

  const tokenJaccard = (intersection.length / union.size) * 100
  if (tokenJaccard === 100) {
    return {
      score: 95,
      confidence: NAME_MATCH_CONFIDENCE.HIGH,
      isMatch: true,
      reasons: ['All name parts present (different word order)'],
    }
  }

  // Initial matching (e.g. "R. Kumar" vs "Rahul Kumar")
  const hasInitialMatch =
    tokensSub.some((s) => s.length === 1 && tokensVer.some((v) => v.startsWith(s))) ||
    tokensVer.some((v) => v.length === 1 && tokensSub.some((s) => s.startsWith(v)))

  // Jaro-Winkler string similarity
  const jwScore = Math.round(jaroWinklerSimilarity(normSub, normVer) * 100)

  // Levenshtein ratio
  const maxLen = Math.max(normSub.length, normVer.length)
  const levDist = levenshteinDistance(normSub, normVer)
  const levRatio = Math.round(((maxLen - levDist) / maxLen) * 100)

  // Composite weighted score
  let score = Math.round(jwScore * 0.6 + levRatio * 0.4)
  if (hasInitialMatch && score < 75) {
    score = Math.min(85, score + 15)
  }

  let confidence = NAME_MATCH_CONFIDENCE.LOW
  let isMatch = false
  const reasons = []

  if (score >= 88) {
    confidence = NAME_MATCH_CONFIDENCE.HIGH
    isMatch = true
    reasons.push('High similarity score with minor typographic or spacing difference')
  } else if (score >= 70) {
    confidence = NAME_MATCH_CONFIDENCE.MODERATE
    isMatch = true
    reasons.push('Moderate similarity — qualifies for standard verification')
  } else if (score >= 50) {
    confidence = NAME_MATCH_CONFIDENCE.LOW
    isMatch = false
    reasons.push('Partial similarity — requires user confirmation or manual review')
  } else {
    confidence = NAME_MATCH_CONFIDENCE.MISMATCH
    isMatch = false
    reasons.push('Significant discrepancy between submitted name and verified document')
  }

  return {
    score,
    confidence,
    isMatch,
    reasons,
  }
}
