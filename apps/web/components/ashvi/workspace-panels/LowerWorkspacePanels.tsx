"use client";

import { useState } from "react";
import {
  Clock,
  Sparkles,
  CheckCircle2,
  MoreVertical,
  Layers,
  FileCode2,
  BookOpen,
  Clapperboard,
  Compass,
  Check,
} from "lucide-react";

interface Props {
  onSelectSpace?: (spaceName: string) => void;
}

export function LowerWorkspacePanels({ onSelectSpace }: Props) {
  const [focusItems, setFocusItems] = useState([
    { id: 1, label: "Study for End-Term Exam", done: false },
    { id: 2, label: "Work on Ashvi Voice Module", done: false },
    { id: 3, label: "Read 2 Research Papers", done: false },
    { id: 4, label: "Gym", done: true },
    { id: 5, label: "Call Shambhavi ❤️", done: false },
  ]);

  const toggleFocus = (id: number) => {
    setFocusItems((items) =>
      items.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const recentSpacesList = [
    { name: "Ashvi Development", meta: "12 conversations", badgeClass: "ashvi-badge-blue", icon: FileCode2 },
    { name: "GATE 2027 Prep", meta: "26 conversations", badgeClass: "ashvi-badge-orange", icon: Layers },
    { name: "Research Paper", meta: "16 conversations", badgeClass: "ashvi-badge-cyan", icon: BookOpen },
    { name: "Netflix Marketing", meta: "9 conversations", badgeClass: "ashvi-badge-red", icon: Clapperboard },
    { name: "Travel Plan", meta: "11 conversations", badgeClass: "ashvi-badge-blue", icon: Compass },
  ];

  const continueItems = [
    {
      title: "Combinatorial Problems",
      time: "Last active 4 hours ago",
      snippet: "You: Can you solve this using inclusion-exclusion...",
    },
    {
      title: "Ashvi Project Plan",
      time: "Last active 1 day ago",
      snippet: "You: Update the roadmap for phase 1...",
    },
    {
      title: "Research Paper",
      time: "Last active 2 days ago",
      snippet: "You: Summarize the literature review...",
    },
  ];

  return (
    <section className="ashvi-lower-workspace-grid" aria-label="Workspace overview">
      {/* Panel 1: Recent Spaces */}
      <div className="ashvi-panel-card">
        <div className="ashvi-panel-head">
          <div className="ashvi-panel-title-wrap">
            <Clock size={15} className="text-cyan" />
            <span>Recent Spaces</span>
          </div>
          <button type="button" className="ashvi-panel-action-link">
            View all
          </button>
        </div>

        <ul className="ashvi-panel-list">
          {recentSpacesList.map((s) => {
            const Icon = s.icon;
            return (
              <li
                key={s.name}
                className="ashvi-panel-list-item"
                onClick={() => onSelectSpace && onSelectSpace(s.name)}
              >
                <div className="ashvi-item-lead">
                  <div className={`ashvi-item-badge-icon ${s.badgeClass}`}>
                    <Icon size={13} />
                  </div>
                  <div className="ashvi-item-content">
                    <span className="ashvi-item-title">{s.name}</span>
                    <span className="ashvi-item-meta">{s.meta}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Panel 2: Continue Where You Left */}
      <div className="ashvi-panel-card">
        <div className="ashvi-panel-head">
          <div className="ashvi-panel-title-wrap">
            <Sparkles size={15} style={{ color: "#d4af37" }} />
            <span>Continue Where You Left</span>
          </div>
        </div>

        <ul className="ashvi-panel-list">
          {continueItems.map((item) => (
            <li
              key={item.title}
              className="ashvi-panel-list-item"
              onClick={() => onSelectSpace && onSelectSpace(item.title)}
            >
              <div className="ashvi-item-lead">
                <div className="ashvi-item-content">
                  <span className="ashvi-item-title">{item.title}</span>
                  <span className="ashvi-item-meta">{item.time}</span>
                  <span
                    className="ashvi-item-meta"
                    style={{ opacity: 0.65, marginTop: "2px", fontStyle: "italic" }}
                  >
                    {item.snippet}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Panel 3: Today's Focus */}
      <div className="ashvi-panel-card">
        <div className="ashvi-panel-head">
          <div className="ashvi-panel-title-wrap">
            <CheckCircle2 size={15} className="text-cyan" />
            <span>Today&apos;s Focus</span>
          </div>
          <button type="button" className="ashvi-panel-action-link">
            Edit
          </button>
        </div>

        <ul className="ashvi-panel-list">
          {focusItems.map((item) => (
            <li
              key={item.id}
              className={`ashvi-focus-item ${item.done ? "is-completed" : ""}`}
              onClick={() => toggleFocus(item.id)}
            >
              <div className="ashvi-focus-lead">
                <div className="ashvi-checkbox-circle">
                  {item.done && <Check size={11} color="#050810" strokeWidth={3} />}
                </div>
                <span className="ashvi-focus-label">{item.label}</span>
              </div>
              <button
                type="button"
                className="ashvi-utility-btn"
                style={{ width: "24px", height: "24px" }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                aria-label="Item options"
              >
                <MoreVertical size={13} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
