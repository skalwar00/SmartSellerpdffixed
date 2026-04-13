'use client'

import { useState, useCallback, Fragment, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardHeader } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  Download, Save, RefreshCw, Loader2, Package, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Plus, X, Send, Trash2, Copy, Radio,
  FileSpreadsheet, Upload, Edit2, Search, Link2,
} from 'lucide-react'
import useSWR, { mutate } from 'swr'
import * as XLSX from 'xlsx'

function SearchableSelect({
  value,
  options,
  placeholder = 'Select...',
  onChange,
  className,
  tabIndex,
}: {
  value: string
  options: string[]
  placeholder?: string
  onChange: (v: string) => void
  className?: string
  tabIndex?: number
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 0) }
    else { setQuery('') }
  }, [open])

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        tabIndex={tabIndex}
        onClick={() => setOpen(o => !o)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={value ? 'truncate' : 'text-muted-foreground truncate'}>{value || placeholder}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-md border bg-popover shadow-md">
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search SKU..."
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">No results found</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false) }}
                  className={`flex w-full items-center px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground ${opt === value ? 'bg-accent/60 font-medium' : ''}`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

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
  comboExpanded?: boolean
  comboSkus?: string[]
}

interface SavedMapping {
  portalSku: string
  masterSku: string
  comboSkus: string[]
}

interface LiveItem {
  master_sku: string
  total_qty: number
  picked_qty: number
  status: 'pending' | 'picked' | 'updated'
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
  const isComboEnabled = (user.user_metadata?.is_combo_enabled as boolean) ?? false
  const comboMappings = (user.user_metadata?.combo_mappings as Record<string, string[]>) || {}
  return { mappingDict, masterOptions, userId: user.id, isComboEnabled, comboMappings }
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
  const [isPushing, setIsPushing] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [liveItems, setLiveItems] = useState<LiveItem[]>([])
  const [liveLastSynced, setLiveLastSynced] = useState<Date | null>(null)
  const [liveAutoSyncing, setLiveAutoSyncing] = useState(false)
  const [shortUserId, setShortUserId] = useState<string | null>(null)
  const [securityPin, setSecurityPin] = useState<string | null>(null)
  const isProcessing = isSyncingMaster || isSavingMappings || isProcessingOrders || isGenerating
  const [masterFiles, setMasterFiles] = useState<File[]>([])
  const [orderFiles, setOrderFiles] = useState<File[]>([])
  const [isMasterOpen, setIsMasterOpen] = useState(false)

  // Manage Mappings state
  const [isManageMappingsOpen, setIsManageMappingsOpen] = useState(false)
  const [isViewEditOpen, setIsViewEditOpen] = useState(true)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [allMappings, setAllMappings] = useState<SavedMapping[]>([])
  const [isLoadingMappings, setIsLoadingMappings] = useState(false)
  const [mappingEdits, setMappingEdits] = useState<Record<string, string>>({})
  const [isSavingEdits, setIsSavingEdits] = useState(false)
  const [isDeletingMapping, setIsDeletingMapping] = useState<string | null>(null)
  const [mappingSearch, setMappingSearch] = useState('')
  const [importPreview, setImportPreview] = useState<{ portalSku: string; masterSku: string; status: 'new' | 'update' | 'duplicate' }[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isRegeneratingLink, setIsRegeneratingLink] = useState(false)

  const fetchLiveItems = useCallback(async (silent = false) => {
    if (!silent) setLiveAutoSyncing(true)
    try {
      const itemsRes = await fetch('/api/picklist/items')
      if (itemsRes.ok) {
        const itemsJson = await itemsRes.json()
        setLiveItems(itemsJson.items || [])
        setLiveLastSynced(new Date())
      }
    } catch { /* silent */ } finally {
      if (!silent) setLiveAutoSyncing(false)
    }
  }, [])

  // Setup: load short_user_id & pin + live items — only after auth is confirmed by SWR
  useEffect(() => {
    if (!data?.userId) return
    async function setup() {
      try {
        const setupRes = await fetch('/api/picklist/setup', { method: 'POST' })
        if (setupRes.ok) {
          const setupJson = await setupRes.json()
          setShortUserId(setupJson.short_user_id)
          setSecurityPin(setupJson.security_pin)
        }
      } catch { /* silent */ }
      await fetchLiveItems(true)
    }
    setup()
  }, [data?.userId, fetchLiveItems])

  // Auto-sync: Supabase Realtime + 15s polling fallback
  useEffect(() => {
    if (!data?.userId) return
    const supabase = createClient()

    const channel = supabase
      .channel('picklist_live_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'picklist_live' },
        () => { fetchLiveItems(true) }
      )
      .subscribe()

    const interval = setInterval(() => fetchLiveItems(true), 15000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [data?.userId, fetchLiveItems])

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

      const mappedOrders = allOrders.flatMap(order => {
        const comboSkus = data.comboMappings[order.Portal_SKU]
        if (comboSkus && comboSkus.length > 0) {
          return comboSkus.map(masterSku => ({ ...order, Master_SKU: masterSku }))
        }
        const masterSku = data.mappingDict[order.Portal_SKU]
        return [{ ...order, Master_SKU: masterSku ?? order.Portal_SKU }]
      })
      setOrders(mappedOrders)

      const unmapped = [...new Set(
        allOrders
          .filter(o => !data.mappingDict[o.Portal_SKU] && !data.comboMappings[o.Portal_SKU])
          .map(o => o.Portal_SKU)
      )]
      if (unmapped.length > 0 && data.masterOptions.length > 0) {
        const newMappingRows: MappingRow[] = unmapped.map(sku => {
          let bestMatch = data.masterOptions[0] || ''
          let bestScore = 0
          for (const masterSku of data.masterOptions) {
            const score = tokenSetRatio(sku, masterSku)
            if (score > bestScore) { bestScore = score; bestMatch = masterSku }
          }
          return {
            confirm: bestScore >= 90,
            portalSku: sku,
            masterSku: bestMatch,
            matchScore: bestScore,
            comboExpanded: false,
            comboSkus: [],
          }
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

    const file = masterFiles[0]
    const fileName = file.name.toLowerCase()

    // ── Parse file (CSV or XLSX/XLS) ──────────────────────────────────────────
    let rows: string[][]
    try {
      if (fileName.endsWith('.csv')) {
        const text = await file.text()
        rows = text
          .split('\n')
          .filter(l => l.trim())
          .map(line => parseCSVLine(line))
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]
      } else {
        toast.error('Unsupported file type. Use CSV, XLSX, or XLS.')
        return
      }
    } catch {
      toast.error('Failed to read file. Make sure it is a valid CSV or Excel file.')
      return
    }

    if (rows.length < 2) { toast.error('File is empty or has only headers'); return }

    // ── Smart column detection ────────────────────────────────────────────────
    const headers = rows[0].map(h => String(h ?? '').trim().toLowerCase())

    // Strict: only accept columns named exactly MASTER_SKU / master sku / mastersku
    const MASTER_SKU_VARIANTS = ['master_sku', 'master sku', 'mastersku']
    const skuColIdx = MASTER_SKU_VARIANTS.reduce<number>((found, kw) => {
      if (found !== -1) return found
      return headers.indexOf(kw)
    }, -1)

    if (skuColIdx === -1) {
      const foundHeaders = rows[0].slice(0, 8).map(h => `"${h}"`).join(', ')
      toast.error(
        `"MASTER_SKU" column nahi mila.\n` +
        `File ke columns: ${foundHeaders}.\n` +
        `Column ka naam exactly "MASTER_SKU" hona chahiye.`,
        { duration: 7000 }
      )
      return
    }

    // Optional image_url column
    const imageKeywords = ['image_url', 'image url', 'imageurl', 'image', 'photo_url', 'photo url', 'photo']
    const imageColIdx = imageKeywords.reduce<number>((found, kw) => {
      if (found !== -1) return found
      const idx = headers.indexOf(kw)
      return idx !== -1 ? idx : -1
    }, -1)

    // ── Extract SKUs + optional image URLs ────────────────────────────────────
    const skuImageMap: Record<string, string | null> = {}
    rows.slice(1).forEach(cols => {
      const sku = String(cols[skuColIdx] ?? '').trim().toUpperCase()
      if (!sku) return
      const imgUrl = imageColIdx !== -1
        ? (String(cols[imageColIdx] ?? '').trim() || null)
        : null
      if (!skuImageMap[sku]) skuImageMap[sku] = imgUrl
      else if (imgUrl && !skuImageMap[sku]) skuImageMap[sku] = imgUrl
    })
    const skus = Object.keys(skuImageMap)

    if (skus.length === 0) { toast.error('No SKUs found in file'); return }

    const snapshot = data
    mutate('user-data', { ...data, masterOptions: skus }, false)
    setMasterFiles([])

    const imageCount = Object.values(skuImageMap).filter(Boolean).length
    const msg = imageCount > 0
      ? `Synced ${skus.length} SKUs with ${imageCount} image URLs`
      : `Synced ${skus.length} master SKUs — auto-mapping in progress`
    toast.success(msg)

    setIsSyncingMaster(true)
    try {
      const supabase = createClient()

      // 1. Upsert SKUs into master_inventory (always safe)
      const inventoryRecords = skus.map(sku => ({ user_id: data.userId, master_sku: sku }))
      const { error: invError } = await supabase
        .from('master_inventory')
        .upsert(inventoryRecords, { onConflict: 'user_id, master_sku' })
      if (invError) throw invError

      // 2. Separately update image_url for rows that have one (non-critical, requires migration 004)
      const withImages = skus.filter(sku => skuImageMap[sku])
      if (withImages.length > 0) {
        for (const sku of withImages) {
          await supabase
            .from('master_inventory')
            .update({ image_url: skuImageMap[sku] })
            .eq('user_id', data.userId)
            .eq('master_sku', sku)
        }
      }

      // 3. Auto-create self-mappings for new SKUs only (never overwrite existing)
      const mappingRecords = skus.map(sku => ({
        user_id: data.userId,
        portal_sku: sku,
        master_sku: sku,
      }))
      await supabase
        .from('sku_mapping')
        .upsert(mappingRecords, { onConflict: 'user_id, portal_sku', ignoreDuplicates: true })

      mutate('user-data')
    } catch (err) {
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

    const prevOrders = orders
    const prevUnmapped = unmappedRows

    setOrders(prev => {
      const result: OrderData[] = []
      for (const order of prev) {
        const mapping = toSave.find(m => m.portalSku === order.Portal_SKU)
        if (mapping) {
          const allSkus = [mapping.masterSku, ...(mapping.comboSkus || []).filter(Boolean)]
          if (allSkus.length > 1) {
            allSkus.forEach(sku => result.push({ ...order, Master_SKU: sku }))
          } else {
            result.push({ ...order, Master_SKU: mapping.masterSku })
          }
        } else {
          result.push(order)
        }
      }
      return result
    })
    setUnmappedRows(prev => prev.filter(row => !row.confirm))
    toast.success(`Saved ${toSave.length} mapping${toSave.length !== 1 ? 's' : ''}`)

    setIsSavingMappings(true)
    try {
      const supabase = createClient()

      const comboRows = toSave.filter(row => (row.comboSkus || []).filter(Boolean).length > 0)
      if (comboRows.length > 0) {
        const { data: { user } } = await supabase.auth.getUser()
        const existingCombo = (user?.user_metadata?.combo_mappings as Record<string, string[]>) || {}
        const updatedCombo = {
          ...existingCombo,
          ...Object.fromEntries(
            comboRows.map(row => [
              row.portalSku,
              [row.masterSku, ...(row.comboSkus || []).filter(Boolean)],
            ])
          ),
        }
        await supabase.auth.updateUser({ data: { combo_mappings: updatedCombo } })
      }

      const records = toSave.map(row => ({
        user_id: data.userId,
        portal_sku: row.portalSku,
        master_sku: row.masterSku,
      }))
      const { error } = await supabase.from('sku_mapping').upsert(records, { onConflict: 'user_id, portal_sku' })
      if (error) throw error
      mutate('user-data')
    } catch (err) {
      setOrders(prevOrders)
      setUnmappedRows(prevUnmapped)
      toast.error('Save failed — changes reverted')
      console.error(err)
    } finally {
      setIsSavingMappings(false)
    }
  }

  // ── Manage Mappings handlers ──────────────────────────────────────────────

  const loadAllMappings = async () => {
    setIsLoadingMappings(true)
    try {
      const supabase = createClient()
      const [{ data: rows, error }, { data: userRes }] = await Promise.all([
        supabase
          .from('sku_mapping')
          .select('portal_sku, master_sku')
          .order('portal_sku', { ascending: true }),
        supabase.auth.getUser(),
      ])
      if (error) throw error
      const comboMappings = (userRes.user?.user_metadata?.combo_mappings as Record<string, string[]>) || {}
      setAllMappings((rows || []).map(r => {
        const comboValue =
          comboMappings[r.portal_sku] ||
          comboMappings[r.portal_sku.toUpperCase()] ||
          comboMappings[r.portal_sku.toLowerCase()] ||
          []
        return {
          portalSku: r.portal_sku,
          masterSku: r.master_sku,
          comboSkus: comboValue
            .filter(Boolean)
            .filter(sku => sku.toUpperCase() !== r.master_sku.toUpperCase()),
        }
      }))
      setMappingEdits({})
    } catch {
      toast.error('Failed to load mappings')
    } finally {
      setIsLoadingMappings(false)
    }
  }

  const handleManageMappingsToggle = () => {
    const opening = !isManageMappingsOpen
    setIsManageMappingsOpen(opening)
    if (opening && allMappings.length === 0) loadAllMappings()
  }

  const handleSaveEdits = async () => {
    if (!data || Object.keys(mappingEdits).length === 0) return
    setIsSavingEdits(true)
    try {
      const supabase = createClient()
      const { data: userRes } = await supabase.auth.getUser()
      const existingCombo = (userRes.user?.user_metadata?.combo_mappings as Record<string, string[]>) || {}
      const records = Object.entries(mappingEdits).map(([portalSku, masterSku]) => ({
        user_id: data.userId,
        portal_sku: portalSku,
        master_sku: masterSku,
      }))
      const { error } = await supabase.from('sku_mapping').upsert(records, { onConflict: 'user_id, portal_sku' })
      if (error) throw error
      const updatedCombo = { ...existingCombo }
      let comboChanged = false
      Object.entries(mappingEdits).forEach(([portalSku, masterSku]) => {
        const comboKey =
          updatedCombo[portalSku] ? portalSku :
          updatedCombo[portalSku.toUpperCase()] ? portalSku.toUpperCase() :
          updatedCombo[portalSku.toLowerCase()] ? portalSku.toLowerCase() :
          null
        if (!comboKey) return
        const current = updatedCombo[comboKey].filter(Boolean)
        const extraSkus = current.slice(1).filter(sku => sku.toUpperCase() !== masterSku.toUpperCase())
        updatedCombo[comboKey] = [masterSku, ...extraSkus]
        comboChanged = true
      })
      if (comboChanged) {
        await supabase.auth.updateUser({ data: { combo_mappings: updatedCombo } })
      }
      setAllMappings(prev => prev.map(m => mappingEdits[m.portalSku] ? { ...m, masterSku: mappingEdits[m.portalSku] } : m))
      setMappingEdits({})
      toast.success(`Saved ${records.length} mapping${records.length !== 1 ? 's' : ''}`)
      mutate('user-data')
    } catch {
      toast.error('Save failed')
    } finally {
      setIsSavingEdits(false)
    }
  }

  const handleDeleteMapping = async (portalSku: string) => {
    if (!data) return
    setIsDeletingMapping(portalSku)
    try {
      const supabase = createClient()
      const [{ error }, { data: userRes }] = await Promise.all([
        supabase
          .from('sku_mapping')
          .delete()
          .eq('user_id', data.userId)
          .eq('portal_sku', portalSku),
        supabase.auth.getUser(),
      ])
      if (error) throw error
      const existingCombo = (userRes.user?.user_metadata?.combo_mappings as Record<string, string[]>) || {}
      if (existingCombo[portalSku] || existingCombo[portalSku.toUpperCase()] || existingCombo[portalSku.toLowerCase()]) {
        const updatedCombo = { ...existingCombo }
        delete updatedCombo[portalSku]
        delete updatedCombo[portalSku.toUpperCase()]
        delete updatedCombo[portalSku.toLowerCase()]
        await supabase.auth.updateUser({ data: { combo_mappings: updatedCombo } })
      }
      setAllMappings(prev => prev.filter(m => m.portalSku !== portalSku))
      setMappingEdits(prev => { const n = { ...prev }; delete n[portalSku]; return n })
      toast.success('Mapping deleted')
      mutate('user-data')
    } catch {
      toast.error('Delete failed')
    } finally {
      setIsDeletingMapping(null)
    }
  }

  const handleExportMappings = () => {
    if (allMappings.length === 0) { toast.error('No mappings to export'); return }
    const wsData = [
      ['Portal SKU', 'Master SKU', 'Combo SKUs'],
      ...allMappings.map(m => [m.portalSku, m.masterSku, m.comboSkus.join(', ')]),
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 40 }, { wch: 40 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, ws, 'SKU Mappings')
    XLSX.writeFile(wb, 'sku_mappings.xlsx')
    toast.success(`Exported ${allMappings.length} mappings`)
  }

  const handleImportFileChange = async (file: File | null) => {
    setImportFile(file)
    setImportPreview([])
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]
      if (rows.length < 2) { toast.error('File has no data rows'); return }

      const existingMap = new Map(allMappings.map(m => [m.portalSku.toUpperCase(), m.masterSku]))
      const seen = new Set<string>()
      const preview: typeof importPreview = []

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const portalSku = String(row[0] || '').trim().toUpperCase()
        const masterSku = String(row[1] || '').trim().toUpperCase()
        if (!portalSku || !masterSku) continue

        if (seen.has(portalSku)) {
          preview.push({ portalSku, masterSku, status: 'duplicate' })
        } else {
          seen.add(portalSku)
          preview.push({ portalSku, masterSku, status: existingMap.has(portalSku) ? 'update' : 'new' })
        }
      }
      setImportPreview(preview)
    } catch {
      toast.error('Failed to parse file')
    }
  }

  const handleConfirmImport = async () => {
    if (!data || importPreview.length === 0) return
    const toImport = importPreview.filter(r => r.status !== 'duplicate')
    if (toImport.length === 0) { toast.error('No valid rows to import'); return }
    setIsImporting(true)
    try {
      const supabase = createClient()
      const records = toImport.map(r => ({ user_id: data.userId, portal_sku: r.portalSku, master_sku: r.masterSku }))
      const { error } = await supabase.from('sku_mapping').upsert(records, { onConflict: 'user_id, portal_sku' })
      if (error) throw error
      toast.success(`Imported ${toImport.length} mapping${toImport.length !== 1 ? 's' : ''}`)
      setImportPreview([])
      setImportFile(null)
      await loadAllMappings()
      mutate('user-data')
    } catch {
      toast.error('Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  // ── Aggregate mapped orders into master_sku -> total_qty
  const getAggregatedItems = () => {
    const agg: Record<string, number> = {}
    for (const order of orders) {
      if (order.Master_SKU) {
        agg[order.Master_SKU] = (agg[order.Master_SKU] || 0) + order.Qty
      }
    }
    return Object.entries(agg).map(([master_sku, total_qty]) => ({ master_sku, total_qty }))
  }

  const handlePushToLive = async () => {
    const items = getAggregatedItems()
    if (items.length === 0) {
      toast.error('No mapped orders to push')
      return
    }
    setIsPushing(true)
    try {
      const res = await fetch('/api/picklist/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error('Push failed')
      const json = await res.json()

      // Reload live items
      await fetchLiveItems(true)

      // Broadcast to packer via Supabase Realtime
      if (shortUserId) {
        const supabase = createClient()
        await supabase.channel(`picklist:${shortUserId}`).send({
          type: 'broadcast',
          event: 'picklist_update',
          payload: { items: [] },
        })
      }

      toast.success(`Pushed ${json.pushed} SKUs to live picklist!`)
    } catch (err) {
      toast.error('Failed to push picklist')
      console.error(err)
    } finally {
      setIsPushing(false)
    }
  }

  const handleResetPicklist = async () => {
    setIsResetting(true)
    try {
      const res = await fetch('/api/picklist/reset', { method: 'POST' })
      if (!res.ok) throw new Error('Reset failed')
      setLiveItems([])
      setShowResetConfirm(false)
      toast.success('Picklist reset successfully')
    } catch (err) {
      toast.error('Failed to reset picklist')
      console.error(err)
    } finally {
      setIsResetting(false)
    }
  }

  const handleCopyLink = () => {
    if (!shortUserId) return
    const link = `${window.location.origin}/packer/${shortUserId}`
    navigator.clipboard.writeText(link)
    toast.success('Packer link copied! Share on WhatsApp.')
  }

  const handleRegenerateLink = async () => {
    if (isRegeneratingLink) return
    setIsRegeneratingLink(true)
    try {
      const res = await fetch('/api/picklist/regenerate-link', { method: 'POST' })
      const json = await res.json()
      if (res.ok && json.short_user_id) {
        setShortUserId(json.short_user_id)
        const link = `${window.location.origin}/packer/${json.short_user_id}`
        navigator.clipboard.writeText(link)
        toast.success('New packer link generated & copied! Old link is now invalid.')
      } else {
        toast.error('Failed to regenerate link.')
      }
    } catch {
      toast.error('Failed to regenerate link.')
    } finally {
      setIsRegeneratingLink(false)
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

  const handleDownloadFromDB = async () => {
    if (liveItems.length === 0) { toast.error('No live picklist data in database'); return }
    setIsGenerating(true)
    try {
      const orders = liveItems.map(item => ({ Master_SKU: item.master_sku, Qty: item.total_qty }))
      const res = await fetch('/api/generate-picklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      })
      if (!res.ok) throw new Error('Failed to generate picklist')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `picklist-live.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Live picklist PDF downloaded!')
    } catch (err) {
      toast.error('Failed to generate picklist')
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  const updateRow = (idx: number, changes: Partial<MappingRow>) => {
    setUnmappedRows(prev => prev.map((r, i) => i === idx ? { ...r, ...changes } : r))
  }

  const addComboSku = (idx: number) => {
    setUnmappedRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const usedSkus = new Set([r.masterSku, ...(r.comboSkus || [])])
      const available = (data?.masterOptions || []).filter(o => o && !usedSkus.has(o))
      if (available.length === 0) return { ...r, comboSkus: [...(r.comboSkus || []), ''] }
      const portalTokens = r.portalSku.toUpperCase().split(/[-_()+\s]+/).filter(Boolean)
      const claimedTokens = new Set<string>()
      ;[r.masterSku, ...(r.comboSkus || [])].filter(Boolean).forEach(sku => {
        sku.toUpperCase().split(/[-_\s]+/).filter(Boolean).forEach(t => claimedTokens.add(t))
      })
      const isSize = (t: string) => /^\d+[A-Z]*$|^[SML]{1,2}$/.test(t)
      const uniqueTokens = portalTokens.filter(t => !claimedTokens.has(t))
      const sizeTokens   = portalTokens.filter(t => claimedTokens.has(t) && isSize(t))
      const query = [...uniqueTokens, ...sizeTokens].join(' ') || r.portalSku
      let bestMatch = available[0]
      let bestScore = 0
      for (const masterSku of available) {
        const score = tokenSetRatio(query, masterSku)
        if (score > bestScore) { bestScore = score; bestMatch = masterSku }
      }
      return { ...r, comboSkus: [...(r.comboSkus || []), bestMatch] }
    }))
  }

  const updateComboSku = (rowIdx: number, skuIdx: number, value: string) => {
    setUnmappedRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r
      const updated = [...(r.comboSkus || [])]
      updated[skuIdx] = value
      return { ...r, comboSkus: updated }
    }))
  }

  const removeComboSku = (rowIdx: number, skuIdx: number) => {
    setUnmappedRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r
      const updated = (r.comboSkus || []).filter((_, si) => si !== skuIdx)
      return { ...r, comboSkus: updated }
    }))
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
  const isComboEnabled = data?.isComboEnabled ?? false

  // Live picklist stats
  const liveTotalQty = liveItems.reduce((s, i) => s + i.total_qty, 0)
  const livePickedQty = liveItems.reduce((s, i) => s + i.picked_qty, 0)
  const livePickedItems = liveItems.filter(i => i.status === 'picked').length
  const livePct = liveTotalQty > 0 ? Math.round((livePickedQty / liveTotalQty) * 100) : 0

  return (
    <>
      <DashboardHeader
        title="Picklist Generator"
        description="Process orders and generate warehouse picklists"
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">

        {/* Live Picklist Panel */}
        <Card className={liveItems.length > 0 ? 'border-blue-200 bg-blue-50/30' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Radio className="h-4 w-4 text-blue-500" />
                Live Picklist
                {liveItems.length > 0 && (
                  <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700">
                    {liveItems.length} SKUs
                  </Badge>
                )}
                <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground ml-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  {liveAutoSyncing
                    ? 'syncing…'
                    : liveLastSynced
                    ? `synced ${liveLastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : 'auto-sync on'}
                </span>
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {shortUserId && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleCopyLink}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy Packer Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateLink}
                      disabled={isRegeneratingLink}
                      title="Generate a new packer link — old link will stop working"
                      className="border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      {isRegeneratingLink
                        ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      }
                      Change URL
                    </Button>
                  </>
                )}
                {liveItems.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleDownloadFromDB} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                      PDF from DB
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setShowResetConfirm(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Reset
                    </Button>
                  </>
                )}
              </div>
            </div>
            {securityPin && (
              <CardDescription>
                Packer PIN: <span className="font-mono font-bold text-foreground">{securityPin}</span>
                {shortUserId && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    · /packer/{shortUserId}
                  </span>
                )}
              </CardDescription>
            )}
          </CardHeader>

          {liveItems.length > 0 && (
            <CardContent className="pt-0 space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Progress: {livePickedItems}/{liveItems.length} SKUs picked</span>
                  <span className="font-semibold text-foreground">{livePct}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-green-500 transition-all duration-500"
                    style={{ width: `${livePct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {livePickedQty} of {liveTotalQty} units picked
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Pending', count: liveItems.filter(i => i.status === 'pending').length, color: 'text-gray-600' },
                  { label: 'Updated', count: liveItems.filter(i => i.status === 'updated').length, color: 'text-orange-600' },
                  { label: 'Picked', count: livePickedItems, color: 'text-green-600' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="rounded-lg bg-background border p-2">
                    <p className={`text-lg font-bold ${color}`}>{count}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}

          {liveItems.length === 0 && (
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">
                No active picklist. Upload orders and click "Push to Live Picklist" to start.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Reset Confirmation */}
        {showResetConfirm && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <p className="text-sm font-medium text-red-800 mb-3">
                Are you sure you want to reset the entire picklist? All {liveItems.length} items and picked progress will be deleted.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleResetPicklist}
                  disabled={isResetting}
                >
                  {isResetting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                  Yes, Reset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                accept=".csv,.xlsx,.xls"
                files={masterFiles}
                onFilesChange={setMasterFiles}
                disabled={isSyncingMaster}
                label="Drop your Master SKU file here or click to browse"
                hint='CSV, XLSX, XLS — column ka naam exactly "MASTER_SKU" hona zaroori hai (optional: "Image URL" column bhi add kar sakte hain)'
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
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={handlePushToLive}
                    disabled={mappedCount === 0 || isPushing}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isPushing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Push to Live Picklist
                  </Button>
                  <Button
                    onClick={handleGeneratePicklist}
                    disabled={mappedCount === 0 || isGenerating}
                    variant="outline"
                  >
                    {isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Generate 4×6 PDF
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


        {unmappedRows.length > 0 && data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                New SKU Mapping
                <Badge variant="outline">{unmappedRows.length} SKUs</Badge>
                {isComboEnabled && (
                  <Badge variant="secondary" className="text-xs">Combo Mode</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isComboEnabled
                  ? 'Click + to add multiple Master SKUs per portal SKU for combo/bundle products.'
                  : 'Review and confirm suggested mappings, then save to apply them.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background shadow-[0_1px_0_0_hsl(var(--border))] z-10">
                    <TableRow>
                      <TableHead className="w-10 pl-4">✓</TableHead>
                      <TableHead className="w-[200px]">Portal SKU</TableHead>
                      <TableHead>Master SKU</TableHead>
                      {isComboEnabled && <TableHead className="w-10" />}
                      <TableHead className="text-right pr-4 w-20">Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmappedRows.map((row, idx) => (
                      <Fragment key={idx}>
                        <TableRow
                          className={`transition-colors hover:bg-muted/50 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}
                        >
                          <TableCell
                            className="pl-4 cursor-pointer select-none"
                            onClick={() => updateRow(idx, { confirm: !row.confirm })}
                          >
                            <Checkbox
                              checked={row.confirm}
                              tabIndex={0}
                              onCheckedChange={(checked) => updateRow(idx, { confirm: !!checked })}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell
                            className="font-mono text-sm cursor-pointer select-none"
                            onClick={() => updateRow(idx, { confirm: !row.confirm })}
                          >
                            {row.portalSku}
                          </TableCell>
                          <TableCell>
                            <SearchableSelect
                              value={row.masterSku}
                              options={data.masterOptions.filter(o => o !== '')}
                              placeholder="Select master SKU"
                              onChange={(value) => updateRow(idx, { masterSku: value })}
                              className="w-full"
                              tabIndex={0}
                            />
                          </TableCell>
                          {isComboEnabled && (
                            <TableCell>
                              <button
                                tabIndex={0}
                                onClick={() => updateRow(idx, { comboExpanded: !row.comboExpanded })}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground transition-colors hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                                title="Add combo SKUs"
                              >
                                {row.comboExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <Plus className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </TableCell>
                          )}
                          <TableCell className="text-right pr-4">
                            <Badge
                              variant={
                                row.matchScore >= 90 ? 'default'
                                  : row.matchScore >= 70 ? 'secondary'
                                  : 'outline'
                              }
                              className="text-xs"
                            >
                              {row.matchScore}%
                            </Badge>
                          </TableCell>
                        </TableRow>

                        {isComboEnabled && row.comboExpanded && (
                          <TableRow className={idx % 2 !== 0 ? 'bg-muted/20' : ''}>
                            <TableCell />
                            <TableCell colSpan={3} className="py-2 pr-4">
                              <div className="flex flex-col gap-2 border-l-2 border-blue-200 pl-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Additional Master SKUs (combo components)
                                </p>
                                {(row.comboSkus || []).map((sku, si) => (
                                  <div key={si} className="flex items-center gap-2">
                                    <SearchableSelect
                                      value={sku}
                                      options={data.masterOptions.filter(o => o !== '')}
                                      placeholder="Select SKU"
                                      onChange={(value) => updateComboSku(idx, si, value)}
                                      className="flex-1"
                                      tabIndex={0}
                                    />
                                    <button
                                      tabIndex={0}
                                      onClick={() => removeComboSku(idx, si)}
                                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-1"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  tabIndex={0}
                                  onClick={() => addComboSku(idx)}
                                  className="flex items-center gap-1.5 self-start rounded-md border border-dashed border-blue-300 px-2.5 py-1 text-xs text-blue-600 transition-colors hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add SKU
                                </button>
                              </div>
                            </TableCell>
                            {isComboEnabled && <TableCell />}
                          </TableRow>
                        )}
                      </Fragment>
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

        {/* ── Manage Mappings Card (last, expandable) ─────────────────────── */}
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={handleManageMappingsToggle}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                Manage SKU Mappings
              </CardTitle>
              <div className="flex items-center gap-2">
                {allMappings.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Link2 className="h-3 w-3" />
                    {allMappings.length} saved
                  </Badge>
                )}
                {isManageMappingsOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            <CardDescription>
              View, edit, delete, export or bulk-import your SKU mappings
            </CardDescription>
          </CardHeader>

          {isManageMappingsOpen && (
            <CardContent className="space-y-3 pt-0">

              {/* Sub-section: View & Edit */}
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setIsViewEditOpen(o => !o)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors rounded-lg"
                >
                  <span className="flex items-center gap-2">
                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                    View &amp; Edit
                    {Object.keys(mappingEdits).length > 0 && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                        {Object.keys(mappingEdits).length} unsaved
                      </Badge>
                    )}
                  </span>
                  {isViewEditOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isViewEditOpen && (
                  <div className="border-t">
                    {isLoadingMappings ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading mappings…
                      </div>
                    ) : allMappings.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">No mappings saved yet.</p>
                    ) : (
                      <>
                        <div className="px-4 py-3 border-b">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                              value={mappingSearch}
                              onChange={e => setMappingSearch(e.target.value)}
                              placeholder="Search by Portal SKU or Master SKU…"
                              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>
                        <div className="max-h-[400px] overflow-auto">
                          <Table>
                            <TableHeader className="sticky top-0 bg-background shadow-[0_1px_0_0_hsl(var(--border))] z-10">
                              <TableRow>
                                <TableHead className="pl-4">Portal SKU</TableHead>
                                <TableHead>Master SKU / Combo</TableHead>
                                <TableHead className="w-12 pr-4" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {allMappings
                                .filter(m =>
                                  !mappingSearch ||
                                  m.portalSku.toLowerCase().includes(mappingSearch.toLowerCase()) ||
                                  m.masterSku.toLowerCase().includes(mappingSearch.toLowerCase()) ||
                                  m.comboSkus.some(sku => sku.toLowerCase().includes(mappingSearch.toLowerCase()))
                                )
                                .map((m, idx) => (
                                  <TableRow key={m.portalSku} className={idx % 2 !== 0 ? 'bg-muted/20' : ''}>
                                    <TableCell className="pl-4 font-mono text-sm">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span>{m.portalSku}</span>
                                        {m.comboSkus.length > 0 && (
                                          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-xs text-purple-700">
                                            Combo
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-2">
                                        <SearchableSelect
                                          value={mappingEdits[m.portalSku] ?? m.masterSku}
                                          options={data?.masterOptions.filter(o => o !== '') || []}
                                          placeholder="Select master SKU"
                                          onChange={(v) => setMappingEdits(prev => ({ ...prev, [m.portalSku]: v }))}
                                          className="w-full"
                                        />
                                        {m.comboSkus.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-xs text-muted-foreground">Combo:</span>
                                            {m.comboSkus.map(sku => (
                                              <Badge key={sku} variant="secondary" className="font-mono text-[11px]">
                                                {sku}
                                              </Badge>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="pr-4">
                                      <button
                                        onClick={() => handleDeleteMapping(m.portalSku)}
                                        disabled={isDeletingMapping === m.portalSku}
                                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                                        title="Delete mapping"
                                      >
                                        {isDeletingMapping === m.portalSku
                                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          : <Trash2 className="h-3.5 w-3.5" />}
                                      </button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                        {Object.keys(mappingEdits).length > 0 && (
                          <div className="border-t px-4 py-3 flex items-center justify-between">
                            <span className="text-sm text-amber-600">
                              {Object.keys(mappingEdits).length} unsaved change{Object.keys(mappingEdits).length !== 1 ? 's' : ''}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMappingEdits({})}
                                disabled={isSavingEdits}
                              >
                                Discard
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveEdits}
                                disabled={isSavingEdits}
                              >
                                {isSavingEdits ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Sub-section: Export */}
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setIsExportOpen(o => !o)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors rounded-lg"
                >
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    Export to Excel
                  </span>
                  {isExportOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isExportOpen && (
                  <div className="border-t px-4 py-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Download all saved mappings as an Excel file. You can edit it and re-import to bulk update.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleExportMappings}
                      disabled={allMappings.length === 0}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download sku_mappings.xlsx
                    </Button>
                  </div>
                )}
              </div>

              {/* Sub-section: Import */}
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(o => !o)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors rounded-lg"
                >
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    Import &amp; Bulk Update
                  </span>
                  {isImportOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isImportOpen && (
                  <div className="border-t px-4 py-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Upload an Excel file with two columns: <span className="font-mono font-medium">Portal SKU</span> and <span className="font-mono font-medium">Master SKU</span>. Existing mappings will be updated, new ones will be added. Duplicate rows within the file are skipped.
                    </p>
                    <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/10 px-4 py-8 cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/20 transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {importFile ? importFile.name : 'Click to upload .xlsx or .csv file'}
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={e => handleImportFileChange(e.target.files?.[0] || null)}
                      />
                    </label>

                    {importPreview.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm flex-wrap">
                          <span className="text-green-700 font-medium">
                            {importPreview.filter(r => r.status === 'new').length} new
                          </span>
                          <span className="text-blue-700 font-medium">
                            {importPreview.filter(r => r.status === 'update').length} update
                          </span>
                          {importPreview.filter(r => r.status === 'duplicate').length > 0 && (
                            <span className="text-amber-700 font-medium">
                              {importPreview.filter(r => r.status === 'duplicate').length} duplicate (skipped)
                            </span>
                          )}
                        </div>
                        <div className="max-h-[280px] overflow-auto rounded-md border">
                          <Table>
                            <TableHeader className="sticky top-0 bg-background shadow-[0_1px_0_0_hsl(var(--border))] z-10">
                              <TableRow>
                                <TableHead className="pl-4">Portal SKU</TableHead>
                                <TableHead>Master SKU</TableHead>
                                <TableHead className="pr-4 w-24">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {importPreview.map((r, idx) => (
                                <TableRow key={idx} className={idx % 2 !== 0 ? 'bg-muted/20' : ''}>
                                  <TableCell className="pl-4 font-mono text-sm">{r.portalSku}</TableCell>
                                  <TableCell className="font-mono text-sm">{r.masterSku}</TableCell>
                                  <TableCell className="pr-4">
                                    <Badge
                                      variant="outline"
                                      className={
                                        r.status === 'new' ? 'border-green-300 text-green-700'
                                          : r.status === 'update' ? 'border-blue-300 text-blue-700'
                                          : 'border-amber-300 text-amber-700'
                                      }
                                    >
                                      {r.status === 'new' ? 'New' : r.status === 'update' ? 'Update' : 'Duplicate'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setImportPreview([]); setImportFile(null) }}
                            disabled={isImporting}
                          >
                            Clear
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleConfirmImport}
                            disabled={isImporting || importPreview.filter(r => r.status !== 'duplicate').length === 0}
                          >
                            {isImporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                            Confirm Import ({importPreview.filter(r => r.status !== 'duplicate').length} rows)
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </CardContent>
          )}
        </Card>

      </div>
    </>
  )
}
