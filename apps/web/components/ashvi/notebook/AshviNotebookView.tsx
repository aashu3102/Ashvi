"use client";

import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  FileText,
  Send,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  ChevronRight,
  File,
  StickyNote,
} from "lucide-react";
import { getApiBaseUrl, getAuthHeaders } from "@/lib/api";

interface Notebook {
  id: string;
  title: string;
  description?: string;
  documentIds: string[];
  notes?: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface UserDocument {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
}

interface QueryResult {
  id: string;
  prompt: string;
  answer: string;
  citations?: string[];
  chunksUsed?: number;
  timestamp: string;
}

interface Props {
  onBack: () => void;
  userName?: string | null;
  onLogout?: () => void;
}

export function AshviNotebookView({ onBack, userName, onLogout }: Props) {
  const base = getApiBaseUrl();

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);

  const [allDocuments, setAllDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New Notebook modal state
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Note editor state
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Scoped Query state
  const [queryPrompt, setQueryPrompt] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryResult[]>([]);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 1. Fetch all notebooks
  const fetchNotebooks = async () => {
    try {
      const res = await fetch(`${base}/api/notebooks`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setNotebooks(data);
        if (data.length > 0 && !activeNotebookId) {
          setActiveNotebookId(data[0].id);
        }
      }
    } catch {
      setError("Failed to load notebooks.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch all user documents
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${base}/api/documents`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAllDocuments(data);
        }
      }
    } catch {
      // Non-critical
    }
  };

  // 3. Fetch active notebook details
  const fetchActiveNotebook = async (id: string) => {
    try {
      const res = await fetch(`${base}/api/notebooks/${id}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveNotebook(data);
      }
    } catch {
      setError("Failed to load active notebook details.");
    }
  };

  useEffect(() => {
    fetchNotebooks();
    fetchDocuments();
  }, [base]);

  useEffect(() => {
    if (activeNotebookId) {
      fetchActiveNotebook(activeNotebookId);
    } else {
      setActiveNotebook(null);
    }
  }, [activeNotebookId]);

  // Create Notebook
  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch(`${base}/api/notebooks`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Could not create notebook.");
      const created = await res.json();
      setNotebooks((prev) => [created, ...prev]);
      setActiveNotebookId(created.id);
      setIsCreatingNotebook(false);
      setNewTitle("");
      setNewDesc("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create notebook.");
    }
  };

  // Delete Notebook
  const handleDeleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this notebook?")) return;

    try {
      const res = await fetch(`${base}/api/notebooks/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete notebook.");

      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      if (activeNotebookId === id) {
        const remaining = notebooks.filter((n) => n.id !== id);
        setActiveNotebookId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete notebook.");
    }
  };

  // Attach or Detach Document to active notebook
  const handleToggleDocument = async (docId: string) => {
    if (!activeNotebookId || !activeNotebook) return;

    const isAttached = activeNotebook.documentIds.includes(docId);
    try {
      if (isAttached) {
        // Detach
        const res = await fetch(`${base}/api/notebooks/${activeNotebookId}/documents/${docId}`, {
          method: "DELETE",
          credentials: "include",
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const result = await res.json();
          setActiveNotebook((prev) => (prev ? { ...prev, documentIds: result.documentIds } : null));
          setNotebooks((prev) =>
            prev.map((n) => (n.id === activeNotebookId ? { ...n, documentIds: result.documentIds } : n))
          );
        }
      } else {
        // Attach
        const res = await fetch(`${base}/api/notebooks/${activeNotebookId}/documents`, {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ documentIds: [docId] }),
        });
        if (res.ok) {
          const result = await res.json();
          setActiveNotebook((prev) => (prev ? { ...prev, documentIds: result.documentIds } : null));
          setNotebooks((prev) =>
            prev.map((n) => (n.id === activeNotebookId ? { ...n, documentIds: result.documentIds } : n))
          );
        }
      }
    } catch {
      setError("Failed to update notebook documents.");
    }
  };

  // Upload Document directly
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${base}/api/documents/upload`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed.");

      await fetchDocuments();
      if (activeNotebookId) {
        await fetchActiveNotebook(activeNotebookId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save Note to active notebook
  const handleSaveNote = async () => {
    if (!activeNotebookId || !noteTitle.trim() || !noteContent.trim()) return;

    setIsSavingNote(true);
    try {
      const res = await fetch(`${base}/api/notebooks/${activeNotebookId}/notes`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({
          title: noteTitle.trim(),
          content: noteContent.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to save note.");
      const newNote = await res.json();

      setActiveNotebook((prev) =>
        prev
          ? {
              ...prev,
              notes: [newNote, ...(prev.notes || [])],
            }
          : null
      );
      setNoteTitle("");
      setNoteContent("");
      setActiveNoteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  // Scoped Query Ashvi
  const handleQueryNotebook = async (promptToSend?: string) => {
    const text = (promptToSend || queryPrompt).trim();
    if (!activeNotebookId || !text || isQuerying) return;

    setIsQuerying(true);
    setQueryPrompt("");
    try {
      const res = await fetch(`${base}/api/notebooks/${activeNotebookId}/query`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ prompt: text }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error?.message || "Notebook query failed.");
      }

      const data = await res.json();
      const newEntry: QueryResult = {
        id: `q-${Date.now()}`,
        prompt: text,
        answer: data.answer,
        citations: data.citations,
        chunksUsed: data.chunksUsed,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setQueryHistory((prev) => [newEntry, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ashvi could not analyze the notebook.");
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        background: "#030712",
        color: "#f8fafc",
        overflow: "hidden",
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(10, 15, 26, 0.85)",
          backdropFilter: "blur(16px)",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#cbd5e1",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #d4af37, #9a7b20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 12px rgba(212, 175, 55, 0.4)",
              }}
            >
              <BookOpen size={16} color="#030712" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontFamily: '"Cormorant Garamond", Georgia, serif',
                    fontSize: "16px",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "#f8fafc",
                  }}
                >
                  ASHVI NOTEBOOK
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 600,
                    background: "rgba(56, 189, 248, 0.12)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                  }}
                >
                  <Lock size={9} />
                  <span>Scoped RAG Isolation</span>
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Grounded document intelligence • Private to {userName || "User"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                background: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#94a3b8",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Error Notice */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 20px",
            background: "rgba(239, 68, 68, 0.15)",
            borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#fca5a5",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main 3-Column Workspace */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Panel 1: Notebooks & Documents List (Width: 280px) */}
        <div
          style={{
            width: "280px",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(13, 18, 30, 0.6)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* Notebook Header Action */}
          <div
            style={{
              padding: "16px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em" }}>
              MY NOTEBOOKS
            </span>
            <button
              type="button"
              onClick={() => setIsCreatingNotebook(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "6px",
                background: "rgba(212, 175, 55, 0.15)",
                border: "1px solid rgba(212, 175, 55, 0.3)",
                color: "#d4af37",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Plus size={12} />
              <span>New</span>
            </button>
          </div>

          {/* New Notebook Modal/Input */}
          {isCreatingNotebook && (
            <form
              onSubmit={handleCreateNotebook}
              style={{
                padding: "12px",
                margin: "10px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(212, 175, 55, 0.3)",
              }}
            >
              <input
                type="text"
                placeholder="Notebook title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: "4px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#f8fafc",
                  fontSize: "12px",
                  marginBottom: "6px",
                  outline: "none",
                }}
              />
              <input
                type="text"
                placeholder="Optional description..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: "4px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#cbd5e1",
                  fontSize: "11px",
                  marginBottom: "8px",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setIsCreatingNotebook(false)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "3px 10px",
                    borderRadius: "4px",
                    background: "#d4af37",
                    border: "none",
                    color: "#0f172a",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {/* Notebooks List */}
          <div style={{ flex: 1, padding: "8px" }}>
            {notebooks.length === 0 && !loading && (
              <div style={{ padding: "20px 12px", textAlign: "center", color: "#64748b", fontSize: "12px" }}>
                No notebooks created yet. Click "+ New" to start your first research workspace.
              </div>
            )}

            {notebooks.map((nb) => {
              const isActive = nb.id === activeNotebookId;
              return (
                <div
                  key={nb.id}
                  onClick={() => setActiveNotebookId(nb.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    marginBottom: "4px",
                    cursor: "pointer",
                    background: isActive ? "rgba(212, 175, 55, 0.12)" : "transparent",
                    border: isActive ? "1px solid rgba(212, 175, 55, 0.3)" : "1px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? "#f8fafc" : "#cbd5e1",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {nb.title}
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                      {nb.documentIds?.length || 0} docs • {nb.notes?.length || 0} notes
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteNotebook(nb.id, e)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                    title="Delete notebook"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Attached Documents in Active Notebook */}
          {activeNotebook && (
            <div
              style={{
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "14px",
                background: "rgba(0, 0, 0, 0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em" }}>
                  ATTACHED SOURCES ({activeNotebook.documentIds.length})
                </span>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "10px",
                    color: "#38bdf8",
                    cursor: "pointer",
                  }}
                >
                  <Upload size={11} />
                  <span>{isUploading ? "Uploading..." : "Upload"}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                    disabled={isUploading}
                  />
                </label>
              </div>

              {allDocuments.length === 0 ? (
                <div style={{ fontSize: "11px", color: "#64748b", padding: "8px 0" }}>
                  No uploaded documents yet. Upload a file above.
                </div>
              ) : (
                <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {allDocuments.map((doc) => {
                    const isAttached = activeNotebook.documentIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleToggleDocument(doc.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          background: isAttached ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.02)",
                          border: isAttached ? "1px solid rgba(56, 189, 248, 0.25)" : "1px solid rgba(255, 255, 255, 0.05)",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        <CheckCircle2
                          size={13}
                          color={isAttached ? "#38bdf8" : "#475569"}
                          style={{ flexShrink: 0 }}
                        />
                        <span
                          style={{
                            color: isAttached ? "#e2e8f0" : "#94a3b8",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={doc.filename}
                        >
                          {doc.filename}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel 2: Notes Editor & Document Library (Width: 40%) */}
        <div
          style={{
            flex: "1 1 40%",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            background: "rgba(8, 12, 22, 0.4)",
            overflowY: "auto",
          }}
        >
          {activeNotebook ? (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Notebook Title & Meta */}
              <div>
                <h2
                  style={{
                    fontFamily: '"Cormorant Garamond", Georgia, serif',
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "#f8fafc",
                    margin: 0,
                  }}
                >
                  {activeNotebook.title}
                </h2>
                {activeNotebook.description && (
                  <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px", marginBottom: 0 }}>
                    {activeNotebook.description}
                  </p>
                )}
              </div>

              {/* Note Editor Card */}
              <div
                style={{
                  borderRadius: "12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#d4af37", fontWeight: 600 }}>
                  <StickyNote size={14} />
                  <span>{activeNoteId ? "Viewing Note" : "Create Note"}</span>
                </div>

                <input
                  type="text"
                  placeholder="Note title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />

                <textarea
                  placeholder="Type notes, synthesis, or document observations..."
                  rows={6}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#e2e8f0",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    outline: "none",
                    resize: "vertical",
                  }}
                />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  {activeNoteId && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveNoteId(null);
                        setNoteTitle("");
                        setNoteContent("");
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        background: "transparent",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "#94a3b8",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={isSavingNote || !noteTitle.trim() || !noteContent.trim()}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      background: isSavingNote || !noteTitle.trim() || !noteContent.trim() ? "rgba(212, 175, 55, 0.3)" : "#d4af37",
                      border: "none",
                      color: "#0f172a",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: isSavingNote || !noteTitle.trim() || !noteContent.trim() ? "not-allowed" : "pointer",
                    }}
                  >
                    {isSavingNote ? "Saving..." : "Save Note"}
                  </button>
                </div>
              </div>

              {/* Saved Notes in this Notebook */}
              <div style={{ marginTop: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: "10px" }}>
                  SAVED NOTES ({activeNotebook.notes?.length || 0})
                </div>

                {(!activeNotebook.notes || activeNotebook.notes.length === 0) ? (
                  <div style={{ color: "#64748b", fontSize: "12px", fontStyle: "italic" }}>
                    No notes saved in this notebook yet. Write your thoughts above.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {activeNotebook.notes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => {
                          setActiveNoteId(note.id);
                          setNoteTitle(note.title);
                          setNoteContent(note.content);
                        }}
                        style={{
                          padding: "12px",
                          borderRadius: "8px",
                          background: activeNoteId === note.id ? "rgba(212, 175, 55, 0.1)" : "rgba(255, 255, 255, 0.03)",
                          border: activeNoteId === note.id ? "1px solid rgba(212, 175, 55, 0.3)" : "1px solid rgba(255, 255, 255, 0.06)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc", marginBottom: "4px" }}>
                          {note.title}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#94a3b8",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            lineHeight: "1.4",
                          }}
                        >
                          {note.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748b", fontSize: "13px" }}>
              Select or create a notebook from the left panel to begin.
            </div>
          )}
        </div>

        {/* Panel 3: Scoped Document Q&A / Ask Ashvi (Remaining width) */}
        <div
          style={{
            flex: "1 1 35%",
            display: "flex",
            flexDirection: "column",
            background: "rgba(5, 8, 16, 0.7)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={14} color="#d4af37" />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc" }}>Ask Ashvi</span>
            </div>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {activeNotebook?.documentIds.length || 0} documents in context
            </span>
          </div>

          {/* Quick Prompts */}
          <div
            style={{
              padding: "8px 16px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            {[
              "Summarize attached documents",
              "Extract key findings",
              "What are the main risks?",
              "List key action items",
            ].map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQueryNotebook(qp)}
                disabled={isQuerying || !activeNotebook}
                style={{
                  padding: "4px 10px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "#94a3b8",
                  fontSize: "11px",
                  cursor: isQuerying || !activeNotebook ? "not-allowed" : "pointer",
                }}
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Answers Stream / History */}
          <div
            style={{
              flex: 1,
              padding: "16px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {queryHistory.length === 0 && (
              <div
                style={{
                  margin: "auto",
                  textAlign: "center",
                  maxWidth: "280px",
                  color: "#64748b",
                  fontSize: "12px",
                }}
              >
                <BookOpen size={28} color="#334155" style={{ margin: "0 auto 10px auto" }} />
                <p>Ask questions grounded directly in the documents attached to this notebook.</p>
              </div>
            )}

            {queryHistory.map((item) => (
              <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* User Prompt */}
                <div
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: "85%",
                    padding: "8px 12px",
                    borderRadius: "12px 12px 2px 12px",
                    background: "#1e293b",
                    color: "#f8fafc",
                    fontSize: "12.5px",
                  }}
                >
                  {item.prompt}
                </div>

                {/* Ashvi Scoped Response */}
                <div
                  style={{
                    alignSelf: "flex-start",
                    maxWidth: "92%",
                    padding: "12px 14px",
                    borderRadius: "12px 12px 12px 2px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(212, 175, 55, 0.2)",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    color: "#e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", fontSize: "11px", color: "#d4af37", fontWeight: 700 }}>
                    <span>ASHVI</span>
                    <span style={{ color: "#64748b", fontWeight: 400 }}>• {item.timestamp}</span>
                  </div>

                  <div style={{ whiteSpace: "pre-wrap" }}>{item.answer}</div>

                  {item.citations && item.citations.length > 0 && (
                    <div
                      style={{
                        marginTop: "10px",
                        paddingTop: "8px",
                        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                        fontSize: "11px",
                        color: "#94a3b8",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#38bdf8" }}>Evidence Sources:</span>
                      <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px" }}>
                        {item.citations.map((c, cIdx) => (
                          <li key={cIdx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isQuerying && (
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  fontSize: "12px",
                  color: "#94a3b8",
                  fontStyle: "italic",
                }}
              >
                Ashvi is retrieving document chunks and synthesizing answer...
              </div>
            )}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleQueryNotebook();
            }}
            style={{
              padding: "12px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(10, 15, 26, 0.8)",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              placeholder={
                !activeNotebook
                  ? "Select a notebook first..."
                  : activeNotebook.documentIds.length === 0
                  ? "Attach documents or ask a question..."
                  : "Ask about attached documents..."
              }
              value={queryPrompt}
              onChange={(e) => setQueryPrompt(e.target.value)}
              disabled={isQuerying || !activeNotebook}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#f8fafc",
                fontSize: "12.5px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={isQuerying || !queryPrompt.trim() || !activeNotebook}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                background: isQuerying || !queryPrompt.trim() || !activeNotebook ? "rgba(212, 175, 55, 0.3)" : "#d4af37",
                border: "none",
                color: "#0f172a",
                cursor: isQuerying || !queryPrompt.trim() || !activeNotebook ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
