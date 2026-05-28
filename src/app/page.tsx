"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Folder, RefreshCw } from "lucide-react";

interface Todo { id: string; checked: boolean; text: string }
interface Memo {
  id: string; content: string; todos: Todo[];
  createdAt: string; reply?: string;
  pinned: boolean; important: boolean; folder: string;
}
interface Config {
  token: string; databaseId: string; title: string;
  folderOptions: string[]; folderColorPalette: string[];
  fontFamily: string; accent: string;
  folderProp?: string; pinnedProp?: string;
  importantProp?: string; replyProp?: string;
}

function hex2hsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function deriveVars(accent: string) {
  const [h, s, l] = hex2hsl(accent);
  const accentLight = `hsl(${h},${Math.min(s + 10, 100)}%,${Math.min(l + 28, 97)}%)`;
  const msgBubble = `hsl(${h},${Math.max(s - 10, 0)}%,${Math.min(l + 32, 98)}%)`;
  const replyBubble = `hsl(${h},${Math.min(s + 5, 80)}%,${Math.max(l - 22, 20)}%)`;
  return { accentLight, msgBubble, replyBubble };
}

function parseLines(content: string) {
  return content.split("\n").filter(l => l.trim() !== "").map(line => {
    const m = line.match(/^- \[(x| )\] (.+)/);
    if (m) return { type: "todo" as const, checked: m[1] === "x", text: m[2] };
    return { type: "para" as const, text: line };
  });
}

function MemoContent({
  content, todos, onToggle,
}: {
  content: string;
  todos: Todo[];
  onToggle: (todoId: string, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = parseLines(content);
  const MAX = 4;
  const shown = expanded ? lines : lines.slice(0, MAX);
  const hidden = lines.length - shown.length;

  const getTodoId = (text: string, checked: boolean) =>
    todos.find(t => t.text === text && t.checked === checked)?.id ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {shown.map((line, i) => {
        if (line.type === "todo") {
          const todoId = getTodoId(line.text, line.checked);
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, cursor: "pointer", wordBreak: "break-word" }}
              onClick={() => todoId && onToggle(todoId, !line.checked)}>
              <span style={{ flexShrink: 0, marginTop: 2, opacity: line.checked ? 0.35 : 0.65 }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
                  {line.checked && <polyline points="4.5 8.5 7 11 11.5 5.5" strokeWidth="2" />}
                </svg>
              </span>
              <span style={{ textDecoration: line.checked ? "line-through" : "none", opacity: line.checked ? 0.4 : 1 }}>{line.text}</span>
            </div>
          );
        }
        return <div key={i} style={{ wordBreak: "break-word" }}>{line.text}</div>;
      })}
      {!expanded && hidden > 0 && (
        <button onClick={() => setExpanded(true)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 0 0", fontSize: 11, color: "inherit", opacity: 0.45, fontFamily: "inherit", textAlign: "left" }}>
          ...더보기 (+{hidden})
        </button>
      )}
    </div>
  );
}

function MemoBubble({
  memo, accent, replyBubble, msgBubble,
  onPin, onImportant, onDelete, onToggle,
}: {
  memo: Memo; accent: string; replyBubble: string; msgBubble: string;
  onPin: () => void; onImportant: () => void; onDelete: () => void;
  onToggle: (todoId: string, checked: boolean) => void;
}) {
  const [hover, setHover] = useState(false);

  const bubbleBg = memo.important ? replyBubble : msgBubble;
  const textColor = memo.important ? "#fff" : "var(--text-color, #555)";
  const replyBg = replyBubble;

  function copyText() {
    navigator.clipboard.writeText(memo.content).catch(() => {});
  }

  return (
    <div draggable style={{ padding: "4px 0", display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ alignSelf: "flex-end", position: "relative", maxWidth: "88%", display: "flex", alignItems: "center", gap: 5 }}>
        {/* always-visible pin / important badges */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
          {memo.pinned && (
            <button onClick={onPin} title="고정 해제"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: accent, lineHeight: 1, opacity: 0.85 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v3.76z"/>
              </svg>
            </button>
          )}
          {memo.important && (
            <button onClick={onImportant} title="중요 해제"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 14, color: accent, lineHeight: 1, opacity: 0.85 }}>♥</button>
          )}
        </div>

        {/* bubble */}
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            background: bubbleBg,
            padding: "9px 13px", borderRadius: "14px 14px 2px 14px",
            fontSize: 13, color: textColor, lineHeight: 1.5,
            wordBreak: "break-word", whiteSpace: "pre-wrap",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)", fontFamily: "inherit",
            position: "relative", flex: 1,
          }}
        >
          <MemoContent content={memo.content} todos={memo.todos} onToggle={onToggle} />

          {hover && (
            <div style={{
              position: "absolute", top: -30, right: 0,
              display: "flex", gap: 3, background: "#fff",
              border: "1px solid #e8e8e8", borderRadius: 8,
              padding: "3px 7px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              zIndex: 10,
            }}>
              {[
                { title: memo.pinned ? "고정 해제" : "고정", onClick: onPin, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v3.76z"/></svg> },
                { title: memo.important ? "중요 해제" : "중요", onClick: onImportant, icon: <span style={{ fontSize: 12 }}>♥</span> },
                { title: "복사", onClick: copyText, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> },
                { title: "삭제", onClick: onDelete, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> },
              ].map(a => (
                <button key={a.title} onClick={a.onClick} title={a.title}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#999", lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = accent)}
                  onMouseLeave={e => (e.currentTarget.style.color = "#999")}
                >{a.icon}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {memo.reply && (
        <div style={{ alignSelf: "flex-start", maxWidth: "85%", marginTop: 1 }}>
          <div style={{
            background: replyBg, padding: "8px 13px",
            borderRadius: "14px 14px 14px 2px",
            fontSize: 13, color: "#fff", lineHeight: 1.5,
            wordBreak: "break-word", whiteSpace: "pre-wrap", fontFamily: "inherit",
          }}>
            {memo.reply}
          </div>
        </div>
      )}

      <div style={{ alignSelf: "flex-end", fontSize: 10, color: "#aaa", paddingRight: 4, marginTop: -1 }}>
        {memo.createdAt}
      </div>
    </div>
  );
}

export default function WidgetPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFolder, setFolder] = useState("ALL");
  const [showSidebar, setShowSidebar] = useState(true);
  const [inputText, setInputText] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem("bubble-memo-config");
    if (raw) setCfg(JSON.parse(raw));
    setCfgLoaded(true);
  }, []);

  const accent = cfg?.accent ?? "#E8A8C0";
  const { accentLight, msgBubble, replyBubble } = deriveVars(accent);
  const font = cfg?.fontFamily ?? "'Pretendard Variable','Pretendard',sans-serif";

  const folderColor = useCallback((f: string) => {
    if (!cfg) return accentLight;
    const i = cfg.folderOptions.indexOf(f);
    return i >= 0 ? (cfg.folderColorPalette[i] ?? accentLight) : accentLight;
  }, [cfg, accentLight]);

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
      if (cursor) setMemos(prev => [...d.memos, ...prev]);
      else {
        setMemos(d.memos ?? []);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 50);
      }
      setNextCursor(d.nextCursor);
      setHasMore(d.hasMore);
    } finally { setLoading(false); }
  }, [cfg]);

  useEffect(() => {
    if (!cfgLoaded) return;
    if (!cfg?.token) { router.replace("/onboarding"); return; }
    loadMemos();
  }, [cfgLoaded, cfg, loadMemos, router]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "32px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [inputText]);

  async function sendMemo(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || !cfg || sending) return;
    setSending(true);
    const content = inputText.trim();
    setInputText("");
    try {
      const r = await fetch("/api/notion/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cfg.token, databaseId: cfg.databaseId, content,
          folder: activeFolder === "ALL" || activeFolder === "고정" || activeFolder === "중요"
            ? (cfg.folderOptions[0] ?? "") : activeFolder,
          folderProp: cfg.folderProp, pinnedProp: cfg.pinnedProp, importantProp: cfg.importantProp,
        }),
      });
      const d = await r.json();
      if (d.id) {
        const newMemo: Memo = {
          id: d.id, content, todos: [], createdAt: new Date().toLocaleString("ko"),
          pinned: false, important: false,
          folder: activeFolder === "ALL" || activeFolder === "고정" || activeFolder === "중요"
            ? (cfg.folderOptions[0] ?? "") : activeFolder,
        };
        setMemos(prev => [...prev, newMemo]);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 50);
      }
    } finally { setSending(false); }
  }

  async function updateMemo(id: string, patch: Record<string, unknown>) {
    if (!cfg) return;
    setMemos(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
    await fetch(`/api/notion/memos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, pinnedProp: cfg.pinnedProp, importantProp: cfg.importantProp, folderProp: cfg.folderProp, replyProp: cfg.replyProp, ...patch }),
    });
  }

  async function deleteMemo(id: string) {
    if (!cfg) return;
    setMemos(prev => prev.filter(m => m.id !== id));
    await fetch(`/api/notion/memos/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token }),
    });
  }

  async function toggleTodo(todoId: string, checked: boolean, memoId: string) {
    if (!cfg) return;
    setMemos(prev => prev.map(m => m.id === memoId
      ? { ...m, todos: m.todos.map(t => t.id === todoId ? { ...t, checked } : t) }
      : m
    ));
    await fetch(`/api/notion/blocks/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, checked }),
    });
  }

  if (!cfgLoaded) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
      <span style={{ fontSize: 13, color: "#bbb" }}>로딩 중...</span>
    </div>
  );

  const filteredMemos = activeFolder === "ALL" ? memos
    : activeFolder === "고정" ? memos.filter(m => m.pinned)
    : activeFolder === "중요" ? memos.filter(m => m.important)
    : memos.filter(m => m.folder === activeFolder);

  const folderList = cfg?.folderOptions ?? [];

  return (
    <div style={{
      width: "100%", height: "100dvh", padding: 16,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "#ffffff", fontFamily: font,
    }}>
      {/* main window */}
      <div style={{
        width: "100%", maxWidth: 860, height: "calc(100dvh - 32px)",
        display: "flex", flexDirection: "column",
        background: "#fff", border: `1.5px solid ${accent}`,
        borderRadius: 12,
        boxShadow: `0 0 0 3px ${accentLight}, 0 4px 24px rgba(0,0,0,0.07)`,
        overflow: "hidden",
      }}>

        {/* titlebar */}
        <div style={{
          height: 36, background: accentLight, flexShrink: 0,
          borderBottom: `1px solid ${accent}40`,
          display: "flex", alignItems: "center", padding: "0 8px 0 6px",
          gap: 4,
        }}>
          <button onClick={() => setShowSidebar(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: accent, opacity: 0.75, display: "flex", alignItems: "center" }}>
            <Folder size={14} />
          </button>

          {/* folder tabs */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", overflowX: "auto", gap: 0, fontFamily: "'Galmuri11',monospace", fontSize: 11 }}
            className="y2k-scroll">
            {["ALL", ...folderList, "고정", "중요"].map((f, i, arr) => (
              <div key={f} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {i > 0 && <span style={{ color: accent, opacity: 0.25, fontSize: 9 }}>|</span>}
                <button onClick={() => setFolder(f)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "0 8px", fontSize: 11, fontFamily: "inherit",
                    fontWeight: activeFolder === f ? 700 : 500,
                    color: activeFolder === f ? accent : "#888",
                    height: 36, whiteSpace: "nowrap",
                  }}>{f}</button>
              </div>
            ))}
          </div>

          {/* window controls */}
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
            <button onClick={() => loadMemos()} title="새로고침"
              style={{ width: 13, height: 13, border: `1.5px solid ${accent}`, background: "#fff", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <RefreshCw size={8} color={accent} />
            </button>
            <button onClick={() => { localStorage.removeItem("bubble-memo-config"); router.push("/onboarding"); }}
              style={{ width: 13, height: 13, border: `1.5px solid ${accent}`, background: "#fff", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 9, color: accent, fontWeight: 700 }}>
              ×
            </button>
          </div>
        </div>

        {/* body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* sidebar */}
          {showSidebar && (
            <div style={{
              width: 112, flexShrink: 0, borderRight: `1px solid ${accent}20`,
              overflowY: "auto", padding: "14px 6px 8px 10px",
            }} className="y2k-scroll">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 4px", alignContent: "start" }}>
                {(() => {
                  const items = [...folderList];
                  const rows: string[][] = [];
                  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
                  const pinRow = Math.max(0, rows.length - 1);
                  // just render all as 2-col grid; 고정 and 중요 go at end
                  const all = [...folderList, "고정", "중요"];
                  return all.map((f, i) => {
                    const isSpecial = f === "고정" || f === "중요";
                    const color = isSpecial
                      ? accent
                      : (cfg?.folderColorPalette[cfg.folderOptions.indexOf(f)] ?? accentLight);
                    return (
                      <div key={f} onClick={() => setFolder(f)}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", padding: "3px 0" }}>
                        <Folder size={26} fill={color} color={color} style={{ opacity: activeFolder === f ? 1 : 0.65 }} />
                        <span style={{ fontSize: 10, color: "#666", opacity: activeFolder === f ? 1 : 0.55, fontFamily: "inherit", textAlign: "center", maxWidth: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* memo list */}
          <div ref={scrollRef} className="y2k-scroll"
            style={{ flex: 1, overflowY: "auto", padding: "8px 14px 8px 10px", display: "flex", flexDirection: "column", gap: 0 }}>

            {hasMore && (
              <div style={{ textAlign: "center", padding: "6px 0 10px" }}>
                <button onClick={() => nextCursor && loadMemos(nextCursor)} disabled={loading}
                  style={{ background: "none", border: `1px dashed ${accent}`, borderRadius: 8, padding: "4px 18px", fontSize: 11, color: accent, cursor: "pointer", fontFamily: "inherit", opacity: 0.7 }}>
                  {loading ? "..." : "이전 메모 불러오기"}
                </button>
              </div>
            )}

            {loading && memos.length === 0 && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "#bbb", fontSize: 13 }}>
                <span style={{ display: "inline-block", width: 18, height: 18, border: `2px solid ${accentLight}`, borderTopColor: accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                불러오는 중...
              </div>
            )}

            {!loading && filteredMemos.length === 0 && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 13 }}>
                메모가 없습니다.
              </div>
            )}

            {filteredMemos.map(memo => (
              <MemoBubble
                key={memo.id}
                memo={memo}
                accent={accent}
                replyBubble={replyBubble}
                msgBubble={msgBubble}
                onPin={() => updateMemo(memo.id, { pinned: !memo.pinned })}
                onImportant={() => updateMemo(memo.id, { important: !memo.important })}
                onDelete={() => deleteMemo(memo.id)}
                onToggle={(tid, checked) => toggleTodo(tid, checked, memo.id)}
              />
            ))}
          </div>
        </div>

        {/* input */}
        <form onSubmit={sendMemo}
          style={{ flexShrink: 0, borderTop: `1px solid ${accent}30`, padding: "7px 8px", display: "flex", gap: 6, background: "#fff", alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMemo(e as unknown as React.FormEvent); } }}
            placeholder="memo"
            rows={1}
            className="y2k-input"
            style={{
              flex: 1, padding: "7px 10px", border: "1px solid #e8e8e8",
              borderRadius: 8, fontSize: 13, fontFamily: "inherit",
              color: "#555", outline: "none", background: "#fafafa",
              resize: "none", overflow: "hidden",
              lineHeight: 1.5, minHeight: 34, maxHeight: 120,
            }}
          />
          <button type="submit" disabled={!inputText.trim() || sending}
            style={{
              background: inputText.trim() ? accent : "#e8e8e8",
              color: "#fff", border: "none", borderRadius: 8,
              padding: "0 16px", fontSize: 12, fontFamily: "inherit",
              fontWeight: 700, height: 34,
              cursor: inputText.trim() ? "pointer" : "not-allowed",
              transition: "background 0.15s", flexShrink: 0,
            }}>
            SEND
          </button>
        </form>
      </div>
    </div>
  );
}
