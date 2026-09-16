"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AshviCore } from "./ashvi-core";

const base = process.env.NEXT_PUBLIC_ASHVI_API_URL ?? "http://127.0.0.1:4000";

type TabKey = "chat" | "documents" | "memory";
type Conversation = { id: string; title: string };
type Message = { id: string; role: string; content: string };
type DocumentEntry = { id: string; filename: string; mimeType: string; status: string; createdAt?: string; _count?: { chunks: number } };
type MemoryEntry = { id: string; content: string; category?: string; source?: string; importance?: number };
type MemorySuggestion = { content: string; category: string; source: string; importance: number };
type StreamState = "idle" | "connecting" | "streaming";
type VoiceState = "idle" | "recording" | "transcribing" | "speaking";

export function ChatWorkspace() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [id, setId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [memoryItems, setMemoryItems] = useState<MemoryEntry[]>([]);
  const [memoryText, setMemoryText] = useState("");
  const [suggestion, setSuggestion] = useState<MemorySuggestion | null>(null);
  const [error, setError] = useState("");
  const [panelLoading, setPanelLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [previewId, setPreviewId] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceLanguage, setVoiceLanguage] = useState<"en" | "hi">("en");
  const [retryContent, setRetryContent] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("chat");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadPanels = async () => {
    try {
      const [conversationsResponse, documentsResponse, memoryResponse] = await Promise.all([
        fetch(`${base}/api/conversations`, { credentials: "include" }),
        fetch(`${base}/api/documents`, { credentials: "include" }),
        fetch(`${base}/api/memory`, { credentials: "include" }),
      ]);

      if (conversationsResponse.ok) {
        const data = await conversationsResponse.json().catch(() => null);
        if (Array.isArray(data)) setItems(data);
      }
      if (documentsResponse.ok) {
        const data = await documentsResponse.json().catch(() => null);
        if (Array.isArray(data)) setDocuments(data);
      }
      if (memoryResponse.ok) {
        const data = await memoryResponse.json().catch(() => null);
        if (Array.isArray(data)) setMemoryItems(data);
      }
    } finally {
      setPanelLoading(false);
    }
  };

  useEffect(() => {
    void loadPanels().catch(() => setError("Could not load Ashvi workspace data."));
    const refresh = window.setInterval(() => {
      void fetch(`${base}/api/documents`, { credentials: "include" })
        .then((response) => response.ok ? response.json().then((data) => Array.isArray(data) ? data : []) : [])
        .then(setDocuments)
        .catch(() => undefined);
    }, 2000);

    return () => window.clearInterval(refresh);
  }, []);

  const loadConversation = async (conversationId: string) => {
    const response = await fetch(`${base}/api/conversations/${conversationId}`, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Ashvi could not open that thread.");
    }

    const data = await response.json().catch(() => null);
    if (data && typeof data === "object" && Array.isArray((data as { messages?: Message[] }).messages)) {
      setMessages((data as { messages: Message[] }).messages);
      return;
    }

    throw new Error("Ashvi could not open that thread.");
  };

  const open = async (conversationId: string) => {
    setId(conversationId);
    setActiveTab("chat");
    setError("");
    try {
      await loadConversation(conversationId);
    } catch {
      setError("Ashvi could not open that thread.");
    }
  };

  const create = async () => {
    try {
      setError("");
      const response = await fetch(`${base}/api/conversations`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error();
      const conversation = await response.json();
      setItems((items) => [conversation, ...items]);
      await open(conversation.id);
    } catch {
      setError("Ashvi is offline. Start the backend and try again.");
    }
  };

  const uploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${base}/api/documents/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error?.message ?? "Document upload failed.");
      }

      const document = await response.json();
      setDocuments((current) => [document, ...current]);
      setActiveTab("documents");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const addMemory = async (event: FormEvent) => {
    event.preventDefault();
    const content = memoryText.trim();
    if (!content) return;

    try {
      setMemorySaving(true);
      const response = await fetch(`${base}/api/memory`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content,
          category: "FACT",
          source: "USER",
          importance: 3,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error?.message ?? "Memory could not be saved.");
      }

      const memory = await response.json();
      setMemoryItems((current) => [memory, ...current]);
      setMemoryText("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Memory could not be saved.");
    } finally {
      setMemorySaving(false);
    }
  };

  const deleteMemory = async (memoryId: string) => {
    try {
      const response = await fetch(`${base}/api/memory/${memoryId}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Memory could not be removed.");
      setMemoryItems((current) => current.filter((entry) => entry.id !== memoryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Memory could not be removed.");
    }
  };

  const updateMemory = async (entry: MemoryEntry) => {
    try {
      const response = await fetch(`${base}/api/memory/${entry.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: entry.content,
          category: entry.category,
          importance: entry.importance,
        }),
      });
      if (!response.ok) throw new Error("Memory could not be updated.");
      const updated = await response.json();
      setMemoryItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Memory could not be updated.");
    }
  };

  const saveSuggestion = async () => {
    if (!suggestion) return;
    try {
      const response = await fetch(`${base}/api/memory`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(suggestion),
      });
      if (!response.ok) throw new Error("Suggestion could not be saved.");
      const memory = await response.json();
      setMemoryItems((current) => [memory, ...current]);
      setSuggestion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suggestion could not be saved.");
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`${base}/api/documents/${documentId}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Document could not be removed.");
      setDocuments((current) => current.filter((entry) => entry.id !== documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document could not be removed.");
    }
  };

  const previewDocument = async (documentId: string) => {
    if (previewId === documentId) {
      setPreviewId("");
      setPreviewText("");
      return;
    }

    setPreviewId(documentId);
    setPreviewText("");
    setPreviewLoading(true);
    try {
      const response = await fetch(`${base}/api/documents/${documentId}/preview`, { credentials: "include" });
      if (!response.ok) throw new Error("Preview is not available yet.");
      const data = await response.json() as { preview?: string };
      setPreviewText(data.preview ?? "No extracted text is available yet.");
    } catch (err) {
      setPreviewText(err instanceof Error ? err.message : "Preview is not available yet.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const stopStream = () => {
    streamAbortRef.current?.abort();
  };

  const stopVoice = () => {
    if (voiceState === "recording") {
      recorderRef.current?.stop();
      return;
    }

    ttsAbortRef.current?.abort();
    audioRef.current?.pause();
    audioRef.current = null;
    setVoiceState("idle");
  };

  const speak = async (content: string) => {
    ttsAbortRef.current?.abort();
    audioRef.current?.pause();
    const controller = new AbortController();
    ttsAbortRef.current = controller;
    setVoiceState("speaking");

    try {
      const response = await fetch(`${base}/api/voice/synthesize`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: content, language: voiceLanguage }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "Ashvi voice output is unavailable.");
      }

      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setVoiceState("idle");
      };
      await audio.play();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Ashvi voice output is unavailable.");
      }
      setVoiceState("idle");
    } finally {
      if (ttsAbortRef.current === controller) ttsAbortRef.current = null;
    }
  };

  const startRecording = async () => {
    if (!id || streamState !== "idle" || voiceState !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser does not support local microphone recording.");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recordingStreamRef.current = mediaStream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        mediaStream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        void (async () => {
          try {
            setVoiceState("transcribing");
            const formData = new FormData();
            formData.append("audio", new Blob(chunks, { type: mimeType || "audio/webm" }), "recording.webm");
            const response = await fetch(`${base}/api/voice/transcribe?language=${voiceLanguage}`, {
              method: "POST",
              credentials: "include",
              body: formData,
            });
            const payload = await response.json().catch(() => null) as { transcript?: string; error?: { message?: string } } | null;
            if (!response.ok || !payload?.transcript) throw new Error(payload?.error?.message ?? "Ashvi could not understand the recording.");
            await sendContent(payload.transcript, true);
          } catch (err) {
            setVoiceState("idle");
            setError(err instanceof Error ? err.message : "Ashvi could not understand the recording.");
          }
        })();
      };
      recorder.start();
      setError("");
      setVoiceState("recording");
    } catch (err) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      setError(err instanceof DOMException && err.name === "NotAllowedError" ? "Microphone permission was denied." : "The microphone is unavailable.");
    }
  };

  const logout = async () => {
    await fetch(`${base}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
    window.location.reload();
  };

  const sendContent = async (content: string, speakResponse = false) => {
    if (!id || !content || streamState !== "idle") return;
    const userMessage = { id: `temp-user-${Date.now()}`, role: "USER", content };
    const assistantMessage = { id: `temp-assistant-${Date.now()}`, role: "ASSISTANT", content: "" };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setText("");
    setError("");
    setRetryContent("");
    setStreamState("connecting");
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const response = await fetch(`${base}/api/conversations/${id}/messages/stream`, {
        method: "POST",        credentials: "include",        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error?.message ?? "Ashvi could not respond.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("Ashvi stream is unavailable.");
      setStreamState("streaming");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = JSON.parse(trimmed.slice(5).trim()) as {
            type?: string;
            content?: string;
            assistant?: Message;
            error?: string;
            suggestion?: MemorySuggestion;
          };

          if (payload.type === "chunk" && payload.content) {
            setMessages((current) => current.map((message) =>
              message.id === assistantMessage.id ? { ...message, content: message.content + payload.content } : message,
            ));
          }

          if (payload.type === "memory_suggestion" && payload.suggestion) {
            setSuggestion(payload.suggestion as MemorySuggestion);
          }

          if (payload.type === "done" && payload.assistant) {
            setMessages((current) => current.map((message) => message.id === assistantMessage.id ? payload.assistant! : message));
            if (speakResponse) void speak(payload.assistant.content);
            return;
          }

          if (payload.type === "error") {
            setError(payload.error ?? "Ashvi could not respond.");
            setRetryContent(content);
            setMessages((current) => current.filter((message) => message.id !== assistantMessage.id && message.id !== userMessage.id));
            return;
          }
        }
      }
    } catch (err) {
      const stopped = err instanceof DOMException && err.name === "AbortError";
      setError(stopped ? "Response stopped." : err instanceof Error ? err.message : "Ashvi is offline. Start the backend and try again.");
      setRetryContent(content);
      setMessages((current) => current.filter((message) => message.id !== assistantMessage.id && message.id !== userMessage.id));
      if (speakResponse) setVoiceState("idle");
    } finally {
      setStreamState("idle");
      streamAbortRef.current = null;
    }
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    void sendContent(content);
  };

  return (
    <main className="ashvi-shell">
      <aside className="ashvi-nav">
        <div className="brand-block">
          <p>ASHVI</p>
          <span>Only Ashvi</span>
        </div>

        <button className="primary-action" onClick={() => void create()}>New space</button>

        <nav className="nav-tabs">
          <button className={activeTab === "chat" ? "active" : ""} onClick={() => setActiveTab("chat")}>Chat</button>
          <button className={activeTab === "documents" ? "active" : ""} onClick={() => setActiveTab("documents")}>Documents</button>
          <button className={activeTab === "memory" ? "active" : ""} onClick={() => setActiveTab("memory")}>Memory</button>
        </nav>

        <div className="conversation-list">
          {panelLoading ? (
            <div className="loading-state">Loading spaces…</div>
          ) : items.length === 0 ? (
            <div className="nav-empty">Your first space starts here.</div>
          ) : items.map((conversation) => (
            <button key={conversation.id} className={conversation.id === id ? "conversation-item active" : "conversation-item"} onClick={() => void open(conversation.id)}>
              <strong>{conversation.title}</strong>
              <small>Active thread</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="ashvi-space">
        <header>
          <span>ASHVI</span>
          <div className="header-actions"><small>● Present · ready</small><button className="header-button" onClick={() => void logout()}>Lock</button></div>
        </header>

        <div className="ashvi-stage">
          {activeTab === "chat" && !id && (
            <>
              <AshviCore />
              <small className="eyebrow">ONLY ASHVI</small>
              <h1>What shall we explore today?</h1>
              <p>Build · Research · Analyze · Create</p>
              <div className="capabilities">
                <button onClick={() => void create()}>Build</button>
                <button onClick={() => void create()}>Research</button>
                <button onClick={() => void create()}>Analyze</button>
                <button onClick={() => void create()}>Create</button>
              </div>
            </>
          )}

          {activeTab === "documents" && (
            <div className="workspace-panel">
              <div className="panel-header">
                <div>
                  <small className="eyebrow">DOCUMENTS</small>
                  <h2>Working knowledge</h2>
                </div>
                <button className="ghost-button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? "Uploading…" : "Upload"}</button>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={uploadDocument} />
              </div>

              <div className="library-grid">
                {panelLoading ? (
                  <div className="loading-state">Loading your document library…</div>
                ) : documents.length === 0 ? (
                  <div className="empty-state">
                    <strong>Your library is ready.</strong>
                    <span>Upload a brief, note, or research file to give Ashvi grounded source material.</span>
                    <button className="ghost-button" onClick={() => fileInputRef.current?.click()}>Choose a file</button>
                  </div>
                ) : (
                  documents.map((document) => (
                    <article key={document.id} className="library-card">
                      <span className="badge">{document.status.toLowerCase()}</span>
                      <h3>{document.filename}</h3>
                      <p>{document.mimeType || "Uploaded file"}{document._count ? ` · ${document._count.chunks} chunks` : ""}</p>
                      <div className="card-actions">
                        <button className="ghost-button" onClick={() => void previewDocument(document.id)}>{previewId === document.id ? "Hide preview" : "Preview"}</button>
                        <button className="ghost-button" onClick={() => void deleteDocument(document.id)}>Remove</button>
                      </div>
                      {previewId === document.id && (
                        <div className="document-preview">
                          {previewLoading ? "Preparing preview…" : previewText || "No extracted text is available yet."}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "memory" && (
            <div className="workspace-panel">
              <div className="panel-header">
                <div>
                  <small className="eyebrow">MEMORY</small>
                  <h2>Context snapshots</h2>
                </div>
              </div>

              <form onSubmit={addMemory} className="ashvi-form">
                <input
                  value={memoryText}
                  onChange={(event) => setMemoryText(event.target.value)}
                  disabled={memorySaving}
                  placeholder="Save an important user preference or context…"
                />
                <button className="ghost-button" type="submit" disabled={memorySaving || !memoryText.trim()}>{memorySaving ? "Saving…" : "Save memory"}</button>
              </form>

              <div className="memory-list">
                {panelLoading ? (
                  <div className="loading-state">Loading Ashvi&apos;s memory…</div>
                ) : memoryItems.length === 0 ? (
                  <div className="empty-state">
                    <strong>No saved context yet.</strong>
                    <span>Add a preference, fact, or instruction below. Ashvi will use relevant memories in future conversations.</span>
                  </div>
                ) : (
                  memoryItems.map((entry) => (
                    <div key={entry.id} className="memory-item">
                      <div className="memory-controls">
                        <select
                          value={entry.category ?? "OTHER"}
                          onChange={(event) => setMemoryItems((current) => current.map((item) => item.id === entry.id ? { ...item, category: event.target.value } : item))}
                          aria-label="Memory category"
                        >
                          <option value="PREFERENCE">Preference</option>
                          <option value="FACT">Fact</option>
                          <option value="INSTRUCTION">Instruction</option>
                          <option value="OTHER">Other</option>
                        </select>
                        <input
                          className="memory-importance"
                          type="number"
                          min="1"
                          max="5"
                          value={entry.importance ?? 3}
                          onChange={(event) => setMemoryItems((current) => current.map((item) => item.id === entry.id ? { ...item, importance: Number(event.target.value) } : item))}
                          aria-label="Memory importance"
                        />
                      </div>
                      <textarea
                        value={entry.content}
                        onChange={(event) => setMemoryItems((current) => current.map((item) => item.id === entry.id ? { ...item, content: event.target.value } : item))}
                        aria-label="Memory content"
                      />
                      <div className="memory-actions">
                        <button className="ghost-button" type="button" onClick={() => void updateMemory(entry)}>Save changes</button>
                        <button className="ghost-button" type="button" onClick={() => void deleteMemory(entry.id)}>Forget</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "chat" && id && (
            <div className="chat-panel">
              <div className="chat-header">
                <div>
                  <small className="eyebrow">ACTIVE THREAD</small>
                  <h2>{items.find((item) => item.id === id)?.title ?? "Conversation"}</h2>
                </div>
              </div>

              <div className="chat-stream">
                {suggestion && (
                  <div className="memory-suggestion">
                    <div>
                      <span>MEMORY SUGGESTION</span>
                      <p>{suggestion.content}</p>
                    </div>
                    <div className="memory-actions">
                      <button className="ghost-button" type="button" onClick={() => void saveSuggestion()}>Remember</button>
                      <button className="ghost-button" type="button" onClick={() => setSuggestion(null)}>Dismiss</button>
                    </div>
                  </div>
                )}
                {messages.length === 0 ? (
                  <div className="empty-state">Start with a prompt and Ashvi will respond in context.</div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={message.role === "USER" ? "message user" : "message"}>
                      <span>{message.role === "USER" ? "You" : "Ashvi"}</span>
                      <p>{message.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="error-banner">
              <span>{error}</span>
              {retryContent && <button className="ghost-button" type="button" onClick={() => { setText(retryContent); setError(""); }}>Retry</button>}
            </div>
          )}
        </div>

        {activeTab === "chat" && (
          <form className="ashvi-form" onSubmit={send}>
            {streamState !== "idle" && <span className="stream-status">{streamState === "connecting" ? "Connecting to Ashvi…" : "Ashvi is thinking…"}</span>}
            <input
              aria-label="Command Ashvi"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={!id || streamState !== "idle"}
              placeholder={id ? "Ask Ashvi anything…" : "Choose a capability or begin"}
            />
            <div className="voice-controls">
              <select aria-label="Voice language" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value as "en" | "hi")} disabled={voiceState !== "idle" || streamState !== "idle"}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
              <button className={voiceState === "recording" ? "voice-button recording" : "voice-button"} type="button" onClick={() => voiceState === "idle" ? void startRecording() : stopVoice()} disabled={!id || streamState !== "idle" || voiceState === "transcribing"} aria-label={voiceState === "recording" ? "Stop recording" : voiceState === "speaking" ? "Stop voice output" : "Start voice input"}>
                {voiceState === "recording" ? "Stop recording" : voiceState === "transcribing" ? "Understanding…" : voiceState === "speaking" ? "Stop voice" : "Talk to Ashvi"}
              </button>
            </div>
            {streamState !== "idle" && <button className="ghost-button" type="button" onClick={stopStream}>Stop</button>}
            {voiceState === "recording" && <span className="voice-status">Listening locally…</span>}
            {voiceState === "transcribing" && <span className="voice-status">Converting speech locally…</span>}
            {voiceState === "speaking" && <span className="voice-status">Ashvi is speaking…</span>}
          </form>
        )}
      </section>
    </main>
  );
}
