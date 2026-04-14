export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import PDFParser from 'pdf2json'

type PortalKey = 'flipkart' | 'meesho'

type LabelInfo = {
  page: number
  sku: string
  shortSku: string
  qty: number
  portal: string
  size?: string
}

type SummaryRow = {
  shortSku: string
  qty: number
  pages: number[]
}

type SkuItem = {
  sku: string
  qty: number
  size?: string
}

type CropBox = {
  left: number
  bottom: number
  right: number
  top: number
  width: number
  height: number
}

type CropSource = {
  sourcePageIndex: number
  cropBox: CropBox
  yMin?: number
  yMax?: number
}

type TextLine = {
  y: number
  text: string
}

type TextCell = {
  x: number
  w: number
  text: string
}

const PORTAL_CONFIG: Record<PortalKey, { name: string }> = {
  flipkart: { name: 'Flipkart' },
  meesho: { name: 'Meesho' },
}

function parsePDFBuffer(buffer: Buffer): Promise<any> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()
    pdfParser.on('pdfParser_dataReady', (data: any) => resolve(data))
    pdfParser.on('pdfParser_dataError', (err: any) => reject(err))
    pdfParser.parseBuffer(buffer)
  })
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeSku(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9._/-]/g, '')
    .replace(/^[._/-]+|[._/-]+$/g, '')
}

function makeShortSku(value: string) {
  const sku = normalizeSku(value)
  const withoutSize = sku.replace(/[-_/](XS|S|M|L|XL|XXL|XXXL|XXXXL|FREE|FS|OS|ONE|ONESIZE|[0-9]{2,3})$/i, '')
  const clean = withoutSize || sku
  if (clean.length <= 24) return clean
  return `${clean.slice(0, 16)}…${clean.slice(-6)}`
}

function normalizeSize(value: string) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/\bFREE\s*SIZE\b/g, 'FREE')
    .replace(/\bONE\s*SIZE\b/g, 'ONESIZE')
    .replace(/[^A-Z0-9]/g, '')
}

function skuIncludesSize(sku: string, size: string) {
  if (!size) return true
  const normalizedSku = normalizeSku(sku)
  return (
    normalizedSku.endsWith(size) ||
    normalizedSku.endsWith(`-${size}`) ||
    normalizedSku.endsWith(`_${size}`) ||
    normalizedSku.endsWith(`/${size}`)
  )
}

function composeSkuWithSize(sku: string, rawSize?: string) {
  const normalizedSku = normalizeSku(sku)
  const size = rawSize ? normalizeSize(rawSize) : ''
  if (!normalizedSku || !size || skuIncludesSize(normalizedSku, size)) {
    return { sku: normalizedSku, size: size || undefined }
  }
  return { sku: `${normalizedSku}-${size}`, size }
}

function getTextItemValue(textItem: any) {
  return normalizeText((textItem.R ?? []).map((run: any) => safeDecode(run.T ?? '')).join(''))
}

function getPageLines(parsedPage: any, yMin?: number, yMax?: number): TextLine[] {
  const rowMap = new Map<number, Array<{ x: number; w: number; text: string }>>()
  const texts: any[] = parsedPage?.Texts ?? []

  for (const textItem of texts) {
    const y = Math.round((textItem.y ?? 0) * 10) / 10
    if (yMin !== undefined && y < yMin) continue
    if (yMax !== undefined && y > yMax) continue

    const text = getTextItemValue(textItem)
    if (!text) continue
    const row = rowMap.get(y) ?? []
    row.push({ x: textItem.x ?? 0, w: textItem.w ?? 0, text })
    rowMap.set(y, row)
  }

  return [...rowMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([y, row]) => {
      const sorted = row.sort((a, b) => a.x - b.x)
      let text = ''
      let previous: { x: number; w: number; text: string } | null = null

      for (const item of sorted) {
        const gap = previous ? item.x - (previous.x + previous.w) : 0
        if (text && gap > 0.35) text += ' '
        text += item.text
        previous = item
      }

      return { y, text: normalizeText(text) }
    })
    .filter((line) => line.text)
}

function getPageRows(parsedPage: any, yMin?: number, yMax?: number): Array<{ y: number; cells: TextCell[] }> {
  const rowMap = new Map<number, TextCell[]>()
  const texts: any[] = parsedPage?.Texts ?? []

  for (const textItem of texts) {
    const y = Math.round((textItem.y ?? 0) * 10) / 10
    if (yMin !== undefined && y < yMin) continue
    if (yMax !== undefined && y > yMax) continue

    const text = getTextItemValue(textItem)
    if (!text) continue
    const row = rowMap.get(y) ?? []
    row.push({ x: textItem.x ?? 0, w: textItem.w ?? 0, text })
    rowMap.set(y, row)
  }

  return [...rowMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([y, cells]) => ({
      y,
      cells: cells.sort((a, b) => a.x - b.x),
    }))
    .filter((row) => row.cells.length > 0)
}

function getPageText(parsedPage: any, yMin?: number, yMax?: number) {
  return getPageLines(parsedPage, yMin, yMax).map((line) => line.text).join(' ')
}

function getSkuFromRowPrefix(value: string) {
  const compactMatch = value.match(/^\s*\d{1,3}\s*([A-Z0-9][A-Z0-9._/-]{2,})\s*$/i)
  if (!compactMatch?.[1]) return null
  return normalizeSku(compactMatch[1])
}

function extractSkuRowsFromLine(line: string): SkuItem[] {
  const cleaned = normalizeText(line)
  const matches = [...cleaned.matchAll(/(?:^|\s)(\d{1,3})\s*([A-Z0-9][A-Z0-9._/-]{2,})\s*\|/gi)]
  const items: SkuItem[] = []

  const SIZE_ONLY = /^(XS|S|M|L|XL|XXL|XXXL|XXXXL|0XL|1XL|2XL|3XL|4XL|5XL|6XL|7XL|8XL|9XL|10XL|FREE|FS|OS|ONE|ONESIZE|\d{1,4})$/i

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index]
    const sku = normalizeSku(match[2])
    if (!sku || sku.length < 4) continue
    if (SIZE_ONLY.test(sku)) continue

    const segmentStart = (match.index ?? 0) + match[0].length
    const segmentEnd = matches[index + 1]?.index ?? cleaned.length
    const segment = cleaned.slice(segmentStart, segmentEnd)
    const qtyMatch = segment.match(/(\d{1,3})\s*$/)
    const qty = Math.max(1, qtyMatch ? Number(qtyMatch[1]) || 1 : 1)
    items.push({ sku, qty })
  }

  if (items.length > 0) return items

  const SIZE_ONLY2 = /^(XS|S|M|L|XL|XXL|XXXL|XXXXL|0XL|1XL|2XL|3XL|4XL|5XL|6XL|7XL|8XL|9XL|10XL|FREE|FS|OS|ONE|ONESIZE|\d{1,4})$/i
  if (cleaned.includes('|')) {
    const beforePipe = cleaned.split('|')[0]
    const sku = getSkuFromRowPrefix(beforePipe)
    if (sku && sku.length >= 4 && !SIZE_ONLY2.test(sku)) {
      const afterPipe = cleaned.slice(cleaned.indexOf('|') + 1)
      const qtyMatch = afterPipe.match(/(\d{1,3})\s*$/)
      return [{ sku, qty: Math.max(1, qtyMatch ? Number(qtyMatch[1]) || 1 : 1) }]
    }
  }

  return []
}

function uniqueSkuItems(items: SkuItem[]) {
  const map = new Map<string, SkuItem>()

  for (const item of items) {
    const sku = normalizeSku(item.sku)
    if (!sku) continue
    const current = map.get(sku)
    if (current) current.qty += item.qty
    else map.set(sku, { sku, qty: Math.max(1, item.qty), size: item.size })
  }

  return Array.from(map.values())
}

function extractSkuItems(parsedPage: any, pageIndex: number, yMin?: number, yMax?: number): SkuItem[] {
  const lines = getPageLines(parsedPage, yMin, yMax)
  const rowItems: SkuItem[] = []
  let skuTableStarted = false

  for (let index = 0; index < lines.length; index++) {
    const cleaned = normalizeText(lines[index].text)
    const upper = cleaned.toUpperCase()
    if (upper.includes('SKU') && upper.includes('|')) {
      skuTableStarted = true
      continue
    }

    if (skuTableStarted && (upper.includes('FMPC') || upper.includes('NOT FOR RESALE') || upper.includes('TAX INVOICE'))) {
      break
    }

    const items = extractSkuRowsFromLine(cleaned)
    if (items.length > 0) {
      rowItems.push(...items)
      skuTableStarted = true
    }
  }

  if (rowItems.length > 0) return uniqueSkuItems(rowItems)

  const text = normalizeText(getPageText(parsedPage, yMin, yMax)).toUpperCase()
  const patterns = [
    /(?:SELLER SKU|SKU ID|SKU CODE|PRODUCT SKU|STYLE CODE|STYLE ID|SKU|STYLE)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i,
    /(?:FSN|EAN|ORDER ITEM ID)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{3,})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return [{ sku: normalizeSku(match[1]), qty: 1 }]
  }

  const blocked = new Set(['FLIPKART', 'MYNTRA', 'MEESHO', 'ORDER', 'INVOICE', 'SHIPPING', 'LABEL', 'DELIVERY', 'CUSTOMER', 'SELLER', 'SKU', 'QTY', 'COD', 'PREPAID'])
  const candidates = text.match(/[A-Z0-9]{2,}[-_/][A-Z0-9._/-]{2,}/g) ?? []
  const picked = candidates.find((candidate) => {
    const sku = normalizeSku(candidate)
    if (sku.length < 4 || sku.length > 45) return false
    return ![...blocked].some((word) => sku.includes(word))
  })

  return [{ sku: picked ? normalizeSku(picked) : `PAGE-${pageIndex + 1}`, qty: 1 }]
}

function extractMeeshoSkuItems(parsedPage: any, pageIndex: number, yMin?: number, yMax?: number): SkuItem[] {
  const rows = getPageRows(parsedPage, yMin, yMax)
  const lines = getPageLines(parsedPage, yMin, yMax)
  const stopLabels = '(?:SIZE|QTY|QUANTITY|COLOR|COLOUR|HSN|GST|TAX|ORDER|AWB|SKU)'
  const skuPatterns = [
    new RegExp(`(?:SELLER\\s*SKU|SUB\\s*SKU|SKU\\s*ID|SKU\\s*CODE|PRODUCT\\s*SKU|STYLE\\s*ID|STYLE|SKU)\\s*[:#-]?\\s*([A-Z0-9][A-Z0-9._/-]{2,})(?=\\s+${stopLabels}\\b|\\s*$)`, 'i'),
    /(?:SKU|SUB SKU)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i,
  ]
  const sizePatterns = [
    new RegExp(`(?:VARIANT\\s*SIZE|PRODUCT\\s*SIZE|SIZE)\\s*[:#-]?\\s*([A-Z0-9 ]{1,18})(?=\\s+${stopLabels}\\b|\\s*$)`, 'i'),
    /(?:SIZE)\s*[:#-]?\s*(XS|S|M|L|XL|XXL|XXXL|XXXXL|0XL|1XL|2XL|3XL|4XL|5XL|6XL|7XL|8XL|9XL|10XL|FREE\s*SIZE|FREE|ONE\s*SIZE|ONESIZE|\d{1,4})\b/i,
  ]
  const blockedSku = /^(ORDER|SUBORDER|AWB|TRACKING|INVOICE|TAX|GST|HSN|MEESHO|COD|PREPAID|QTY|SIZE)$/i

  let rawSku = ''
  let rawSize = ''
  let qty = 1

  const headerIndex = rows.findIndex((row) => {
    const combined = row.cells.map((cell) => cell.text).join(' ').toUpperCase()
    return combined.includes('SKU') && combined.includes('SIZE') && combined.includes('QTY')
  })

  if (headerIndex >= 0) {
    const dataRow = rows.slice(headerIndex + 1).find((row) => {
      const combined = row.cells.map((cell) => cell.text).join(' ').toUpperCase()
      return row.cells.length >= 2 && !combined.includes('TAX INVOICE')
    })

    if (dataRow) {
      rawSku = normalizeSku(dataRow.cells[0]?.text ?? '')
      rawSize = normalizeSize(dataRow.cells[1]?.text ?? '')
      const qtyValue = Number(normalizeText(dataRow.cells[2]?.text ?? '1').replace(/\D/g, ''))
      qty = Math.max(1, qtyValue || 1)
    }
  }

  for (const line of lines) {
    if (rawSku && rawSize) break
    const cleaned = normalizeText(line.text)
    const upper = cleaned.toUpperCase()
    const isProductHeader = upper.includes('SKU') && upper.includes('SIZE') && upper.includes('QTY') && upper.includes('ORDER')
    if (isProductHeader) continue

    if (!rawSku) {
      for (const pattern of skuPatterns) {
        const match = cleaned.match(pattern)
        const candidate = match?.[1] ? normalizeSku(match[1]) : ''
        const looksLikeHeader = /(?:SIZE|QTY|QUANTITY|COLOR|COLOUR|ORDER)/i.test(candidate)
        if (candidate && candidate.length >= 3 && !blockedSku.test(candidate) && !looksLikeHeader) {
          rawSku = candidate
          break
        }
      }
    }
    if (!rawSize) {
      for (const pattern of sizePatterns) {
        const match = cleaned.match(pattern)
        const candidate = match?.[1] ? normalizeSize(match[1]) : ''
        if (candidate && candidate.length <= 10) {
          rawSize = candidate
          break
        }
      }
    }
    if (rawSku && rawSize) break
  }

  if (!rawSku) {
    const tableHeaderIndex = lines.findIndex((line) => {
      const upper = line.text.toUpperCase()
      return upper.includes('SKU') && upper.includes('SIZE')
    })
    if (tableHeaderIndex >= 0) {
      for (const line of lines.slice(tableHeaderIndex + 1, tableHeaderIndex + 5)) {
        const parts = normalizeText(line.text).split(/\s+/)
        const skuPart = parts.find((part) => {
          const sku = normalizeSku(part)
          return sku.length >= 3 && /[A-Z]/i.test(sku) && !blockedSku.test(sku)
        })
        const sizePart = parts.find((part) => {
          const size = normalizeSize(part)
          return /^(XS|S|M|L|XL|XXL|XXXL|XXXXL|0XL|1XL|2XL|3XL|4XL|5XL|6XL|7XL|8XL|9XL|10XL|FREE|ONESIZE|\d{1,4})$/i.test(size)
        })
        if (skuPart) {
          rawSku = normalizeSku(skuPart)
          rawSize = rawSize || (sizePart ? normalizeSize(sizePart) : '')
          break
        }
      }
    }
  }

  if (rawSku) {
    const composed = composeSkuWithSize(rawSku, rawSize)
    if (composed.sku.length >= 3) return [{ sku: composed.sku, qty, size: composed.size }]
  }

  const generic = extractSkuItems(parsedPage, pageIndex, yMin, yMax)
  const usableGeneric = generic.filter((item) => {
    const sku = normalizeSku(item.sku)
    return !sku.startsWith('PAGE-') && !/(ORDER|SUBORDER|AWB|TRACKING|INVOICE)/i.test(sku)
  })

  if (usableGeneric.length > 0) return usableGeneric
  return [{ sku: `PAGE-${pageIndex + 1}`, qty: 1 }]
}

function getFlipkartCropBox(parsedPage: any, sourceWidth: number, sourceHeight: number): CropBox {
  const pageWidth = parsedPage?.Width || 37.188
  const pageHeight = parsedPage?.Height || 52.625
  const unitX = sourceWidth / pageWidth
  const unitY = sourceHeight / pageHeight
  const fills: any[] = parsedPage?.Fills ?? []
  const upperHalfLimit = pageHeight * 0.5
  const longVertical = fills.filter((fill) => fill.y < upperHalfLimit && fill.h > pageHeight * 0.25 && fill.w <= 0.12)

  if (longVertical.length >= 2) {
    const leftLine = longVertical.reduce((current, fill) => (fill.x < current.x ? fill : current), longVertical[0])
    const rightLine = longVertical.reduce((current, fill) => (fill.x > current.x ? fill : current), longVertical[0])
    const minX = Math.min(leftLine.x, rightLine.x)
    const maxX = Math.max(leftLine.x + leftLine.w, rightLine.x + rightLine.w)
    const minY = Math.min(leftLine.y, rightLine.y)
    const maxY = Math.max(leftLine.y + leftLine.h, rightLine.y + rightLine.h)
    const horizontal = fills.filter((fill) => {
      if (fill.h > 0.12 || fill.w < (maxX - minX) * 0.65) return false
      const overlapsBox = fill.x <= maxX && fill.x + fill.w >= minX
      return overlapsBox && fill.y >= minY - 0.2 && fill.y <= maxY + 0.2
    })
    const boxMinY = horizontal.length ? Math.min(minY, ...horizontal.map((fill) => fill.y)) : minY
    const boxMaxY = horizontal.length ? Math.max(maxY, ...horizontal.map((fill) => fill.y + fill.h)) : maxY
    const padding = 1.5
    const left = Math.max(0, minX * unitX - padding)
    const topFromPageTop = Math.max(0, boxMinY * unitY - padding)
    const right = Math.min(sourceWidth, maxX * unitX + padding)
    const bottomFromPageTop = Math.min(sourceHeight, boxMaxY * unitY + padding)
    const bottom = sourceHeight - bottomFromPageTop
    const top = sourceHeight - topFromPageTop

    return { left, bottom, right, top, width: right - left, height: top - bottom }
  }

  const left = sourceWidth * 0.32
  const right = sourceWidth * 0.68
  const top = sourceHeight * 0.965
  const bottom = sourceHeight * 0.56

  return { left, bottom, right, top, width: right - left, height: top - bottom }
}

function getMeeshoCropSources(parsedPage: any, sourcePageIndex: number, sourceWidth: number, sourceHeight: number): CropSource[] {
  const pageWidth: number = parsedPage?.Width || 59.375
  const pageHeight: number = parsedPage?.Height || 84.0
  const unitX = sourceWidth / pageWidth
  const unitY = sourceHeight / pageHeight
  const fills: any[] = parsedPage?.Fills ?? []
  const padding = 2
  const lines = getPageLines(parsedPage)
  const taxInvoiceLine = lines.find((line) => /TAX\s*INVOICE/i.test(line.text))
  const redSeparators = fills.filter((fill) => {
    const color = String(fill.oc ?? '').toLowerCase()
    const isRed = color.includes('c5221f') || color.includes('red')
    const isWideLine = fill.w > pageWidth * 0.25 && fill.h <= 1.5
    const isInLabelBoundaryZone = fill.y > pageHeight * 0.25 && fill.y < pageHeight * 0.55
    const isNearInvoiceStart = taxInvoiceLine ? fill.y >= taxInvoiceLine.y - 1.2 && fill.y <= taxInvoiceLine.y + 0.4 : true
    return isRed && isWideLine && isInLabelBoundaryZone && isNearInvoiceStart
  })

  if (taxInvoiceLine || redSeparators.length > 0) {
    const boundaryY = redSeparators.length
      ? Math.min(...redSeparators.map((fill) => fill.y))
      : taxInvoiceLine?.y ?? pageHeight * 0.4
    const cropEndY = Math.max(0, boundaryY - 0.08)
    const bottomFromTop = Math.max(0, cropEndY * unitY)
    const bottom = Math.max(0, Math.min(sourceHeight, sourceHeight - bottomFromTop))

    return [{
      sourcePageIndex,
      yMin: 0,
      yMax: cropEndY,
      cropBox: {
        left: 0,
        bottom,
        right: sourceWidth,
        top: sourceHeight,
        width: sourceWidth,
        height: sourceHeight - bottom,
      },
    }]
  }

  // Look for wide horizontal separator line in the middle zone of the page
  const midMin = pageHeight * 0.35
  const midMax = pageHeight * 0.65
  const separator = fills.find(
    (f) => f.w > pageWidth * 0.5 && f.h <= 0.25 && f.y > midMin && f.y < midMax
  )

  if (separator) {
    const splitYPdf = separator.y + separator.h / 2
    const splitYPt = splitYPdf * unitY

    const cropBox: CropBox = {
      left: 0,
      bottom: Math.max(0, sourceHeight - splitYPt - padding),
      right: sourceWidth,
      top: sourceHeight,
      width: sourceWidth,
      height: splitYPt + padding,
    }

    return [{ sourcePageIndex, cropBox, yMin: 0, yMax: splitYPdf }]
  }

  // No separator found — look for a bounding box via fills
  const wideHorizontal = fills.filter((f) => f.w > pageWidth * 0.5 && f.h <= 0.15)
  const tallVertical = fills.filter((f) => f.h > pageHeight * 0.25 && f.w <= 0.15)

  if (wideHorizontal.length >= 2 && tallVertical.length >= 2) {
    const minX = Math.min(...tallVertical.map((f) => f.x))
    const maxX = Math.max(...tallVertical.map((f) => f.x + f.w))
    const minY = Math.min(...wideHorizontal.map((f) => f.y))
    const maxY = Math.max(...wideHorizontal.map((f) => f.y + f.h))
    const left = Math.max(0, minX * unitX - padding)
    const topFromPageTop = Math.max(0, minY * unitY - padding)
    const right = Math.min(sourceWidth, maxX * unitX + padding)
    const bottomFromPageTop = Math.min(sourceHeight, maxY * unitY + padding)

    return [{
      sourcePageIndex,
      cropBox: {
        left,
        bottom: sourceHeight - bottomFromPageTop,
        right,
        top: sourceHeight - topFromPageTop,
        width: right - left,
        height: bottomFromPageTop - topFromPageTop + 2 * padding,
      },
    }]
  }

  // Fallback: full page
  return [{
    sourcePageIndex,
    cropBox: {
      left: 0,
      bottom: 0,
      right: sourceWidth,
      top: sourceHeight,
      width: sourceWidth,
      height: sourceHeight,
    },
  }]
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const portalParam = (formData.get('portal') as string | null)?.toLowerCase() ?? 'flipkart'
    const portal: PortalKey = portalParam === 'meesho' ? 'meesho' : 'flipkart'
    const config = PORTAL_CONFIG[portal]

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.includes('pdf')) {
      return NextResponse.json({ error: 'Only PDF label files are allowed' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const [sourcePdf, parsedPdf] = await Promise.all([
      PDFDocument.load(buffer),
      parsePDFBuffer(buffer).catch(() => ({ Pages: [] })),
    ])

    const parsedPages: any[] = parsedPdf.Pages ?? []
    const outputPdf = await PDFDocument.create()
    const pageCount = sourcePdf.getPageCount()

    type ProcessedItem = {
      virtualIndex: number
      sourcePageIndex: number
      cropBox: CropBox
      sku: string
      shortSku: string
      qty: number
      size?: string
    }

    const allItems: ProcessedItem[] = []
    let virtualIndex = 0

    for (let i = 0; i < pageCount; i++) {
      const sourcePage = sourcePdf.getPage(i)
      const sw = sourcePage.getWidth()
      const sh = sourcePage.getHeight()
      const parsedPage = parsedPages[i]

      let cropSources: CropSource[]
      if (portal === 'meesho') {
        cropSources = getMeeshoCropSources(parsedPage, i, sw, sh)
      } else {
        cropSources = [{ sourcePageIndex: i, cropBox: getFlipkartCropBox(parsedPage, sw, sh) }]
      }

      for (const source of cropSources) {
        const items =
          portal === 'meesho'
            ? extractMeeshoSkuItems(parsedPage, i, source.yMin, source.yMax)
            : extractSkuItems(parsedPage, i)

        const firstItem = items[0] ?? { sku: `PAGE-${i + 1}`, qty: 1 }
        for (const item of items) {
          allItems.push({
            virtualIndex: virtualIndex++,
            sourcePageIndex: i,
            cropBox: source.cropBox,
            sku: item.sku,
            shortSku: makeShortSku(item.sku),
            qty: item.qty,
            size: item.size,
          })
        }
        void firstItem
      }
    }

    // Sort all items by shortSku then by original order
    const orderedItems = [...allItems].sort((a, b) => {
      const skuCompare = a.shortSku.localeCompare(b.shortSku)
      return skuCompare !== 0 ? skuCompare : a.virtualIndex - b.virtualIndex
    })

    // For PDF output: deduplicate by (sourcePageIndex + cropBox key)
    // A page with multiple SKUs should appear only ONCE in the output PDF
    const seenPageKeys = new Set<string>()
    const uniquePageItems = orderedItems.filter((item) => {
      const key = `${item.sourcePageIndex}|${Math.round(item.cropBox.left)},${Math.round(item.cropBox.bottom)},${Math.round(item.cropBox.right)},${Math.round(item.cropBox.top)}`
      if (seenPageKeys.has(key)) return false
      seenPageKeys.add(key)
      return true
    })

    // Build output PDF — one page per unique physical label
    for (const item of uniquePageItems) {
      const sourcePage = sourcePdf.getPage(item.sourcePageIndex)
      const { left, bottom, right, top, width, height } = item.cropBox
      const embeddedPage = await outputPdf.embedPage(sourcePage, { left, bottom, right, top })
      const page = outputPdf.addPage([width, height])
      page.drawPage(embeddedPage, { x: 0, y: 0, width, height })
    }

    // Build labels for response — all SKU items (for picklist/summary accuracy)
    const labels: LabelInfo[] = orderedItems.map((item) => ({
      page: item.sourcePageIndex + 1,
      sku: item.sku,
      shortSku: item.shortSku,
      qty: item.qty,
      portal: config.name,
      size: item.size,
    }))

    // Build summary
    const summaryMap = new Map<string, SummaryRow>()
    for (const label of labels) {
      const current = summaryMap.get(label.shortSku) ?? { shortSku: label.shortSku, qty: 0, pages: [] }
      current.qty += label.qty
      if (!current.pages.includes(label.page)) current.pages.push(label.page)
      summaryMap.set(label.shortSku, current)
    }

    const pdfBytes = await outputPdf.save()
    const firstItem = orderedItems[0]
    const dimW = firstItem ? Math.round(firstItem.cropBox.width) : 0
    const dimH = firstItem ? Math.round(firstItem.cropBox.height) : 0

    return NextResponse.json({
      portal: config.name,
      fileName: `${portal}-cropped-labels-${new Date().toISOString().slice(0, 10)}.pdf`,
      pdfBase64: Buffer.from(pdfBytes).toString('base64'),
      labels,
      summary: Array.from(summaryMap.values()),
      totalLabels: uniquePageItems.length,
      totalSkuItems: labels.reduce((total, label) => total + label.qty, 0),
      dimensions: `${dimW}pt x ${dimH}pt`,
    })
  } catch (error) {
    console.error('Label crop error:', error)
    return NextResponse.json({ error: 'Failed to crop labels' }, { status: 500 })
  }
}
