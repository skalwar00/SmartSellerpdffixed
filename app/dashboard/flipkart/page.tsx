'use client'

import { useState, useCallback } from 'react'
import { DashboardHeader } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
} from 'lucide-react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

interface OrderRow {
  orderId: string
  sku: string
  category: string
  unitCost: number
  status: string
  units: number
  settlement: number
  netProfit: number
}

interface Summary {
  totalSettlement: number
  totalProfit: number
  totalUnits: number
  categoryBreakdown: Record<string, { units: number; settlement: number; profit: number }>
}

function getDesignPattern(masterSku: string): string {
  let sku = masterSku.toUpperCase().trim()
  sku = sku.replace(/[-_](S|M|L|XL|XXL|\d*XL|FREE|SMALL|LARGE)$/, '')
  sku = sku.replace(/\(.*?\)/g, '')
  return sku.trim().replace(/[-_]+$/, '')
}

async function fetchUserSettings() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [mappingRes, costingRes] = await Promise.all([
    supabase.from('sku_mapping').select('portal_sku, master_sku').eq('user_id', user.id),
    supabase.from('design_costing').select('design_pattern, landed_cost').eq('user_id', user.id),
  ])

  const mappingDict: Record<string, string> = {}
  mappingRes.data?.forEach(item => {
    mappingDict[item.portal_sku.toUpperCase()] = item.master_sku
  })

  const costingDict: Record<string, number> = {}
  costingRes.data?.forEach(item => {
    costingDict[item.design_pattern] = item.landed_cost
  })

  return { mappingDict, costingDict }
}

export default function FlipkartAnalyzerPage() {
  const { data: settings } = useSWR('flipkart-settings', fetchUserSettings)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [stdCost, setStdCost] = useState(165)
  const [hfCost, setHfCost] = useState(110)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const getCategoryAndCost = useCallback((skuName: string): [string, number] => {
    if (!settings) return ['Unknown', 0]
    const portalSku = skuName.trim().toUpperCase()
    const masterSku = settings.mappingDict[portalSku] || portalSku
    const pattern = getDesignPattern(masterSku)
    if (pattern in settings.costingDict) return ['DB Match', settings.costingDict[pattern]]
    const isHF = portalSku.startsWith('HF')
    const baseCost = isHF ? hfCost : stdCost
    if (portalSku.includes('3CBO')) return ['Combo 3', baseCost * 3]
    if (portalSku.includes('CBO')) return ['Combo 2', baseCost * 2]
    return [isHF ? 'HF Single' : 'Std Single', baseCost]
  }, [settings, stdCost, hfCost])

  const runAnalysis = async (file: File) => {
    if (!settings) return

    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/parse-excel', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Failed to parse file')

      const data = await res.json()
      console.log("COLUMNS:", Object.keys(data.rows[0]))
      const rows: OrderRow[] = []
      const categoryBreakdown: Summary['categoryBreakdown'] = {}

      for (const row of data.rows) {
        console.log("ROW:", row)
        console.log("COLUMNS:", Object.keys(row))
        console.log("RAW Net Units:", row['Net Units'])
        console.log("TYPE:", typeof row['Net Units'])

        const skuCol = row['SKU Name'] || row['sku_name'] || ''
        const settlementCol = parseFloat(row['Bank Settlement [Projected] (INR)'] || row['settlement'] || 0)
        const unitsCol = parseInt(row['Net Units '] || row['units'] || 0)
        const orderIdCol = row['Order ID'] || row['order_id'] || ''
        const statusCol = row['Order Status'] || row['status'] || ''

        const [category, unitCost] = getCategoryAndCost(skuCol)
        const netProfit = unitsCol > 0 ? settlementCol - (unitsCol * unitCost) : settlementCol

        rows.push({ orderId: orderIdCol, sku: skuCol, category, unitCost, status: statusCol, units: unitsCol, settlement: settlementCol, netProfit })

        if (!categoryBreakdown[category]) {
          categoryBreakdown[category] = { units: 0, settlement: 0, profit: 0 }
        }
        categoryBreakdown[category].units += unitsCol
        categoryBreakdown[category].settlement += settlementCol
        categoryBreakdown[category].profit += netProfit
      }

      setOrders(rows)
      setSummary({
        totalSettlement: rows.reduce((sum, r) => sum + r.settlement, 0),
        totalProfit: rows.reduce((sum, r) => sum + r.netProfit, 0),
        totalUnits: rows.reduce((sum, r) => sum + r.units, 0),
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

  const marginPercent = summary && summary.totalSettlement > 0
    ? ((summary.totalProfit / summary.totalSettlement) * 100).toFixed(1)
    : '0.0'

  const summaryCards = summary
    ? [
        {
          label: 'Total Settlement',
          value: `₹${Math.round(summary.totalSettlement).toLocaleString('en-IN')}`,
          icon: DollarSign,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          sub: null,
        },
        {
          label: 'Net Profit',
          value: `₹${Math.round(summary.totalProfit).toLocaleString('en-IN')}`,
          icon: summary.totalProfit >= 0 ? TrendingUp : TrendingDown,
          color: summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600',
          bg: summary.totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50',
          sub: `${marginPercent}% margin`,
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
          sub: null,
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
          <CardHeader>
            <CardTitle className="text-base">Cost Settings</CardTitle>
            <CardDescription>Default costs for products without DB costing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="w-44">
                <Label htmlFor="std-cost">Standard Pant (PT/PL)</Label>
                <Input
                  id="std-cost"
                  type="number"
                  value={stdCost}
                  onChange={(e) => setStdCost(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              <div className="w-44">
                <Label htmlFor="hf-cost">HF Series</Label>
                <Input
                  id="hf-cost"
                  type="number"
                  value={hfCost}
                  onChange={(e) => setHfCost(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              Upload Flipkart Orders
            </CardTitle>
            <CardDescription>
              Upload your Flipkart Orders P&L Excel file (.xlsx)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileDropzone
              accept=".xlsx,.xls"
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
                <Button variant="outline" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </div>
          </CardContent>
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
                  {Math.min(50, orders.length)} of {orders.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[480px] overflow-auto rounded-b-xl">
                <Table>
                  <TableHeader className="sticky top-0 bg-background shadow-[0_1px_0_0_hsl(var(--border))] z-10">
                    <TableRow>
                      <TableHead className="pl-4">Order ID</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Settlement</TableHead>
                      <TableHead className="text-right pr-4">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.slice(0, 50).map((order, idx) => (
                      <TableRow
                        key={idx}
                        className={`transition-colors hover:bg-muted/50 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}
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
                          <Badge variant="secondary" className="text-xs">{order.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          ₹{order.unitCost}
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
                            order.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          ₹{Math.round(order.netProfit).toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
