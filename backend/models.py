"""
models.py
Pydantic request/response models for the Zyron FastAPI backend.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ─── Sub-models: agent configuration ──────────────────────────────────────────

class AgentConfig(BaseModel):
    """Per-agent API credentials and routing information."""

    provider: Literal[
        "openai",
        "anthropic",
        "gemini",
        "openrouter",
        "mistral",
        "deepseek",
        "groq",
        "glm",
    ]
    model: str
    key: str
    timeout_ms: Optional[int] = Field(
        default=None,
        alias="timeoutMs",
        description="Request timeout in milliseconds. Uses provider default when omitted.",
    )

    model_config = {"populate_by_name": True}


# ─── Sub-models: team structure ───────────────────────────────────────────────

class AgentMeta(BaseModel):
    """Role-level identity and directive for a single specialist."""

    name: str
    specialist_directive: str = Field(alias="specialistDirective")
    contribution_lens: str = Field(alias="contributionLens")

    model_config = {"populate_by_name": True}


class TeamAgents(BaseModel):
    """The four specialist slots every team must fill."""

    reasoner: AgentMeta
    coder: AgentMeta
    vision: AgentMeta
    writer: AgentMeta


class Team(BaseModel):
    """Full team definition — mirrors the JS team config schema."""

    id: str
    name: str
    agents: TeamAgents
    writer_rules: Optional[str] = Field(
        default=None,
        alias="writerRules",
        description="Extra synthesis instructions injected into the writer prompt.",
    )
    shared_brief_suffix: Optional[str] = Field(
        default=None,
        alias="sharedBriefSuffix",
        description="Appended verbatim to the shared brief string.",
    )
    greeting_reply: Optional[str] = Field(
        default=None,
        alias="greetingReply",
        description="Short canned reply used for simple conversational queries.",
    )
    analysis_bias: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="analysisBias",
        description=(
            "Override flags forwarded to analyze_query(), e.g. "
            '{"needsCode": true, "preferAnalytical": true}.'
        ),
    )

    model_config = {"populate_by_name": True}


# ─── Sub-models: user profile ─────────────────────────────────────────────────

class UserProfile(BaseModel):
    """Optional personalisation context forwarded to prompt builders."""

    display_name: Optional[str] = Field(default=None, alias="displayName")
    role: Optional[str] = None
    tone: Optional[str] = None
    language: Optional[str] = None
    detail_level: Optional[str] = Field(default=None, alias="detailLevel")
    coding_style: Optional[str] = Field(default=None, alias="codingStyle")
    workspace_goal: Optional[str] = Field(default=None, alias="workspaceGoal")
    privacy_mode: bool = Field(default=False, alias="privacyMode")
    use_profile_context: bool = Field(default=True, alias="useProfileContext")

    model_config = {"populate_by_name": True}


# ─── Request model ─────────────────────────────────────────────────────────────

class OrchestrateRequest(BaseModel):
    """
    Body accepted by POST /orchestrate.

    Required fields: query, agent_configs.
    Everything else is optional enrichment forwarded to the pipeline.
    """

    query: str = Field(..., min_length=1, description="The user's raw input text.")
    session_id: Optional[str] = Field(
        default=None,
        alias="sessionId",
        description=(
            "Opaque session identifier forwarded from the frontend. "
            "Used as the SQLite key for conversation memory summaries."
        ),
    )
    agent_configs: Dict[str, AgentConfig] = Field(
        ...,
        alias="agentConfigs",
        description=(
            'Map of role → AgentConfig, e.g. {"reasoner": {...}, "coder": {...}}. '
            "Roles not present fall back to the writer config."
        ),
    )
    team: Optional[Team] = Field(
        default=None,
        description="Active team definition. Drives specialist directives and analysis bias.",
    )
    persona: Optional[str] = Field(
        default=None,
        description="Persona key (balanced | creative | precise | educator | executive).",
    )
    user_profile: Optional[UserProfile] = Field(
        default=None,
        alias="userProfile",
        description="User personalisation context.",
    )
    search_results: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="searchResults",
        description=(
            "Pre-fetched web search result from the frontend. "
            "When present the backend skips its own search to avoid a duplicate round-trip."
        ),
    )
    document_context: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="documentContext",
        description=(
            "User-uploaded document context { text, filename }. "
            "Text is pre-extracted on device and injected into all specialist prompts."
        ),
    )

    model_config = {"populate_by_name": True}


# ─── Document extraction models ───────────────────────────────────────────────

class DocumentExtractRequest(BaseModel):
    """Body accepted by POST /extract-document."""

    filename: str
    base64Data: str
    mimeType: str


class DocumentExtractResponse(BaseModel):
    """Response from POST /extract-document."""

    text: str
    success: bool
    error: Optional[str] = None
    thumbnail: Optional[str] = None   # base64 PNG of PDF page 1; None for DOCX/TXT


# ─── Response models ───────────────────────────────────────────────────────────

class AgentResult(BaseModel):
    """Output from a single specialist agent."""

    role: str = Field(description="Specialist role: reasoner | coder | vision | writer.")
    name: str = Field(description="Display name of the agent (from TeamAgents).")
    output: str = Field(description="The agent's raw text response.")
    status: Literal["success", "error", "timeout"] = "success"
    token_usage: Optional[Dict[str, int]] = Field(
        default=None,
        alias="tokenUsage",
        description='{"prompt_tokens": n, "completion_tokens": n, "total_tokens": n}',
    )

    model_config = {"populate_by_name": True}


class OrchestrateResponse(BaseModel):
    """Top-level response returned by POST /orchestrate."""

    text: str = Field(description="Final synthesised answer produced by the writer agent.")
    agents: List[AgentResult] = Field(
        default_factory=list,
        description="Per-specialist results (reasoner, coder, vision, writer).",
    )
    token_usage: Optional[Dict[str, Dict[str, int]]] = Field(
        default=None,
        alias="tokenUsage",
        description='Per-role token counts, e.g. {"Reasoner": {"prompt_tokens": n, ...}}.',
    )
    meta: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Debug/telemetry payload — query analysis flags, timing, etc.",
    )

    model_config = {"populate_by_name": True}
