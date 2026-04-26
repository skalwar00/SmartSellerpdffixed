'use client'

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Loader2, Plus, X } from 'lucide-react'
import { canonicalizeSku, isSizeToken } from '@/lib/sku-normalize'

// ── Fuzzy matching ───────────────────────────────────────────────────────────

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
      matrix[i][j] = shorter[i - 1] === longer[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
    }
  }
  return Math.round(((longer.length - matrix[shorter.length][longer.length]) / longer.length) * 100)
}

function tokenSetRatio(str1: string, str2: string): number {
  const s1 = canonicalizeSku(str1.toUpperCase().trim())
  const s2 = canonicalizeSku(str2.toUpperCase().trim())
  if (s1 === s2) return 100
  const tokens1 = new Set(s1.split(/[-_\s]+/).filter(Boolean))
  const tokens2 = new Set(s2.split(/[-_\s]+/).filter(Boolean))
  const intersection = [...tokens1].filter(t => tokens2.has(t))
  const sortedInt = intersection.sort().join(' ')
  const sorted1 = [...tokens1].sort().join(' ')
  const sorted2 = [...tokens2].sort().join(' ')
  const comb1 = sortedInt + ' ' + [...tokens1].filter(t => !tokens2.has(t)).sort().join(' ')
  const comb2 = sortedInt + ' ' + [...tokens2].filter(t => !tokens1.has(t)).sort().join(' ')
  return Math.max(
    simpleRatio(sortedInt, sorted1),
    simpleRatio(sortedInt, sorted2),
    simpleRatio(sorted1, sorted2),
    simpleRatio(comb1.trim(), comb2.trim()),
  )
}

// ── SearchableSelect ─────────────────────────────────────────────────────────

function SearchableSelect({
  value,
  options,
  placeholder = 'Master SKU choose karo…',
  onChange,
}: {
  value: string
  options: string[]
  placeholder?: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
    else setQuery('')
  }, [open])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const target = (triggerRef.current.closest('[role="dialog"]') as HTMLElement | null) ?? document.body
    setPortalTarget(target)
    const updatePos = () => {
      const triggerRect = triggerRef.current!.getBoundingClientRect()
      const targetRect = target === document.body ? { top: 0, left: 0 } : target.getBoundingClientRect()
      setPosition({
        top: triggerRect.bottom - targetRect.top + 4,
        left: triggerRect.left - targetRect.left,
        width: Math.max(triggerRect.width, 220),
      })
    }
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={`truncate text-sm ${value ? '' : 'text-muted-foreground'}`}>
          {value || placeholder}
        </span>
        <ChevronDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
      {open && position && portalTarget && createPortal(
        <div
          ref={popoverRef}
          className="absolute rounded-md border shadow-lg bg-white"
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            zIndex: 9999,
            opacity: 1,
            pointerEvents: 'auto',
          }}
        >
          <div className="p-2 border-b bg-white">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search SKU…"
              className="w-full rounded-sm border border-input bg-white px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-56 overflow-y-auto bg-white">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-center text-sm text-muted-foreground">Koi result nahi</p>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false) }}
                  className={`flex w-full items-center px-3 py-2 text-sm text-left text-neutral-900 hover:bg-blue-600 hover:text-white ${opt === value ? 'bg-slate-100 font-medium' : ''}`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>,
        portalTarget
      )}
    </div>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

interface MapRow {
  portalSku: string
  masterSku: string
  matchScore: number
  confirm: boolean
  comboExpanded: boolean
  comboSkus: string[]
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  unmappedSkus: string[]
  masterOptions: string[]
  onSaved: () => void
}

// ── Main component ───────────────────────────────────────────────────────────

export function SkuMapSheet({ open, onOpenChange, unmappedSkus, masterOptions, onSaved }: Props) {
  const [rows, setRows] = useState<MapRow[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || unmappedSkus.length === 0) return
    const built: MapRow[] = unmappedSkus.map(sku => {
      let bestMatch = masterOptions[0] ?? ''
      let bestScore = 0
      for (const m of masterOptions) {
        const score = tokenSetRatio(sku, m)
        if (score > bestScore) { bestScore = score; bestMatch = m }
      }
      return {
        portalSku: sku,
        masterSku: bestMatch,
        matchScore: bestScore,
        confirm: bestScore >= 90,
        comboExpanded: false,
        comboSkus: [],
      }
    })
    setRows(built)
  }, [open, unmappedSkus, masterOptions])

  const updateRow = useCallback((idx: number, patch: Partial<MapRow>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }, [])

  const bestFuzzyMatchResidual = useCallback((
    portalSku: string,
    alreadyMapped: string[],
    exclude: Set<string>,
  ): string => {
    const tokenize = (s: string) =>
      canonicalizeSku(s.toUpperCase()).split(/[-_\s()+,/]+/).filter(Boolean)

    const portalTokenList = tokenize(portalSku)
    const portalTokens = new Set(portalTokenList)
    // Keep size tokens (e.g. 6XL) in the residual — they're shared by every
    // combo half, so removing them causes wrong-size suggestions.
    const sizeTokens = portalTokenList.filter(isSizeToken)
    for (const mapped of alreadyMapped) {
      if (!mapped) continue
      for (const t of tokenize(mapped)) {
        if (isSizeToken(t)) continue
        portalTokens.delete(t)
      }
    }
    for (const sz of sizeTokens) portalTokens.add(sz)
    const residual = [...portalTokens].join(' ').trim()
    const matchTarget = residual || portalSku

    let bestMatch = ''
    let bestScore = -1
    for (const m of masterOptions) {
      if (exclude.has(m)) continue
      const score = tokenSetRatio(matchTarget, m)
      if (score > bestScore) { bestScore = score; bestMatch = m }
    }
    return bestMatch
  }, [masterOptions])

  const toggleCombo = useCallback((idx: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const expanding = !r.comboExpanded
      if (expanding && r.comboSkus.length === 0) {
        const nextSku = bestFuzzyMatchResidual(r.portalSku, [r.masterSku], new Set([r.masterSku]))
        return { ...r, comboExpanded: true, comboSkus: [nextSku] }
      }
      return { ...r, comboExpanded: expanding }
    }))
  }, [bestFuzzyMatchResidual])

  const addComboSku = useCallback((idx: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const mapped = [r.masterSku, ...r.comboSkus].filter(Boolean)
      const nextSku = bestFuzzyMatchResidual(r.portalSku, mapped, new Set(mapped))
      return { ...r, comboSkus: [...r.comboSkus, nextSku] }
    }))
  }, [bestFuzzyMatchResidual])

  const updateComboSku = useCallback((rowIdx: number, skuIdx: number, value: string) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r
      const updated = [...r.comboSkus]
      updated[skuIdx] = value
      return { ...r, comboSkus: updated }
    }))
  }, [])

  const removeComboSku = useCallback((rowIdx: number, skuIdx: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r
      const updated = r.comboSkus.filter((_, si) => si !== skuIdx)
      return { ...r, comboSkus: updated, comboExpanded: updated.length > 0 }
    }))
  }, [])

  const handleSave = async () => {
    const toSave = rows.filter(r => r.confirm && r.masterSku)
    if (toSave.length === 0) { toast.error('Koi row confirm nahi hai'); return }
    setIsSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const records = toSave.map(r => ({
        user_id: user.id,
        portal_sku: canonicalizeSku(r.portalSku),
        master_sku: canonicalizeSku(r.masterSku),
        combo_skus: r.comboSkus.filter(Boolean).map(s => canonicalizeSku(s)),
      }))

      const { error } = await supabase.from('sku_mapping').upsert(records, { onConflict: 'user_id, portal_sku' })
      if (error) {
        const fallback = records.map(({ combo_skus: _cs, ...rest }) => rest)
        const { error: fe } = await supabase.from('sku_mapping').upsert(fallback, { onConflict: 'user_id, portal_sku' })
        if (fe) throw fe
      }

      const comboCount = toSave.filter(r => r.comboSkus.filter(Boolean).length > 0).length
      toast.success(
        `${toSave.length} mapping${toSave.length > 1 ? 's' : ''} save${comboCount > 0 ? ` (${comboCount} combo)` : ''} ho gayi!`
      )
      onOpenChange(false)
      onSaved()
    } catch (err) {
      console.error(err)
      toast.error('Save karne mein error aaya, dobara try karo')
    } finally {
      setIsSaving(false)
    }
  }

  const confirmedCount = rows.filter(r => r.confirm && r.masterSku).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <SheetTitle className="text-base">SKU Mapping</SheetTitle>
          <SheetDescription className="text-xs">
            Fuzzy matching se best master SKU suggest kiya. Combo product hai to <strong>+</strong> dabao — ek portal SKU ke multiple master SKUs add kar sakte ho.
          </SheetDescription>
        </SheetHeader>

        {masterOptions.length === 0 && (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-sm text-muted-foreground text-center">
              Pehle Dashboard pe Master Inventory upload karo — tab master SKU options yahan dikhenge.
            </p>
          </div>
        )}

        {masterOptions.length > 0 && rows.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {masterOptions.length > 0 && rows.length > 0 && (
          <>
            {/* Column header */}
            <div className="grid grid-cols-[1.5rem_1fr_1fr_2.5rem_2.5rem] gap-2 px-5 py-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground shrink-0">
              <span />
              <span>Portal SKU</span>
              <span>Master SKU</span>
              <span className="text-center">Score</span>
              <span className="text-center">Combo</span>
            </div>

            {/* Row list */}
            <div className="flex-1 overflow-y-auto divide-y">
              {rows.map((row, idx) => {
                const usedInRow = new Set([row.masterSku, ...row.comboSkus])
                const availableForCombo = masterOptions.filter(m => !usedInRow.has(m))

                return (
                  <div key={row.portalSku} className={row.confirm ? '' : 'opacity-60'}>
                    {/* Primary row */}
                    <div className="grid grid-cols-[1.5rem_1fr_1fr_2.5rem_2.5rem] gap-2 items-center px-5 py-3">
                      <Checkbox
                        checked={row.confirm}
                        onCheckedChange={v => updateRow(idx, { confirm: !!v })}
                        className="mt-0.5"
                      />
                      <code className="text-xs font-mono break-all leading-tight">
                        {row.portalSku}
                      </code>
                      <SearchableSelect
                        value={row.masterSku}
                        options={masterOptions}
                        onChange={v => updateRow(idx, { masterSku: v, confirm: true })}
                      />
                      <div className="flex justify-center">
                        <Badge
                          variant={row.matchScore >= 90 ? 'default' : row.matchScore >= 70 ? 'secondary' : 'outline'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {row.matchScore}%
                        </Badge>
                      </div>
                      {/* Combo toggle */}
                      <div className="flex justify-center">
                        <button
                          type="button"
                          title={row.comboExpanded ? 'Combo SKUs band karo' : 'Combo SKUs add karo'}
                          onClick={() => toggleCombo(idx)}
                          className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                            row.comboExpanded || row.comboSkus.length > 0
                              ? 'border-amber-400 bg-amber-50 text-amber-600 hover:bg-amber-100'
                              : 'border-dashed border-muted-foreground/40 text-muted-foreground hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600'
                          }`}
                        >
                          {row.comboExpanded
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <Plus className="h-3.5 w-3.5" />
                          }
                        </button>
                      </div>
                    </div>

                    {/* Combo expanded section */}
                    {row.comboExpanded && (
                      <div className="px-5 pb-3">
                        <div className="ml-[calc(1.5rem+0.5rem)] border-l-2 border-amber-200 pl-3 flex flex-col gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Combo components (additional master SKUs)
                          </p>
                          {row.comboSkus.map((sku, si) => (
                            <div key={si} className="flex items-center gap-2">
                              <SearchableSelect
                                value={sku}
                                options={masterOptions.filter(m => m !== row.masterSku && !row.comboSkus.some((cs, ci) => ci !== si && cs === m))}
                                placeholder="Additional SKU…"
                                onChange={v => updateComboSku(idx, si, v)}
                              />
                              <button
                                type="button"
                                onClick={() => removeComboSku(idx, si)}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addComboSku(idx)}
                            disabled={availableForCombo.length === 0}
                            className="flex items-center gap-1.5 self-start rounded-md border border-dashed border-amber-300 px-2.5 py-1 text-xs text-amber-600 transition-colors hover:border-amber-500 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="h-3 w-3" />
                            SKU add karo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t px-5 py-3 flex items-center justify-between gap-3 bg-background">
              <p className="text-xs text-muted-foreground">
                {confirmedCount}/{rows.length} confirmed
                {rows.some(r => r.comboSkus.filter(Boolean).length > 0) && (
                  <span className="ml-2 text-amber-600">
                    · {rows.filter(r => r.comboSkus.filter(Boolean).length > 0).length} combo
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving || confirmedCount === 0}>
                  {isSaving
                    ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
                    : `Save ${confirmedCount > 0 ? confirmedCount : ''} Mapping${confirmedCount !== 1 ? 's' : ''}`
                  }
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
