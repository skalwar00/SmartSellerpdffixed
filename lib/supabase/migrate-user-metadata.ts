import { SupabaseClient } from '@supabase/supabase-js'

/**
 * One-time migration: strips large legacy fields from JWT user_metadata and
 * moves them into the database where they belong.
 *
 * Fields migrated:
 *   combo_mappings      → sku_mapping.combo_skus  (per-row update)
 *   pending_unmapped_skus → users_plan.pending_unmapped_skus
 *
 * After migration both fields are nulled out in user_metadata so the JWT
 * stays small and never triggers an HTTP 431.
 *
 * Safe to call on every login — it is a no-op when both fields are already null.
 */
export async function migrateUserMetadata(supabase: SupabaseClient, userId: string, userMetadata: Record<string, unknown>) {
  const updates: Record<string, null> = {}

  // ── combo_mappings ──────────────────────────────────────────────────────────
  const legacyCombo = (userMetadata?.combo_mappings as Record<string, string[]>) ?? {}
  if (Object.keys(legacyCombo).length > 0) {
    try {
      await Promise.all(
        Object.entries(legacyCombo).map(([portalSku, skus]) => {
          const extraSkus = skus.slice(1).filter(Boolean)
          if (extraSkus.length === 0) return Promise.resolve()
          return supabase
            .from('sku_mapping')
            .update({ combo_skus: extraSkus })
            .eq('user_id', userId)
            .eq('portal_sku', portalSku)
        })
      )
      updates.combo_mappings = null
    } catch { /* non-critical — leave the field; dashboard will retry */ }
  }

  // ── pending_unmapped_skus ───────────────────────────────────────────────────
  const legacyPending = (userMetadata?.pending_unmapped_skus as string[]) ?? []
  if (legacyPending.length > 0) {
    try {
      const { data: plan } = await supabase
        .from('users_plan')
        .select('pending_unmapped_skus')
        .eq('user_id', userId)
        .maybeSingle()

      const dbPending = (plan?.pending_unmapped_skus as string[]) ?? []
      const merged = [...new Set([...dbPending, ...legacyPending])]

      await supabase
        .from('users_plan')
        .update({ pending_unmapped_skus: merged })
        .eq('user_id', userId)

      updates.pending_unmapped_skus = null
    } catch { /* non-critical — leave the field; dashboard will retry */ }
  }

  if (Object.keys(updates).length > 0) {
    try {
      await supabase.auth.updateUser({ data: updates })
    } catch { /* best-effort */ }
  }
}
