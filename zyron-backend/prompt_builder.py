"""
prompt_builder.py  (stub)
─────────────────────────────────────────────────────────────────────────────
This file exists only for backwards-compatibility with any import that
references  `from prompt_builder import ...`  at the zyron-backend root.

All real logic lives in the  prompt_builder/  package:
  prompt_builder/_style.py         — build_style_instruction, build_non_tech_discipline
  prompt_builder/_templates.py     — all domain templates + get_expert_template
  prompt_builder/_user_profile.py  — build_user_profile_instruction
  prompt_builder/_specialist.py    — build_specialist_prompt
  prompt_builder/_writer.py        — build_writer_prompt
  prompt_builder/__init__.py       — re-exports

Import from the package directly:
    from prompt_builder import build_specialist_prompt, build_writer_prompt
"""

# Re-export so that `from prompt_builder import X` still works if this file
# is imported instead of the package.
from prompt_builder import build_specialist_prompt, build_writer_prompt  # noqa: F401

__all__ = ["build_specialist_prompt", "build_writer_prompt"]
