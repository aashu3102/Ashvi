"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "../conversation/ActiveChatModal";
import type { VoiceLanguage, VoiceState } from "@/lib/use-ashvi-voice";
import { getTimeOfDay, TimeOfDay } from "@/lib/time-of-day";
import { AshviChatBackground } from "./AshviChatBackground";
import { AshviChatSidebar } from "./AshviChatSidebar";
import { AshviChatHeader } from "./AshviChatHeader";
import { AshviChatMessages } from "./AshviChatMessages";
import { AshviChatComposer } from "./AshviChatComposer";
import type { ConversationItem } from "./AshviConversationDrawer";
import "./chat.css";

interface Props {
  onBack: () => void;
  userName?: string | null;
  activeConversationId: string | null;
  activeTitle: string;
  conversations: ConversationItem[];
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
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
  activeConversationId,
  activeTitle,
  conversations,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Periodically refresh time of day to ensure smooth day transitions
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeOfDay(getTimeOfDay());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ashvi-chat-layout-root">
      {/* 1. Solid Left Sidebar (Fixed on Desktop, Slide-over Drawer on Mobile) */}
      <AshviChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewSpace}
        onRenameConversation={onRenameConversation}
        onDeleteConversation={onDeleteConversation}
        onBack={onBack}
        userName={userName}
        className={isMobileSidebarOpen ? "mobile-open" : ""}
        onCloseMobileDrawer={() => setIsMobileSidebarOpen(false)}
      />

      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="ashvi-chat-mobile-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 2. Main Chat Workspace (occupies all remaining horizontal space) */}
      <main className="ashvi-chat-main-workspace">
        {/* Dynamic Scenic Time of Day Background using exact public assets */}
        <AshviChatBackground forcedTimeOfDay={timeOfDay} />

        {/* Top Chat Bar with Dashboard return, active title, language toggle, and status */}
        <AshviChatHeader
          onBack={onBack}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          language={voiceLanguage}
          onSelectLanguage={onSetVoiceLanguage}
          voiceState={voiceState}
          isStreaming={isStreaming}
          title={activeTitle}
        />

        {/* Center Conversation Stage with Tasks and Action Buttons */}
        <AshviChatMessages
          messages={messages}
          streamText={streamText}
          isStreaming={isStreaming}
          error={error}
          timeOfDay={timeOfDay}
          userName={userName}
          onSpeak={onSpeak}
          onSendMessage={onSendMessage}
          onUploadFile={onUploadFile}
          onToggleVoice={onToggleVoice}
        />

        {/* Console Input Bar anchored at bottom */}
        <AshviChatComposer
          onSendMessage={onSendMessage}
          onUploadFile={onUploadFile}
          isStreaming={isStreaming}
          voiceState={voiceState}
          onToggleVoice={onToggleVoice}
          onInterrupt={onInterrupt}
        />
      </main>
    </div>
  );
}
