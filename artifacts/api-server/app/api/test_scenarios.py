from fastapi import APIRouter, HTTPException

from app.schemas.schemas import TestScenarioRequest, TestScenarioResult
from app.services.ai_service import AIServiceError, ai_service

router = APIRouter(prefix="/test-scenarios", tags=["test-scenarios"])


@router.post("/generate", response_model=TestScenarioResult)
async def generate(payload: TestScenarioRequest) -> TestScenarioResult:
    prompt = (
        "Generate QA test scenarios as a senior QA expert. Return a JSON object with a "
        "single key 'scenarios', an array of objects each with: scenario_id (short string "
        "code), title (string), description (string), type (one of 'positive', 'negative', "
        "'boundary', 'edge_case'), priority (one of 'High', 'Medium', 'Low'). Include at "
        "least one positive, one negative, one boundary, and one edge_case scenario.\n\n"
        f"Module: {payload.module_name}\nFeature: {payload.feature_name}\n"
        f"Requirement: {payload.requirement}"
    )
    try:
        data = await ai_service.generate_structured(
            prompt,
            lambda: ai_service.mock_test_scenarios(
                payload.module_name, payload.feature_name, payload.requirement
            ),
        )
        return TestScenarioResult(**data)
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
