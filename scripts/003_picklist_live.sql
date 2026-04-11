-- Migration: Live Picklist System
-- Paste the ENTIRE content of this file into the Supabase SQL Editor and click Run

-- 1. Add short_user_id and security_pin to users_plan
ALTER TABLE users_plan
  ADD COLUMN IF NOT EXISTS short_user_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS security_pin TEXT;

-- 2. Create picklist_items table
CREATE TABLE IF NOT EXISTS picklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  master_sku TEXT NOT NULL,
  total_qty INTEGER NOT NULL DEFAULT 0,
  picked_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'picked', 'updated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, master_sku)
);

-- 3. Enable RLS on picklist_items
ALTER TABLE picklist_items ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "picklist_items_select_own" ON picklist_items;
DROP POLICY IF EXISTS "picklist_items_insert_own" ON picklist_items;
DROP POLICY IF EXISTS "picklist_items_update_own" ON picklist_items;
DROP POLICY IF EXISTS "picklist_items_delete_own" ON picklist_items;

CREATE POLICY "picklist_items_select_own" ON picklist_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "picklist_items_insert_own" ON picklist_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "picklist_items_update_own" ON picklist_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "picklist_items_delete_own" ON picklist_items
  FOR DELETE USING (auth.uid() = user_id);

-- 5. updated_at auto-trigger
CREATE OR REPLACE FUNCTION update_picklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS picklist_items_updated_at ON picklist_items;
CREATE TRIGGER picklist_items_updated_at
  BEFORE UPDATE ON picklist_items
  FOR EACH ROW EXECUTE FUNCTION update_picklist_updated_at();
