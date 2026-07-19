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

![Platform](https://img.shields.io/badge/platform-Android-34A853?style=flat-square&logo=android&logoColor=white)
![Framework](https://img.shields.io/badge/framework-React%20Native%20%2F%20Expo-0EA5E9?style=flat-square&logo=expo&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-7B2FFF?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-10B981?style=flat-square)
![Status](https://img.shields.io/badge/status-Active%20Dev-F97316?style=flat-square)
![SDK](https://img.shields.io/badge/min%20SDK-21-A78BFA?style=flat-square)

</div>

---

## What is Zyron?

Zyron is a production-grade Android AI assistant that replaces a single chatbot with a **coordinated swarm of four specialist agents** running in parallel. Every query is routed to a team of domain experts — an analyst, an executor, a validator, and a synthesizer — whose outputs are fused into a single, high-quality response.

Unlike standard AI apps where one model does everything, Zyron assigns each agent a strict role and a constitutional directive. They compete, cross-examine each other's work, and only the synthesized result reaches the user.

> **One question. Four agents. Zero compromise.**

---
<div align="center">
  <img src="assets/images/banner.png" alt="Zyron Banner" width="100%"/>
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

## Backend + Local Fallback Logic

Zyron uses a **dual-engine architecture** — a Railway-hosted Python FastAPI backend as the primary orchestrator, with a fully self-contained local JS engine as a silent fallback. The user never sees the switch happen.

```
┌─────────────────────────────────────────────────────────┐
│                   backendBridge.js                      │
│                                                         │
│  1. POST /orchestrate → Railway backend (30 s timeout)  │
│         │                                               │
│         ├── ✅ 200 OK  → remap agents to active team    │
│         │              → return fused response          │
│         │                                               │
│         └── ❌ Timeout │ Network error │ Non-200        │
│                        │                               │
│                        ▼                               │
│         Local runAgentsOrchestrator() — silent fallback │
│         Full SSE streaming, circuit-breakers, dedup    │
└─────────────────────────────────────────────────────────┘
```

### What the backend does
- **Python FastAPI** on Railway (`https://zyron-production-7af1.up.railway.app`)
- `POST /orchestrate` — accepts `{ query, agentConfigs, team, persona, userProfile }`
- Runs three specialist agents in parallel via `LangGraph` then synthesizes via the writer agent
- Returns structured `{ finalAnswer, agents[], coordinationMode }` JSON

### Fallback guarantee
- Timeout is **30 seconds**. If the backend doesn't respond in time, the local engine starts immediately — no error is ever shown to the user
- If the user pressed **Stop** while waiting, the abort propagates cleanly across both paths
- **Progress bar animation** starts on the frontend while the backend call is in-flight: agents animate from 0 % → 78 % (exponential approach, τ = 28 s), then jump to 100 % on response
- Agent names, icons, and accent colors are always **remapped to the active team** after a backend response — the backend drives logic, the frontend owns visual identity

---

## All 6 Teams — All 24 Agents

Every team has **4 agents** (Roles: Analyst · Executor · Validator · Synthesizer) with individual PNG icons, distinct accent colors, and specialist directives.

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
<td align="center"><img src="assets/agent-icons/mega-minds/scholar.png" width="64" height="64"/><br><b>Scholar</b></td>
<td align="center"><img src="assets/agent-icons/mega-minds/analyst.png" width="64" height="64"/><br><b>Analyst</b></td>
<td align="center"><img src="assets/agent-icons/mega-minds/synthesizer.png" width="64" height="64"/><br><b>Synthesizer</b></td>
<td align="center"><img src="assets/agent-icons/mega-minds/editor.png" width="64" height="64"/><br><b>Editor</b></td>
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
<td align="center"><img src="assets/agent-icons/coders/designer.png" width="64" height="64"/><br><b>Designer</b></td>
<td align="center"><img src="assets/agent-icons/coders/programmer.png" width="64" height="64"/><br><b>Programmer</b></td>
<td align="center"><img src="assets/agent-icons/coders/debugger.png" width="64" height="64"/><br><b>Debugger</b></td>
<td align="center"><img src="assets/agent-icons/coders/executor.png" width="64" height="64"/><br><b>Executor</b></td>
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
<td align="center"><img src="assets/agent-icons/creative/strategist.png" width="64" height="64"/><br><b>Strategist</b></td>
<td align="center"><img src="assets/agent-icons/creative/creator.png" width="64" height="64"/><br><b>Creator</b></td>
<td align="center"><img src="assets/agent-icons/creative/curator.png" width="64" height="64"/><br><b>Curator</b></td>
<td align="center"><img src="assets/agent-icons/creative/narrator.png" width="64" height="64"/><br><b>Narrator</b></td>
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
<td align="center"><img src="assets/agent-icons/scientists/theorist.png" width="64" height="64"/><br><b>Theorist</b></td>
<td align="center"><img src="assets/agent-icons/scientists/experimenter.png" width="64" height="64"/><br><b>Experimenter</b></td>
<td align="center"><img src="assets/agent-icons/scientists/modeler.png" width="64" height="64"/><br><b>Modeler</b></td>
<td align="center"><img src="assets/agent-icons/scientists/reporter.png" width="64" height="64"/><br><b>Reporter</b></td>
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

<table>
<tr>
<th align="center">Agent 1 — Archivist</th>
<th align="center">Agent 2 — Contextualist</th>
<th align="center">Agent 3 — Cartographer</th>
<th align="center">Agent 4 — Biographer</th>
</tr>
<tr>
<td align="center"><img src="assets/agent-icons/historians/archivist.png" width="64" height="64"/><br><b>Archivist</b></td>
<td align="center"><img src="assets/agent-icons/historians/contextualist.png" width="64" height="64"/><br><b>Contextualist</b></td>
<td align="center"><img src="assets/agent-icons/historians/cartographer.png" width="64" height="64"/><br><b>Cartographer</b></td>
<td align="center"><img src="assets/agent-icons/historians/biographer.png" width="64" height="64"/><br><b>Biographer</b></td>
</tr>
<tr>
<td>Verified chronologies, key actors and roles, ESTABLISHED/PROBABLE/CONTESTED/UNKNOWN epistemic status, source gaps</td>
<td>Trigger → intermediate → root cause chain, agency vs. structure, counterfactual reasoning</td>
<td>Timeline tables, comparison grids, geographic and demographic context, narrative structure blueprint</td>
<td>Authoritative scholarly narrative — honest about uncertainty, contextual judgment, no anachronism</td>
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
<td align="center"><img src="assets/agent-icons/financers/accountant.png" width="64" height="64"/><br><b>Accountant</b></td>
<td align="center"><img src="assets/agent-icons/financers/adviser.png" width="64" height="64"/><br><b>Adviser</b></td>
<td align="center"><img src="assets/agent-icons/financers/auditor.png" width="64" height="64"/><br><b>Auditor</b></td>
<td align="center"><img src="assets/agent-icons/financers/investor.png" width="64" height="64"/><br><b>Investor</b></td>
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

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#7B2FFF" stroke="#7B2FFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Real-Time Streaming
- **Server-Sent Events (SSE)** for all supporting providers — tokens stream live to screen
- **Per-agent streaming state** — each agent has its own progress bar and status label (Thinking / Building / Stress-testing / Documenting / etc.)
- **Graceful abort** — stop mid-generation, cancels cleanly across all active sockets

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
- **Offline fallback** — Gemini Nano on-device inference for queries when all network providers are unreachable

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#7B2FFF" stroke-width="1.8"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#7B2FFF" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16" r="1.5" fill="#7B2FFF"/></svg> Authentication *(New)*
Optional Firebase-backed sign-in with three providers:
- **Email + Password** — full sign-up / sign-in / password reset flow
- **Google Sign-In** — OAuth via `@react-native-google-signin`
- **GitHub Sign-In** — OAuth via `expo-web-browser`

Firebase is lazy-loaded via `try/catch` so the app runs in local mode (no auth, no crash) when the native module is not linked (e.g. Expo Go). All auth state is managed in `auth.service.js` with Firestore user document upsert on first sign-in.

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

### <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><circle cx="12" cy="12" r="3" stroke="#7B2FFF" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#7B2FFF" stroke-width="1.8"/></svg> Settings & Personalization
- **Profile panel** — display name, role, preferred tone, language, coding style, detail level
- **Agent Library** — accordion panel showing all six teams with per-team agent roster and expand-to-inspect detail
- **Agents Workshop** — custom agent and custom team builder (described above)
- **API Config panel** — per-provider key entry, model selection, key status verification, share-key-across-agents toggle
- **Privacy panel** — privacy mode, profile context injection toggle
- **Reset panel** — wipe conversation history, clear API keys, full factory reset

---

## How to Use

### Step 1 — Add Your API Keys

1. Tap the **Settings** icon (top-right of the chat screen)
2. Navigate to **API Config**
3. For each agent socket (Agent 1 – 4), select a provider from the dropdown and paste your API key
4. Tap **Verify** to confirm the key is live — a green status indicator means it's ready
5. Enable **Share key across agents** if you want all four sockets to use the same key

> You only need one working key to start. Zyron will use it across all agents until you configure individual keys.

---

### Step 2 — Choose a Team

1. In **Settings → Agent Library**, browse the six specialist teams:
   `Financers · Coders · Scientists · Mega Minds · Historians · Creative Thinkers`
2. Tap a team to preview its four agents and their roles
3. Tap **Set as Active Team** to activate it for your next query

The active team is shown in the header.

---

### Step 3 — Send a Query

1. Type your question in the input bar, or tap the **Mic** button to dictate
2. Tap **Send** (or press Enter)
3. Watch the four agent progress bars appear — each agent streams its output in real time
4. The final fused response appears in the chat bubble when Agent 4 completes

To **stop** a generation mid-stream, tap the **Stop** button.

---

### Step 4 — Use Live Talk

1. Tap the **Live** button in the input bar (right side)
2. The neural-network animation opens — tap the center to start listening
3. Speak your question — partial transcript shows in real time
4. After a 1.5 s pause Zyron thinks, then speaks the answer back to you
5. Keep talking for follow-up questions — the mic stays open continuously
6. Tap **Interrupt** to stop Zyron mid-sentence, or tap **X** to close the session

---

### Step 5 — Build a Custom Team

1. Go to **Settings → Agents Workshop**
2. Switch to the **Agents** tab — create your custom agent personas with icons, traits, and strength sliders
3. Switch to the **Teams** tab — assign your agents to the four role slots
4. Give the team a name and icon, then tap **Create Team**
5. Your team now appears in Agent Library alongside the built-in teams

---

### Step 6 — Customize Synthesis Persona

1. Open **Settings → Profile**
2. Under **Writer Persona**, pick one of five modes:

   | Persona | When to use |
   |---------|-------------|
   | **Balanced** | Everyday queries |
   | **Precise** | Technical / factual answers needing exact numbers |
   | **Educator** | Learning new concepts step-by-step |
   | **Creative** | Brainstorming, copywriting, storytelling |
   | **Executive** | Quick decisions — TL;DR + action item |

---

### Step 7 — Manage Conversations

| Action | How |
|--------|-----|
| **New chat** | Tap **＋** in the top-left sidebar |
| **Switch session** | Slide open the left drawer and tap any past conversation |
| **Delete session** | Long-press a session in the sidebar → Delete |
| **Search history** | Use the search bar at the top of the sidebar |

---

### Step 8 — Lock API Settings (Optional)

If other people use your device, enable **API Config Lock** in **Settings → Privacy**:

1. Set a PIN or use biometric authentication
2. Once enabled, the **API Config** panel requires authentication before it can be opened
3. To remove the lock, authenticate and tap **Remove Lock**

---

### Tips

- **Offline?** Zyron falls back to on-device **Gemini Nano** automatically when all network providers are unreachable
- **Wrong team for your query?** The router will suggest a better-suited team — look for the suggestion banner below your response
- **Regenerate** a response by long-pressing the assistant bubble → **Regenerate**
- **Copy code** from any code block by tapping the copy icon in the top-right of the block
- **Backend unavailable?** Zyron silently switches to its local engine — same quality, no interruption

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

## Tech Stack

```
React Native 0.81.5 + Expo SDK 54
├── expo-secure-store              Android Keystore-backed key storage
├── expo-sqlite                    On-device conversation + memory persistence
├── expo-speech                    TTS — Live Talk voice output
├── expo-speech-recognition        STT — Mic input + Live Talk voice input
├── expo-local-authentication      Biometric/PIN API lock gate
├── expo-blur                      Settings modal blur backgrounds
├── expo-linear-gradient           Agent glow effects
├── expo-clipboard                 Code block copy-to-clipboard
├── expo-web-browser               GitHub OAuth redirect handler
├── react-native-webview           KaTeX LaTeX rendering
├── react-native-svg               SVG icons, decorative elements, team icons
├── react-native-keyboard-controller  Cross-platform keyboard layout tracking
├── react-native-safe-area-context    Edge-to-edge safe area handling
├── @react-native-async-storage       User profile, team selection, custom teams/agents
├── @react-native-community/netinfo   Offline detection → Gemini Nano fallback
├── @react-native-firebase/auth       Firebase email/Google/GitHub authentication
├── @react-native-firebase/firestore  User document store
└── katex 0.17                     LaTeX math typesetting
```

**Backend:** Python 3.11 · FastAPI · LangGraph · Railway deployment

**Build toolchain:** EAS Build with development / preview / production-APK / production-AAB profiles.

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
│   ├── main.py                  FastAPI app — /health + /orchestrate endpoints
│   ├── models.py                Pydantic request/response models
│   ├── orchestrator.py          LangGraph pipeline runner
│   ├── query_analyzer.py        Query classification
│   ├── prompt_builder.py        Prompt construction
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
    │   ├── offline/                 Gemini Nano offline fallback
    │   ├── progress/                Per-agent progress state tracker
    │   ├── prompts/                 Prompt builder + domain templates
    │   ├── registry/                Agent registry + team metadata + persona instructions
    │   ├── router/                  Team router + model tier selector
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
    │   ├── auth/MainApp.screen.jsx      Firebase Auth — email, Google, GitHub sign-in
    │   ├── chat/MainApp.screen.jsx      Composition root — wires all hooks and components
    │   ├── splash/SplashScreen.screen.jsx  Animated custom splash
    │   └── settings/
    │       ├── SettingsModal.screen.jsx
    │       ├── panels/                  Profile, AgentLibrary, AgentsWorkshop, ApiConfig, Privacy, About, Reset
    │       ├── auth/                    ApiLockGate, PasswordManager, RemoveLockBanner
    │       └── rows/                    AgentSocketRow
    │
    ├── services/
    │   └── auth.service.js          Firebase Auth service (lazy-loaded)
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
