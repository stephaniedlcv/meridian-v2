-- ─────────────────────────────────────────────────────────────────
-- Migration 003: Admin Moderation — account status + soft-delete
-- Run this in the Supabase SQL Editor before deploying this feature.
-- ─────────────────────────────────────────────────────────────────

-- 1. Add moderation columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_status    TEXT        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

-- 2. Constrain allowed values
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'suspended', 'banned', 'disabled', 'pending_review'));

-- 3. Index for common admin queries
CREATE INDEX IF NOT EXISTS profiles_account_status_idx ON profiles (account_status);
CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx     ON profiles (deleted_at) WHERE deleted_at IS NOT NULL;
