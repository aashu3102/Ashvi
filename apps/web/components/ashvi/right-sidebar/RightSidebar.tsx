"use client";

import { useRef } from "react";
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
} from "lucide-react";

interface Props {
  currentSpaceName?: string;
  isListening?: boolean;
  onToggleVoice?: () => void;
  onUploadFile?: (file: File) => void;
}

export function RightSidebar({
  currentSpaceName = "General",
  isListening = true,
  onToggleVoice,
  onUploadFile,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <div className="ashvi-right-top-utilities">
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

        <div className="ashvi-user-pill" style={{ padding: "4px 8px" }}>
          <div className="ashvi-user-info">
            <div className="ashvi-avatar" style={{ width: "24px", height: "24px", fontSize: "9px" }}>
              AS
            </div>
            <span style={{ fontSize: "11px", fontWeight: 500 }}>Aashu</span>
          </div>
          <ChevronDown size={12} style={{ color: "#8fa0b5", marginLeft: "6px" }} />
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
