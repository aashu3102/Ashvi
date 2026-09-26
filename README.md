# Ashvi V1 — Local-First AI Companion & Assistant

Ashvi is a personal, private, and high-performance AI assistant built as a TypeScript monorepo with a Next.js web application, a Fastify Node.js API, PostgreSQL persistence with Prisma, client-side zero-cloud IndexedDB isolation, and an extensible AI orchestrator powered primarily by NVIDIA Nemotron (`nvidia/nemotron-3-ultra-550b-a55b`).

---

## V1 Master Architecture Overview

Ashvi operates as **one persistent AI identity** (`AshviOrchestrator`) while keeping all models, voice engines, search providers, and storage engines fully modular and replaceable.

```
                    ┌────────────────────────────┐
                    │      Next.js Frontend      │
                    │   (AshviShell / UI / Voice) │
                    └─────────────┬──────────────┘
                                  │ Next.js Proxy & Proxy-Gate
                                  ▼
                    ┌────────────────────────────┐
                    │     Fastify Server API     │
                    │  (SSE Streaming / REST)    │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │     AshviOrchestrator      │
                    │ (Routing, Plan, Context)   │
                    └──────┬───────┬──────┬──────┘
                           │       │      │
            ┌──────────────┘       │      └──────────────┐
            ▼                      ▼                     ▼
┌──────────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│   NVIDIA Nemotron    │ │ WebSearchService  │ │   ImageService    │
│  (Chat & Streaming)  │ │(DuckDuckGo/Tavily)│ │(Pollinations/Flux)│
└──────────────────────┘ └───────────────────┘ └───────────────────┘
            │                      │                     │
            ▼                      ▼                     ▼
┌──────────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│  PostgreSQL (Neon)   │ │ IndexedDB Private │ │ Local Voice Pipes │
│   (Cloud Sessions)   │ │  (Zero-Cloud AES) │ │ (Whisper / Piper) │
└──────────────────────┘ └───────────────────┘ └───────────────────┘
```

---

## Core Capabilities in V1

### 1. Unified Intelligence & Model Routing
- **Primary Model**: NVIDIA Nemotron-3 Ultra 550B (`nvidia/nemotron-3-ultra-550b-a55b`) with full token streaming, thinking/reasoning token isolation, and robust failover.
- **Single Identity**: `AshviOrchestrator` orchestrates classification, multi-step planning, context assembly, model execution, verification, and memory extraction.
- **Replaceable Providers**: Clean `AIProvider` contract allowing seamless pluggability.

### 2. Grounded Web Research
- **WebSearchService**: Built-in zero-config DuckDuckGo organic search provider. No external API keys required out of the box.
- **Tavily Integration**: Optional high-speed search provider when `TAVILY_API_KEY` is configured.
- **Source Citations**: Real URLs, titles, and snippets are streamed to the user interface via Server-Sent Events (`type: "sources"`).

### 3. Real Image Generation
- **ImageService**: Dedicated image generation service supporting:
  - **Pollinations AI**: Free, zero-configuration open image generation powered by Flux / SDXL with automatic dimension and aspect ratio mapping (`16:9`, `1:1`, `9:16`, `4:3`).
  - **OpenAI DALL-E 3**: Supported when `OPENAI_API_KEY` is provided.
  - **Graceful Degradation**: Clear 503 response and typed errors when disabled, preventing fake responses or unexpected 500 crashes.

### 4. Advanced Document Intelligence & RAG
- **Multi-Format Extraction**: PDF (`pdf-parse`), DOCX (`mammoth`), XLSX (`xlsx`), TXT, and Markdown.
- **Local Embedding & Retrieval**: Fast, deterministic local embedding vectors with hybrid cosine and lexical retrieval.
- **Notebook Intelligence**: Topic-specific notebooks (`/api/notebooks`) with notes, attached documents, and deep document synthesis queries.

### 5. Local Voice Pipeline
- **Speech-to-Text**: Local `WhisperProvider` supporting `faster-whisper` CLI execution.
- **Text-to-Speech**: Local `PiperProvider` supporting Piper neural voices for English and Hindi.
- **Voice Ergonomics**: Barge-in detection, prosody/emotion tracking, and bilingual Hindi/English synthesis.

### 6. Dual-Storage Architecture & Privacy
- **Authenticated Cloud Space**: Neon PostgreSQL via Prisma with user data isolation.
- **Zero-Cloud Private Space**: Client-side IndexedDB (`ashvi_private_db`) with AES-GCM key derivation. Private chats stream ephemerally via `/api/conversations/ephemeral-stream` with zero database logging.

### 7. Military-Grade Dual-Identity Access Security
- **Strict Two-Slot System**: Server boots only when exactly two authorized identity slots are configured with Argon2id hashes.
- **Defense in Depth**: HttpOnly SameSite cookies, session rotation, account lockout after 3 failed attempts, and proxy key protection.

---

## Quickstart

### Prerequisites
- Node.js 22+
- npm 10+
- PostgreSQL 15+ (or Neon serverless PostgreSQL)
- NVIDIA API Key (`https://build.nvidia.com`)

### Setup

1. **Clone repository and install dependencies:**
   ```bash
   git clone https://github.com/aashu3102/Ashvi.git
   cd Ashvi
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Add your `DATABASE_URL` and `NVIDIA_API_KEY`.

3. **Set up credentials:**
   ```bash
   npm run security:setup
   ```
   This interactive setup generates Argon2id hashes for User A and User B.

4. **Initialize database schema:**
   ```bash
   cd apps/server
   npx prisma migrate dev
   cd ../..
   ```

5. **Start application:**
   ```bash
   npm run dev
   ```
   - Web Frontend: `http://localhost:3000`
   - Server API: `http://localhost:4000`

---

## Running Tests

```bash
# Run tests across entire workspace
npm test

# Run server test suite
cd apps/server && npm test

# Run web frontend tests
cd apps/web && npm test
```

---

## Repository Structure

```
Ashvi/
├── apps/
│   ├── server/             # Fastify API, Orchestrator, AI Providers, RAG, Voice, Images
│   │   ├── src/
│   │   │   ├── ai/         # NVIDIA Nemotron provider & provider abstractions
│   │   │   ├── app/        # Server factory & route composition
│   │   │   ├── auth/       # Argon2id security & session handling
│   │   │   ├── images/     # ImageService & Pollinations/OpenAI providers
│   │   │   ├── memory/     # Ranked conversational memory
│   │   │   ├── orchestrator/# Intent classifier, planner, context builder, verifier
│   │   │   ├── rag/        # Document extraction, chunking, local vector engine
│   │   │   ├── routes/     # Fastify route controllers (auth, chat, voice, docs, notebooks, images)
│   │   │   ├── tools/      # WebSearchService (DuckDuckGo, Tavily)
│   │   │   └── voice/      # Whisper STT & Piper TTS services
│   │   └── tests/          # Comprehensive unit & integration test suites
│   └── web/                # Next.js 16 app with React 19, Tailwind, and AshviShell UI
├── packages/
│   └── shared/             # Shared TypeScript schemas & contracts
├── docs/                   # Architecture specification & developer notes
└── scripts/                # Setup & credential configuration utilities
```

---

## License

Private and confidential. Developed for Ashvi AI Assistant.
