"use client";

import { useEffect, useRef } from "react";
import { X, Volume2, Sparkles, Send, Mic, Square } from "lucide-react";
import type { VoiceLanguage, VoiceState } from "@/lib/use-ashvi-voice";

export type ChatMessage = {
  id: string;
  role: string;
  content: string;
};

interface Props {
  conversationId: string;
  title: string;
  messages: ChatMessage[];
  streamText: string;
  isStreaming: boolean;
  error?: string;
  voiceState?: VoiceState;
  voiceLanguage?: VoiceLanguage;
  onSetVoiceLanguage?: (lang: VoiceLanguage) => void;
  onToggleVoice?: () => void;
  onInterrupt?: () => void;
  onClose: () => void;
  onSendMessage: (text: string) => void;
  onSpeak?: (text: string) => void;
}

export function ActiveChatModal({
  title,
  messages,
  streamText,
  isStreaming,
  error,
  voiceState = "idle",
  voiceLanguage = "en",
  onSetVoiceLanguage,
  onToggleVoice,
  onInterrupt,
  onClose,
  onSendMessage,
  onSpeak,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamText]);

  const getVoiceBadge = () => {
    switch (voiceState) {
      case "listening":
        return { label: "Listening...", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" };
      case "transcribing":
        return { label: "Transcribing...", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)" };
      case "thinking":
        return { label: "Thinking...", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" };
      case "speaking":
        return { label: "Ashvi Speaking...", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" };
      case "interrupted":
        return { label: "Interrupted", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" };
      default:
        return null;
    }
  };

  const badge = getVoiceBadge();

  return (
    <div
      className="ashvi-chat-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(4, 7, 13, 0.75)",
        backdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="ashvi-chat-window"
        style={{
          width: "100%",
          maxWidth: "840px",
          height: "82vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "18px",
          background: "linear-gradient(165deg, rgba(14, 21, 34, 0.94) 0%, rgba(8, 12, 20, 0.96) 100%)",
          border: "1px solid rgba(126, 232, 250, 0.28)",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.8), 0 0 30px rgba(126, 232, 250, 0.12)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Sparkles size={16} style={{ color: "#7ee8fa" }} />
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#f6efe2" }}>
                {title || "Ashvi Living Intelligence"}
              </h3>
              <span style={{ fontSize: "10px", color: "#8fa0b5" }}>Encrypted Neural Channel</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {badge && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "12px",
                  background: badge.bg,
                  border: `1px solid ${badge.color}40`,
                  fontSize: "11px",
                  color: badge.color,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: badge.color,
                    boxShadow: `0 0 8px ${badge.color}`,
                  }}
                />
                {badge.label}
              </div>
            )}

            {/* Barge-In Stop Button */}
            {voiceState === "speaking" && onInterrupt && (
              <button
                type="button"
                onClick={onInterrupt}
                className="ashvi-utility-btn"
                style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }}
                title="Barge-in: Stop voice playback"
                aria-label="Stop speech"
              >
                <Square size={14} />
              </button>
            )}

            {/* Voice Language Toggle */}
            {onSetVoiceLanguage && (
              <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <button
                  type="button"
                  onClick={() => onSetVoiceLanguage("en")}
                  style={{
                    padding: "3px 8px",
                    fontSize: "10px",
                    fontWeight: 600,
                    background: voiceLanguage === "en" ? "rgba(126, 232, 250, 0.2)" : "transparent",
                    color: voiceLanguage === "en" ? "#7ee8fa" : "#8fa0b5",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onSetVoiceLanguage("hi")}
                  style={{
                    padding: "3px 8px",
                    fontSize: "10px",
                    fontWeight: 600,
                    background: voiceLanguage === "hi" ? "rgba(126, 232, 250, 0.2)" : "transparent",
                    color: voiceLanguage === "hi" ? "#7ee8fa" : "#8fa0b5",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  HI
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="ashvi-utility-btn"
              aria-label="Close conversation"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {messages.length === 0 && !streamText && (
            <div
              style={{
                margin: "auto",
                textAlign: "center",
                color: "#8fa0b5",
                fontSize: "13px",
                maxWidth: "340px",
                lineHeight: "1.6",
              }}
            >
              <Sparkles size={24} style={{ color: "#7ee8fa", margin: "0 auto 12px", opacity: 0.8 }} />
              <p style={{ margin: 0, color: "#f6efe2", fontWeight: 500 }}>Secure Private Channel Ready</p>
              <p style={{ margin: "6px 0 0", fontSize: "12px" }}>
                Ask Ashvi code, technical architecture, reasoning, or tap the microphone to speak naturally.
              </p>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  padding: "12px 16px",
                  borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                  background: isUser ? "linear-gradient(135deg, #1e3a5f 0%, #152943 100%)" : "rgba(14, 22, 35, 0.85)",
                  border: isUser ? "1px solid rgba(147, 197, 253, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
                  color: "#f6efe2",
                  fontSize: "13.5px",
                  lineHeight: "1.5",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", gap: "10px" }}>
                  <span style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: isUser ? "#93c5fd" : "#7ee8fa" }}>
                    {isUser ? "You" : "Ashvi"}
                  </span>
                  {!isUser && onSpeak && (
                    <button
                      type="button"
                      onClick={() => onSpeak(m.content)}
                      style={{ background: "transparent", border: "none", color: "#8fa0b5", cursor: "pointer", padding: 0 }}
                      title="Speak response"
                    >
                      <Volume2 size={13} />
                    </button>
                  )}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            );
          })}

          {error && (
            <div role="alert" style={{ color: "#fca5a5", fontSize: "13px" }}>
              {error}
            </div>
          )}

          {streamText && (
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "80%",
                padding: "12px 16px",
                borderRadius: "14px 14px 14px 2px",
                background: "rgba(18, 26, 40, 0.85)",
                border: "1px solid rgba(126, 232, 250, 0.3)",
                color: "#f6efe2",
                fontSize: "13.5px",
                lineHeight: "1.5",
                boxShadow: "0 4px 20px rgba(126, 232, 250, 0.15)",
              }}
            >
              <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#7ee8fa", marginBottom: "4px" }}>
                Ashvi {isStreaming && "• Generating..."}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{streamText}</div>
            </div>
          )}
        </div>

        {/* Input Dock */}
        <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(6, 10, 16, 0.7)" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem("chatInput") as HTMLInputElement;
              if (input && input.value.trim()) {
                onSendMessage(input.value.trim());
                input.value = "";
              }
            }}
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
          >
            <input
              name="chatInput"
              type="text"
              placeholder="Continue thoughts with Ashvi..."
              autoComplete="off"
              style={{
                flex: 1,
                height: "44px",
                padding: "0 16px",
                borderRadius: "24px",
                background: "rgba(12, 18, 28, 0.8)",
                border: "1px solid rgba(126, 232, 250, 0.2)",
                color: "#f6efe2",
                fontSize: "13px",
                outline: "none",
              }}
            />

            {onToggleVoice && (
              <button
                type="button"
                onClick={onToggleVoice}
                className={`ashvi-utility-btn ${voiceState === "listening" ? "is-recording" : ""}`}
                style={{
                  height: "44px",
                  width: "44px",
                  borderRadius: "50%",
                  color: voiceState === "listening" ? "#ef4444" : "#7ee8fa",
                  borderColor: voiceState === "listening" ? "#ef4444" : "rgba(126, 232, 250, 0.3)",
                }}
                aria-label={voiceState === "listening" ? "Stop recording" : "Start speaking"}
                title={voiceState === "listening" ? "Stop recording" : "Speak to Ashvi"}
              >
                <Mic size={16} />
              </button>
            )}

            <button
              type="submit"
              className="ashvi-btn-send"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
