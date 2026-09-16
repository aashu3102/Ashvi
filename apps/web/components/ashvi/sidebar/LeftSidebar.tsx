"use client";

import {
  Home,
  MessageSquare,
  Search,
  Code2,
  FileText,
  Brain,
  LayoutGrid,
  Wrench,
  Zap,
  Compass,
  Plus,
  Settings,
  HelpCircle,
  ChevronRight,
} from "lucide-react";

interface Props {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onNewSpace: () => void;
  recentSpaces?: Array<{ id: string; title: string }>;
  onSelectSpace?: (id: string) => void;
}

export function LeftSidebar({
  activeTab,
  onSelectTab,
  onNewSpace,
  recentSpaces = [],
  onSelectSpace,
}: Props) {
  const mainNav = [
    { key: "home", label: "Home", icon: Home },
    { key: "chat", label: "Chat", icon: MessageSquare },
    { key: "research", label: "Research", icon: Search },
    { key: "build", label: "Build", icon: Code2 },
    { key: "documents", label: "Documents", icon: FileText },
    { key: "memory", label: "Memory", icon: Brain },
    { key: "projects", label: "Projects", icon: LayoutGrid },
    { key: "tools", label: "Tools", icon: Wrench },
    { key: "automate", label: "Automate", icon: Zap },
    { key: "explore", label: "Explore", icon: Compass },
  ];

  return (
    <aside className="ashvi-left-sidebar" aria-label="Primary navigation">
      <div>
        {/* Brand Block */}
        <div className="ashvi-sidebar-brand">
          <svg
            className="ashvi-brand-blade-emblem"
            viewBox="0 0 60 70"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M30 4 L38 28 L48 34 L36 38 L38 64 L30 52 L22 64 L24 38 L12 34 L22 28 Z"
              fill="url(#sword-gold)"
              stroke="#f0d575"
              strokeWidth="1.2"
            />
            <line x1="30" y1="4" x2="30" y2="52" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="30" cy="38" r="3" fill="#7ee8fa" />
            <defs>
              <linearGradient id="sword-gold" x1="12" y1="4" x2="48" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#f5ede0" />
                <stop offset="40%" stopColor="#d4af37" />
                <stop offset="100%" stopColor="#9a7b20" />
              </linearGradient>
            </defs>
          </svg>
          <h1 className="ashvi-brand-title">ASHVI</h1>
          <p className="ashvi-brand-subtitle">LIVING INTELLIGENCE</p>
        </div>

        {/* Primary Action Button */}
        <button className="ashvi-btn-new-space" type="button" onClick={onNewSpace}>
          <Plus size={16} strokeWidth={2.5} />
          <span>New Space</span>
        </button>

        {/* Navigation Items */}
        <ul className="ashvi-nav-list" role="navigation">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  className={`ashvi-nav-item-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelectTab(item.key)}
                >
                  <span className="ashvi-nav-icon">
                    <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Recent Spaces Section — rendered only when user has created spaces */}
        {recentSpaces && recentSpaces.length > 0 && (
          <div className="ashvi-sidebar-section">
            <div className="ashvi-sidebar-section-header">
              <span className="ashvi-sidebar-section-title">Recent Spaces</span>
              <button
                type="button"
                className="ashvi-sidebar-add-btn"
                onClick={onNewSpace}
                aria-label="Add new space"
              >
                <Plus size={13} />
              </button>
            </div>
            <ul className="ashvi-recent-spaces-list">
              {recentSpaces.slice(0, 6).map((space) => (
                <li key={space.id}>
                  <button
                    type="button"
                    className="ashvi-recent-space-link"
                    onClick={() => onSelectSpace && onSelectSpace(space.id)}
                  >
                    <span className="ashvi-bullet-dot" />
                    <span className="ashvi-recent-space-name">{space.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom User Area */}
      <div className="ashvi-sidebar-bottom">
        <div className="ashvi-user-pill" role="button" tabIndex={0}>
          <div className="ashvi-user-info">
            <div className="ashvi-avatar">AS</div>
            <div className="ashvi-user-text">
              <span className="ashvi-user-name">Aashu Singh</span>
              <span className="ashvi-user-sub">Always Forward</span>
            </div>
          </div>
          <ChevronRight size={14} className="ashvi-user-chevron" />
        </div>

        <div className="ashvi-secondary-nav">
          <button type="button" className="ashvi-secondary-link" onClick={() => onSelectTab("settings")}>
            <Settings size={14} />
            <span>Settings</span>
          </button>
          <button type="button" className="ashvi-secondary-link" onClick={() => onSelectTab("help")}>
            <HelpCircle size={14} />
            <span>Help & Support</span>
          </button>
        </div>

        <div className="ashvi-sidebar-signature">
          <p className="ashvi-signature-quote">
            Better Ideas<br />
            A Brighter You
          </p>
          <p className="ashvi-sidebar-version">VERSION 1.0</p>
        </div>
      </div>
    </aside>
  );
}
