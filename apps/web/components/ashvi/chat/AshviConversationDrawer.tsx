"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Plus, Search, Trash2, Edit3, X, Check } from "lucide-react";

export interface ConversationItem {
  id: string;
  title: string;
  updatedAt?: string | Date;
  createdAt?: string | Date;
  messages?: Array<{
    content: string;
    role?: string;
    createdAt?: string | Date;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
}

export function AshviConversationDrawer({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter conversations safely by title or latest message snippet
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase().trim();
    return conversations.filter((c) => {
      const matchTitle = (c.title || "").toLowerCase().includes(query);
      const latestMsg = c.messages?.[0]?.content || "";
      const matchMsg = latestMsg.toLowerCase().includes(query);
      return matchTitle || matchMsg;
    });
  }, [conversations, searchQuery]);

  if (!isOpen) return null;

  const startRename = (conv: ConversationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title || "Conversation");
  };

  const submitRename = async (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editTitle.trim()) return;
    try {
      await onRenameConversation(id, editTitle.trim());
    } finally {
      setEditingId(null);
    }
  };

  const confirmDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId === id) {
      await onDeleteConversation(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => {
        setDeletingId((curr) => (curr === id ? null : curr));
      }, 4000);
    }
  };

  const formatRelativeTime = (timestamp?: string | Date) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="ashvi-drawer-overlay" onClick={onClose} aria-label="Close conversation drawer">
      <div
        className="ashvi-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Conversations"
      >
        {/* Drawer Header */}
        <div className="ashvi-drawer-header">
          <div className="ashvi-drawer-title-row">
            <div className="ashvi-drawer-title">
              <MessageSquare size={16} />
              <span>Conversations</span>
              <span className="ashvi-drawer-count">{conversations.length}</span>
            </div>
            <button
              type="button"
              className="ashvi-drawer-close-btn"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>

          {/* New Conversation Button */}
          <button
            type="button"
            className="ashvi-drawer-new-btn"
            onClick={() => {
              onNewConversation();
              onClose();
            }}
          >
            <Plus size={16} />
            <span>New Conversation</span>
          </button>

          {/* Search Input */}
          <div className="ashvi-drawer-search">
            <Search size={14} className="ashvi-drawer-search-icon" />
            <input
              type="text"
              className="ashvi-drawer-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              aria-label="Search conversations"
            />
            {searchQuery && (
              <button
                type="button"
                className="ashvi-drawer-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="ashvi-drawer-list">
          {filteredConversations.length === 0 ? (
            <div className="ashvi-drawer-empty">
              <p>{searchQuery ? "No matching conversations" : "No conversations yet."}</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const isEditing = editingId === conv.id;
              const isConfirmingDelete = deletingId === conv.id;
              const latestMsg = conv.messages?.[0]?.content;
              const timeStr = formatRelativeTime(conv.updatedAt || conv.createdAt);

              return (
                <div
                  key={conv.id}
                  className={`ashvi-drawer-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    if (!isEditing) {
                      onSelectConversation(conv.id);
                      onClose();
                    }
                  }}
                >
                  <div className="ashvi-drawer-item-content">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => submitRename(conv.id, e)}
                        className="ashvi-drawer-rename-form"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          className="ashvi-drawer-rename-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button type="submit" className="ashvi-drawer-rename-save" title="Save title">
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          className="ashvi-drawer-rename-cancel"
                          onClick={() => setEditingId(null)}
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="ashvi-drawer-item-title-row">
                          <span className="ashvi-drawer-item-title">{conv.title || "Conversation"}</span>
                          {timeStr && <span className="ashvi-drawer-item-time">{timeStr}</span>}
                        </div>
                        {latestMsg && (
                          <p className="ashvi-drawer-item-preview">{latestMsg}</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {!isEditing && (
                    <div className="ashvi-drawer-item-actions">
                      <button
                        type="button"
                        className="ashvi-drawer-action-btn"
                        onClick={(e) => startRename(conv, e)}
                        title="Rename conversation"
                        aria-label="Rename conversation"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        className={`ashvi-drawer-action-btn delete ${isConfirmingDelete ? "confirm" : ""}`}
                        onClick={(e) => confirmDelete(conv.id, e)}
                        title={isConfirmingDelete ? "Click again to confirm delete" : "Delete conversation"}
                        aria-label="Delete conversation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
