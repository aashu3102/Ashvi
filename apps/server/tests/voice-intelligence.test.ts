import { describe, expect, it } from "vitest";
import {
  BargeInService,
  PronunciationService,
  ProsodyService,
  VoiceEmotionService,
  VoiceSessionService,
  VoiceStreamService,
} from "../src/voice/index.js";

describe("Voice Intelligence Services", () => {
  describe("PronunciationService", () => {
    const service = new PronunciationService();

    it("expands technical terms and acronyms for natural speech", () => {
      const input = "We deployed PostgreSQL, Prisma, and Docker with SQL queries over SSE and REST API.";
      const prepared = service.prepareForSpeech(input, "en");

      expect(prepared).toContain("Post-gres-Q-L");
      expect(prepared).toContain("Prizma");
      expect(prepared).toContain("Docker");
      expect(prepared).toContain("sequel");
      expect(prepared).toContain("S-S-E");
      expect(prepared).toContain("rest");
      expect(prepared).toContain("A-P-I");
    });

    it("strips code blocks, inline backticks, and markdown formatting", () => {
      const input = "Here is the plan:\n```ts\nconst x = 1;\n```\nCheck `npm run dev` and **important** docs at [Ashvi](https://example.com).";
      const prepared = service.prepareForSpeech(input, "en");

      expect(prepared).not.toContain("const x = 1");
      expect(prepared).not.toContain("```");
      expect(prepared).not.toContain("`npm run dev`");
      expect(prepared).toContain("N-P-M");
      expect(prepared).toContain("important");
      expect(prepared).toContain("Ash-vee");
      expect(prepared).not.toContain("https://");
    });

    it("strips emojis cleanly", () => {
      const input = "Hello there! 🚀✨ Ashvi is ready.";
      const prepared = service.prepareForSpeech(input, "en");
      expect(prepared).toBe("Hello there! Ash-vee is ready.");
    });

    it("applies Hindi phonetics when language is hi", () => {
      const input = "namaste ji, dhanyavaad for your help.";
      const prepared = service.prepareForSpeech(input, "hi");
      expect(prepared).toContain("namaste");
      expect(prepared).toContain("dhanyawaad");
    });
  });

  describe("VoiceEmotionService", () => {
    const service = new VoiceEmotionService();

    it("detects excited emotion and raises pitch and speed", () => {
      const result = service.detectEmotion("Fantastic! Awesome work on completing the project!");
      expect(result.emotion).toBe("excited");
      expect(result.speedScale).toBeGreaterThan(1.0);
      expect(result.pitchScale).toBeGreaterThan(1.0);
    });

    it("detects concerned emotion on errors and bugs", () => {
      const result = service.detectEmotion("There is a serious bug causing the server to crash with an exception.");
      expect(["concerned", "serious"]).toContain(result.emotion);
      expect(result.speedScale).toBeLessThanOrEqual(1.0);
    });

    it("defaults to calm persona tone for neutral information", () => {
      const result = service.detectEmotion("The file has been saved to your local workspace.");
      expect(result.emotion).toBe("calm");
      expect(result.speedScale).toBe(1.0);
      expect(result.pitchScale).toBe(1.0);
    });
  });

  describe("ProsodyService", () => {
    const emotionService = new VoiceEmotionService();
    const prosodyService = new ProsodyService();

    it("computes bounded prosody parameters for technical style", () => {
      const emotion = emotionService.detectEmotion("PostgreSQL schema migration completed.");
      const params = prosodyService.calculateProsody(emotion, "technical");

      expect(params.style).toBe("technical");
      expect(params.rate).toBeGreaterThanOrEqual(0.75);
      expect(params.rate).toBeLessThanOrEqual(1.35);
      expect(params.pitch).toBeGreaterThanOrEqual(0.85);
      expect(params.pitch).toBeLessThanOrEqual(1.25);
    });

    it("computes higher speed for urgent style", () => {
      const emotion = emotionService.detectEmotion("Quick update right away!");
      const params = prosodyService.calculateProsody(emotion, "urgent");
      expect(params.rate).toBeGreaterThan(1.0);
    });
  });

  describe("VoiceStreamService (Sentence Chunker)", () => {
    const chunker = new VoiceStreamService();

    it("splits English sentences on punctuation without splitting abbreviations", () => {
      const text = "Ashvi is ready. For e.g. you can ask questions! Are you prepared? Yes.";
      const sentences = chunker.splitIntoSentences(text);

      expect(sentences.length).toBe(4);
      expect(sentences[0]).toBe("Ashvi is ready.");
      expect(sentences[1]).toContain("For e.g. you can ask questions!");
      expect(sentences[2]).toBe("Are you prepared?");
      expect(sentences[3]).toBe("Yes.");
    });

    it("handles Hindi purna viram (।) sentence boundaries", () => {
      const text = "नमस्ते, मैं अश्श्वी हूँ। आपकी क्या मदद करूँ? सब ठीक है।";
      const sentences = chunker.splitIntoSentences(text);

      expect(sentences.length).toBe(3);
      expect(sentences[0]).toBe("नमस्ते, मैं अश्श्वी हूँ।");
      expect(sentences[1]).toBe("आपकी क्या मदद करूँ?");
      expect(sentences[2]).toBe("सब ठीक है।");
    });

    it("emits sentence chunks progressively from an async token stream", async () => {
      async function* generateTokens() {
        yield "Hello";
        yield " user.";
        yield " How";
        yield " are";
        yield " you";
        yield " doing";
        yield " today?";
        yield " All";
        yield " is";
        yield " fine.";
      }

      const chunks: string[] = [];
      for await (const chunk of chunker.processTokenStream(generateTokens())) {
        chunks.push(chunk.text);
      }

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0]).toContain("Hello user.");
      expect(chunks[chunks.length - 1]).toContain("fine.");
    });
  });

  describe("BargeInService", () => {
    it("manages session tokens and triggers cancellation on interruption", () => {
      const bargeIn = new BargeInService();
      const session = bargeIn.registerSession("sess-1");

      expect(bargeIn.isInterrupted("sess-1", session.token)).toBe(false);
      expect(session.abortSignal.aborted).toBe(false);

      const event = bargeIn.interrupt("sess-1", "user_spoke");
      expect(event.sessionId).toBe("sess-1");
      expect(bargeIn.isInterrupted("sess-1", session.token)).toBe(true);
      expect(session.abortSignal.aborted).toBe(true);
    });
  });

  describe("VoiceSessionService", () => {
    it("transitions through valid voice lifecycle states", () => {
      const sm = new VoiceSessionService();
      const sess = sm.getOrCreateSession("sess-2");

      expect(sess.state).toBe("IDLE");

      sm.transition("sess-2", "LISTENING");
      expect(sm.getSession("sess-2")?.state).toBe("LISTENING");

      sm.transition("sess-2", "TRANSCRIBING");
      expect(sm.getSession("sess-2")?.state).toBe("TRANSCRIBING");

      sm.transition("sess-2", "THINKING");
      expect(sm.getSession("sess-2")?.state).toBe("THINKING");

      sm.transition("sess-2", "SPEAKING");
      expect(sm.getSession("sess-2")?.state).toBe("SPEAKING");

      sm.transition("sess-2", "IDLE");
      expect(sm.getSession("sess-2")?.state).toBe("IDLE");
    });

    it("allows interruption from active speaking state", () => {
      const sm = new VoiceSessionService();
      sm.getOrCreateSession("sess-3");
      sm.transition("sess-3", "LISTENING");
      sm.transition("sess-3", "TRANSCRIBING");
      sm.transition("sess-3", "THINKING");
      sm.transition("sess-3", "SPEAKING");

      sm.transition("sess-3", "INTERRUPTED");
      expect(sm.getSession("sess-3")?.state).toBe("INTERRUPTED");

      sm.transition("sess-3", "IDLE");
      expect(sm.getSession("sess-3")?.state).toBe("IDLE");
    });

    it("rejects illegal state transitions", () => {
      const sm = new VoiceSessionService();
      sm.getOrCreateSession("sess-4");
      // Cannot jump directly from IDLE to SPEAKING
      expect(() => sm.transition("sess-4", "SPEAKING")).toThrow(/Invalid state transition/);
    });
  });
});
