from fastapi import APIRouter, HTTPException

from app.schemas.schemas import TestCaseRequest, TestCaseResult
from app.services.ai_service import AIServiceError, ai_service

router = APIRouter(prefix="/test-cases", tags=["test-cases"])


@router.post("/generate", response_model=TestCaseResult)
async def generate(payload: TestCaseRequest) -> TestCaseResult:
    prompt = (
        "Generate detailed QA test cases as a senior QA expert. Return a JSON object with "
        "a single key 'test_cases', an array of exactly "
        f"{payload.number_of_test_cases} objects, each with: test_case_id (short string "
        "code), objective (string), preconditions (string), test_data (string), "
        "steps (array of numbered-step strings), expected_result (string, clear and "
        "testable), priority (one of 'High', 'Medium', 'Low'), test_type (string, e.g. "
        "'Functional', 'Negative', 'Boundary', 'Regression'). Never claim these test cases "
        "were actually executed -- they are proposed cases for a human tester to run.\n\n"
        f"Module: {payload.module}\nRequirement: {payload.requirement}\n"
        f"Number of test cases: {payload.number_of_test_cases}"
    )
    try:
        data = await ai_service.generate_structured(
            prompt,
            lambda: ai_service.mock_test_cases(
                payload.module, payload.requirement, payload.number_of_test_cases
            ),
        )
        return TestCaseResult(**data)
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
