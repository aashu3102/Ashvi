"use client";

import { FormEvent, useRef, useState } from "react";
import { Paperclip, Image as ImageIcon, Mic, Send, Lightbulb, Search, FileUp, Wrench } from "lucide-react";

interface Props {
  onSendMessage: (content: string) => void;
  onUploadFile?: (file: File) => void;
  isRecording?: boolean;
  onToggleVoice?: () => void;
  submitting?: boolean;
}

export function MainInputBar({
  onSendMessage,
  onUploadFile,
  isRecording = false,
  onToggleVoice,
  submitting = false,
}: Props) {
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    onSendMessage(text.trim());
    setText("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      onUploadFile(file);
    }
  };

  const tools = [
    { label: "Deep Think", icon: Lightbulb },
    { label: "Search Web", icon: Search },
    { label: "Attach Files", icon: FileUp, action: () => fileInputRef.current?.click() },
    { label: "Use Tools", icon: Wrench },
  ];

  return (
    <div className="ashvi-command-bar-wrapper">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <form className="ashvi-input-pill-container" onSubmit={handleSubmit}>
        <button
          type="button"
          className="ashvi-input-leading-icon"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
        >
          <Paperclip size={18} />
        </button>

        <input
          type="text"
          className="ashvi-input-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask Ashvi anything..."
          disabled={submitting}
        />

        <div className="ashvi-input-actions-right">
          <button
            type="button"
            className="ashvi-input-action-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload image"
          >
            <ImageIcon size={17} />
          </button>

          <button
            type="button"
            className={`ashvi-input-action-btn ${isRecording ? "is-recording" : ""}`}
            onClick={onToggleVoice}
            aria-label={isRecording ? "Stop voice recording" : "Start voice recording"}
            style={isRecording ? { color: "#ef4444" } : undefined}
          >
            <Mic size={17} />
          </button>

          <button
            type="submit"
            className="ashvi-btn-send"
            disabled={!text.trim() || submitting}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </form>

      {/* Tool pills below the input bar */}
      <div className="ashvi-tool-pills-row" aria-label="Command tools">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              type="button"
              className="ashvi-tool-pill"
              onClick={() => t.action && t.action()}
            >
              <Icon size={12} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
