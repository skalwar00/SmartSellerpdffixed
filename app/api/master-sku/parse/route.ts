import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { canonicalizeSku, canonicalSize } from '@/lib/sku-normalize'

// Sizes ordered longest-first to avoid partial matches (e.g. XL before 2XL)
const SIZES_DETECT = [
  'FREESIZE', 'FREE-SIZE', 'FREESZ',
  'XXXXL', 'XXXL', '10XL', '9XL', '8XL', '7XL', '6XL', '5XL', '4XL', '3XL', 'XXL', '2XL', 'XL',
  'FS', 'XS', 'L', 'M', 'S',
  '60', '58', '56', '54', '52', '50', '48', '46', '44', '42', '40', '38', '36', '34', '32', '30', '28', '26',
]

// Display order for sizes in the UI: FREESIZE first, then XS→10XL, then numeric sizes
export const SIZE_CATALOG = [
  'FREESIZE', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL',
  '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL',
  '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60',
]

function extractBaseAndSize(sku: string): { base: string; size: string } | null {
  const upper = sku.toUpperCase()
  for (const sz of SIZES_DETECT) {
    if (upper.endsWith('-' + sz) || upper.endsWith('_' + sz)) {
      const baseEnd = sku.length - sz.length - 1
      const base = sku.slice(0, baseEnd).replace(/[-_]+$/, '') // strip any trailing separators
      return { base, size: canonicalSize(sz.toUpperCase()) }
    }
  }
  // Fallback: 1-3 digit numeric suffix (covers shoe sizes, kids sizes, waist 50/52, etc.
  // not in the static list). Capped at 3 digits to avoid stripping style numbers like "STYLE-1234".
  const numericMatch = upper.match(/[-_](\d{1,3})$/)
  if (numericMatch) {
    const sz = numericMatch[1]
    const baseEnd = sku.length - sz.length - 1
    const base = sku.slice(0, baseEnd).replace(/[-_]+$/, '')
    return { base, size: sz }
  }
  return null
}

function normalizeForFuzzy(sku: string): string {
  return canonicalizeSku(
    sku
      .toUpperCase()
      .replace(/^(FK[-_]?|MY[-_]?|MN[-_]?|MEE[-_]?|FLP[-_]?|MEESHO[-_]?)/i, '')
      .replace(/[-_\s]/g, '')
  )
}

function skuTokens(sku: string): string[] {
  return canonicalizeSku(sku.toUpperCase())
    .split(/[-_\s]+/)
    .map(t => t.trim())
    // Filter out known sizes AND any short numeric token (1-3 digits) that's likely a size
    .filter(t => t && !SIZES_DETECT.includes(t) && !/^\d{1,3}$/.test(t))
}

function styleNumber(token: string | undefined): string {
  return token?.match(/\d+$/)?.[0] || ''
}

/** Simple Levenshtein edit distance */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
    }
  }
  return dp[n]
}

/**
 * Returns true if two attribute tokens are similar enough to be considered a match.
 * Handles typos like PINNK→PINK (edit distance ≤ 2 for tokens ≥ 4 chars)
 * and substring cases like LIGHTPINK→PINK.
 */
function tokensSimilar(a: string, b: string): boolean {
  if (a === b) return true
  // Substring: one contains the other (e.g. LIGHTPINK contains PINK)
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return true
  // Fuzzy: edit distance ≤ 2 for tokens of meaningful length
  if (a.length >= 4 && b.length >= 4 && editDistance(a, b) <= 2) return true
  return false
}

function scoreSkuSimilarity(baseSku: string, candidateSku: string): number {
  const baseNorm = normalizeForFuzzy(baseSku)
  const candidateNorm = normalizeForFuzzy(candidateSku)
  if (!baseNorm || !candidateNorm) return 0
  if (baseNorm === candidateNorm) return 1

  const shorter = candidateNorm.length < baseNorm.length ? candidateNorm : baseNorm
  const longer = candidateNorm.length >= baseNorm.length ? candidateNorm : baseNorm
  let bestScore = 0

  if (shorter.length >= 3 && longer.includes(shorter)) {
    bestScore = Math.max(bestScore, shorter.length / longer.length)
  }

  const baseTokens = skuTokens(baseSku)
  const candidateTokens = skuTokens(candidateSku)
  const baseStyle = baseTokens[0]
  const candidateStyle = candidateTokens[0]

  if (baseStyle && candidateStyle && baseStyle === candidateStyle && baseStyle.length >= 3) {
    bestScore = Math.max(bestScore, 0.82)
  }

  const baseStyleNumber = styleNumber(baseStyle)
  const candidateStyleNumber = styleNumber(candidateStyle)
  if (
    baseStyleNumber &&
    candidateStyleNumber &&
    baseStyleNumber === candidateStyleNumber &&
    baseStyleNumber.length >= 3
  ) {
    // Compare non-style tokens (color, fabric, etc.) — tokens after the first one
    // Uses fuzzy tokensSimilar to handle typos like PINNK→PINK
    const baseAttribs = baseTokens.slice(1)
    const candAttribs = candidateTokens.slice(1)
    const sharedAttribs = baseAttribs.filter(t => candAttribs.some(c => tokensSimilar(t, c)))

    if (sharedAttribs.length > 0) {
      // Style number matches AND at least one attribute (e.g. color) also matches
      bestScore = Math.max(bestScore, 0.88)
    } else if (baseAttribs.length > 0 && candAttribs.length > 0) {
      // Style number matches but attributes explicitly differ (color mismatch)
      bestScore = Math.max(bestScore, 0.58)
    } else {
      // Style number matches, no attribute info available — neutral match
      bestScore = Math.max(bestScore, 0.72)
    }
  }

  // Bonus: any shared full tokens (including style token) — needs at least 2
  const sharedTokens = baseTokens.filter(t => candidateTokens.includes(t))
  if (sharedTokens.length >= 2) {
    bestScore = Math.max(bestScore, 0.72)
  }

  return bestScore
}

const SKU_EXCLUSIONS = new Set([
  'FSN',
  'FLIPKART SERIAL NUMBER',
  'INTERNAL SKU ID',
])

function normalizeLabel(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function isInstructionText(value: string): boolean {
  const normalized = normalizeLabel(value)
  return normalized.length > 80 ||
    /\b(TEXT|LIMITED|CHARACTERS|INCLUDING SPACES|IDENTIFICATION NUMBER|MAINTAINED BY SELLER|KEEP TRACK|WILL BE MAPPED)\b/.test(normalized)
}

function findSkuColumn(headers: string[]): number {
  const SKU_PREFERRED_EXACT = [
    'LISTING SKU', 'SELLER SKU', 'SELLER SKU ID', 'SELLER SKU ID OPTIONAL', 'SELLER SKU CODE',
    'SKU CODE', 'SKU ID', 'PORTAL SKU', 'PRODUCT SKU', 'ITEM SKU',
    'SKU', 'FSN SKU',
  ]
  const SKU_FALLBACK_EXACT = [
    'STYLE ID', 'STYLE CODE',
  ]
  const hNormalized = headers.map(normalizeLabel)

  for (const name of SKU_PREFERRED_EXACT) {
    const idx = hNormalized.indexOf(name)
    if (idx >= 0) return idx
  }
  for (let i = 0; i < hNormalized.length; i++) {
    const h = hNormalized[i]
    if (isInstructionText(h)) continue
    if (h.startsWith('SKU') && !h.includes('DATE') && !SKU_EXCLUSIONS.has(h)) return i
  }
  for (let i = 0; i < hNormalized.length; i++) {
    const h = hNormalized[i]
    if (isInstructionText(h)) continue
    if (h.includes('SKU') && !h.includes('DATE') && !SKU_EXCLUSIONS.has(h)) return i
  }
  for (const name of SKU_FALLBACK_EXACT) {
    const idx = hNormalized.indexOf(name)
    if (idx >= 0) return idx
  }
  return -1
}

function findHeaderRow(rows: string[][]): { rowIndex: number; skuIdx: number } {
  const scanLimit = Math.min(rows.length, 15)
  for (let i = 0; i < scanLimit; i++) {
    const skuIdx = findSkuColumn(rows[i])
    if (skuIdx >= 0) return { rowIndex: i, skuIdx }
  }
  return { rowIndex: 0, skuIdx: -1 }
}

function findImageColumn(headers: string[]): number {
  const IMG_EXACT = ['IMAGE URL', 'IMAGE_URL', 'PRODUCT IMAGE URL', 'PRODUCT IMAGE', 'IMAGE', 'IMG URL', 'ITEM IMAGE']
  const hUpper = headers.map(h => h.trim().toUpperCase())
  for (const name of IMG_EXACT) {
    const idx = hUpper.indexOf(name)
    if (idx >= 0) return idx
  }
  for (let i = 0; i < hUpper.length; i++) {
    if (hUpper[i].includes('IMAGE') || hUpper[i].includes('IMG')) return i
  }
  return -1
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const selectedSheet = formData.get('sheetName') as string | null

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let rows: string[][] = []
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.csv')) {
      const text = new TextDecoder('utf-8').decode(buffer)
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
      rows = text.split('\n').filter(l => l.trim()).map(parseCSVLine)
    } else {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetNames = workbook.SheetNames

      // If multi-sheet and no sheet selected yet, return the sheet list for the user to pick
      if (sheetNames.length > 1 && !selectedSheet) {
        return NextResponse.json({ sheets: sheetNames })
      }

      const targetSheet = selectedSheet && sheetNames.includes(selectedSheet)
        ? selectedSheet
        : sheetNames[0]

      const sheet = workbook.Sheets[targetSheet]
      const rawData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
      rows = rawData.map(r => r.map(c => String(c ?? '')))
    }

    if (rows.length < 2) return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 })

    const { rowIndex: headerRowIndex, skuIdx } = findHeaderRow(rows)
    const headers = rows[headerRowIndex]
    if (skuIdx < 0) return NextResponse.json({ error: 'Could not find a SKU column. Make sure your file has a column named SKU.' }, { status: 400 })

    const imgIdx = findImageColumn(headers)

    const skuImagePairs: { sku: string; imageUrl: string }[] = []
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]
      const rawSku = row[skuIdx]?.trim()
      if (!rawSku || /^\d{10,}$/.test(rawSku) || isInstructionText(rawSku)) continue // skip empty, timestamp-like, or template instruction rows
      // Strip trailing separators that can appear as catalog template artifacts (e.g. "PANT001-")
      const sku = rawSku.replace(/[-_]+$/, '')
      if (!sku) continue
      const imageUrl = imgIdx >= 0 ? (row[imgIdx]?.trim() || '') : ''
      skuImagePairs.push({ sku, imageUrl })
    }

    if (skuImagePairs.length === 0) return NextResponse.json({ error: 'No valid SKUs found in file' }, { status: 400 })

    // Fetch existing data
    const [{ data: existingMappings }, { data: existingInventory }] = await Promise.all([
      supabase.from('sku_mapping').select('portal_sku, master_sku').eq('user_id', user.id),
      supabase.from('master_inventory').select('id, master_sku, image_url').eq('user_id', user.id),
    ])

    const mappedPortalSkus = new Set((existingMappings || []).map(m => m.portal_sku.toUpperCase()))
    const inventorySkus = existingInventory || []
    const activeMasterSkus = new Set(inventorySkus.map(inv => inv.master_sku.trim().toUpperCase()))
    const suggestionCandidates = new Map<string, { displaySku: string; matchSkus: Set<string> }>()
    const addSuggestionCandidate = (displaySku: string | null | undefined, matchSku: string | null | undefined) => {
      const display = displaySku?.trim().toUpperCase()
      const match = matchSku?.trim()
      if (!display || !match) return
      if (!suggestionCandidates.has(display)) {
        suggestionCandidates.set(display, { displaySku: display, matchSkus: new Set() })
      }
      suggestionCandidates.get(display)!.matchSkus.add(match)
    }

    for (const inv of inventorySkus) {
      addSuggestionCandidate(inv.master_sku, inv.master_sku)
      const invBase = extractBaseAndSize(inv.master_sku)?.base
      if (invBase) addSuggestionCandidate(inv.master_sku, invBase)
    }

    for (const mapping of existingMappings || []) {
      if (!activeMasterSkus.has(mapping.master_sku.trim().toUpperCase())) continue
      addSuggestionCandidate(mapping.master_sku, mapping.master_sku)
      addSuggestionCandidate(mapping.master_sku, mapping.portal_sku)
      const mappedBase = extractBaseAndSize(mapping.portal_sku)?.base
      if (mappedBase) addSuggestionCandidate(mapping.master_sku, mappedBase)
    }

    // Group by base design
    type DesignEntry = { portalSkus: string[]; sizes: string[]; imageUrl: string; unmappedCount: number }
    const designMap = new Map<string, DesignEntry>()

    for (const { sku, imageUrl } of skuImagePairs) {
      const extracted = extractBaseAndSize(sku) || { base: sku, size: '' }
      const key = extracted.base.toUpperCase()

      if (!designMap.has(key)) {
        designMap.set(key, { portalSkus: [], sizes: [], imageUrl: '', unmappedCount: 0 })
      }
      const group = designMap.get(key)!
      if (!group.portalSkus.includes(sku)) group.portalSkus.push(sku)
      if (extracted.size && !group.sizes.includes(extracted.size)) group.sizes.push(extracted.size)
      if (!group.imageUrl && imageUrl) group.imageUrl = imageUrl
      if (!mappedPortalSkus.has(sku.toUpperCase())) group.unmappedCount++
    }

    // Fuzzy match each base design against active master inventory and valid saved mappings
    const designs = []
    for (const [baseKey, group] of designMap) {
      let suggestedMasterSku: string | undefined
      let bestScore = 0

      for (const candidate of suggestionCandidates.values()) {
        for (const matchSku of candidate.matchSkus) {
          const score = scoreSkuSimilarity(baseKey, matchSku)
          if (score > bestScore) {
            bestScore = score
            suggestedMasterSku = candidate.displaySku
          }
        }
      }

      // Sort sizes in display order. Unknown numeric sizes (e.g. 50, 52, kids 6/8/10)
      // are sorted by their numeric value at the end of the list.
      const sortedSizes = group.sizes.sort((a, b) => {
        const ai = SIZE_CATALOG.indexOf(a)
        const bi = SIZE_CATALOG.indexOf(b)
        const aRank = ai === -1 ? 999 : ai
        const bRank = bi === -1 ? 999 : bi
        if (aRank !== bRank) return aRank - bRank
        // Both unknown — fall back to numeric or alphabetic ordering
        const an = parseInt(a, 10)
        const bn = parseInt(b, 10)
        if (!isNaN(an) && !isNaN(bn)) return an - bn
        return a.localeCompare(b)
      })

      designs.push({
        baseSku: baseKey,
        portalSkus: group.portalSkus,
        sizes: sortedSizes,
        imageUrl: group.imageUrl,
        alreadyMapped: group.unmappedCount === 0,
        unmappedCount: group.unmappedCount,
        suggestedMasterSku: bestScore >= 0.55 ? suggestedMasterSku : undefined,
        suggestScore: Math.round(bestScore * 100),
      })
    }

    // Sort: unmapped first, then already-mapped
    designs.sort((a, b) => (a.alreadyMapped ? 1 : 0) - (b.alreadyMapped ? 1 : 0))

    return NextResponse.json({
      designs,
      totalSkus: skuImagePairs.length,
      newCount: designs.filter(d => !d.alreadyMapped).length,
      detectedSkuColumn: headers[skuIdx]?.trim(),
      detectedImageColumn: imgIdx >= 0 ? headers[imgIdx]?.trim() : null,
      sampleSkus: skuImagePairs.slice(0, 5).map(p => p.sku),
    })
  } catch (err) {
    console.error('[master-sku/parse]', err)
    return NextResponse.json({ error: 'File parsing failed. Please check the file format.' }, { status: 500 })
  }
}
