-- Migration: Add remaining_stock tracking to picklist_items
-- When packer has more stock than ordered, excess is tracked here
ALTER TABLE picklist_items
  ADD COLUMN IF NOT EXISTS remaining_stock INTEGER NOT NULL DEFAULT 0;
