import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canonicalizeSku } from '@/lib/sku-normalize'

/**
 * Re-canonicalises every sku_mapping row for the current user (strips spaces,
 * normalises XXL→2XL etc.) and merges duplicates that collapse to the same
 * canonical portal_sku key.
 *
 *   POST /api/sku-mapping/cleanup            → dry-run, reports changes/conflicts
 *   POST /api/sku-mapping/cleanup { apply }  → actually writes & deletes rows
 */
export async function POST(request: Request) {
  try {
    return await runCleanup(request)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cleanup] fatal:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function runCleanup(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Parse the body defensively — empty body, malformed JSON, or wrong
  // content-type all fall back to dry-run mode instead of 500ing.
  let apply = false
  const rawBody = await request.text().catch(() => '')
  if (rawBody && rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody)
      apply = parsed?.apply === true
    } catch {
      // ignore invalid JSON, treat as dry run
    }
  }

  type Row = { id: number; portal_sku: string; master_sku: string; combo_skus: string[] | null }
  const all: Row[] = []
  const PAGE = 1000
  let offset = 0
  let comboColAvailable = true

  while (true) {
    if (comboColAvailable) {
      const { data, error } = await supabase
        .from('sku_mapping')
        .select('id, portal_sku, master_sku, combo_skus')
        .eq('user_id', user.id)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE - 1)
      if (error) {
        comboColAvailable = false
        continue
      }
      const batch = (data as Row[]) ?? []
      all.push(...batch)
      if (batch.length < PAGE) break
      offset += PAGE
    } else {
      const { data, error } = await supabase
        .from('sku_mapping')
        .select('id, portal_sku, master_sku')
        .eq('user_id', user.id)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const batch = ((data as { id: number; portal_sku: string; master_sku: string }[]) ?? [])
        .map(r => ({ ...r, combo_skus: null }))
      all.push(...batch)
      if (batch.length < PAGE) break
      offset += PAGE
    }
  }

  // Pass 1 — compute desired canonical form for every row
  type Plan = {
    id: number
    oldPortal: string
    newPortal: string
    newMaster: string
    newCombo: string[]
    portalChanged: boolean
    masterChanged: boolean
    comboChanged: boolean
  }
  const plans: Plan[] = []
  for (const row of all) {
    const newPortal = canonicalizeSku(row.portal_sku || '')
    const newMaster = canonicalizeSku(row.master_sku || '')
    const oldCombo = Array.isArray(row.combo_skus) ? row.combo_skus : []
    const newCombo = oldCombo.map(s => canonicalizeSku(s || ''))
    const portalChanged = newPortal !== row.portal_sku
    const masterChanged = newMaster !== row.master_sku
    const comboChanged = JSON.stringify(newCombo) !== JSON.stringify(oldCombo)
    if (!portalChanged && !masterChanged && !comboChanged) continue
    plans.push({
      id: row.id,
      oldPortal: row.portal_sku,
      newPortal,
      newMaster,
      newCombo,
      portalChanged,
      masterChanged,
      comboChanged,
    })
  }

  // Pass 2 — group by canonical portal_sku to find duplicates / conflicts
  // We also need to merge plans with EXISTING canonical rows that didn't need
  // changing themselves but happen to collide with a row we're about to update.
  const existingCanonical = new Map<string, Row>()
  for (const row of all) {
    const canon = canonicalizeSku(row.portal_sku || '')
    if (canon === row.portal_sku && !existingCanonical.has(canon)) {
      existingCanonical.set(canon, row)
    }
  }

  type Group = { canonical: string; plans: Plan[]; existing?: Row }
  const groups = new Map<string, Group>()
  for (const p of plans) {
    let g = groups.get(p.newPortal)
    if (!g) {
      g = { canonical: p.newPortal, plans: [], existing: existingCanonical.get(p.newPortal) }
      groups.set(p.newPortal, g)
    }
    g.plans.push(p)
  }

  // Categorise:
  //   - simple updates  (group size 1 + no existing collision OR identical mapping)
  //   - merges          (multiple rows collapse to same key but all map to same master/combo → safe to dedupe)
  //   - conflicts       (multiple rows collapse but disagree on master/combo — needs human)
  const safeUpdates: { id: number; portal_sku: string; master_sku: string; combo_skus: string[] }[] = []
  const safeDeletes: number[] = []
  const conflicts: {
    canonical: string
    rows: { id: number; portal_sku: string; master_sku: string; combo_skus: string[] }[]
  }[] = []

  const sameMapping = (a: { master: string; combo: string[] }, b: { master: string; combo: string[] }) =>
    a.master === b.master && JSON.stringify([...a.combo].sort()) === JSON.stringify([...b.combo].sort())

  for (const g of groups.values()) {
    const candidates = g.plans.map(p => ({
      id: p.id,
      portal_sku: p.newPortal,
      master_sku: p.newMaster,
      combo_skus: p.newCombo,
    }))
    if (g.existing) {
      candidates.unshift({
        id: g.existing.id,
        portal_sku: g.existing.portal_sku,
        master_sku: g.existing.master_sku,
        combo_skus: Array.isArray(g.existing.combo_skus) ? g.existing.combo_skus : [],
      })
    }
    // De-dupe by id (the existing row could itself be in plans if combo/master changed)
    const seenIds = new Set<number>()
    const unique = candidates.filter(c => (seenIds.has(c.id) ? false : (seenIds.add(c.id), true)))

    if (unique.length === 1) {
      safeUpdates.push(unique[0])
      continue
    }

    const head = { master: unique[0].master_sku, combo: unique[0].combo_skus }
    const allSame = unique.every(c => sameMapping(head, { master: c.master_sku, combo: c.combo_skus }))
    if (allSame) {
      // Keep the lowest-id row, delete the rest
      const sorted = [...unique].sort((a, b) => a.id - b.id)
      safeUpdates.push(sorted[0])
      for (let i = 1; i < sorted.length; i++) safeDeletes.push(sorted[i].id)
    } else {
      conflicts.push({ canonical: g.canonical, rows: unique })
    }
  }

  // Build a human-readable preview list of every change we plan to make.
  // The UI shows this before the user clicks "Apply" so they can sanity check.
  type ChangeRow = {
    type: 'update' | 'merge'
    fromPortal: string
    toPortal: string
    masterFrom?: string
    masterTo?: string
    comboFrom?: string[]
    comboTo?: string[]
  }
  const rowsById = new Map<number, Row>()
  for (const r of all) rowsById.set(r.id, r)

  const changes: ChangeRow[] = []
  for (const u of safeUpdates) {
    const orig = rowsById.get(u.id)
    if (!orig) continue
    const portalChanged = orig.portal_sku !== u.portal_sku
    const masterChanged = orig.master_sku !== u.master_sku
    const oldCombo = Array.isArray(orig.combo_skus) ? orig.combo_skus : []
    const comboChanged = JSON.stringify(oldCombo) !== JSON.stringify(u.combo_skus)
    if (!portalChanged && !masterChanged && !comboChanged) continue
    changes.push({
      type: 'update',
      fromPortal: orig.portal_sku,
      toPortal: u.portal_sku,
      masterFrom: masterChanged ? orig.master_sku : undefined,
      masterTo: masterChanged ? u.master_sku : undefined,
      comboFrom: comboChanged ? oldCombo : undefined,
      comboTo: comboChanged ? u.combo_skus : undefined,
    })
  }
  // Build canonical-key → survivor map so merges show "merged into <survivor>"
  const survivorByCanonical = new Map<string, string>()
  for (const u of safeUpdates) survivorByCanonical.set(u.portal_sku, u.portal_sku)
  for (const id of safeDeletes) {
    const orig = rowsById.get(id)
    if (!orig) continue
    const canon = canonicalizeSku(orig.portal_sku || '')
    changes.push({
      type: 'merge',
      fromPortal: orig.portal_sku,
      toPortal: survivorByCanonical.get(canon) || canon,
      masterFrom: orig.master_sku,
      masterTo: orig.master_sku,
    })
  }
  const CHANGE_PREVIEW_LIMIT = 200
  const changesTruncated = changes.length > CHANGE_PREVIEW_LIMIT
  const changesPreview = changes.slice(0, CHANGE_PREVIEW_LIMIT)

  const summary = {
    totalRows: all.length,
    plansChanged: plans.length,
    safeUpdates: safeUpdates.length,
    safeDeletes: safeDeletes.length,
    conflicts: conflicts.length,
    conflictDetails: conflicts.slice(0, 50),
    changes: changesPreview,
    changesTotal: changes.length,
    changesTruncated,
    applied: false,
  }

  if (!apply) return NextResponse.json(summary)

  // ── Apply phase ────────────────────────────────────────────────────────────
  // Two-step pattern to avoid (user_id, portal_sku) unique-constraint clashes:
  //  1. Move rows we're about to merge to a temporary key prefixed with "__cleanup__:<id>:"
  //  2. Delete duplicates, then update survivors to the canonical key.
  const tempUpdates = safeUpdates
    .filter(u => {
      const original = all.find(r => r.id === u.id)
      return original && original.portal_sku !== u.portal_sku
    })
    .map(u => ({ id: u.id, tempKey: `__cleanup__:${u.id}:${u.portal_sku}` }))

  for (const t of tempUpdates) {
    const { error } = await supabase.from('sku_mapping').update({ portal_sku: t.tempKey }).eq('id', t.id)
    if (error) return NextResponse.json({ error: `Stage error: ${error.message}` }, { status: 500 })
  }
  // Move any rows that will be deleted into a different temp namespace too,
  // so that a survivor can take their canonical key without colliding.
  for (const id of safeDeletes) {
    const { error } = await supabase.from('sku_mapping').update({ portal_sku: `__cleanup_del__:${id}` }).eq('id', id)
    if (error) return NextResponse.json({ error: `Stage error: ${error.message}` }, { status: 500 })
  }

  let updated = 0
  let errored = 0
  for (const u of safeUpdates) {
    const payload: { portal_sku: string; master_sku: string; combo_skus?: string[] } = {
      portal_sku: u.portal_sku,
      master_sku: u.master_sku,
      combo_skus: u.combo_skus,
    }
    let { error } = await supabase.from('sku_mapping').update(payload).eq('id', u.id)
    if (error && error.message.toLowerCase().includes('combo_skus')) {
      const { combo_skus: _cs, ...fallback } = payload
      const r2 = await supabase.from('sku_mapping').update(fallback).eq('id', u.id)
      error = r2.error
    }
    if (error) errored++
    else updated++
  }

  let deleted = 0
  if (safeDeletes.length > 0) {
    const { error, count } = await supabase
      .from('sku_mapping')
      .delete({ count: 'exact' })
      .in('id', safeDeletes)
    if (!error) deleted = count ?? safeDeletes.length
  }

  return NextResponse.json({ ...summary, applied: true, updated, deleted, errored })
}
