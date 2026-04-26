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
 *  e.g. "BT001-MAROON-XXL"   -> "BT001-MAROON-2XL"
 *       "PT001-NAVY-XXXL"    -> "PT001-NAVY-3XL"
 *       "FK_PINK_XXXXL"      -> "FK_PINK_4XL"
 *       "BEIGE FREESIZE"     -> "BEIGE FREE"
 */
export function canonicalizeSku(sku: string): string {
  if (!sku) return sku
  return sku.replace(/[A-Za-z]+/g, (m) => {
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
