-- Add status column to demo_requests table
-- Run this from Supabase Studio > SQL Editor

ALTER TABLE demo_requests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Optional: add an index for filtering by status
CREATE INDEX IF NOT EXISTS demo_requests_status_idx ON demo_requests (status);
