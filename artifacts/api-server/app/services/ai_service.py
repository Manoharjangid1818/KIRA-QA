"""Configurable AI service.

Talks to any OpenAI-compatible chat-completions endpoint via LLM_BASE_URL /
LLM_API_KEY / LLM_MODEL. When those are not configured (local development,
or before a real model such as Qwen3-via-vLLM is wired up), everything
falls back to a deterministic mock provider so the product is fully usable
without any external dependency.

Rules baked into every prompt and every mock response, per product spec:
- Never claim generated test cases were actually executed.
- Never claim a bug is confirmed without evidence.
- Clearly mention assumptions.
- Never invent project information -- surface gaps as "information required"
  or "missing information" instead of fabricating detail.
- Recommend human review for important outputs.
"""

import json
import re
from datetime import datetime, timezone

import httpx

from app.core.config import settings

QA_SYSTEM_PROMPT = (
    "You are KIRA, an AI assistant created by KiwiQA. You are a senior software QA expert. "
    "Do NOT say you were created by Anthropic, OpenAI, or anyone else. "
    "You help analyze requirements, design test scenarios/cases, and draft bug reports. "
    "Never claim test cases were actually executed, and never claim a bug is confirmed without evidence. "
    "Clearly flag assumptions and missing information. Respond in clear markdown."
)


class AIServiceError(Exception):
    """Raised when a configured real LLM provider fails or returns invalid output."""


def _strip_think_blocks(text: str) -> str:
    """Remove <think>…</think> reasoning blocks produced by thinking models like Qwen3."""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    return cleaned if cleaned else text


def _extract_json(text: str) -> dict:
    """Best-effort extraction of a JSON object from an LLM response."""
    text = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else text
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        brace_match = re.search(r"\{.*\}", text, re.DOTALL)
        if brace_match:
            return json.loads(brace_match.group(0))
        raise


class AIService:
    def __init__(self) -> None:
        self.configured = settings.ai_configured
        self.model = settings.llm_model

    async def _call_chat_completions(
        self, messages: list[dict], *, json_mode: bool = False
    ) -> str:
        headers = {"Content-Type": "application/json"}
        if settings.llm_api_key:
            headers["Authorization"] = f"Bearer {settings.llm_api_key}"

        payload: dict = {
            "model": settings.llm_model,
            "messages": messages,
            "temperature": 0.4,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        url = settings.llm_base_url.rstrip("/") + "/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                raw = data["choices"][0]["message"]["content"]
                return _strip_think_blocks(raw)
        except (httpx.HTTPError, KeyError, IndexError) as exc:
            raise AIServiceError(f"AI provider request failed: {exc}") from exc

    async def chat_reply(self, history: list[dict]) -> str:
        """history: list of {role, content}, oldest first, WITHOUT the system prompt."""
        if not self.configured:
            return self._mock_chat_reply(history)

        messages = [{"role": "system", "content": QA_SYSTEM_PROMPT}, *history]
        return await self._call_chat_completions(messages)

    async def generate_structured(self, task_prompt: str, mock_fn) -> dict:
        """Generate structured JSON output for a generator page.

        `mock_fn` is called with no arguments and must return a plain dict
        matching the expected schema when no real provider is configured.
        """
        if not self.configured:
            return mock_fn()

        messages = [
            {
                "role": "system",
                "content": QA_SYSTEM_PROMPT
                + " Respond with a single JSON object only -- no prose, no markdown "
                "fences, matching exactly the schema described by the user.",
            },
            {"role": "user", "content": task_prompt},
        ]
        raw = await self._call_chat_completions(messages, json_mode=True)
        try:
            return _extract_json(raw)
        except json.JSONDecodeError as exc:
            raise AIServiceError(
                "The configured AI provider did not return valid JSON."
            ) from exc

    # ------------------------------------------------------------------
    # Mock provider -- deterministic, template-driven, clearly labeled.
    # ------------------------------------------------------------------

    @staticmethod
    def _mock_chat_reply(history: list[dict]) -> str:
        last_user = next(
            (m["content"] for m in reversed(history) if m["role"] == "user"), ""
        )
        snippet = last_user.strip().splitlines()[0][:160] if last_user.strip() else ""
        return (
            f"**Note:** No AI provider is configured yet (`LLM_BASE_URL` / `LLM_MODEL` "
            f"are unset), so this is a mock QA-expert response for development.\n\n"
            f"Regarding: \"{snippet}\"\n\n"
            "As a senior QA reviewer, here's how I'd approach it:\n\n"
            "1. Clarify the acceptance criteria before writing test cases.\n"
            "2. Split coverage into positive, negative, boundary, and edge-case scenarios.\n"
            "3. Call out any assumptions explicitly so they can be reviewed.\n\n"
            "```text\n"
            "Assumption: requirement is interpreted at face value; confirm with the PO/BA.\n"
            "```\n\n"
            "_This is a mock reply for local development -- connect a real model via "
            "`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` for production-quality answers. "
            "Human review is recommended for all QA outputs._"
        )

    @staticmethod
    def mock_requirement_analysis(requirement_text: str) -> dict:
        first_line = requirement_text.strip().splitlines()[0][:200] if requirement_text.strip() else "the provided requirement"
        return {
            "summary": f"Mock analysis (no AI provider configured) of: {first_line}",
            "functional_requirements": [
                "System shall perform the primary action described in the requirement.",
                "System shall validate user input before processing.",
                "System shall persist the result of the action.",
            ],
            "positive_scenarios": [
                "User completes the flow with valid, complete input.",
                "User completes the flow with the minimum required fields.",
            ],
            "negative_scenarios": [
                "User submits with required fields missing.",
                "User submits with invalid data formats.",
            ],
            "edge_cases": [
                "Input at maximum allowed length/size.",
                "Concurrent submissions from the same user.",
            ],
            "missing_information": [
                "Exact validation rules for each field are not specified.",
                "Expected behavior on partial failure is not specified.",
            ],
            "risks": [
                "Ambiguous requirement may lead to inconsistent implementation.",
            ],
            "questions_for_po": [
                "What should happen if the action partially fails?",
                "Are there role-based restrictions on who can perform this action?",
            ],
            "assumptions": [
                "This is a mock result generated without a connected AI provider; "
                "assumptions and gaps above are illustrative and require human review.",
            ],
        }

    @staticmethod
    def mock_test_scenarios(module_name: str, feature_name: str, requirement: str) -> dict:
        base = f"{module_name}-{feature_name}".upper().replace(" ", "-")[:20]
        scenarios = [
            {
                "scenario_id": f"SC-{base}-01",
                "title": f"Verify {feature_name} succeeds with valid input",
                "description": f"Confirm that {feature_name} in {module_name} behaves as expected for a typical valid case.",
                "type": "positive",
                "priority": "High",
            },
            {
                "scenario_id": f"SC-{base}-02",
                "title": f"Verify {feature_name} rejects invalid input",
                "description": f"Confirm that {feature_name} correctly rejects invalid or malformed input with a clear error.",
                "type": "negative",
                "priority": "High",
            },
            {
                "scenario_id": f"SC-{base}-03",
                "title": f"Verify {feature_name} at boundary limits",
                "description": "Confirm behavior at minimum/maximum allowed values or lengths.",
                "type": "boundary",
                "priority": "Medium",
            },
            {
                "scenario_id": f"SC-{base}-04",
                "title": f"Verify {feature_name} under unusual conditions",
                "description": "Confirm behavior for empty state, concurrent access, or unexpected sequencing.",
                "type": "edge_case",
                "priority": "Medium",
            },
        ]
        return {"scenarios": scenarios}

    @staticmethod
    def mock_test_cases(module: str, requirement: str, number_of_test_cases: int) -> dict:
        cases = []
        templates = [
            ("positive", "High"),
            ("negative", "High"),
            ("boundary", "Medium"),
            ("edge case", "Medium"),
            ("regression", "Low"),
        ]
        for i in range(number_of_test_cases):
            kind, priority = templates[i % len(templates)]
            cases.append(
                {
                    "test_case_id": f"TC-{module.upper().replace(' ', '-')[:12]}-{i + 1:02d}",
                    "objective": f"Verify {module} handles a {kind} case for: {requirement.strip()[:100]}",
                    "preconditions": "User is authenticated and has access to the module.",
                    "test_data": "Representative sample data for this case (mock placeholder).",
                    "steps": [
                        "Navigate to the relevant screen/endpoint.",
                        f"Perform the action representing a {kind} scenario.",
                        "Observe the system response.",
                    ],
                    "expected_result": f"System responds correctly for the {kind} scenario, with no unhandled errors.",
                    "priority": priority,
                    "test_type": "Functional",
                }
            )
        return {"test_cases": cases}

    @staticmethod
    def mock_bug_report(description: str, module: str, environment: str, reproduction_steps: str) -> dict:
        steps = [s.strip() for s in reproduction_steps.split("\n") if s.strip()]
        info_required = []
        if not steps:
            info_required.append("Exact reproduction steps were not provided.")
        if not environment.strip():
            info_required.append("Environment details (browser/OS/build) were not provided.")
        return {
            "title": f"[{module}] {description.strip()[:120]}",
            "module": module,
            "environment": environment or "Information Required",
            "preconditions": "Information Required",
            "steps_to_reproduce": steps or ["Information Required"],
            "expected_result": "Information Required",
            "actual_result": description.strip() or "Information Required",
            "severity": "Medium",
            "priority": "Medium",
            "information_required": info_required or [
                "Severity/priority were defaulted to Medium; confirm against actual user impact.",
            ],
        }


ai_service = AIService()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
