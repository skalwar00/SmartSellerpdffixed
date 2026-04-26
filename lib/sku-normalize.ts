/**
 * Shared SKU normalization helpers.
 *
 * Treats common size aliases as identical so that fuzzy matching, lookups,
 * and aggregation give the same result regardless of which form the seller
 * or portal used. The most important rule: XXL ≡ 2XL, XXXL ≡ 3XL, etc.
 */

const SIZE_ALIASES: Record<string, string> = {
  XXL: '2XL',
  XXXL: '3XL',
  XXXXL: '4XL',
  XXXXXL: '5XL',
  XXXXXXL: '6XL',
  XXXXXXXL: '7XL',
  XXXXXXXXL: '8XL',
  XXXXXXXXXL: '9XL',
  XXXXXXXXXXL: '10XL',
  FREESIZE: 'FREE',
  FREESZ: 'FREE',
  FS: 'FREE',
  ONESIZE: 'OS',
  ONE: 'OS',
}

/** Convert a single token (e.g. "XXL") to its canonical size form ("2XL"). */
export function canonicalSize(token: string): string {
  if (!token) return token
  const upper = token.toUpperCase()
  return SIZE_ALIASES[upper] ?? upper
}

/**
 * Replace any size-like token inside a SKU string with its canonical form,
 * preserving the rest of the string and its separators.
 *
 *  Whitespace is also stripped so that "white pant_3xl" and "whitepant_3xl"
 *  collapse to the same canonical key.
 *
 *  e.g. "BT001-MAROON-XXL"   -> "BT001-MAROON-2XL"
 *       "PT001-NAVY-XXXL"    -> "PT001-NAVY-3XL"
 *       "FK_PINK_XXXXL"      -> "FK_PINK_4XL"
 *       "BEIGE FREESIZE"     -> "BEIGEFREE"
 *       "white pant_3XL"     -> "whitepant_3XL"
 */
export function canonicalizeSku(sku: string): string {
  if (!sku) return sku
  return sku.replace(/\s+/g, '').replace(/[A-Za-z]+/g, (m) => {
    const upper = m.toUpperCase()
    if (upper in SIZE_ALIASES) return SIZE_ALIASES[upper]
    return m
  })
}

/** Tokenize a SKU on common separators and canonicalize each token. */
export function canonicalSkuTokens(sku: string): string[] {
  return sku
    .toUpperCase()
    .split(/[-_\s()+,/]+/)
    .filter(Boolean)
    .map(canonicalSize)
}

/**
 * Returns true if the token looks like a clothing size (e.g. S, M, L, XL, XS,
 * 2XL..10XL, FREE, OS, or a numeric size like 26..60). Used by combo-fuzzy
 * matching so that the size token is *not* removed from the residual when
 * suggesting the next combo half — the size is shared by all combo halves.
 *
 *   PT-CBO-WHITE+BLACK-6XL   →  half-1 picks  WHITE-6XL
 *                              residual = BLACK 6XL  (NOT just BLACK)
 *                              half-2 picks  BLACK-6XL  ✓ (not BLACK-3XL)
 */
export function isSizeToken(token: string): boolean {
  if (!token) return false
  const u = canonicalSize(token.toUpperCase())
  if (u === 'FREE' || u === 'OS' || u === 'XS' || u === 'S' || u === 'M' || u === 'L' || u === 'XL') return true
  if (/^\d+XL$/.test(u)) return true            // 2XL..10XL
  if (/^([2-9]\d|1\d\d?)$/.test(u)) return true // numeric sizes 10..199 (covers 26..60)
  return false
}
