-- Aavoni Seller Suite Database Schema
-- Create all tables with RLS policies

-- 1. users_plan - Trial/subscription tracking
CREATE TABLE IF NOT EXISTS users_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT DEFAULT 'trial',
  expiry_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. sku_mapping - Portal SKU to Master SKU mappings
CREATE TABLE IF NOT EXISTS sku_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_sku TEXT NOT NULL,
  master_sku TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, portal_sku)
);

-- 3. master_inventory - User's master SKU list
CREATE TABLE IF NOT EXISTS master_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  master_sku TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, master_sku)
);

-- 4. design_costing - Cost per design pattern
CREATE TABLE IF NOT EXISTS design_costing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  design_pattern TEXT NOT NULL,
  landed_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, design_pattern)
);

-- Enable Row Level Security on all tables
ALTER TABLE users_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_costing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users_plan
CREATE POLICY "users_plan_select_own" ON users_plan 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_plan_insert_own" ON users_plan 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_plan_update_own" ON users_plan 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_plan_delete_own" ON users_plan 
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sku_mapping
CREATE POLICY "sku_mapping_select_own" ON sku_mapping 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sku_mapping_insert_own" ON sku_mapping 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sku_mapping_update_own" ON sku_mapping 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sku_mapping_delete_own" ON sku_mapping 
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for master_inventory
CREATE POLICY "master_inventory_select_own" ON master_inventory 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "master_inventory_insert_own" ON master_inventory 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "master_inventory_update_own" ON master_inventory 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "master_inventory_delete_own" ON master_inventory 
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for design_costing
CREATE POLICY "design_costing_select_own" ON design_costing 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "design_costing_insert_own" ON design_costing 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "design_costing_update_own" ON design_costing 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "design_costing_delete_own" ON design_costing 
  FOR DELETE USING (auth.uid() = user_id);
