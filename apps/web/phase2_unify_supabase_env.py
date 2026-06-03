#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.cwd()
SRC = ROOT / "src"

if not SRC.exists():
    raise SystemExit("ERROR: Run this from .migration-backup. Expected ./src to exist.")

OLD = "NEXT_PUBLIC_SUPABASE_ANON_KEY"
NEW = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"

extensions = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}

changed = []

for path in SRC.rglob("*"):
    if not path.is_file() or path.suffix not in extensions:
        continue

    text = path.read_text(encoding="utf-8")

    if OLD not in text:
        continue

    updated = text.replace(OLD, NEW)
    path.write_text(updated, encoding="utf-8")
    changed.append(path.relative_to(ROOT).as_posix())

print("Supabase env var unification complete.")
print(f"Files changed: {len(changed)}")

for file in changed:
    print(f"- {file}")

remaining = []

for path in SRC.rglob("*"):
    if not path.is_file() or path.suffix not in extensions:
        continue

    text = path.read_text(encoding="utf-8")

    if OLD in text:
        remaining.append(path.relative_to(ROOT).as_posix())

if remaining:
    print("\nWARNING: Remaining NEXT_PUBLIC_SUPABASE_ANON_KEY references:")
    for file in remaining:
        print(f"- {file}")
    raise SystemExit(1)

print("\nPASS: No NEXT_PUBLIC_SUPABASE_ANON_KEY references remain in src.")
