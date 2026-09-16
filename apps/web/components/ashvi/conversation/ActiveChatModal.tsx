"use client";

import { useEffect, useRef } from "react";
import { X, Volume2, Sparkles, Send } from "lucide-react";

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

          <button
            type="button"
            onClick={onClose}
            className="ashvi-utility-btn"
            aria-label="Close conversation"
          >
            <X size={16} />
          </button>
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
                fontFamily: "var(--ashvi-font-display)",
                fontStyle: "italic",
              }}
            >
              Ask anything. Ashvi is thinking alongside you.
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role.toLowerCase() === "user";
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  padding: "12px 16px",
                  borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                  background: isUser
                    ? "linear-gradient(135deg, rgba(37, 99, 235, 0.35) 0%, rgba(29, 78, 216, 0.25) 100%)"
                    : "rgba(18, 26, 40, 0.8)",
                  border: isUser
                    ? "1px solid rgba(147, 197, 253, 0.3)"
                    : "1px solid rgba(126, 232, 250, 0.16)",
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
              const input = (e.currentTarget.elements.namedItem("chatInput") as HTMLInputElement);
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
