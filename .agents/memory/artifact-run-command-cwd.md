---
name: Artifact run command working directory
description: Non-pnpm artifact service run commands execute with cwd set to the artifact's own directory, not the repo root.
---

When an artifact's `artifact.toml` `services.development.run` (or `services.production.run.args`) invokes something other than `pnpm --filter @workspace/<slug> run ...` — e.g. a raw shell script or binary for a non-Node backend — the process's working directory is the artifact's own directory (`artifacts/<slug>/`), not the monorepo root. A command like `bash artifacts/api-server/run_dev.sh` fails with "No such file or directory" because it resolves relative to `artifacts/api-server/artifacts/api-server/run_dev.sh`.

**Why:** Hit this wiring a Python/FastAPI backend into an artifact originally scaffolded for `pnpm --filter` commands (which don't reveal the cwd since they use `--filter` from the root regardless).

**How to apply:** Write run scripts referenced from `artifact.toml` with paths relative to the artifact directory itself (e.g. `run = "bash run_dev.sh"`), and inside the script use `cd "$(dirname "${BASH_SOURCE[0]}")/../.."` (or similar) to reach the repo root if the command needs it.
