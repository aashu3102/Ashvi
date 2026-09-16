"use client";

import { useEffect, useRef, useState } from "react";
import { AshviBackground } from "./AshviBackground";
import { LeftSidebar } from "../sidebar/LeftSidebar";
import { TopHeader } from "../top-navigation/TopHeader";
import { HeroSection } from "../hero/HeroSection";
import { CapabilityCardsGrid } from "../capability-cards/CapabilityCardsGrid";
import { MainInputBar } from "../command-bar/MainInputBar";
import { RightSidebar } from "../right-sidebar/RightSidebar";
import { ActiveChatModal, ChatMessage } from "../conversation/ActiveChatModal";
import { parseAshviSseLine } from "@/lib/sse";
import "../ashvi.css";

const base = process.env.NEXT_PUBLIC_ASHVI_API_URL ?? "http://127.0.0.1:4000";

type Conversation = { id: string; title: string };

export function AshviShell() {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedCapability, setSelectedCapability] = useState("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState("General");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Load conversations on mount
  useEffect(() => {
    fetch(`${base}/api/conversations`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(() => setError("Ashvi could not load conversations."));
  }, []);

  // Create new space/conversation
  const handleNewSpace = async () => {
    try {
      const res = await fetch(`${base}/api/conversations`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Ashvi could not create a conversation.");
      const conv = await res.json();
      setConversations((prev) => [conv, ...prev]);
      setError("");
      await openConversation(conv.id, conv.title || "New Space");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ashvi could not create a conversation.");
    }
  };

  // Open an existing conversation
  const openConversation = async (id: string, title?: string) => {
    setActiveConversationId(id);
    setActiveTitle(title || "General");
    setIsChatModalOpen(true);
    setMessages([]);
    setStreamText("");
    setError("");

    try {
      const res = await fetch(`${base}/api/conversations/${id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      }
    } catch {
      setError("Ashvi could not open that conversation.");
    }
  };

  // Send message and stream response
  const handleSendMessage = async (text: string) => {
    let currentId = activeConversationId;

    if (!currentId) {
      try {
        const res = await fetch(`${base}/api/conversations`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("Ashvi could not create a conversation.");
        const conv = await res.json();
        currentId = conv.id;
        setConversations((prev) => [conv, ...prev]);
        setActiveConversationId(conv.id);
        setActiveTitle(conv.title || "Ashvi Space");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Ashvi could not create a conversation.");
        return;
      }
    }

    if (!currentId) {
      setError("Ashvi could not open a conversation.");
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsChatModalOpen(true);
    setIsStreaming(true);
    setStreamText("");
    setError("");

    try {
      const response = await fetch(`${base}/api/conversations/${currentId}/messages/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "Ashvi could not reach the local AI provider.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completedAssistant: ChatMessage | null = null;
      let streamError = "";

      const consumeEvent = (line: string) => {
        const parsed = parseAshviSseLine(line) as {
          type?: string;
          content?: string;
          assistant?: ChatMessage;
          error?: string;
        } | null;
        if (!parsed) return;

        try {
          if (parsed.type === "chunk" && parsed.content) {
            setStreamText((current) => current + parsed.content);
          } else if (parsed.type === "done" && parsed.assistant) {
            completedAssistant = parsed.assistant;
          } else if (parsed.type === "error") {
            streamError = parsed.error ?? "Ashvi could not reach the local AI provider.";
          }
        } catch {
          streamError = "Ashvi returned an invalid streaming response.";
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) consumeEvent(line);
      }

      consumeEvent(buffer);
      if (streamError) throw new Error(streamError);
      const assistant = completedAssistant as ChatMessage | null;
      if (!assistant?.content?.trim()) throw new Error("Ashvi returned an empty response.");

      setMessages((prev) => [...prev, assistant]);
      setStreamText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ashvi could not reach the local AI provider.");
    } finally {
      setIsStreaming(false);
    }
  };

  // Document upload
  const handleUploadFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${base}/api/documents/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error("Document upload failed.");
      setError("");
      alert(`File "${file.name}" uploaded to secure Ashvi documents.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not upload "${file.name}" to secure core.`);
    }
  };

  // Voice recording toggle
  const handleToggleVoice = async () => {
    if (isRecording) {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        stream.getTracks().forEach((track) => track.stop());

        try {
          const form = new FormData();
          form.append("file", audioBlob, "voice.wav");
          const res = await fetch(`${base}/api/voice/transcribe`, {
            method: "POST",
            credentials: "include",
            body: form,
          });
          const data = await res.json().catch(() => null) as { transcript?: string; error?: { message?: string } } | null;
          if (!res.ok || !data?.transcript) throw new Error(data?.error?.message ?? "Speech recognition is unavailable.");
          await handleSendMessage(data.transcript);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Speech recognition is unavailable.");
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      alert("Microphone access could not be initialized.");
    }
  };

  // Voice TTS Speak
  const handleSpeak = async (text: string) => {
    try {
      const res = await fetch(`${base}/api/voice/synthesize`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Speech synthesis is unavailable.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (!audioPlayerRef.current) return;
      audioPlayerRef.current.onended = () => URL.revokeObjectURL(url);
      audioPlayerRef.current.src = url;
      await audioPlayerRef.current.play();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Speech synthesis is unavailable.");
    }
  };

  return (
    <div className="ashvi-app-shell">
      <audio ref={audioPlayerRef} style={{ display: "none" }} />

      {/* Layer 1 & 2: Atmospheric cinematic background */}
      <AshviBackground />

      {/* Main 3-column Layout */}
      <div className="ashvi-main-layout">
        {/* Left Sidebar */}
        <LeftSidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (tab === "chat") {
              if (conversations.length > 0) {
                openConversation(conversations[0].id, conversations[0].title);
              } else {
                handleNewSpace();
              }
            }
          }}
          onNewSpace={handleNewSpace}
          recentSpaces={conversations}
          onSelectSpace={(id) => {
            const found = conversations.find((c) => c.id === id);
            openConversation(id, found?.title);
          }}
        />

        {/* Center Workspace */}
        <main className="ashvi-center-workspace">
          <TopHeader
            selectedCapability={selectedCapability}
            onSelectCapability={(cap) => {
              setSelectedCapability(cap);
              handleSendMessage(`Let's explore ${cap}.`);
            }}
          />

          <HeroSection
            onSelectTag={(tag) => handleSendMessage(`I want to focus on ${tag}.`)}
          />

          <CapabilityCardsGrid
            onSelectCard={(key) => handleSendMessage(`Start a new ${key} project with me.`)}
          />

          <MainInputBar
            onSendMessage={handleSendMessage}
            onUploadFile={handleUploadFile}
            isRecording={isRecording}
            onToggleVoice={handleToggleVoice}
            submitting={isStreaming}
          />

          {/* Bottom Branding */}
          <footer className="ashvi-bottom-status-bar" aria-label="System status">
            <span>BUILT FOR REAL IDEAS. DESIGNED FOR A BRIGHTER TOMORROW.</span>
            <span>LOCAL &nbsp;|&nbsp; PRIVATE &nbsp;|&nbsp; YOURS</span>
          </footer>
        </main>

        {/* Right Sidebar */}
        <RightSidebar
          currentSpaceName={activeTitle}
          isListening={isRecording}
          onToggleVoice={handleToggleVoice}
          onUploadFile={handleUploadFile}
        />
      </div>

      {/* Active Conversation Drawer / Modal */}
      {isChatModalOpen && (
        <ActiveChatModal
          conversationId={activeConversationId || ""}
          title={activeTitle}
          messages={messages}
          streamText={streamText}
          isStreaming={isStreaming}
          error={error}
          onClose={() => setIsChatModalOpen(false)}
          onSendMessage={handleSendMessage}
          onSpeak={handleSpeak}
        />
      )}
    </div>
  );
}
