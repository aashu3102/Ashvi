"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AshviBackground } from "./AshviBackground";
import { LeftSidebar } from "../sidebar/LeftSidebar";
import { TopHeader } from "../top-navigation/TopHeader";
import { HeroSection } from "../hero/HeroSection";
import { CapabilityCardsGrid } from "../capability-cards/CapabilityCardsGrid";
import { MainInputBar } from "../command-bar/MainInputBar";
import { RightSidebar } from "../right-sidebar/RightSidebar";
import type { ChatMessage } from "../conversation/ActiveChatModal";
import { parseAshviSseLine } from "@/lib/sse";
import { getApiBaseUrl, getAuthHeaders } from "@/lib/api";
import { useAshviVoice } from "@/lib/use-ashvi-voice";
import { containsPrivateKeyword } from "@/lib/privacy-classifier";
import {
  listPrivateConversations,
  getPrivateConversation,
  savePrivateConversation,
  deletePrivateConversation,
  renamePrivateConversation,
  appendPrivateMessage,
  type PrivateStoredConversation,
} from "@/lib/private-storage";
import "../ashvi.css";

// Dynamically code-split heavy chat components to optimize initial dashboard bundle
const AshviChatView = dynamic(
  () => import("../chat/AshviChatView").then((mod) => mod.AshviChatView),
  { ssr: false }
);

const AshviNotebookView = dynamic(
  () => import("../notebook/AshviNotebookView").then((mod) => mod.AshviNotebookView),
  { ssr: false }
);

const ActiveChatModal = dynamic(
  () => import("../conversation/ActiveChatModal").then((mod) => mod.ActiveChatModal),
  { ssr: false }
);

export type Conversation = {
  id: string;
  title: string;
  isPrivate?: boolean;
  updatedAt?: string;
};

interface AshviShellProps {
  userName?: string | null;
  onLogout?: () => void;
}

export function AshviShell({ userName = null, onLogout }: AshviShellProps = {}) {
  const base = getApiBaseUrl();
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


  const userKey = userName || "ashvi-default-user";

  // Load conversations on mount (both Cloud and Local IndexedDB for this user)
  useEffect(() => {
    let isMounted = true;
    async function loadAllConversations() {
      try {
        const [cloudRes, privateItems] = await Promise.all([
          fetch(`${base}/api/conversations`, { credentials: "include", headers: getAuthHeaders() })
            .then((res) => (res.ok ? res.json() : []))
            .catch(() => []),
          listPrivateConversations(userKey).catch(() => []),
        ]);

        if (!isMounted) return;

        const cloudConversations: Conversation[] = Array.isArray(cloudRes)
          ? cloudRes.map((c: any) => ({
              id: c.id,
              title: c.title,
              isPrivate: false,
              updatedAt: c.updatedAt,
            }))
          : [];

        const privateConversations: Conversation[] = privateItems.map((c) => ({
          id: c.id,
          title: c.title,
          isPrivate: true,
          updatedAt: c.updatedAt,
        }));

        const merged = [...privateConversations, ...cloudConversations].sort((a, b) => {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return timeB - timeA;
        });

        setConversations(merged);
      } catch {
        if (isMounted) setError("Ashvi could not load conversations.");
      }
    }

    loadAllConversations();
    return () => {
      isMounted = false;
    };
  }, [base, userKey]);

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
      const newConv: Conversation = {
        id: conv.id,
        title: conv.title || "New Space",
        isPrivate: false,
        updatedAt: conv.updatedAt,
      };
      setConversations((prev) => [newConv, ...prev]);
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

    const isPrivate = conversations.find((c) => c.id === id)?.isPrivate || id.startsWith("priv-");

    if (isPrivate) {
      try {
        const stored = await getPrivateConversation(id, userKey);
        if (stored && Array.isArray(stored.messages)) {
          setMessages(
            stored.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              metadata: m.metadata,
            }))
          );
          if (stored.title) setActiveTitle(stored.title);
        }
      } catch {
        setError("Ashvi could not open private conversation.");
      }
      return;
    }

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

  // Rename a conversation
  const handleRenameConversation = async (id: string, newTitle: string) => {
    const isPrivate = conversations.find((c) => c.id === id)?.isPrivate || id.startsWith("priv-");

    try {
      if (isPrivate) {
        await renamePrivateConversation(id, userKey, newTitle);
      } else {
        const res = await fetch(`${base}/api/conversations/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: getAuthHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ title: newTitle }),
        });
        if (!res.ok) throw new Error("Could not rename conversation.");
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      );
      if (activeConversationId === id) {
        setActiveTitle(newTitle);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to rename conversation.");
    }
  };

  // Delete a conversation (instant 1-click execution)
  const handleDeleteConversation = async (id: string) => {
    const isPrivate = conversations.find((c) => c.id === id)?.isPrivate || id.startsWith("priv-");

    // Optimistically update UI immediately
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setActiveTitle("General");
      setMessages([]);
      setStreamText("");
    }

    try {
      if (isPrivate) {
        await deletePrivateConversation(id, userKey);
      } else {
        const res = await fetch(`${base}/api/conversations/${id}`, {
          method: "DELETE",
          credentials: "include",
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Could not delete conversation.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to delete conversation.");
    }
  };

  // Send message and stream response
  const handleSendMessage = async (text: string) => {
    let currentId = activeConversationId;
    const currentConv = conversations.find((c) => c.id === currentId);
    const hasKeyword = containsPrivateKeyword(text);
    const isAlreadyPrivate = Boolean(currentConv?.isPrivate) || (currentId ? currentId.startsWith("priv-") : false);
    const isPrivate = hasKeyword || isAlreadyPrivate;

    if (isPrivate) {
      // If no conversation exists or current is cloud-hosted, transition to local private store
      if (!currentId || !isAlreadyPrivate) {
        const newPrivId = isAlreadyPrivate && currentId ? currentId : `priv-conv-${Date.now()}`;
        const previousMessages = currentId && !isAlreadyPrivate ? [...messages] : [];

        // Purge cloud copy from server immediately
        if (currentId && !isAlreadyPrivate) {
          fetch(`${base}/api/conversations/${currentId}`, {
            method: "DELETE",
            credentials: "include",
            headers: getAuthHeaders(),
          }).catch(() => {});
        }

        const privRecord: PrivateStoredConversation = {
          id: newPrivId,
          userId: userKey,
          title: (currentId && !isAlreadyPrivate ? activeTitle : "") || text.slice(0, 30).trim() || "Private Space",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: previousMessages.map((m) => ({
            id: m.id,
            role: (m.role === "user" || m.role === "assistant" || m.role === "system" ? m.role : "user") as "user" | "assistant" | "system",
            content: m.content,
            createdAt: new Date().toISOString(),
            metadata: (m.metadata as Record<string, unknown>) || undefined,
          })),
          isPrivate: true,
        };

        await savePrivateConversation(privRecord);
        currentId = newPrivId;
        setActiveConversationId(newPrivId);
        setActiveTitle(privRecord.title);
        setConversations((prev) => [
          { id: newPrivId, title: privRecord.title, isPrivate: true, updatedAt: privRecord.updatedAt },
          ...prev.filter((c) => c.id !== newPrivId && c.id !== activeConversationId),
        ]);
      }

      // Add user message to UI and local storage
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMessage]);
      await appendPrivateMessage(currentId, userKey, {
        id: userMessage.id,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      });

      setActiveTab("chat");
      setIsStreaming(true);
      setStreamText("");
      setError("");

      try {
        const payloadMessages = [...messages, userMessage].map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));

        const response = await fetch(`${base}/api/conversations/ephemeral-stream`, {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ messages: payloadMessages, language: voice.voiceLanguage }),
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          throw new Error(payload?.error?.message ?? "AI service is temporarily unavailable.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let completedAssistant: ChatMessage | null = null;
        let streamSources: any[] = [];
        let streamImages: any[] = [];
        let streamError = "";

        const consumeEvent = (line: string) => {
          const parsed = parseAshviSseLine(line) as {
            type?: string;
            content?: string;
            assistant?: ChatMessage;
            sources?: any[];
            images?: any[];
            error?: string;
          } | null;
          if (!parsed) return;

          try {
            if (parsed.type === "chunk" && parsed.content) {
              setStreamText((current) => current + parsed.content);
            } else if (parsed.type === "sources" && Array.isArray(parsed.sources)) {
              streamSources = parsed.sources;
            } else if (parsed.type === "image" && Array.isArray(parsed.images)) {
              streamImages = parsed.images;
            } else if (parsed.type === "done" && parsed.assistant) {
              completedAssistant = parsed.assistant;
            } else if (parsed.type === "error") {
              streamError = parsed.error ?? "AI service is temporarily unavailable.";
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

        if (streamSources.length > 0 || streamImages.length > 0) {
          assistant.metadata = {
            ...(assistant.metadata || {}),
            ...(streamSources.length > 0 && !assistant.metadata?.sources ? { sources: streamSources } : {}),
            ...(streamImages.length > 0 && !assistant.metadata?.images ? { images: streamImages } : {}),
          };
        }

        await appendPrivateMessage(currentId, userKey, {
          id: assistant.id,
          role: "assistant",
          content: assistant.content,
          createdAt: new Date().toISOString(),
          metadata: (assistant.metadata as Record<string, unknown>) || undefined,
        });

        setMessages((prev) => [...prev, assistant]);
        setStreamText("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "AI service is temporarily unavailable.");
      } finally {
        setIsStreaming(false);
      }
      return;
    }

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
        throw new Error(payload?.error?.message ?? "AI service is temporarily unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completedAssistant: ChatMessage | null = null;
      let streamSources: any[] = [];
      let streamImages: any[] = [];
      let streamError = "";

      const consumeEvent = (line: string) => {
        const parsed = parseAshviSseLine(line) as {
          type?: string;
          content?: string;
          assistant?: ChatMessage;
          sources?: any[];
          images?: any[];
          error?: string;
        } | null;
        if (!parsed) return;

        try {
          if (parsed.type === "chunk" && parsed.content) {
            setStreamText((current) => current + parsed.content);
          } else if (parsed.type === "sources" && Array.isArray(parsed.sources)) {
            streamSources = parsed.sources;
          } else if (parsed.type === "image" && Array.isArray(parsed.images)) {
            streamImages = parsed.images;
          } else if (parsed.type === "done" && parsed.assistant) {
            completedAssistant = parsed.assistant;
          } else if (parsed.type === "error") {
            streamError = parsed.error ?? "AI service is temporarily unavailable.";
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

      if (streamSources.length > 0 || streamImages.length > 0) {
        assistant.metadata = {
          ...(assistant.metadata || {}),
          ...(streamSources.length > 0 && !assistant.metadata?.sources ? { sources: streamSources } : {}),
          ...(streamImages.length > 0 && !assistant.metadata?.images ? { images: streamImages } : {}),
        };
      }

      setMessages((prev) => [...prev, assistant]);
      setStreamText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI service is temporarily unavailable.");
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

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const isCurrentPrivate = Boolean(activeConv?.isPrivate) || (activeConversationId ? activeConversationId.startsWith("priv-") : false);

  // If user selected Notebook, render dedicated Notebook workspace
  if (activeTab === "notebook") {
    return (
      <AshviNotebookView
        onBack={() => setActiveTab("home")}
        userName={userName}
        onLogout={onLogout}
      />
    );
  }

  // If user selected Chat, render the dedicated Ashvi Chat Room experience
  if (activeTab === "chat") {
    return (
      <AshviChatView
        onBack={() => setActiveTab("home")}
        userName={userName}
        activeConversationId={activeConversationId}
        activeTitle={activeTitle}
        conversations={conversations}
        isPrivate={isCurrentPrivate}
        onSelectConversation={(id) => {
          const found = conversations.find((c) => c.id === id);
          openConversation(id, found?.title);
        }}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
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
        onLogout={onLogout}
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
          userName={userName}
          onLogout={onLogout}
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
            userName={userName}
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
          userName={userName}
          onLogout={onLogout}
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
