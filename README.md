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
                         ╷                
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

## Agent Teams

Zyron ships with **six pre-built specialist teams**. Each team redefines all four agent slots — names, icons, directives, and contribution lenses — while keeping the same underlying API sockets.

---

### ⚡ Dev Core
> *Staff-level engineering team*

The general-purpose software engineering team. Best for system design, full-stack implementation, code review, debugging, and technical explanations.

| Slot | Agent | Icon | Role |
|------|-------|------|------|
| Agent 1 | **Reasoner** | 🧠 | Produces Architecture Decision Records, typed interface contracts, and failure taxonomies ranked by probability × impact |
| Agent 2 | **Coder** | ⚡ | Delivers complete, type-safe, zero-placeholder implementations with O(n) complexity annotations |
| Agent 3 | **Vision** | 🔍 | Red-teams with STRIDE threat modeling (Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation) and a 6-case test matrix |
| Agent 4 | **Writer** | ✍️ | Developer-ready reference: ADR → implementation → QA → usage |

---

### 💻 Coders
> *Principal-level software construction*

Pure implementation team with zero-tolerance production standards. Best for new features, refactors, algorithm design, API development, and adversarial debugging.

| Slot | Agent | Icon | Role |
|------|-------|------|------|
| Agent 1 | **Architect** | 📐 | ADR-style blueprints with dependency graphs, circular-dependency risk identification, and typed API contracts |
| Agent 2 | **Engineer** | ⚙️ | Zero-tolerance code: no ellipsis, no TODOs, TypeScript strict mode, named constants only |
| Agent 3 | **Debugger** | 🔍 | Adversarial failure catalog, Big-O complexity audit, STRIDE security audit, 6-case adversarial test suite |
| Agent 4 | **Technical Writer** | 📝 | Production reference: ADR → typed implementation → adversarial findings, with typed usage examples |

---

### 🔬 Scientists
> *Professional-grade scientific reasoning*

Rigorous STEM analysis team. Best for physics, chemistry, mathematics, statistics, engineering calculations, and formal derivations.

| Slot | Agent | Icon | Role |
|------|-------|------|------|
| Agent 1 | **Theorist** | 🧮 | First-principles LaTeX derivations, full symbol dictionary, dimensional analysis checkpoint, limiting cases |
| Agent 2 | **Experimenter** | 🧪 | Reproducible numerical calculation with unit propagation, significant figures discipline, and boxed final answer |
| Agent 3 | **Modeler** | 📊 | Physical intuition, variable sensitivity in LaTeX, phase diagrams with behavioral regimes, simulation suggestions |
| Agent 4 | **Reporter** | 📋 | Lab-report structure: Theory → Computation → Intuition → Result, all LaTeX preserved verbatim |

---

### 📖 Mega Minds
> *World-class research and understanding*

Deep knowledge and research team. Best for explaining complex concepts, comparative analysis, research deep-dives, and learning frameworks.

| Slot | Agent | Icon | Role |
|------|-------|------|------|
| Agent 1 | **Scholar** | 📚 | First-principles derivation, steelmanned counterarguments, epistemic confidence levels (HIGH/MEDIUM/LOW), assumption auditing |
| Agent 2 | **Analyst** | 🔬 | Evidence hierarchy (meta-analysis → RCT → observational), causal mechanism chains (A→B→C), quantified trade-off matrices |
| Agent 3 | **Synthesizer** | 🧩 | Cognitive load audit, mental model construction, analogy with explicit structural mapping, insight crystallization in ≤20 words |
| Agent 4 | **Editor** | ✒️ | Builds from definition → mechanism → nuance → mental model → insight, closes with a perspective shift |

---

### 📜 Historians
> *Distinguished historical scholarship*

Historical analysis and narrative team. Best for historical events, era analysis, biographical research, comparative history, and geopolitical context.

| Slot | Agent | Icon | Role |
|------|-------|------|------|
| Agent 1 | **Archivist** | 📚 | Verified chronologies with ESTABLISHED/PROBABLE/CONTESTED/UNKNOWN epistemic status, bias detection, source landscape analysis |
| Agent 2 | **Contextualist** | ⏳ | Three-level causal chain (proximate → intermediate → root), agency-vs-structure analysis, counterfactual reasoning |
| Agent 3 | **Cartographer** | 🗺️ | Timeline architecture, comparison tables with defined criteria, geographical and demographic context |
| Agent 4 | **Biographer** | 🖋️ | Authoritative scholarly narrative — Niall Ferguson narrative command + Barbara Tuchman human specificity + peer-review rigor |

---

### 🎭 Creative Thinkers
> *Executive-level creative strategy*

World-class creative team. Best for copywriting, brand strategy, storytelling, content campaigns, naming, and creative ideation.

| Slot | Agent | Icon | Role |
|------|-------|------|------|
| Agent 1 | **Strategist** | 🎯 | Creative tension identification, human truth, anti-brief (executional traps), three creative territories with risk/opportunity |
| Agent 2 | **Creator** | 🎨 | Three hook variants (conventional/subversive/formally unusual), sensory-dense drafts, rhythm scoring annotations |
| Agent 3 | **Curator** | 🖼 | Line-level editorial surgery: 5 weakest lines diagnosed and rewritten, rhythm surgery, emotional arc mapping, six precision word swaps |
| Agent 4 | **Narrator** | 📖 | Final polished voice honoring the strategic brief, best hook selected, all curation edits applied |

---

## Feature Overview

### 🤖 Multi-Agent Swarm Engine
- **Parallel execution** — Agents 1–3 fire simultaneously, not sequentially
- **Team Blending** — cross-team specialist borrowing per query without changing the active session team (e.g., pull Mega Minds' Scholar into a Coders session)
- **Coordination modes** — `NONE` (direct), `COMPACT` (brief sharing), `FULL` (structured specialist briefs with shared context)
- **Model tier routing** — cheap vs. expensive model selection based on query complexity
- **Team switching suggestions** — the router detects when a different team would produce better results

### ⚡ Real-Time Streaming
- **Server-Sent Events (SSE)** for all supporting providers — tokens stream live to screen
- **Per-agent streaming state** — each agent has its own progress bar and status label (Thinking / Building / Red-teaming / Polishing)
- **Graceful abort** — stop mid-generation, generation cancels cleanly across all active sockets

### 🛡️ Resilient API Layer
- **Circuit breaker** — per-provider failure tracking; tripped circuits skip that socket for the current session
- **Fallback chains** — automatic failover to the next provider on timeout or error
- **Sanitized error messages** — no raw API keys or stack traces ever surface in the UI

### 💾 On-Device Memory
- **SQLite persistence** — full conversation history with session index and message pagination
- **User memory** — contextual facts extracted from conversations and injected into future prompts
- **Offline fallback** — Gemini Nano on-device inference for queries when all network providers are unreachable

### 🔒 Security
- **Android Keystore-backed storage** — API keys stored in `EncryptedSharedPreferences` via `expo-secure-store`; never in `AsyncStorage` or any JS bundle string
- **Single read gateway** — `keyGuard.js` is the only permitted key-read path; keys are read at call-time and never stored in module-level variables
- **Optional API Config Lock** — a password gate that locks all API settings behind biometric or PIN authentication
- **No telemetry** — all telemetry is session-local, never transmitted

### ✍️ Synthesis Intelligence
- **Quality judge** — LLM + heuristic scorer evaluates output against domain-specific required/prohibited criteria (coding, STEM, analytical, writing, creative, general)
- **Semantic deduplication** — removes redundant content across agent outputs before synthesis
- **Agent personas** — five Writer synthesis modes: Balanced, Creative, Precise, Educator, Executive

### 🧮 Math & Code Rendering
- **LaTeX rendering** — `KaTeX` via `WebView` for inline and display math formulas
- **Syntax-highlighted code blocks** — dedicated `SyntaxCode` component with language detection and copy-to-clipboard
- **Chemical formula detection** — `mathParser.utils.js` handles inline chemical notation alongside LaTeX

### 🗂️ Conversation Management
- **Timeline grouping** — conversations bucketed into Today / Yesterday / Older
- **Session sidebar** — slide-out drawer with conversation history, search, and new-chat creation
- **Smart welcome greeting** — time-aware greeting (Night Owl / Early Bird / Golden Hour / etc.) with the user's first name

### ⚙️ Settings & Personalization
- **Profile panel** — display name, role, preferred tone, language, coding style, detail level
- **Agent Library** — accordion panel showing all six teams with per-team agent roster and expand-to-inspect detail
- **API Config panel** — per-provider key entry, model selection, key status verification, share-key-across-agents toggle
- **Privacy panel** — privacy mode, profile context injection toggle
- **Reset panel** — wipe conversation history, clear API keys, full factory reset

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
├── expo-secure-store        Android Keystore-backed key storage
├── expo-sqlite              On-device conversation + memory persistence
├── expo-local-authentication  Biometric/PIN API lock gate
├── expo-blur                Settings modal blur backgrounds
├── expo-linear-gradient     Agent glow effects
├── expo-clipboard           Code block copy-to-clipboard
├── react-native-webview     KaTeX LaTeX rendering
├── react-native-svg         SVG icons and decorative elements
├── react-native-keyboard-controller  Cross-platform keyboard layout tracking
├── react-native-safe-area-context    Edge-to-edge safe area handling
├── @react-native-async-storage       User profile and team selection persistence
├── @react-native-community/netinfo   Offline detection → Gemini Nano fallback
└── katex 0.17              LaTeX math typesetting
```

**Build toolchain:** EAS Build with development / preview / production-APK / production-AAB profiles.

---

## Project Structure

```
Zyron/
├── App.js                     React root — SplashScreen + MainApp
├── index.js                   Expo entry point + global error handler
├── app.config.js              Active Expo config (merges .env secrets)
├── eas.json                   EAS Build profiles
│
├── assets/
│   ├── icons/                 Favicon + web icons
│   ├── images/                In-app logo assets
│   └── splash/                Android adaptive icon + splash screen
│
├── plugins/
│   └── withAndroidWindowBackground.js  Prevents white flash on cold launch
│
└── src/
    ├── agents/                ◀ Core AI swarm engine (private implementation)
    │   ├── orchestrator.js       Pipeline runner
    │   ├── analysis/             Query classifier
    │   ├── api/                  Provider HTTP clients + circuit-breaker + fallback
    │   ├── memory/               SQLite on-device memory store
    │   ├── offline/              Gemini Nano offline fallback
    │   ├── progress/             Per-agent progress state tracker
    │   ├── prompts/              Prompt builder + domain templates
    │   ├── registry/             Agent registry + team metadata + persona instructions
    │   ├── router/               Team router + model tier selector
    │   ├── security/             keyGuard — single key-read gateway
    │   ├── streaming/            SSE stream manager
    │   ├── synthesis/            Synthesizer + quality judge + semantic dedup
    │   ├── teams/                Dev Core, Coders, Scientists, Mega Minds, Historians, Creative Thinkers
    │   ├── telemetry/            Session-local latency/token/error metrics
    │   └── tools/                Tool registry + sandboxed JS code executor
    │
    ├── components/
    │   ├── agent/             AgentPanel, AgentBadge, AgentCoordinationTab
    │   ├── chat/              ChatBubble, ChatMessageList, SyntaxCode
    │   ├── input/             InputBar with agent-strip dots
    │   ├── layout/            Header (glow/offline), SidebarDrawer
    │   ├── math/              MathFormula (KaTeX via WebView)
    │   ├── modals/            ConfirmDialog, SetupGuideModal
    │   └── shared/            Icons, PasswordField, WelcomeLogo
    │
    ├── config/
    │   ├── appConfig.js       Agent defaults, provider models, user profile schema
    │   ├── colors.config.js   Design token palette (agent accent colors, glows)
    │   ├── apiLock.config.js  SecureStore key constants for API lock
    │   └── agentPersona.config.js  Writer synthesis persona options
    │
    ├── database/
    │   └── db.init.js         SQLite schema + all message CRUD operations
    │
    ├── hooks/
    │   ├── useAgentExecution.hook.js   Send/stop/regenerate, agent state updates
    │   ├── useAgentSockets.hook.js     Key load/save/verify, team selection, engine toggle
    │   ├── useConversations.hook.js    Session index, message pagination, new/delete chat
    │   ├── useSettings.hook.js         Settings modal, password manager, API lock, profile
    │   └── useToast.hook.js            In-app toast: show/dismiss, swipe-to-dismiss, auto-dismiss
    │
    ├── screens/
    │   ├── chat/MainApp.screen.jsx      Composition root — wires all hooks and components
    │   ├── splash/SplashScreen.screen.jsx  Animated custom splash over native launch screen
    │   └── settings/
    │       ├── SettingsModal.screen.jsx
    │       ├── panels/                  Profile, AgentLibrary, ApiConfig, Privacy, About, Reset
    │       ├── auth/                    ApiLockGate, PasswordManager, RemoveLockBanner
    │       └── rows/                    AgentSocketRow
    │
    ├── styles/
    │   ├── app.styles.js        Master stylesheet (merges all sub-sheets)
    │   └── *.styles.js          Layout, feedback, welcome, sidebar, settings, profile, socket
    │
    └── utils/
        ├── agentLogic.utils.js      Backward-compatible facade for agents public API
        ├── mathParser.utils.js      LaTeX / chemical formula detection and splitting
        ├── responseGenerator.utils.js  Legacy direct API caller
        └── responsive.utils.js      Dimension-based scale/spacing/fontScale helpers
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
