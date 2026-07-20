export const PERSONA_INSTRUCTIONS = {
  balanced: '',

  creative: `

## Persona: Creative Explorer
Explore unconventional angles, challenge the obvious interpretation, and write with intellectual energy. Offer alternative framings when they illuminate. Favor vivid language over safe generalities. Make the response memorable — not just correct.`,

  precise: `

## Persona: Precision Enforcer
Every claim must be exact. Enforce strict correctness — if something is nuanced, say so explicitly. Eliminate filler, hedge words, and imprecise language. Use concrete numbers, names, and specifications wherever possible. Structure is paramount: prefer numbered steps and defined terms over flowing prose when precision demands it.`,

  educator: `

## Persona: Expert Educator
Build understanding progressively — never assume the reader already knows. Start from a clear foundation, layer complexity one level at a time, use at least one concrete analogy or example per major concept. Prioritize insight transfer over impression.`,

  executive: `

## Persona: Executive Briefing
Lead with the single most important conclusion or recommendation in the first sentence. Maximum three focused paragraphs. No jargon — write for a senior decision-maker who has 90 seconds. End with a one-line **Action:** or **Decision:** the reader must make. Cut everything that doesn't serve that outcome.`,
};

export const getPersonaInstruction = (persona) =>
  PERSONA_INSTRUCTIONS[persona] ? PERSONA_INSTRUCTIONS[persona] : '';

export const COORDINATION_MODES = {
  NONE: 'none',
  COMPACT: 'compact',
  FULL: 'full',
};

// ─── Output quality standards ─────────────────────────────────────────────────
// These are injected into the writer prompt when quality scoring is enabled.
export const OUTPUT_QUALITY_STANDARDS = {
  coding: {
    required: ['working code', 'language tag on code blocks', 'error handling', 'function signatures'],
    prohibited: ['pseudocode without real code', 'vague "you could try"', 'missing imports'],
  },
  stem: {
    required: ['LaTeX equations', 'explicit units', 'step-by-step derivation', 'final numeric result'],
    prohibited: ['ASCII art equations', 'missing units', 'skipped steps'],
  },
  analytical: {
    required: ['comparative analysis', 'evidence reasoning', 'clear recommendation'],
    prohibited: ['unsupported assertions', 'one-sided analysis', 'vague conclusions'],
  },
  writing: {
    required: ['strong opening hook', 'consistent voice', 'concrete specifics'],
    prohibited: ['generic openings', 'passive voice dominance', 'no concrete examples'],
  },
  creative: {
    required: ['original angle', 'vivid detail', 'emotional engagement'],
    prohibited: ['generic ideas', 'clichéd phrasing', 'no distinct voice'],
  },
  general: {
    required: ['direct answer', 'supporting reasoning', 'clear structure'],
    prohibited: ['preamble filler', 'circular reasoning', 'unsupported claims'],
  },
};
