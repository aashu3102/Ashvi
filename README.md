# Ashvi v0

Ashvi is a local-first personal AI assistant built as a TypeScript monorepo with a Next.js frontend, Fastify API, PostgreSQL persistence, Prisma, and a replaceable local AI provider layer powered by Ollama.

## Version 0 scope

This repository implements the Ashvi foundation layer:

- Workspace-based monorepo structure
- Next.js web app
- Fastify Node.js API
- PostgreSQL + Prisma persistence
- Local AI abstraction through Ollama
- Conversation persistence
- Ranked memory retrieval, editing, and durable-memory suggestions
- Document extraction, chunking, and local retrieval for PDF, DOCX, TXT, and Markdown files
- Verification guardrails for uncertain answers
- Structured configuration and error handling
- Working test baseline and build pipeline

## Architecture

Ashvi follows a modular layered design:

Frontend -> Fastify API -> Conversation service -> AI provider -> Ollama
                    -> Prisma/PostgreSQL
                    -> Memory and document modules
                    -> Verification layer

The app separates business logic from route handlers and keeps provider details behind an abstraction so model swaps do not require rewriting application logic.

## Technology stack

- Node.js 22+
- npm 10+
- TypeScript
- Fastify
- Next.js
- PostgreSQL
- Prisma
- Zod
- Ollama

## Prerequisites

Before running the project, install:

- Node.js 22 or newer
- npm 10 or newer
- PostgreSQL 15+
- Ollama

## PostgreSQL setup

Create a local database named ashvi and set the database URL in .env:

DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/ashvi?schema=public"

Then run Prisma migrations from the server folder:

cd apps/server
npx prisma migrate dev

## Ollama setup

Install Ollama and pull a compatible local model such as qwen2.5:3b:

ollama pull qwen2.5:3b

Then confirm it responds:

curl http://127.0.0.1:11434/api/tags

## Environment configuration

Copy the example file and update values:

cp .env.example .env

Expected variables:

- DATABASE_URL
- ASHVI_SERVER_PORT
- ASHVI_FRONTEND_URL
- ASHVI_LOG_LEVEL
- ASHVI_AI_MODEL
- OLLAMA_BASE_URL
- NEXT_PUBLIC_ASHVI_API_URL
- ASHVI_SESSION_SECRET
- ASHVI_USER_A_NAME / ASHVI_USER_A_CODE_HASH / ASHVI_USER_A_PASSWORD_HASH
- ASHVI_USER_B_NAME / ASHVI_USER_B_CODE_HASH / ASHVI_USER_B_PASSWORD_HASH

## Private access security

Ashvi requires exactly two configured identity slots before a non-test server can start. Each slot has its own username, secret access-code hash, and password hash. Raw credentials must never be placed in source code, `.env.example`, logs, API responses, or browser storage.

Generate Argon2id hashes using the installed server dependency and place only the resulting hashes in the private `.env` file. Configure a random `ASHVI_SESSION_SECRET` of at least 32 characters. The server enforces HttpOnly SameSite cookies, server-side sessions, ownership checks, three-attempt account lockout, and IP-signal throttling.

For local setup, run `npm run security:setup` from the repository root and enter both identities directly into the terminal. Secret inputs are hidden, hashed with Argon2id, and never written in plaintext.

There is no public registration, guest mode, default account, or frontend-only access control. The second authorized user's independent credential pair is required before production access is enabled.

## Installation

1. Install dependencies at the workspace root.
2. Ensure PostgreSQL is running.
3. Ensure Ollama is running.
4. Run Prisma migration.
5. Start the server and web app.

## Running backend

cd apps/server
npm install
npm run dev

## Running frontend

cd apps/web
npm install
npm run dev

## Testing

Run the workspace test suite:

npm test --workspaces --if-present

Current verified baseline:

- Health endpoint test passes
- Conversation API test passes
- Build verifies for both server and web workspaces

## Project structure

- apps/server for Fastify + Prisma + AI logic
- apps/web for Next.js interface
- packages/shared for shared types and schemas
- data/documents for uploaded document storage
- docs for design and architecture notes

## Current limitations

This is still a foundation release. Not all future v0.5+ features are implemented yet. The current version focuses on the foundation and core operational loop:

- local AI conversations
- persistent chat storage
- memory and settings support
- document processing with searchable chunks and chat context retrieval
- verification guardrail for hallucination-prone output
- app build and test reliability

## Future roadmap

Planned evolution:

- semantic document ranking and richer document previews
- streaming WebSocket or SSE improvements
- stronger orchestrator and context layering
- memory retrieval with ranking
- user-level auth and multi-user support
- voice and vision expansion
- advanced task automation and research workflows

## Current status

Ashvi v0 is in a working foundation stage and can be run locally as a modular base for future expansion.
