-- Add image_url column to master_inventory (optional, stores external image URL)
ALTER TABLE master_inventory
  ADD COLUMN IF NOT EXISTS image_url TEXT;
