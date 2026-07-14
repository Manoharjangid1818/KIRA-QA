# KIRA API Contract

Backend: Python/FastAPI, mounted at base path `/api` (paths below are relative to that, e.g. `/api/auth/login`). All request/response bodies are JSON. Auth uses a JWT bearer token: send `Authorization: Bearer <token>` on every request except register/login. There is no generated client — write a small typed `fetch` wrapper in `src/services/` (or `src/lib/api.ts`) that reads/writes the token from `localStorage`, attaches the header automatically, and throws a typed `ApiError { status, message }` on non-2xx responses (parse `{ "detail": "..." }` from the body for the message).

## Auth

`POST /api/auth/register`
Body: `{ email: string, password: string, full_name: string }`
201: `{ access_token: string, token_type: "bearer", user: { id: number, email: string, full_name: string } }`
422/400 on validation error or duplicate email: `{ detail: string }`

`POST /api/auth/login`
Body: `{ email: string, password: string }`
200: same shape as register response
401: `{ detail: "Incorrect email or password" }`

`GET /api/auth/me`
200: `{ id: number, email: string, full_name: string }`
401 if token missing/invalid.

## Dashboard

`GET /api/dashboard/summary`
200:
```json
{
  "total_conversations": 0,
  "total_artifacts": 0,
  "artifacts_by_type": { "requirement_analysis": 0, "test_scenario": 0, "test_case": 0, "bug_report": 0, "security": 0 },
  "recent_activity": [ { "type": "requirement_analysis", "title": "string", "id": 1, "created_at": "iso-datetime" } ],
  "ai_provider": { "configured": true, "model": "string|null" }
}
```

## AI Chat (conversations)

`GET /api/conversations` -> 200: `[ { id: number, title: string, created_at: iso, updated_at: iso, message_count: number } ]` (newest first)

`POST /api/conversations` Body: `{ title?: string }` -> 201: `{ id, title, created_at, updated_at }`

`GET /api/conversations/{id}` -> 200: `{ id, title, created_at, updated_at, messages: [ { id: number, role: "user"|"assistant", content: string, created_at: iso } ] }`

`PATCH /api/conversations/{id}` Body: `{ title: string }` -> 200: updated conversation

`DELETE /api/conversations/{id}` -> 204

`POST /api/conversations/{id}/messages` Body: `{ content: string }` -> 201: `{ user_message: { id, role: "user", content, created_at }, assistant_message: { id, role: "assistant", content, created_at } }`. `content` on the assistant message is markdown (may include fenced code blocks) — the AI persona is a senior software QA expert. Render markdown with code formatting in the UI.

## Requirement Analyzer

`POST /api/requirement-analyzer/generate`
Body: `{ requirement_text: string }`
200:
```json
{
  "summary": "string",
  "functional_requirements": ["string"],
  "positive_scenarios": ["string"],
  "negative_scenarios": ["string"],
  "edge_cases": ["string"],
  "missing_information": ["string"],
  "risks": ["string"],
  "questions_for_po": ["string"],
  "assumptions": ["string"]
}
```
This does NOT save anything — it just returns the generated analysis. Pair with the generic save endpoint below (`artifact_type: "requirement_analysis"`) when the user clicks "Save".

## Test Scenario Generator

`POST /api/test-scenarios/generate`
Body: `{ module_name: string, feature_name: string, requirement: string }`
200: `{ "scenarios": [ { "scenario_id": "string", "title": "string", "description": "string", "type": "positive"|"negative"|"boundary"|"edge_case", "priority": "High"|"Medium"|"Low" } ] }`

## Test Case Generator

`POST /api/test-cases/generate`
Body: `{ module: string, requirement: string, number_of_test_cases: number }`
200: `{ "test_cases": [ { "test_case_id": "string", "objective": "string", "preconditions": "string", "test_data": "string", "steps": ["string"], "expected_result": "string", "priority": "High"|"Medium"|"Low", "test_type": "string" } ] }`

## Bug Report Generator

`POST /api/bug-reports/generate`
Body: `{ description: string, module: string, environment: string, reproduction_steps: string }`
200: `{ "title": "string", "module": "string", "environment": "string", "preconditions": "string", "steps_to_reproduce": ["string"], "expected_result": "string", "actual_result": "string", "severity": "Critical"|"High"|"Medium"|"Low", "priority": "High"|"Medium"|"Low", "information_required": ["string"] }`
`information_required` lists any fields the AI could not fill in confidently — the UI should surface these prominently rather than hide them, never invent values in the other fields to compensate.

## Saved Results (Generated Artifacts)

`POST /api/artifacts`
Body: `{ artifact_type: "requirement_analysis"|"test_scenario"|"test_case"|"bug_report"|"security", title: string, input_data: object, output_data: object }`
201: `{ id: number, artifact_type: string, title: string, input_data: object, output_data: object, created_at: iso }`

`GET /api/artifacts?artifact_type=<optional>` -> 200: `[ { id, artifact_type, title, created_at } ]` (list view omits the full payload; newest first)

`GET /api/artifacts/{id}` -> 200: full object including `input_data` and `output_data`

`DELETE /api/artifacts/{id}` -> 204

## Notes for the frontend

- Every generator page (`Requirement Analyzer`, `Test Scenario Generator`, `Test Case Generator`, `Bug Report Generator`) follows the same pattern: an input form, a "Generate" action that calls the `*/generate` endpoint, a results view, and a "Save Result" button that posts to `/api/artifacts` with the form input as `input_data` and the generated response as `output_data`.
- The backend never claims generated test cases were executed or that a bug is confirmed — surface any `assumptions` / `information_required` fields returned by the API clearly in the UI rather than omitting them.
- 401 responses anywhere should redirect to the login page and clear the stored token.
