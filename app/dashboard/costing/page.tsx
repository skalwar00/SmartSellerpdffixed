'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Save, AlertCircle, Download, Upload, FileText, CheckCircle2, X, Loader2 } from 'lucide-react'
import useSWR, { mutate } from 'swr'

function getDesignPattern(masterSku: string): string {
  let sku = masterSku.toUpperCase().trim()
  sku = sku.replace(/[-_](S|M|L|XL|XXL|\d*XL|FREE|SMALL|LARGE)$/, '')
  sku = sku.replace(/\(.*?\)/g, '')
  return sku.trim().replace(/[-_]+$/, '')
}

async function fetchCostingData() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [mappingRes, costingRes] = await Promise.all([
    supabase.from('sku_mapping').select('master_sku').eq('user_id', user.id),
    supabase.from('design_costing').select('*').eq('user_id', user.id),
  ])

  const allMasterSkus = [...new Set(mappingRes.data?.map(m => m.master_sku) || [])]
  const allPatterns = [...new Set(allMasterSkus.map(getDesignPattern))].sort()

  const costingDict: Record<string, number> = {}
  costingRes.data?.forEach(item => { costingDict[item.design_pattern] = item.landed_cost })

  const missingPatterns = allPatterns.filter(p => !(p in costingDict))
  const existingPatterns = allPatterns.filter(p => p in costingDict)

  return { allPatterns, costingDict, missingPatterns, existingPatterns, userId: user.id }
}

interface ImportRow {
  design_pattern: string
  landed_cost: number
  valid: boolean
  error?: string
}

// ── Parse raw rows (from CSV or XLSX) ────────────────────────────────────────
function parseRawRows(
  header: string[],
  rows: string[][]
): { rows: ImportRow[]; error?: string } {
  const patternIdx = header.findIndex(h => h.includes('pattern') || h.includes('design') || h === 'design_pattern')
  const costIdx = header.findIndex(h => h.includes('cost') || h.includes('price') || h === 'landed_cost')

  if (patternIdx === -1 || costIdx === -1) {
    return { rows: [], error: 'File must have "design_pattern" and "landed_cost" columns' }
  }

  const parsed: ImportRow[] = rows.map(cols => {
    const pattern = (cols[patternIdx] || '').toString().toUpperCase().trim()
    const costStr = (cols[costIdx] || '').toString().trim()
    if (!pattern) return { design_pattern: pattern, landed_cost: 0, valid: false, error: 'Empty pattern name' }
    // skip rows that are still empty (template rows left blank by user)
    if (!costStr) return { design_pattern: pattern, landed_cost: 0, valid: false, error: 'No cost entered' }
    const cost = parseFloat(costStr)
    if (isNaN(cost) || cost < 0) return { design_pattern: pattern, landed_cost: 0, valid: false, error: `Invalid cost: "${costStr}"` }
    return { design_pattern: pattern, landed_cost: cost, valid: true }
  })

  return { rows: parsed }
}

export default function CostingPage() {
  const { data, error, isLoading } = useSWR('costing-data', fetchCostingData)
  const [selectedPattern, setSelectedPattern] = useState<string>('')
  const [costValue, setCostValue] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [showImportPreview, setShowImportPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Export: ALL patterns (filled + missing) ───────────────────────────────
  const handleExport = () => {
    if (!data) return
    const filled = Object.entries(data.costingDict).sort(([a], [b]) => a.localeCompare(b))
    const missing = data.missingPatterns.sort()
    const total = filled.length + missing.length

    if (total === 0) { toast.error('No patterns found to export'); return }

    // Build rows: filled patterns first (with cost), then missing (empty cost)
    const dataRows = [
      ...filled.map(([p, c]) => `"${p}",${c},filled`),
      ...missing.map(p => `"${p}",,missing`),
    ]
    const csv = ['design_pattern,landed_cost,status', ...dataRows].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `costing_export_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filled.length} filled + ${missing.length} missing patterns`)
  }

  const handleDownloadTemplate = () => {
    const csv = [
      'design_pattern,landed_cost,status',
      '"DESIGN-ABC",250,filled',
      '"DESIGN-XYZ",180,filled',
      '"DESIGN-PQR",,missing',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'costing_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import: CSV + XLSX ─────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    const isCsv = file.name.endsWith('.csv')

    if (!isXlsx && !isCsv) {
      toast.error('Please select a CSV or Excel (.xlsx) file')
      return
    }

    try {
      let headerRow: string[] = []
      let dataRows: string[][] = []

      if (isCsv) {
        const text = await file.text()
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
        if (lines.length < 2) { toast.error('File is empty or has no data rows'); return }
        headerRow = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
        dataRows = lines.slice(1).map(line => line.split(',').map(c => c.replace(/"/g, '').trim()))
      } else {
        // XLSX: dynamic import so it doesn't bloat initial bundle
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (json.length < 2) { toast.error('File is empty or has no data rows'); return }
        headerRow = (json[0] as string[]).map(h => String(h).trim().toLowerCase())
        dataRows = json.slice(1).map(row => (row as string[]).map(c => String(c).trim()))
      }

      // filter out completely empty rows
      dataRows = dataRows.filter(row => row.some(c => c !== ''))

      const { rows, error: parseError } = parseRawRows(headerRow, dataRows)
      if (parseError) { toast.error(parseError); return }
      if (rows.length === 0) { toast.error('No data rows found'); return }

      setImportRows(rows)
      setShowImportPreview(true)
    } catch (err) {
      toast.error('Failed to read file — please try again')
      console.error(err)
    }
  }

  // ── Import: confirm & save ─────────────────────────────────────────────────
  const handleConfirmImport = async () => {
    if (!data) return
    const validRows = importRows.filter(r => r.valid)
    if (validRows.length === 0) { toast.error('No valid rows to import'); return }

    setIsImporting(true)
    try {
      const supabase = createClient()
      const records = validRows.map(r => ({
        user_id: data.userId,
        design_pattern: r.design_pattern,
        landed_cost: r.landed_cost,
      }))
      const { error } = await supabase
        .from('design_costing')
        .upsert(records, { onConflict: 'user_id, design_pattern' })
      if (error) throw error
      await mutate('costing-data')
      setImportRows([])
      setShowImportPreview(false)
      toast.success(`Imported ${validRows.length} costing entries`)
    } catch (err) {
      toast.error('Import failed — please try again')
      console.error(err)
    } finally {
      setIsImporting(false)
    }
  }

  // ── Save single entry ──────────────────────────────────────────────────────
  const handleSaveCosting = async () => {
    if (!selectedPattern || !costValue || !data) { toast.error('Please select a pattern and enter a cost'); return }
    const cost = parseFloat(costValue)
    if (isNaN(cost) || cost < 0) { toast.error('Please enter a valid cost'); return }

    const snapshot = data
    const optimistic = {
      ...data,
      costingDict: { ...data.costingDict, [selectedPattern]: cost },
      missingPatterns: data.missingPatterns.filter(p => p !== selectedPattern),
      existingPatterns: data.existingPatterns.includes(selectedPattern)
        ? data.existingPatterns
        : [...data.existingPatterns, selectedPattern].sort(),
    }
    mutate('costing-data', optimistic, false)
    const savedPattern = selectedPattern
    setSelectedPattern('')
    setCostValue('')
    toast.success(`Saved costing for ${savedPattern}`)

    setIsSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('design_costing')
        .upsert({ user_id: data.userId, design_pattern: savedPattern, landed_cost: cost },
          { onConflict: 'user_id, design_pattern' })
      if (error) throw error
      mutate('costing-data')
    } catch (err) {
      mutate('costing-data', snapshot, false)
      setSelectedPattern(savedPattern)
      setCostValue(cost.toString())
      toast.error('Save failed — changes reverted')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">Failed to load data. Please refresh.</p>
      </div>
    )
  }

  const totalEntries = data ? Object.keys(data.costingDict).length : 0
  const totalMissing = data ? data.missingPatterns.length : 0
  const validImportCount = importRows.filter(r => r.valid).length
  const invalidImportCount = importRows.filter(r => !r.valid).length

  return (
    <>
      <DashboardHeader
        title="Costing Manager"
        description="Manage design-level costing for profit calculations"
      />

      <div className="flex flex-1 flex-col gap-6 p-6">

        {/* Missing alert */}
        {data && totalMissing > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-base text-amber-800 dark:text-amber-200">
                  Missing Costing Data
                </CardTitle>
              </div>
              <CardDescription className="text-amber-700 dark:text-amber-300">
                {totalMissing} design pattern{totalMissing !== 1 ? 's' : ''} need costing — export to fill them in bulk
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* ── Import / Export card ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base">Import / Export</CardTitle>
                <CardDescription>Bulk manage costing via CSV or Excel</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Template
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}
                  disabled={!data || (totalEntries === 0 && totalMissing === 0)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export All
                  {data && (totalEntries + totalMissing) > 0 && (
                    <span className="ml-1.5 flex items-center gap-1">
                      {totalEntries > 0 && (
                        <Badge className="px-1.5 py-0 text-xs bg-green-600">{totalEntries} filled</Badge>
                      )}
                      {totalMissing > 0 && (
                        <Badge className="px-1.5 py-0 text-xs bg-amber-500">{totalMissing} empty</Badge>
                      )}
                    </span>
                  )}
                </Button>
                <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Import
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {showImportPreview && importRows.length > 0 ? (
              <div className="rounded-xl border overflow-hidden">
                {/* Preview header */}
                <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/40">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-green-700 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      {validImportCount} valid
                    </span>
                    {invalidImportCount > 0 && (
                      <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                        <AlertCircle className="h-4 w-4" />
                        {invalidImportCount} skipped
                      </span>
                    )}
                  </div>
                  <button onClick={() => { setImportRows([]); setShowImportPreview(false) }}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Preview table */}
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Design Pattern</TableHead>
                        <TableHead className="text-right">Landed Cost</TableHead>
                        <TableHead className="pr-4">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map((row, idx) => (
                        <TableRow key={idx} className={!row.valid ? 'opacity-40' : ''}>
                          <TableCell className="pl-4 font-mono text-sm">{row.design_pattern || '—'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {row.valid ? `Rs ${row.landed_cost}` : '—'}
                          </TableCell>
                          <TableCell className="pr-4">
                            {row.valid
                              ? <Badge className="text-xs bg-green-600">Ready</Badge>
                              : <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">{row.error}</Badge>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Preview footer */}
                <div className="px-4 py-3 border-t bg-muted/20 flex justify-end gap-2">
                  <Button variant="outline" size="sm"
                    onClick={() => { setImportRows([]); setShowImportPreview(false) }}
                    disabled={isImporting}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleConfirmImport}
                    disabled={validImportCount === 0 || isImporting}>
                    {isImporting
                      ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Importing…</>
                      : <><Upload className="mr-1.5 h-3.5 w-3.5" />Import {validImportCount} entries</>
                    }
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Export All</strong> downloads every design pattern — filled ones with their cost, missing ones with a blank cost column.
                Open the file in Excel, fill in the missing prices, then re-import.
                Supports <code className="bg-muted px-1 py-0.5 rounded">.csv</code> and <code className="bg-muted px-1 py-0.5 rounded">.xlsx</code>.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Add / Edit single entry ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add or Update Costing</CardTitle>
            <CardDescription>Set landed cost for a single design pattern</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="pattern-select">Design Pattern</Label>
                <Select value={selectedPattern} onValueChange={(value) => {
                  setSelectedPattern(value)
                  setCostValue(data?.costingDict[value] ? data.costingDict[value].toString() : '')
                }}>
                  <SelectTrigger id="pattern-select" className="mt-1">
                    <SelectValue placeholder="Select a pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.missingPatterns.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Missing Costing</div>
                        {data.missingPatterns.filter(p => p !== '').map(pattern => (
                          <SelectItem key={pattern} value={pattern}>
                            <span className="text-amber-600">{pattern}</span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {data?.existingPatterns.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Existing Costing</div>
                        {data.existingPatterns.filter(p => p !== '').map(pattern => (
                          <SelectItem key={pattern} value={pattern}>{pattern}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label htmlFor="cost-input">Landed Cost (Rs)</Label>
                <Input
                  id="cost-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={costValue}
                  onChange={(e) => setCostValue(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <Button onClick={handleSaveCosting} disabled={!selectedPattern || !costValue || isSaving}>
                {isSaving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                  : <><Save className="mr-2 h-4 w-4" />Save Costing</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Full costing table (filled + missing together) ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base">All Design Patterns</CardTitle>
                <CardDescription>
                  {data
                    ? `${totalEntries} filled · ${totalMissing} missing`
                    : 'Loading…'}
                </CardDescription>
              </div>
              {(totalEntries + totalMissing) > 0 && (
                <Button variant="ghost" size="sm" onClick={handleExport} className="text-muted-foreground">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : data && (totalEntries + totalMissing) > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Design Pattern</TableHead>
                      <TableHead className="text-right">Landed Cost</TableHead>
                      <TableHead className="pr-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Filled entries */}
                    {Object.entries(data.costingDict)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([pattern, cost]) => (
                        <TableRow
                          key={pattern}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedPattern(pattern)
                            setCostValue(cost.toString())
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                        >
                          <TableCell className="pl-4 font-mono text-sm">{pattern}</TableCell>
                          <TableCell className="text-right font-medium">
                            Rs {cost.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="pr-4">
                            <Badge className="bg-green-600 text-xs">Filled</Badge>
                          </TableCell>
                        </TableRow>
                      ))}

                    {/* Missing entries */}
                    {data.missingPatterns
                      .sort()
                      .filter(p => p !== '')
                      .map(pattern => (
                        <TableRow
                          key={pattern}
                          className="cursor-pointer hover:bg-amber-50 bg-amber-50/40"
                          onClick={() => {
                            setSelectedPattern(pattern)
                            setCostValue('')
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                        >
                          <TableCell className="pl-4 font-mono text-sm text-amber-800">{pattern}</TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm italic">
                            — not set
                          </TableCell>
                          <TableCell className="pr-4">
                            <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                              Missing
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">
                  No patterns found. Add SKU mappings first.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </>
  )
}
