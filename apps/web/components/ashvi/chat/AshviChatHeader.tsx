"use client";

import { ArrowLeft, Lock, Menu } from "lucide-react";
import { VoiceLanguage, VoiceState } from "@/lib/use-ashvi-voice";
import { AshviPresenceIndicator } from "./AshviPresenceIndicator";

interface Props {
  onBack: () => void;
  onOpenMobileSidebar?: () => void;
  language: VoiceLanguage;
  onSelectLanguage: (lang: VoiceLanguage) => void;
  voiceState: VoiceState;
  isStreaming: boolean;
  title?: string;
  isPrivate?: boolean;
}

export function AshviChatHeader({
  onBack,
  onOpenMobileSidebar,
  language,
  onSelectLanguage,
  voiceState,
  isStreaming,
  title,
  isPrivate,
}: Props) {
  return (
    <header className="ashvi-chat-top-bar" aria-label="Conversation controls">
      {/* Left controls: Mobile menu toggle, Dashboard return, Active conversation title */}
      <div className="ashvi-chat-bar-left">
        {onOpenMobileSidebar && (
          <button
            type="button"
            className="ashvi-chat-pill-btn mobile-menu-toggle"
            onClick={onOpenMobileSidebar}
            aria-label="Open conversation menu"
          >
            <Menu size={16} />
          </button>
        )}

        <button
          type="button"
          className="ashvi-chat-pill-btn"
          onClick={onBack}
          aria-label="Return to Main Dashboard"
          title="Return to Main Dashboard"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>

        {title && (
          <div className="ashvi-chat-active-title" title={title}>
            <span className="ashvi-title-dot" />
            <span className="ashvi-title-text">{title}</span>
            {isPrivate && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  fontWeight: 500,
                  padding: "2px 7px",
                  borderRadius: "6px",
                  background: "rgba(126, 232, 250, 0.14)",
                  color: "#7ee8fa",
                  border: "1px solid rgba(126, 232, 250, 0.3)",
                  marginLeft: "8px",
                }}
                title="Private Session: Stored locally in browser. Processed via Cloud AI."
              >
                <Lock size={10} />
                <span>Private</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right controls: Language toggle, Presence state */}
      <div className="ashvi-chat-bar-right">
        {/* Language switcher pill */}
        <div className="ashvi-lang-toggle" role="group" aria-label="Language selection">
          <button
            type="button"
            className={`ashvi-lang-btn ${language === "en" ? "active" : ""}`}
            onClick={() => onSelectLanguage("en")}
          >
            EN
          </button>
          <button
            type="button"
            className={`ashvi-lang-btn ${language === "hi" ? "active" : ""}`}
            onClick={() => onSelectLanguage("hi")}
          >
            HI
          </button>
        </div>

        {/* Presence state */}
        <AshviPresenceIndicator voiceState={voiceState} isStreaming={isStreaming} />
      </div>
    </header>
  );
}
