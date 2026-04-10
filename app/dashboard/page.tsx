'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { toast } from 'sonner'
import { Download, Save, RefreshCw, Loader2, Package, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import useSWR, { mutate } from 'swr'
import Fuse from 'fuse.js'

interface OrderData {
  Portal_SKU: string
  Qty: number
  Master_SKU?: string
}

interface MappingRow {
  confirm: boolean
  portalSku: string
  masterSku: string
  matchScore: number
}

// Token Set Ratio - matches thefuzz behavior
function tokenSetRatio(str1: string, str2: string): number {
  const s1 = str1.toUpperCase().trim()
  const s2 = str2.toUpperCase().trim()
  if (s1 === s2) return 100
  const tokens1 = new Set(s1.split(/[-_\s]+/).filter(Boolean))
  const tokens2 = new Set(s2.split(/[-_\s]+/).filter(Boolean))
  const intersection = [...tokens1].filter(t => tokens2.has(t))
  const sortedIntersection = intersection.sort().join(' ')
  const sorted1 = [...tokens1].sort().join(' ')
  const sorted2 = [...tokens2].sort().join(' ')
  const combined1 = sortedIntersection + ' ' + [...tokens1].filter(t => !tokens2.has(t)).sort().join(' ')
  const combined2 = sortedIntersection + ' ' + [...tokens2].filter(t => !tokens1.has(t)).sort().join(' ')
  const ratios = [
    simpleRatio(sortedIntersection, sorted1),
    simpleRatio(sortedIntersection, sorted2),
    simpleRatio(sorted1, sorted2),
    simpleRatio(combined1.trim(), combined2.trim()),
  ]
  return Math.max(...ratios)
}

function simpleRatio(s1: string, s2: string): number {
  if (!s1 && !s2) return 100
  if (!s1 || !s2) return 0
  const longer = s1.length >= s2.length ? s1 : s2
  const shorter = s1.length >= s2.length ? s2 : s1
  if (longer.length === 0) return 100
  const matrix: number[][] = []
  for (let i = 0; i <= shorter.length; i++) matrix[i] = [i]
  for (let j = 0; j <= longer.length; j++) matrix[0][j] = j
  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      if (shorter[i - 1] === longer[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
      }
    }
  }
  const distance = matrix[shorter.length][longer.length]
  return Math.round(((longer.length - distance) / longer.length) * 100)
}

async function fetchUserData() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const [mappingRes, inventoryRes] = await Promise.all([
    supabase.from('sku_mapping').select('portal_sku, master_sku').eq('user_id', user.id),
    supabase.from('master_inventory').select('master_sku').eq('user_id', user.id),
  ])
  const mappingDict: Record<string, string> = {}
  mappingRes.data?.forEach(item => {
    mappingDict[item.portal_sku.toUpperCase()] = item.master_sku
  })
  const masterOptions = inventoryRes.data?.map(i => i.master_sku.toUpperCase()) || []
  return { mappingDict, masterOptions, userId: user.id }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
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

export default function PicklistPage() {
  const { data, error, isLoading } = useSWR('user-data', fetchUserData)
  const [orders, setOrders] = useState<OrderData[]>([])
  const [unmappedRows, setUnmappedRows] = useState<MappingRow[]>([])
  const [isSyncingMaster, setIsSyncingMaster] = useState(false)
  const [isSavingMappings, setIsSavingMappings] = useState(false)
  const [isProcessingOrders, setIsProcessingOrders] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const isProcessing = isSyncingMaster || isSavingMappings || isProcessingOrders || isGenerating
  const [masterFiles, setMasterFiles] = useState<File[]>([])
  const [orderFiles, setOrderFiles] = useState<File[]>([])
  const [isMasterOpen, setIsMasterOpen] = useState(false)

  const findSkuColumn = (headers: string[]): number => {
    const normalizedHeaders = headers.map(h => h.trim().toLowerCase())
    const priorityCols = ['seller_sku_code', 'seller sku code', 'seller_sku', 'seller sku']
    for (const pCol of priorityCols) {
      const idx = normalizedHeaders.findIndex(h => h === pCol)
      if (idx !== -1) return idx
    }
    return normalizedHeaders.findIndex(h => h.includes('sku'))
  }

  const findQtyColumn = (headers: string[]): number => {
    const normalizedHeaders = headers.map(h => h.trim().toLowerCase())
    return normalizedHeaders.findIndex(h =>
      h.includes('qty') || h.includes('quantity') || h.includes('units')
    )
  }

  const processOrderFiles = useCallback(async (files: File[]) => {
    if (!files.length || !data) return

    setIsProcessingOrders(true)
    const allOrders: OrderData[] = []

    try {
      for (const file of files) {
        if (file.name.endsWith('.csv')) {
          const text = await file.text()
          const lines = text.split('\n').filter(l => l.trim())
          if (lines.length === 0) { toast.error(`Empty file: ${file.name}`); continue }
          const rawHeaders = lines[0].split(',')
          const headers = rawHeaders.map(h => h.trim())
          const skuIndex = findSkuColumn(headers)
          const qtyIndex = findQtyColumn(headers)
          if (skuIndex === -1) { toast.error(`SKU column not found in ${file.name}`); continue }
          console.log(`[v0] Using SKU Column: ${headers[skuIndex]} (index: ${skuIndex})`)
          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i])
            if (cols[skuIndex]) {
              const skuVal = cols[skuIndex].trim().toUpperCase().replace(/"/g, '')
              let qtyVal = 1
              if (qtyIndex !== -1 && cols[qtyIndex]) {
                const parsed = parseInt(cols[qtyIndex].replace(/"/g, ''), 10)
                if (!isNaN(parsed)) qtyVal = parsed
              }
              if (skuVal) allOrders.push({ Portal_SKU: skuVal, Qty: qtyVal })
            }
          }
        } else if (file.name.endsWith('.pdf')) {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData })
          if (res.ok) {
            const pdfOrders = await res.json()
            allOrders.push(...pdfOrders.orders)
          } else {
            toast.error(`Failed to parse ${file.name}`)
          }
        }
      }

      const mappedOrders = allOrders.map(order => ({
        ...order,
        Master_SKU: data.mappingDict[order.Portal_SKU],
      }))
      setOrders(mappedOrders)

      const unmapped = [...new Set(mappedOrders.filter(o => !o.Master_SKU).map(o => o.Portal_SKU))]
      if (unmapped.length > 0 && data.masterOptions.length > 0) {
        const newMappingRows: MappingRow[] = unmapped.map(sku => {
          let bestMatch = data.masterOptions[0] || ''
          let bestScore = 0
          for (const masterSku of data.masterOptions) {
            const score = tokenSetRatio(sku, masterSku)
            if (score > bestScore) { bestScore = score; bestMatch = masterSku }
          }
          return { confirm: bestScore >= 90, portalSku: sku, masterSku: bestMatch, matchScore: bestScore }
        })
        setUnmappedRows(newMappingRows)
      } else {
        setUnmappedRows([])
      }

      toast.success(`Loaded ${allOrders.length} orders from ${files.length} file(s)`)
    } catch (err) {
      toast.error('Failed to process files')
      console.error(err)
    } finally {
      setIsProcessingOrders(false)
    }
  }, [data])

  const handleOrderFilesChange = useCallback((files: File[]) => {
    setOrderFiles(files)
    if (files.length > 0 && data) {
      processOrderFiles(files)
    }
  }, [data, processOrderFiles])

  const handleMasterSync = async () => {
    if (!masterFiles[0] || !data) return

    // Parse file client-side immediately
    const text = await masterFiles[0].text()
    const lines = text.split('\n').filter(l => l.trim())
    const skus = [...new Set(
      lines.slice(1).map(line => line.split(',')[0]?.trim().toUpperCase()).filter(Boolean)
    )]
    if (skus.length === 0) { toast.error('No SKUs found in file'); return }

    // Snapshot for rollback
    const snapshot = data

    // ── Optimistic update — instant UI ──
    mutate('user-data', { ...data, masterOptions: skus }, false)
    setMasterFiles([])
    toast.success(`Synced ${skus.length} master SKUs`)

    // ── Background Supabase sync ──
    setIsSyncingMaster(true)
    try {
      const supabase = createClient()
      const records = skus.map(sku => ({ user_id: data.userId, master_sku: sku }))
      const { error } = await supabase.from('master_inventory').upsert(records, { onConflict: 'user_id, master_sku' })
      if (error) throw error
      mutate('user-data')
    } catch (err) {
      // ── Rollback on failure ──
      mutate('user-data', snapshot, false)
      toast.error('Sync failed — changes reverted')
      console.error(err)
    } finally {
      setIsSyncingMaster(false)
    }
  }

  const handleSaveMappings = async () => {
    if (!data) return
    const toSave = unmappedRows.filter(row => row.confirm && row.masterSku)
    if (toSave.length === 0) { toast.error('No mappings selected'); return }

    // Snapshot for rollback
    const prevOrders = orders
    const prevUnmapped = unmappedRows

    // ── Optimistic update — instant UI ──
    setOrders(prev => prev.map(order => {
      const mapping = toSave.find(m => m.portalSku === order.Portal_SKU)
      return mapping ? { ...order, Master_SKU: mapping.masterSku } : order
    }))
    setUnmappedRows(prev => prev.filter(row => !row.confirm))
    toast.success(`Saved ${toSave.length} mapping${toSave.length !== 1 ? 's' : ''}`)

    // ── Background Supabase sync ──
    setIsSavingMappings(true)
    try {
      const supabase = createClient()
      const records = toSave.map(row => ({ user_id: data.userId, portal_sku: row.portalSku, master_sku: row.masterSku }))
      const { error } = await supabase.from('sku_mapping').upsert(records, { onConflict: 'user_id, portal_sku' })
      if (error) throw error
      mutate('user-data')
    } catch (err) {
      // ── Rollback on failure ──
      setOrders(prevOrders)
      setUnmappedRows(prevUnmapped)
      toast.error('Save failed — changes reverted')
      console.error(err)
    } finally {
      setIsSavingMappings(false)
    }
  }

  const handleGeneratePicklist = async () => {
    const mappedOrders = orders.filter(o => o.Master_SKU)
    if (mappedOrders.length === 0) { toast.error('No mapped orders to generate picklist'); return }
    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate-picklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: mappedOrders }),
      })
      if (!res.ok) throw new Error('Failed to generate picklist')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `picklist.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Picklist downloaded!')
    } catch (err) {
      toast.error('Failed to generate picklist')
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Failed to load data. Please refresh the page.</p>
      </div>
    )
  }

  const mappedCount = orders.filter(o => o.Master_SKU).length
  const unmappedCount = orders.filter(o => !o.Master_SKU).length

  return (
    <>
      <DashboardHeader
        title="Picklist Generator"
        description="Process orders and generate warehouse picklists"
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setIsMasterOpen(prev => !prev)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                Master Inventory Sync
              </CardTitle>
              <div className="flex items-center gap-2">
                {data && (
                  <Badge variant="secondary" className="gap-1">
                    <Package className="h-3 w-3" />
                    {data.masterOptions.length} SKUs
                  </Badge>
                )}
                {isMasterOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            <CardDescription>
              Upload your master SKU list to enable smart mapping
            </CardDescription>
          </CardHeader>
          {isMasterOpen && (
            <CardContent className="space-y-4">
              <FileDropzone
                accept=".csv"
                files={masterFiles}
                onFilesChange={setMasterFiles}
                disabled={isSyncingMaster}
                label="Drop your Master SKU CSV here or click to browse"
                hint="First column should contain master SKU codes"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={(e) => { e.stopPropagation(); handleMasterSync(); }}
                  disabled={!masterFiles.length || isSyncingMaster}
                >
                  {isSyncingMaster ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync Master SKUs
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Upload Orders
            </CardTitle>
            <CardDescription>
              Upload Flipkart CSV, Myntra CSV, or Meesho PDF files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileDropzone
              accept=".csv,.pdf"
              multiple
              files={orderFiles}
              onFilesChange={handleOrderFilesChange}
              disabled={isLoading || isProcessingOrders}
              label="Drop order files here or click to browse"
              hint="Supports Flipkart CSV, Myntra CSV, and Meesho PDF"
            />
            {isProcessingOrders && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing files…
              </div>
            )}
            {orders.length > 0 && !isProcessingOrders && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-green-700 font-medium">{mappedCount} mapped</span>
                </div>
                {unmappedCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-700 font-medium">{unmappedCount} unmapped</span>
                  </div>
                )}
                <Button
                  onClick={handleGeneratePicklist}
                  disabled={mappedCount === 0 || isGenerating}
                  className="ml-auto"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Generate 4×6 Picklist
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {orders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Orders
                <Badge variant="secondary">{orders.length} total</Badge>
              </CardTitle>
              <CardDescription>
                {mappedCount} mapped · {unmappedCount} unmapped
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[340px] overflow-auto rounded-b-xl">
                <Table>
                  <TableHeader className="sticky top-0 bg-background shadow-[0_1px_0_0_hsl(var(--border))] z-10">
                    <TableRow>
                      <TableHead className="pl-4">Portal SKU</TableHead>
                      <TableHead>Master SKU</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="pr-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.slice(0, 20).map((order, idx) => (
                      <TableRow
                        key={idx}
                        className={`transition-colors hover:bg-muted/50 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}
                      >
                        <TableCell className="pl-4 font-mono text-sm">{order.Portal_SKU}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {order.Master_SKU || '—'}
                        </TableCell>
                        <TableCell className="text-right">{order.Qty}</TableCell>
                        <TableCell className="pr-4">
                          <Badge variant={order.Master_SKU ? 'default' : 'destructive'} className="text-xs">
                            {order.Master_SKU ? 'Mapped' : 'Unmapped'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {orders.length > 20 && (
                  <div className="border-t px-4 py-3 text-center text-sm text-muted-foreground">
                    Showing 20 of {orders.length} orders
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {unmappedRows.length > 0 && data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                New SKU Mapping
                <Badge variant="outline">{unmappedRows.length} SKUs</Badge>
              </CardTitle>
              <CardDescription>
                Review and confirm suggested mappings, then save to apply them.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background shadow-[0_1px_0_0_hsl(var(--border))] z-10">
                    <TableRow>
                      <TableHead className="w-12 pl-4">✓</TableHead>
                      <TableHead>Portal SKU</TableHead>
                      <TableHead>Master SKU</TableHead>
                      <TableHead className="text-right pr-4">Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmappedRows.map((row, idx) => (
                      <TableRow
                        key={idx}
                        className={`transition-colors hover:bg-muted/50 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}
                      >
                        <TableCell className="pl-4">
                          <Checkbox
                            checked={row.confirm}
                            onCheckedChange={(checked) => {
                              setUnmappedRows(prev =>
                                prev.map((r, i) => i === idx ? { ...r, confirm: !!checked } : r)
                              )
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.portalSku}</TableCell>
                        <TableCell>
                          <Select
                            value={row.masterSku}
                            onValueChange={(value) => {
                              setUnmappedRows(prev =>
                                prev.map((r, i) => i === idx ? { ...r, masterSku: value } : r)
                              )
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select master SKU" />
                            </SelectTrigger>
                            <SelectContent>
                              {data.masterOptions.filter(o => o !== '').map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Badge
                            variant={
                              row.matchScore >= 90
                                ? 'default'
                                : row.matchScore >= 70
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-xs"
                          >
                            {row.matchScore}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t p-4 flex justify-end">
                <Button onClick={handleSaveMappings} disabled={isSavingMappings}>
                  {isSavingMappings ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Mappings
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
