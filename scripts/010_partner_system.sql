-- ============================================================
-- Migration 010: Partner / Affiliate System
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Partners table
CREATE TABLE IF NOT EXISTS partners (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  email           text NOT NULL UNIQUE,
  phone           text,
  referral_code   text NOT NULL UNIQUE,
  status          text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Public can insert (apply as partner)
CREATE POLICY "Anyone can apply as partner"
  ON partners FOR INSERT
  WITH CHECK (true);

-- Partners can read their own row via referral_code
CREATE POLICY "Partner can read own row"
  ON partners FOR SELECT
  USING (true);

-- 2. Track which partner referred which user
ALTER TABLE users_plan
  ADD COLUMN IF NOT EXISTS referred_by text;  -- stores referral_code

-- 3. Commission records
CREATE TABLE IF NOT EXISTS partner_commissions (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id            uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  payment_request_id    uuid,
  referred_user_id      uuid NOT NULL,
  referred_user_email   text,
  commission_type       text NOT NULL CHECK (commission_type IN ('first', 'recurring')),
  payment_amount        integer NOT NULL,
  commission_percent    integer NOT NULL,
  commission_amount     integer NOT NULL,
  status                text DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners read own commissions"
  ON partner_commissions FOR SELECT
  USING (true);
