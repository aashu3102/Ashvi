"use client";

import { useState } from "react";
import { Check, Copy, Volume2, Globe, ExternalLink, Download, ImageIcon, Sparkles } from "lucide-react";
import type { ChatMessage, SearchSource, GeneratedImage } from "../conversation/ActiveChatModal";

interface Props {
  message: ChatMessage;
  onSpeak?: (text: string) => void;
}

export function AshviChatMessageItem({ message, onSpeak }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (isUser) {
    return (
      <div className="ashvi-message-row user">
        <div className="ashvi-user-bubble">
          {message.content}
        </div>
      </div>
    );
  }

  const sources = message.metadata?.sources ?? [];
  const images = message.metadata?.images ?? [];

  return (
    <div className="ashvi-message-row assistant">
      <div className="ashvi-assistant-card">
        {/* Header: Pure Serif Typography — NO AI Avatar / DP */}
        <div className="ashvi-card-header">
          <div className="ashvi-name-label">
            <span className="ashvi-name-dot" />
            <span>ASHVI</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {onSpeak && (
              <button
                type="button"
                onClick={() => onSpeak(message.content)}
                className="ashvi-msg-action-btn"
                title="Listen to response"
              >
                <Volume2 size={13} />
                <span>Listen</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="ashvi-msg-action-btn"
              title="Copy text"
            >
              {copied ? <Check size={13} style={{ color: "#34d399" }} /> : <Copy size={13} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        {/* Formatted Markdown Body */}
        <div className="ashvi-card-body">
          <FormattedMarkdown content={message.content} />
        </div>

        {/* Generated Images Section */}
        {images.length > 0 && (
          <div className="ashvi-generated-images-grid" style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {images.map((img: GeneratedImage, idx: number) => (
              <GeneratedImageCard key={idx} image={img} index={idx} />
            ))}
          </div>
        )}

        {/* Google Grounding Sources & Citations */}
        {sources.length > 0 && (
          <div
            className="ashvi-grounding-sources"
            style={{
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#94a3b8",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              <Globe size={13} style={{ color: "#38bdf8" }} />
              <span>Verified Sources & Citations</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "8px",
              }}
            >
              {sources.map((src: SearchSource, sIdx: number) => {
                let domain = "";
                try {
                  domain = new URL(src.url).hostname.replace(/^www\./, "");
                } catch {
                  domain = "Source";
                }
                return (
                  <a
                    key={sIdx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      textDecoration: "none",
                      color: "inherit",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
                      e.currentTarget.style.background = "rgba(56, 189, 248, 0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginBottom: "3px" }}>
                      <span style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 600, textTransform: "lowercase" }}>
                        {domain}
                      </span>
                      <ExternalLink size={10} style={{ color: "#64748b" }} />
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#e2e8f0",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={src.title || src.url}
                    >
                      {src.title || domain}
                    </span>
                    {src.snippet && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          marginTop: "2px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          lineHeight: "1.3",
                        }}
                      >
                        {src.snippet}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratedImageCard({ image, index }: { image: GeneratedImage; index: number }) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = image.url;
    link.download = `ashvi-generated-${Date.now()}-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(212, 175, 55, 0.3)",
        background: "rgba(15, 23, 42, 0.6)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "rgba(0, 0, 0, 0.4)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#d4af37", fontWeight: 600 }}>
          <Sparkles size={12} />
          <span>Nano Banana Creative Visual</span>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "6px",
            color: "#f8fafc",
            padding: "3px 8px",
            fontSize: "11px",
            cursor: "pointer",
          }}
          title="Download full-resolution image"
        >
          <Download size={11} />
          <span>Download</span>
        </button>
      </div>
      <div style={{ position: "relative", width: "100%", maxHeight: "480px", overflow: "hidden", display: "flex", justifyContent: "center", background: "#05070c" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={`Ashvi generated visual ${index + 1}`}
          style={{
            maxWidth: "100%",
            maxHeight: "480px",
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Lightweight, robust Markdown formatter for paragraphs, lists, inline code, and code blocks with copy.
 */
function FormattedMarkdown({ content }: { content: string }) {
  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div>
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const firstLineBreak = part.indexOf("\n");
          const language = firstLineBreak !== -1 ? part.slice(3, firstLineBreak).trim() : "";
          const code = firstLineBreak !== -1 ? part.slice(firstLineBreak + 1, -3) : part.slice(3, -3);

          return <CodeBlock key={index} code={code} language={language} />;
        }

        // Standard text lines
        const paragraphs = part.split(/\n\n+/);
        return (
          <div key={index}>
            {paragraphs.map((para, pIdx) => {
              if (!para.trim()) return null;

              // Check for bullet lists
              const lines = para.split("\n");
              const isList = lines.every((l) => /^\s*[-*•]\s+/.test(l) || /^\s*\d+\.\s+/.test(l));

              if (isList) {
                return (
                  <ul key={pIdx} style={{ paddingLeft: "20px", margin: "8px 0" }}>
                    {lines.map((l, lIdx) => {
                      const clean = l.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+\.\s+/, "");
                      return (
                        <li key={lIdx} style={{ marginBottom: "4px" }}>
                          <InlineFormatting text={clean} />
                        </li>
                      );
                    })}
                  </ul>
                );
              }

              return (
                <p key={pIdx} style={{ marginBottom: "10px", lineHeight: "1.65" }}>
                  {lines.map((l, lIdx) => (
                    <span key={lIdx}>
                      <InlineFormatting text={l} />
                      {lIdx < lines.length - 1 && <br />}
                    </span>
                  ))}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function InlineFormatting({ text }: { text: string }) {
  // Parse bold and inline code
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <>
      {tokens.map((token, i) => {
        if (token.startsWith("`") && token.endsWith("`")) {
          return <code key={i}>{token.slice(1, -1)}</code>;
        }
        if (token.startsWith("**") && token.endsWith("**")) {
          return <strong key={i} style={{ color: "#f8fafc" }}>{token.slice(2, -2)}</strong>;
        }
        return token;
      })}
    </>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "relative",
        margin: "14px 0",
        borderRadius: "10px",
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        background: "rgba(3, 7, 18, 0.85)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          background: "rgba(255, 255, 255, 0.04)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          fontSize: "11px",
          color: "#94a3b8",
          fontFamily: "monospace",
          textTransform: "uppercase",
        }}
      >
        <span>{language || "code"}</span>
        <button
          type="button"
          onClick={copyCode}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: "transparent",
            border: "none",
            color: "#cbd5e1",
            cursor: "pointer",
            fontSize: "11px",
          }}
        >
          {copied ? <Check size={12} style={{ color: "#34d399" }} /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre style={{ margin: 0, padding: "14px 16px", overflowX: "auto" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
