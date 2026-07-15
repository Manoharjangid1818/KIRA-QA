"""Vision / multimodal AI service.

Separate from ai_service.py so the vision provider can be swapped
independently (e.g. swap Qwen-VL for GPT-4o) without touching the
text pipeline.

Configuration:
  VISION_PROVIDER   – e.g. "openai"
  VISION_MODEL      – e.g. "gpt-4o" or "Qwen/Qwen2-VL-7B"
  VISION_BASE_URL   – OpenAI-compatible base URL
  VISION_API_KEY    – optional

When unconfigured the service returns a clearly-labelled mock response
so the rest of the application stays usable without a vision endpoint.
"""

from __future__ import annotations

import httpx

from app.core.config import settings

# MIME types for supported image formats
_MIME = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
}


class VisionServiceError(Exception):
    """Raised when the configured vision provider fails."""


async def analyze_image(
    file_data_b64: str,
    file_type: str,
    question: str,
    file_name: str = "image",
) -> str:
    """Send an image (base64) + question to the vision model and return the answer."""
    if not settings.vision_configured:
        return _mock_vision_reply(file_name, question)

    mime = _MIME.get(file_type.lower(), "image/jpeg")
    data_url = f"data:{mime};base64,{file_data_b64}"

    messages = [
        {
            "role": "system",
            "content": (
                "You are KIRA, a senior QA expert assistant. "
                "When analyzing screenshots or images, be precise about what you can actually see. "
                "Do not claim issues are confirmed unless they are clearly visible. "
                "Separate observations from inferences. "
                "For UI analysis, structure your findings as: Issue | Location | Expected | Severity."
            ),
        },
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_url}},
                {"type": "text", "text": question},
            ],
        },
    ]

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if settings.vision_api_key:
        headers["Authorization"] = f"Bearer {settings.vision_api_key}"

    payload = {
        "model": settings.vision_model,
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.3,
    }

    url = settings.vision_base_url.rstrip("/") + "/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError) as exc:
        raise VisionServiceError(f"Vision provider request failed: {exc}") from exc


def _mock_vision_reply(file_name: str, question: str) -> str:
    return (
        f"**Note:** No vision model is configured (`VISION_MODEL` / `VISION_BASE_URL` are unset), "
        f"so this is a mock response for development.\n\n"
        f"**File:** {file_name}\n"
        f"**Question:** {question}\n\n"
        "To enable real image analysis, set the following environment variables:\n"
        "```\nVISION_PROVIDER=openai\nVISION_MODEL=<your-model>\n"
        "VISION_BASE_URL=<endpoint>\nVISION_API_KEY=<key>\n```\n\n"
        "_Human review is recommended for all QA image analysis._"
    )
