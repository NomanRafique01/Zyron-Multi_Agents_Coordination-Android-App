/**
 * src/agents/evals/runEvals.js
 *
 * Regression harness for queryAnalyzer.js classifications.
 *
 * Run after any change to queryAnalyzer.js or synthesizer.js:
 *   node src/agents/evals/runEvals.js
 *
 * Flags any golden query whose classification silently shifted.
 * Exit code 0 = all pass. Exit code 1 = at least one regression.
 *
 * Output format: one line per query, PASS/FAIL + diff on failure.
 */

// Node.js compatible — uses require() since this runs as a CLI script.
// Babel/Metro transpilation is not available here; use CommonJS.

const path = require('path');
const fs = require('fs');

// ─── Inline minimal analyzeQuery for Node (no RN imports) ────────────────────
// We load the source directly via a small shim that stubs RN-specific imports.
// The shim replaces getActiveTeam() with a stub returning a default team name.

// Stub team runtime so we don't need React Native at eval time
const STUB_TEAM = {
  id: 'dev-core',
  name: 'Dev Core',
  analysisBias: {},
  agents: {},
};

// Patch require for the module graph
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request.includes('teamRuntime')) {
    return { getActiveTeam: () => STUB_TEAM };
  }
  if (request.includes('teamMetadata')) {
    return {
      COORDINATION_MODES: { NONE: 'none', COMPACT: 'compact', FULL: 'full' },
    };
  }
  return originalLoad.call(this, request, ...rest);
};

// ─── Load golden queries ───────────────────────────────────────────────────────
const goldenPath = path.join(__dirname, 'goldenQueries.json');
const goldenQueries = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

// ─── Dynamically import the analyzeQuery function ─────────────────────────────
// We use a transpiled copy if available, otherwise require the raw source.
let analyzeQuery;
try {
  // Try built/transpiled output first
  ({ analyzeQuery } = require('../analysis/queryAnalyzer'));
} catch {
  console.error('[runEvals] Could not load queryAnalyzer. Run babel/metro build first, or run from the project root with Babel register.');
  process.exit(1);
}

// ─── Comparison helper ────────────────────────────────────────────────────────
const check = (actual, expected) => {
  const failures = [];
  for (const [key, expectedVal] of Object.entries(expected)) {
    const actualVal = actual[key];
    if (actualVal !== expectedVal) {
      failures.push({ key, expected: expectedVal, actual: actualVal });
    }
  }
  return failures;
};

// ─── Run ──────────────────────────────────────────────────────────────────────
let totalPass = 0;
let totalFail = 0;

console.log('\n── Zyron Query Analyzer Eval Harness ──────────────────────────\n');

for (const golden of goldenQueries) {
  const result = analyzeQuery(golden.query);
  const failures = check(result, golden.expected);

  if (failures.length === 0) {
    console.log(`✅ PASS  [${golden.id}]`);
    totalPass++;
  } else {
    console.log(`❌ FAIL  [${golden.id}]  query: "${golden.query}"`);
    for (const f of failures) {
      console.log(`         ${f.key}: expected=${JSON.stringify(f.expected)}  actual=${JSON.stringify(f.actual)}`);
    }
    totalFail++;
  }
}

console.log(`\n── Results: ${totalPass} passed, ${totalFail} failed ──────────────────────\n`);

if (totalFail > 0) {
  process.exit(1);
}
