'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { toast } from 'sonner'
import {
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  BarChart2,
  DollarSign,
  Package,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronRight,
} from 'lucide-react'
import useSWR from 'swr'

interface Order {
  orderId: string
  sku: string
  orderType: string
  forwardAmt: number
  reverseAmt: number
  netSettlement: number
  status: string
  unitCost: number
  totalCost: number
  netProfit: number
}

type SortKey = keyof Order
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 50
const formatINR = (num: number) => Math.round(num).toLocaleString('en-IN')

function getDesignPattern(sku: string): string {
  let s = sku.toUpperCase().trim()
  s = s.replace(/[-_](S|M|L|XL|XXL|\d*XL|FREE|SMALL|LARGE)$/i, '')
  s = s.replace(/\(.*?\)/g, '')
  return s.trim().replace(/[-_]+$/, '')
}

async function fetchUserSettings() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [mappingRes, costingRes] = await Promise.all([
    supabase.from('sku_mapping').select('*').eq('user_id', user?.id),
    supabase.from('design_costing').select('*').eq('user_id', user?.id),
  ])

  const mappingDict: Record<string, string> = {}
  mappingRes.data?.forEach((i: { portal_sku: string; master_sku: string }) => {
    mappingDict[i.portal_sku?.toUpperCase()] = i.master_sku
  })

  const costingDict: Record<string, number> = {}
  costingRes.data?.forEach((i: { design_pattern: string; landed_cost: number }) => {
    costingDict[i.design_pattern] = i.landed_cost
  })

  return { mappingDict, costingDict }
}

export default function MyntraPage() {
  const { data: settings } = useSWR('settings', fetchUserSettings)

  const [files, setFiles] = useState<File[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<{
    totalSettlement: number
    totalCost: number
    totalProfit: number
    margin: number
    totalOrders: number
    deliveredOrders: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)

  const getCost = useCallback((sku: string) => {
    if (!settings) return 0
    const mapped = settings.mappingDict[sku] || sku
    const pattern = getDesignPattern(mapped)
    if (settings.costingDict[pattern]) return settings.costingDict[pattern]
    return 0
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

  const handleAnalyze = async () => {
    if (files.length < 3) {
      toast.error('Upload at least 3 CSV files')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))

      const res = await fetch('/api/analyze-myntra', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      const processed: Order[] = json.data.map((r: Order & { sku: string; status: string; netSettlement: number }) => {
        const unitCost = getCost(r.sku)
        const isDelivered = r.status?.toLowerCase() === 'delivered'
        const totalCost = isDelivered ? unitCost : 0
        const netProfit = r.netSettlement - totalCost
        return { ...r, unitCost, totalCost, netProfit }
      })

      setOrders(processed)
      setPage(0)
      setSortKey(null)
      setUploadOpen(false)

      const totalSettlement = processed.reduce((s, r) => s + r.netSettlement, 0)
      const totalCost = processed.reduce((s, r) => s + r.totalCost, 0)
      const totalProfit = processed.reduce((s, r) => s + r.netProfit, 0)
      const deliveredOrders = processed.filter(r => r.status?.toLowerCase() === 'delivered').length

      setSummary({
        totalSettlement,
        totalCost,
        totalProfit,
        margin: totalSettlement ? (totalProfit / totalSettlement) * 100 : 0,
        totalOrders: processed.length,
        deliveredOrders,
      })

      toast.success(`Analysis complete — ${processed.length} orders processed`)
    } catch (e) {
      console.error(e)
      toast.error('Failed to analyze files. Please check the format and try again.')
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    const csv = [
      ['Order', 'SKU', 'Type', 'Status', 'Forward Amt', 'Reverse Amt', 'Settlement', 'Unit Cost', 'Total Cost', 'Profit'],
      ...orders.map(o => [o.orderId, `"${o.sku}"`, o.orderType, o.status, o.forwardAmt.toFixed(2), o.reverseAmt.toFixed(2), o.netSettlement.toFixed(2), o.unitCost, o.totalCost, o.netProfit.toFixed(2)])
    ].map(r => r.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `myntra-analysis-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="inline h-3 w-3 opacity-30 ml-1" />
    return sortDir === 'asc'
      ? <ChevronUp className="inline h-3 w-3 ml-1" />
      : <ChevronDown className="inline h-3 w-3 ml-1" />
  }

  const marginPercent = summary ? summary.margin.toFixed(1) : '0.0'

  const summaryCards = summary
    ? [
        {
          label: 'Total Settlement',
          value: `₹${formatINR(summary.totalSettlement)}`,
          icon: DollarSign,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          sub: null,
        },
        {
          label: 'Net Profit',
          value: `₹${formatINR(summary.totalProfit)}`,
          icon: summary.totalProfit >= 0 ? TrendingUp : TrendingDown,
          color: summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600',
          bg: summary.totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50',
          sub: `${marginPercent}% margin`,
        },
        {
          label: 'Net Units Sold',
          value: summary.deliveredOrders.toLocaleString('en-IN'),
          icon: Package,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
          sub: null,
        },
        {
          label: 'Total Orders',
          value: summary.totalOrders.toLocaleString('en-IN'),
          icon: BarChart2,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          sub: null,
        },
      ]
    : []

  return (
    <>
      <DashboardHeader title="Myntra Analyzer" description="Smart P&L dashboard for Myntra settlements" />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setUploadOpen(o => !o)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                Upload Settlement Files
                {files.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{files.length} files</Badge>
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
                accept=".csv"
                multiple
                compact
                files={files}
                onFilesChange={setFiles}
                disabled={loading}
                label="Drop Myntra CSV files here or click to browse"
                hint="Upload at least 3 CSV files (forward, reverse, settlement)"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleAnalyze}
                  disabled={loading || files.length < 3}
                  className="min-w-[140px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    'Generate Analysis'
                  )}
                </Button>
                {files.length > 0 && files.length < 3 && (
                  <p className="text-xs text-amber-600">
                    Need {3 - files.length} more file{3 - files.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>

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

        {orders.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                All Orders
                <Badge variant="secondary" className="text-xs">
                  {orders.length} rows
                </Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={download}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
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
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('orderType')}>
                        Type <SortIcon col="orderType" />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                        Status <SortIcon col="status" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('netSettlement')}>
                        Settlement <SortIcon col="netSettlement" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('unitCost')}>
                        Cost <SortIcon col="unitCost" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none pr-4 whitespace-nowrap" onClick={() => handleSort('netProfit')}>
                        Profit <SortIcon col="netProfit" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageOrders.map((o, i) => (
                      <TableRow
                        key={i}
                        className={`transition-colors hover:bg-muted/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}
                      >
                        <TableCell className="pl-4 font-mono text-xs text-muted-foreground">
                          {o.orderId}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-sm font-medium" title={o.sku}>
                          {o.sku}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{o.orderType}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{o.status}</TableCell>
                        <TableCell className="text-right text-sm">
                          ₹{formatINR(o.netSettlement)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          ₹{formatINR(o.unitCost)}
                        </TableCell>
                        <TableCell className={`text-right pr-4 font-semibold text-sm ${o.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₹{formatINR(o.netProfit)}
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
    </>
  )
}
