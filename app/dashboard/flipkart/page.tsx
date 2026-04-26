'use client'

import { useState, useCallback, useEffect } from 'react'
import { DashboardHeader } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { toast } from 'sonner'
import {
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  BarChart2,
  IndianRupee,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronRight,
  Link2,
} from 'lucide-react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { SkuMapSheet } from '@/components/dashboard/sku-map-sheet'

interface OrderRow {
  orderId: string
  sku: string
  category: string
  unitCost: number
  status: string
  units: number
  settlement: number
  netProfit: number
  costKnown: boolean
}

interface Summary {
  totalSettlement: number
  totalProfit: number
  totalUnits: number
  noCostingCount: number
  noCostingSettlement: number
  noCostingSkus: string[]
  notMappedCount: number
  notMappedSettlement: number
  notMappedSkus: string[]
  categoryBreakdown: Record<string, { units: number; settlement: number; profit: number }>
}

type SortKey = keyof OrderRow
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 50

function getDesignPattern(masterSku: string): string {
  let sku = masterSku.toUpperCase().trim()
  sku = sku.replace(/[()]/g, '-').replace(/\+/g, '-')
  sku = sku.replace(/-{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '')
  sku = sku.replace(/[-_](XS|S|M|L|XL|XXL|\d*XL|FREE|SMALL|LARGE|OS|ONESIZE)$/i, '')
  return sku.trim().replace(/[-_]+$/, '')
}

async function fetchUserSettings() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [mappingRes, costingRes, inventoryRes] = await Promise.all([
    supabase.from('sku_mapping').select('portal_sku, master_sku, combo_skus').eq('user_id', user.id),
    supabase.from('design_costing').select('design_pattern, landed_cost').eq('user_id', user.id),
    supabase.from('master_inventory').select('master_sku').eq('user_id', user.id),
  ])

  const mappingDict: Record<string, string> = {}
  const comboMappings: Record<string, string[]> = {}

  mappingRes.data?.forEach(item => {
    const key = item.portal_sku.toUpperCase()
    mappingDict[key] = item.master_sku
    const comboSkus: string[] = item.combo_skus || []
    if (comboSkus.length > 0) {
      comboMappings[key] = [item.master_sku, ...comboSkus]
    }
  })

  const costingDict: Record<string, number> = {}
  costingRes.data?.forEach(item => {
    costingDict[item.design_pattern] = item.landed_cost
  })

  const masterOptions: string[] = inventoryRes.data?.map(r => r.master_sku).sort() ?? []

  return { mappingDict, comboMappings, costingDict, masterOptions }
}

export default function FlipkartAnalyzerPage() {
  const { data: settings, mutate: mutateSettings } = useSWR('flipkart-settings', fetchUserSettings)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadOpen, setUploadOpen] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)
  const [showUnmappedList, setShowUnmappedList] = useState(false)
  const [showNoCostingList, setShowNoCostingList] = useState(false)
  const [mapSheetOpen, setMapSheetOpen] = useState(false)
  const [reanalysisNeeded, setReanalysisNeeded] = useState(false)

  const getCategoryAndCost = useCallback((skuName: string): [string, number] => {
    if (!settings) return ['Unknown', 0]
    const portalSku = skuName.trim().toUpperCase()

    const comboSkus = settings.comboMappings[portalSku]
    if (comboSkus && comboSkus.length > 0) {
      let totalCost = 0
      let allFound = true
      for (const mSku of comboSkus) {
        const pattern = getDesignPattern(mSku)
        if (pattern in settings.costingDict) {
          totalCost += settings.costingDict[pattern]
        } else {
          allFound = false
        }
      }
      return [allFound ? 'Combo Match' : 'Combo (Partial)', totalCost]
    }

    const isMapped = portalSku in settings.mappingDict
    if (!isMapped) return ['Not Mapped', 0]

    const masterSku = settings.mappingDict[portalSku]
    const pattern = getDesignPattern(masterSku)
    if (pattern in settings.costingDict) return ['DB Match', settings.costingDict[pattern]]
    return ['No Costing', 0]
  }, [settings])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  const sortedOrders = [...orders].sort((a, b) => {
    if (!sortKey) return 0
    const av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'asc' ? av - bv : bv - av
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })

  const totalPages = Math.ceil(sortedOrders.length / PAGE_SIZE)
  const pageOrders = sortedOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="inline h-3 w-3 opacity-30 ml-1" />
    return sortDir === 'asc'
      ? <ChevronUp className="inline h-3 w-3 ml-1" />
      : <ChevronDown className="inline h-3 w-3 ml-1" />
  }

  const runAnalysis = async (file: File) => {
    if (!settings) return

    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/parse-excel', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Failed to parse file')

      const data = await res.json()
      const rows: OrderRow[] = []
      const categoryBreakdown: Summary['categoryBreakdown'] = {}

      for (const row of data.rows) {
        const skuCol = row['SKU Name'] || row['sku_name'] || ''
        const orderIdCol = row['Order ID'] || row['order_id'] || ''

        if (!skuCol && !orderIdCol) continue

        const settlementCol = parseFloat(row['Bank Settlement [Projected] (INR)'] || row['settlement'] || 0)
        const unitsCol = parseInt(row['Net Units'] || row['units'] || 0)
        const statusCol = row['Order Status'] || row['status'] || ''

        const [category, unitCost] = getCategoryAndCost(skuCol)
        const costKnown = category !== 'No Costing' && category !== 'Not Mapped'
        const netProfit = costKnown
          ? (unitsCol > 0 ? settlementCol - (unitsCol * unitCost) : settlementCol)
          : 0

        rows.push({ orderId: orderIdCol, sku: skuCol, category, unitCost, status: statusCol, units: unitsCol, settlement: settlementCol, netProfit, costKnown })

        if (!categoryBreakdown[category]) {
          categoryBreakdown[category] = { units: 0, settlement: 0, profit: 0 }
        }
        categoryBreakdown[category].units += unitsCol
        categoryBreakdown[category].settlement += settlementCol
        if (costKnown) categoryBreakdown[category].profit += netProfit
      }

      const costKnownRows = rows.filter(r => r.costKnown)
      const noCostingRows = rows.filter(r => !r.costKnown && r.category === 'No Costing')
      const notMappedRows = rows.filter(r => r.category === 'Not Mapped')

      const notMappedSkus = [...new Set(notMappedRows.map(r => r.sku.trim().toUpperCase()))].sort()
      const noCostingSkus = [...new Set(
        noCostingRows.map(r => getDesignPattern(settings!.mappingDict[r.sku.trim().toUpperCase()] || r.sku))
      )].sort()

      setOrders(rows)
      setPage(0)
      setSortKey(null)
      setUploadOpen(false)
      setSummary({
        totalSettlement: rows.reduce((sum, r) => sum + r.settlement, 0),
        totalProfit: costKnownRows.reduce((sum, r) => sum + r.netProfit, 0),
        totalUnits: rows.reduce((sum, r) => sum + r.units, 0),
        noCostingCount: noCostingRows.length,
        noCostingSettlement: noCostingRows.reduce((sum, r) => sum + r.settlement, 0),
        noCostingSkus,
        notMappedCount: notMappedRows.length,
        notMappedSettlement: notMappedRows.reduce((sum, r) => sum + r.settlement, 0),
        notMappedSkus,
        categoryBreakdown,
      })

      toast.success(`Analyzed ${rows.length} orders`)
    } catch (err) {
      toast.error('Failed to analyze file')
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  // After mapping is saved → settings refresh → auto re-run analysis
  useEffect(() => {
    if (reanalysisNeeded && settings && selectedFiles.length > 0) {
      setReanalysisNeeded(false)
      runAnalysis(selectedFiles[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, reanalysisNeeded])

  const handleAnalyze = () => {
    if (selectedFiles[0]) runAnalysis(selectedFiles[0])
  }

  const handleExport = () => {
    if (orders.length === 0) return
    const csv = [
      ['Order ID', 'SKU', 'Category', 'Unit Cost', 'Status', 'Units', 'Settlement', 'Net Profit'].join(','),
      ...orders.map(o => [o.orderId, `"${o.sku}"`, o.category, o.unitCost, o.status, o.units, o.settlement.toFixed(2), o.netProfit.toFixed(2)].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flipkart-analysis-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const costedSettlement = summary
    ? summary.totalSettlement - summary.noCostingSettlement
    : 0

  const marginPercent = summary && costedSettlement > 0
    ? ((summary.totalProfit / costedSettlement) * 100).toFixed(1)
    : '0.0'

  const summaryCards = summary
    ? [
        {
          label: 'Total Settlement',
          value: `₹${Math.round(summary.totalSettlement).toLocaleString('en-IN')}`,
          icon: DollarSign,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          sub: (summary.noCostingCount + summary.notMappedCount) > 0
            ? `${summary.notMappedCount > 0 ? `${summary.notMappedCount} unmapped` : ''}${summary.notMappedCount > 0 && summary.noCostingCount > 0 ? ', ' : ''}${summary.noCostingCount > 0 ? `${summary.noCostingCount} no-cost` : ''} excluded`
            : null,
        },
        {
          label: 'Net Profit (Costed)',
          value: `₹${Math.round(summary.totalProfit).toLocaleString('en-IN')}`,
          icon: summary.totalProfit >= 0 ? TrendingUp : TrendingDown,
          color: summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600',
          bg: summary.totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50',
          sub: `${marginPercent}% margin on costed orders`,
        },
        {
          label: 'Net Units Sold',
          value: summary.totalUnits.toLocaleString('en-IN'),
          icon: Package,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
          sub: null,
        },
        {
          label: 'Total Orders',
          value: orders.length.toLocaleString('en-IN'),
          icon: BarChart2,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          sub: (summary.noCostingCount + summary.notMappedCount) > 0
            ? `${orders.length - summary.noCostingCount - summary.notMappedCount} costed, ${summary.notMappedCount + summary.noCostingCount} excluded`
            : 'All costed',
        },
      ]
    : []

  return (
    <>
      <DashboardHeader
        title="Flipkart Profit Analyzer"
        description="Analyze your Flipkart orders P&L"
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setUploadOpen(o => !o)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                Upload Flipkart Orders
                {selectedFiles.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{selectedFiles.length} file</Badge>
                )}
              </CardTitle>
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${uploadOpen ? 'rotate-90' : ''}`}
              />
            </div>
          </CardHeader>

          {uploadOpen && (
            <CardContent className="space-y-3 pt-0">
              <FileDropzone
                accept=".xlsx,.xls"
                compact
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                disabled={isProcessing}
                label="Drop your Flipkart Excel file here or click to browse"
                hint="Accepts .xlsx and .xls files"
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleAnalyze}
                  disabled={selectedFiles.length === 0 || isProcessing}
                  className="min-w-[140px]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    'Generate Analysis'
                  )}
                </Button>
                {orders.length > 0 && (
                  <Button variant="outline" onClick={(e) => { e.stopPropagation(); handleExport() }}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {summary && (summary.notMappedCount > 0 || summary.noCostingCount > 0) && (
          <div className="flex flex-col gap-2">
            {summary.notMappedCount > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 shrink-0 text-base">🔗</span>
                  <div className="flex-1">
                    <span className="font-semibold">{summary.notMappedSkus.length} unique portal SKUs</span> mapped nahi hain
                    {' '}({summary.notMappedCount} orders, settlement ₹{Math.round(summary.notMappedSettlement).toLocaleString('en-IN')}).
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => setShowUnmappedList(v => !v)}
                      className="rounded border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-medium hover:bg-red-200 transition-colors"
                    >
                      {showUnmappedList ? 'Hide' : 'List'}
                    </button>
                    <button
                      onClick={() => setMapSheetOpen(true)}
                      className="flex items-center gap-1 rounded border border-red-400 bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                    >
                      <Link2 className="h-3 w-3" />
                      Map SKUs
                    </button>
                  </div>
                </div>
                {showUnmappedList && (
                  <div className="border-t border-red-200 px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {summary.notMappedSkus.map(sku => (
                        <code
                          key={sku}
                          className="rounded bg-red-100 border border-red-200 px-2 py-0.5 text-xs font-mono text-red-900 select-all"
                        >
                          {sku}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {summary.noCostingCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 shrink-0 text-base">💰</span>
                  <div className="flex-1">
                    <span className="font-semibold">{summary.noCostingSkus.length} design patterns</span> ki costing missing hai
                    ({summary.noCostingCount} orders, settlement ₹{Math.round(summary.noCostingSettlement).toLocaleString('en-IN')}).
                    <br />
                    <span className="text-xs text-amber-600">
                      Costing page pe in design patterns ki landed cost add karo.
                    </span>
                  </div>
                  <button
                    onClick={() => setShowNoCostingList(v => !v)}
                    className="shrink-0 rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium hover:bg-amber-200 transition-colors"
                  >
                    {showNoCostingList ? 'Hide' : 'Show SKUs'}
                  </button>
                </div>
                {showNoCostingList && (
                  <div className="border-t border-amber-200 px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {summary.noCostingSkus.map(sku => (
                        <code
                          key={sku}
                          className="rounded bg-amber-100 border border-amber-200 px-2 py-0.5 text-xs font-mono text-amber-900 select-all"
                        >
                          {sku}
                        </code>
                      ))}
                    </div>
                    <a
                      href="/dashboard/costing"
                      className="mt-2 inline-block text-xs underline font-medium text-amber-700 hover:text-amber-900"
                    >
                      Costing page pe jaao →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <Card key={card.label} className="overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {card.label}
                    </p>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}>
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                  </div>
                  <p className={`text-xl sm:text-2xl font-bold ${card.color}`}>
                    {card.value}
                  </p>
                  {card.sub && (
                    <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {summary && Object.keys(summary.categoryBreakdown).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Category Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background shadow-[0_1px_0_0_hsl(var(--border))] z-10">
                    <TableRow>
                      <TableHead className="pl-4">Category</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Settlement</TableHead>
                      <TableHead className="text-right pr-4">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summary.categoryBreakdown).map(([cat, data], i) => (
                      <TableRow
                        key={cat}
                        className={`transition-colors hover:bg-muted/50 ${i % 2 !== 0 ? 'bg-muted/20' : ''}`}
                      >
                        <TableCell className="pl-4 font-medium">{cat}</TableCell>
                        <TableCell className="text-right">{data.units}</TableCell>
                        <TableCell className="text-right">
                          ₹{Math.round(data.settlement).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className={`text-right pr-4 font-semibold ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₹{Math.round(data.profit).toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {orders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                All Orders
                <Badge variant="secondary" className="text-xs">
                  {orders.length} rows
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background shadow-[0_1px_0_0_hsl(var(--border))] z-10">
                    <TableRow>
                      <TableHead className="pl-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('orderId')}>
                        Order ID <SortIcon col="orderId" />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('sku')}>
                        SKU <SortIcon col="sku" />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('category')}>
                        Category <SortIcon col="category" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('unitCost')}>
                        Cost <SortIcon col="unitCost" />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                        Status <SortIcon col="status" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('units')}>
                        Units <SortIcon col="units" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('settlement')}>
                        Settlement <SortIcon col="settlement" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none pr-4 whitespace-nowrap" onClick={() => handleSort('netProfit')}>
                        Profit <SortIcon col="netProfit" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageOrders.map((order, idx) => (
                      <TableRow
                        key={idx}
                        className={`transition-colors hover:bg-amber-50 ${
                          !order.costKnown
                            ? 'bg-amber-50/60 border-l-2 border-l-amber-400'
                            : idx % 2 !== 0 ? 'bg-muted/20' : ''
                        }`}
                      >
                        <TableCell className="pl-4 font-mono text-xs text-muted-foreground">
                          {order.orderId}
                        </TableCell>
                        <TableCell
                          className="max-w-[140px] truncate text-sm font-medium"
                          title={order.sku}
                        >
                          {order.sku}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${!order.costKnown ? 'bg-amber-100 text-amber-700 border-amber-300' : ''}`}
                          >
                            {order.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {order.costKnown ? `₹${order.unitCost}` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {order.status}
                        </TableCell>
                        <TableCell className="text-right">{order.units}</TableCell>
                        <TableCell className="text-right text-sm">
                          ₹{Math.round(order.settlement).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell
                          className={`text-right pr-4 font-semibold text-sm ${
                            !order.costKnown
                              ? 'text-amber-500'
                              : order.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {order.costKnown
                            ? `₹${Math.round(order.netProfit).toLocaleString('en-IN')}`
                            : '—'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, orders.length)} of {orders.length} orders
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page === totalPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <SkuMapSheet
        open={mapSheetOpen}
        onOpenChange={setMapSheetOpen}
        unmappedSkus={summary?.notMappedSkus ?? []}
        masterOptions={settings?.masterOptions ?? []}
        onSaved={async () => {
          await mutateSettings()
          setReanalysisNeeded(true)
        }}
      />
    </>
  )
}
