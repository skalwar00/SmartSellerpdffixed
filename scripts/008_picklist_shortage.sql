-- Migration: Add shortage tracking to picklist_items
-- Paste into Supabase SQL Editor and click Run

ALTER TABLE picklist_items
  ADD COLUMN IF NOT EXISTS shortage BOOLEAN NOT NULL DEFAULT FALSE;
