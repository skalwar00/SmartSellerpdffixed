-- Migration 006: Move combo_skus and pending_unmapped_skus from JWT (user_metadata) to database
-- This prevents session cookies from growing large for heavy users

-- Add combo_skus column to sku_mapping table
ALTER TABLE sku_mapping ADD COLUMN IF NOT EXISTS combo_skus TEXT[] DEFAULT '{}';

-- Add pending_unmapped_skus column to users_plan table
ALTER TABLE users_plan ADD COLUMN IF NOT EXISTS pending_unmapped_skus TEXT[] DEFAULT '{}';
