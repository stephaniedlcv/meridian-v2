# Legacy migration files

These files were previously stored outside the canonical Supabase migrations folder.

They are kept here as historical reference only and should not be applied directly.

Canonical migration source of truth:
supabase/migrations/

Do not add new SQL migrations under:
sql/
src/db/migrations/

If a new database change is needed, create a timestamped migration under:
supabase/migrations/
