from fastapi import APIRouter, HTTPException

from app.schemas.schemas import BugReportRequest, BugReportResult
from app.services.ai_service import AIServiceError, ai_service

router = APIRouter(prefix="/bug-reports", tags=["bug-reports"])


@router.post("/generate", response_model=BugReportResult)
async def generate(payload: BugReportRequest) -> BugReportResult:
    prompt = (
        "Draft a structured bug report from the rough description below, as a senior QA "
        "expert. Return a JSON object with exactly these keys: title (string), "
        "module (string), environment (string), preconditions (string), "
        "steps_to_reproduce (string array), expected_result (string), actual_result "
        "(string), severity (one of 'Critical', 'High', 'Medium', 'Low'), priority (one "
        "of 'High', 'Medium', 'Low'), information_required (string array). Do NOT invent "
        "missing information -- if reproduction steps, environment, or other details are "
        "not given or unclear, put the literal string 'Information Required' in that "
        "field and add an explanation to information_required. Never state or imply that "
        "the bug has been confirmed or reproduced by you.\n\n"
        f"Rough description: {payload.description}\nModule: {payload.module}\n"
        f"Environment: {payload.environment}\n"
        f"Known reproduction steps: {payload.reproduction_steps or '(none provided)'}"
    )
    try:
        data = await ai_service.generate_structured(
            prompt,
            lambda: ai_service.mock_bug_report(
                payload.description,
                payload.module,
                payload.environment,
                payload.reproduction_steps,
            ),
        )
        return BugReportResult(**data)
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
