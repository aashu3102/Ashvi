"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBaseUrl, getAuthHeaders } from "./api";

export type VoiceState =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "error";

export type VoiceLanguage = "en" | "hi";

interface UseAshviVoiceOptions {
  conversationId?: string | null;
  onTranscript?: (transcript: string) => void;
  onAssistantResponse?: (text: string) => void;
  onError?: (errorMessage: string) => void;
}

export function useAshviVoice(options: UseAshviVoiceOptions = {}) {
  const base = getApiBaseUrl();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>("en");
  const [voiceError, setVoiceError] = useState<string>("" );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentSessionIdRef = useRef<string>("");
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<Array<{ url: string; text?: string }>>([]);
  const isPlayingRef = useRef<boolean>(false);
  const playNextInQueueRef = useRef<() => void>(() => {});

  // Initialize audio element and queue dispatcher
  useEffect(() => {
    if (typeof window !== "undefined") {
      const audio = new Audio();
      audioPlayerRef.current = audio;

      const playNextInQueue = () => {
        if (audioQueueRef.current.length === 0) {
          isPlayingRef.current = false;
          setVoiceState((prev) => (prev === "speaking" ? "idle" : prev));
          return;
        }

        isPlayingRef.current = true;
        setVoiceState("speaking");
        const next = audioQueueRef.current.shift();
        if (!next) {
          isPlayingRef.current = false;
          return;
        }

        audio.src = next.url;
        audio.onended = () => {
          console.log(`[VOICE DEBUG] playback_ended=true url=${next.url}`);
          URL.revokeObjectURL(next.url);
          playNextInQueue();
        };
        audio.onerror = (e) => {
          console.error("[VOICE DEBUG] playback_error=", e);
          URL.revokeObjectURL(next.url);
          playNextInQueue();
        };
        console.log(`[VOICE DEBUG] playback_started=true format=audio/wav text=${JSON.stringify(next.text || "")}`);
        audio.play().catch((err) => {
          console.error("[VOICE DEBUG] audio_play_rejected=", err);
          setVoiceError("Browser audio playback was blocked. Please interact with the page first.");
          playNextInQueue();
        });
      };

      playNextInQueueRef.current = playNextInQueue;

      return () => {
        audio.pause();
        audioQueueRef.current.forEach((item) => URL.revokeObjectURL(item.url));
        audioQueueRef.current = [];
      };
    }
  }, []);

  const queueAudioChunk = useCallback((blob: Blob, text?: string) => {
    const url = URL.createObjectURL(blob);
    audioQueueRef.current.push({ url, text });

    if (!isPlayingRef.current && audioPlayerRef.current) {
      playNextInQueueRef.current();
    }
  }, []);

  const stopAudioPlayback = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    audioQueueRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  // Barge-In: Interrupt current playback & remote synthesis
  const interrupt = useCallback(async () => {
    stopAudioPlayback();
    setVoiceState("interrupted");

    const sessionId = currentSessionIdRef.current;
    if (!sessionId) return;

    try {
      await fetch(`${base}/api/voice/interrupt`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ sessionId, reason: "user_spoke" }),
      });
    } catch {
      // Ignored if network dropped
    }
  }, [base, stopAudioPlayback]);

  // Start recording user speech
  const startListening = useCallback(async () => {
    // If currently speaking, interrupt first
    if (isPlayingRef.current || voiceState === "speaking") {
      await interrupt();
    }

    // Prime HTMLAudioElement inside user gesture to satisfy browser autoplay policies
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        await audioPlayerRef.current.play().catch(() => {});
        console.log("[VOICE DEBUG] audio_element_primed=true");
      } catch {
        // Continue even if priming test fails
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      currentSessionIdRef.current = `voice-${Date.now()}`;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setVoiceState("listening");
      setVoiceError("");
      console.log("[VOICE DEBUG] mic_status=recording");
    } catch (err) {
      console.error("[VOICE DEBUG] mic_access_failed=", err);
      setVoiceError("Microphone access could not be initialized.");
      setVoiceState("error");
    }
  }, [interrupt, voiceState]);

  // Stop recording and stream the voice turn
  const stopListeningAndProcess = useCallback(async () => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;

    return new Promise<void>((resolve) => {
      const recorder = recorderRef.current!;

      recorder.onstop = async () => {
        const tracks = recorder.stream?.getTracks() ?? [];
        tracks.forEach((t) => t.stop());

        const mime = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        audioChunksRef.current = [];

        console.log(`[VOICE DEBUG] mic_status=captured audio_bytes=${audioBlob.size} mime=${mime}`);
        setVoiceState("transcribing");

        try {
          const form = new FormData();
          const filename = mime.includes("webm") ? "speech.webm" : mime.includes("ogg") ? "speech.ogg" : "speech.wav";
          form.append("audio", audioBlob, filename);
          form.append("language", voiceLanguage);
          form.append("sessionId", currentSessionIdRef.current || `voice-${Date.now()}`);
          if (options.conversationId) {
            form.append("conversationId", options.conversationId);
          }

          const response = await fetch(`${base}/api/voice/conversation/stream`, {
            method: "POST",
            credentials: "include",
            headers: getAuthHeaders(),
            body: form,
          });

          if (!response.ok) {
            throw new Error("Voice processing is currently unavailable.");
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("Could not initialize voice stream reader.");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;
              try {
                const event = JSON.parse(trimmed.replace(/^data: /, ""));
                if (event.type === "state") {
                  const s = event.state.toLowerCase() as VoiceState;
                  setVoiceState(s);
                } else if (event.type === "transcript") {
                  console.log(`[VOICE DEBUG] stt_status=success transcript="${event.text}"`);
                  options.onTranscript?.(event.text);
                } else if (event.type === "sentence_audio" && event.audioBase64) {
                  const binaryStr = atob(event.audioBase64);
                  const len = binaryStr.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                  }
                  const chunkBlob = new Blob([bytes], { type: event.contentType || "audio/wav" });
                  console.log(`[VOICE DEBUG] tts_status=success chunk_index=${event.index} audio_bytes=${chunkBlob.size}`);
                  queueAudioChunk(chunkBlob, event.text);
                } else if (event.type === "done") {
                  console.log(`[VOICE DEBUG] turn_done=true full_text_length=${event.fullText?.length}`);
                  options.onAssistantResponse?.(event.fullText);
                } else if (event.type === "interrupted") {
                  stopAudioPlayback();
                  setVoiceState("interrupted");
                } else if (event.type === "error") {
                  console.error(`[VOICE DEBUG] voice_event_error=${event.message}`);
                  setVoiceError(event.message);
                  setVoiceState("error");
                }
              } catch {
                // Ignore parse errors on malformed chunks
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Voice processing failed.";
          console.error(`[VOICE DEBUG] voice_processing_error=${msg}`);
          setVoiceError(msg);
          setVoiceState("error");
          options.onError?.(msg);
        } finally {
          resolve();
        }
      };

      recorder.stop();
    });
  }, [base, options, queueAudioChunk, stopAudioPlayback, voiceLanguage]);

  // Direct TTS playback of a text response
  const speakText = useCallback(
    async (text: string) => {
      stopAudioPlayback();
      setVoiceState("speaking");
      try {
        const res = await fetch(`${base}/api/voice/synthesize`, {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ text, language: voiceLanguage }),
        });

        if (!res.ok) throw new Error("Speech synthesis is unavailable.");
        const blob = await res.blob();
        queueAudioChunk(blob, text);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Speech synthesis failed.";
        setVoiceError(msg);
        setVoiceState("error");
      }
    },
    [base, queueAudioChunk, stopAudioPlayback, voiceLanguage],
  );

  const toggleListening = useCallback(async () => {
    if (voiceState === "listening") {
      await stopListeningAndProcess();
    } else {
      await startListening();
    }
  }, [startListening, stopListeningAndProcess, voiceState]);

  return {
    voiceState,
    voiceLanguage,
    setVoiceLanguage,
    voiceError,
    isListening: voiceState === "listening",
    isSpeaking: voiceState === "speaking",
    startListening,
    stopListeningAndProcess,
    toggleListening,
    interrupt,
    speakText,
    stopAudioPlayback,
  };
}
