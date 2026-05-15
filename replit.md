# Meridian

Meridian is a Health Intelligence System.

## Canonical runtime

- `.migration-backup/` is the canonical Meridian runtime.
- All runtime app edits must target `.migration-backup/src`.
- The root workspace is deployment/workspace scaffolding only.
- The root `package.json` is not the app runtime package.
- Replit intentionally runs `cd .migration-backup && npm run dev`.

## Run & Operate

- `cd .migration-backup && npm run dev` — run the Meridian app
- `cd .migration-backup && npm run build` — build the Meridian app
- `pnpm run typecheck` — workspace typecheck
- `pnpm run build` — workspace typecheck + build where present

## Gotchas

- Do not create a second runtime app at the root.
- Do not edit runtime product code outside `.migration-backup/src`.
- Keep deployment and workflow targets pointed at the canonical runtime.
