# Ashvi server

Fastify API for Ashvi. The server provides configuration validation, Argon2id two-identity authentication, HttpOnly sessions, server-side lockout, ownership-scoped data access, structured logging with sensitive-field redaction, strict CORS, centralized safe errors, graceful shutdown, and `GET /health`.

Run `npm run security:setup` from the repository root before starting a non-test server. This creates two independent identity slots in the private `.env` file using hashes only. The server intentionally refuses to start when either slot is incomplete or duplicated.

Voice endpoints are authenticated and use local command providers configured through `ASHVI_STT_*` and `ASHVI_TTS_*` variables. `/api/voice/transcribe` accepts one multipart recording and `/api/voice/synthesize` returns temporary WAV audio. Provider binaries and model paths remain server-side, and temporary audio is removed after each request.
