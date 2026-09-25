import { describe, expect, it, vi, beforeEach } from "vitest";
import { NVIDIAProvider } from "../src/ai/nvidia.provider.js";
import { ProviderRegistry } from "../src/orchestrator/model-router.js";
import { NotebookService } from "../src/services/notebook.service.js";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

describe("Provider Abstraction & Contract", () => {
  it("NVIDIAProvider initializes safely without API key and reports isAvailable=false", async () => {
    const provider = new NVIDIAProvider({
      apiKey: "",
      defaultModel: "nvidia/nemotron-3-ultra-550b-a55b",
    });

    expect(provider.name).toBe("NVIDIA Nemotron");
    const available = await provider.isAvailable();
    expect(available).toBe(false);
  });

  it("NVIDIAProvider initializes with API key and implements AIProvider contract", async () => {
    const provider = new NVIDIAProvider({
      apiKey: "test-nvidia-key",
      defaultModel: "nvidia/nemotron-3-ultra-550b-a55b",
    });

    expect(provider.name).toBe("NVIDIA Nemotron");
    expect(typeof provider.chat).toBe("function");
    expect(typeof provider.chatStream).toBe("function");
    expect(typeof provider.isAvailable).toBe("function");
  });

  it("NVIDIAProvider throws descriptive error when chat called without API key", async () => {
    const provider = new NVIDIAProvider({
      apiKey: "",
      defaultModel: "nvidia/nemotron-3-ultra-550b-a55b",
    });

    await expect(
      provider.chat([{ role: "user", content: "hello" }])
    ).rejects.toThrow("NVIDIA Nemotron API is not configured. Missing NVIDIA_API_KEY.");
  });

  it("NVIDIAProvider throws descriptive error when generateImage called without API key", async () => {
    const provider = new NVIDIAProvider({
      apiKey: "",
      defaultModel: "nvidia/nemotron-3-ultra-550b-a55b",
    });

    await expect(
      provider.generateImage({ prompt: "A golden blade in the night sky" })
    ).rejects.toThrow("Image generation is not supported by NVIDIA Nemotron provider.");
  });

  it("NVIDIAProvider throws descriptive error when chatStream called without API key", async () => {
    const provider = new NVIDIAProvider({
      apiKey: "",
      defaultModel: "nvidia/nemotron-3-ultra-550b-a55b",
    });

    const stream = provider.chatStream([{ role: "user", content: "hello" }]);
    await expect(async () => {
      for await (const _ of stream) {
        // should not reach here
      }
    }).rejects.toThrow("NVIDIA Nemotron API is not configured. Missing NVIDIA_API_KEY.");
  });
});

describe("Capability & Model Router", () => {
  it("routes to default provider when registered", () => {
    const registry = new ProviderRegistry();
    const mockProvider = {
      name: "Mock Provider",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    registry.register({
      id: "mock",
      name: "Mock Provider",
      provider: mockProvider as any,
      defaultModel: "mock-model",
      supportsStreaming: true,
    }, true);

    const decision = registry.route("general_conversation");
    expect(decision.providerId).toBe("mock");
    expect(decision.model).toBe("mock-model");
  });

  it("routes to explicitly requested provider", () => {
    const registry = new ProviderRegistry();
    const mockProvider1 = {
      name: "Mock Provider 1",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
    const mockProvider2 = {
      name: "Mock Provider 2",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    registry.register({
      id: "provider-1",
      name: "Mock Provider 1",
      provider: mockProvider1 as any,
      defaultModel: "model-1",
      supportsStreaming: true,
    }, true);

    registry.register({
      id: "provider-2",
      name: "Mock Provider 2",
      provider: mockProvider2 as any,
      defaultModel: "model-2",
      supportsStreaming: true,
    });

    const decision = registry.route("general_conversation", "provider-2");
    expect(decision.providerId).toBe("provider-2");
    expect(decision.model).toBe("model-2");
  });

  it("returns NoopAIProvider when no provider is registered", () => {
    const registry = new ProviderRegistry();

    const decision = registry.route("general_conversation");
    expect(decision.providerId).toBe("none");
    expect(decision.provider.name).toBe("No AI Provider");
    expect(decision.reason).toContain("No AI provider configured");
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
      NVIDIA_API_KEY: "mock_test_token_never_leak_9876543210",
      ASHVI_LOG_LEVEL: "silent",
    });

    const app = buildApp(testEnv, { withDatabase: false });

    try {
      const response = await app.inject({ method: "GET", url: "/health/providers" });
      expect(response.statusCode).toBe(200);

      const json = response.json();
      expect(json.status).toBe("ok");
      expect(json.database).toBeDefined();
      expect(json.providers).toBeDefined();
      expect(json.providers.ai).toBeDefined();
      expect(json.providers.ai.configured).toBe(true);
      expect(json.providers.ai.provider).toBe("NVIDIA Nemotron");
      expect(json.providers.ai.model).toBe("nvidia/nemotron-3-ultra-550b-a55b");

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

