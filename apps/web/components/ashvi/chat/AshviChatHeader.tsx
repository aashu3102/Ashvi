"use client";

import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { VoiceLanguage, VoiceState } from "@/lib/use-ashvi-voice";
import { TimeOfDay } from "@/lib/time-of-day";
import { AshviPresenceIndicator } from "./AshviPresenceIndicator";

interface Props {
  onBack: () => void;
  onNewSpace?: () => void;
  timeOfDay: TimeOfDay;
  language: VoiceLanguage;
  onSelectLanguage: (lang: VoiceLanguage) => void;
  voiceState: VoiceState;
  isStreaming: boolean;
}

export function AshviChatHeader({
  onBack,
  onNewSpace,
  timeOfDay,
  language,
  onSelectLanguage,
  voiceState,
  isStreaming,
}: Props) {
  const capTime = timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1);

  return (
    <header className="ashvi-chat-header">
      {/* Left: Back to Home + Brand */}
      <div className="ashvi-chat-header-left">
        <button
          type="button"
          className="ashvi-chat-back-btn"
          onClick={onBack}
          aria-label="Return to Main Dashboard"
        >
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </button>

        <div className="ashvi-chat-brand-title">
          <span>ASHVI</span>
        </div>
      </div>

      {/* Center: Dynamic Time Period Indicator */}
      <div className="ashvi-chat-header-center">
        <div className="ashvi-chat-time-badge">
          <span className="ashvi-chat-time-indicator-dot" />
          <span>{capTime}</span>
        </div>
      </div>

      {/* Right: Language Toggle + Presence State + New Chat */}
      <div className="ashvi-chat-header-right">
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

        {/* New conversation button */}
        {onNewSpace && (
          <button
            type="button"
            className="ashvi-chat-back-btn"
            onClick={onNewSpace}
            aria-label="Start new conversation"
            title="New Conversation"
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
