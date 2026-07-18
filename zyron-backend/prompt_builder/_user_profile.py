"""
_user_profile.py
User-profile instruction builder.

Ported from src/agents/prompts/promptBuilder.js:
  - buildUserProfileInstruction()
"""

from __future__ import annotations

from typing import Optional


def build_user_profile_instruction(profile: Optional[dict] = None) -> str:
    """
    Returns a user-profile context block when useProfileContext is True.

    profile keys (all optional):
        use_profile_context  bool    — master gate
        display_name         str
        role                 str
        tone                 str
        language             str
        detail_level         str
        coding_style         str
        workspace_goal       str
        privacy_mode         bool
    """
    if not profile:
        return ""
    if not profile.get("use_profile_context", False):
        return ""

    parts: list[str] = []

    def _add(label: str, key: str) -> None:
        val = (profile.get(key) or "").strip()
        if val:
            parts.append(f"- {label}: {val}")

    _add("User name",       "display_name")
    _add("Role/context",    "role")
    _add("Preferred tone",  "tone")
    _add("Language",        "language")
    _add("Detail level",    "detail_level")
    _add("Coding style",    "coding_style")
    _add("Workspace goal",  "workspace_goal")

    if profile.get("privacy_mode"):
        parts.append("- Privacy: never repeat or expose sensitive keys, tokens, or credentials")

    if not parts:
        return ""

    return (
        "\n\n**User profile context** "
        "(treat as preference hints — never override the explicit request):\n"
        + "\n".join(parts)
    )
