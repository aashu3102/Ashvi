"use client";

import { VoiceState } from "@/lib/use-ashvi-voice";

interface Props {
  voiceState: VoiceState;
  isStreaming?: boolean;
}

export function AshviPresenceIndicator({ voiceState, isStreaming }: Props) {
  // Determine effective status
  let label = "Online";
  let color = "#38bdf8";
  let bg = "rgba(56, 189, 248, 0.15)";
  let pulse = false;

  if (voiceState === "listening") {
    label = "Listening";
    color = "#ef4444";
    bg = "rgba(239, 68, 68, 0.18)";
    pulse = true;
  } else if (voiceState === "transcribing") {
    label = "Transcribing";
    color = "#38bdf8";
    bg = "rgba(56, 189, 248, 0.18)";
    pulse = true;
  } else if (voiceState === "thinking" || isStreaming) {
    label = isStreaming ? "Responding" : "Thinking";
    color = "#f59e0b";
    bg = "rgba(245, 158, 11, 0.18)";
    pulse = true;
  } else if (voiceState === "speaking") {
    label = "Speaking";
    color = "#10b981";
    bg = "rgba(16, 185, 129, 0.18)";
    pulse = true;
  } else if (voiceState === "interrupted") {
    label = "Interrupted";
    color = "#94a3b8";
    bg = "rgba(148, 163, 184, 0.15)";
  }

  return (
    <div
      className="ashvi-voice-status-pill"
      style={{
        backgroundColor: bg,
        borderColor: `${color}40`,
        color,
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}`,
          display: "inline-block",
          animation: pulse ? "pulseRecording 1.5s infinite" : "none",
        }}
      />
      <span>{label}</span>
    </div>
  );
}
