"use client";

import { useEffect, useState } from "react";
import { AshviBackground } from "./AshviBackground";
import { LeftSidebar } from "../sidebar/LeftSidebar";
import { TopHeader } from "../top-navigation/TopHeader";
import { HeroSection } from "../hero/HeroSection";
import { CapabilityCardsGrid } from "../capability-cards/CapabilityCardsGrid";
import { MainInputBar } from "../command-bar/MainInputBar";
import { RightSidebar } from "../right-sidebar/RightSidebar";
import { ActiveChatModal, ChatMessage } from "../conversation/ActiveChatModal";
import { AshviChatView } from "../chat/AshviChatView";
import { parseAshviSseLine } from "@/lib/sse";
import { getApiBaseUrl, getAuthHeaders } from "@/lib/api";
import { useAshviVoice } from "@/lib/use-ashvi-voice";
import "../ashvi.css";

type Conversation = { id: string; title: string };

interface AshviShellProps {
  userName?: string | null;
}

export function AshviShell({ userName: initialUserName }: AshviShellProps = {}) {
  const base = getApiBaseUrl();
  const [userName, setUserName] = useState<string | null>(initialUserName || null);
  const [activeTab, setActiveTab] = useState("home");
  const [selectedCapability, setSelectedCapability] = useState("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState("General");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  const voice = useAshviVoice({
    conversationId: activeConversationId,
    onTranscript: (transcript) => {
      const userMessage: ChatMessage = {
        id: `msg-user-${Date.now()}`,
        role: "user",
        content: transcript,
      };
      setMessages((prev) => [...prev, userMessage]);
      setActiveTab("chat");
      setStreamText("");
    },
    onAssistantResponse: (fullText) => {
      const assistantMessage: ChatMessage = {
        id: `msg-asst-${Date.now()}`,
        role: "assistant",
        content: fullText,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamText("");
    },
    onError: (err) => setError(err),
  });

  // Fetch session username if not provided
  useEffect(() => {
    if (!userName) {
      fetch(`${base}/api/auth/session`, { credentials: "include", cache: "no-store", headers: getAuthHeaders() })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user?.name) setUserName(data.user.name);
        })
        .catch(() => {});
    }
  }, [base, userName]);

  // Load conversations on mount
  useEffect(() => {
    fetch(`${base}/api/conversations`, { credentials: "include", headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(() => setError("Ashvi could not load conversations."));
  }, [base]);

  // Create new space/conversation
  const handleNewSpace = async () => {
    try {
      const res = await fetch(`${base}/api/conversations`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Ashvi could not create a conversation.");
      const conv = await res.json();
      setConversations((prev) => [conv, ...prev]);
      setError("");
      await openConversation(conv.id, conv.title || "New Space");
      setActiveTab("chat");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ashvi could not create a conversation.");
    }
  };

  // Open an existing conversation
  const openConversation = async (id: string, title?: string) => {
    setActiveConversationId(id);
    setActiveTitle(title || "General");
    setMessages([]);
    setStreamText("");
    setError("");

    try {
      const res = await fetch(`${base}/api/conversations/${id}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
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
          headers: getAuthHeaders({ "content-type": "application/json" }),
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
    setActiveTab("chat");
    setIsStreaming(true);
    setStreamText("");
    setError("");

    try {
      const response = await fetch(`${base}/api/conversations/${currentId}/messages/stream`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ content: text, language: voice.voiceLanguage }),
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
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!response.ok) throw new Error("Document upload failed.");
      setError("");
      alert(`File "${file.name}" uploaded to secure Ashvi documents.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not upload "${file.name}" to secure core.`);
    }
  };

  // If user selected Chat, render the dedicated Ashvi Chat Room experience
  if (activeTab === "chat") {
    return (
      <AshviChatView
        onBack={() => setActiveTab("home")}
        userName={userName}
        activeConversationId={activeConversationId}
        activeTitle={activeTitle}
        messages={messages}
        streamText={streamText}
        isStreaming={isStreaming}
        error={error || voice.voiceError}
        voiceState={voice.voiceState}
        voiceLanguage={voice.voiceLanguage}
        onSetVoiceLanguage={voice.setVoiceLanguage}
        onToggleVoice={voice.toggleListening}
        onInterrupt={voice.interrupt}
        onSpeak={voice.speakText}
        onSendMessage={handleSendMessage}
        onNewSpace={handleNewSpace}
        onUploadFile={handleUploadFile}
      />
    );
  }

  return (
    <div className="ashvi-app-shell">

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
            setActiveTab("chat");
          }}
        />

        {/* Center Workspace */}
        <main className="ashvi-center-workspace">
          <TopHeader
            selectedCapability={selectedCapability}
            onSelectCapability={(cap) => {
              setSelectedCapability(cap);
              if (cap === "chat") {
                setActiveTab("chat");
              } else {
                handleSendMessage(`Let's explore ${cap}.`);
              }
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
            isRecording={voice.isListening}
            onToggleVoice={voice.toggleListening}
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
          isListening={voice.isListening}
          onToggleVoice={voice.toggleListening}
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
          error={error || voice.voiceError}
          voiceState={voice.voiceState}
          voiceLanguage={voice.voiceLanguage}
          onSetVoiceLanguage={voice.setVoiceLanguage}
          onToggleVoice={voice.toggleListening}
          onInterrupt={voice.interrupt}
          onClose={() => setIsChatModalOpen(false)}
          onSendMessage={handleSendMessage}
          onSpeak={voice.speakText}
        />
      )}
    </div>
  );
}
