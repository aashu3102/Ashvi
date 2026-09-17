"use client";

import { useState } from "react";
import { ArrowLeft, Check, Edit3, MessageSquare, Plus, Search, Trash2, X, LogOut } from "lucide-react";
import type { ConversationItem } from "./AshviConversationDrawer";

interface Props {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onBack: () => void;
  userName?: string | null;
  className?: string;
  onCloseMobileDrawer?: () => void;
  onLogout?: () => void;
}

export function AshviChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onBack,
  userName,
  className = "",
  onCloseMobileDrawer,
  onLogout,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (c.title || "").toLowerCase().includes(q);
  });

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

  const displayName = userName ? userName.trim().split(" ")[0] : "Aashu";

  return (
    <aside className={`ashvi-chat-solid-sidebar ${className}`} aria-label="Chat conversations">
      {/* Top Row: Back to Dashboard */}
      <div className="ashvi-chat-sidebar-top-nav">
        <button
          type="button"
          className="ashvi-chat-sidebar-back-btn"
          onClick={onBack}
          title="Back to Dashboard"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>

        {onCloseMobileDrawer && (
          <button
            type="button"
            className="ashvi-chat-sidebar-close-mobile"
            onClick={onCloseMobileDrawer}
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Ashvi Blade Logo + ASHVI Branding directly below Dashboard button */}
      <div className="ashvi-chat-sidebar-brand-block">
        <svg
          className="ashvi-brand-blade-emblem"
          viewBox="0 0 60 70"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ width: "26px", height: "30px" }}
        >
          <path
            d="M30 4 L38 28 L48 34 L36 38 L38 64 L30 52 L22 64 L24 38 L12 34 L22 28 Z"
            fill="url(#sidebar-sword-gold)"
            stroke="#f0d575"
            strokeWidth="1.2"
          />
          <line x1="30" y1="4" x2="30" y2="52" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="30" cy="38" r="3" fill="#7ee8fa" />
          <defs>
            <linearGradient id="sidebar-sword-gold" x1="12" y1="4" x2="48" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f5ede0" />
              <stop offset="40%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#9a7b20" />
            </linearGradient>
          </defs>
        </svg>
        <div className="ashvi-chat-brand-meta">
          <span className="ashvi-chat-brand-name">ASHVI</span>
          <span className="ashvi-chat-brand-tagline">LIVING INTELLIGENCE</span>
        </div>
      </div>

      {/* New Conversation Button */}
      <div className="ashvi-chat-sidebar-action-wrap">
        <button
          type="button"
          className="ashvi-chat-btn-new-conv"
          onClick={() => {
            onNewConversation();
            if (onCloseMobileDrawer) onCloseMobileDrawer();
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Recent Chats Section */}
      <div className="ashvi-chat-sidebar-recent-head">
        <div className="ashvi-chat-recent-title-group">
          <MessageSquare size={13} className="ashvi-chat-recent-icon" />
          <span className="ashvi-chat-recent-title">RECENT CHATS</span>
        </div>
        {conversations.length > 0 && (
          <span className="ashvi-chat-recent-count">{conversations.length}</span>
        )}
      </div>

      {/* Search Filter (shown only if conversations exist) */}
      {conversations.length > 3 && (
        <div className="ashvi-chat-sidebar-search">
          <Search size={13} className="ashvi-search-icon" />
          <input
            type="text"
            className="ashvi-search-input"
            placeholder="Filter chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="ashvi-search-clear"
              onClick={() => setSearchQuery("")}
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Scrollable Conversation List */}
      <div className="ashvi-chat-sidebar-list">
        {filteredConversations.length === 0 ? (
          <div className="ashvi-chat-sidebar-empty">
            <p>{searchQuery ? "No matching conversations" : "No conversations yet"}</p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = editingId === conv.id;
            const isConfirmingDelete = deletingId === conv.id;

            return (
              <div
                key={conv.id}
                className={`ashvi-chat-conv-item ${isActive ? "active" : ""}`}
                onClick={() => {
                  if (!isEditing) {
                    onSelectConversation(conv.id);
                    if (onCloseMobileDrawer) onCloseMobileDrawer();
                  }
                }}
              >
                {isEditing ? (
                  <form
                    onSubmit={(e) => submitRename(conv.id, e)}
                    className="ashvi-conv-rename-form"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      className="ashvi-conv-rename-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button type="submit" className="ashvi-conv-action-save" title="Save">
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      className="ashvi-conv-action-cancel"
                      onClick={() => setEditingId(null)}
                      title="Cancel"
                    >
                      <X size={12} />
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="ashvi-conv-dot" />
                    <span className="ashvi-conv-title">{conv.title || "Conversation"}</span>

                    <div className="ashvi-conv-hover-actions">
                      <button
                        type="button"
                        className="ashvi-conv-btn"
                        onClick={(e) => startRename(conv, e)}
                        title="Rename"
                        aria-label="Rename"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        type="button"
                        className={`ashvi-conv-btn delete ${isConfirmingDelete ? "confirm" : ""}`}
                        onClick={(e) => confirmDelete(conv.id, e)}
                        title={isConfirmingDelete ? "Click to confirm delete" : "Delete"}
                        aria-label="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom User Area */}
      <div className="ashvi-chat-sidebar-bottom" style={{ position: "relative" }}>
        {/* Profile Popover Menu */}
        {isProfileOpen && (
          <>
            <div
              className="ashvi-profile-menu-backdrop"
              onClick={() => setIsProfileOpen(false)}
              aria-hidden="true"
            />
            <div
              className="ashvi-profile-menu-popover"
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: "12px",
                right: "12px",
              }}
              role="menu"
              aria-label="User Profile"
            >
              <div className="ashvi-profile-menu-header">
                <div className="ashvi-chat-avatar" style={{ width: "26px", height: "26px", fontSize: "10px" }}>
                  {displayName.substring(0, 2).toUpperCase()}
                </div>
                <div className="ashvi-profile-menu-meta">
                  <span className="ashvi-profile-name">{displayName}</span>
                  <span className="ashvi-profile-status">Authenticated Session</span>
                </div>
              </div>

              <div className="ashvi-profile-menu-divider" />

              {onLogout && (
                <button
                  type="button"
                  className="ashvi-profile-menu-item logout"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onLogout();
                  }}
                  role="menuitem"
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              )}
            </div>
          </>
        )}

        <div
          className="ashvi-chat-user-pill"
          onClick={() => setIsProfileOpen((prev) => !prev)}
          role="button"
          tabIndex={0}
          title="Account profile & options"
          aria-expanded={isProfileOpen}
          style={{ cursor: "pointer" }}
        >
          <div className="ashvi-chat-avatar">
            {displayName.substring(0, 2).toUpperCase()}
          </div>
          <div className="ashvi-chat-user-meta">
            <span className="ashvi-chat-user-name">{displayName}</span>
            <span className="ashvi-chat-user-status">Always Forward</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
