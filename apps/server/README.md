# Ashvi server

Fastify API for Ashvi. The server provides configuration validation, Argon2id two-identity authentication, HttpOnly sessions, server-side lockout, ownership-scoped data access, structured logging with sensitive-field redaction, strict CORS, centralized safe errors, graceful shutdown, and `GET /health`.

Run `npm run security:setup` from the repository root before starting a non-test server. This creates two independent identity slots in the private `.env` file using hashes only. The server intentionally refuses to start when either slot is incomplete or duplicated.
