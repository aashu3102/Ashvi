"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "../conversation/ActiveChatModal";
import type { VoiceLanguage, VoiceState } from "@/lib/use-ashvi-voice";
import { getTimeOfDay, TimeOfDay } from "@/lib/time-of-day";
import { AshviChatBackground } from "./AshviChatBackground";
import { AshviChatHeader } from "./AshviChatHeader";
import { AshviChatMessages } from "./AshviChatMessages";
import { AshviChatComposer } from "./AshviChatComposer";
import "./chat.css";

interface Props {
  onBack: () => void;
  userName?: string | null;
  activeConversationId: string | null;
  activeTitle: string;
  messages: ChatMessage[];
  streamText: string;
  isStreaming: boolean;
  error?: string;
  voiceState: VoiceState;
  voiceLanguage: VoiceLanguage;
  onSetVoiceLanguage: (lang: VoiceLanguage) => void;
  onToggleVoice: () => void;
  onInterrupt: () => void;
  onSpeak: (text: string) => void;
  onSendMessage: (text: string) => void;
  onNewSpace: () => void;
  onUploadFile?: (file: File) => void;
}

export function AshviChatView({
  onBack,
  userName,
  messages,
  streamText,
  isStreaming,
  error,
  voiceState,
  voiceLanguage,
  onSetVoiceLanguage,
  onToggleVoice,
  onInterrupt,
  onSpeak,
  onSendMessage,
  onNewSpace,
  onUploadFile,
}: Props) {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());

  // Periodically refresh time of day
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeOfDay(getTimeOfDay());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ashvi-chat-room">
      {/* Dynamic Time of Day Scene Layer with crossfade */}
      <AshviChatBackground forcedTimeOfDay={timeOfDay} />

      {/* Floating Translucent Header */}
      <AshviChatHeader
        onBack={onBack}
        onNewSpace={onNewSpace}
        timeOfDay={timeOfDay}
        language={voiceLanguage}
        onSelectLanguage={onSetVoiceLanguage}
        voiceState={voiceState}
        isStreaming={isStreaming}
      />

      {/* Center Conversation Stage */}
      <AshviChatMessages
        messages={messages}
        streamText={streamText}
        isStreaming={isStreaming}
        error={error}
        timeOfDay={timeOfDay}
        userName={userName}
        onSpeak={onSpeak}
      />

      {/* Desk Console Composer at bottom */}
      <AshviChatComposer
        onSendMessage={onSendMessage}
        onUploadFile={onUploadFile}
        isStreaming={isStreaming}
        voiceState={voiceState}
        onToggleVoice={onToggleVoice}
        onInterrupt={onInterrupt}
      />
    </div>
  );
}
