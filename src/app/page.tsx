"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CONFIG_STORAGE_KEY, decodeConfig } from "@/lib/config";

interface Todo { id: string; checked: boolean; text: string }
interface Memo {
  id: string; content: string; todos: Todo[];
  createdAt: string; replies: string[];
  pinned: boolean; important: boolean; folder: string;
  imageUrls: string[];
  pending?: boolean;
}
interface Config {
  token: string; databaseId: string; title: string;
  folderOptions: string[]; folderColorPalette: string[]; folderBubblePalette?: string[];
  fontFamily: string; accent: string;
  accentLight?: string; textColor?: string;
  msgBubbleBg?: string; msgTextColor?: string;
  replyBubbleBg?: string; replyTextColor?: string;
  alignLeft?: boolean;
  folderProp?: string; pinnedProp?: string;
  importantProp?: string; replyProp?: string; dateProp?: string;
  mobile?: boolean;
}

function hex2hsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const l = (max+min)/2;
  if (max===min) return [0,0,l*100];
  const d = max-min;
  const s = l>0.5 ? d/(2-max-min) : d/(max+min);
  let h = 0;
  if (max===r) h = ((g-b)/d + (g<b?6:0))/6;
  else if (max===g) h = ((b-r)/d+2)/6;
  else h = ((r-g)/d+4)/6;
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}

function folderToBubbleColor(hex: string): string {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return "var(--msg-bubble-color)";
  const [h, s] = hex2hsl(hex);
  return `hsl(${h}, ${Math.min(s * 0.4, 30)}%, 93%)`;
}

function buildCssVars(cfg: Config): string {
  const accent = cfg.accent ?? "#E8A8C0";
  const [h, s, l] = hex2hsl(accent);
  const aLight  = cfg.accentLight  ?? `hsl(${h},${s}%,${Math.min(l+9,97)}%)`;
  const msgBub  = cfg.msgBubbleBg  ?? `hsl(${h},${Math.max(s-25,3)}%,${Math.min(l+13,97)}%)`;
  const repBub  = cfg.replyBubbleBg ?? `hsl(${h},${Math.min(s+5,75)}%,${Math.max(l-40,18)}%)`;
  const repText = cfg.replyTextColor ?? "#ffffff";
  const msgText = cfg.msgTextColor  ?? `hsl(${h},${Math.max(s-30,5)}%,${Math.max(l-46,20)}%)`;
  const textCol = cfg.textColor     ?? "#474747";
  const border  = `hsl(${h},${Math.max(s-20,3)}%,${Math.min(l+11,96)}%)`;
  const font    = cfg.fontFamily    ?? "'Pretendard Variable','Pretendard',sans-serif";
  return `
    :root {
      --accent: ${accent};
      --accent-light: ${aLight};
      --text-color: ${textCol};
      --bg-color: #ffffff;
      --border-color: ${border};
      --border-dot: ${border};
      --msg-bubble-color: ${msgBub};
      --msg-text-color: ${msgText};
      --reply-bubble-color: ${repBub};
      --reply-text-color: ${repText};
      --widget-font-family: ${font};
    }
    @keyframes y2kFadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin { to { transform:rotate(360deg); } }
    @keyframes dotBounce { 0%,80%,100% { transform:scale(0.6); opacity:0.4; } 40% { transform:scale(1); opacity:1; } }
  `;
}

function DynamicThemeColor({ color }: { color: string }) {
  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
    meta.content = color;
  }, [color]);
  return null;
}

const FolderIcon = ({ size=25, fill, stroke }: { size?: number; fill: string; stroke: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>
  </svg>
);

const PinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17v5"/>
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v3.76z"/>
  </svg>
);

const ReplyIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <g transform="scale(-1 -1) translate(-24 -24)">
      <polyline points="9 17 4 12 9 7"/>
      <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
    </g>
  </svg>
);

function applyMarkdownShortcuts(val: string): string {
  // Typing checkbox/bullet markers auto-formats them — no need to type the
  // leading "- ". Works anywhere a line starts.
  return val
    .replace(/(^|\n)\[ \] /g, "$1- [ ] ")
    .replace(/(^|\n)\[\] /g, "$1- [ ] ")
    .replace(/(^|\n)\[x\] /g, "$1- [x] ")
    .replace(/(^|\n)\[X\] /g, "$1- [x] ");
}

function parseLines(content: string) {
  const rawLines = content.split("\n");
  while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === "") rawLines.pop();
  return rawLines.map(line => {
    const indentCount = line.match(/^( *)/)?.[1]?.length ?? 0;
    const indent = Math.floor(indentCount / 4);
    const trimmed = line.trimStart();
    const todo = trimmed.match(/^- \[(x| )\] (.+)/);
    if (todo) return { type: "todo" as const, checked: todo[1]==="x", text: todo[2], indent };
    const numbered = trimmed.match(/^(\d+)\. (.+)/);
    if (numbered) return { type: "numbered" as const, num: parseInt(numbered[1]), text: numbered[2], indent };
    const bullet = trimmed.match(/^- (.+)/);
    if (bullet) return { type: "bullet" as const, text: bullet[1], indent };
    return { type: "para" as const, text: line, indent: 0 };
  });
}

// Clean inline markdown renderer for MemoContent display (no invisible markers needed)
function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const regex = /\*\*([\s\S]+?)\*\*|_([\s\S]+?)_|~~([\s\S]+?)~~|`([\s\S]+?)`/g;
  const parts: React.ReactNode[] = [];
  let last = 0; let k = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    if      (m[1] !== undefined) parts.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2] !== undefined) parts.push(<em key={k++}>{m[2]}</em>);
    else if (m[3] !== undefined) parts.push(<span key={k++} style={{ textDecoration: "line-through", opacity: 0.55 }}>{m[3]}</span>);
    else if (m[4] !== undefined) parts.push(<code key={k++} style={{ background: "rgba(0,0,0,0.07)", borderRadius: 3, padding: "0 3px", fontFamily: "monospace", fontSize: "0.88em" }}>{m[4]}</code>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(<span key={k++}>{text.slice(last)}</span>);
  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
}

// Inline markdown renderer for the textarea overlay — invisible raw markers preserve flow width,
// formatted content overlaid absolutely so caret positions stay accurate.
function renderPreviewInline(text: string): React.ReactNode {
  if (!text) return null;
  const regex = /\*\*([\s\S]+?)\*\*|_([\s\S]+?)_|~~([\s\S]+?)~~|`([\s\S]+?)`/g;
  const parts: React.ReactNode[] = [];
  let last = 0; let k = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    if (m[1] !== undefined) {
      parts.push(<span key={k++} style={{ position: "relative", display: "inline" }}>
        <span style={{ opacity: 0, whiteSpace: "pre" }}>{m[0]}</span>
        <span style={{ position: "absolute", left: 0, top: 0, fontWeight: "bold" }}>{m[1]}</span>
      </span>);
    } else if (m[2] !== undefined) {
      parts.push(<span key={k++} style={{ position: "relative", display: "inline" }}>
        <span style={{ opacity: 0, whiteSpace: "pre" }}>{m[0]}</span>
        <span style={{ position: "absolute", left: 0, top: 0, fontStyle: "italic" }}>{m[2]}</span>
      </span>);
    } else if (m[3] !== undefined) {
      parts.push(<span key={k++} style={{ position: "relative", display: "inline" }}>
        <span style={{ opacity: 0, whiteSpace: "pre" }}>{m[0]}</span>
        <span style={{ position: "absolute", left: 0, top: 0, textDecoration: "line-through", opacity: 0.55 }}>{m[3]}</span>
      </span>);
    } else if (m[4] !== undefined) {
      parts.push(<span key={k++} style={{ position: "relative", display: "inline" }}>
        <span style={{ opacity: 0, whiteSpace: "pre" }}>{m[0]}</span>
        <span style={{ position: "absolute", left: 0, top: 0, background: "rgba(0,0,0,0.07)", borderRadius: 3, padding: "0 3px", fontFamily: "monospace", fontSize: "0.88em" }}>{m[4]}</span>
      </span>);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(<span key={k++}>{text.slice(last)}</span>);
  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
}

function renderInputPreview(text: string): React.ReactNode {
  return text.split("\n").map((line, i) => {
    const leading = line.match(/^(\s*)/)?.[1] ?? "";
    const rest = line.slice(leading.length);
    // Reserve the indent as the *actual* leading spaces (invisible) so the
    // overlay is character-for-character identical to the textarea — using
    // paddingLeft instead would drift the caret on indented lines.
    const indentSpan = leading ? <span style={{ whiteSpace: "pre", flexShrink: 0 }}>{leading}</span> : null;
    const todo = rest.match(/^(- \[(x| )\] ?)(.*)$/);
    if (todo) return (
      <div key={i} style={{ display: "flex", gap: 0, alignItems: "flex-start", minHeight: "1.5em" }}>
        {indentSpan}
        <span style={{ position: "relative", flexShrink: 0 }}>
          <span style={{ opacity: 0, whiteSpace: "pre" }}>{todo[1]}</span>
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: todo[2]==="x" ? 0.35 : 0.6 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1.5" y="1.5" width="13" height="13" rx="2"/>
              {todo[2]==="x" && <polyline points="4.5 8.5 7 11 11.5 5.5" strokeWidth="1.8"/>}
            </svg>
          </span>
        </span>
        <span style={{ textDecoration: todo[2]==="x" ? "line-through" : "none", opacity: todo[2]==="x" ? 0.4 : 1 }}>{todo[3]}</span>
      </div>
    );
    const numbered = rest.match(/^(\d+\. )(.*)$/);
    if (numbered) return (
      <div key={i} style={{ display: "flex", gap: 0, alignItems: "flex-start", minHeight: "1.5em" }}>
        {indentSpan}
        <span style={{ opacity: 0.55, whiteSpace: "pre", flexShrink: 0 }}>{numbered[1]}</span>
        <span>{numbered[2]}</span>
      </div>
    );
    const bullet = rest.match(/^(- )(.*)$/);
    if (bullet) return (
      <div key={i} style={{ display: "flex", gap: 0, alignItems: "flex-start", minHeight: "1.5em" }}>
        {indentSpan}
        <span style={{ position: "relative", flexShrink: 0 }}>
          <span style={{ opacity: 0, whiteSpace: "pre" }}>{bullet[1]}</span>
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5, fontSize: 11 }}>•</span>
        </span>
        <span>{bullet[2]}</span>
      </div>
    );
    return <div key={i} style={{ minHeight: "1.5em" }}>{line || <>&nbsp;</>}</div>;
  });
}

function MemoContent({ content, todos, onToggle }: {
  content: string; todos: Todo[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = parseLines(content);
  const MAX = 6;
  const shown = expanded ? lines : lines.slice(0, MAX);
  const hiddenCount = lines.length - shown.length;

  const findTodo = (text: string, checked: boolean) =>
    todos.find(t => t.text === text && t.checked === checked)?.id ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {shown.map((line, i) => {
        if (line.type === "todo") {
          const tid = findTodo(line.text, line.checked);
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, paddingLeft: line.indent * 14 }}>
              <span style={{ flexShrink: 0, height: "1.4em", display: "flex", alignItems: "center", opacity: line.checked ? 0.35 : 0.6, cursor: tid ? "pointer" : "default" }}
                onClick={e => { e.stopPropagation(); tid && onToggle(tid, !line.checked); }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1.5" y="1.5" width="13" height="13" rx="2"/>
                  {line.checked && <polyline points="4.5 8.5 7 11 11.5 5.5" strokeWidth="1.8"/>}
                </svg>
              </span>
              <span style={{ textDecoration: line.checked ? "line-through" : "none", opacity: line.checked ? 0.4 : 1, wordBreak: "break-word" }}>{renderInlineMarkdown(line.text)}</span>
            </div>
          );
        }
        if (line.type === "bullet") {
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, paddingLeft: line.indent * 14 }}>
              <span style={{ flexShrink: 0, opacity: 0.5, fontSize: 11, height: "1.4em", display: "flex", alignItems: "center" }}>•</span>
              <span style={{ wordBreak: "break-word" }}>{renderInlineMarkdown(line.text)}</span>
            </div>
          );
        }
        if (line.type === "numbered") {
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, paddingLeft: line.indent * 14 }}>
              <span style={{ flexShrink: 0, opacity: 0.6, fontSize: 11, height: "1.4em", display: "flex", alignItems: "center", minWidth: 14 }}>{line.num}.</span>
              <span style={{ wordBreak: "break-word" }}>{renderInlineMarkdown(line.text)}</span>
            </div>
          );
        }
        return <div key={i} style={{ paddingLeft: line.indent * 14 }}>{renderInlineMarkdown(line.text) || <>&nbsp;</>}</div>;
      })}
      {!expanded && hiddenCount > 0 && (
        <button onClick={() => setExpanded(true)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 0 0", fontSize: 10, color: "inherit", opacity: 0.4, fontFamily: "inherit", transition: "opacity 0.15s", textAlign: "left" }}>
          ...더보기 (+{hiddenCount})
        </button>
      )}
    </div>
  );
}

function PendingBubble() {
  return (
    <div style={{ padding: "2px 6px", display: "flex", justifyContent: "flex-end", animation: "y2kFadeIn 0.3s ease" }}>
      <div style={{ background: "var(--msg-bubble-color)", padding: "10px 16px", borderRadius: "12px 12px 2px 12px", opacity: 0.65 }}>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[0,1,2].map(i => (
            <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: `dotBounce 1.2s ease ${i * 0.2}s infinite` }} />
          ))}
        </span>
      </div>
    </div>
  );
}

function ReplyBubble({ text, first, index, onReply, onEdit, onDelete, mobile }: {
  text: string; first: boolean; index: number;
  onReply: () => void; onEdit: (t: string) => void; onDelete: () => void; mobile?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  function copy() {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    });
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  function handleToggle(todoText: string, checked: boolean) {
    const newText = text.split("\n").map(line => {
      const trimmed = line.trimStart();
      const prefix = line.slice(0, line.length - trimmed.length);
      const m = trimmed.match(/^- \[(x| )\] (.+)$/);
      if (m && m[2] === todoText && (m[1] === "x") === checked) {
        return prefix + `- [${checked ? " " : "x"}] ` + todoText;
      }
      return line;
    }).join("\n");
    if (newText !== text) onEdit(newText);
  }
  function startEdit() { setEditText(text); setEditing(true); setTimeout(() => editRef.current?.focus(), 30); }
  function saveEdit() { if (editText.trim()) onEdit(editText.trim()); setEditing(false); }
  function cancelEdit() { setEditText(text); setEditing(false); }

  const show = hover || showActions;
  const lines = parseLines(text);
  const iconBtn = { background: "none", border: "none", cursor: "pointer", padding: 2, color: "#bbb", lineHeight: 1, transition: "color 0.15s" } as const;

  if (editing) {
    return (
      <div style={{ alignSelf: "flex-start", width: mobile ? "90%" : "min(340px, 85vw)", marginTop: first ? 6 : 3, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ position: "relative" }}>
          <div aria-hidden style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
            padding: mobile ? "10px 14px" : "8px 12px", fontSize: mobile ? 15 : 13, fontFamily: "inherit", lineHeight: 1.4,
            color: "var(--reply-text-color)", pointerEvents: "none",
            whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden",
          }}>{renderInputPreview(editText)}</div>
          <textarea ref={editRef} value={editText} onChange={e => setEditText(applyMarkdownShortcuts(e.target.value))}
            onKeyDown={e => {
              if (e.key === "Enter" && e.metaKey) { saveEdit(); return; }
              if (e.key === "Escape") { cancelEdit(); return; }
            }}
            className="y2k-input"
            style={{ display: "block", width: "100%", padding: mobile ? "10px 14px" : "8px 12px", border: "1px solid var(--reply-bubble-color)", borderRadius: "12px 12px 12px 2px", fontSize: mobile ? 15 : 13, color: "transparent", caretColor: "var(--reply-text-color)", lineHeight: 1.4, background: "var(--reply-bubble-color)", fontFamily: "inherit", resize: "none", minHeight: 90, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={cancelEdit} style={{ background: "none", border: "1px solid var(--border-color)", borderRadius: 6, padding: "4px 12px", fontSize: 11, color: "#aaa", cursor: "pointer", fontFamily: "inherit" }}>취소</button>
          <button onClick={saveEdit} style={{ background: "var(--reply-bubble-color)", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, color: "var(--reply-text-color)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>저장</button>
        </div>
      </div>
    );
  }

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ alignSelf: "flex-start", maxWidth: mobile ? "90%" : "85%", marginTop: first ? 6 : 3, display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <div onClick={mobile ? () => setShowActions(v => !v) : undefined}
          style={{
            background: "var(--reply-bubble-color)", padding: mobile ? "10px 14px" : "8px 12px",
            borderRadius: "12px 12px 12px 2px", fontSize: mobile ? 15 : 13,
            color: "var(--reply-text-color)", lineHeight: 1.4,
            wordBreak: "break-word", fontFamily: "inherit", cursor: mobile ? "pointer" : "default",
          }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {lines.map((line, li) => {
              if (line.type === "todo") return (
                <div key={li} style={{ display: "flex", alignItems: "flex-start", gap: 5, paddingLeft: line.indent * 14 }}>
                  <span style={{ flexShrink: 0, height: "1.4em", display: "flex", alignItems: "center", opacity: line.checked ? 0.5 : 0.8, cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); handleToggle(line.text, line.checked); }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1.5" y="1.5" width="13" height="13" rx="2"/>
                      {line.checked && <polyline points="4.5 8.5 7 11 11.5 5.5" strokeWidth="1.8"/>}
                    </svg>
                  </span>
                  <span style={{ textDecoration: line.checked ? "line-through" : "none", opacity: line.checked ? 0.55 : 1, wordBreak: "break-word" }}>{renderInlineMarkdown(line.text)}</span>
                </div>
              );
              if (line.type === "bullet") return (
                <div key={li} style={{ display: "flex", alignItems: "flex-start", gap: 5, paddingLeft: line.indent * 14 }}>
                  <span style={{ flexShrink: 0, opacity: 0.7, fontSize: 11, height: "1.4em", display: "flex", alignItems: "center" }}>•</span>
                  <span style={{ wordBreak: "break-word" }}>{renderInlineMarkdown(line.text)}</span>
                </div>
              );
              if (line.type === "numbered") return (
                <div key={li} style={{ display: "flex", alignItems: "flex-start", gap: 5, paddingLeft: line.indent * 14 }}>
                  <span style={{ flexShrink: 0, opacity: 0.7, fontSize: 11, height: "1.4em", display: "flex", alignItems: "center", minWidth: 14 }}>{line.num}.</span>
                  <span style={{ wordBreak: "break-word" }}>{renderInlineMarkdown(line.text)}</span>
                </div>
              );
              return <div key={li} style={{ paddingLeft: line.indent * 14 }}>{renderInlineMarkdown(line.text) || <>&nbsp;</>}</div>;
            })}
          </div>
        </div>
        <button onClick={copy} title={copied ? "복사됨" : "복사"} style={{ ...iconBtn, opacity: show ? 1 : 0, pointerEvents: show ? "auto" : "none", transition: "opacity 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")} onMouseLeave={e => (e.currentTarget.style.color = "#bbb")}>
          {copied ? <span style={{ fontSize: 9, color: "var(--accent)" }}>✓</span> : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
        </button>
      </div>
      <div style={{ display: "flex", gap: mobile ? 4 : 1, height: show ? (mobile ? 30 : 20) : 0, overflow: "hidden", transition: "height 0.15s" }}>
        {[
          { label: "답글", onClick: onReply, icon: <ReplyIcon /> },
          { label: "수정", onClick: startEdit, icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
          { label: "삭제", onClick: onDelete, icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> },
        ].map(a => (
          <button key={a.label} onClick={a.onClick} title={a.label}
            style={{ background: "none", border: "none", cursor: "pointer", padding: mobile ? "5px 10px" : "2px 6px", lineHeight: 1,
              color: "#bbb", fontSize: mobile ? 12 : 10, fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 3, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.color = "#bbb")}
          >{a.icon}{a.label}</button>
        ))}
      </div>
    </div>
  );
}

function MemoBubble({ memo, folderColor, folderBubbleColor, mobile, onPin, onImportant, onDelete, onToggle, onEdit, onReply, onEditReply, onDeleteReply }: {
  memo: Memo;
  folderColor?: string;
  folderBubbleColor?: string;
  mobile?: boolean;
  onPin: () => void; onImportant: () => void; onDelete: () => void;
  onToggle: (id: string, checked: boolean) => void;
  onEdit: (content: string) => void;
  onReply: () => void;
  onEditReply: (index: number, text: string) => void;
  onDeleteReply: (index: number) => void;
}) {
  const [hover, setHover]       = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(memo.content);
  const [copied, setCopied]     = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const editCursorRef = useRef<number | null>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 답글/수정/삭제 row: only appears when hovering the bubble's right side, and
  // with a small delay so it isn't twitchy when the cursor just passes over.
  function scheduleActions(show: boolean) {
    if (actionTimer.current) clearTimeout(actionTimer.current);
    actionTimer.current = setTimeout(() => setShowActions(show), show ? 320 : 140);
  }

  const isImportant = memo.important;
  const bubbleBg = isImportant
    ? "var(--reply-bubble-color)"
    : folderBubbleColor || (folderColor ? folderToBubbleColor(folderColor) : "var(--msg-bubble-color)");
  const textColor = isImportant ? "var(--reply-text-color)" : "var(--msg-text-color)";

  useLayoutEffect(() => {
    if (editCursorRef.current !== null && editRef.current) {
      const pos = editCursorRef.current;
      editRef.current.setSelectionRange(pos, pos);
      editCursorRef.current = null;
    }
  }, [editText]);

  function copyText() {
    navigator.clipboard.writeText(memo.content).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = memo.content; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    });
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  function startEdit() { setEditText(memo.content); setEditing(true); setTimeout(() => editRef.current?.focus(), 30); }
  function saveEdit() { if (editText.trim() && editText.trim() !== memo.content) onEdit(editText.trim()); setEditing(false); }
  function cancelEdit() { setEditText(memo.content); setEditing(false); }

  if (memo.pending) return <PendingBubble />;

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", memo.id);
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  }
  function handleDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).style.opacity = "1";
  }

  if (editing) {
    return (
      <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ alignSelf: "flex-end", width: mobile ? "92%" : "85%", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ position: "relative" }}>
            <div aria-hidden style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
              padding: "9px 14px", fontSize: mobile ? 16 : 13, fontFamily: "inherit", lineHeight: 1.4,
              color: "var(--msg-text-color)", pointerEvents: "none",
              whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden",
            }}>{renderInputPreview(editText)}</div>
            <textarea ref={editRef} value={editText} onChange={e => setEditText(applyMarkdownShortcuts(e.target.value))}
              onKeyDown={e => {
                if (e.key === "Enter" && e.metaKey) { saveEdit(); return; }
                if (e.key === "Escape") { cancelEdit(); return; }
                if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "b") {
                  e.preventDefault();
                  const ta = e.currentTarget; const s = ta.selectionStart ?? 0; const end = ta.selectionEnd ?? 0; const v = ta.value;
                  if (s === end) { editCursorRef.current = s + 2; setEditText(v.slice(0, s) + "****" + v.slice(s)); }
                  else { editCursorRef.current = end + 4; setEditText(v.slice(0, s) + "**" + v.slice(s, end) + "**" + v.slice(end)); }
                }
                if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "i") {
                  e.preventDefault();
                  const ta = e.currentTarget; const s = ta.selectionStart ?? 0; const end = ta.selectionEnd ?? 0; const v = ta.value;
                  if (s === end) { editCursorRef.current = s + 1; setEditText(v.slice(0, s) + "__" + v.slice(s)); }
                  else { editCursorRef.current = end + 2; setEditText(v.slice(0, s) + "_" + v.slice(s, end) + "_" + v.slice(end)); }
                }
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "s" || e.key === "S" || e.key === "x" || e.key === "X")) {
                  e.preventDefault();
                  const ta = e.currentTarget; const s = ta.selectionStart ?? 0; const end = ta.selectionEnd ?? 0; const v = ta.value;
                  if (s === end) { editCursorRef.current = s + 2; setEditText(v.slice(0, s) + "~~~~" + v.slice(s)); }
                  else { editCursorRef.current = end + 4; setEditText(v.slice(0, s) + "~~" + v.slice(s, end) + "~~" + v.slice(end)); }
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  const ta = e.currentTarget; const s = ta.selectionStart ?? 0; const v = ta.value;
                  const lineStart = v.lastIndexOf("\n", s - 1) + 1;
                  if (e.shiftKey) {
                    if (v.slice(lineStart, lineStart + 4) === "    ") {
                      editCursorRef.current = Math.max(s - 4, lineStart);
                      setEditText(v.slice(0, lineStart) + v.slice(lineStart + 4));
                    }
                  } else {
                    editCursorRef.current = s + 4;
                    setEditText(v.slice(0, lineStart) + "    " + v.slice(lineStart));
                  }
                }
              }}
              className="y2k-input"
              style={{ display: "block", width: "100%", padding: "9px 14px", border: "1px solid var(--accent)", borderRadius: "12px 12px 2px 12px", fontSize: mobile ? 16 : 13, color: "transparent", caretColor: "var(--msg-text-color)", lineHeight: 1.4, background: "var(--msg-bubble-color)", fontFamily: "inherit", resize: "none", minHeight: 72, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={cancelEdit}
              style={{ background: "none", border: "1px solid var(--border-color)", borderRadius: 6, padding: "4px 12px", fontSize: 11, color: "#aaa", cursor: "pointer", fontFamily: "inherit" }}>취소</button>
            <button onClick={saveEdit}
              style={{ background: "var(--accent)", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>저장</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-guestbook-entry-id={memo.id}
      draggable={!mobile}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{ padding: "5px 6px", display: "flex", flexDirection: "column", gap: 0, animation: "y2kFadeIn 0.3s ease", cursor: mobile ? "default" : "grab" }}>

      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ width: "100%", display: "flex", flexDirection: "column", gap: 0 }}>

        {/* ROW: left buttons + bubble — always hug the right edge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>

          {/* LEFT ACTIONS: visible on hover/showActions (desktop), tap to reveal (mobile) */}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <div style={{ maxWidth: (hover || showActions) ? 22 : 0, overflow: "hidden", opacity: (hover || showActions) ? 1 : 0, transition: "max-width 0.15s, opacity 0.15s" }}>
              <button onClick={onPin} title={memo.pinned ? "고정 해제" : "고정"}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1,
                  color: memo.pinned ? "var(--accent)" : "#ccc", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={e => (e.currentTarget.style.color = memo.pinned ? "var(--accent)" : "#ccc")}
              ><PinIcon /></button>
            </div>
            <div style={{ maxWidth: (hover || showActions) ? 22 : 0, overflow: "hidden", opacity: (hover || showActions) ? 1 : 0, transition: "max-width 0.15s, opacity 0.15s" }}>
              <button onClick={onImportant} title={memo.important ? "중요 해제" : "중요"}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1,
                  color: memo.important ? "var(--accent)" : "#ccc", transition: "color 0.15s", fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={e => (e.currentTarget.style.color = memo.important ? "var(--accent)" : "#ccc")}
              >♥</button>
            </div>
            <div style={{ maxWidth: (hover || showActions) ? 26 : 0, overflow: "hidden", opacity: (hover || showActions) ? 1 : 0, transition: "max-width 0.15s, opacity 0.15s" }}>
              <button onClick={copyText} title={copied ? "복사됨" : "복사"}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1, color: copied ? "var(--accent)" : "#ccc", transition: "color 0.15s" }}
                onMouseEnter={e => { if (!copied) e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={e => { if (!copied) e.currentTarget.style.color = "#ccc"; }}
              >{copied ? <span style={{ fontSize: 9, color: "var(--accent)" }}>✓</span> : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}</button>
            </div>
          </div>

          {/* BUBBLE */}
          <div onMouseEnter={() => scheduleActions(true)} onMouseLeave={() => scheduleActions(false)}
            onClick={mobile ? () => setShowActions(v => !v) : undefined}
            style={{
              maxWidth: mobile ? "90%" : "75%",
              background: bubbleBg, border: "none",
              padding: mobile ? "10px 15px" : "9px 14px", borderRadius: "12px 12px 2px 12px",
              fontSize: mobile ? 15 : 13, color: textColor, lineHeight: 1.4,
              overflowWrap: "break-word", wordBreak: "normal", whiteSpace: "pre-wrap",
              boxShadow: "1px 1px 0 rgba(0,0,0,0.02)", fontFamily: "inherit",
              transition: "background 0.2s, color 0.2s",
            }}>
            <MemoContent content={memo.content} todos={memo.todos} onToggle={onToggle} />
            {memo.imageUrls.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4, marginTop: memo.content.trim() ? 8 : 0 }}>
                {memo.imageUrls.map((url, idx) => (
                  <img key={idx} src={url} alt=""
                    style={{ width: "100%", maxHeight: 150, aspectRatio: "4/3", objectFit: "cover", borderRadius: 5, border: "1px solid rgba(0,0,0,0.08)", display: "block" }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BELOW ACTIONS: 답글, 수정, 삭제 — hover (desktop) or tap the bubble (mobile) */}
        <div onMouseEnter={() => scheduleActions(true)} onMouseLeave={() => scheduleActions(false)}
          style={{
            alignSelf: "flex-end", display: "flex", gap: mobile ? 4 : 1,
            height: showActions ? (mobile ? 30 : 20) : 0, overflow: "hidden",
            transition: "height 0.15s",
          }}>
          {[
            { label: "답글", onClick: onReply, icon: <ReplyIcon /> },
            { label: "수정", onClick: startEdit,
              icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
            { label: "삭제", onClick: onDelete,
              icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> },
          ].map(a => (
            <button key={a.label} onClick={a.onClick} title={a.label}
              style={{ background: "none", border: "none", cursor: "pointer", padding: mobile ? "5px 10px" : "2px 6px", lineHeight: 1,
                color: "#bbb", fontSize: mobile ? 12 : 10, fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 3,
                transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.color = "#bbb")}
            >{a.icon}{a.label}</button>
          ))}
        </div>
      </div>

      {/* reply bubbles */}
      {memo.replies.map((r, i) => (
        <ReplyBubble key={i} text={r} first={i === 0} index={i} onReply={onReply} mobile={mobile}
          onEdit={(t) => onEditReply(i, t)}
          onDelete={() => onDeleteReply(i)} />
      ))}
    </div>
  );
}

export default function WidgetPage() {
  const router = useRouter();
  const [cfg, setCfg]               = useState<Config | null>(null);
  const [cfgLoaded, setCfgLoaded]   = useState(false);
  const [memos, setMemos]           = useState<Memo[]>([]);
  const [loading, setLoading]       = useState(false);
  const [activeFolder, setFolder]   = useState("ALL");
  const [showSidebar, setShowSidebar] = useState(true);
  const [minimized, setMinimized]   = useState(false);
  const [inputText, setInputText]   = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore]       = useState(false);
  const [sending, setSending]       = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<{ blob: Blob; preview: string }[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const initialScrollRef = useRef(false);
  const cursorPosRef = useRef<number | null>(null);
  const loadMemosRef = useRef<(cursor?: string) => Promise<void>>(async () => {});

  useEffect(() => {
    // 1) A config embedded in the URL (?config=base64) takes priority.
    //    Keep it in the URL so the user can always copy the share link from the bar.
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("config");
    if (encoded) {
      const decoded = decodeConfig<Config>(encoded);
      if (decoded?.token) {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(decoded));
        setCfg(decoded);
        setCfgLoaded(true);
        return; // URL stays as-is — the user can copy it as a share link
      }
    }
    // 2) Otherwise fall back to whatever was saved locally.
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Config;
      setCfg(parsed);
    }
    setCfgLoaded(true);
  }, []);

  useEffect(() => {
    const defaultF = cfg?.folderOptions?.[0] ?? "";
    setShowSidebar(!!defaultF && activeFolder === defaultF);
  }, [activeFolder, cfg]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (cfg?.folderOptions?.[0] && expandedFolders.size === 0) {
      setExpandedFolders(new Set([cfg.folderOptions[0]]));
    }
  }, [cfg?.folderOptions?.[0]]);

  const accent     = cfg?.accent ?? "#E8A8C0";
  const fontFamily = cfg?.fontFamily ?? "'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,system-ui,sans-serif";
  const cssVars    = cfg ? buildCssVars(cfg) : buildCssVars({ accent } as Config);
  const mobile     = !!cfg?.mobile;

  // Mobile formatting toolbar actions — wrap the current selection (bold/italic/
  // strikethrough) or insert a list marker at the line start. Mirrors the desktop
  // keyboard shortcuts so touch users get the same Notion-style formatting.
  function wrapSelection(left: string, right: string) {
    const ta = textareaRef.current; if (!ta) return;
    const s = ta.selectionStart ?? 0, e = ta.selectionEnd ?? 0, v = ta.value;
    if (s === e) { cursorPosRef.current = s + left.length; setInputText(v.slice(0, s) + left + right + v.slice(s)); }
    else { cursorPosRef.current = e + left.length + right.length; setInputText(v.slice(0, s) + left + v.slice(s, e) + right + v.slice(e)); }
  }
  function insertLineMarker(marker: string) {
    const ta = textareaRef.current; if (!ta) return;
    const s = ta.selectionStart ?? 0, v = ta.value;
    const lineStart = v.lastIndexOf("\n", s - 1) + 1;
    // Toggle off if the same marker already leads the line.
    const existing = v.slice(lineStart).match(/^(- \[[ x]\] |- |\d+\. )/);
    if (existing && existing[1] === marker) {
      cursorPosRef.current = Math.max(s - marker.length, lineStart);
      setInputText(v.slice(0, lineStart) + v.slice(lineStart + marker.length));
    } else {
      cursorPosRef.current = s + marker.length;
      setInputText(v.slice(0, lineStart) + marker + v.slice(lineStart));
    }
  }

  const loadMemos = useCallback(async (cursor?: string) => {
    if (!cfg) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        token: cfg.token, databaseId: cfg.databaseId,
        ...(cfg.folderProp    ? { folderProp:    cfg.folderProp }    : {}),
        ...(cfg.pinnedProp    ? { pinnedProp:    cfg.pinnedProp }    : {}),
        ...(cfg.importantProp ? { importantProp: cfg.importantProp } : {}),
        ...(cfg.replyProp     ? { replyProp:     cfg.replyProp }     : {}),
        ...(cursor            ? { cursor }                           : {}),
      });
      const r = await fetch(`/api/notion/memos?${q}`);
      const d = await r.json();
      const reversed = [...(d.memos ?? [])].reverse();
      if (cursor) {
        const scrollEl = scrollRef.current;
        const prevScrollHeight = scrollEl?.scrollHeight ?? 0;
        setMemos(prev => [...reversed, ...prev]);
        setTimeout(() => {
          if (scrollEl) scrollEl.scrollTop += scrollEl.scrollHeight - prevScrollHeight;
        }, 0);
      } else {
        setMemos(reversed);
        // Pin to bottom across several frames while images/fonts settle so the
        // list doesn't visibly jump up after the first paint.
        initialScrollRef.current = true;
        [0, 80, 200, 400, 700].forEach(t =>
          setTimeout(() => {
            if (initialScrollRef.current && scrollRef.current)
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }, t)
        );
        setTimeout(() => { initialScrollRef.current = false; }, 1000);
      }
      setNextCursor(d.nextCursor);
      setHasMore(d.hasMore);
    } finally { setLoading(false); }
  }, [cfg]);

  useEffect(() => { loadMemosRef.current = loadMemos; }, [loadMemos]);

  useEffect(() => {
    if (!cfgLoaded) return;
    if (!cfg?.token) { router.replace("/onboarding"); return; }
    loadMemos();
  }, [cfgLoaded, cfg, loadMemos, router]);

  // Load older pages when the user scrolls near the top (instead of auto-loading
  // immediately, which would push content down and snap the scroll position up).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cancelInitial = () => { initialScrollRef.current = false; };
    const onScroll = () => {
      if (initialScrollRef.current) return;
      if (el.scrollTop < 120 && !loading && hasMore && nextCursor) {
        loadMemosRef.current(nextCursor);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", cancelInitial, { passive: true });
    el.addEventListener("touchmove", cancelInitial, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", cancelInitial);
      el.removeEventListener("touchmove", cancelInitial);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgLoaded, loading, hasMore, nextCursor]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "32px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [inputText]);

  // On mobile, keep scroll pinned to bottom when keyboard opens/closes
  useEffect(() => {
    if (!mobile) return;
    const handler = () => {
      // Always scroll to bottom when keyboard opens — clientHeight shrinks so
      // nearBottom checks are unreliable here.
      setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 80);
    };
    window.visualViewport?.addEventListener("resize", handler);
    return () => window.visualViewport?.removeEventListener("resize", handler);
  }, [mobile]);

  // Restore cursor after Tab indentation / Shift+Enter list continuation.
  // Layout effect runs before paint so the caret never visibly jumps.
  useLayoutEffect(() => {
    if (cursorPosRef.current !== null && textareaRef.current) {
      const pos = cursorPosRef.current;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
      cursorPosRef.current = null;
    }
  }, [inputText]);

  async function uploadImages(images: { blob: Blob; preview: string }[]): Promise<string[]> {
    if (!cfg || images.length === 0) return [];
    const ids: string[] = [];
    for (const img of images) {
      const fd = new FormData();
      fd.append("token", cfg.token);
      fd.append("file", img.blob, "image.png");
      try {
        const res = await fetch("/api/notion/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.uploadId) ids.push(data.uploadId);
      } catch { /* skip failed */ }
    }
    return ids;
  }

  async function sendMemo(e: React.FormEvent) {
    e.preventDefault();
    if ((!inputText.trim() && pendingImages.length === 0) || !cfg || sending) return;
    const text = inputText.trim();
    const images = [...pendingImages];
    setSending(true);
    setInputText("");
    setPendingImages([]);

    if (replyingTo) {
      const id = replyingTo;
      setReplyingTo(null);
      try {
        const memo = memos.find(m => m.id === id);
        const newReplies = [...(memo?.replies ?? []), text];
        setMemos(prev => prev.map(m => m.id === id ? { ...m, replies: newReplies } : m));
        await fetch(`/api/notion/memos/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: cfg.token, replyProp: cfg.replyProp, reply: newReplies.join("|||") }),
        });
      } finally { setSending(false); }
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2,"0");
    const createdAt = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const targetFolder =
      activeFolder === "ALL" || activeFolder === "전체" || activeFolder === "고정" || activeFolder === "중요"
        ? (cfg.folderOptions[0] ?? "")
        : activeFolder;

    // Optimistic pending bubble
    const tempMemo: Memo = {
      id: tempId, content: text, todos: [], createdAt, replies: [],
      pinned: false, important: false, folder: targetFolder,
      imageUrls: images.map(i => i.preview),
      pending: true,
    };
    setMemos(prev => [...prev, tempMemo]);
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 30);

    try {
      const imageUploadIds = await uploadImages(images);
      const r = await fetch("/api/notion/memos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cfg.token, databaseId: cfg.databaseId, content: text,
          folder: targetFolder, folderProp: cfg.folderProp,
          pinnedProp: cfg.pinnedProp, importantProp: cfg.importantProp,
          dateProp: cfg.dateProp,
          imageUploadIds,
        }),
      });
      const d = await r.json();
      if (d.id) {
        setMemos(prev => prev.map(m => m.id === tempId
          ? { ...tempMemo, id: d.id, pending: false } : m));
      } else {
        // Save failed — drop the optimistic bubble, restore the draft, and
        // surface the real Notion error instead of failing silently.
        setMemos(prev => prev.filter(m => m.id !== tempId));
        setInputText(text);
        setPendingImages(images);
        alert("저장 실패: " + (d.error ?? "알 수 없는 오류"));
      }
    } catch {
      setMemos(prev => prev.filter(m => m.id !== tempId));
      setInputText(text);
      setPendingImages(images);
      alert("저장 실패: 네트워크 오류");
    } finally { setSending(false); }
  }

  async function updateMemo(id: string, patch: Record<string, unknown>) {
    if (!cfg) return;
    setMemos(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
    await fetch(`/api/notion/memos/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, pinnedProp: cfg.pinnedProp, importantProp: cfg.importantProp, folderProp: cfg.folderProp, replyProp: cfg.replyProp, ...patch }),
    });
  }

  async function deleteMemo(id: string) {
    if (!cfg) return;
    setMemos(prev => prev.filter(m => m.id !== id));
    await fetch(`/api/notion/memos/${id}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token }),
    });
  }

  async function editReply(memoId: string, index: number, text: string) {
    const memo = memos.find(m => m.id === memoId);
    if (!memo || !cfg) return;
    const newReplies = memo.replies.map((r, i) => i === index ? text : r);
    setMemos(prev => prev.map(m => m.id === memoId ? { ...m, replies: newReplies } : m));
    await fetch(`/api/notion/memos/${memoId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, replyProp: cfg.replyProp, reply: newReplies.join("|||") }),
    });
  }

  async function deleteReply(memoId: string, index: number) {
    const memo = memos.find(m => m.id === memoId);
    if (!memo || !cfg) return;
    const newReplies = memo.replies.filter((_, i) => i !== index);
    setMemos(prev => prev.map(m => m.id === memoId ? { ...m, replies: newReplies } : m));
    await fetch(`/api/notion/memos/${memoId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, replyProp: cfg.replyProp, reply: newReplies.join("|||") }),
    });
  }

  async function editMemo(id: string, content: string) {
    if (!cfg) return;
    setMemos(prev => prev.map(m => m.id === id ? { ...m, content } : m));
    await fetch(`/api/notion/memos/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, content }),
    });
  }

  async function toggleTodo(todoId: string, checked: boolean, memoId: string) {
    if (!cfg) return;
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      const target = m.todos.find(t => t.id === todoId);
      const todos = m.todos.map(t => t.id === todoId ? { ...t, checked } : t);
      // The checkbox shown in the bubble is derived from `content`, so flip the
      // matching line there too — otherwise clicking does nothing visually.
      let content = m.content;
      if (target) {
        const from = `- [${checked ? " " : "x"}] ${target.text}`;
        const to   = `- [${checked ? "x" : " "}] ${target.text}`;
        content = content.replace(from, to);
      }
      return { ...m, todos, content };
    }));
    await fetch(`/api/notion/blocks/${todoId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, checked }),
    });
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape" && replyingTo) { setReplyingTo(null); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMemo(e as unknown as React.FormEvent); return; }
    if (e.key === "Enter" && e.shiftKey) {
      // Continue the current list item on Shift+Enter (Notion-style): a new
      // line inside a checkbox/bullet should keep the same marker + indent.
      const ta = e.currentTarget;
      const start = ta.selectionStart ?? 0;
      const val = ta.value;
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const curLine = val.slice(lineStart, start);
      const m = curLine.match(/^(\s*)(- \[[ x]\] |- )/);
      if (m) {
        const marker = m[2].startsWith("- [") ? "- [ ] " : "- ";
        const insert = "\n" + m[1] + marker;
        e.preventDefault();
        cursorPosRef.current = start + insert.length;
        setInputText(val.slice(0, start) + insert + val.slice(start));
      }
      return;
    }
    if (e.key === "Backspace") {
      // Deleting at the start of a list item's text removes the whole marker
      // (- [ ] / - ) at once instead of leaving a broken "- [" behind.
      const ta = e.currentTarget;
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;
      if (start === end) {
        const val = ta.value;
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const m = val.slice(lineStart).match(/^(\s*)(- \[[ x]\] |- )/);
        if (m) {
          const indentLen = m[1].length;
          const editStart = lineStart + m[0].length;
          // cursor is anywhere inside the marker (incl. right after it)
          if (start > lineStart + indentLen && start <= editStart) {
            e.preventDefault();
            cursorPosRef.current = lineStart + indentLen;
            setInputText(val.slice(0, lineStart + indentLen) + val.slice(editStart));
            return;
          }
        }
      }
    }
    if (e.key === "ArrowLeft" && !e.shiftKey) {
      const ta = e.currentTarget;
      const pos = ta.selectionStart ?? 0;
      const val = ta.value;
      const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
      const prefixMatch = val.slice(lineStart).match(/^(\s*)(- \[[ x]\] |- )/);
      if (prefixMatch) {
        const editStart = lineStart + prefixMatch[0].length;
        if (pos > lineStart && pos <= editStart) {
          e.preventDefault();
          ta.setSelectionRange(editStart, editStart);
          return;
        }
      }
    }
    if (e.key === "ArrowUp" && !e.shiftKey) {
      const ta = e.currentTarget;
      const pos = ta.selectionStart ?? 0;
      const val = ta.value;
      const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
      if (lineStart > 0) {
        const prevLineEnd = lineStart - 1;
        const prevLineStart = val.lastIndexOf("\n", prevLineEnd - 1) + 1;
        const prevLine = val.slice(prevLineStart, prevLineEnd);
        const prevPrefixMatch = prevLine.match(/^(\s*)(- \[[ x]\] |- )/);
        if (prevPrefixMatch) {
          const prevEditStart = prevLineStart + prevPrefixMatch[0].length;
          const col = pos - lineStart;
          if (prevLineStart + col < prevEditStart) {
            e.preventDefault();
            ta.setSelectionRange(prevEditStart, prevEditStart);
            return;
          }
        }
      }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart ?? 0;
      const val = ta.value;
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      if (e.shiftKey) {
        if (val.slice(lineStart, lineStart + 4) === "    ") {
          cursorPosRef.current = Math.max(start - 4, lineStart);
          setInputText(val.slice(0, lineStart) + val.slice(lineStart + 4));
        }
      } else {
        cursorPosRef.current = start + 4;
        setInputText(val.slice(0, lineStart) + "    " + val.slice(lineStart));
      }
    }
    // Notion-style inline formatting shortcuts
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "b") {
      e.preventDefault();
      const ta = e.currentTarget; const s = ta.selectionStart ?? 0; const end = ta.selectionEnd ?? 0; const v = ta.value;
      if (s === end) { cursorPosRef.current = s + 2; setInputText(v.slice(0, s) + "****" + v.slice(s)); }
      else { cursorPosRef.current = end + 4; setInputText(v.slice(0, s) + "**" + v.slice(s, end) + "**" + v.slice(end)); }
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "i") {
      e.preventDefault();
      const ta = e.currentTarget; const s = ta.selectionStart ?? 0; const end = ta.selectionEnd ?? 0; const v = ta.value;
      if (s === end) { cursorPosRef.current = s + 1; setInputText(v.slice(0, s) + "__" + v.slice(s)); }
      else { cursorPosRef.current = end + 2; setInputText(v.slice(0, s) + "_" + v.slice(s, end) + "_" + v.slice(end)); }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "s" || e.key === "S" || e.key === "x" || e.key === "X")) {
      e.preventDefault();
      const ta = e.currentTarget; const s = ta.selectionStart ?? 0; const end = ta.selectionEnd ?? 0; const v = ta.value;
      if (s === end) { cursorPosRef.current = s + 2; setInputText(v.slice(0, s) + "~~~~" + v.slice(s)); }
      else { cursorPosRef.current = end + 4; setInputText(v.slice(0, s) + "~~" + v.slice(s, end) + "~~" + v.slice(end)); }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(i => i.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    for (const item of imageItems) {
      const blob = item.getAsFile();
      if (!blob) continue;
      const preview = URL.createObjectURL(blob);
      setPendingImages(prev => [...prev, { blob, preview }]);
    }
  }

  if (!cfgLoaded) return (
    <div style={{ width:"100%", height:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", background:"#fff" }}>
      <span style={{ fontSize:13, color:"#bbb" }}>로딩 중...</span>
    </div>
  );

  const folderList    = cfg?.folderOptions ?? [];
  const defaultFolder = cfg?.folderOptions?.[0] ?? "";

  const effectiveFolder = (m: Memo) => m.folder || defaultFolder;

  const filteredMemos = activeFolder === "ALL" || activeFolder === "전체" ? memos
    : activeFolder === "고정" ? memos.filter(m => m.pinned)
    : activeFolder === "중요" ? memos.filter(m => m.important)
    : memos.filter(m => effectiveFolder(m) === activeFolder);

  const folderColor = (f: string): string | undefined => {
    if (!cfg) return undefined;
    const eff = f || defaultFolder;
    const i = cfg.folderOptions?.indexOf(eff) ?? -1;
    return i >= 0 ? (cfg.folderColorPalette?.[i] ?? undefined) : undefined;
  };
  const folderBubbleColor = (f: string): string | undefined => {
    if (!cfg?.folderBubblePalette) return undefined;
    const eff = f || defaultFolder;
    const i = cfg.folderOptions?.indexOf(eff) ?? -1;
    return i >= 0 ? (cfg.folderBubblePalette[i] || undefined) : undefined;
  };

  const sidebarItems: Array<{ type: "folder"|"pinned"|"important"|"empty"; label?: string; color?: string }> = [];
  folderList.forEach((f, i) => {
    sidebarItems.push({ type: "folder", label: f, color: cfg?.folderColorPalette?.[i] ?? "var(--accent)" });
    if (i === 0) sidebarItems.push({ type: "pinned" });
    else if (i === 1) sidebarItems.push({ type: "important" });
    else sidebarItems.push({ type: "empty" });
  });

  const replyingMemo = replyingTo ? memos.find(m => m.id === replyingTo) : null;

  // Group memos by folder for ALL tab (plain computation — must not be a hook
  // here since it runs after the early `!cfgLoaded` return above)
  const folderGroups = (() => {
    if (activeFolder !== "전체" || folderList.length === 0) return null;
    const groups = new Map<string, Memo[]>();
    for (const f of folderList) groups.set(f, []);
    for (const m of memos) {
      const f = m.folder || defaultFolder;
      if (groups.has(f)) groups.get(f)!.push(m);
      else groups.set(f, [m]);
    }
    return groups;
  })();

  function toggleFolderExpand(f: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  }

  function renderMemo(memo: Memo) {
    return (
      <MemoBubble key={memo.id} memo={memo}
        folderColor={folderColor(memo.folder)}
        folderBubbleColor={folderBubbleColor(memo.folder)}
        mobile={mobile}
        onPin={() => updateMemo(memo.id, { pinned: !memo.pinned })}
        onImportant={() => updateMemo(memo.id, { important: !memo.important })}
        onDelete={() => deleteMemo(memo.id)}
        onToggle={(tid, checked) => toggleTodo(tid, checked, memo.id)}
        onEdit={(content) => editMemo(memo.id, content)}
        onReply={() => { setReplyingTo(memo.id); setTimeout(() => textareaRef.current?.focus(), 50); }}
        onEditReply={(index, text) => editReply(memo.id, index, text)}
        onDeleteReply={(index) => deleteReply(memo.id, index)}
      />
    );
  }

  return (
    <div style={{
      width:"100%", height:"100dvh", boxSizing:"border-box", overflow:"hidden",
      padding: mobile ? 0 : 16, display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily: fontFamily, background:"#ffffff",
    }}>
      <style>{cssVars}</style>
      {mobile && <style>{`.mobile-memo:hover{transform:none!important;box-shadow:none!important;}`}</style>}
      {mobile && <DynamicThemeColor color={accent} />}

      <div className={mobile ? "y2k-widget mobile-memo" : "y2k-widget"} style={{
        width:"100%", maxWidth:"100%", height: minimized ? "auto" : "100%",
        alignSelf: minimized ? "flex-start" : "stretch",
        background:"var(--bg-color)", borderRadius:0, border:"none", outline:"none",
        display:"flex", flexDirection:"column", overflow:"hidden",
        boxSizing:"border-box", fontFamily:"var(--widget-font-family, inherit)",
      }}>

        {/* Safe-area fill above header on mobile */}
        {mobile && <div style={{ height:"env(safe-area-inset-top,0px)", background:"#ffffff", flexShrink:0 }} />}

        {/* Header */}
        <div style={{
          height: mobile?46:35, background:"var(--accent-light)",
          borderBottom:"1px solid var(--accent)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 8px 0 10px", fontSize:13, color:"var(--accent)", flexShrink:0,
        }}>
          <div style={{ display:"flex", gap:4, alignItems:"center", flex:1, minWidth:0, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:0, fontSize:12, fontWeight:600, fontFamily:"inherit", minWidth:0, flex:1 }}>
              <button className="y2k-folder-btn" onClick={() => setShowSidebar(v => !v)} title="폴더 숨기기"
                style={{ background:"none", border:"none", cursor:"pointer", padding:"0 5px 0 2px", lineHeight: mobile?"46px":"35px", height: mobile?46:35, display:"flex", alignItems:"center", color:"var(--accent)", opacity:0.7, transition:"opacity 0.15s", flexShrink:0 }}>
                <FolderIcon size={14} fill="currentColor" stroke="currentColor" />
              </button>

              <div className="y2k-folder-tabs" style={{ display:"flex", alignItems:"center", flex:1, minWidth:0, overflowX:"auto" }}>
                <button className="y2k-folder-btn" onClick={() => setFolder("ALL")}
                  style={{ background:"none", border:"none", cursor:"pointer", padding: mobile?"0 12px":"0 9px", fontSize: mobile?14:12, fontWeight: activeFolder==="ALL" ? 700 : 500, fontFamily:"inherit", color:"var(--text-color)", opacity: activeFolder==="ALL" ? 1 : 0.55, lineHeight: mobile?"46px":"35px", height: mobile?46:35, borderRadius:0, transition:"all 0.15s", flexShrink:0, whiteSpace:"nowrap" }}>
                  ALL
                </button>
                {folderList.map(f => (
                  <div key={f} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                    <span style={{ color:"var(--accent)", opacity:0.3, fontSize:9 }}>|</span>
                    <button className="y2k-folder-btn" onClick={() => setFolder(f)}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolder(f); }}
                      onDragLeave={() => setDragOverFolder(null)}
                      onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) updateMemo(id, { folder: f }); setDragOverFolder(null); }}
                      style={{ background: dragOverFolder===f ? "var(--accent-light)" : "none", border:"none", cursor:"pointer", padding: mobile?"0 12px":"0 9px", fontSize: mobile?14:12, fontWeight: activeFolder===f ? 700 : 500, fontFamily:"inherit", color:"var(--text-color)", opacity: activeFolder===f ? 1 : 0.55, lineHeight: mobile?"46px":"35px", height: mobile?46:35, borderRadius:4, transition:"all 0.15s", whiteSpace:"nowrap", outline: dragOverFolder===f ? "2px dashed var(--accent)" : "none" }}>
                      {f}
                    </button>
                  </div>
                ))}
                {["고정","중요","전체"].map(label => (
                  <div key={label} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                    <span style={{ color:"var(--accent)", opacity:0.3, fontSize:9 }}>|</span>
                    <button className="y2k-folder-btn" onClick={() => setFolder(label)}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:"0 7px", lineHeight: mobile?"46px":"35px", height: mobile?46:35, display:"flex", alignItems:"center", gap:3, opacity: activeFolder===label ? 1 : 0.5, transition:"opacity 0.15s", color:"var(--text-color)" }}>
                      <FolderIcon size={mobile?15:13} fill="currentColor" stroke="currentColor" />
                      <span style={{ fontSize: mobile?12:10, fontFamily:"inherit", fontWeight:500 }}>{label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            <div className="y2k-win-btn" onClick={() => loadMemos()} title="새로고침"
              style={{ width: mobile?20:12, height: mobile?20:12, border:"1px solid var(--accent)", background:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize: mobile?12:9, cursor:"pointer", lineHeight:1 }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
            </div>
            <div className="y2k-win-btn" onClick={() => setMinimized(v => !v)} title={minimized ? "펼치기" : "최소화"}
              style={{ width: mobile?20:12, height: mobile?20:12, border:"1px solid var(--accent)", background:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize: mobile?12:9, cursor:"pointer", lineHeight:1 }}>{minimized ? "□" : "_"}</div>
            <div className="y2k-win-btn"
              style={{ width: mobile?20:12, height: mobile?20:12, border:"1px solid var(--accent)", background:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize: mobile?12:9, lineHeight:1 }}>x</div>
          </div>
        </div>

        <div style={{ flex:1, minHeight:0, display: minimized ? "none" : "flex", flexDirection:"row", overflow:"hidden" }}>

          {/* Sidebar */}
          <div style={{ flexShrink:0, display:"flex", flexDirection:"row", alignItems:"stretch", overflow:"hidden" }}>
            <div style={{
              width: showSidebar ? (mobile?128:110) : 0,
              opacity: showSidebar ? 1 : 0,
              transform: showSidebar ? "translateX(0)" : (mobile?"translateX(-128px)":"translateX(-110px)"),
              transition: "width 0.25s ease, opacity 0.2s ease, transform 0.25s ease",
              display:"grid", gridTemplateColumns:"1fr 1fr", gap: mobile?"10px 4px":"6px 2px",
              padding: showSidebar ? (mobile?"20px 6px 8px 16px":"18px 6px 8px 17px") : 0,
              overflow:"hidden", alignContent:"start",
            }}>
              {sidebarItems.map((item, i) => {
                if (item.type === "empty") return <div key={i} />;
                const isSpecial = item.type === "pinned" || item.type === "important";
                const label = item.type === "pinned" ? "고정" : item.type === "important" ? "중요" : item.label!;
                const color = isSpecial ? "var(--accent)" : item.color!;
                const isActive = activeFolder === label;
                const isDragOver = !isSpecial && dragOverFolder === label;
                return (
                  <div key={i} className="y2k-folder-btn"
                    onClick={() => setFolder(label)}
                    onDragOver={isSpecial ? undefined : e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolder(label); }}
                    onDragLeave={isSpecial ? undefined : () => setDragOverFolder(null)}
                    onDrop={isSpecial ? undefined : e => {
                      e.preventDefault();
                      const memoId = e.dataTransfer.getData("text/plain");
                      if (memoId) updateMemo(memoId, { folder: label });
                      setDragOverFolder(null);
                    }}
                    style={{
                      display:"flex", flexDirection:"column", alignItems:"center", gap:1,
                      padding:"3px 4px", borderRadius:4, cursor:"pointer",
                      pointerEvents:"auto",
                      background: isDragOver ? `${color}30` : "transparent",
                      outline: isDragOver ? `2px dashed ${color}` : "none",
                      transform: isDragOver ? "scale(1.12)" : "scale(1)",
                      transition:"background 0.12s, transform 0.12s, outline 0.12s",
                      ...(isSpecial ? { justifySelf:"end" } : {}),
                    }}>
                    <div style={{ pointerEvents:"none", opacity: isActive ? 1 : 0.7 }}>
                      <FolderIcon size={mobile?30:25} fill={color} stroke={color} />
                    </div>
                    <span style={{
                      pointerEvents:"none", fontSize: isSpecial ? (mobile?11:9) : (mobile?12:10),
                      fontWeight:500, color:"var(--text-color)", opacity: isActive ? 1 : 0.55,
                      fontFamily:"inherit", textAlign:"center", lineHeight:1.1,
                      maxWidth: mobile?54:48, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>{label}</span>
                  </div>
                );
              })}
            </div>

            {showSidebar && (
              <button onClick={() => setShowSidebar(false)} title="폴더 숨기기"
                style={{ background:"none", border:"none", cursor:"pointer", padding:"0 4px", color:"var(--accent)", opacity:0.6, transition:"opacity 0.15s", lineHeight:1, display:"flex", alignItems:"flex-end", paddingBottom:12 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            )}
          </div>

          {/* Memo list */}
          <div ref={scrollRef} className="y2k-scroll"
            style={{ flex:1, minHeight:0, overflowY:"scroll", padding:"8px 14px 8px 8px" }}>

            {loading && memos.length === 0 && (
              <div style={{ padding:40, textAlign:"center", color:"var(--accent)", fontSize:13 }}>
                <span style={{ display:"inline-block", width:16, height:16, border:"2px solid var(--accent-light)", borderTopColor:"var(--accent)", borderRadius:"50%", animation:"spin 0.7s linear infinite", marginBottom:8 }} />
                <br />불러오는 중...
              </div>
            )}

            {!loading && memos.length === 0 && (
              <div style={{ padding:40, textAlign:"center", color:"var(--border-color)", fontSize:13 }}>
                메모가 없습니다.
              </div>
            )}

            {/* 전체 tab: grouped by folder with collapsible sections */}
            {activeFolder === "전체" && folderGroups
              ? Array.from(folderGroups.entries()).map(([folder, fMemos]) => {
                  const isExpanded = expandedFolders.size === 0 ? folder === defaultFolder : expandedFolders.has(folder);
                  const fColor = folderColor(folder) ?? "var(--accent)";
                  return (
                    <div key={folder} style={{ marginBottom: 4 }}>
                      <button onClick={() => toggleFolderExpand(folder)}
                        style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"4px 4px 4px 2px", width:"100%", textAlign:"left", color:"var(--text-color)", fontFamily:"inherit" }}>
                        <FolderIcon size={13} fill={fColor} stroke={fColor} />
                        <span style={{ fontSize:11, fontWeight:600, opacity:0.65 }}>{folder}</span>
                        <span style={{ fontSize:10, opacity:0.3, marginLeft:1 }}>{fMemos.length}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ marginLeft:"auto", opacity:0.35, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition:"transform 0.2s" }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      {isExpanded && fMemos.map(renderMemo)}
                    </div>
                  );
                })
              : filteredMemos.map(renderMemo)
            }

            {/* Subtle loading indicator when auto-loading older pages */}
            {loading && memos.length > 0 && (
              <div style={{ display:"flex", justifyContent:"center", padding:"4px 0", opacity:0.3 }}>
                <span style={{ display:"inline-block", width:10, height:10, border:"1.5px solid var(--accent)", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
              </div>
            )}
          </div>
        </div>

        {/* Input form */}
        <form onSubmit={sendMemo} style={{
          paddingBottom: mobile ? "calc(env(safe-area-inset-bottom, 4px) + 4px)" : 8,
          borderTop:"1px dotted var(--border-dot)",
          display: minimized ? "none" : "flex", flexDirection:"column", background:"var(--bg-color)", flexShrink:0,
        }}>
          {replyingMemo && (
            <div style={{
              display:"flex", alignItems:"center", gap:6, padding:"5px 10px",
              background:"var(--accent-light)", borderBottom:"1px solid var(--border-color)",
              fontSize:11, color:"var(--accent)",
            }}>
              <ReplyIcon />
              <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", opacity:0.8 }}>
                {replyingMemo.content.split("\n")[0].slice(0, 50)}
              </span>
              <button type="button" onClick={() => setReplyingTo(null)}
                style={{ background:"none", border:"none", cursor:"pointer", color:"var(--accent)", fontSize:14, padding:0, lineHeight:1, opacity:0.7 }}>×</button>
            </div>
          )}

          {/* Image previews */}
          {pendingImages.length > 0 && (
            <div style={{ display:"flex", gap:6, padding:"6px 10px 0", flexWrap:"wrap" }}>
              {pendingImages.map((img, i) => (
                <div key={i} style={{ position:"relative" }}>
                  <img src={img.preview} alt="" style={{ width:60, height:60, objectFit:"cover", borderRadius:6, border:"1px solid var(--border-color)" }} />
                  <button type="button"
                    onClick={() => { URL.revokeObjectURL(img.preview); setPendingImages(prev => prev.filter((_, j) => j !== i)); }}
                    style={{ position:"absolute", top:-4, right:-4, width:16, height:16, borderRadius:"50%", background:"var(--accent)", border:"none", color:"white", fontSize:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Mobile formatting toolbar — no keyboard shortcuts on touch, so expose
              bold/italic/strike + list markers as buttons. They wrap the selection
              or insert a marker at the line start. */}
          {mobile && (
            <div style={{ display:"flex", gap:6, padding:"6px 8px 0", flexWrap:"wrap" }}>
              {[
                { key:"b", label:"B",  style:{ fontWeight:800 } as React.CSSProperties, onClick:() => wrapSelection("**","**") },
                { key:"i", label:"i",  style:{ fontStyle:"italic", fontFamily:"serif" } as React.CSSProperties, onClick:() => wrapSelection("_","_") },
                { key:"s", label:"S",  style:{ textDecoration:"line-through" } as React.CSSProperties, onClick:() => wrapSelection("~~","~~") },
                { key:"c", label:"☑",  style:{} as React.CSSProperties, onClick:() => insertLineMarker("- [ ] ") },
                { key:"u", label:"•",  style:{} as React.CSSProperties, onClick:() => insertLineMarker("- ") },
                { key:"n", label:"1.", style:{} as React.CSSProperties, onClick:() => insertLineMarker("1. ") },
              ].map(b => (
                <button key={b.key} type="button" onMouseDown={e => e.preventDefault()} onClick={b.onClick}
                  style={{ minWidth:34, height:30, border:"1px solid var(--accent-light)", borderRadius:6, background:"var(--bg-color)", color:"var(--text-color)", fontSize:14, fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:"0 8px", ...b.style }}>
                  {b.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display:"flex", gap:6, padding:"8px 8px 0", alignItems:"flex-end" }}>
            <label title="이미지 첨부"
              style={{ width: mobile?40:32, height: mobile?40:32, border:"1px solid var(--accent-light)", borderRadius:4, background:"var(--bg-color)", color:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", padding:0, flexShrink:0, cursor:"pointer", opacity:0.75 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <input type="file" accept="image/*" multiple style={{ display:"none" }}
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  for (const f of files) {
                    const preview = URL.createObjectURL(f);
                    setPendingImages(prev => [...prev, { blob: f, preview }]);
                  }
                  e.target.value = "";
                }} />
            </label>

            {/* Textarea with markdown preview overlay */}
            <div style={{ flex: 1, position: "relative" }}>
              {/* Rendered markdown preview (sits on top, pointer-events none) */}
              <div aria-hidden style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
                padding: mobile ? "9px 12px" : "7px 10px", fontSize: mobile ? 16 : 13, fontFamily: "inherit", lineHeight: 1.5,
                color: "var(--text-color)", pointerEvents: "none",
                whiteSpace: "pre-wrap", wordBreak: "break-word", overflowY: "hidden",
              }}>
                {inputText
                  ? renderInputPreview(inputText)
                  : <span style={{ color: "#bbb", fontStyle: "normal" }}>{replyingMemo ? "답글 입력..." : "memo"}</span>
                }
              </div>
              <textarea ref={textareaRef} value={inputText}
                onChange={e => setInputText(applyMarkdownShortcuts(e.target.value))}
                onKeyDown={handleTextareaKeyDown}
                onPaste={handlePaste}
                placeholder="" autoComplete="off" rows={1}
                className="y2k-input"
                style={{
                  display: "block", width: "100%", padding: mobile ? "9px 12px" : "7px 10px",
                  border: "1px solid var(--border-color, #e8e8e8)",
                  borderRadius: 4, fontSize: mobile ? 16 : 13, fontFamily: "inherit",
                  color: "transparent", caretColor: "var(--text-color)",
                  outline: "none", background: "var(--bg-color)", transition: "border 0.2s ease",
                  resize: "none", overflow: "hidden", lineHeight: 1.5, minHeight: mobile ? 40 : 32, maxHeight: 120,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button type="submit" disabled={(!inputText.trim() && pendingImages.length === 0) || sending}
              className="y2k-send"
              style={{
                background: (inputText.trim() || pendingImages.length > 0) ? "var(--accent)" : "var(--border-color, #e8e8e8)",
                color:"white", border:"none", borderRadius:12, padding: mobile?"0 18px":"0 14px",
                fontFamily:"inherit", fontSize: mobile?13:12, fontWeight:"bold", height: mobile?40:32,
                cursor: (inputText.trim() || pendingImages.length > 0) ? "pointer" : "not-allowed", transition:"all 0.2s",
              }}>
              SEND
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
