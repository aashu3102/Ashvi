"use client";

import { useRef } from "react";
import { Sparkles, MessageCircle, Code2, FileText } from "lucide-react";

interface Props {
  onSendMessage: (text: string) => void;
  onUploadFile?: (file: File) => void;
  onToggleVoice?: () => void;
}

export function AshviChatActions({
  onSendMessage,
  onUploadFile,
  onToggleVoice,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleHelp = () => {
    onSendMessage("I need help with a problem I'm working on. Let's break it down and solve it together.");
  };

  const handleTalk = () => {
    if (onToggleVoice) {
      onToggleVoice();
    } else {
      onSendMessage("Let's just talk. What's on your mind today?");
    }
  };

  const handleBuild = () => {
    onSendMessage("I want to build something bold today. Let's architect and build it together.");
  };

  const handleDocumentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      onUploadFile(file);
    }
    if (e.target) e.target.value = "";
  };

  return (
    <div className="ashvi-chat-action-cards" role="region" aria-label="Quick actions">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
        accept=".pdf,.txt,.md,.json,.csv,.docx,.ts,.js,.py"
        aria-hidden="true"
      />

      <button
        type="button"
        className="ashvi-chat-action-card"
        onClick={handleHelp}
      >
        <span className="ashvi-action-icon help">
          <Sparkles size={18} />
        </span>
        <div className="ashvi-action-text">
          <span className="ashvi-action-title">Help me with something</span>
          <span className="ashvi-action-desc">Solve, debug, or brainstorm</span>
        </div>
      </button>

      <button
        type="button"
        className="ashvi-chat-action-card"
        onClick={handleTalk}
      >
        <span className="ashvi-action-icon talk">
          <MessageCircle size={18} />
        </span>
        <div className="ashvi-action-text">
          <span className="ashvi-action-title">Just talk</span>
          <span className="ashvi-action-desc">Natural voice or text thoughts</span>
        </div>
      </button>

      <button
        type="button"
        className="ashvi-chat-action-card"
        onClick={handleBuild}
      >
        <span className="ashvi-action-icon build">
          <Code2 size={18} />
        </span>
        <div className="ashvi-action-text">
          <span className="ashvi-action-title">Just build something</span>
          <span className="ashvi-action-desc">Code, architecture &amp; shipping</span>
        </div>
      </button>

      <button
        type="button"
        className="ashvi-chat-action-card"
        onClick={handleDocumentClick}
      >
        <span className="ashvi-action-icon doc">
          <FileText size={18} />
        </span>
        <div className="ashvi-action-text">
          <span className="ashvi-action-title">Analyze a document</span>
          <span className="ashvi-action-desc">RAG deep-read &amp; extract</span>
        </div>
      </button>
    </div>
  );
}
