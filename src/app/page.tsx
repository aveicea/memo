"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

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
  folderOptions: string[]; folderColorPalette: string[];
  fontFamily: string; accent: string;
  accentLight?: string; textColor?: string;
  msgBubbleBg?: string; msgTextColor?: string;
  replyBubbleBg?: string; replyTextColor?: string;
  alignLeft?: boolean;
  folderProp?: string; pinnedProp?: string;
  importantProp?: string; replyProp?: string;
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
  return `hsl(${h}, ${Math.min(s * 0.25, 20)}%, 95%)`;
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
    <g transform="scale(-1 1) translate(-24 0)">
      <polyline points="9 17 4 12 9 7"/>
      <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
    </g>
  </svg>
);

function applyMarkdownShortcuts(val: string): string {
  return val
    .replace(/(^|\n)\[ \] /g, "$1- [ ] ")
    .replace(/(^|\n)\[\] /g, "$1- [ ] ");
}

function parseLines(content: string) {
  const rawLines = content.split("\n");
  while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === "") rawLines.pop();
  return rawLines.map(line => {
    const indentCount = line.match(/^( *)/)?.[1]?.length ?? 0;
    const indent = Math.floor(indentCount / 2);
    const trimmed = line.trimStart();
    const todo = trimmed.match(/^- \[(x| )\] (.+)/);
    if (todo) return { type: "todo" as const, checked: todo[1]==="x", text: todo[2], indent };
    const bullet = trimmed.match(/^- (.+)/);
    if (bullet) return { type: "bullet" as const, text: bullet[1], indent };
    return { type: "para" as const, text: line, indent: 0 };
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
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, cursor: "pointer", paddingLeft: line.indent * 14 }}
              onClick={() => tid && onToggle(tid, !line.checked)}>
              <span style={{ flexShrink: 0, marginTop: 1, opacity: line.checked ? 0.35 : 0.6 }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1.5" y="1.5" width="13" height="13" rx="2"/>
                  {line.checked && <polyline points="4.5 8.5 7 11 11.5 5.5" strokeWidth="1.8"/>}
                </svg>
              </span>
              <span style={{ textDecoration: line.checked ? "line-through" : "none", opacity: line.checked ? 0.4 : 1, wordBreak: "break-word" }}>{line.text}</span>
            </div>
          );
        }
        if (line.type === "bullet") {
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, paddingLeft: line.indent * 14 }}>
              <span style={{ flexShrink: 0, opacity: 0.5, fontSize: 11, marginTop: 1 }}>•</span>
              <span style={{ wordBreak: "break-word" }}>{line.text}</span>
            </div>
          );
        }
        return <div key={i} style={{ paddingLeft: line.indent * 14 }}>{line.text || <>&nbsp;</>}</div>;
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

function MemoBubble({ memo, folderColor, onPin, onImportant, onDelete, onToggle, onEdit, onReply }: {
  memo: Memo;
  folderColor?: string;
  onPin: () => void; onImportant: () => void; onDelete: () => void;
  onToggle: (id: string, checked: boolean) => void;
  onEdit: (content: string) => void;
  onReply: () => void;
}) {
  const [hover, setHover]       = useState(false);
  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(memo.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isImportant = memo.important;
  const bubbleBg = isImportant
    ? "var(--reply-bubble-color)"
    : folderColor
      ? folderToBubbleColor(folderColor)
      : "var(--msg-bubble-color)";
  const textColor = isImportant ? "var(--reply-text-color)" : "var(--msg-text-color)";

  function copyText() { navigator.clipboard.writeText(memo.content).catch(() => {}); }
  function startEdit() { setEditText(memo.content); setEditing(true); setTimeout(() => editRef.current?.focus(), 30); }
  function saveEdit() { if (editText.trim() && editText.trim() !== memo.content) onEdit(editText.trim()); setEditing(false); }
  function cancelEdit() { setEditText(memo.content); setEditing(false); }

  if (memo.pending) return <PendingBubble />;

  if (editing) {
    return (
      <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ alignSelf: "flex-end", width: "85%", display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea ref={editRef} value={editText} onChange={e => setEditText(applyMarkdownShortcuts(e.target.value))}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) saveEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="y2k-input"
            style={{ width: "100%", padding: "9px 14px", border: "1px solid var(--accent)", borderRadius: "12px 12px 2px 12px", fontSize: 13, color: "var(--msg-text-color)", lineHeight: 1.4, background: "var(--msg-bubble-color)", fontFamily: "inherit", resize: "none", minHeight: 72, outline: "none" }} />
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
      style={{ padding: "2px 6px", display: "flex", flexDirection: "column", gap: 0, animation: "y2kFadeIn 0.3s ease", cursor: "default" }}>

      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", gap: 0 }}>

        {/* ROW: left buttons + bubble */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>

          {/* LEFT ACTIONS: horizontal */}
          <div style={{ display: "flex", flexDirection: "row", gap: 2, alignItems: "center" }}>
            <button onClick={onPin} title={memo.pinned ? "고정 해제" : "고정"}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1,
                color: memo.pinned ? "var(--accent)" : "#ccc",
                opacity: (hover || memo.pinned) ? 1 : 0,
                pointerEvents: (hover || memo.pinned) ? "auto" : "none",
                transition: "color 0.15s, opacity 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.color = memo.pinned ? "var(--accent)" : "#ccc")}
            ><PinIcon /></button>

            <button onClick={onImportant} title={memo.important ? "중요 해제" : "중요"}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1,
                color: memo.important ? "var(--accent)" : "#ccc",
                opacity: (hover || memo.important) ? 1 : 0,
                pointerEvents: (hover || memo.important) ? "auto" : "none",
                transition: "color 0.15s, opacity 0.15s", fontSize: 13 }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.color = memo.important ? "var(--accent)" : "#ccc")}
            >♥</button>

            <button onClick={copyText} title="복사"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1,
                color: "#ccc",
                opacity: hover ? 1 : 0,
                pointerEvents: hover ? "auto" : "none",
                transition: "color 0.15s, opacity 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.color = "#ccc")}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>

          {/* BUBBLE with floating reply button */}
          <div style={{ position: "relative" }}>
            <div style={{
              background: bubbleBg, border: "none",
              padding: "9px 14px", borderRadius: "12px 12px 2px 12px",
              fontSize: 13, color: textColor, lineHeight: 1.4,
              wordBreak: "break-word", whiteSpace: "pre-wrap",
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

            {/* Reply floating button on bottom-right of bubble */}
            <button onClick={onReply} title="답글"
              style={{ position: "absolute", bottom: -8, right: 2,
                background: "var(--bg-color)", border: "1px solid var(--border-color)",
                borderRadius: "50%", width: 20, height: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#bbb",
                opacity: hover ? 1 : 0, pointerEvents: hover ? "auto" : "none",
                transition: "opacity 0.15s, color 0.15s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#bbb"; }}
            ><ReplyIcon /></button>
          </div>
        </div>

        {/* BELOW ACTIONS: 수정, 삭제 */}
        <div style={{
          alignSelf: "flex-end", display: "flex", gap: 1,
          height: hover ? 20 : 0, overflow: "hidden",
          transition: "height 0.15s",
        }}>
          {[
            { label: "수정", onClick: startEdit,
              icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
            { label: "삭제", onClick: onDelete,
              icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> },
          ].map(a => (
            <button key={a.label} onClick={a.onClick} title={a.label}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", lineHeight: 1,
                color: "#bbb", fontSize: 10, fontFamily: "inherit",
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
        <div key={i} style={{ alignSelf: "flex-start", maxWidth: "80%", marginTop: i === 0 ? 6 : 2 }}>
          <div style={{
            background: "var(--reply-bubble-color)", padding: "8px 12px",
            borderRadius: "12px 12px 12px 2px", fontSize: 13,
            color: "var(--reply-text-color)", lineHeight: 1.4,
            wordBreak: "break-word", whiteSpace: "pre-wrap", fontFamily: "inherit",
          }}>
            {r}
          </div>
        </div>
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
  const [inputText, setInputText]   = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore]       = useState(false);
  const [sending, setSending]       = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<{ blob: Blob; preview: string }[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const cursorPosRef = useRef<number | null>(null);
  const loadMemosRef = useRef<(cursor?: string) => Promise<void>>(async () => {});

  useEffect(() => {
    const raw = localStorage.getItem("bubble-memo-config");
    if (raw) setCfg(JSON.parse(raw));
    setCfgLoaded(true);
  }, []);

  useEffect(() => {
    const isSpecialTab = activeFolder === "ALL" || activeFolder === "고정" || activeFolder === "중요";
    setShowSidebar(!isSpecialTab);
  }, [activeFolder]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (cfg?.folderOptions?.[0] && expandedFolders.size === 0) {
      setExpandedFolders(new Set([cfg.folderOptions[0]]));
    }
  }, [cfg?.folderOptions?.[0]]);

  const accent     = cfg?.accent ?? "#E8A8C0";
  const fontFamily = cfg?.fontFamily ?? "'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,system-ui,sans-serif";
  const cssVars    = cfg ? buildCssVars(cfg) : buildCssVars({ accent } as Config);

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
        setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 60);
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

  // Auto-load older pages without a button
  useEffect(() => {
    if (loading || !hasMore || !nextCursor) return;
    const timer = setTimeout(() => { loadMemosRef.current(nextCursor); }, 400);
    return () => clearTimeout(timer);
  }, [loading, hasMore, nextCursor]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "32px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [inputText]);

  // Restore cursor after Tab indentation
  useEffect(() => {
    if (cursorPosRef.current !== null && textareaRef.current) {
      textareaRef.current.selectionStart = cursorPosRef.current;
      textareaRef.current.selectionEnd   = cursorPosRef.current;
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
    setPendingImages(prev => { prev.forEach(i => URL.revokeObjectURL(i.preview)); return []; });

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
      activeFolder === "ALL" || activeFolder === "고정" || activeFolder === "중요"
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
          imageUploadIds,
        }),
      });
      const d = await r.json();
      if (d.id) {
        setMemos(prev => prev.map(m => m.id === tempId
          ? { ...tempMemo, id: d.id, pending: false } : m));
      } else {
        setMemos(prev => prev.filter(m => m.id !== tempId));
      }
    } catch {
      setMemos(prev => prev.filter(m => m.id !== tempId));
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
    setMemos(prev => prev.map(m => m.id === memoId
      ? { ...m, todos: m.todos.map(t => t.id === todoId ? { ...t, checked } : t) } : m));
    await fetch(`/api/notion/blocks/${todoId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, checked }),
    });
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && replyingTo) { setReplyingTo(null); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMemo(e as unknown as React.FormEvent); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart ?? 0;
      const val = ta.value;
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      if (e.shiftKey) {
        if (val.slice(lineStart, lineStart + 2) === "  ") {
          cursorPosRef.current = Math.max(start - 2, lineStart);
          setInputText(val.slice(0, lineStart) + val.slice(lineStart + 2));
        }
      } else {
        cursorPosRef.current = start + 2;
        setInputText(val.slice(0, lineStart) + "  " + val.slice(lineStart));
      }
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
  const defaultFolder = cfg?.folderOptions[0] ?? "";

  const effectiveFolder = (m: Memo) => m.folder || defaultFolder;

  const filteredMemos = activeFolder === "ALL"  ? memos
    : activeFolder === "고정" ? memos.filter(m => m.pinned)
    : activeFolder === "중요" ? memos.filter(m => m.important)
    : memos.filter(m => effectiveFolder(m) === activeFolder);

  const folderColor = (f: string): string | undefined => {
    if (!cfg) return undefined;
    const eff = f || defaultFolder;
    const i = cfg.folderOptions.indexOf(eff);
    return i >= 0 ? (cfg.folderColorPalette[i] ?? undefined) : undefined;
  };

  const sidebarItems: Array<{ type: "folder"|"pinned"|"important"|"empty"; label?: string; color?: string }> = [];
  folderList.forEach((f, i) => {
    sidebarItems.push({ type: "folder", label: f, color: cfg ? (cfg.folderColorPalette[i] ?? "var(--accent)") : "var(--accent)" });
    if (i === 0) sidebarItems.push({ type: "pinned" });
    else if (i === 1) sidebarItems.push({ type: "important" });
    else sidebarItems.push({ type: "empty" });
  });

  const replyingMemo = replyingTo ? memos.find(m => m.id === replyingTo) : null;

  // Group memos by folder for ALL tab
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const folderGroups = useMemo(() => {
    if (activeFolder !== "ALL" || folderList.length === 0) return null;
    const groups = new Map<string, Memo[]>();
    for (const f of folderList) groups.set(f, []);
    for (const m of memos) {
      const f = m.folder || defaultFolder;
      if (groups.has(f)) groups.get(f)!.push(m);
      else groups.set(f, [m]);
    }
    return groups;
  }, [activeFolder, memos, folderList, defaultFolder]);

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
        onPin={() => updateMemo(memo.id, { pinned: !memo.pinned })}
        onImportant={() => updateMemo(memo.id, { important: !memo.important })}
        onDelete={() => deleteMemo(memo.id)}
        onToggle={(tid, checked) => toggleTodo(tid, checked, memo.id)}
        onEdit={(content) => editMemo(memo.id, content)}
        onReply={() => { setReplyingTo(memo.id); setTimeout(() => textareaRef.current?.focus(), 50); }}
      />
    );
  }

  return (
    <div style={{
      width:"100%", height:"100dvh", boxSizing:"border-box", overflow:"hidden",
      padding:16, display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily: fontFamily, background:"#ffffff",
    }}>
      <style>{cssVars}</style>

      <div className="y2k-widget" style={{
        width:"100%", maxWidth:"100%", height:"100%",
        background:"var(--bg-color)", borderRadius:0, border:"none", outline:"none",
        display:"flex", flexDirection:"column", overflow:"hidden",
        boxSizing:"border-box", fontFamily:"var(--widget-font-family, inherit)",
      }}>

        {/* Header */}
        <div style={{
          height:35, background:"var(--accent-light)",
          borderBottom:"1px solid var(--accent)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 8px 0 10px", fontSize:13, color:"var(--accent)", flexShrink:0,
        }}>
          <div style={{ display:"flex", gap:4, alignItems:"center", flex:1, minWidth:0, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:0, fontSize:12, fontWeight:600, fontFamily:"inherit", minWidth:0, flex:1 }}>
              <button className="y2k-folder-btn" onClick={() => setShowSidebar(v => !v)} title="폴더 숨기기"
                style={{ background:"none", border:"none", cursor:"pointer", padding:"0 5px 0 2px", lineHeight:"35px", height:35, display:"flex", alignItems:"center", color:"var(--accent)", opacity:0.7, transition:"opacity 0.15s", flexShrink:0 }}>
                <FolderIcon size={14} fill="currentColor" stroke="currentColor" />
              </button>

              <div className="y2k-folder-tabs" style={{ display:"flex", alignItems:"center", flex:1, minWidth:0, overflowX:"auto" }}>
                <button className="y2k-folder-btn" onClick={() => setFolder("ALL")}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:"0 9px", fontSize:12, fontWeight: activeFolder==="ALL" ? 700 : 500, fontFamily:"inherit", color:"var(--text-color)", opacity: activeFolder==="ALL" ? 1 : 0.55, lineHeight:"35px", height:35, borderRadius:0, transition:"all 0.15s", flexShrink:0, whiteSpace:"nowrap" }}>
                  ALL
                </button>
                {folderList.map(f => (
                  <div key={f} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                    <span style={{ color:"var(--accent)", opacity:0.3, fontSize:9 }}>|</span>
                    <button className="y2k-folder-btn" onClick={() => setFolder(f)}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:"0 9px", fontSize:12, fontWeight: activeFolder===f ? 700 : 500, fontFamily:"inherit", color:"var(--text-color)", opacity: activeFolder===f ? 1 : 0.55, lineHeight:"35px", height:35, borderRadius:0, transition:"all 0.15s", whiteSpace:"nowrap" }}>
                      {f}
                    </button>
                  </div>
                ))}
                {["고정","중요"].map(label => (
                  <div key={label} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                    <span style={{ color:"var(--accent)", opacity:0.3, fontSize:9 }}>|</span>
                    <button className="y2k-folder-btn" onClick={() => setFolder(label)}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:"0 7px", lineHeight:"35px", height:35, display:"flex", alignItems:"center", gap:3, opacity: activeFolder===label ? 1 : 0.5, transition:"opacity 0.15s", color:"var(--text-color)" }}>
                      <FolderIcon size={13} fill="currentColor" stroke="currentColor" />
                      <span style={{ fontSize:10, fontFamily:"inherit", fontWeight:500 }}>{label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            <div className="y2k-win-btn" onClick={() => loadMemos()} title="새로고침"
              style={{ width:12, height:12, border:"1px solid var(--accent)", background:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, cursor:"pointer", lineHeight:1 }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
            </div>
            <div className="y2k-win-btn"
              style={{ width:12, height:12, border:"1px solid var(--accent)", background:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, cursor:"pointer", lineHeight:1 }}>_</div>
            <div className="y2k-win-btn" onClick={() => { localStorage.removeItem("bubble-memo-config"); router.push("/onboarding"); }}
              style={{ width:12, height:12, border:"1px solid var(--accent)", background:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, cursor:"pointer", lineHeight:1 }}>x</div>
          </div>
        </div>

        <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"row", overflow:"hidden" }}>

          {/* Sidebar */}
          <div style={{ flexShrink:0, display:"flex", flexDirection:"row", alignItems:"stretch", overflow:"hidden" }}>
            <div style={{
              width: showSidebar ? 110 : 0,
              opacity: showSidebar ? 1 : 0,
              transform: showSidebar ? "translateX(0)" : "translateX(-110px)",
              transition: "width 0.25s ease, opacity 0.2s ease, transform 0.25s ease",
              display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 2px",
              padding: showSidebar ? "18px 6px 8px 17px" : 0,
              overflow:"hidden", alignContent:"start",
            }}>
              {sidebarItems.map((item, i) => {
                if (item.type === "empty") return <div key={i} />;
                const isSpecial = item.type === "pinned" || item.type === "important";
                const label = item.type === "pinned" ? "고정" : item.type === "important" ? "중요" : item.label!;
                const color = isSpecial ? "var(--accent)" : item.color!;
                const isActive = activeFolder === label;
                return (
                  <div key={i} className="y2k-folder-btn"
                    onClick={() => setFolder(label)}
                    style={{
                      display:"flex", flexDirection:"column", alignItems:"center", gap:1,
                      padding:"3px 4px", borderRadius:0, cursor:"pointer",
                      pointerEvents:"auto", background:"transparent",
                      transition:"background 0.15s, transform 0.15s",
                      ...(isSpecial ? { justifySelf:"end" } : {}),
                    }}>
                    <div style={{ pointerEvents:"none", opacity: isActive ? 1 : 0.7 }}>
                      <FolderIcon size={25} fill={color} stroke={color} />
                    </div>
                    <span style={{
                      pointerEvents:"none", fontSize: isSpecial ? 9 : 10,
                      fontWeight:500, color:"var(--text-color)", opacity: isActive ? 1 : 0.55,
                      fontFamily:"inherit", textAlign:"center", lineHeight:1.1,
                      maxWidth:48, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
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
            style={{ flex:1, minHeight:0, overflowY:"auto", padding:"8px 14px 8px 8px" }}>

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

            {/* ALL tab: grouped by folder with collapsible sections */}
            {activeFolder === "ALL" && folderGroups
              ? Array.from(folderGroups.entries()).map(([folder, fMemos]) => {
                  const isExpanded = expandedFolders.has(folder);
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
          paddingBottom:8,
          borderTop:"1px dotted var(--border-dot)",
          display:"flex", flexDirection:"column", background:"var(--bg-color)", flexShrink:0,
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

          <div style={{ display:"flex", gap:6, padding:"8px 8px 0", alignItems:"flex-end" }}>
            <label title="이미지 첨부"
              style={{ width:32, height:32, border:"1px solid var(--accent-light)", borderRadius:4, background:"var(--bg-color)", color:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", padding:0, flexShrink:0, cursor:"pointer", opacity:0.75 }}>
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

            <textarea ref={textareaRef} value={inputText}
              onChange={e => setInputText(applyMarkdownShortcuts(e.target.value))}
              onKeyDown={handleTextareaKeyDown}
              onPaste={handlePaste}
              placeholder={replyingMemo ? "답글 입력..." : "memo"} autoComplete="off" rows={1}
              className="y2k-input"
              style={{
                flex:1, padding:"7px 10px", border:"1px solid var(--border-color, #e8e8e8)",
                borderRadius:4, fontSize:13, fontFamily:"inherit", color:"var(--text-color)",
                outline:"none", background:"var(--bg-color)", transition:"all 0.2s ease",
                resize:"none", overflow:"hidden", lineHeight:1.5, minHeight:32, maxHeight:120,
              }}
            />

            <button type="submit" disabled={(!inputText.trim() && pendingImages.length === 0) || sending}
              className="y2k-send"
              style={{
                background: (inputText.trim() || pendingImages.length > 0) ? "var(--accent)" : "var(--border-color, #e8e8e8)",
                color:"white", border:"none", borderRadius:12, padding:"0 14px",
                fontFamily:"inherit", fontSize:12, fontWeight:"bold", height:32,
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
