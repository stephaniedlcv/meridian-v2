#!/bin/bash
# =============================================================================
# MERIDIAN POST-MERGE HOOK — NEUTRALIZED (Stabilization Phase B.2)
# =============================================================================
#
# HISTORY:
#   Original body (2 lines):
#     pnpm install --frozen-lockfile
#     pnpm --filter db push
#
# WHY NEUTRALIZED:
#   This hook was inherited from the root pnpm workspace template.
#   It previously ran `drizzle-kit push` against a PostgreSQL DATABASE_URL,
#   targeting lib/db/ — a scaffolding package with no connection to Meridian.
#
#   Meridian uses Supabase for its database. Schema changes are applied
#   manually via the Supabase SQL editor. There is no Drizzle schema to push
#   and no DATABASE_URL expected in this environment.
#
#   Running the original hook on every task-agent merge would either:
#     a) Fail loudly (if DATABASE_URL is unset) — exit non-zero on every merge
#     b) Push a foreign Drizzle schema to whatever DATABASE_URL points to
#
#   Both outcomes are wrong for Meridian. The hook is therefore neutralized.
#
# CANONICAL RUNTIME:
#   .migration-backup/ is the active Meridian Next.js runtime.
#   All product code lives in .migration-backup/src/.
#   The root workspace is deployment/tooling scaffolding only.
#
# ROLLBACK:
#   To restore the original hook, replace this file body with:
#     set -e
#     pnpm install --frozen-lockfile
#     pnpm --filter db push
#
# =============================================================================

echo "[post-merge] Meridian post-merge hook: no-op (intentionally neutralized)."
echo "[post-merge] Meridian runtime: .migration-backup/ — no action required."
echo "[post-merge] Database: Supabase (managed manually). No schema push performed."
exit 0
