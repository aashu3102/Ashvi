"use client";

import { ArrowLeft, MessageSquare, Plus } from "lucide-react";
import { VoiceLanguage, VoiceState } from "@/lib/use-ashvi-voice";
import { AshviPresenceIndicator } from "./AshviPresenceIndicator";

interface Props {
  onBack: () => void;
  onOpenDrawer: () => void;
  onNewSpace?: () => void;
  language: VoiceLanguage;
  onSelectLanguage: (lang: VoiceLanguage) => void;
  voiceState: VoiceState;
  isStreaming: boolean;
  conversationCount?: number;
  title?: string;
}

export function AshviChatHeader({
  onBack,
  onOpenDrawer,
  onNewSpace,
  language,
  onSelectLanguage,
  voiceState,
  isStreaming,
  conversationCount = 0,
  title,
}: Props) {
  return (
    <header className="ashvi-chat-floating-bar" aria-label="Conversation controls">
      {/* Left controls: Back, Chats drawer, New Space */}
      <div className="ashvi-chat-bar-left">
        <button
          type="button"
          className="ashvi-chat-pill-btn"
          onClick={onBack}
          aria-label="Return to Main Dashboard"
          title="Return to Main Dashboard"
        >
          <ArrowLeft size={15} />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          className="ashvi-chat-pill-btn"
          onClick={onOpenDrawer}
          aria-label="Open conversations list"
          title="Open conversations list"
        >
          <MessageSquare size={14} />
          <span>Chats</span>
          {conversationCount > 0 && (
            <span className="ashvi-chat-badge">{conversationCount}</span>
          )}
        </button>

        {onNewSpace && (
          <button
            type="button"
            className="ashvi-chat-pill-btn icon-only"
            onClick={onNewSpace}
            aria-label="Start new conversation"
            title="Start new conversation"
          >
            <Plus size={15} />
          </button>
        )}
      </div>

      {/* Center: Subtle conversation title indicator */}
      {title && (
        <div
          style={{
            fontSize: "13px",
            color: "#94a3b8",
            fontWeight: 500,
            maxWidth: "280px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      )}

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
