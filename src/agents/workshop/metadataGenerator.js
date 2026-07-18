/**
 * metadataGenerator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates deterministic contributionLens, specialistDirective, and
 * accentDim/accentGlow values from a custom-agent form object.
 *
 * Exports:
 *   generateContributionLens(form)   → string
 *   generateSpecialistDirective(form)→ string
 *   generateAgentColors(accent)      → { dim, glow }
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Color helpers ─────────────────────────────────────────────────────────────

/**
 * Derive dim (12% alpha) and glow (35% alpha) variants from a hex accent color.
 */
export const generateAgentColors = (accent = '#A78BFA') => ({
  dim: hexToRgba(accent, 0.12),
  glow: hexToRgba(accent, 0.35),
});

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Contribution lens ─────────────────────────────────────────────────────────

/**
 * Build a short contribution lens string from form fields.
 * Used as the agent's contextual summary in multi-agent pipelines.
 */
export const generateContributionLens = (form = {}) => {
  const name = (form.name || 'Specialist').trim();
  const parts = [];

  if (form.personality?.length) {
    parts.push(form.personality.join(', ').toLowerCase());
  }
  if (form.tone?.length) {
    parts.push(`${form.tone.join('/').toLowerCase()} communication`);
  }
  if (form.communicationStyle?.length) {
    parts.push(`${form.communicationStyle.join('/').toLowerCase()} delivery`);
  }

  const strengths = [];
  if ((form.reasoningStrength ?? 50) >= 75) strengths.push('deep reasoning');
  if ((form.creativityStrength ?? 50) >= 75) strengths.push('creative ideation');
  if ((form.analyticalStrength ?? 50) >= 75) strengths.push('rigorous analysis');
  if ((form.codingStrength ?? 50) >= 75) strengths.push('technical implementation');
  if ((form.teachingStrength ?? 50) >= 75) strengths.push('clear explanation');
  if (strengths.length) parts.push(strengths.join(', '));

  if (!parts.length) return `specialist insight from ${name}`;
  return parts.join(', ');
};

// ── Specialist directive ──────────────────────────────────────────────────────

/**
 * Generate a system-prompt directive string for the custom agent.
 */
export const generateSpecialistDirective = (form = {}) => {
  const name = (form.name || 'Specialist').trim();
  const description = (form.description || '').trim();

  const toneStr = form.tone?.length ? form.tone.join(', ') : 'Professional';
  const styleStr = form.communicationStyle?.length
    ? form.communicationStyle.join(', ')
    : 'Balanced';
  const personalityStr = form.personality?.length
    ? form.personality.join(', ')
    : 'Expert';

  const strengthNotes = [];
  if ((form.reasoningStrength ?? 50) >= 75) {
    strengthNotes.push('Apply deep first-principles reasoning.');
  }
  if ((form.creativityStrength ?? 50) >= 75) {
    strengthNotes.push('Bring creative, novel angles to the problem.');
  }
  if ((form.analyticalStrength ?? 50) >= 75) {
    strengthNotes.push('Analyse rigorously — data, logic, edge cases.');
  }
  if ((form.codingStrength ?? 50) >= 75) {
    strengthNotes.push('Provide complete, working code with no placeholders.');
  }
  if ((form.teachingStrength ?? 50) >= 75) {
    strengthNotes.push('Explain concepts clearly so anyone can follow.');
  }

  const descLine = description
    ? `\n\nYour expertise: ${description}`
    : '';

  const strengthBlock = strengthNotes.length
    ? `\n\n${strengthNotes.join(' ')}`
    : '';

  return `You are **${name}**, a specialist agent with a ${personalityStr} mindset.${descLine}

Tone: ${toneStr}. Communication style: ${styleStr}.${strengthBlock}

Contribute your unique perspective clearly and completely. Stay focused on your specialist angle.`;
};
