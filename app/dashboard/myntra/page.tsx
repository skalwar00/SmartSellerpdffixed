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
  ShoppingCart,
  BarChart2,
  Wallet,
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

const formatINR = (num: number) => Math.round(num).toLocaleString('en-IN')

function getDesignPattern(sku: string) {
  return sku.toUpperCase().replace(/[-_].*$/, '')
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
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const getCost = useCallback((sku: string) => {
    if (!settings) return 0
    const mapped = settings.mappingDict[sku] || sku
    const pattern = getDesignPattern(mapped)
    if (settings.costingDict[pattern]) return settings.costingDict[pattern]
    if (sku.startsWith('HF')) return sku.includes('CBO') ? 230 : 115
    if (sku.startsWith('PT')) return sku.includes('CBO') ? 330 : 165
    return 0
  }, [settings])

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

      const totalSettlement = processed.reduce((s, r) => s + r.netSettlement, 0)
      const totalCost = processed.reduce((s, r) => s + r.totalCost, 0)
      const totalProfit = processed.reduce((s, r) => s + r.netProfit, 0)
      setSummary({
        totalSettlement,
        totalCost,
        totalProfit,
        margin: totalSettlement ? (totalProfit / totalSettlement) * 100 : 0,
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
      ['Order', 'SKU', 'Type', 'Settlement', 'Profit'],
      ...orders.map(o => [o.orderId, o.sku, o.orderType, o.netSettlement, o.netProfit])
    ].map(r => r.join(',')).join('\n')

    const blob = new Blob([csv])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `myntra-analysis-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const summaryCards = summary
    ? [
        {
          label: 'Net Payout',
          value: `₹${formatINR(summary.totalSettlement)}`,
          icon: Wallet,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
        },
        {
          label: 'Total Cost',
          value: `₹${formatINR(summary.totalCost)}`,
          icon: ShoppingCart,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
        },
        {
          label: 'Net Profit',
          value: `₹${formatINR(summary.totalProfit)}`,
          icon: summary.totalProfit >= 0 ? TrendingUp : TrendingDown,
          color: summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600',
          bg: summary.totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50',
        },
        {
          label: 'Margin',
          value: `${summary.margin.toFixed(1)}%`,
          icon: BarChart2,
          color: summary.margin >= 0 ? 'text-purple-600' : 'text-red-600',
          bg: summary.margin >= 0 ? 'bg-purple-50' : 'bg-red-50',
        },
      ]
    : []

  return (
    <>
      <DashboardHeader title="Myntra Analyzer" description="Smart P&L dashboard for Myntra settlements" />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              Upload Settlement Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileDropzone
              accept=".csv"
              multiple
              files={files}
              onFilesChange={setFiles}
              disabled={loading}
              label="Drop your Myntra CSV files here or click to browse"
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
        </Card>

        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {orders.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">
                Orders
                <Badge variant="secondary" className="ml-2 text-xs">
                  {orders.length} rows
                </Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={download}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <div className="max-h-[480px] overflow-auto rounded-b-xl">
                <Table>
                  <TableHeader className="sticky top-0 bg-background shadow-[0_1px_0_0_hsl(var(--border))] z-10">
                    <TableRow>
                      <TableHead className="pl-4">Order ID</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Settlement</TableHead>
                      <TableHead className="text-right pr-4">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.slice(0, 100).map((o, i) => (
                      <TableRow
                        key={i}
                        className={`transition-colors hover:bg-muted/50 ${
                          i % 2 === 0 ? '' : 'bg-muted/20'
                        }`}
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
                        <TableCell className="text-right text-sm">
                          ₹{formatINR(o.netSettlement)}
                        </TableCell>
                        <TableCell
                          className={`text-right pr-4 font-semibold text-sm ${
                            o.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          ₹{formatINR(o.netProfit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {orders.length > 100 && (
                  <div className="border-t px-4 py-3 text-center text-sm text-muted-foreground">
                    Showing 100 of {orders.length} orders — export CSV for full data
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
