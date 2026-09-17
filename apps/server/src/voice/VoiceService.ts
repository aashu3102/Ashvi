import type { Environment } from "../config/env.js";
import type { AshviOrchestrator } from "../orchestrator/index.js";
import { BargeInService } from "./BargeInService.js";
import { PronunciationService } from "./PronunciationService.js";
import { ProsodyService, type ProsodyParameters } from "./ProsodyService.js";
import { WhisperProvider } from "./providers/stt/WhisperProvider.js";
import type { STTProvider, STTResult } from "./providers/stt/STTProvider.js";
import { PiperProvider } from "./providers/tts/PiperProvider.js";
import type { AudioResult, TTSOptions, TTSProvider } from "./providers/tts/TTSProvider.js";
import {
  ASHVI_VOICE_PROFILE,
  type VoiceLanguage,
  type VoicePersonaTone,
  type VoiceProfile,
  type VoiceSpeakingStyle,
} from "./VoiceConfig.js";
import { VoiceEmotionService } from "./VoiceEmotionService.js";
import { VoiceSessionService, type VoiceSessionInfo } from "./VoiceSessionService.js";
import { VoiceStreamService } from "./VoiceStreamService.js";

export interface VoiceServiceDependencies {
  environment: Environment;
  sttProvider?: STTProvider;
  ttsProvider?: TTSProvider;
  orchestrator?: AshviOrchestrator;
}

export interface VoiceTurnOptions {
  sessionId: string;
  userId?: string;
  conversationId?: string;
  audio?: Buffer;
  filename?: string;
  text?: string;
  language?: VoiceLanguage;
  speakingStyle?: VoiceSpeakingStyle;
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  documentContext?: string;
  memoryContext?: string;
  onTranscript?: (transcript: string) => Promise<void>;
  contextLoader?: (transcript: string) => Promise<{ documentContext?: string; memoryContext?: string }>;
}

export interface VoiceTurnResult {
  sessionId: string;
  transcript: string;
  responseText: string;
  audio: Buffer;
  contentType: string;
  emotion: VoicePersonaTone;
  prosody: ProsodyParameters;
  durationMs: number;
}

export type VoiceStreamEvent =
  | { type: "state"; state: string; sessionId: string }
  | { type: "transcript"; text: string; language: VoiceLanguage; sessionId: string }
  | { type: "thinking"; sessionId: string }
  | {
      type: "sentence_audio";
      index: number;
      text: string;
      audioBase64: string;
      contentType: string;
      emotion: VoicePersonaTone;
      rate: number;
      pitch: number;
      isLast: boolean;
      sessionId: string;
    }
  | { type: "interrupted"; sessionId: string }
  | { type: "done"; fullText: string; totalSentences: number; sessionId: string }
  | { type: "error"; message: string; sessionId: string };

export class VoiceService {
  public readonly stt: STTProvider;
  public readonly tts: TTSProvider;
  public readonly pronunciation: PronunciationService;
  public readonly emotion: VoiceEmotionService;
  public readonly prosody: ProsodyService;
  public readonly streamChunker: VoiceStreamService;
  public readonly bargeIn: BargeInService;
  public readonly sessionManager: VoiceSessionService;
  private orchestrator?: AshviOrchestrator;

  constructor(dependencies: VoiceServiceDependencies) {
    this.stt = dependencies.sttProvider ?? new WhisperProvider(dependencies.environment);
    this.tts = dependencies.ttsProvider ?? new PiperProvider(dependencies.environment);
    this.pronunciation = new PronunciationService();
    this.emotion = new VoiceEmotionService();
    this.prosody = new ProsodyService();
    this.streamChunker = new VoiceStreamService();
    this.bargeIn = new BargeInService();
    this.sessionManager = new VoiceSessionService();
    this.orchestrator = dependencies.orchestrator;
  }

  setOrchestrator(orchestrator: AshviOrchestrator) {
    this.orchestrator = orchestrator;
  }

  getVoiceProfile(): VoiceProfile {
    return { ...ASHVI_VOICE_PROFILE };
  }

  getSession(sessionId: string): VoiceSessionInfo | undefined {
    return this.sessionManager.getSession(sessionId);
  }

  async transcribe(audio: Buffer, filename: string = "recording.webm", language: VoiceLanguage = "en"): Promise<STTResult> {
    return this.stt.transcribe({ buffer: audio, filename }, language);
  }

  async synthesize(text: string, options?: TTSOptions): Promise<AudioResult> {
    const language = options?.language ?? "en";
    const preparedText = this.pronunciation.prepareForSpeech(text, language);
    const emotionResult = this.emotion.detectEmotion(text);
    const prosody = this.prosody.calculateProsody(emotionResult, options?.style);

    return this.tts.synthesize(preparedText, {
      language,
      rate: options?.rate ?? prosody.rate,
      pitch: options?.pitch ?? prosody.pitch,
      emotion: prosody.emotion,
      style: prosody.style,
    });
  }

  interrupt(sessionId: string): void {
    this.bargeIn.interrupt(sessionId);
    this.sessionManager.transition(sessionId, "INTERRUPTED");
  }

  async processVoiceTurn(options: VoiceTurnOptions): Promise<VoiceTurnResult> {
    const startTime = Date.now();
    const { sessionId, userId, language = "en" } = options;
    const { token } = this.bargeIn.registerSession(sessionId);

    this.sessionManager.getOrCreateSession(sessionId, userId);

    let transcript = options.text?.trim() ?? "";

    if (!transcript && options.audio) {
      console.log(`[VOICE DEBUG] mic_status=captured audio_bytes=${options.audio.length} filename=${options.filename || "speech.webm"}`);
      this.sessionManager.transition(sessionId, "TRANSCRIBING");
      const sttStartTime = Date.now();
      try {
        const sttResult = await this.stt.transcribe({ buffer: options.audio, filename: options.filename }, language);
        transcript = sttResult.text;
        const sttDuration = Date.now() - sttStartTime;
        console.log(`[VOICE DEBUG] stt_status=success transcript="${transcript}" duration_ms=${sttDuration}`);
      } catch (sttErr) {
        const msg = sttErr instanceof Error ? sttErr.message : "Transcription failed";
        console.error(`[VOICE DEBUG] stt_status=error message="${msg}"`);
        this.sessionManager.transition(sessionId, "ERROR", msg);
        throw sttErr;
      }
    }

    if (!transcript) {
      this.sessionManager.transition(sessionId, "ERROR", "No speech could be recognized.");
      throw new Error("No speech or text provided for voice turn.");
    }

    if (options.onTranscript) {
      await options.onTranscript(transcript).catch(() => {});
    }

    let docContext = options.documentContext;
    let memContext = options.memoryContext;
    if (options.contextLoader) {
      try {
        const loaded = await options.contextLoader(transcript);
        if (loaded.documentContext) docContext = loaded.documentContext;
        if (loaded.memoryContext) memContext = loaded.memoryContext;
      } catch {
        // Fallback gracefully
      }
    }

    if (this.bargeIn.isInterrupted(sessionId, token)) {
      this.sessionManager.transition(sessionId, "INTERRUPTED");
      throw new Error("Voice turn was interrupted by user.");
    }

    // Thinking phase
    this.sessionManager.transition(sessionId, "THINKING");

    let responseText = "";
    const orchStartTime = Date.now();
    if (this.orchestrator) {
      try {
        const task = await this.orchestrator.execute({
          requestId: `voice-${sessionId}-${Date.now()}`,
          userId,
          conversationId: options.conversationId ?? `voice-${sessionId}`,
          prompt: transcript,
          messages: options.messages ?? [],
          documentContext: docContext,
          memoryContext: memContext,
        });
        responseText = task.result?.content ?? "I am here with you.";
        const orchDuration = Date.now() - orchStartTime;
        console.log(`[VOICE DEBUG] orchestrator_status=success response_chars=${responseText.length} duration_ms=${orchDuration}`);
      } catch (orchErr) {
        const msg = orchErr instanceof Error ? orchErr.message : "Orchestration error";
        console.error(`[VOICE DEBUG] orchestrator_status=error message="${msg}"`);
        responseText = "I encountered an issue processing your request.";
      }
    } else {
      responseText = `I heard: ${transcript}`;
      console.log(`[VOICE DEBUG] orchestrator_status=fallback response_chars=${responseText.length}`);
    }

    if (this.bargeIn.isInterrupted(sessionId, token)) {
      this.sessionManager.transition(sessionId, "INTERRUPTED");
      throw new Error("Voice turn was interrupted during thinking.");
    }

    // Synthesis phase
    this.sessionManager.transition(sessionId, "SPEAKING");
    const emotionResult = this.emotion.detectEmotion(responseText);
    const prosody = this.prosody.calculateProsody(emotionResult, options.speakingStyle);
    const preparedText = this.pronunciation.prepareForSpeech(responseText, language);

    const ttsStartTime = Date.now();
    const audioResult = await this.tts.synthesize(preparedText, {
      language,
      rate: prosody.rate,
      pitch: prosody.pitch,
      emotion: prosody.emotion,
      style: prosody.style,
    });
    const ttsDuration = Date.now() - ttsStartTime;
    console.log(`[VOICE DEBUG] tts_status=success audio_bytes=${audioResult.audio.length} duration_ms=${ttsDuration}`);

    this.sessionManager.transition(sessionId, "IDLE");

    return {
      sessionId,
      transcript,
      responseText,
      audio: audioResult.audio,
      contentType: audioResult.contentType,
      emotion: prosody.emotion,
      prosody,
      durationMs: Date.now() - startTime,
    };
  }

  async *streamVoiceTurn(options: VoiceTurnOptions): AsyncGenerator<VoiceStreamEvent> {
    const { sessionId, userId, language = "en" } = options;
    const { token } = this.bargeIn.registerSession(sessionId);

    this.sessionManager.getOrCreateSession(sessionId, userId);

    let transcript = options.text?.trim() ?? "";

    if (!transcript && options.audio) {
      console.log(`[VOICE DEBUG] mic_status=captured audio_bytes=${options.audio.length} filename=${options.filename || "speech.webm"}`);
      this.sessionManager.transition(sessionId, "TRANSCRIBING");
      yield { type: "state", state: "TRANSCRIBING", sessionId };

      const sttStartTime = Date.now();
      try {
        const sttResult = await this.stt.transcribe({ buffer: options.audio, filename: options.filename }, language);
        transcript = sttResult.text;
        const sttDuration = Date.now() - sttStartTime;
        console.log(`[VOICE DEBUG] stt_status=success transcript="${transcript}" duration_ms=${sttDuration}`);
      } catch (sttErr) {
        const msg = sttErr instanceof Error ? sttErr.message : "Transcription failed";
        console.error(`[VOICE DEBUG] stt_status=error message="${msg}"`);
        this.sessionManager.transition(sessionId, "ERROR", msg);
        yield { type: "error", message: "Speech recognition failed.", sessionId };
        return;
      }
    }

    if (!transcript) {
      this.sessionManager.transition(sessionId, "ERROR", "No speech detected");
      yield { type: "error", message: "No speech recognized.", sessionId };
      return;
    }

    if (options.onTranscript) {
      await options.onTranscript(transcript).catch(() => {});
    }

    yield { type: "transcript", text: transcript, language, sessionId };

    let docContext = options.documentContext;
    let memContext = options.memoryContext;
    if (options.contextLoader) {
      try {
        const loaded = await options.contextLoader(transcript);
        if (loaded.documentContext) docContext = loaded.documentContext;
        if (loaded.memoryContext) memContext = loaded.memoryContext;
      } catch {
        // Fallback gracefully
      }
    }

    if (this.bargeIn.isInterrupted(sessionId, token)) {
      this.sessionManager.transition(sessionId, "INTERRUPTED");
      yield { type: "interrupted", sessionId };
      return;
    }

    // Thinking state
    this.sessionManager.transition(sessionId, "THINKING");
    yield { type: "state", state: "THINKING", sessionId };
    yield { type: "thinking", sessionId };

    let fullResponseText = "";
    const orchStartTime = Date.now();
    if (this.orchestrator) {
      try {
        const task = await this.orchestrator.execute({
          requestId: `voice-stream-${sessionId}-${Date.now()}`,
          userId,
          conversationId: options.conversationId ?? `voice-${sessionId}`,
          prompt: transcript,
          messages: options.messages ?? [],
          documentContext: docContext,
          memoryContext: memContext,
        });
        fullResponseText = task.result?.content ?? "I am here with you.";
        const orchDuration = Date.now() - orchStartTime;
        console.log(`[VOICE DEBUG] orchestrator_status=success response_chars=${fullResponseText.length} duration_ms=${orchDuration}`);
      } catch (orchErr) {
        const msg = orchErr instanceof Error ? orchErr.message : "Orchestration error";
        console.error(`[VOICE DEBUG] orchestrator_status=error message="${msg}"`);
        fullResponseText = "I encountered an issue processing your request.";
      }
    } else {
      fullResponseText = `I heard: ${transcript}`;
      console.log(`[VOICE DEBUG] orchestrator_status=fallback response_chars=${fullResponseText.length}`);
    }

    if (this.bargeIn.isInterrupted(sessionId, token)) {
      this.sessionManager.transition(sessionId, "INTERRUPTED");
      yield { type: "interrupted", sessionId };
      return;
    }

    // Sentence-aware streaming synthesis
    this.sessionManager.transition(sessionId, "SPEAKING");
    yield { type: "state", state: "SPEAKING", sessionId };

    const sentences = this.streamChunker.splitIntoSentences(fullResponseText);
    let sentenceIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      if (this.bargeIn.isInterrupted(sessionId, token)) {
        this.sessionManager.transition(sessionId, "INTERRUPTED");
        yield { type: "interrupted", sessionId };
        return;
      }

      const sentenceText = sentences[i];
      const isLast = i === sentences.length - 1;

      const emotionResult = this.emotion.detectEmotion(sentenceText);
      const prosody = this.prosody.calculateProsody(emotionResult, options.speakingStyle);
      const preparedSentence = this.pronunciation.prepareForSpeech(sentenceText, language);

      try {
        const chunkStartTime = Date.now();
        const audioResult = await this.tts.synthesize(preparedSentence, {
          language,
          rate: prosody.rate,
          pitch: prosody.pitch,
          emotion: prosody.emotion,
          style: prosody.style,
        });
        const chunkDuration = Date.now() - chunkStartTime;
        console.log(`[VOICE DEBUG] tts_status=success chunk_index=${sentenceIndex} audio_bytes=${audioResult.audio.length} duration_ms=${chunkDuration}`);

        yield {
          type: "sentence_audio",
          index: sentenceIndex++,
          text: sentenceText,
          audioBase64: audioResult.audio.toString("base64"),
          contentType: audioResult.contentType,
          emotion: prosody.emotion,
          rate: prosody.rate,
          pitch: prosody.pitch,
          isLast,
          sessionId,
        };
      } catch (ttsErr) {
        const msg = ttsErr instanceof Error ? ttsErr.message : "TTS chunk error";
        console.error(`[VOICE DEBUG] tts_status=error chunk_index=${sentenceIndex} message="${msg}"`);
        continue;
      }
    }

    this.sessionManager.transition(sessionId, "IDLE");
    yield { type: "state", state: "IDLE", sessionId };
    yield { type: "done", fullText: fullResponseText, totalSentences: sentenceIndex, sessionId };
  }
}
