from datetime import datetime
from typing import Any, Literal, Optional

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
    role: str
    status: str
    department_id: Optional[int] = None

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
    attachment_ids: list[int] = []
    source_mode: str = "auto"  # auto, company, department, project


class SendMessageResponse(BaseModel):
    user_message: MessageOut
    assistant_message: MessageOut
    rag_sources: list[dict] | None = None


# ---------- Chat Attachments ----------

class ChatAttachmentOut(BaseModel):
    id: int
    file_name: str
    file_type: str
    file_category: str
    file_size: int
    status: str
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


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
    kb_type: str = "company"
    department_id: int | None = None
    project_id: int | None = None


class KnowledgeBaseOut(BaseModel):
    id: int
    name: str
    description: str
    kb_type: str
    department_id: int | None = None
    project_id: int | None = None
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


# ---------- Admin: User Management ----------

class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: str = "employee"
    department_id: int | None = None
    status: str = "active"


class AdminUserUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None
    department_id: int | None = None
    status: str | None = None


class AdminUserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    status: str
    department_id: int | None
    last_login: datetime | None
    created_at: datetime
    conversation_count: int = 0
    project_ids: list[int] = []

    model_config = {"from_attributes": True}


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class AdminUserProjectAssign(BaseModel):
    project_ids: list[int]


# ---------- Admin: Departments ----------

class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    manager_id: int | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    manager_id: int | None = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    description: str
    manager_id: int | None
    created_at: datetime
    member_count: int = 0

    model_config = {"from_attributes": True}


# ---------- Admin: Projects ----------

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    manager_id: int | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    manager_id: int | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    status: str
    manager_id: int | None
    created_at: datetime
    member_count: int = 0

    model_config = {"from_attributes": True}


class ProjectMemberAssign(BaseModel):
    user_ids: list[int]


# ---------- Admin: Access Control ----------

class UserPermissionOut(BaseModel):
    user_id: int
    can_upload_files: bool
    can_use_image_analysis: bool
    can_access_company_knowledge: bool
    can_use_restricted_knowledge: bool

    model_config = {"from_attributes": True}


class UserPermissionUpdate(BaseModel):
    can_upload_files: bool | None = None
    can_use_image_analysis: bool | None = None
    can_access_company_knowledge: bool | None = None
    can_use_restricted_knowledge: bool | None = None


# ---------- Admin: AI Model Config ----------

class AIModelConfigOut(BaseModel):
    provider: str
    model_name: str
    base_url: str
    has_api_key: bool
    temperature: float
    max_tokens: int
    timeout: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIModelConfigUpdate(BaseModel):
    provider: str | None = None
    model_name: str | None = None
    base_url: str | None = None
    api_key: str | None = None  # plain text, never returned
    temperature: float | None = None
    max_tokens: int | None = None
    timeout: int | None = None


# ---------- Admin: Vision Model Config ----------

class VisionModelConfigOut(BaseModel):
    provider: str
    model_name: str
    base_url: str
    has_api_key: bool
    timeout: int
    enabled: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class VisionModelConfigUpdate(BaseModel):
    provider: str | None = None
    model_name: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    timeout: int | None = None
    enabled: bool | None = None


# ---------- Admin: RAG Config ----------

class RAGConfigOut(BaseModel):
    chunk_size: int
    chunk_overlap: int
    top_k: int
    embedding_provider: str
    embedding_model: str
    vector_db_provider: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class RAGConfigUpdate(BaseModel):
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    top_k: int | None = None
    embedding_provider: str | None = None
    embedding_model: str | None = None
    vector_db_provider: str | None = None


# ---------- Admin: Prompt Templates ----------

class PromptTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=1)
    is_active: bool = True
    is_default: bool = False


class PromptTemplateUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    content: str | None = None
    is_active: bool | None = None
    is_default: bool | None = None


class PromptTemplateOut(BaseModel):
    id: int
    name: str
    category: str
    content: str
    is_active: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Admin: System Logs ----------

class SystemLogOut(BaseModel):
    id: int
    level: str
    category: str
    message: str
    details: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Admin: Dashboard Stats ----------

class AdminDashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_conversations: int
    total_messages: int
    total_knowledge_bases: int
    total_documents: int
    total_projects: int
    total_departments: int
    failed_documents: int
    system_status: str


# ---------- Admin: Storage ----------

class StorageStats(BaseModel):
    total_documents: int
    total_document_size_bytes: int
    total_attachments: int
    total_attachment_size_bytes: int
    failed_documents: int


# ---------- Admin: Conversation Audit ----------

class ConversationAuditOut(BaseModel):
    id: int
    user_id: int
    user_email: str
    user_name: str
    title: str
    message_count: int
    created_at: datetime
    updated_at: datetime


# ---------- General Settings ----------

class GeneralSettingsOut(BaseModel):
    app_name: str
    max_file_size_mb: int
    max_attachments_per_message: int
    allowed_file_types: str
    temp_file_retention_hours: int
    enable_file_upload: bool
    enable_image_upload: bool
    enable_general_knowledge: bool
    maintenance_mode: bool


class GeneralSettingsUpdate(BaseModel):
    app_name: str | None = None
    max_file_size_mb: int | None = None
    max_attachments_per_message: int | None = None
    allowed_file_types: str | None = None
    temp_file_retention_hours: int | None = None
    enable_file_upload: bool | None = None
    enable_image_upload: bool | None = None
    enable_general_knowledge: bool | None = None
    maintenance_mode: bool | None = None
