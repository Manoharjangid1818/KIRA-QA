# KIRA QA AI Assistant

KIRA (KiwiQA Intelligent Retrieval Assistant) is a SaaS-style copilot for QA engineers: chat with an AI QA expert and generate requirement analyses, test scenarios, test cases, and bug reports from rough input, then save and browse the results.

## Run & Operate

- `artifacts/kira` (frontend, served at `/`) — `pnpm --filter @workspace/kira run dev`, restarted via workflow `artifacts/kira: web`
- `artifacts/api-server` (backend, served at `/api`) — Python/FastAPI, run via `bash artifacts/api-server/run_dev.sh`, restarted via workflow `artifacts/api-server: API Server`
- Required env: `DATABASE_URL` (Postgres, pre-provisioned), `SESSION_SECRET` (reused as the JWT signing key)
- Optional env for a real AI provider: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` — an OpenAI-compatible chat-completions endpoint. Unset by default; the backend falls back to a deterministic mock QA-expert provider so the app is fully usable without one.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind, in the pnpm monorepo (`artifacts/kira`), React Query, wouter for routing, react-hook-form + zod for forms. Hand-written fetch client (`src/lib/api.ts`) — no Orval codegen, since the backend isn't part of the OpenAPI/Node pipeline.
- **Backend**: Python 3.11 + FastAPI (`artifacts/api-server`), SQLAlchemy ORM (not Drizzle), JWT auth (python-jose) with bcrypt password hashing (the `bcrypt` package directly, not passlib), Pydantic schemas.
- **Database**: the project's pre-provisioned Postgres, accessed via SQLAlchemy. Tables are created via `Base.metadata.create_all()` at app startup — there is no Alembic/migration tool yet, so schema changes should be made deliberately.
- **Auth**: local email/password + JWT (not Clerk/Replit Auth) — explicitly requested for this project.

## Architecture decisions

- The monorepo's standard OpenAPI → Orval codegen → Drizzle pipeline is Node/TypeScript-only and was bypassed: this project's backend is Python/FastAPI per explicit user request, so the API contract lives in `artifacts/kira/API_CONTRACT.md` (hand-written) instead of `lib/api-spec/openapi.yaml`, and the frontend calls it through a hand-written fetch wrapper instead of generated hooks.
- The `artifacts/api-server` artifact (originally scaffolded as Node/Express) was repurposed to run the Python service; its `artifact.toml` runs `run_dev.sh`/`run_prod.sh` shell scripts (cwd = the artifact directory) that launch `uvicorn` bound to `$PORT`, with the FastAPI app itself owning the `/api` path prefix.
- Because this backend is not part of the Drizzle-tracked schema, production schema changes must be applied manually (e.g. via `executeSql` or a future migration tool) — the platform's automatic dev→prod schema diff does not cover it.

## Product

- Auth: register / login (email + password), JWT stored client-side.
- Dashboard: activity summary, saved-result counts by type, recent activity, AI provider status.
- AI Chat: ChatGPT-style conversation with a senior-QA-expert persona, multiple threads.
- Generators (input form → structured AI output → optional "Save Result"): Requirement Analyzer, Test Scenario Generator, Test Case Generator, Bug Report Generator.
- Saved Results: browse/filter previously saved generated artifacts.
- The AI is prompted (and the mock fallback is written) to never claim test execution or bug confirmation without evidence, to surface assumptions and missing information explicitly, and to never invent project details.

## User preferences

- Backend must stay Python/FastAPI, not merged into the Node/TypeScript pipeline, per explicit user choice.

## Gotchas

- `passlib`'s bcrypt backend (1.7.4) is incompatible with modern `bcrypt` (>=4.1) — it probes a removed `bcrypt.__about__` attribute and then mis-detects a truncation bug, raising on any real password. Use the `bcrypt` package directly for hashing/verification instead of `passlib.CryptContext`.
- Any `apiFetch` 401 must only trigger a global "session expired" redirect if a token was actually sent. Dispatching the redirect on *every* 401 (including the anonymous `/auth/me` probe on `/login`/`/register`) bounces unauthenticated visitors off `/register` straight back to `/login`.
- In this Tailwind v4 (CSS-first) setup, an external `@import url(...)` (e.g. Google Fonts) must come *before* `@import 'tailwindcss'` in `index.css`, or PostCSS errors with "@import must precede all other statements" once Tailwind's own rules are expanded.
- Artifact `run` commands for non-pnpm services execute with cwd = the artifact's own directory, not the repo root — reference sibling files with relative paths, not `artifacts/<slug>/...`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- `artifacts/kira/API_CONTRACT.md` — source of truth for the Python backend's REST API (request/response shapes, auth model).
