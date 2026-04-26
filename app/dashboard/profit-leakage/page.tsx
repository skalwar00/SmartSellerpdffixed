'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DashboardHeader } from '@/components/dashboard/sidebar'
import {
  WeightDiscrepancyTool,
  type WeightDiscrepancyLossSummary,
} from '@/components/dashboard/weight-discrepancy-tool'
import {
  TrendingDown,
  Package,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  IndianRupee,
  RotateCcw,
  FileSpreadsheet,
  Info,
  Hash,
  Scale,
  Copy,
  Check,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderEntry {
  orderId: string
  subReason: string
  qty: number
}

interface SkuGroup {
  sku: string
  totalQty: number
  orders: OrderEntry[]
}

interface ParseStats {
  totalScanned: number
  misshipmentRows: number
  totalQty: number
  totalSkus: number
  skuCol: string
  mainReasonCol: string
  subReasonCol: string
  qtyCol: string
  orderIdCol: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeHeader(h: string) {
  return h.trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}

function detectColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const c of candidates) {
    const i = normalized.findIndex(h => h === c || h.includes(c))
    if (i >= 0) return i
  }
  return -1
}

const SKU_CANDIDATES        = ['SKU', 'SELLER SKU', 'SKU ID', 'SKU CODE', 'LISTING SKU', 'PORTAL SKU', 'ITEM SKU', 'PRODUCT SKU', 'STYLE CODE']
const MAIN_REASON_CANDIDATES = ['RETURN REASON', 'RETURN_REASON', 'REASON FOR RETURN', 'REASON', 'CANCELLATION REASON']
const SUB_REASON_CANDIDATES  = ['RETURN SUB REASON', 'RETURN_SUB_REASON', 'SUB REASON', 'RETURN SUB_REASON', 'SUBREASON', 'SUB_REASON']
const QTY_CANDIDATES         = ['QUANTITY', 'QTY', 'RETURN QTY', 'RETURNED QTY', 'UNITS', 'PIECES', 'COUNT']
const ORDER_ID_CANDIDATES    = ['ORDER ITEM ID', 'ORDER_ITEM_ID', 'ORDER ID', 'ORDER_ID', 'RETURN ID', 'RETURN_ID', 'ORDER NO', 'ORDER NUMBER']

function isMisshipment(reason: string) {
  return reason.trim().toLowerCase().includes('misship')
}

function stripLabelPrefix(val: string): string {
  return val.replace(/^[A-Za-z0-9]+:\s*/, '')
}

// ── File parser ────────────────────────────────────────────────────────────────

// Flipkart's Returns export sets <dimension ref="A1:AD1"/> even when thousands
// of data rows exist below. SheetJS trusts that declared range, so it returns
// only the header row. This recomputes the true range from actual cell keys
// and rewrites !ref so sheet_to_json reads every row.
function repairSheetRange(ws: XLSX.WorkSheet): boolean {
  const keys = Object.keys(ws).filter(k => !k.startsWith('!'))
  if (keys.length === 0) return false
  let maxRow = 0
  let maxCol = 0
  for (const k of keys) {
    const addr = XLSX.utils.decode_cell(k)
    if (addr.r > maxRow) maxRow = addr.r
    if (addr.c > maxCol) maxCol = addr.c
  }
  const trueRef = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } })
  const declared = ws['!ref']
  if (declared !== trueRef) {
    ws['!ref'] = trueRef
    return true
  }
  return false
}

function parseFile(file: File): Promise<{ rows: string[][]; sheetName: string; repaired?: boolean; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const returnsSheet = wb.SheetNames.find(n => n.trim().toLowerCase().includes('return'))
        const sheetName = returnsSheet ?? wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]

        let raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
        let repaired = false

        // Auto-repair: if only header row (or nothing) was extracted but the sheet
        // actually contains many cells, the file's declared dimension is stale
        // (common Flipkart Returns export bug). Recompute range and re-extract.
        if (raw.length <= 1) {
          repaired = repairSheetRange(ws)
          if (repaired) {
            raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
          }
        }

        resolve({
          rows: raw.map(r => r.map(c => String(c ?? '').trim())),
          sheetName,
          repaired,
        })
      } catch {
        resolve({ rows: [], sheetName: '', error: 'File parse failed. Supported formats: CSV, XLS, XLSX.' })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// ── Row processor (filter: Misshipment only) ───────────────────────────────────

interface ProcessResult {
  groups: SkuGroup[]
  totalScanned: number
  misshipmentRows: number
  totalQty: number
  sampleSkippedSku: string
}

function processAndGroup(
  rows: string[][],
  skuIdx: number,
  mainReasonIdx: number,
  subReasonIdx: number,
  qtyIdx: number,
  orderIdIdx: number,
): ProcessResult {
  const map = new Map<string, SkuGroup>()
  let totalScanned = 0
  let misshipmentRows = 0
  let totalQty = 0
  let sampleSkippedSku = ''

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue
    totalScanned++

    const mainReason = mainReasonIdx >= 0 ? (row[mainReasonIdx]?.trim() || '') : ''
    if (!isMisshipment(mainReason)) continue
    misshipmentRows++

    const rawSku = row[skuIdx]?.trim()
    const sku = rawSku ? stripLabelPrefix(rawSku) : ''
    if (!sku) {
      if (!sampleSkippedSku) sampleSkippedSku = `Row ${i + 1} (reason: ${mainReason})`
      continue
    }

    const subReason = subReasonIdx >= 0 ? (row[subReasonIdx]?.trim() || 'Unknown') : 'Unknown'
    const rawQty = qtyIdx >= 0 ? row[qtyIdx]?.trim() : ''
    const qty = rawQty ? (parseInt(rawQty, 10) || 1) : 1
    const rawOrderId = orderIdIdx >= 0 ? (row[orderIdIdx]?.trim() || '—') : '—'
    const orderId = rawOrderId !== '—' ? stripLabelPrefix(rawOrderId) : '—'

    const skuKey = sku.toUpperCase()
    totalQty += qty

    if (!map.has(skuKey)) map.set(skuKey, { sku: skuKey, totalQty: 0, orders: [] })
    const g = map.get(skuKey)!
    g.totalQty += qty
    g.orders.push({ orderId, subReason, qty })
  }

  const groups = Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty)
  return { groups, totalScanned, misshipmentRows, totalQty, sampleSkippedSku }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfitLeakagePage() {
  const [activeTool, setActiveTool] = useState<'returns' | 'weight'>('returns')
  const [weightLoss, setWeightLoss] = useState<WeightDiscrepancyLossSummary | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [isParsing, setIsParsing]     = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const [headers, setHeaders]         = useState<string[]>([])
  const [rawRows, setRawRows]         = useState<string[][]>([])
  const [skuIdx, setSkuIdx]           = useState(-1)
  const [mainReasonIdx, setMainReasonIdx] = useState(-1)
  const [subReasonIdx, setSubReasonIdx]   = useState(-1)
  const [qtyIdx, setQtyIdx]           = useState(-1)
  const [orderIdIdx, setOrderIdIdx]   = useState(-1)
  const [showColPicker, setShowColPicker] = useState(false)

  const [groups, setGroups]           = useState<SkuGroup[]>([])
  const [stats, setStats]             = useState<ParseStats | null>(null)
  const [expandedSku, setExpandedSku] = useState<string | null>(null)
  const [copiedId, setCopiedId]       = useState<string | null>(null)
  const [uploaderOpen, setUploaderOpen] = useState(true)

  const [costPerReturn, setCostPerReturn] = useState('300')
  const [profitPerOrder, setProfitPerOrder] = useState('')
  const [fileName, setFileName]       = useState('')
  const [detectedSheet, setDetectedSheet] = useState('')
  const [wasRepaired, setWasRepaired] = useState(false)

  const buildGroups = useCallback((
    rows: string[][], si: number, mri: number, sri: number, qi: number, oi: number, hdrs: string[]
  ) => {
    if (si < 0) { setError('SKU column not detected. Please select it manually below.'); setShowColPicker(true); return }
    if (mri < 0) { setError('Return Reason column not detected. Please select it manually below.'); setShowColPicker(true); return }

    const { groups: g, totalScanned, misshipmentRows, totalQty, sampleSkippedSku } = processAndGroup(rows, si, mri, sri, qi, oi)

    if (misshipmentRows === 0) {
      setError(
        `Scanned ${totalScanned} rows but no "Misshipment" returns found. ` +
        `The Return Reason column ("${hdrs[mri]}") must contain "Misshipment" text.`
      )
      setShowColPicker(true)
      return
    }

    if (g.length === 0) {
      setError(
        `Found ${misshipmentRows} Misshipment rows but SKU column ("${hdrs[si]}") ` +
        `had no values. ${sampleSkippedSku ? `Sample: ${sampleSkippedSku}` : ''}`
      )
      setShowColPicker(true)
      return
    }

    setGroups(g)
    setStats({
      totalScanned,
      misshipmentRows,
      totalQty,
      totalSkus: g.length,
      skuCol:        hdrs[si]  || '',
      mainReasonCol: hdrs[mri] || '',
      subReasonCol:  sri >= 0 ? (hdrs[sri] || '') : '—',
      qtyCol:        qi  >= 0 ? (hdrs[qi]  || '') : 'auto',
      orderIdCol:    oi  >= 0 ? (hdrs[oi]  || '') : '—',
    })
    setError(null)
    setShowColPicker(false)
    setUploaderOpen(false)
  }, [])

  const handleFile = async (file: File) => {
    setError(null); setGroups([]); setStats(null)
    setFileName(file.name); setDetectedSheet(''); setExpandedSku(null)
    setWasRepaired(false)
    setIsParsing(true)
    const { rows, sheetName, repaired, error: parseError } = await parseFile(file)
    setIsParsing(false)
    setDetectedSheet(sheetName)
    setWasRepaired(Boolean(repaired))

    if (parseError) { setError(parseError); return }

    const hdrs = rows[0] ?? []
    setHeaders(hdrs)
    setRawRows(rows)

    const si  = detectColumn(hdrs, SKU_CANDIDATES)
    const mri = detectColumn(hdrs, MAIN_REASON_CANDIDATES)
    const sri = detectColumn(hdrs, SUB_REASON_CANDIDATES)
    const qi  = detectColumn(hdrs, QTY_CANDIDATES)
    const oi  = detectColumn(hdrs, ORDER_ID_CANDIDATES)
    setSkuIdx(si); setMainReasonIdx(mri); setSubReasonIdx(sri); setQtyIdx(qi); setOrderIdIdx(oi)

    if (rows.length < 2) {
      const headerCount = hdrs.filter(h => h).length
      setError(
        `"${sheetName}" sheet detected (${headerCount} columns: ${hdrs.filter(h=>h).slice(0,5).join(', ')}${headerCount > 5 ? '…' : ''}), ` +
        `but no data rows found — the file contains only a header row.\n\n` +
        `Fix: Go to Flipkart Seller Hub → Reports → Returns Report, select a date range that includes returns, and download a fresh file.`
      )
      setShowColPicker(false)
      return
    }

    buildGroups(rows, si, mri, sri, qi, oi, hdrs)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const applyColumnPicker = () => {
    if (rawRows.length < 2) { setError('Please upload a valid data file first.'); return }
    buildGroups(rawRows, skuIdx, mainReasonIdx, subReasonIdx, qtyIdx, orderIdIdx, headers)
  }

  const resetAll = () => {
    setGroups([]); setStats(null); setError(null); setHeaders([]); setRawRows([])
    setFileName(''); setExpandedSku(null); setCostPerReturn('300'); setProfitPerOrder('')
    setDetectedSheet(''); setShowColPicker(false); setUploaderOpen(true)
    setWasRepaired(false)
  }

  const totalQty      = stats?.totalQty || 0
  const cost          = parseFloat(costPerReturn) || 0
  const profit        = parseFloat(profitPerOrder) || 0
  const costLoss      = totalQty * cost
  const profitLoss    = totalQty * profit
  const totalLoss     = costLoss + profitLoss
  const yearlyLoss    = totalLoss * 12
  const hasReturnData = Boolean(stats)
  const hasReturnLoss = hasReturnData && (cost > 0 || profit > 0)
  const hasWeightLoss = Boolean(weightLoss)
  const showCombinedSummary = hasReturnData || hasWeightLoss
  const combinedMonthlyLoss = (hasReturnLoss ? totalLoss : 0) + (weightLoss?.monthlyLoss ?? 0)
  const combinedYearlyLoss  = (hasReturnLoss ? yearlyLoss : 0) + (weightLoss?.yearlyLoss ?? 0)

  const PICKER_COLS = [
    { label: 'SKU Column *',            value: skuIdx,        set: setSkuIdx },
    { label: 'Return Reason Column *',  value: mainReasonIdx, set: setMainReasonIdx },
    { label: 'Sub Reason Column',       value: subReasonIdx,  set: setSubReasonIdx },
    { label: 'Quantity Column',         value: qtyIdx,        set: setQtyIdx },
    { label: 'Order ID Column',         value: orderIdIdx,    set: setOrderIdIdx },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Profit Leakage Dashboard"
        description="Return leakage and Weight Discrepancy analysis in one dashboard"
      />

      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 space-y-6">
        {showCombinedSummary && (
          <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 via-white to-amber-50 p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Combined Loss Summary</p>
                <h2 className="text-lg font-bold text-gray-900">Total leakage across both tools</h2>
              </div>
              <p className="text-xs text-gray-500">Return + Weight Discrepancy combined view</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-red-100 bg-white px-5 py-4">
                <p className="text-xs text-gray-500 mb-1">Return Profit Leakage</p>
                <p className="text-2xl font-bold text-red-700">
                  ₹{(hasReturnLoss ? totalLoss : 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {hasReturnData
                    ? `${totalQty.toLocaleString('en-IN')} units misshipped`
                    : 'File upload pending'}
                </p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-white px-5 py-4">
                <p className="text-xs text-gray-500 mb-1">Weight Discrepancy Loss</p>
                <p className="text-2xl font-bold text-amber-700">
                  ₹{(weightLoss?.monthlyLoss ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {weightLoss
                    ? `${weightLoss.totalQty.toLocaleString('en-IN')} units · monthly`
                    : 'File upload pending'}
                </p>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-600 px-5 py-4 text-white">
                <p className="text-xs text-red-100 mb-1">Total Monthly Loss</p>
                <p className="text-3xl font-bold">₹{combinedMonthlyLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-red-100 mt-1">based on available data</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-900 px-5 py-4 text-white">
                <p className="text-xs text-gray-300 mb-1">Total Yearly Projection</p>
                <p className="text-3xl font-bold">₹{combinedYearlyLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-gray-300 mt-1">monthly × 12</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <button
              onClick={() => setActiveTool('returns')}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                activeTool === 'returns'
                  ? 'bg-red-50 text-red-700 shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <TrendingDown className="h-4 w-4" />
              Return Profit Leakage
            </button>
            <button
              onClick={() => setActiveTool('weight')}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                activeTool === 'weight'
                  ? 'bg-amber-50 text-amber-700 shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <Scale className="h-4 w-4" />
              Weight Discrepancy
            </button>
          </div>
        </div>

        <div className={activeTool === 'returns' ? 'space-y-6' : 'hidden'}>
            {/* ── Upload ──────────────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div
            className="border-b border-gray-100 px-6 py-4 flex items-center justify-between cursor-pointer select-none"
            onClick={() => stats && setUploaderOpen(v => !v)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Return Data Upload</h2>
                {stats && !uploaderOpen
                  ? <p className="text-xs text-emerald-600 font-medium">
                      {fileName} · Sheet: {detectedSheet} · {stats.misshipmentRows} misshipments found
                    </p>
                  : <p className="text-xs text-gray-500">Flipkart return report — CSV / XLS / XLSX</p>
                }
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(groups.length > 0 || fileName) && (
                <button onClick={e => { e.stopPropagation(); resetAll() }} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
              )}
              {stats && (
                <button onClick={e => { e.stopPropagation(); setUploaderOpen(v => !v) }} className="text-gray-400 hover:text-gray-600 transition-colors">
                  {uploaderOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {uploaderOpen && (
          <div className="p-6">
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-all ${
                isDragging ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 hover:border-red-300 hover:bg-red-50/40'
              }`}
            >
              {isParsing ? (
                <><Loader2 className="h-8 w-8 animate-spin text-red-400" /><p className="text-sm text-gray-500">Analysing file…</p></>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow">
                    <FileSpreadsheet className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Drop your return report here</p>
                    <p className="mt-0.5 text-xs text-gray-400">Flipkart returns export · CSV, XLS, XLSX</p>
                  </div>
                  {fileName && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <p className="text-xs text-gray-400">File: <span className="font-mono">{fileName}</span></p>
                      {detectedSheet && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Sheet: {detectedSheet}
                        </span>
                      )}
                      {wasRepaired && (
                        <span
                          className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                          title="The exported file's declared row range was incorrect. We auto-recovered the data so you don't have to open & re-save it in Excel."
                        >
                          Auto-repaired
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
              <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
              </div>
            )}

            {/* Column picker — only shown when error / manual override needed */}
            {headers.length > 0 && (!stats || showColPicker) && (
              <div className="mt-4">
                <button
                  onClick={() => setShowColPicker(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
                >
                  <Info className="h-3.5 w-3.5" />
                  Select columns manually
                  {showColPicker ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showColPicker && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-blue-800">Select columns:</p>
                    {PICKER_COLS.map(({ label, value, set }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-blue-700 w-52 shrink-0">{label}</span>
                        <select
                          value={value}
                          onChange={e => set(Number(e.target.value))}
                          className="text-xs border border-blue-200 rounded-md px-2 py-1 bg-white text-gray-700"
                        >
                          <option value={-1}>— None —</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                        </select>
                      </div>
                    ))}
                    <Button size="sm" onClick={applyColumnPicker} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
            </div>

        {/* ── Summary Cards ──────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Misshipment Returns', value: stats.misshipmentRows.toLocaleString('en-IN'), sub: 'rows matched', bg: 'bg-red-50', color: 'text-red-700' },
              { label: 'Total Qty Misshipped', value: stats.totalQty.toLocaleString('en-IN'), sub: 'units', bg: 'bg-orange-50', color: 'text-orange-700' },
              { label: 'SKUs Affected', value: stats.totalSkus.toLocaleString('en-IN'), sub: 'unique SKUs', bg: 'bg-purple-50', color: 'text-purple-700' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl border border-gray-200 ${c.bg} px-5 py-4`}>
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── SKU Table ──────────────────────────────────────────────────────── */}
            {groups.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
                <Package className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Misshipment SKUs</h2>
                <p className="text-xs text-gray-500">Highest qty first · Expand to see orders + sub-reason</p>
              </div>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <div className="col-span-1">#</div>
              <div className="col-span-6">SKU</div>
              <div className="col-span-3 text-right">Total Qty</div>
              <div className="col-span-2 text-right">Orders</div>
            </div>

            <div className="divide-y divide-gray-100">
              {groups.map((g, idx) => {
                const isExpanded = expandedSku === g.sku
                const maxQty = groups[0].totalQty
                const barWidth = maxQty > 0 ? (g.totalQty / maxQty) * 100 : 0

                return (
                  <div key={g.sku}>
                    {/* SKU row */}
                    <button
                      className="w-full grid grid-cols-12 gap-2 px-5 py-3.5 hover:bg-orange-50/40 transition-colors text-left"
                      onClick={() => setExpandedSku(isExpanded ? null : g.sku)}
                    >
                      <div className="col-span-1 flex items-center">
                        <span className="text-xs text-gray-400">{idx + 1}</span>
                      </div>
                      <div className="col-span-6 flex items-center">
                        <div>
                          <span className="text-sm font-mono font-semibold text-gray-800">{g.sku}</span>
                          <div className="mt-1 h-1 w-28 rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-red-400" style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3 flex items-center justify-end">
                        <span className="text-base font-bold text-red-600">{g.totalQty.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <span className="text-xs text-gray-400">{g.orders.length}</span>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </button>

                    {/* Expanded: orders with sub-reason */}
                    {isExpanded && (
                      <div className="mx-4 mb-3 rounded-xl border border-orange-100 bg-orange-50/50 overflow-hidden">
                        {/* Order table header */}
                        <div className="grid grid-cols-12 px-4 py-2 bg-orange-100/60 text-xs font-semibold text-orange-800 uppercase tracking-wide">
                          <div className="col-span-1"><Hash className="h-3 w-3" /></div>
                          <div className="col-span-6">Order ID</div>
                          <div className="col-span-4">Sub Reason</div>
                          <div className="col-span-1 text-right">Qty</div>
                        </div>
                        <div className="divide-y divide-orange-100/60 max-h-72 overflow-y-auto">
                          {g.orders.map((o, oi) => (
                            <div key={oi} className="grid grid-cols-12 px-4 py-2 hover:bg-orange-100/30 transition-colors items-center">
                              <div className="col-span-1">
                                <span className="text-xs text-gray-400">{oi + 1}</span>
                              </div>
                              <div className="col-span-6 flex items-center gap-1.5">
                                <span className="text-xs font-mono text-gray-700">{o.orderId}</span>
                                {o.orderId !== '—' && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(o.orderId)
                                      setCopiedId(o.orderId)
                                      setTimeout(() => setCopiedId(null), 1500)
                                    }}
                                    className="shrink-0 text-gray-300 hover:text-orange-500 transition-colors"
                                    title="Copy Order ID"
                                  >
                                    {copiedId === o.orderId
                                      ? <Check className="h-3 w-3 text-green-500" />
                                      : <Copy className="h-3 w-3" />}
                                  </button>
                                )}
                              </div>
                              <div className="col-span-4">
                                <span className="text-xs text-gray-600">{o.subReason}</span>
                              </div>
                              <div className="col-span-1 text-right">
                                <span className="text-xs font-semibold text-red-600">{o.qty}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="px-4 py-2 bg-orange-100/40 flex justify-end">
                          <span className="text-xs text-orange-700 font-semibold">
                            Total {g.orders.length} orders · {g.totalQty} units
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}


        {/* ── Calculator ─────────────────────────────────────────────────────── */}
        {groups.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                <IndianRupee className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Misshipment Loss Calculator</h2>
                <p className="text-xs text-gray-500">Enter cost per return + expected profit — see total leakage</p>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex flex-wrap gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Cost per Return (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      type="number" min={0} placeholder="e.g. 300"
                      value={costPerReturn}
                      onChange={e => setCostPerReturn(e.target.value)}
                      className="pl-7 w-40"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Shipping + handling + packaging</p>
                </div>
                <div className="flex items-center pt-5 text-gray-300 text-lg font-light">+</div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Expected Profit per Order (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      type="number" min={0} placeholder="e.g. 200"
                      value={profitPerOrder}
                      onChange={e => setProfitPerOrder(e.target.value)}
                      className="pl-7 w-40"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Profit if order had delivered</p>
                </div>
                <div className="flex items-center pt-5 text-gray-300 text-lg font-light">×</div>
                <div className="flex items-center pt-5">
                  <span className="font-mono font-bold text-gray-700 text-sm">{totalQty.toLocaleString('en-IN')} units</span>
                </div>
              </div>

              {(cost > 0 || profit > 0) ? (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-4">
                    <p className="text-xs text-red-500 mb-1">Return Cost Loss</p>
                    <p className="text-xl font-bold text-red-700">₹{costLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-red-400 mt-1">{totalQty} × ₹{cost}</p>
                  </div>
                  <div className="rounded-xl bg-orange-50 border border-orange-100 px-5 py-4">
                    <p className="text-xs text-orange-500 mb-1">Lost Upcoming Profit</p>
                    <p className="text-xl font-bold text-orange-700">₹{profitLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-orange-400 mt-1">{totalQty} × ₹{profit}</p>
                  </div>
                  <div className="rounded-xl bg-rose-600 border border-rose-700 px-5 py-4 text-white">
                    <p className="text-xs text-rose-200 mb-1">Total Monthly Loss</p>
                    <p className="text-xl font-bold">₹{totalLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-rose-200 mt-1">cost + profit × {totalQty} units</p>
                  </div>
                  <div className="rounded-xl bg-gray-900 border border-gray-800 px-5 py-4 text-white">
                    <p className="text-xs text-gray-300 mb-1">Yearly Projection</p>
                    <p className="text-xl font-bold">₹{yearlyLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-gray-400 mt-1">monthly × 12</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 flex items-center gap-1.5">
                  <Info className="h-4 w-4" />
                  Enter values above to see loss breakdown
                </p>
              )}
            </div>
          </div>
        )}

        </div>

        <div className={activeTool === 'weight' ? 'space-y-6' : 'hidden'}>
          <WeightDiscrepancyTool showHeader={false} onLossChange={setWeightLoss} />
        </div>
      </div>
    </div>
  )
}
