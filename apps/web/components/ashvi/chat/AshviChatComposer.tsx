"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
import { Mic, Paperclip, Send, Square } from "lucide-react";
import { VoiceState } from "@/lib/use-ashvi-voice";

interface Props {
  onSendMessage: (content: string) => void;
  onUploadFile?: (file: File) => void;
  isStreaming?: boolean;
  voiceState?: VoiceState;
  onToggleVoice?: () => void;
  onInterrupt?: () => void;
}

export function AshviChatComposer({
  onSendMessage,
  onUploadFile,
  isStreaming = false,
  voiceState = "idle",
  onToggleVoice,
  onInterrupt,
}: Props) {
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || isStreaming) return;
    onSendMessage(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      onUploadFile(file);
    }
    if (e.target) e.target.value = "";
  };

  const isListening = voiceState === "listening";
  const isSpeaking = voiceState === "speaking";

  return (
    <div className="ashvi-chat-composer-wrapper">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      <div className="ashvi-chat-console">
        <div className="ashvi-console-input-row">
          {/* File Attachment Tool */}
          <button
            type="button"
            className="ashvi-console-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file or image"
            aria-label="Attach file"
          >
            <Paperclip size={18} />
          </button>

          {/* Dynamic Auto-Expanding Textarea */}
          <textarea
            ref={textareaRef}
            className="ashvi-console-textarea"
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? "Listening to your voice..."
                : isSpeaking
                ? "Ashvi is speaking... (tap mic to speak)"
                : "Ask Ashvi anything, brainstorm, or explore..."
            }
            aria-label="Message Ashvi"
          />

          {/* Action Tools */}
          <div className="ashvi-console-actions">
            {/* Barge-In Stop button if speaking */}
            {isSpeaking && onInterrupt && (
              <button
                type="button"
                className="ashvi-console-mic-btn"
                onClick={onInterrupt}
                title="Interrupt speech"
                aria-label="Interrupt speech"
                style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
              >
                <Square size={16} />
              </button>
            )}

            {/* Voice Mic Button */}
            {onToggleVoice && (
              <button
                type="button"
                className={`ashvi-console-mic-btn ${isListening ? "active" : ""}`}
                onClick={onToggleVoice}
                title={isListening ? "Stop listening" : "Speak to Ashvi"}
                aria-label="Voice input"
              >
                <Mic size={18} />
              </button>
            )}

            {/* Send Message Button */}
            <button
              type="button"
              className="ashvi-console-send-btn"
              onClick={() => handleSubmit()}
              disabled={!text.trim() || isStreaming}
              title="Send message"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="ashvi-chat-footer-note">
        Ashvi Core • Private &amp; Local Intelligence
      </div>
    </div>
  );
}
