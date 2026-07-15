from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserOut


# ---------- Conversations ----------


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

    model_config = {"from_attributes": True}


class ConversationDetailOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageOut]

    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1)
    knowledge_base_id: int | None = None


class SendMessageResponse(BaseModel):
    user_message: MessageOut
    assistant_message: MessageOut
    rag_sources: list[dict] | None = None


# ---------- Requirement analyzer ----------


class RequirementAnalyzerRequest(BaseModel):
    requirement_text: str = Field(min_length=1)


class RequirementAnalyzerResult(BaseModel):
    summary: str
    functional_requirements: list[str]
    positive_scenarios: list[str]
    negative_scenarios: list[str]
    edge_cases: list[str]
    missing_information: list[str]
    risks: list[str]
    questions_for_po: list[str]
    assumptions: list[str]


# ---------- Test scenarios ----------


class TestScenarioRequest(BaseModel):
    module_name: str = Field(min_length=1)
    feature_name: str = Field(min_length=1)
    requirement: str = Field(min_length=1)


class TestScenario(BaseModel):
    scenario_id: str
    title: str
    description: str
    type: Literal["positive", "negative", "boundary", "edge_case"]
    priority: Literal["High", "Medium", "Low"]


class TestScenarioResult(BaseModel):
    scenarios: list[TestScenario]


# ---------- Test cases ----------


class TestCaseRequest(BaseModel):
    module: str = Field(min_length=1)
    requirement: str = Field(min_length=1)
    number_of_test_cases: int = Field(ge=1, le=20)


class TestCase(BaseModel):
    test_case_id: str
    objective: str
    preconditions: str
    test_data: str
    steps: list[str]
    expected_result: str
    priority: Literal["High", "Medium", "Low"]
    test_type: str


class TestCaseResult(BaseModel):
    test_cases: list[TestCase]


# ---------- Bug reports ----------


class BugReportRequest(BaseModel):
    description: str = Field(min_length=1)
    module: str = Field(min_length=1)
    environment: str = ""
    reproduction_steps: str = ""


class BugReportResult(BaseModel):
    title: str
    module: str
    environment: str
    preconditions: str
    steps_to_reproduce: list[str]
    expected_result: str
    actual_result: str
    severity: Literal["Critical", "High", "Medium", "Low"]
    priority: Literal["High", "Medium", "Low"]
    information_required: list[str]


# ---------- Generated artifacts (saved results) ----------


class GeneratedArtifactCreate(BaseModel):
    artifact_type: Literal[
        "requirement_analysis", "test_scenario", "test_case", "bug_report", "security"
    ]
    title: str = Field(min_length=1, max_length=255)
    input_data: dict[str, Any]
    output_data: dict[str, Any]


class GeneratedArtifactListItem(BaseModel):
    id: int
    artifact_type: str
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GeneratedArtifactOut(BaseModel):
    id: int
    artifact_type: str
    title: str
    input_data: dict[str, Any]
    output_data: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Knowledge Base / RAG ----------


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""


class KnowledgeBaseOut(BaseModel):
    id: int
    name: str
    description: str
    created_by: int
    created_at: datetime
    document_count: int = 0

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: int
    knowledge_base_id: int
    file_name: str
    file_type: str
    file_size: int
    uploaded_by: int
    processing_status: str
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChunkSourceOut(BaseModel):
    document_id: int
    file_name: str
    chunk_index: int
    chunk_text: str
    similarity_score: float


class RAGAnswerResponse(BaseModel):
    answer: str
    sources: list[ChunkSourceOut]
    knowledge_base_used: bool


class RAGQuestionRequest(BaseModel):
    question: str = Field(min_length=1)
    allow_general_knowledge: bool = False


# ---------- Dashboard ----------


class AiProviderStatus(BaseModel):
    configured: bool
    model: str | None


class RecentActivityItem(BaseModel):
    type: str
    id: int
    title: str
    created_at: datetime


class DashboardSummary(BaseModel):
    total_conversations: int
    total_artifacts: int
    artifacts_by_type: dict[str, int]
    recent_activity: list[RecentActivityItem]
    ai_provider: AiProviderStatus
