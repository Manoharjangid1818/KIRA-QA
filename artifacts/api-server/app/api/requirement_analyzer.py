from fastapi import APIRouter, HTTPException

from app.schemas.schemas import RequirementAnalyzerRequest, RequirementAnalyzerResult
from app.services.ai_service import AIServiceError, ai_service

router = APIRouter(prefix="/requirement-analyzer", tags=["requirement-analyzer"])


@router.post("/generate", response_model=RequirementAnalyzerResult)
async def generate(payload: RequirementAnalyzerRequest) -> RequirementAnalyzerResult:
    prompt = (
        "Analyze the following software requirement as a senior QA expert. "
        "Return a JSON object with exactly these keys: summary (string), "
        "functional_requirements (string array), positive_scenarios (string array), "
        "negative_scenarios (string array), edge_cases (string array), "
        "missing_information (string array of anything unclear or unspecified -- do not "
        "invent details to fill these gaps), risks (string array), "
        "questions_for_po (string array of clarifying questions for the Product Owner/BA), "
        "assumptions (string array of any assumptions you had to make).\n\n"
        f"Requirement:\n{payload.requirement_text}"
    )
    try:
        data = await ai_service.generate_structured(
            prompt, lambda: ai_service.mock_requirement_analysis(payload.requirement_text)
        )
        return RequirementAnalyzerResult(**data)
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
