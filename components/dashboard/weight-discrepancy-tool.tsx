'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { DashboardHeader } from '@/components/dashboard/sidebar'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Scale,
  RotateCcw,
  FileSpreadsheet,
  Info,
  Hash,
  Download,
  Ticket,
  IndianRupee,
  Package,
  Copy,
  Check,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type OrderType = 'discrepancy' | 'delivered'

interface OrderRow {
  orderId: string
  qty: number
  sku: string
  settlement: number
  type: OrderType
}

interface ParseStats {
  totalScanned: number
  discrepancyOrders: number
  deliveredOrders: number
  discrepancyQty: number
  deliveredQty: number
  totalQty: number
  problemSkus: number
  orderIdCol: string
  settlementCol: string
  qtyCol: string
  skuCol: string
  statusCol: string
}

export interface WeightDiscrepancyLossSummary {
  monthlyLoss: number
  yearlyLoss: number
  totalQty: number
  problemSkus: number
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

function parseAmount(value: string) {
  const cleaned = value.trim().replace(/,/g, '').replace(/[^\d.()\-]/g, '')
  if (!cleaned) return 0
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -Math.abs(parseFloat(cleaned.slice(1, -1)) || 0)
  }
  return parseFloat(cleaned)
}

function isDeliveredStatus(value: string) {
  const status = normalizeHeader(value)
  return status === 'DELIVERED' || status === 'COMPLETED'
}

const ORDER_ID_CANDIDATES = [
  'ORDER ITEM ID', 'ORDER_ITEM_ID', 'ORDER ID', 'ORDER_ID',
  'RETURN ID', 'RETURN_ID', 'ORDER NO', 'ORDER NUMBER', 'ORDERID',
]
const SETTLEMENT_CANDIDATES = [
  'BANK SETTLEMENT PROJECTED INR', 'BANK SETTLEMENT INR',
  'BANK SETTLEMENT PROJECTED', 'BANK SETTLEMENT',
  'NET SETTLEMENT', 'SETTLEMENT AMOUNT', 'SETTLEMENT',
  'FINAL SETTLEMENT', 'TOTAL SETTLEMENT',
]
const QTY_CANDIDATES = [
  'NET UNITS', 'QUANTITY', 'QTY', 'RETURN QTY', 'RETURNED QTY',
  'UNITS', 'PIECES', 'COUNT',
]
const SKU_CANDIDATES = [
  'SKU NAME', 'SKU', 'SELLER SKU', 'SKU ID', 'SKU CODE',
  'LISTING SKU', 'PORTAL SKU', 'ITEM SKU', 'PRODUCT SKU', 'STYLE CODE',
]
const STATUS_CANDIDATES = [
  'ORDER STATUS', 'ORDER_STATUS', 'STATUS', 'DELIVERY STATUS',
  'FULFILMENT STATUS', 'FULFILLMENT STATUS', 'SHIPMENT STATUS',
]

const THRESHOLD = -205

const DISCREPANCY_LOSS_PER_UNIT = 50
const DELIVERED_LOSS_PER_UNIT = 10

// ── File parser ────────────────────────────────────────────────────────────────

function parseFile(file: File): Promise<{ rows: string[][]; sheetName: string; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ordersSheet = wb.SheetNames.find(n =>
          n.trim().toLowerCase().includes('order') ||
          n.trim().toLowerCase().includes('settlement') ||
          n.trim().toLowerCase() === 'sheet1'
        )
        const sheetName = ordersSheet ?? wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
        resolve({ rows: raw.map(r => r.map(c => String(c ?? '').trim())), sheetName })
      } catch {
        resolve({ rows: [], sheetName: '', error: 'File parse failed. Only CSV, XLS, and XLSX files are supported.' })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// ── Row processor — two-pass ──────────────────────────────────────────────────

function processRows(
  rows: string[][],
  orderIdIdx: number,
  settlementIdx: number,
  qtyIdx: number,
  skuIdx: number,
  statusIdx: number,
): {
  orders: OrderRow[]
  totalScanned: number
  discrepancyOrders: number
  deliveredOrders: number
  discrepancyQty: number
  deliveredQty: number
  problemSkus: number
} {
  let totalScanned = 0
  const discrepancyRows: OrderRow[] = []
  const problemSkuSet = new Set<string>()

  // ── Pass 1: find discrepancy orders (settlement < -204, non-zero) ─────────
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue
    totalScanned++

    const rawSettlement = settlementIdx >= 0 ? row[settlementIdx]?.trim() : ''
    const settlement = rawSettlement ? parseAmount(rawSettlement) : 0

    if (isNaN(settlement) || settlement === 0 || settlement >= THRESHOLD) continue

    const orderId = orderIdIdx >= 0 ? (row[orderIdIdx]?.trim() || '—') : '—'
    const rawQty   = qtyIdx >= 0 ? row[qtyIdx]?.trim() : ''
    const qty      = rawQty ? Math.abs(parseInt(rawQty, 10) || 1) : 1
    const sku      = skuIdx >= 0 ? (row[skuIdx]?.trim().toUpperCase() || '—') : '—'

    problemSkuSet.add(sku)
    discrepancyRows.push({ orderId, qty, sku, settlement, type: 'discrepancy' })
  }

  // ── Pass 2: find delivered orders of the same problem SKUs ────────────────
  const discrepancyOrderIds = new Set<string>()
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue

    const rawSettlement = settlementIdx >= 0 ? row[settlementIdx]?.trim() : ''
    const settlement = rawSettlement ? parseAmount(rawSettlement) : 0
    if (isNaN(settlement) || settlement === 0 || settlement >= THRESHOLD) continue

    const sku = skuIdx >= 0 ? (row[skuIdx]?.trim().toUpperCase() || '—') : '—'
    const orderId = orderIdIdx >= 0 ? row[orderIdIdx]?.trim() : ''
    discrepancyOrderIds.add(orderId ? `${orderId}::${sku}` : `ROW-${i}`)
  }
  const deliveredRows: OrderRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => !c)) continue

    const sku = skuIdx >= 0 ? (row[skuIdx]?.trim().toUpperCase() || '') : ''
    if (!sku || !problemSkuSet.has(sku)) continue

    const rawSettlement = settlementIdx >= 0 ? row[settlementIdx]?.trim() : ''
    const settlement = rawSettlement ? parseAmount(rawSettlement) : 0
    if (isNaN(settlement) || settlement === 0) continue

    const orderId = orderIdIdx >= 0 ? (row[orderIdIdx]?.trim() || '—') : '—'

    const orderKey = orderId !== '—' ? `${orderId}::${sku}` : `ROW-${i}`
    if (discrepancyOrderIds.has(orderKey)) continue

    const status = statusIdx >= 0 ? (row[statusIdx]?.trim() || '') : ''
    if (!isDeliveredStatus(status)) continue

    const rawQty = qtyIdx >= 0 ? row[qtyIdx]?.trim() : ''
    const qty    = rawQty ? Math.abs(parseInt(rawQty, 10) || 1) : 1

    deliveredRows.push({ orderId, qty, sku, settlement, type: 'delivered' })
  }

  const orders = [...discrepancyRows, ...deliveredRows].sort((a, b) => a.settlement - b.settlement)

  const discrepancyQty = discrepancyRows.reduce((s, r) => s + r.qty, 0)
  const deliveredQty   = deliveredRows.reduce((s, r) => s + r.qty, 0)

  return {
    orders,
    totalScanned,
    discrepancyOrders: discrepancyRows.length,
    deliveredOrders:   deliveredRows.length,
    discrepancyQty,
    deliveredQty,
    problemSkus: problemSkuSet.size,
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface WeightDiscrepancyToolProps {
  showHeader?: boolean
  onLossChange?: (summary: WeightDiscrepancyLossSummary | null) => void
}

export function WeightDiscrepancyTool({ showHeader = true, onLossChange }: WeightDiscrepancyToolProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [isParsing, setIsParsing]     = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const [headers, setHeaders]         = useState<string[]>([])
  const [rawRows, setRawRows]         = useState<string[][]>([])
  const [orderIdIdx, setOrderIdIdx]   = useState(-1)
  const [settlementIdx, setSettlementIdx] = useState(-1)
  const [qtyIdx, setQtyIdx]           = useState(-1)
  const [skuIdx, setSkuIdx]           = useState(-1)
  const [statusIdx, setStatusIdx]     = useState(-1)
  const [showColPicker, setShowColPicker] = useState(false)

  const [orders, setOrders]           = useState<OrderRow[]>([])
  const [stats, setStats]             = useState<ParseStats | null>(null)
  const [fileName, setFileName]       = useState('')
  const [detectedSheet, setDetectedSheet] = useState('')
  const [uploaderOpen, setUploaderOpen] = useState(true)
  const [copiedId, setCopiedId]       = useState<string | null>(null)

  const buildOrders = useCallback((
    rows: string[][], oi: number, si: number, qi: number, ski: number, sti: number, hdrs: string[]
  ) => {
    if (si < 0) {
      setError('Bank Settlement column not detected. Please select it manually below.')
      onLossChange?.(null)
      setShowColPicker(true)
      return
    }

    const result = processRows(rows, oi, si, qi, ski, sti)

    if (result.discrepancyOrders === 0) {
      setError(
        `Scanned ${result.totalScanned} rows but no weight discrepancy orders found. ` +
        `Check column "${hdrs[si]}".`
      )
      onLossChange?.(null)
      setShowColPicker(true)
      return
    }

    const resultMonthlyLoss =
      result.discrepancyQty * DISCREPANCY_LOSS_PER_UNIT +
      result.deliveredQty * DELIVERED_LOSS_PER_UNIT

    setOrders(result.orders)
    setStats({
      totalScanned:       result.totalScanned,
      discrepancyOrders:  result.discrepancyOrders,
      deliveredOrders:    result.deliveredOrders,
      discrepancyQty:     result.discrepancyQty,
      deliveredQty:       result.deliveredQty,
      totalQty:           result.discrepancyQty + result.deliveredQty,
      problemSkus:        result.problemSkus,
      orderIdCol:         oi  >= 0 ? (hdrs[oi]  || '') : '—',
      settlementCol:      hdrs[si] || '',
      qtyCol:             qi  >= 0 ? (hdrs[qi]  || '') : 'auto',
      skuCol:             ski >= 0 ? (hdrs[ski] || '') : '—',
      statusCol:          sti >= 0 ? (hdrs[sti] || '') : '—',
    })
    onLossChange?.({
      monthlyLoss: resultMonthlyLoss,
      yearlyLoss: resultMonthlyLoss * 12,
      totalQty: result.discrepancyQty + result.deliveredQty,
      problemSkus: result.problemSkus,
    })
    setError(null)
    setShowColPicker(false)
    setUploaderOpen(false)
  }, [onLossChange])

  const handleFile = async (file: File) => {
    setError(null); setOrders([]); setStats(null)
    onLossChange?.(null)
    setFileName(file.name); setDetectedSheet(''); setIsParsing(true)

    const { rows, sheetName, error: parseError } = await parseFile(file)
    setIsParsing(false)
    setDetectedSheet(sheetName)

    if (parseError) { setError(parseError); return }

    const hdrs = rows[0] ?? []
    setHeaders(hdrs)
    setRawRows(rows)

    const oi  = detectColumn(hdrs, ORDER_ID_CANDIDATES)
    const si  = detectColumn(hdrs, SETTLEMENT_CANDIDATES)
    const qi  = detectColumn(hdrs, QTY_CANDIDATES)
    const ski = detectColumn(hdrs, SKU_CANDIDATES)
    const sti = detectColumn(hdrs, STATUS_CANDIDATES)
    setOrderIdIdx(oi); setSettlementIdx(si); setQtyIdx(qi); setSkuIdx(ski); setStatusIdx(sti)

    if (rows.length < 2) {
      setError(`"${sheetName}" sheet detected but no data rows found — file contains only a header row.`)
      return
    }

    buildOrders(rows, oi, si, qi, ski, sti, hdrs)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const applyColumnPicker = () => {
    if (rawRows.length < 2) { setError('Please upload a valid data file first.'); return }
    buildOrders(rawRows, orderIdIdx, settlementIdx, qtyIdx, skuIdx, statusIdx, headers)
  }

  const resetAll = () => {
    setOrders([]); setStats(null); setError(null); setHeaders([]); setRawRows([])
    setFileName(''); setDetectedSheet(''); setShowColPicker(false)
    setUploaderOpen(true)
    onLossChange?.(null)
  }

  const handleExport = () => {
    if (orders.length === 0) return
    const csv = [
      ['#', 'Order ID', 'SKU', 'Settlement', 'Qty'].join(','),
      ...orders.map((o, i) =>
        [i + 1, o.orderId, `"${o.sku}"`, o.settlement, o.qty].join(',')
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `weight-discrepancy-orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const PICKER_COLS = [
    { label: 'Bank Settlement Column *', value: settlementIdx, set: setSettlementIdx },
    { label: 'Order ID Column',          value: orderIdIdx,    set: setOrderIdIdx },
    { label: 'Qty / Units Column',       value: qtyIdx,        set: setQtyIdx },
    { label: 'SKU Column',               value: skuIdx,        set: setSkuIdx },
    { label: 'Order Status Column',      value: statusIdx,     set: setStatusIdx },
  ]

  const totalQty = stats?.totalQty ?? 0
  const discrepancyMonthlyLoss = (stats?.discrepancyQty ?? 0) * DISCREPANCY_LOSS_PER_UNIT
  const deliveredMonthlyLoss = (stats?.deliveredQty ?? 0) * DELIVERED_LOSS_PER_UNIT
  const monthlyLoss = discrepancyMonthlyLoss + deliveredMonthlyLoss
  const yearlyLoss = monthlyLoss * 12

  return (
    <div className={showHeader ? 'min-h-screen bg-gray-50' : ''}>
      {showHeader && (
        <DashboardHeader
          title="Weight Discrepancy Analyzer"
          description="Upload your Flipkart orders report — identify orders with weight discrepancy issues"
        />
      )}

      <div className={showHeader ? 'mx-auto max-w-screen-xl px-4 py-6 sm:px-6 space-y-6' : 'space-y-6'}>

        {/* ── Alert banner ────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <Ticket className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Loss Due to Weight Discrepancy</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Flipkart is settling less than the actual amount for these SKUs due to dead weight issues —
              including delivered orders.{' '}
              <span className="font-semibold">Raise a ticket on Flipkart Seller Hub</span> to stop future loss.
            </p>
          </div>
        </div>

        {/* ── Upload ──────────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div
            className="border-b border-gray-100 px-6 py-4 flex items-center justify-between cursor-pointer select-none"
            onClick={() => stats && setUploaderOpen(v => !v)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                <Scale className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Orders Report Upload</h2>
                {stats && !uploaderOpen
                  ? <p className="text-xs text-emerald-600 font-medium">
                      {fileName} · Sheet: {detectedSheet} · {stats.discrepancyOrders} discrepancy orders found
                    </p>
                  : <p className="text-xs text-gray-500">Flipkart orders / P&L report — CSV, XLS, XLSX</p>
                }
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(orders.length > 0 || fileName) && (
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
                isDragging ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50 hover:border-amber-300 hover:bg-amber-50/40'
              }`}
            >
              {isParsing ? (
                <><Loader2 className="h-8 w-8 animate-spin text-amber-400" /><p className="text-sm text-gray-500">Analysing file…</p></>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow">
                    <FileSpreadsheet className="h-6 w-6 text-amber-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Drop your orders report here</p>
                    <p className="mt-0.5 text-xs text-gray-400">Flipkart orders export · CSV, XLS, XLSX</p>
                  </div>
                  {fileName && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <p className="text-xs text-gray-400">File: <span className="font-mono">{fileName}</span></p>
                      {detectedSheet && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Sheet: {detectedSheet}
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
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Column picker — only shown on error or manual override */}
            {headers.length > 0 && (!stats || showColPicker) && (
              <div className="mt-4">
                <button onClick={() => setShowColPicker(v => !v)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
                  <Info className="h-3.5 w-3.5" />
                  Select columns manually
                  {showColPicker ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showColPicker && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-blue-800">Select columns:</p>
                    {PICKER_COLS.map(({ label, value, set }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-blue-700 w-56 shrink-0">{label}</span>
                        <select value={value} onChange={e => set(Number(e.target.value))}
                          className="text-xs border border-blue-200 rounded-md px-2 py-1 bg-white text-gray-700">
                          <option value={-1}>— None —</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                        </select>
                      </div>
                    ))}
                    <Button size="sm" onClick={applyColumnPicker} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">Apply</Button>
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
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">Problem SKUs</p>
              <p className="text-xl font-bold text-amber-700">{stats.problemSkus.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-400 mt-0.5">unique SKUs affected</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">Discrepancy Orders</p>
              <p className="text-xl font-bold text-red-700">{orders.length.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-400 mt-0.5">lowest settlement first</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">Total Qty</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalQty.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-400 mt-0.5">units affected</p>
            </div>
          </div>
        )}

        {/* ── Loss Calculator ─────────────────────────────────────────────────── */}
        {stats && (
          <div className="rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-red-100 px-6 py-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
                <IndianRupee className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Loss Due to Weight Discrepancy</h2>
                <p className="text-xs text-gray-500">Estimated impact from affected orders</p>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total Qty</p>
                  <p className="text-2xl font-bold text-gray-800">{totalQty.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">units affected</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Monthly Loss</p>
                  <p className="text-2xl font-bold text-red-700">₹{monthlyLoss.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">estimated monthly impact</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-100 px-5 py-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Yearly Projected Loss</p>
                  <p className="text-2xl font-bold text-red-800">₹{yearlyLoss.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">estimated yearly impact</p>
                </div>
              </div>
            </div>
            <div className="mx-6 mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <Ticket className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 font-medium">
                Raise a ticket on Flipkart Seller Hub for these orders to prevent future loss.
              </p>
            </div>
          </div>
        )}

        {/* ── Orders Table ───────────────────────────────────────────────────── */}
        {orders.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                  <Package className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Discrepancy Orders</h2>
                  <p className="text-xs text-gray-500">
                    {orders.length} orders · lowest settlement first
                  </p>
                </div>
              </div>
              <button onClick={handleExport} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <div className="col-span-1"><Hash className="h-3 w-3" /></div>
              <div className="col-span-5">Order ID</div>
              <div className="col-span-5">SKU</div>
              <div className="col-span-1 text-right">Qty</div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {orders.map((o, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-5 py-3 transition-colors hover:bg-red-50/30 items-center">
                  <div className="col-span-1">
                    <span className="text-xs text-gray-400">{idx + 1}</span>
                  </div>
                  <div className="col-span-5 flex items-center gap-1.5">
                    <span className="text-xs font-mono text-gray-700 break-all">{o.orderId}</span>
                    {o.orderId !== '—' && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(o.orderId)
                          setCopiedId(o.orderId)
                          setTimeout(() => setCopiedId(null), 1500)
                        }}
                        className="shrink-0 text-gray-300 hover:text-amber-500 transition-colors"
                        title="Copy Order ID"
                      >
                        {copiedId === o.orderId
                          ? <Check className="h-3 w-3 text-green-500" />
                          : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                  <div className="col-span-5 flex items-center">
                    <span className="text-xs text-gray-600 truncate" title={o.sku}>{o.sku}</span>
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <span className="text-sm font-bold text-red-600">{o.qty}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">{orders.length} orders total</span>
              <span className="text-xs font-semibold text-amber-700">
                Total Qty: {totalQty.toLocaleString('en-IN')} units
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

