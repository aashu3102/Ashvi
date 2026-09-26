# Ashvi V1 Architecture

## Philosophy

Ashvi is designed with four fundamental architectural pillars:

1. **One Persistent Identity**: The user always interacts with Ashvi. Regardless of whether an underlying model is NVIDIA Nemotron, an image generator, a local Whisper pipeline, or a search crawler, Ashvi's tone, memory, and orchestration remain unified.
2. **Local-First & Privacy-Preserving**: Private conversations run ephemerally with zero cloud database persistence and are stored exclusively in client-side IndexedDB with AES-GCM encryption. Voice commands process locally via Whisper and Piper.
3. **Pluggable & Replaceable Engines**: All external models and providers implement strict interfaces (`AIProvider`, `ImageProvider`, `SearchProvider`, `STTProvider`, `TTSProvider`), allowing zero-downtime provider substitution.
4. **Verification Guardrails**: Every LLM response is inspected by a deterministic verification layer before completion to flag ungrounded claims, detect hallucinations, and enforce source citations.

---

## Architecture Topology

```
┌────────────────────────────────────────────────────────┐
│                   Next.js Web Client                   │
│                                                        │
│  AshviShell ── ActiveChatModal ── VoiceBar ── Sidebar  │
│         │                                              │
│         ├── IndexedDB (Private AES Encrypted Store)    │
│         └── Audio Recorder / Audio Player (WAV)        │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / WSS / SSE
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Next.js API Proxy                    │
│                 /app/api/[...path]                     │
│         (Proxy-Key Gate / Origin Hardening)            │
└──────────────────────────┬─────────────────────────────┘
                           │ Internal loopback
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Fastify 5 Server                     │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │               Security & Auth Gate               │  │
│  │   - Argon2id Hash Authentication                 │  │
│  │   - Encrypted Session Cookies                    │  │
│  │   - Rate Limiter & Brute-Force Lockout           │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│  ┌──────────────────────────▼───────────────────────┐  │
│  │                 AshviOrchestrator                │  │
│  │                                                  │  │
│  │   1. Intent Classifier (Coding/Research/Docs/etc)│  │
│  │   2. Context Builder (Sliding Window + Memory)   │  │
│  │   3. Task Planner (Direct or Multi-Step)         │  │
│  │   4. Model Router (Priority Routing + Fallback)  │  │
│  │   5. Verification Layer (Grounding Check)        │  │
│  └───────┬────────────┬─────────────┬────────────┬──┘  │
│          │            │             │            │     │
│          ▼            ▼             ▼            ▼     │
│  ┌──────────────┐┌───────────┐┌───────────┐┌────────┐  │
│  │NVIDIA Provider│WebSearch  ││ImageService│Document│  │
│  │(Nemotron 550B││(DuckDuckGo││(Pollinat- ││Service │  │
│  │ Chat/Stream) ││ / Tavily) ││ ions/Flux)││ (RAG)  │  │
│  └──────────────┘└───────────┘└───────────┘└────────┘  │
│          │                                       │     │
│          ▼                                       ▼     │
│  ┌──────────────────────────────────────────────────┐  │
│  │               Neon PostgreSQL + Prisma           │  │
│  │   Users · Conversations · Messages · Memory      │  │
│  │   Documents · DocumentChunks · Notebooks         │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## Subsystems

### 1. Ashvi Orchestrator (`src/orchestrator/`)
- `intent-classifier.ts`: Classifies requests into intents (`coding`, `research`, `web_research`, `document_analysis`, `image_generation`, `general_conversation`, `notebook_query`, etc.).
- `context-builder.ts`: Assembles a multi-turn token budget budget sliding window, integrating memory facts, document excerpts, and web research results with role attribution and prompt guardrails.
- `model-router.ts`: Manages provider registry, priority routing, capability filtering (e.g. streaming, privacy-only constraints), and automatic failover.
- `verification-layer.ts`: Scores responses for cautious language, checks against retrieved source citations, and marks states as `verified`, `requires_evidence`, or `failed`.

### 2. AI & Model Providers (`src/ai/`)
- `nvidia.provider.ts`: Integrates NVIDIA's OpenAI-compatible Nemotron API (`nvidia/nemotron-3-ultra-550b-a55b`) with full token streaming, reasoning tokens, and timeout handling.

### 3. Web Search Grounding (`src/tools/search.tool.ts`)
- `DuckDuckGoSearchProvider`: Native zero-config HTML organic result extractor.
- `TavilySearchProvider`: Optional high-precision research API.
- Injects structured evidence into orchestrator context turns and streams source citations to the client.

### 4. Image Generation (`src/images/image.service.ts`)
- `PollinationsImageProvider`: High-quality open Flux/SDXL image synthesis with dynamic aspect ratio geometry (`16:9`, `1:1`, `9:16`, `4:3`).
- `OpenAIImageProvider`: DALL-E 3 fallback when configured.
- Graceful 503 handling when image services are disabled.

### 5. Document RAG & Notebooks (`src/rag/`, `src/services/notebook.service.ts`)
- Ingestion for PDF, DOCX, XLSX, Markdown, and text.
- Deterministic 384-dimensional local vector embedding for zero external API reliance.
- Notebook service binding documents and notes to orchestrator execution.

### 6. Voice Engine (`src/voice/`)
- STT: `WhisperProvider` executing `faster-whisper`.
- TTS: `PiperProvider` executing neural `piper` voices with English and Hindi support.
- Low-latency temporary buffer cleanup and barge-in session management.
