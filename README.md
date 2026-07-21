<div align="center">

```
                              ███████╗██╗   ██╗██████╗  ██████╗ ███╗   ██╗
                              ╚══███╔╝╚██╗ ██╔╝██╔══██╗██╔═══██╗████╗  ██║
                                ███╔╝  ╚████╔╝ ██████╔╝██║   ██║██╔██╗ ██║
                               ███╔╝    ╚██╔╝  ██╔══██╗██║   ██║██║╚██╗██║
                              ███████╗   ██║   ██║  ██║╚██████╔╝██║ ╚████║
                              ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
```

**A multi-agent AI assistant for Android — built on a swarm of specialist models<br>that analyze, execute, and synthesize in parallel.**

<!-- ── Row 1 · Identity & Status ─────────────────────────────────────────── -->
![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?style=for-the-badge&logo=android&logoColor=white&labelColor=1C1C1E)
![Framework](https://img.shields.io/badge/Framework-React%20Native%20%2F%20Expo-61DAFB?style=for-the-badge&logo=expo&logoColor=white&labelColor=1C1C1E)
![Version](https://img.shields.io/badge/Version-1.0.0-F97316?style=for-the-badge&logo=git&logoColor=white&labelColor=1C1C1E)
![License](https://img.shields.io/badge/License-MIT-A855F7?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=1C1C1E)
![Status](https://img.shields.io/badge/Status-Active%20Dev-22C55E?style=for-the-badge&logo=statuspage&logoColor=white&labelColor=1C1C1E)
![Min SDK](https://img.shields.io/badge/Min%20SDK-21-3B82F6?style=for-the-badge&logo=android&logoColor=white&labelColor=1C1C1E)
![Docker](https://img.shields.io/badge/Docker-Container-2496ED?style=for-the-badge&logo=docker&logoColor=white&labelColor=1C1C1E)

<!-- ── Divider ─────────────────────────────────────────────────────────────── -->
<br>

<!-- ── Row 2 · Built With ─────────────────────────────────────────────────── -->
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=FFD43B&labelColor=1C1C1E)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white&labelColor=1C1C1E)
![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-1C64F2?style=for-the-badge&logo=langchain&logoColor=white&labelColor=1C1C1E)
![LangChain](https://img.shields.io/badge/LangChain-Orchestration-16A34A?style=for-the-badge&logo=langchain&logoColor=white&labelColor=1C1C1E)
![SQLite](https://img.shields.io/badge/SQLite-On--Device-0F80CC?style=for-the-badge&logo=sqlite&logoColor=white&labelColor=1C1C1E)
![Railway](https://img.shields.io/badge/Railway-Backend-7B2FFF?style=for-the-badge&logo=railway&logoColor=white&labelColor=1C1C1E)
![KaTeX](https://img.shields.io/badge/KaTeX-LaTeX-E74C3C?style=for-the-badge&logo=latex&logoColor=white&labelColor=1C1C1E)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-10A37F?style=for-the-badge&logo=openai&logoColor=white&labelColor=1C1C1E)
![Anthropic](https://img.shields.io/badge/Anthropic-Claude-D97706?style=for-the-badge&logo=anthropic&logoColor=white&labelColor=1C1C1E)
![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white&labelColor=1C1C1E)
![Groq](https://img.shields.io/badge/Groq-Low--Latency-F55036?style=for-the-badge&logo=groq&logoColor=white&labelColor=1C1C1E)

</div>

---

## What is Zyron?

**Zyron is the first multi-agent coordination system built for Android** — a production-grade AI assistant that replaces a single chatbot with a **coordinated swarm of four specialist agents** running in parallel. Every query is routed to a team of domain experts — an analyst, an executor, a validator, and a synthesizer — whose outputs are fused into a single, high-quality response.

Unlike standard AI apps where one model does everything, Zyron assigns each agent a strict role and a constitutional directive. They compete, cross-examine each other's work, and only the synthesized result reaches the user.

> **One question. Four agents. Zero compromise.**

---
<div align="center">
  <img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/images/banner.png" alt="Zyron Banner" width="100%"/>
</div>

---

## Core Architecture

```
                     User Query
                         │
                         ▼
┌┬─────────────────────────────────────────────────┬┐
││             Query Analyzer                      ││
││ Classifies: type · complexity · coordination    ││
││ Routes to: team blend or active team pipeline   ││
└┴───────────────────────┬─────────────────────────┴┘
                         │
     ┌───────────────────┼─────────────────────┐
     │                   │                     │
     ▼                   ▼                     ▼
┌─────────┐         ┌─────────┐           ┌──────────┐
│ Agent 1 │         │ Agent 2 │           │ Agent 3  │
│         │         │         │           │          │
│(Analyst │         │(Executor│           │(Validator│
│  /ADR)  │         │  /Impl) │           │ /QA/Red) │
└────┬────┘         └────┬────┘           └────┬─────┘
     │                   │                     │
     └───────────────────┼─────────────────────┘
                         │
               ┌┬────────┴─────────┬┐
               ││Specialist outputs││
               └┴────────┬─────────┴┘
                         │
                   ┌─────┴──────┐
                   │  Agent 4   │
                   │   Writer   │
                   │(Synthesizer│
                   │  /Output)  │
                   └─────┬──────┘
                         │
                         ▼
                  Final Response
```

The pipeline runs three phases:
1. **Analysis** — `queryAnalyzer.js` classifies intent, detects coding/STEM/creative signals, and selects COMPACT vs. FULL coordination mode
2. **Specialist execution** — Agents 1–3 run in parallel with individual SSE streaming, circuit-breakers, and automatic fallback chains
3. **Synthesis** — Agent 4 (Writer) receives a structured brief from Agents 1–3 and produces the final fused response, filtered by a quality judge and semantic deduplication

---

## Agent Orchestration

Every query sent to Zyron passes through a multi-stage coordination pipeline. The orchestration layer is fully implemented in JavaScript and runs entirely on-device — no internet connection is required for the logic itself, only for the AI API calls.

### Phase 1 — Query Analysis (`queryAnalyzer.js`)

Before any agent is invoked, `analyzeQuery()` performs a zero-latency local classification of the incoming query. No API call is made — it is pure pattern matching and heuristics.

It produces a rich `analysis` object that every downstream component reads:

| Output flag | What it controls |
|---|---|
| `primaryType` | Dominant query category — `coding`, `stem`, `writing`, `analytical`, `financial`, `legal`, `creative`, `conversational`, `swarm_meta`, `general` |
| `complexity` | `low` / `medium` / `high` — drives how much context is injected into prompts |
| `responseLength` | `SHORT` / `MEDIUM` / `LONG` — guides the writer's output depth |
| `coordinationMode` | `FULL` (all 4 agents) · `COMPACT` (shorter prompts) · `NONE` (simple greetings, pass-through) |
| `needsWebSearch` | `true` if the query signals real-time data need — triggers the Tavily → Serper search before the pipeline |
| `agentFocus` | Per-role `{ emphasis, deliver }` — each agent gets a strictly scoped deliverable so outputs never overlap |
| `sharedBrief` | One-paragraph context block injected into every specialist system prompt |
| `verbosityLevel` | `detailed` when explicit depth is requested; `simple` otherwise |

**Agent focus is strictly partitioned.** For a coding query:
- **Reasoner** → architectural decisions, interface contracts, edge-case inventory — *zero code*
- **Coder** → complete runnable implementation with typed signatures — *zero architecture prose*
- **Vision** → adversarial audit, vulnerability catalog, Big-O analysis, threat model — *zero implementation*
- **Writer** → integrates all three into one authoritative final answer

This strict partitioning prevents redundant output and forces genuine multi-angle coverage regardless of query type.

---

### Phase 2 — Specialist Execution (parallel, `orchestrator.js`)

The three specialist agents (`reasoner`, `coder`, `vision`) are dispatched simultaneously using `Promise.allSettled`. Each agent:

1. Receives its own system prompt built by `buildSpecialistPrompt()` — containing its scoped `deliver` directive, the `sharedBrief`, web search results (if any), document context (if uploaded), and the user's query
2. Streams tokens through `streamManager.js` → real token chunks are forwarded to the UI via the `onStreamDelta(role, chunk)` callback as they arrive
3. Has an independent progress bar driven by actual chars received (`streamProgress(role, charCount, 6_000)`) — bars fill organically based on real output, not fake timers
4. Falls through the **fallback chain** (`fallbackChain.js`) if its primary provider fails — the next configured provider for that role is tried automatically without user intervention

**Empty-output guard:** After all three streams settle, any agent that produced fewer than 10 characters is retried with a blocking `callAgent()` call. Only if the retry also fails is the agent marked as failed in the UI. The writer still runs regardless — it uses whatever partial text each specialist produced.

**Large-prompt chunking:** When the query is long and at least one specialist is on a weak/small model, `promptChunker.js` splits the user message into per-role focused slices. Each specialist receives its own scoped chunk; the writer receives all specialist outputs and assembles the full answer.

---

### Phase 3 — Circuit Breakers (`circuitBreaker.js`)

Every provider call is wrapped in a session-scoped circuit breaker:

- A provider that fails **3 consecutive times** within a session has its breaker **opened** — all subsequent calls to that provider are skipped immediately without a network round-trip
- After **60 seconds**, the breaker enters half-open state — one retry is permitted
- On success, the failure counter resets to zero
- The breaker state is **in-memory only** — it resets on app restart

This prevents a single bad provider from causing repeated timeout delays across all agents in a session.

---

### Phase 4 — Synthesis (`synthesizer.js`, `qualityJudge.js`)

Once all specialists complete, Agent 4 (the Writer) runs:

1. `deduplicateOutputs()` is called on specialist outputs — currently a pass-through (no suppression), ensuring all specialist content reaches the writer unchanged
2. `trimOutput()` trims each specialist's text to remove leading/trailing noise
3. `buildQualityReport()` generates a quality brief — flags which specialists produced strong vs. weak output so the writer can weight them accordingly
4. `buildWriterPrompt()` assembles the final synthesis prompt: user query + analysis + persona instruction + user profile + all specialist outputs + quality report + search results + document context
5. The writer streams its response in real time. If the stream stalls or fails, a **blocking retry** is attempted before giving up. If the retry also fails, any partial streamed text is used; if there is none, `buildFallbackAnswer()` concatenates the specialist outputs directly as a last resort

---

### Abort propagation

Every phase checks `signal.aborted` (from the user's Stop button) at the start of each iteration. A mid-stream abort cancels the active fetch, exits the pipeline immediately, and clears all progress intervals — no partial state is left in the UI.

---

## Backend + Local Fallback Logic

Zyron uses a **dual-engine architecture** — a Railway-hosted Python FastAPI backend as the primary orchestrator, with a fully self-contained local JS engine as a silent fallback. The user never sees the switch happen. The entry point for all orchestration calls is `backendBridge.js`.

```
┌──────────────────────────────────────────────────────────────┐
│                      backendBridge.js                        │
│                                                              │
│  Every message → POST /orchestrate (no timeout, waits)       │
│                           │                                  │
│           ┌───────────────┴───────────────┐                  │
│           │                               │                  │
│      ✅ 200 OK                    ❌ Network error          │
│           │                        Non-200 response          │
│           │                               │                  │
│   Remap agents to active                  ▼                  │
│   team UI metadata            Local runAgentsOrchestrator()  │
│   Return fused response       Full pipeline — streaming,     │
│                               circuit-breakers, fallbacks,   │
│                               synthesis — runs on-device     │
└──────────────────────────────────────────────────────────────┘
```

### What the backend does

The backend is a Python FastAPI service deployed on Railway. It mirrors the local orchestration pipeline using LangGraph.

- **Endpoint:** `POST /orchestrate` — accepts `{ query, agentConfigs, team, persona, userProfile, searchResults, documentContext }`
- Runs three specialist agents in parallel via a LangGraph graph, then runs the writer synthesis node
- Returns `{ text, agents[], tokenUsage, meta }` JSON
- **Endpoint:** `POST /extract-document` — accepts a base64-encoded file (PDF, DOCX, TXT) and returns extracted plain text for prompt injection into the agent pipeline
- **Web search:** `web_search.py` runs a Tavily → Serper fallback search before the pipeline; up to 5 `key_facts` from results are injected into every specialist prompt. Returns `None` silently when both providers are unavailable

### Coordination panel during backend call

While the backend request is in-flight, the frontend drives its own coordination panel animation so the UI is never frozen:

1. **Queued state** — all 4 active-team agents appear immediately at 0 % progress
2. **Working state** — after one tick, all bars begin an exponential-approach animation: `progress = 5 + 73 × (1 − e^(−t/28000))`, capped at 78 %
3. **Complete** — on `200 OK`, all bars jump to 100 % and badges flip to "Done" simultaneously

Agent names, icons, and accent colors are always **remapped to the active team** after a backend response via `remapAgentsToActiveTeam()` — the backend drives the logic, the frontend owns the visual identity.

### Fallback guarantee

- The backend fetch has **no timeout** — it waits indefinitely for the server to respond. The only triggers for fallback are a network error or a non-200 response
- If the user presses **Stop** while waiting, the abort signal propagates to both the fetch call and the local engine — no partial state is left
- The local `runAgentsOrchestrator()` is feature-complete: it runs the full Phase 1–4 pipeline described above, including web search, circuit breakers, fallback chains, streaming, and synthesis
- A **dev toggle** (`setForceLocal(true)`) skips the backend entirely and routes directly to the local engine — used during development to test local orchestration without needing the Railway service

---

<div align="center">
  <table>
    <tr>
      <th align="center">Agent Coordination</th>
      <th align="center">Live Talk Mode of Zyron</th>
    </tr>
    <tr>
      <td align="center"><img src="https://github.com/NomanRafique01/Zyron/blob/main/assets/demo/demo.gif?raw=true" alt="Agent Coordination Demo" width="250"/></td>
      <td align="center"><img src="https://github.com/NomanRafique01/Zyron/blob/main/assets/demo/livetalk.demo.gif?raw=true" alt="Live Talk Mode Demo" width="250"/></td>
    </tr>
  </table>
</div>

---

## Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/screenshots/s1.png" width="100%" alt="Welcome Screen"/><br/><sub>Time-aware welcome screen with smart greeting</sub></td>
      <td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/screenshots/s2.png" width="100%" alt="Agent Coordination Panel"/><br/><sub>Live agent coordination panel — 4 specialists running in parallel</sub></td>
      <td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/screenshots/s3.png" width="100%" alt="Settings Panel"/><br/><sub>Settings control center — all configuration panels</sub></td>
    </tr>
    <tr>
      <td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/screenshots/s4.png" width="100%" alt="API Configuration"/><br/><sub>API Configuration Panel — per-agent socket and model setup</sub></td>
      <td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/screenshots/s5.png" width="100%" alt="Agents Workshop"/><br/><sub>Agents Workshop — build custom agents and assemble custom teams</sub></td>
      <td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/screenshots/s6.png" width="100%" alt="Live Talk Mode"/><br/><sub>Live Talk Mode — neural-net animation in speaking state</sub></td>
    </tr>
  </table>
</div>

---

## All 6 Teams — All 24 Agents

Every team has **4 agents** (Roles: Analyst · Executor · Validator · Synthesizer) with individual PNG icons, distinct accent colors, and specialist directives.


## Agent Library Panel

<div align="center">
  <table>
    <tr>
      <td><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/agnetpanel.screenshots/a1.png" width="100%" alt="Agent Panel 1"/></td>
      <td><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/agnetpanel.screenshots/a2.png" width="100%" alt="Agent Panel 2"/></td>
      <td><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/agnetpanel.screenshots/a3.png" width="100%" alt="Agent Panel 3"/></td>
    </tr>
    <tr>
      <td><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/agnetpanel.screenshots/a4.png" width="100%" alt="Agent Panel 4"/></td>
      <td><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/agnetpanel.screenshots/a5.png" width="100%" alt="Agent Panel 5"/></td>
      <td><img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/agnetpanel.screenshots/a6.png" width="100%" alt="Agent Panel 6"/></td>
    </tr>
  </table>
</div>


---

### <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M12 6C12 4.34 10.66 3 9 3C7.34 3 6 4.34 6 6C4.9 6 4 6.9 4 8C4 9.1 4.9 10 6 10C6 11.66 7.34 13 9 13H12" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6C12 4.34 13.34 3 15 3C16.66 3 18 4.34 18 6C19.1 6 20 6.9 20 8C20 9.1 19.1 10 18 10C18 11.66 16.66 13 15 13H12" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 13V20M9 17h6" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Mega Minds *(Default Team)*
> *Deep, clear answers to complex questions*

Thoughtful knowledge and research team for concepts, analysis, and learning.

<table>
<tr>
<th align="center">Agent 1 — Scholar</th>
<th align="center">Agent 2 — Analyst</th>
<th align="center">Agent 3 — Synthesizer</th>
<th align="center">Agent 4 — Editor</th>
</tr>
<tr>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/mega-minds/scholar.png" width="64" height="64"/><br><b>Scholar</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/mega-minds/analyst.png" width="64" height="64"/><br><b>Analyst</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/mega-minds/synthesizer.png" width="64" height="64"/><br><b>Synthesizer</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/mega-minds/editor.png" width="64" height="64"/><br><b>Editor</b></td>
</tr>
<tr>
<td>First-principles derivation, honest confidence levels (established vs. debated), counterarguments, hidden assumptions</td>
<td>Evidence strength, causal mechanism chains (A→B→C), comparative analysis, trade-off matrices</td>
<td>Bridging analogies, confusion-point bridges, mental models, core insight crystallized in one sentence</td>
<td>Builds definition → mechanism → nuance → analogy → insight; closes with perspective shift</td>
</tr>
</table>

---

### <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M8 7L3 12L8 17" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 7L21 12L16 17" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 4L10 20" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round"/></svg> Coders
> *Clear, complete software construction*

Practical coding team for features, refactors, algorithms, and debugging.

<table>
<tr>
<th align="center">Agent 1 — Designer</th>
<th align="center">Agent 2 — Programmer</th>
<th align="center">Agent 3 — Debugger</th>
<th align="center">Agent 4 — Executor</th>
</tr>
<tr>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/coders/designer.png" width="64" height="64"/><br><b>Designer</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/coders/programmer.png" width="64" height="64"/><br><b>Programmer</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/coders/debugger.png" width="64" height="64"/><br><b>Debugger</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/coders/executor.png" width="64" height="64"/><br><b>Executor</b></td>
</tr>
<tr>
<td>System structure, design decisions with plain-English rationale, API surface definitions, data flow</td>
<td>Complete working code — no placeholders, no TODOs, typed, error-handled, production-ready</td>
<td>Spots bugs, null dereferences, edge cases, security issues, performance traps — gives concrete fixes</td>
<td>Developer reference: Design → Code → Known Issues → Usage examples</td>
</tr>
</table>

---

### <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M9 21h6M10 17.5C10 17.5 7 14.5 7 10C7 7.24 9.24 5 12 5C14.76 5 17 7.24 17 10C17 14.5 14 17.5 14 17.5H10Z" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 17.5h4M10.5 20h3" stroke="#7B2FFF" stroke-width="1.6" stroke-linecap="round"/><path d="M12 2V3.5M5.5 4.5L6.5 5.5M18.5 4.5L17.5 5.5" stroke="#7B2FFF" stroke-width="1.6" stroke-linecap="round"/></svg> Creative Thinkers
> *Creative strategy and original writing*

Creative team that thinks before it writes — strategy, drafting, editing, delivery.

<table>
<tr>
<th align="center">Agent 1 — Strategist</th>
<th align="center">Agent 2 — Creator</th>
<th align="center">Agent 3 — Curator</th>
<th align="center">Agent 4 — Narrator</th>
</tr>
<tr>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/creative/strategist.png" width="64" height="64"/><br><b>Strategist</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/creative/creator.png" width="64" height="64"/><br><b>Creator</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/creative/curator.png" width="64" height="64"/><br><b>Curator</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/creative/narrator.png" width="64" height="64"/><br><b>Narrator</b></td>
</tr>
<tr>
<td>Audience definition, creative angle, tone direction, traps to avoid, 2–3 genuinely different creative directions</td>
<td>Multiple opening options, a full complete draft, and a bold alternative version — real writing, no placeholders</td>
<td>Weakest lines diagnosed and rewritten, word choices sharpened, emotional arc mapped, what to cut</td>
<td>Final polished piece — best opening chosen, all editorial notes applied, crafted and intentional</td>
</tr>
</table>

---

### <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><rect x="9" y="2" width="5" height="3" rx="1" stroke="#7B2FFF" stroke-width="1.7"/><path d="M11.5 5v5" stroke="#7B2FFF" stroke-width="1.7" stroke-linecap="round"/><rect x="8" y="10" width="7" height="4" rx="1.5" stroke="#7B2FFF" stroke-width="1.7"/><path d="M11.5 14v2" stroke="#7B2FFF" stroke-width="1.7" stroke-linecap="round"/><path d="M7 16h9" stroke="#7B2FFF" stroke-width="1.7" stroke-linecap="round"/><path d="M6 19h12" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round"/><path d="M7 19v-1a1 1 0 011-1h8a1 1 0 011 1v1" stroke="#7B2FFF" stroke-width="1.5" stroke-linecap="round"/></svg> Scientists
> *Clear scientific explanations and calculations*

Practical STEM team for physics, chemistry, mathematics, statistics, and engineering.

<table>
<tr>
<th align="center">Agent 1 — Theorist</th>
<th align="center">Agent 2 — Experimenter</th>
<th align="center">Agent 3 — Modeler</th>
<th align="center">Agent 4 — Reporter</th>
</tr>
<tr>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/scientists/theorist.png" width="64" height="64"/><br><b>Theorist</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/scientists/experimenter.png" width="64" height="64"/><br><b>Experimenter</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/scientists/modeler.png" width="64" height="64"/><br><b>Modeler</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/scientists/reporter.png" width="64" height="64"/><br><b>Reporter</b></td>
</tr>
<tr>
<td>Key equations with every symbol defined, step-by-step derivation in LaTeX, validity limits</td>
<td>Step-by-step calculation with units tracked, intermediate checkpoints, boxed final answer</td>
<td>Physical mechanism in plain language, everyday analogies with limits stated, real-world scale anchors</td>
<td>Lab-report structure: Theory → Calculation → Intuition → Result; all LaTeX preserved verbatim</td>
</tr>
</table>

---

### <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M6 4C6 4 4 4 4 6C4 8 6 8 6 8H18C18 8 20 8 20 10V18C20 20 18 20 18 20H6C6 20 4 20 4 18V6" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 20C6 20 4 20 4 18C4 16 6 16 6 16" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12h6M9 15h4" stroke="#7B2FFF" stroke-width="1.6" stroke-linecap="round"/></svg> Historians
> *Clear, engaging historical answers*

Knowledgeable history team for events, eras, biographies, and geopolitical context.

<table width="100%" style="table-layout:fixed">
<colgroup>
<col width="25%"/>
<col width="25%"/>
<col width="25%"/>
<col width="25%"/>
</colgroup>
<tr>
<th align="center" width="25%">Agent 1 — Archivist</th>
<th align="center" width="25%">Agent 2 — Contextualist</th>
<th align="center" width="25%">Agent 3 — Cartographer</th>
<th align="center" width="25%">Agent 4 — Biographer</th>
</tr>
<tr>
<td align="center" width="25%"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/historians/archivist.png" width="64" height="64"/><br><b>Archivist</b></td>
<td align="center" width="25%"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/historians/contextualist.png" width="64" height="64"/><br><b>Contextualist</b></td>
<td align="center" width="25%"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/historians/cartographer.png" width="64" height="64"/><br><b>Cartographer</b></td>
<td align="center" width="25%"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/historians/biographer.png" width="64" height="64"/><br><b>Biographer</b></td>
</tr>
<tr>
<td width="25%">Verified chronologies, key actors and roles, <code>ESTABLISHED</code> / <code>PROBABLE</code> / <code>CONTESTED</code> / <code>UNKNOWN</code> epistemic status, source gaps</td>
<td width="25%">Trigger → intermediate → root cause chain, agency vs. structure, counterfactual reasoning</td>
<td width="25%">Timeline tables, comparison grids, geographic and demographic context, narrative structure blueprint</td>
<td width="25%">Authoritative scholarly narrative — honest about uncertainty, contextual judgment, no anachronism</td>
</tr>
</table>

---

### <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M4 20V4M4 20H20" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round"/><path d="M6 16L10 11L14 13L19 7" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 7H19V10.5" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Financers
> *Expert financial insight across every domain*

Master finance team for personal, corporate, and business finance.

<table>
<tr>
<th align="center">Agent 1 — Accountant</th>
<th align="center">Agent 2 — Adviser</th>
<th align="center">Agent 3 — Auditor</th>
<th align="center">Agent 4 — Investor</th>
</tr>
<tr>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/financers/accountant.png" width="64" height="64"/><br><b>Accountant</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/financers/adviser.png" width="64" height="64"/><br><b>Adviser</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/financers/auditor.png" width="64" height="64"/><br><b>Auditor</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/NomanRafique01/zyron/main/assets/agent-icons/financers/investor.png" width="64" height="64"/><br><b>Investor</b></td>
</tr>
<tr>
<td>Breaks down numbers, identifies patterns & trends, evaluates financial risk with data-driven reasoning</td>
<td>Strategic financial advice, investment guidance, tailored action plans, opportunity identification</td>
<td>Reviews for errors, compliance issues, red flags, control weaknesses, and inconsistencies</td>
<td>Structured financial report: Analysis → Advice → Audit Findings → Final Recommendation</td>
</tr>
</table>

---

## Feature Overview

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><circle cx="5.5" cy="5" r="1.5" stroke="#7B2FFF" stroke-width="1.4"/><circle cx="18.5" cy="5" r="1.5" stroke="#7B2FFF" stroke-width="1.4"/><circle cx="12" cy="12" r="2.2" stroke="#7B2FFF" stroke-width="1.6"/><path d="M10.2 10.2L7 7" stroke="#7B2FFF" stroke-width="1.2" stroke-linecap="round"/><path d="M13.8 10.2L17 7" stroke="#7B2FFF" stroke-width="1.2" stroke-linecap="round"/><circle cx="5.5" cy="19" r="1.5" stroke="#7B2FFF" stroke-width="1.4"/><circle cx="18.5" cy="19" r="1.5" stroke="#7B2FFF" stroke-width="1.4"/><path d="M10.2 13.8L7 17" stroke="#7B2FFF" stroke-width="1.2" stroke-linecap="round"/><path d="M13.8 13.8L17 17" stroke="#7B2FFF" stroke-width="1.2" stroke-linecap="round"/></svg> Multi-Agent Swarm Engine
- **Parallel execution** — Agents 1–3 fire simultaneously, not sequentially
- **Team Blending** — cross-team specialist borrowing per query without changing the active session team (e.g. pull Mega Minds' Scholar into a Coders session)
- **Coordination modes** — `NONE` (direct), `COMPACT` (brief sharing), `FULL` (structured specialist briefs with shared context)
- **Model tier routing** — cheap vs. expensive model selection based on query complexity
- **Team switching suggestions** — the router detects when a different team would produce better results

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><rect x="9" y="2" width="6" height="11" rx="3" stroke="#7B2FFF" stroke-width="1.8"/><path d="M5 10a7 7 0 0014 0" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round"/><path d="M12 21v-4" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round"/><path d="M9 21h6" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round"/></svg> Live Talk Mode *(New)*
Zyron can be talked to directly — no typing required. Live Talk opens a full-screen voice conversation interface powered by a neural-network node-web animation that pulses in sync with microphone activity.

**Pipeline:**
```
Mic Input (STT)  →  Transcript  →  LLM Call (Agent 1 config)  →  TTS Output
     ↑                                                                │
     └──────── Interrupt detection (new voice kills TTS) ────────────┘
```

- **Speech-to-text** via `expo-speech-recognition` — real-time partial results, silence detection
- **Continuous mic** — hardware never closes between turns (no click sound); a 1.5 s silence timer triggers the LLM call
- **Text-to-speech** via `expo-speech` — response is spoken sentence-by-sentence as tokens arrive, minimising latency
- **Interrupt** — if the user speaks while Zyron is talking, TTS stops immediately and the new input is processed
- **Auto-close** — if no speech is detected for 20 s after Zyron finishes speaking, the session closes silently
- **All providers supported** — uses Agent 1's configured key/model (OpenAI, Anthropic, Gemini, Groq, Mistral, DeepSeek, GLM, OpenRouter)
- **Conversation saved** — each turn is written to the active chat session in the background
- **Visual phases:** `idle` → `listening` → `thinking` → `speaking` → back to `listening`

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><rect x="9" y="2" width="6" height="11" rx="3" stroke="#7B2FFF" stroke-width="1.8"/><path d="M5 10a7 7 0 0014 0" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round"/><path d="M12 17v4" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round"/></svg> Mic / Voice Input *(New)*
The input bar now includes a **microphone button** alongside the text field. Tap it to dictate your message instead of typing — the transcript populates the input bar, and you can edit it before sending.

- Lazy-loads `expo-speech-recognition` with a try/catch guard — gracefully disabled in Expo Go or stripped builds where the native module is not linked
- Requests `RECORD_AUDIO` permission on first use
- Live partial results update the input field in real time as you speak
- Tap the mic button again (or tap Stop) to end dictation early

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><circle cx="11" cy="11" r="7" stroke="#7B2FFF" stroke-width="1.8"/><path d="M16.5 16.5L21 21" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round"/><path d="M8 11h6M11 8v6" stroke="#7B2FFF" stroke-width="1.6" stroke-linecap="round"/></svg> Web Search *(New)*
Zyron enriches every query with live web results before the agent pipeline runs — no manual "search mode" toggle required.

**Pipeline:**
```
User query
     │
     ▼
Web Search (Tavily → Serper fallback, 3 s timeout)
     │  key_facts[] + sources[]
     ▼
Injected into all specialist agent prompts
     │
     ▼
LangGraph multi-agent pipeline runs with grounded context
```

- **Dual-provider fallback** — Tavily is the primary search provider; if it fails or is unconfigured, Serper is tried automatically
- **Silent degradation** — if both providers return nothing, agents proceed using their own knowledge without any error shown
- **Grounded facts** — up to 5 distilled `key_facts` extracted from raw search content (Tavily's auto-answer is intentionally ignored for accuracy) are injected into every specialist prompt
- **Source attribution** — `title`, `url`, and `snippet` for each result are available alongside the facts
- **Session-level caching** — duplicate queries within the same session reuse the cached result; cache is cleared on new chat
- **3-second hard timeout** per provider — web search never blocks the pipeline for more than ~6 s total
- **Both engines supported** — runs on the Railway backend (`web_search.py`) and on the local JS fallback engine (`src/agents/search/`)

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M12 3l7 3v5c0 4.6-2.9 8.5-7 10-4.1-1.5-7-5.4-7-10V6l7-3z" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12l2 2 4-5" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Resilient API Layer
- **Circuit breaker** — per-provider failure tracking; tripped circuits skip that socket for the current session
- **Fallback chains** — automatic failover to the next provider on timeout or error
- **Sanitized error messages** — no raw API keys or stack traces ever surface in the UI

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="#7B2FFF" stroke-width="1.8" stroke-linejoin="round"/></svg> Agents Workshop *(New)*
Create fully custom agent personas and custom teams — no coding required.

**Custom Agents (free):**
- Give the agent a name, description, and pick an icon from the 24-icon library (all built-in agent portraits available)
- Configure personality traits (Critical Thinker, Systems Architect, Researcher, Innovator, Strategist, Mentor)
- Set tone (Professional, Technical, Friendly, Formal, Direct, Creative) and communication style (Concise, Detailed, Structured, Educational, Executive)
- Tune five strength sliders: Reasoning, Creativity, Analytical, Coding, Teaching (0–100)
- `metadataGenerator.js` auto-generates `contributionLens` and `specialistDirective` from the form
- Agents are stored in `AsyncStorage` and available immediately across all sessions
- Edit, duplicate, or delete any saved custom agent

**Custom Teams (premium):**
- Fill all four role slots (Agent 1–4) with agents from the custom agent library
- Choose a team name, tagline, description, and one of 8 SVG team icons (Shield, Network, Atom, Lightning, Compass, DNA, Brain, Rocket)
- Saved teams are merged with built-in teams at runtime via `customTeamRegistry.js` — they behave identically to built-in teams: full orchestration, streaming, synthesis, and team routing work with no changes

**Registry merge logic (`customTeamRegistry.js`):**
```
getAllTeams() → [...BUILTIN_TEAMS, ...customTeams]
```
Custom teams are bootstrapped async at app start then cached. All existing consumers (Agent Library, team router, runtime) call `getAllTeams()` with no conditional logic.

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><rect x="2" y="6" width="20" height="12" rx="2" stroke="#7B2FFF" stroke-width="1.8"/><path d="M6 10h.01M6 14h.01" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round"/><path d="M10 10h8M10 14h6" stroke="#7B2FFF" stroke-width="1.6" stroke-linecap="round"/></svg> On-Device Memory
- **SQLite persistence** — full conversation history with session index and message pagination
- **User memory** — contextual facts extracted from conversations and injected into future prompts

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M12 3l7 3v5c0 4.6-2.9 8.5-7 10-4.1-1.5-7-5.4-7-10V6l7-3z" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Security
- **Android Keystore-backed storage** — API keys stored in `EncryptedSharedPreferences` via `expo-secure-store`; never in `AsyncStorage` or any JS bundle string
- **Single read gateway** — `keyGuard.js` is the only permitted key-read path; keys are read at call-time and never stored in module-level variables
- **Optional API Config Lock** — a password gate that locks all API settings behind biometric or PIN authentication
- **No telemetry** — all telemetry is session-local, never transmitted

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M12 20h9" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Synthesis Intelligence
- **Quality judge** — LLM + heuristic scorer evaluates output against domain-specific required/prohibited criteria (coding, STEM, analytical, writing, creative, general)
- **Semantic deduplication** — removes redundant content across agent outputs before synthesis
- **Agent personas** — five Writer synthesis modes: Balanced, Creative, Precise, Educator, Executive

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M8 7L3 12L8 17" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 7L21 12L16 17" stroke="#7B2FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 4L10 20" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round"/></svg> Math & Code Rendering
- **LaTeX rendering** — `KaTeX` via `WebView` for inline and display math formulas
- **Syntax-highlighted code blocks** — dedicated `SyntaxCode` component with language detection and copy-to-clipboard
- **Chemical formula detection** — `mathParser.utils.js` handles inline chemical notation alongside LaTeX

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Conversation Management
- **Timeline grouping** — conversations bucketed into Today / Yesterday / Older
- **Session sidebar** — slide-out drawer with conversation history, search, and new-chat creation
- **Smart welcome greeting** — time-aware greeting (Night Owl / Early Bird / Golden Hour / etc.) with the user's first name

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 13h6M9 17h4" stroke="#7B2FFF" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="10" r="1.2" fill="#7B2FFF"/></svg> Document Processing & Image Analysis *(New)*
Zyron can read and reason over documents and images — attach a file or image alongside your query and the agent swarm will analyze the content directly.

**Document Processing:**
- **PDF parsing** — extract and analyze text content from PDF documents; the full extracted text is passed as context to the active agent team
- **Plain-text files** — `.txt`, `.md`, `.csv`, `.json`, `.xml` and other text-based formats are read directly into the prompt context
- **Code files** — source files (`.js`, `.py`, `.ts`, `.jsx`, `.tsx`, etc.) are passed to the Coders team with syntax-aware handling
- **Chunked context** — large documents are chunked intelligently to fit within model context windows; key excerpts are surface-ranked before injection
- **Multi-document sessions** — attach multiple documents in a single session; the agent team cross-references them in synthesis

**Image Analysis:**
- **Multimodal vision input** — images are passed directly to vision-capable models (GPT-4o, Gemini 2.5 Flash, Claude 3.5 Sonnet) for analysis
- **Supported formats** — PNG, JPG, JPEG, WEBP, GIF (static)
- **Use cases** — diagram explanation, chart reading, screenshot debugging, handwritten note transcription, UI/UX critique, scientific image interpretation
- **Auto provider routing** — if the active agent's configured model does not support vision, Zyron automatically routes the image query to the best available vision-capable provider without user action
- **Image + text combined** — mix a written query with an attached image; the agents analyze both together and synthesize a unified response

**Supported pipeline:**
```
User attaches file / image
         │
         ▼
  fileProcessor.js   ──── PDF → text extraction (pdf-parse)
  imageHandler.js    ──── Image → base64 encode → multimodal payload
         │
         ▼
  Injected into agent prompt context (alongside user query)
         │
         ▼
  Agent swarm runs normally — all streaming, circuit-breakers,
  synthesis, and quality judge apply as usual
```

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><circle cx="12" cy="12" r="3" stroke="#7B2FFF" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#7B2FFF" stroke-width="1.8"/></svg> Settings & Personalization
- **Profile panel** — display name, role, preferred tone, language, coding style, detail level
- **Agent Library** — accordion panel showing all six teams with per-team agent roster and expand-to-inspect detail
- **Agents Workshop** — custom agent and custom team builder (described above)
- **API Config panel** — per-provider key entry, model selection, key status verification, share-key-across-agents toggle
- **Privacy panel** — privacy mode, profile context injection toggle
- **Reset panel** — wipe conversation history, clear API keys, full factory reset

---

## Technologies Used

A full-stack overview of every layer Zyron is built on — from the on-device UI to the cloud orchestration backend.

### Backend — Python / FastAPI / LangGraph

| Technology | Version | Integration |
|---|---|---|
| **Python** | 3.13 | Backend runtime on Railway |
| **FastAPI** | 0.115.12 | REST API server — `/health` + `/orchestrate` endpoints |
| **LangGraph** | 1.2.9 | Multi-agent pipeline graph — three parallel specialist nodes + writer synthesis node |
| **LangChain** | 1.3.14 | LLM abstraction layer used inside LangGraph nodes for prompt building and provider calls |
| **Pydantic** | 2.11.4 | Request / response model validation (`models.py`) |
| **Uvicorn** | 0.34.3 | ASGI server for FastAPI |
| **Docker** | — | Containerised backend — consistent builds and local dev environment |
| **Railway** | — | Cloud deployment platform — auto-deploy from `main` branch |

### Frontend — React Native / Expo

| Technology | Version | Integration |
|---|---|---|
| **React Native** | 0.81.5 | Core UI framework — all screens, navigation, animations |
| **React** | 19.1.0 | UI component runtime |
| **Expo SDK** | 54.0.36 | Build toolchain, native module access, OTA updates |
| **expo-secure-store** | 15.0.8 | Android Keystore-backed encrypted API key storage |
| **expo-sqlite** | 16.0.10 | On-device SQLite database for conversation + memory persistence |
| **expo-speech** | 14.0.8 | Text-to-speech output for Live Talk voice responses |
| **expo-speech-recognition** | 3.1.3 | Real-time STT — mic dictation and Live Talk input |
| **expo-local-authentication** | 17.0.8 | Biometric / PIN gate for API Config Lock |
| **expo-blur** | 15.0.8 | Settings modal blur backgrounds |
| **expo-linear-gradient** | 15.0.8 | Agent glow accent effects |
| **expo-clipboard** | 8.0.8 | Copy-to-clipboard on code blocks |
| **expo-web-browser** | 15.0.11 | GitHub OAuth redirect handler |
| **expo-document-picker** | 14.0.8 | File attachment for document analysis |
| **expo-image-picker** | 17.0.11 | Image attachment for vision analysis |
| **react-native-webview** | 13.15.0 | KaTeX LaTeX rendering sandbox |
| **react-native-svg** | 15.12.1 | SVG team icons, decorative elements, Live Talk neural animation |
| **react-native-keyboard-controller** | 1.22.1 | Cross-platform keyboard layout tracking |
| **react-native-safe-area-context** | 5.6.0 | Edge-to-edge safe area insets |
| **@react-native-async-storage/async-storage** | 2.2.0 | User profile, team selection, custom agents + teams |
| **@react-native-community/netinfo** | 11.4.1 | Offline detection |
| **TypeScript** | 5.9.2 | Static typing across the entire frontend codebase |

### AI Providers

| Provider | Models Used | Role |
|---|---|---|
| **OpenRouter** | `nvidia/nemotron-3-super-120b-a12b:free` + 100+ | Default free-tier agent socket |
| **OpenAI** | `gpt-4o-mini`, `gpt-4o`, o-series | General reasoning and synthesis |
| **Anthropic** | `claude-3-5-haiku-latest`, `claude-3-5-sonnet` | High-quality analysis and writing |
| **Google Gemini** | `gemini-2.5-flash`, `gemini-pro` | STEM, multimodal |
| **Groq** | `llama-3.3-70b-versatile` | Ultra-low-latency inference for Live Talk |
| **Mistral** | `mistral-small-latest` | Writer / synthesis agent default |
| **DeepSeek** | `deepseek-chat`, `deepseek-reasoner` | Extended chain-of-thought reasoning |
| **GLM / Zhipu** | `glm-4-flash`, `glm-4-air` | Low-cost high-speed inference |

### Data & Storage

| Technology | Integration |
|---|---|
| **SQLite** (`expo-sqlite`) | Full conversation history, session index, user memory facts — all stored on-device |
| **AsyncStorage** | Non-sensitive user preferences — active team, profile settings, custom agents, custom teams |
| **Android Keystore** (`EncryptedSharedPreferences`) | All API keys — hardware-backed encryption, never stored in JS bundle or AsyncStorage |

### Rendering & Math

| Technology | Integration |
|---|---|
| **KaTeX 0.17** | LaTeX formula typesetting — inline (`$...$`) and display (`$$...$$`) math rendered in a sandboxed WebView |
| **react-native-webview** | WebView host for KaTeX rendering |
| **mathParser.utils.js** | Custom parser that detects and splits LaTeX and chemical formulae out of raw LLM text before rendering |
| **SyntaxCode component** | Syntax-highlighted code blocks with language auto-detection and copy-to-clipboard |

---

## Supported AI Providers

Zyron connects to **eight AI providers**. Each agent socket is independently configurable.

| Provider | Default Model | Notes |
|----------|--------------|-------|
| **OpenRouter** | `nvidia/nemotron-3-super-120b-a12b:free` | Free-tier NVIDIA, Cohere, and 100+ models |
| **OpenAI** | `gpt-4o-mini` | GPT-4o, o-series reasoning models |
| **Anthropic** | `claude-3-5-haiku-latest` | Claude 3.5 Sonnet/Haiku |
| **Mistral** | `mistral-small-latest` | Writer agent default |
| **Google Gemini** | `gemini-2.5-flash` | Flash and Pro variants |
| **DeepSeek** | `deepseek-chat` | `deepseek-reasoner` for extended CoT |
| **Groq** | `llama-3.3-70b-versatile` | Ultra-low-latency inference |
| **GLM / Zhipu** | `glm-4-flash` | GLM-4 Flash, Air, Plus |

All providers support free model tiers where available. Keys are stored per-agent and can be shared across agents via the share-key setting.

---

## Project Structure

```
Zyron/
├── App.js                       React root — SplashScreen + MainApp
├── index.js                     Expo entry point + global error handler
├── app.config.js                Active Expo config (merges .env secrets)
├── eas.json                     EAS Build profiles
│
├── assets/
│   ├── agent-icons/             24 agent portrait PNGs (6 teams × 4 agents)
│   │   ├── financers/           accountant · adviser · auditor · investor
│   │   ├── coders/              designer · programmer · debugger · executor
│   │   ├── scientists/          theorist · experimenter · modeler · reporter
│   │   ├── mega-minds/          scholar · analyst · synthesizer · editor
│   │   ├── historians/          archivist · contextualist · cartographer · biographer
│   │   └── creative/            strategist · creator · curator · narrator
│   ├── icons/                   Favicon + web icons
│   ├── images/                  In-app logo assets
│   └── splash/                  Android adaptive icon + splash screen
│
├── backend/                     ◀ Python FastAPI backend (Railway)
│   ├── main.py                  FastAPI app — /health + /orchestrate + /extract-document endpoints
│   ├── models.py                Pydantic request/response models
│   ├── orchestrator.py          Backwards-compat shim → re-exports from orchestrator/ package
│   ├── orchestrator/            LangGraph pipeline package (_state, _utils, _nodes, _graph, _pipeline)
│   ├── web_search.py            Web search — Tavily → Serper fallback; injects key_facts into agent prompts
│   ├── document_extractor.py    Base64 file → plain text (PDF via pdfminer.six, DOCX via python-docx, TXT)
│   ├── query_analyzer.py        Query classification
│   ├── prompt_builder.py        Backwards-compat shim → prompt_builder/ package
│   ├── prompt_builder/          Prompt construction package (_specialist, _writer, _templates, _style, _user_profile)
│   ├── providers.py             Provider HTTP clients
│   └── requirements.txt
│
├── plugins/
│   └── withAndroidWindowBackground.js  Prevents white flash on cold launch
│
└── src/
    ├── agents/                  ◀ Core AI swarm engine
    │   ├── backendBridge.js         Primary entry point — backend first, local fallback
    │   ├── orchestrator.js          Local pipeline runner (fallback engine)
    │   ├── analysis/                Query classifier
    │   ├── api/                     Provider HTTP clients + circuit-breaker + fallback
    │   ├── memory/                  SQLite on-device memory store
    │   ├── offline/                 On-device offline inference fallback
    │   ├── progress/                Per-agent progress state tracker
    │   ├── prompts/                 Prompt builder + domain templates
    │   ├── registry/                Agent registry + team metadata + persona instructions
    │   ├── router/                  Team router + model tier selector
    │   ├── search/                  Web search — Tavily → Serper fallback (webSearch.js, searchProviders.js, searchResultFormatter.js)
    │   ├── security/                keyGuard — single key-read gateway
    │   ├── streaming/               SSE stream manager
    │   ├── synthesis/               Synthesizer + quality judge + semantic dedup
    │   ├── teams/                   6 built-in team definitions + teamRuntime + teamBlend
    │   ├── telemetry/               Session-local latency/token/error metrics
    │   ├── tools/                   Tool registry + sandboxed JS code executor
    │   └── workshop/                Custom agent/team storage + registry + metadata generator
    │
    ├── components/
    │   ├── agent/               AgentPanel, AgentBadge, AgentCoordinationTab, AgentIcon
    │   ├── chat/                ChatBubble, ChatMessageList, SyntaxCode, MarkdownText
    │   ├── input/               InputBar — mic button, Live Talk button, agent-strip dots
    │   ├── layout/              Header (glow/offline), SidebarDrawer
    │   ├── math/                MathFormula (KaTeX via WebView)
    │   ├── modals/              NeuralNetLiveTalk, ConfirmDialog, SetupGuideModal
    │   ├── shared/              Icons (SVG), PasswordField, WelcomeLogo
    │   └── workshop/            AgentBuilderPanel, TeamBuilderPanel, CustomAgentsLibrary
    │
    ├── config/
    │   ├── appConfig.js             Agent defaults, provider models, user profile schema
    │   ├── colors.config.js         Design token palette (agent accent colors, glows)
    │   ├── apiLock.config.js        SecureStore key constants for API lock
    │   ├── agentPersona.config.js   Writer synthesis persona options
    │   └── agentIconOptions.js      Centralised 24-icon asset catalogue (for custom agents)
    │
    ├── database/
    │   └── db.init.js               SQLite schema + all message CRUD operations
    │
    ├── hooks/
    │   ├── useAgentExecution.hook.js    Send/stop/regenerate, agent state updates
    │   ├── useAgentSockets.hook.js      Key load/save/verify, team selection, engine toggle
    │   ├── useConversations.hook.js     Session index, message pagination, new/delete chat
    │   ├── useLiveTalk.hook.js          Live Talk pipeline — STT → LLM → TTS + interrupt
    │   ├── useSettings.hook.js          Settings modal, password manager, API lock, profile
    │   └── useToast.hook.js             In-app toast: show/dismiss, swipe-to-dismiss
    │
    ├── screens/
    │   ├── chat/MainApp.screen.jsx      Composition root — wires all hooks and components
    │   ├── splash/SplashScreen.screen.jsx  Animated custom splash
    │   └── settings/
    │       ├── SettingsModal.screen.jsx
    │       ├── panels/                  Profile, AgentLibrary, AgentsWorkshop, ApiConfig, Privacy, About, Reset
    │       ├── auth/                    ApiLockGate, PasswordManager, RemoveLockBanner
    │       └── rows/                    AgentSocketRow
    │
    ├── styles/
    │   ├── app.styles.js            Master stylesheet
    │   └── *.styles.js              Layout, feedback, welcome, sidebar, settings, profile, socket, auth
    │
    └── utils/
        ├── agentLogic.utils.js          Backward-compatible facade for agents public API
        ├── mathParser.utils.js          LaTeX / chemical formula detection and splitting
        ├── responseGenerator.utils.js   Legacy direct API caller
        └── responsive.utils.js          Dimension-based scale/spacing/fontScale helpers
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`) for builds
- At least one API key from any [supported provider](#supported-ai-providers)

### Installation

```bash
git clone https://github.com/NomanRafique01/zyron.git
cd zyron
npm install
```

### Running in Development

```bash
# Start Metro bundler
npx expo start

# Run on connected Android device / emulator
npx expo run:android
```

### Building a Release APK

```bash
# Preview APK (internal distribution)
eas build --profile preview --platform android

# Production APK
eas build --profile production-apk --platform android

# Production AAB (Play Store)
eas build --profile production --platform android
```

---

## Download

| Version | Status | Download |
|---------|--------|----------|
| v1.0.0 | ✅ Stable (Recommended) | [Download APK](https://github.com/NomanRafique01/Zyron/releases/download/v1.0.0/zyron.apk) |
| v0.9.0-beta | 🧪 Beta (Legacy) | [Download APK](https://github.com/NomanRafique01/Zyron/releases/download/beta/Zyron.apk) |

> **Minimum requirement:** Android 5.0 (SDK 21) or higher.
>
> For full release notes and version history, visit the [Releases page](https://github.com/NomanRafique01/Zyron/releases).

---

## Configuration

API keys are entered directly in the app's **Settings → API Config** panel after launch. Keys are stored in Android Keystore-backed encrypted storage — never in source code or config files.

For `.env`-based secrets (used at build time only via `app.config.js`):

```bash
cp .env.example .env   # if provided
# or create manually — see app.config.js for expected variables
```

> ⚠️ **Security note:** This is a client-only app. See [`SECURITY.md`](SECURITY.md) for key storage architecture, spend-cap guidance for every provider, and the recommended Cloudflare Worker proxy for production deployments.

---

## Agent Personas

The **Writer agent** (Agent 4) supports five synthesis personas, selectable in Settings:

| Persona | Behavior |
|---------|----------|
| **Balanced** | Professional synthesis of all specialist outputs |
| **Creative** | Unconventional angles, vivid language, memorable framing |
| **Precise** | Strict correctness, concrete numbers, numbered steps, zero filler |
| **Educator** | Progressive concept building, analogies, Key Takeaway at close |
| **Executive** | Lead with conclusion, max 3 paragraphs, one-line Action/Decision |

---

## Android Permissions

| Permission | Purpose |
|-----------|---------|
| `INTERNET` | API calls to all AI providers |
| `VIBRATE` | Haptic feedback on send / toast |
| `RECORD_AUDIO` | Mic input dictation + Live Talk STT |
| `USE_BIOMETRIC` | Biometric gate for API Config Lock |
| `USE_FINGERPRINT` | Fingerprint unlock for API Config Lock |

Minimum SDK: **21 (Android 5.0)**
Target SDK: **34 (Android 14)**

---

## AI Tools Used as Assistant in Developing Zyron

<div align="center">

<table style="border:none; border-collapse:collapse">
<tr>
<td align="center" style="padding:16px 20px; border:none">
  <img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/tool.icons/IBMbob.png" width="48" height="48" style="object-fit:contain"/><br/>
  <sub><b>IBM Bob</b></sub>
</td>
<td align="center" style="padding:16px 20px; border:none">
  <img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/tool.icons/antigravity.png" width="48" height="48" style="object-fit:contain"/><br/>
  <sub><b>Codex Antigravity</b></sub>
</td>
<td align="center" style="padding:16px 20px; border:none">
  <img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/tool.icons/codex.png" width="48" height="48" style="object-fit:contain"/><br/>
  <sub><b>Codex</b></sub>
</td>
<td align="center" style="padding:16px 20px; border:none">
  <img src="https://raw.githubusercontent.com/NomanRafique01/Zyron/main/assets/tool.icons/claude.png" width="48" height="48" style="object-fit:contain"/><br/>
  <sub><b>Claude</b></sub>
</td>
</tr>
</table>

</div>

---

## Security

API keys live on the device. The app's security model is built around three principles:

1. **Encrypted storage** — Android Keystore-backed `EncryptedSharedPreferences` via `expo-secure-store`
2. **Single read path** — `keyGuard.js` is the only file that reads keys; no key is ever assigned to a module-level variable or logged
3. **Spend caps** — the most important protection is a hard monthly spend limit on every provider dashboard (see [`SECURITY.md`](SECURITY.md))

For production deployments requiring keys to leave the device entirely, `SECURITY.md` describes a ~50-line stateless Cloudflare Worker / Vercel Edge Function proxy that eliminates on-device key storage.

---

## License

MIT — see [`LICENSE.md`](LICENSE.md)

---

## Author

**Noman Rafique**
[nomanrafique.official01@gmail.com](mailto:nomanrafique.official01@gmail.com)

---

<div align="center">

*Six specialist teams. Eight AI providers. One coherent answer.*

**Zyron — Think in swarms.**

</div>
