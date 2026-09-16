"use client";

import {
  MessageSquare,
  Search,
  Code2,
  PenTool,
  BarChart3,
  Cpu,
  GraduationCap,
  Compass,
} from "lucide-react";

interface Props {
  selectedCapability: string;
  onSelectCapability: (cap: string) => void;
}

export function TopHeader({ selectedCapability, onSelectCapability }: Props) {
  const capabilities = [
    { key: "chat", label: "Chat", icon: MessageSquare },
    { key: "research", label: "Research", icon: Search },
    { key: "code", label: "Code", icon: Code2 },
    { key: "create", label: "Create", icon: PenTool },
    { key: "analyze", label: "Analyze", icon: BarChart3 },
    { key: "automate", label: "Automate", icon: Cpu },
    { key: "learn", label: "Learn", icon: GraduationCap },
    { key: "explore", label: "Explore", icon: Compass },
  ];

  return (
    <header className="ashvi-top-header" role="banner">
      <div className="ashvi-top-kicker" aria-hidden="true">
        A CALMER MIND &nbsp; • &nbsp; A BRIGHTER YOU
      </div>

      <nav className="ashvi-capability-capsule" aria-label="Quick capabilities">
        {capabilities.map((item) => {
          const Icon = item.icon;
          const isActive = selectedCapability === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`ashvi-capsule-item ${isActive ? "is-active" : ""}`}
              onClick={() => onSelectCapability(item.key)}
            >
              <Icon size={14} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="ashvi-top-quote-banner" aria-hidden="true">
        &ldquo;Not just an assistant. A presence. Always with you.&rdquo; — <strong>ASHVI</strong>
      </div>
    </header>
  );
}
