"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "../conversation/ActiveChatModal";
import { AshviChatMessageItem } from "./AshviChatMessageItem";
import { AshviDailyTasks } from "./AshviDailyTasks";
import { AshviChatActions } from "./AshviChatActions";
import { getGreeting, TimeOfDay } from "@/lib/time-of-day";

interface Props {
  messages: ChatMessage[];
  streamText: string;
  isStreaming: boolean;
  error?: string;
  timeOfDay: TimeOfDay;
  userName?: string | null;
  onSpeak?: (text: string) => void;
  onSendMessage: (text: string) => void;
  onUploadFile?: (file: File) => void;
  onToggleVoice?: () => void;
}

export function AshviChatMessages({
  messages,
  streamText,
  isStreaming,
  error,
  timeOfDay,
  userName,
  onSpeak,
  onSendMessage,
  onUploadFile,
  onToggleVoice,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamText, isStreaming]);

  const isEmpty = messages.length === 0 && !streamText;
  const greeting = getGreeting(timeOfDay, userName);

  return (
    <div className="ashvi-chat-stage">
      <div ref={scrollRef} className="ashvi-chat-scroll-area">
        <div className="ashvi-chat-content-width">
          {isEmpty ? (
            /* Clean Authentic Empty State with Tasks and Actions */
            <div className="ashvi-chat-empty-state">
              <div className="ashvi-chat-greeting-box">
                <h1 className="ashvi-chat-greeting-title">{greeting}</h1>
                <p className="ashvi-chat-greeting-subtitle">Same thoughts. Bigger possibilities.</p>
              </div>

              {/* Functional Daily Tasks Section */}
              <AshviDailyTasks />

              {/* Four Functional Action Buttons */}
              <AshviChatActions
                onSendMessage={onSendMessage}
                onUploadFile={onUploadFile}
                onToggleVoice={onToggleVoice}
              />
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <AshviChatMessageItem
                  key={msg.id}
                  message={msg}
                  onSpeak={onSpeak}
                />
              ))}

              {/* Streaming In-Progress Assistant Response */}
              {streamText && (
                <div className="ashvi-message-row assistant">
                  <div className="ashvi-assistant-card" style={{ borderColor: "rgba(56, 189, 248, 0.25)" }}>
                    <div className="ashvi-card-header">
                      <div className="ashvi-name-label">
                        <span className="ashvi-name-dot" />
                        <span>ASHVI</span>
                      </div>
                    </div>
                    <div className="ashvi-card-body">
                      <p style={{ whiteSpace: "pre-wrap" }}>
                        {streamText}
                        {isStreaming && (
                          <span
                            style={{
                              display: "inline-block",
                              width: "7px",
                              height: "15px",
                              marginLeft: "4px",
                              backgroundColor: "#38bdf8",
                              animation: "breathe 1s infinite alternate",
                              verticalAlign: "middle",
                            }}
                          />
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error notice if present */}
              {error && (
                <div
                  role="alert"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#fca5a5",
                    fontSize: "13px",
                    textAlign: "center",
                  }}
                >
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
