'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Save, AlertCircle } from 'lucide-react'
import useSWR, { mutate } from 'swr'

// Extract design pattern from SKU
function getDesignPattern(masterSku: string): string {
  let sku = masterSku.toUpperCase().trim()
  // Remove size suffixes
  sku = sku.replace(/[-_](S|M|L|XL|XXL|\d*XL|FREE|SMALL|LARGE)$/, '')
  // Remove parenthetical content
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
  costingRes.data?.forEach(item => {
    costingDict[item.design_pattern] = item.landed_cost
  })

  const missingPatterns = allPatterns.filter(p => !(p in costingDict))
  const existingPatterns = allPatterns.filter(p => p in costingDict)

  return { 
    allPatterns, 
    costingDict, 
    missingPatterns, 
    existingPatterns,
    userId: user.id 
  }
}

export default function CostingPage() {
  const { data, error, isLoading } = useSWR('costing-data', fetchCostingData)
  const [selectedPattern, setSelectedPattern] = useState<string>('')
  const [costValue, setCostValue] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveCosting = async () => {
    if (!selectedPattern || !costValue || !data) {
      toast.error('Please select a pattern and enter a cost')
      return
    }

    const cost = parseFloat(costValue)
    if (isNaN(cost) || cost < 0) {
      toast.error('Please enter a valid cost')
      return
    }

    // Snapshot for rollback
    const snapshot = data

    // ── Optimistic update — instant UI ──
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

    // ── Background Supabase sync ──
    setIsSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('design_costing')
        .upsert({
          user_id: data.userId,
          design_pattern: savedPattern,
          landed_cost: cost,
        }, { onConflict: 'user_id, design_pattern' })

      if (error) throw error
      mutate('costing-data')
    } catch (err) {
      // ── Rollback on failure ──
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

  return (
    <>
      <DashboardHeader 
        title="Costing Manager" 
        description="Manage design-level costing for profit calculations" 
      />
      
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Missing Costing Alert */}
        {data && data.missingPatterns.length > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-base text-amber-800 dark:text-amber-200">
                  Missing Costing Data
                </CardTitle>
              </div>
              <CardDescription className="text-amber-700 dark:text-amber-300">
                {data.missingPatterns.length} design patterns need costing information
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Add/Edit Costing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add or Update Costing</CardTitle>
            <CardDescription>
              Set landed cost for design patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="pattern-select">Design Pattern</Label>
                <Select 
                  value={selectedPattern} 
                  onValueChange={(value) => {
                    setSelectedPattern(value)
                    if (data?.costingDict[value]) {
                      setCostValue(data.costingDict[value].toString())
                    } else {
                      setCostValue('')
                    }
                  }}
                >
                  <SelectTrigger id="pattern-select" className="mt-1">
                    <SelectValue placeholder="Select a pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.missingPatterns.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Missing Costing
                        </div>
                        {data.missingPatterns.filter(p => p !== '').map(pattern => (
                          <SelectItem key={pattern} value={pattern}>
                            <span className="text-amber-600">{pattern}</span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {data?.existingPatterns.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Existing Costing
                        </div>
                        {data.existingPatterns.filter(p => p !== '').map(pattern => (
                          <SelectItem key={pattern} value={pattern}>
                            {pattern}
                          </SelectItem>
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
              <Button 
                onClick={handleSaveCosting}
                disabled={!selectedPattern || !costValue || isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Costing
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Costing Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Design Costing</CardTitle>
            <CardDescription>
              {data ? `${Object.keys(data.costingDict).length} patterns with costing` : 'Loading...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <p className="text-muted-foreground">Loading costing data...</p>
              </div>
            ) : data && Object.keys(data.costingDict).length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Design Pattern</TableHead>
                      <TableHead className="text-right">Landed Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(data.costingDict)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([pattern, cost]) => (
                        <TableRow key={pattern}>
                          <TableCell className="font-mono text-sm">{pattern}</TableCell>
                          <TableCell className="text-right font-medium">
                            Rs {cost.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">Active</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">
                  No costing data yet. Add your first design costing above.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
