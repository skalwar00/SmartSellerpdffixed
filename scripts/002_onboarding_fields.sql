-- Migration: Add onboarding fields to users_plan and components to sku_mapping

-- Add onboarding tracking fields to users_plan
ALTER TABLE users_plan 
  ADD COLUMN IF NOT EXISTS has_seen_onboarding BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_combo_enabled BOOLEAN DEFAULT FALSE;

-- Add components (JSON) column to sku_mapping for combo/bundle details
ALTER TABLE sku_mapping 
  ADD COLUMN IF NOT EXISTS components JSONB DEFAULT NULL;
