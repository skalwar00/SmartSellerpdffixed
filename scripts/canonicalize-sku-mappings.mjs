import { createClient } from '@supabase/supabase-js'

const SIZE_ALIASES = {
  XXL: '2XL',
  XXXL: '3XL',
  XXXXL: '4XL',
  XXXXXL: '5XL',
  XXXXXXL: '6XL',
  XXXXXXXL: '7XL',
  XXXXXXXXL: '8XL',
  XXXXXXXXXL: '9XL',
  XXXXXXXXXXL: '10XL',
  FREESIZE: 'FREE',
  FREESZ: 'FREE',
  FS: 'FREE',
  ONESIZE: 'OS',
  ONE: 'OS',
}

function canonicalizeSku(sku) {
  if (!sku) return sku
  return sku.replace(/[A-Za-z]+/g, (m) => {
    const upper = m.toUpperCase()
    return SIZE_ALIASES[upper] ?? m
  })
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing env vars')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

console.log('Fetching all sku_mapping rows…')
const PAGE = 1000
let from = 0
let all = []
while (true) {
  const { data, error } = await sb
    .from('sku_mapping')
    .select('id, user_id, portal_sku, master_sku, combo_skus')
    .range(from, from + PAGE - 1)
    .order('id', { ascending: true })
  if (error) { console.error(error); process.exit(1) }
  all = all.concat(data || [])
  if (!data || data.length < PAGE) break
  from += PAGE
}
console.log('Total rows:', all.length)

const updates = []
const conflicts = []
for (const row of all) {
  const newPortal = canonicalizeSku(row.portal_sku || '')
  const newMaster = canonicalizeSku(row.master_sku || '')
  const oldCombo = Array.isArray(row.combo_skus) ? row.combo_skus : []
  const newCombo = oldCombo.map(canonicalizeSku)
  const portalChanged = newPortal !== row.portal_sku
  const masterChanged = newMaster !== row.master_sku
  const comboChanged = JSON.stringify(newCombo) !== JSON.stringify(oldCombo)
  if (!portalChanged && !masterChanged && !comboChanged) continue
  updates.push({
    id: row.id,
    user_id: row.user_id,
    old_portal: row.portal_sku,
    portal_sku: newPortal,
    master_sku: newMaster,
    combo_skus: newCombo,
    portalChanged,
  })
}
console.log('Rows needing update:', updates.length)

const seen = new Map()
for (const u of updates) {
  const key = `${u.user_id}::${u.portal_sku}`
  if (seen.has(key)) {
    conflicts.push({ ...u, conflict_with: seen.get(key) })
  } else {
    seen.set(key, u.id)
  }
}
console.log('Potential conflicts (same user_id+portal_sku after canonicalization):', conflicts.length)
if (conflicts.length > 0) {
  console.log('First 5 conflicts:', conflicts.slice(0, 5))
}

let okCount = 0, errCount = 0, skippedConflict = 0
const conflictIds = new Set(conflicts.map(c => c.id))
for (const u of updates) {
  if (conflictIds.has(u.id)) {
    skippedConflict++
    continue
  }
  const { error } = await sb
    .from('sku_mapping')
    .update({
      portal_sku: u.portal_sku,
      master_sku: u.master_sku,
      combo_skus: u.combo_skus,
    })
    .eq('id', u.id)
  if (error) {
    errCount++
    console.error('Update failed for id', u.id, error.message)
  } else {
    okCount++
  }
}
console.log(`Updated: ${okCount}, Errors: ${errCount}, Skipped (would conflict): ${skippedConflict}`)
