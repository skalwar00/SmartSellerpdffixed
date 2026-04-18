'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Upload, Search, X, CheckCircle2, Link2, Plus, Eye, Trash2,
  Edit2, Check, ChevronDown, ChevronUp, ImageIcon, AlertCircle,
  Loader2, Sparkles, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DashboardHeader } from '@/components/dashboard/sidebar'

const SIZE_CATALOG = [
  'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL', 'FREESIZE',
  '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48',
]
const DEFAULT_VISIBLE_SIZE_COUNT = SIZE_CATALOG.indexOf('4XL') + 1

const SIZES_DETECT_CLIENT = [
  'FREESIZE', 'FREE-SIZE', 'FREESZ',
  'XXXXL', 'XXXL', '10XL', '9XL', '8XL', '7XL', '6XL', '5XL', '4XL', '3XL', 'XXL', '2XL', 'XL',
  'FS', 'XS', 'L', 'M', 'S',
  '48', '46', '44', '42', '40', '38', '36', '34', '32', '30', '28', '26',
]

function extractSizeFromSku(sku: string): string {
  const upper = sku.toUpperCase()
  for (const sz of SIZES_DETECT_CLIENT) {
    if (upper.endsWith('-' + sz) || upper.endsWith('_' + sz)) return sz
  }
  return ''
}

function extractBaseFromMasterSku(sku: string): string {
  const upper = sku.toUpperCase()
  for (const sz of SIZES_DETECT_CLIENT) {
    if (upper.endsWith('-' + sz) || upper.endsWith('_' + sz)) {
      return sku.slice(0, sku.length - sz.length - 1).replace(/[-_]+$/, '').toUpperCase()
    }
  }
  return sku.toUpperCase()
}

interface DesignGroup {
  baseSku: string
  portalSkus: string[]
  sizes: string[]
  imageUrl: string
  alreadyMapped: boolean
  unmappedCount: number
  suggestedMasterSku?: string
  suggestScore?: number
}

interface DesignAction {
  action: 'create' | 'link' | 'skip'
  selectedSizes: string[]
  linkedMasterSku: string
  imageUrl: string
}

interface InventoryItem {
  id: string
  master_sku: string
  image_url: string | null
  created_at: string
}

export default function SmartMasterSkuPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [designs, setDesigns] = useState<DesignGroup[]>([])
  const [parseStats, setParseStats] = useState<{ totalSkus: number; newCount: number; skuColumn: string; imageColumn: string | null; sampleSkus: string[] } | null>(null)
  const [designActions, setDesignActions] = useState<Record<string, DesignAction>>({})
  const [extraVisibleSizeCounts, setExtraVisibleSizeCounts] = useState<Record<string, number>>({})
  const [expandedDesign, setExpandedDesign] = useState<string | null>(null)
  const [isSavingAll, setIsSavingAll] = useState(false)

  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isLoadingInventory, setIsLoadingInventory] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [imagePopup, setImagePopup] = useState<{ item: InventoryItem } | null>(null)
  const [editImageUrl, setEditImageUrl] = useState('')
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [inventorySearch, setInventorySearch] = useState<string[]>([])

  // ── Manual Create state ────────────────────────────────────────────────────
  const [manualBaseSku, setManualBaseSku] = useState('')
  const [manualSelectedSizes, setManualSelectedSizes] = useState<string[]>([])
  const [manualImageUrl, setManualImageUrl] = useState('')
  const [isSavingManual, setIsSavingManual] = useState(false)
  const [manualExtraVisible, setManualExtraVisible] = useState(0)

  const fetchInventory = useCallback(async () => {
    setIsLoadingInventory(true)
    try {
      const res = await fetch('/api/master-sku/inventory')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setInventory(json.data || [])
    } catch {
      toast.error('Failed to load inventory')
    } finally {
      setIsLoadingInventory(false)
    }
  }, [])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  // Inventory SKUs for the "Link to Existing" dropdown
  useEffect(() => {
    setInventorySearch(inventory.map(i => i.master_sku))
  }, [inventory])

  const applyParseResult = (json: { designs: DesignGroup[]; totalSkus: number; newCount: number; detectedSkuColumn?: string; detectedImageColumn?: string | null; sampleSkus?: string[] }) => {
    setDesigns(json.designs)
    setParseStats({ totalSkus: json.totalSkus, newCount: json.newCount, skuColumn: json.detectedSkuColumn || '?', imageColumn: json.detectedImageColumn || null, sampleSkus: json.sampleSkus || [] })
    const initial: Record<string, DesignAction> = {}
    for (const d of json.designs) {
      if (d.alreadyMapped || d.suggestScore === 100) {
        initial[d.baseSku] = { action: 'skip', selectedSizes: d.sizes, linkedMasterSku: '', imageUrl: d.imageUrl }
      } else if (d.suggestedMasterSku) {
        initial[d.baseSku] = { action: 'link', selectedSizes: d.sizes, linkedMasterSku: d.suggestedMasterSku, imageUrl: d.imageUrl }
      } else {
        initial[d.baseSku] = { action: 'create', selectedSizes: d.sizes, linkedMasterSku: '', imageUrl: d.imageUrl }
      }
    }
    setDesignActions(initial)
    setExtraVisibleSizeCounts({})
    if (json.newCount === 0) toast.info('All portal SKUs in this file are already mapped!')
    else toast.success(`Found ${json.newCount} new design${json.newCount !== 1 ? 's' : ''} to process`)
  }

  const handleFile = async (file: File) => {
    if (!file) return
    const allowed = ['.csv', '.xls', '.xlsx']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowed.includes(ext)) {
      toast.error('Only CSV, XLS, or XLSX files are supported')
      return
    }
    setIsParsing(true)
    setDesigns([])
    setParseStats(null)
    setDesignActions({})
    setExtraVisibleSizeCounts({})
    setAvailableSheets([])
    setPendingFile(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/master-sku/parse', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Parse failed')

      // Multi-sheet file — store file and show sheet picker
      if (json.sheets) {
        setPendingFile(file)
        setAvailableSheets(json.sheets)
        toast.info(`This file has ${json.sheets.length} sheets — please select one below`)
        return
      }

      applyParseResult(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Parse failed')
    } finally {
      setIsParsing(false)
    }
  }

  const handleSheetSelect = async (sheetName: string) => {
    if (!pendingFile) return
    setIsParsing(true)
    setAvailableSheets([])
    setDesigns([])
    setParseStats(null)
    setDesignActions({})
    setExtraVisibleSizeCounts({})
    try {
      const fd = new FormData()
      fd.append('file', pendingFile)
      fd.append('sheetName', sheetName)
      const res = await fetch('/api/master-sku/parse', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Parse failed')
      applyParseResult(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Parse failed')
    } finally {
      setIsParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const setAction = (baseSku: string, patch: Partial<DesignAction>) => {
    setDesignActions(prev => ({ ...prev, [baseSku]: { ...prev[baseSku], ...patch } }))
  }

  const toggleSize = (baseSku: string, size: string) => {
    const current = designActions[baseSku]?.selectedSizes || []
    const next = current.includes(size) ? current.filter(s => s !== size) : [...current, size]
    setAction(baseSku, { selectedSizes: next })
  }

  const showNextSize = (baseSku: string) => {
    setExtraVisibleSizeCounts(prev => ({ ...prev, [baseSku]: (prev[baseSku] || 0) + 1 }))
  }

  const handleSaveAll = async () => {
    const toProcess = designs.filter(d => !d.alreadyMapped && designActions[d.baseSku]?.action !== 'skip')
    if (toProcess.length === 0) { toast.info('Nothing to save'); return }

    setIsSavingAll(true)
    try {
      const inventoryRecords: { master_sku: string; image_url?: string }[] = []
      const mappingRecords: { portal_sku: string; master_sku: string }[] = []
      let skippedCount = 0

      for (const design of toProcess) {
        const act = designActions[design.baseSku]
        if (!act) continue

        if (act.action === 'create') {
          const sizes = act.selectedSizes
          if (sizes.length === 0) {
            // No sizes — create single record with base SKU
            inventoryRecords.push({ master_sku: design.baseSku, image_url: act.imageUrl || undefined })
            for (const portalSku of design.portalSkus) {
              mappingRecords.push({ portal_sku: portalSku, master_sku: design.baseSku.toUpperCase() })
            }
          } else {
            for (const size of sizes) {
              const masterSku = `${design.baseSku}-${size}`.toUpperCase()
              inventoryRecords.push({ master_sku: masterSku, image_url: act.imageUrl || undefined })
            }
            // Map each portal SKU to its corresponding master SKU
            for (const portalSku of design.portalSkus) {
              const upperPortal = portalSku.toUpperCase()
              // Find which size this portal SKU corresponds to
              const matchedSize = sizes.find(sz =>
                upperPortal.endsWith('-' + sz) || upperPortal.endsWith('_' + sz)
              )
              const masterSku = matchedSize
                ? `${design.baseSku}-${matchedSize}`.toUpperCase()
                : design.baseSku.toUpperCase()
              mappingRecords.push({ portal_sku: portalSku, master_sku: masterSku })
            }
          }
        } else if (act.action === 'link') {
          if (!act.linkedMasterSku.trim()) {
            toast.error(`Please choose a master SKU to link "${design.baseSku}" to`)
            setIsSavingAll(false)
            return
          }
          const linkedBase = extractBaseFromMasterSku(act.linkedMasterSku.trim())
          const inventorySkuSet = new Set(inventory.map(i => i.master_sku.toUpperCase()))
          for (const portalSku of design.portalSkus) {
            const detectedSize = extractSizeFromSku(portalSku)
            if (detectedSize) {
              // Size wala portal SKU: sirf tab map karo jab exact size variant inventory mein ho
              // Agar PT001-OLIVE-2XL inventory mein nahi hai toh skip — galat size pe map mat karo
              const sizeVariant = `${linkedBase}-${detectedSize}`
              if (inventorySkuSet.has(sizeVariant)) {
                mappingRecords.push({ portal_sku: portalSku, master_sku: sizeVariant })
              } else {
                skippedCount++ // master inventory mein ye size nahi — skip
              }
            } else {
              // Size nahi detect hua: directly selected master SKU se map karo
              mappingRecords.push({ portal_sku: portalSku, master_sku: act.linkedMasterSku.trim().toUpperCase() })
            }
          }
        }
      }

      // 1. Batch insert inventory
      if (inventoryRecords.length > 0) {
        const res = await fetch('/api/master-sku/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: inventoryRecords }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
      }

      // 2. Batch insert sku_mappings via existing upsert pattern
      if (mappingRecords.length > 0) {
        const res = await fetch('/api/sku-mapping/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings: mappingRecords }),
        })
        // If no batch route, fall back to individual saves via supabase client
        if (!res.ok) {
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const records = mappingRecords.map(r => ({
              user_id: user.id,
              portal_sku: r.portal_sku,
              master_sku: r.master_sku,
              combo_skus: [],
            }))
            await supabase.from('sku_mapping').upsert(records, { onConflict: 'user_id, portal_sku' })
          }
        }
      }

      const skippedMsg = skippedCount > 0 ? ` · ${skippedCount} size${skippedCount !== 1 ? 's' : ''} skipped (not in inventory)` : ''
      toast.success(`Saved ${inventoryRecords.length} master SKU${inventoryRecords.length !== 1 ? 's' : ''} + ${mappingRecords.length} mapping${mappingRecords.length !== 1 ? 's' : ''}${skippedMsg}`)
      setDesigns([])
      setParseStats(null)
      setDesignActions({})
      setExtraVisibleSizeCounts({})
      await fetchInventory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSavingAll(false)
    }
  }

  // ── Manual Create handler ──────────────────────────────────────────────────

  const handleManualCreate = async () => {
    const base = manualBaseSku.trim().toUpperCase().replace(/[-_]+$/, '')
    if (!base) { toast.error('Base SKU name dalo'); return }
    if (manualSelectedSizes.length === 0) { toast.error('Kam se kam ek size select karo'); return }

    // Duplicate check — existing inventory se compare karo
    const existingSkuSet = new Set(inventory.map(i => i.master_sku.toUpperCase()))
    const duplicates = manualSelectedSizes.filter(sz => existingSkuSet.has(`${base}-${sz}`))
    const newSizes = manualSelectedSizes.filter(sz => !existingSkuSet.has(`${base}-${sz}`))

    if (duplicates.length > 0 && newSizes.length === 0) {
      toast.error(`Ye SKUs pehle se exist karte hain: ${duplicates.map(sz => `${base}-${sz}`).join(', ')}`)
      return
    }
    if (duplicates.length > 0) {
      toast.warning(`${duplicates.length} SKU already exist — skip kar diye: ${duplicates.map(sz => `${base}-${sz}`).join(', ')}`)
    }

    setIsSavingManual(true)
    try {
      const records = newSizes.map(sz => ({
        master_sku: `${base}-${sz}`,
        image_url: manualImageUrl.trim() || undefined,
      }))
      const res = await fetch('/api/master-sku/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`${records.length} Master SKU${records.length !== 1 ? 's' : ''} create ho gaye`)
      setManualBaseSku('')
      setManualSelectedSizes([])
      setManualImageUrl('')
      setManualExtraVisible(0)
      await fetchInventory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setIsSavingManual(false)
    }
  }

  // ── Inventory table actions ────────────────────────────────────────────────

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id)
    setEditValue(item.master_sku)
  }

  const saveEdit = async (id: string) => {
    if (!editValue.trim()) return
    setIsSavingEdit(true)
    try {
      const res = await fetch(`/api/master-sku/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master_sku: editValue }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setInventory(prev => prev.map(i => i.id === id ? { ...i, master_sku: editValue.toUpperCase().trim() } : i))
      setEditingId(null)
      toast.success('SKU updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const deleteItem = async (id: string) => {
    setIsDeletingId(id)
    try {
      const res = await fetch(`/api/master-sku/inventory/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setInventory(prev => prev.filter(i => i.id !== id))
      toast.success('Deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsDeletingId(null)
    }
  }

  const saveImageUrl = async () => {
    if (!imagePopup) return
    setIsSavingImage(true)
    try {
      const res = await fetch(`/api/master-sku/inventory/${imagePopup.item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: editImageUrl }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setInventory(prev => prev.map(i => i.id === imagePopup.item.id ? { ...i, image_url: editImageUrl || null } : i))
      setImagePopup(null)
      toast.success('Image URL updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setIsSavingImage(false)
    }
  }

  const filteredInventory = inventory.filter(i =>
    i.master_sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const newDesigns = designs.filter(d => !d.alreadyMapped)
  const alreadyMappedDesigns = designs.filter(d => d.alreadyMapped)
  const pendingCount = newDesigns.filter(d => designActions[d.baseSku]?.action !== 'skip').length

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Smart Master SKU"
        description="Onboard new products and manage your master inventory"
      />

      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 space-y-8">

        {/* ── Section 1: Upload Wizard ─────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Smart CSV / XLS Onboarding</h2>
              <p className="text-xs text-gray-500">Upload a marketplace file to detect new designs and batch-create master SKUs</p>
            </div>
          </div>

          <div className="p-6">
            {/* Dropzone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-all ${
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40'
              }`}
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-sm font-medium text-gray-600">Analysing file…</p>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow">
                    <Upload className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Drop your marketplace CSV or Excel here</p>
                    <p className="mt-0.5 text-xs text-gray-400">Supports Flipkart, Myntra, Meesho exports · CSV, XLS, XLSX</p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }}
              />
            </div>

            {/* Sheet picker — shown when multi-sheet XLS is uploaded */}
            {availableSheets.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800 mb-3">
                  This file has {availableSheets.length} sheets — select the one with your product data:
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableSheets.map(sheet => (
                    <button
                      key={sheet}
                      onClick={() => handleSheetSelect(sheet)}
                      disabled={isParsing}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                    >
                      {isParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                      {sheet}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-amber-600">
                  File: {pendingFile?.name}
                </p>
              </div>
            )}

            {/* Parse results */}
            {parseStats && (
              <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm space-y-1.5">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="font-semibold text-blue-800">{parseStats.totalSkus} portal SKUs found</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-blue-700">{parseStats.newCount} new designs to onboard</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{designs.length - parseStats.newCount} already mapped</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-blue-600 flex-wrap">
                  <span>SKU column: <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono font-semibold">{parseStats.skuColumn}</code></span>
                  {parseStats.imageColumn && (
                    <span>Image column: <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono">{parseStats.imageColumn}</code></span>
                  )}
                </div>
                {parseStats.sampleSkus.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-blue-500 flex-wrap">
                    <span className="text-gray-400">Sample values →</span>
                    {parseStats.sampleSkus.map(s => (
                      <code key={s} className="rounded bg-white border border-blue-200 px-1.5 py-0.5 font-mono">{s}</code>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Section 2: Design Groups ──────────────────────────────────────── */}
        {designs.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Design Groups</h2>
                  <p className="text-xs text-gray-500">Choose what to do with each new design</p>
                </div>
              </div>
              <Button
                onClick={handleSaveAll}
                disabled={isSavingAll || pendingCount === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                {isSavingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Save {pendingCount} Design{pendingCount !== 1 ? 's' : ''}
              </Button>
            </div>

            <div className="divide-y divide-gray-100">
              {newDesigns.map(design => {
                const act = designActions[design.baseSku] || { action: 'create', selectedSizes: design.sizes, linkedMasterSku: '', imageUrl: design.imageUrl }
                const isExpanded = expandedDesign === design.baseSku
                const extraVisibleCount = extraVisibleSizeCounts[design.baseSku] || 0
                const defaultSizes = SIZE_CATALOG.slice(0, DEFAULT_VISIBLE_SIZE_COUNT)
                const optionalSizes = SIZE_CATALOG.slice(DEFAULT_VISIBLE_SIZE_COUNT)
                const visibleSizeSet = new Set([
                  ...defaultSizes,
                  ...optionalSizes.slice(0, extraVisibleCount),
                  ...design.sizes,
                  ...act.selectedSizes,
                ])
                const visibleSizes = SIZE_CATALOG.filter(sz => visibleSizeSet.has(sz))
                const nextSizeToShow = optionalSizes.find(sz => !visibleSizeSet.has(sz))

                return (
                  <div key={design.baseSku} className="px-5 py-4">
                    <div className="flex items-start gap-4">
                      {/* Image thumbnail */}
                      <div
                        className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 bg-gray-100 overflow-hidden"
                        title={design.imageUrl || 'No image'}
                      >
                        {design.imageUrl ? (
                          <img src={design.imageUrl} alt={design.baseSku} className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-gray-300" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">{design.baseSku}</span>
                          {design.sizes.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {design.sizes.map(s => (
                                <span key={s} className="rounded px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 font-medium">{s}</span>
                              ))}
                            </div>
                          )}
                          <Badge variant="outline" className="text-xs ml-auto shrink-0">
                            {design.unmappedCount} unmapped SKU{design.unmappedCount !== 1 ? 's' : ''}
                          </Badge>
                        </div>

                        {/* Suggestion */}
                        {design.suggestedMasterSku && act.action !== 'link' && (
                          <div className="mt-1.5 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" />
                            <span>Possible match: <strong>{design.suggestedMasterSku}</strong> ({design.suggestScore}%)</span>
                            <button
                              onClick={() => setAction(design.baseSku, { action: 'link', linkedMasterSku: design.suggestedMasterSku! })}
                              className="ml-auto shrink-0 underline font-medium hover:text-amber-900"
                            >
                              Link to this
                            </button>
                          </div>
                        )}

                        {/* Action selector */}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                            {(['create', 'link', 'skip'] as const).map(a => (
                              <button
                                key={a}
                                onClick={() => setAction(design.baseSku, { action: a })}
                                className={`px-3 py-1.5 font-medium transition-colors ${
                                  act.action === a
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {a === 'create' ? '+ Create New' : a === 'link' ? '🔗 Link Existing' : '⏭ Skip'}
                              </button>
                            ))}
                          </div>

                          <button
                            onClick={() => setExpandedDesign(isExpanded ? null : design.baseSku)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 ml-auto"
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {design.portalSkus.length} portal SKU{design.portalSkus.length !== 1 ? 's' : ''}
                          </button>
                        </div>

                        {/* Expanded: size selector (create) or master SKU input (link) */}
                        {act.action === 'create' && (
                          <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-3">
                            <p className="text-xs font-medium text-gray-600 mb-2">Select sizes to create in Master Inventory:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {visibleSizes.map(sz => {
                                const isDetected = design.sizes.includes(sz)
                                const isSelected = act.selectedSizes.includes(sz)
                                return (
                                  <button
                                    key={sz}
                                    onClick={() => toggleSize(design.baseSku, sz)}
                                    className={`rounded-md px-2 py-1 text-xs font-medium border transition-all ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-100 text-blue-700'
                                        : isDetected
                                        ? 'border-orange-300 bg-orange-50 text-orange-600'
                                        : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                                    }`}
                                  >
                                    {sz}
                                    {isDetected && !isSelected && <span className="ml-1 text-orange-400">·</span>}
                                  </button>
                                )
                              })}
                              {nextSizeToShow && (
                                <button
                                  onClick={() => showNextSize(design.baseSku)}
                                  className="rounded-md px-2 py-1 text-xs font-medium border border-dashed border-gray-300 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                  title={`Show ${nextSizeToShow}`}
                                >
                                  <Plus className="inline h-3 w-3 mr-1" />
                                  {nextSizeToShow}
                                </button>
                              )}
                            </div>
                            <p className="mt-2 text-xs text-gray-400">
                              Sizes show up to 4XL by default · Use + to add more · Orange border = detected in file · Blue = will be created
                              {act.selectedSizes.length > 0 && ` · ${act.selectedSizes.length} sizes selected`}
                            </p>
                          </div>
                        )}

                        {act.action === 'link' && (
                          <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-3">
                            <p className="text-xs font-medium text-gray-600 mb-1.5">
                              Link to existing Master SKU <span className="text-gray-400 font-normal">(sizes auto-matched: S→S, M→M, L→L)</span>
                            </p>
                            <div className="flex gap-2">
                              <Input
                                value={act.linkedMasterSku}
                                onChange={e => setAction(design.baseSku, { linkedMasterSku: e.target.value })}
                                placeholder="Type or paste master SKU…"
                                className="h-8 text-xs"
                                list={`inv-list-${design.baseSku}`}
                              />
                              <datalist id={`inv-list-${design.baseSku}`}>
                                {inventorySearch.map(s => <option key={s} value={s} />)}
                              </datalist>
                            </div>
                          </div>
                        )}

                        {/* Portal SKUs expandable list */}
                        {isExpanded && (
                          <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                            <p className="text-xs font-medium text-gray-500 mb-1.5">Portal SKUs in this group:</p>
                            <div className="flex flex-wrap gap-1">
                              {design.portalSkus.map(s => (
                                <span key={s} className="rounded bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-600 font-mono">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {alreadyMappedDesigns.length > 0 && (
              <details className="border-t border-gray-100">
                <summary className="cursor-pointer select-none px-5 py-3 text-xs text-gray-400 hover:text-gray-600">
                  {alreadyMappedDesigns.length} design{alreadyMappedDesigns.length !== 1 ? 's' : ''} already fully mapped (click to show)
                </summary>
                <div className="px-5 pb-3 flex flex-wrap gap-2">
                  {alreadyMappedDesigns.map(d => (
                    <span key={d.baseSku} className="flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs text-green-700">
                      <CheckCircle2 className="h-3 w-3" /> {d.baseSku}
                    </span>
                  ))}
                </div>
              </details>
            )}

            {/* Bottom save bar */}
            <div className="border-t border-gray-100 px-5 py-3 flex justify-end bg-gray-50/50">
              <Button
                onClick={handleSaveAll}
                disabled={isSavingAll || pendingCount === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSavingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Save All ({pendingCount})
              </Button>
            </div>
          </div>
        )}

        {/* ── Section 2b: Manual Master SKU Creator ────────────────────────── */}
        {(() => {
          const defaultSizes = SIZE_CATALOG.slice(0, DEFAULT_VISIBLE_SIZE_COUNT)
          const optionalSizes = SIZE_CATALOG.slice(DEFAULT_VISIBLE_SIZE_COUNT)
          const visibleOptional = optionalSizes.slice(0, manualExtraVisible)
          const visibleSizes = [...defaultSizes, ...visibleOptional]
          const nextSize = optionalSizes.find(sz => !visibleSizes.includes(sz))
          const currentBase = manualBaseSku.trim().toUpperCase().replace(/[-_]+$/, '')
          const existingInventorySet = new Set(inventory.map(i => i.master_sku.toUpperCase()))
          const existingSizes = new Set(SIZE_CATALOG.filter(sz => existingInventorySet.has(`${currentBase}-${sz}`)))
          const previewSkus = manualSelectedSizes.filter(sz => !existingSizes.has(sz)).map(sz => `${currentBase || 'BASE'}-${sz}`)
          return (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                  <Plus className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Manually Create Master SKU</h2>
                  <p className="text-xs text-gray-500">Base SKU naam daalo, sizes choose karo, save karo</p>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Base SKU input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Base SKU Name</label>
                  <Input
                    value={manualBaseSku}
                    onChange={e => setManualBaseSku(e.target.value)}
                    placeholder="e.g. PT001-OLIVE"
                    className="font-mono uppercase max-w-xs"
                  />
                  {manualBaseSku.trim() && (
                    <p className="text-xs text-gray-400">
                      Preview: <span className="font-mono text-gray-700">{manualBaseSku.trim().toUpperCase()}-S, …-M, …-XL</span>
                    </p>
                  )}
                </div>

                {/* Size selector */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">Sizes Select Karo</p>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleSizes.map(sz => {
                      const isSelected = manualSelectedSizes.includes(sz)
                      const alreadyExists = existingSizes.has(sz)
                      return (
                        <button
                          key={sz}
                          onClick={() => setManualSelectedSizes(prev =>
                            isSelected ? prev.filter(s => s !== sz) : [...prev, sz]
                          )}
                          title={alreadyExists ? `${currentBase}-${sz} already exists in inventory` : undefined}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-all ${
                            alreadyExists
                              ? 'border-red-300 bg-red-50 text-red-400 line-through cursor-not-allowed'
                              : isSelected
                              ? 'border-violet-500 bg-violet-100 text-violet-700'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600'
                          }`}
                        >
                          {sz}
                        </button>
                      )
                    })}
                    {nextSize && (
                      <button
                        onClick={() => setManualExtraVisible(v => v + 1)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium border border-dashed border-gray-300 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-all"
                      >
                        <Plus className="inline h-3 w-3 mr-1" />{nextSize}
                      </button>
                    )}
                    {manualSelectedSizes.length > 0 && (
                      <button
                        onClick={() => setManualSelectedSizes([])}
                        className="ml-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {manualSelectedSizes.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {manualSelectedSizes.length} size{manualSelectedSizes.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                {/* Image URL (optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Image URL <span className="font-normal text-gray-400">(optional)</span></label>
                  <Input
                    value={manualImageUrl}
                    onChange={e => setManualImageUrl(e.target.value)}
                    placeholder="https://…"
                    className="max-w-sm"
                  />
                </div>

                {/* Preview chips */}
                {previewSkus.length > 0 && (
                  <div className="rounded-lg bg-violet-50 border border-violet-100 px-4 py-3 space-y-1.5">
                    <p className="text-xs font-medium text-violet-700">Create honge:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewSkus.map(s => (
                        <span key={s} className="rounded-md bg-white border border-violet-200 px-2 py-0.5 text-xs font-mono text-violet-800">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save button */}
                <Button
                  onClick={handleManualCreate}
                  disabled={isSavingManual || !manualBaseSku.trim() || manualSelectedSizes.length === 0}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  size="sm"
                >
                  {isSavingManual
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                    : <><Plus className="mr-2 h-4 w-4" />Create {manualSelectedSizes.length > 0 ? `${manualSelectedSizes.length} SKU${manualSelectedSizes.length !== 1 ? 's' : ''}` : 'Master SKUs'}</>
                  }
                </Button>
              </div>
            </div>
          )
        })()}

        {/* ── Section 3: Master Inventory Dashboard ────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                <Package className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Master Inventory</h2>
                <p className="text-xs text-gray-500">{inventory.length} SKUs total</p>
              </div>
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search SKUs…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {isLoadingInventory ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Package className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">{searchQuery ? 'No SKUs match your search' : 'No master SKUs yet — upload a file above to get started'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Image</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Master SKU</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Created</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredInventory.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Image */}
                      <td className="px-5 py-3">
                        <button
                          onClick={() => { setImagePopup({ item }); setEditImageUrl(item.image_url || '') }}
                          className="group relative h-10 w-10 rounded-lg border border-gray-200 bg-gray-100 overflow-hidden"
                          title="Click to view / edit image"
                        >
                          {item.image_url ? (
                            <>
                              <img src={item.image_url} alt={item.master_sku} className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Eye className="h-3.5 w-3.5 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Plus className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                            </div>
                          )}
                        </button>
                      </td>

                      {/* SKU (inline edit) */}
                      <td className="px-5 py-3">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit(item.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              className="h-7 text-xs font-mono"
                              autoFocus
                            />
                            <button onClick={() => saveEdit(item.id)} className="text-green-600 hover:text-green-700" disabled={isSavingEdit}>
                              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-sm text-gray-800">{item.master_sku}</span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="px-5 py-3 text-xs text-gray-400 hidden sm:table-cell">
                        {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startEdit(item)}
                            className="rounded-md p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit SKU name"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={isDeletingId === item.id}
                            className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            {isDeletingId === item.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Image Popup ──────────────────────────────────────────────────────── */}
      {imagePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setImagePopup(null)}>
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{imagePopup.item.master_sku}</p>
                <p className="text-xs text-gray-400">Image preview &amp; URL</p>
              </div>
              <button onClick={() => setImagePopup(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Large preview */}
            <div className="flex items-center justify-center bg-gray-50 border-b border-gray-100" style={{ minHeight: 240 }}>
              {editImageUrl ? (
                <img
                  src={editImageUrl}
                  alt={imagePopup.item.master_sku}
                  className="max-h-60 max-w-full object-contain"
                  onError={e => { (e.target as HTMLImageElement).src = '' }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-300">
                  <ImageIcon className="h-12 w-12" />
                  <p className="text-sm">No image URL set</p>
                </div>
              )}
            </div>

            <div className="p-5 space-y-3">
              <label className="block text-xs font-medium text-gray-700">Image URL</label>
              <Input
                value={editImageUrl}
                onChange={e => setEditImageUrl(e.target.value)}
                placeholder="https://…"
                className="text-xs"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setImagePopup(null)}>Cancel</Button>
                <Button size="sm" onClick={saveImageUrl} disabled={isSavingImage} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSavingImage ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
