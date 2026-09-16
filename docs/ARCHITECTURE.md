# Ashvi v0 architecture

Ashvi presents one assistant identity while keeping its internal capabilities replaceable.

Core flow:

Web app -> Fastify API -> Conversation service -> AI provider -> Ollama
                   -> Prisma/PostgreSQL
                   -> Memory service
                   -> Settings service
                   -> Verification service

## Layering

- Routes handle HTTP contracts and validation.
- Services handle business logic and persistence.
- Providers hide model-specific logic behind shared interfaces.
- Prisma is the persistence layer for conversation, memory, and settings data.
- Verification sits beside the model outputs to reduce fabricated or unsupported claims.

## Current implementation status

The foundation now includes:

- Next.js frontend shell and chat UI
- Fastify app with structured error handling and CORS
- Prisma-based database models for conversations, messages, memory, documents, and settings
- Ollama-backed local AI provider abstraction
- Conversation CRUD and assistant response persistence
- Ranked memory retrieval, editable memory records, and chat-based memory suggestions
- Upload pipeline with asynchronous extraction for PDF, DOCX, TXT, and Markdown files
- Ordered document chunks with local lexical retrieval injected into chat prompts
- Verification heuristic for uncertain or overconfident responses
- Working build and test baseline

## Design principles

- One AI identity for the user
- Replaceable model providers
- Local-first operation
- Safe handling of uncertain outputs
- Modular service boundaries for future expansion

## Known limitations

This is still not a full v1 assistant. The current version intentionally keeps the foundation focused and reliable rather than overbuilding future features.

The next upgrades are planned around:

- semantic document ranking and richer document ingestion
- streaming / WebSocket task updates
- more advanced memory retrieval
- verification against document evidence
- orchestration for tool use and research jobs
