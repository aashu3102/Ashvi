import { describe, expect, it, vi, beforeEach } from "vitest";
import { GeminiProvider } from "../src/ai/gemini.provider.js";
import { OllamaProvider } from "../src/ai/ollama.provider.js";
import { ProviderRegistry } from "../src/orchestrator/model-router.js";
import { NotebookService } from "../src/services/notebook.service.js";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

describe("Provider Abstraction & Contract", () => {
  it("GeminiProvider initializes safely without API key and reports isAvailable=false", async () => {
    const provider = new GeminiProvider({
      apiKey: "",
      model: "gemini-2.5-flash",
    });

    expect(provider.name).toBe("Gemini API");
    const available = await provider.isAvailable();
    expect(available).toBe(false);
  });

  it("OllamaProvider initializes and adheres to AIProvider contract", async () => {
    const provider = new OllamaProvider(
      "http://127.0.0.1:11434",
      "qwen2.5-coder:7b"
    );

    expect(provider.name).toBe("Local Qwen (Ollama)");
    expect(typeof provider.chat).toBe("function");
    expect(typeof provider.chatStream).toBe("function");
    expect(typeof provider.isAvailable).toBe("function");
  });

  it("GeminiProvider throws descriptive error when chat called without API key", async () => {
    const provider = new GeminiProvider({
      apiKey: "",
      model: "gemini-2.5-flash",
    });

    await expect(
      provider.chat([{ role: "user", content: "hello" }])
    ).rejects.toThrow("Gemini API is not configured. Missing GEMINI_API_KEY.");
  });

  it("GeminiProvider throws descriptive error when generateImage called without API key", async () => {
    const provider = new GeminiProvider({
      apiKey: "",
      imageModel: "imagen-3.0-generate-002",
    });

    await expect(
      provider.generateImage({ prompt: "A golden blade in the night sky" })
    ).rejects.toThrow("Gemini API is not configured. Missing GEMINI_API_KEY.");
  });
});

describe("Capability & Model Router", () => {
  it("routes web_research to Gemini when available", () => {
    const registry = new ProviderRegistry();
    const mockOllama = {
      name: "Local Qwen (Ollama)",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
    const mockGemini = {
      name: "Gemini API",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    registry.register({
      id: "qwen",
      name: "Local Qwen",
      provider: mockOllama,
      defaultModel: "qwen2.5-coder:7b",
      supportsStreaming: true,
    }, true);

    registry.register({
      id: "gemini",
      name: "Gemini",
      provider: mockGemini,
      defaultModel: "gemini-2.5-flash",
      supportsStreaming: true,
    });

    // Coding -> Ollama (Local Qwen)
    const codingDecision = registry.route("coding");
    expect(codingDecision.providerId).toBe("qwen");

    // General conversation -> Ollama (Local Qwen)
    const generalDecision = registry.route("general_conversation");
    expect(generalDecision.providerId).toBe("qwen");

    // Web research -> Gemini
    const researchDecision = registry.route("web_research");
    expect(researchDecision.providerId).toBe("gemini");

    // Image generation -> Gemini
    const imageDecision = registry.route("image_generation");
    expect(imageDecision.providerId).toBe("gemini");
  });

  it("gracefully falls back when primary capability provider is unavailable", () => {
    const registry = new ProviderRegistry();
    const mockOllama = {
      name: "Local Qwen (Ollama)",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    registry.register({
      id: "qwen",
      name: "Local Qwen",
      provider: mockOllama,
      defaultModel: "qwen2.5-coder:7b",
      supportsStreaming: true,
    }, true);

    // When web_research is requested but Gemini is not registered, falls back to default provider (qwen)
    const decision = registry.route("web_research");
    expect(decision.providerId).toBe("qwen");
  });

  it("fails privacy boundary checks when falling back for sensitive intents", () => {
    const registry = new ProviderRegistry();
    const mockQwen = {
      name: "Local Qwen",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
    const mockGemini = {
      name: "Gemini",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    registry.register({
      id: "qwen",
      name: "Local Qwen",
      provider: mockQwen,
      defaultModel: "qwen2.5-coder:7b",
      supportsStreaming: true,
    }, true);

    registry.register({
      id: "gemini",
      name: "Gemini",
      provider: mockGemini,
      defaultModel: "gemini-2.5-flash",
      supportsStreaming: true,
    });

    // If local Qwen fails on a private-only task, cloud failover must return null
    const fallbackPrivate = registry.getFallback("qwen", true);
    expect(fallbackPrivate).toBeNull();

    // If local Qwen fails on a non-private task, failover to Gemini is permitted
    const fallbackPublic = registry.getFallback("qwen", false);
    expect(fallbackPublic?.id).toBe("gemini");
  });
});

describe("Notebook Service & Multi-User Isolation", () => {
  let mockPrisma: any;
  let notebooksStore: any[] = [];

  beforeEach(() => {
    notebooksStore = [];
    mockPrisma = {
      notebook: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          const nb = {
            id: `nb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: data.title,
            description: data.description ?? null,
            documentIds: data.documentIds ?? [],
            notes: data.notes ?? [],
            userId: data.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          notebooksStore.push(nb);
          return Promise.resolve(nb);
        }),
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(notebooksStore.filter((n) => n.userId === where.userId));
        }),
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          return Promise.resolve(
            notebooksStore.find(
              (n) => n.id === where.id && (where.userId ? n.userId === where.userId : true)
            ) || null
          );
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const idx = notebooksStore.findIndex((n) => n.id === where.id);
          if (idx === -1) return Promise.resolve(null);
          notebooksStore[idx] = {
            ...notebooksStore[idx],
            ...data,
            updatedAt: new Date(),
          };
          return Promise.resolve(notebooksStore[idx]);
        }),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          const idx = notebooksStore.findIndex((n) => n.id === where.id);
          if (idx !== -1) notebooksStore.splice(idx, 1);
          return Promise.resolve({});
        }),
      },
      document: {
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          if (where?.id?.in?.includes("doc-101")) {
            return Promise.resolve([{ id: "doc-101" }]);
          }
          return Promise.resolve([]);
        }),
      },
    };
  });

  it("enforces strict data isolation between User A (Aashu) and User B (Shambhavi)", async () => {
    const service = new NotebookService(mockPrisma);

    // User A creates a notebook
    const aashuNotebook = await service.createNotebook(
      "Aashu Deep Research",
      "Private research on neural architectures",
      ["doc-aashu-1"],
      "user_aashu"
    );
    expect(aashuNotebook.id).toBeDefined();

    // User B creates a notebook
    const shambhaviNotebook = await service.createNotebook(
      "Shambhavi Project",
      "Confidential client documents",
      ["doc-shambhavi-1"],
      "user_shambhavi"
    );
    expect(shambhaviNotebook.id).toBeDefined();

    // User A can list only their notebooks
    const aashuList = await service.listNotebooks("user_aashu");
    expect(aashuList.length).toBe(1);
    expect(aashuList[0].id).toBe(aashuNotebook.id);

    // User B cannot get or read User A's notebook
    const accessAttempt = await service.getNotebook(aashuNotebook.id, "user_shambhavi");
    expect(accessAttempt).toBeNull();

    // User B cannot update User A's notebook
    const updateAttempt = await service.updateNotebook(
      aashuNotebook.id,
      { title: "Hacked title" },
      "user_shambhavi"
    );
    expect(updateAttempt).toBeNull();

    // User B cannot attach documents to User A's notebook
    const attachAttempt = await service.attachDocuments(
      aashuNotebook.id,
      ["doc-shambhavi-2"],
      "user_shambhavi"
    );
    expect(attachAttempt).toBeNull();

    // User B cannot add notes to User A's notebook
    const noteAttempt = await service.addNote(
      aashuNotebook.id,
      { title: "Intruder Note", content: "Sneaking in" },
      "user_shambhavi"
    );
    expect(noteAttempt).toBeNull();

    // User B cannot delete User A's notebook
    const deleteAttempt = await service.deleteNotebook(aashuNotebook.id, "user_shambhavi");
    expect(deleteAttempt).toBe(false);

    // Verify User A's notebook is completely unchanged
    const pristineNotebook = await service.getNotebook(aashuNotebook.id, "user_aashu");
    expect(pristineNotebook).not.toBeNull();
    expect(pristineNotebook?.title).toBe("Aashu Deep Research");
  });

  it("supports adding notes and managing documents for authorized user", async () => {
    const service = new NotebookService(mockPrisma);

    const nb = await service.createNotebook("Study Plan", "Personal notes", [], "user_aashu");

    // Add note
    const note = await service.addNote(
      nb.id,
      { title: "Chapter 1", content: "Key takeaways from chapter 1" },
      "user_aashu"
    );
    expect(note?.id).toBeDefined();
    expect(note?.title).toBe("Chapter 1");

    // Attach document
    const updatedDocs = await service.attachDocuments(nb.id, ["doc-101"], "user_aashu");
    expect(updatedDocs).toContain("doc-101");

    // Detach document
    const finalDocs = await service.detachDocument(nb.id, "doc-101", "user_aashu");
    expect(finalDocs).not.toContain("doc-101");
  });
});

describe("GET /health/providers — Zero Secret Leakage", () => {
  it("reports provider health without leaking API keys, tokens, or credentials", async () => {
    const testEnv = loadEnvironment({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test_user:super_secret_password_123@localhost:5432/test_db",
      GEMINI_API_KEY: "mock_test_token_never_leak_9876543210",
      ASHVI_LOG_LEVEL: "silent",
      GOOGLE_SEARCH_ENABLED: "true",
      LOCAL_QWEN_ENABLED: "true",
    });

    const app = buildApp(testEnv, { withDatabase: false });

    try {
      const response = await app.inject({ method: "GET", url: "/health/providers" });
      expect(response.statusCode).toBe(200);

      const json = response.json();
      expect(json.status).toBe("ok");
      expect(json.database).toBeDefined();
      expect(json.providers).toBeDefined();
      expect(json.providers.qwen).toBeDefined();
      expect(json.providers.gemini).toBeDefined();
      expect(json.providers.search).toBeDefined();
      expect(json.providers.imageGeneration).toBeDefined();

      // STRICT ZERO SECRET LEAKAGE VERIFICATION:
      const rawResponseText = response.payload;
      expect(rawResponseText).not.toContain("super_secret_password_123");
      expect(rawResponseText).not.toContain("mock_test_token_never_leak_9876543210");
      expect(rawResponseText).not.toContain("apiKey");
      expect(rawResponseText).not.toContain("password");
    } finally {
      await app.close();
    }
  });
});

