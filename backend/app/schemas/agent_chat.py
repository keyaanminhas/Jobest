from datetime import datetime

from pydantic import BaseModel, Field


class CreateAgentChatSessionRequest(BaseModel):
    title: str = "Recruiter Copilot"
    job_posting_id: str | None = None
    candidate_id: str | None = None


class AgentChatMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=12000)


class AgentChatMessageItem(BaseModel):
    id: str
    role: str
    content: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime


class AgentToolTraceItem(BaseModel):
    id: str
    tool_name: str
    risk_class: str
    status: str
    arguments: dict = Field(default_factory=dict)
    result: dict = Field(default_factory=dict)
    created_at: datetime


class AgentPendingActionItem(BaseModel):
    id: str
    tool_name: str
    arguments: dict = Field(default_factory=dict)
    summary: str
    status: str
    expires_at: datetime


class AgentChatSessionItem(BaseModel):
    id: str
    title: str
    job_posting_id: str | None = None
    candidate_id: str | None = None
    created_at: datetime
    updated_at: datetime


class AgentChatSessionResponse(AgentChatSessionItem):
    messages: list[AgentChatMessageItem] = Field(default_factory=list)
    traces: list[AgentToolTraceItem] = Field(default_factory=list)
    pending_actions: list[AgentPendingActionItem] = Field(default_factory=list)


class AgentChatTurnResponse(BaseModel):
    session: AgentChatSessionResponse
    assistant_message: AgentChatMessageItem
    pending_action: AgentPendingActionItem | None = None
