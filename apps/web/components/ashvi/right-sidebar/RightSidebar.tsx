"use client";

import { useRef, useState } from "react";
import {
  Search,
  Bell,
  Sun,
  ChevronDown,
  Layers,
  Upload,
  Mic,
  Image as ImageIcon,
  Globe,
  LogOut,
} from "lucide-react";

interface Props {
  currentSpaceName?: string;
  isListening?: boolean;
  onToggleVoice?: () => void;
  onUploadFile?: (file: File) => void;
  userName?: string | null;
  onLogout?: () => void;
}

export function RightSidebar({
  currentSpaceName = "General",
  isListening = true,
  onToggleVoice,
  onUploadFile,
  userName,
  onLogout,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const cleanName = userName ? userName.trim().split(" ")[0] : "Aashu";
  const initials = cleanName.slice(0, 2).toUpperCase();

  return (
    <aside className="ashvi-right-sidebar" aria-label="Activity and tools">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && onUploadFile) onUploadFile(f);
        }}
        style={{ display: "none" }}
      />

      {/* Top Utility Icons */}
      <div className="ashvi-right-top-utilities" style={{ position: "relative" }}>
        <div className="ashvi-utility-icons-group">
          <button type="button" className="ashvi-utility-btn" aria-label="Search">
            <Search size={15} />
          </button>
          <button type="button" className="ashvi-utility-btn" aria-label="Notifications">
            <Bell size={15} />
          </button>
          <button type="button" className="ashvi-utility-btn" aria-label="Toggle theme">
            <Sun size={15} />
          </button>
        </div>

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
                top: "calc(100% + 8px)",
                right: "0",
                left: "auto",
                bottom: "auto",
                minWidth: "180px",
              }}
              role="menu"
              aria-label="User Profile"
            >
              <div className="ashvi-profile-menu-header">
                <div className="ashvi-avatar" style={{ width: "24px", height: "24px", fontSize: "10px" }}>
                  {initials}
                </div>
                <div className="ashvi-profile-menu-meta">
                  <span className="ashvi-profile-name">{cleanName}</span>
                  <span className="ashvi-profile-status">Active Session</span>
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
          className="ashvi-user-pill"
          style={{ padding: "4px 8px", cursor: "pointer" }}
          onClick={() => setIsProfileOpen((prev) => !prev)}
          role="button"
          tabIndex={0}
          title="Account profile & options"
          aria-expanded={isProfileOpen}
        >
          <div className="ashvi-user-info">
            <div className="ashvi-avatar" style={{ width: "24px", height: "24px", fontSize: "9px" }}>
              {initials}
            </div>
            <span style={{ fontSize: "11px", fontWeight: 500 }}>{cleanName}</span>
          </div>
          <ChevronDown
            size={12}
            style={{
              color: "#8fa0b5",
              marginLeft: "6px",
              transform: isProfileOpen ? "rotate(180deg)" : "none",
              transition: "transform 180ms ease",
            }}
          />
        </div>
      </div>

      {/* Ashvi Online / Listening Assistant Status */}
      <div className="ashvi-status-card">
        <div className="ashvi-status-lead">
          <div className="ashvi-status-heading">
            <span className="ashvi-online-pulse" />
            <span>Ashvi Online</span>
          </div>
          <p className="ashvi-status-state">{isListening ? "Listening..." : "Ready"}</p>
        </div>

        <div
          className="ashvi-waveform-bars"
          onClick={onToggleVoice}
          style={{ cursor: "pointer" }}
          title="Toggle voice assistant"
        >
          <span className="ashvi-waveform-bar" />
          <span className="ashvi-waveform-bar" />
          <span className="ashvi-waveform-bar" />
          <span className="ashvi-waveform-bar" />
          <span className="ashvi-waveform-bar" />
        </div>
      </div>

      {/* Current Space Panel */}
      <div className="ashvi-current-space-card">
        <div className="ashvi-cs-header">
          <span>Current Space</span>
          <ChevronDown size={13} />
        </div>
        <div className="ashvi-cs-body">
          <div className="ashvi-cs-icon">
            <Layers size={15} />
          </div>
          <div>
            <div className="ashvi-cs-title">{currentSpaceName}</div>
            <div className="ashvi-cs-desc">A space for everything</div>
          </div>
        </div>
      </div>

      {/* Quick Tools Grid */}
      <div>
        <div className="ashvi-sidebar-section-header" style={{ marginBottom: "8px" }}>
          <span className="ashvi-sidebar-section-title">Quick Tools</span>
          <button type="button" className="ashvi-panel-action-link">
            Edit
          </button>
        </div>

        <div className="ashvi-quick-tools-grid">
          <button
            type="button"
            className="ashvi-quick-tool-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />
            <span>Upload</span>
          </button>
          <button
            type="button"
            className="ashvi-quick-tool-btn"
            onClick={onToggleVoice}
          >
            <Mic size={16} />
            <span>Voice</span>
          </button>
          <button
            type="button"
            className="ashvi-quick-tool-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon size={16} />
            <span>Image</span>
          </button>
          <button type="button" className="ashvi-quick-tool-btn">
            <Globe size={16} />
            <span>Web Search</span>
          </button>
        </div>
      </div>

      {/* Visual Quote Card 1: Knight */}
      <div className="ashvi-visual-quote-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ashvi/knight.jpg" alt="Golden Knight" />
        <div className="ashvi-visual-quote-overlay">
          <p className="ashvi-visual-quote-text">
            &ldquo;A calmer mind<br />
            builds a brighter future.&rdquo;
          </p>
        </div>
      </div>

      {/* Visual Quote Card 2: Ashvi Insights Neural */}
      <div className="ashvi-insights-card-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ashvi/neural.jpg" alt="Ashvi Neural Insights" />
        <div className="ashvi-insights-header">
          <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#7ee8fa" }} />
          <span>Ashvi Insights</span>
        </div>
        <div className="ashvi-insights-caption">
          Progress feels better when you can see it.
        </div>
      </div>
    </aside>
  );
}
