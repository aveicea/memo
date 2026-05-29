"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

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
  accentLight?: string; textColor?: string;
  msgBubbleBg?: string; msgTextColor?: string;
  replyBubbleBg?: string; replyTextColor?: string;
  alignLeft?: boolean;
  folderProp?: string; pinnedProp?: string;
  importantProp?: string; replyProp?: string;
}

/* ── color helpers ── */
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
  `;
}

/* ── folder SVG ── */
const FolderIcon = ({ size=25, fill, stroke }: { size?: number; fill: string; stroke: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>
  </svg>
);

/* ── pin SVG ── */
const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17v5"/>
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v3.76z"/>
  </svg>
);

/* ── content parser ── */
function parseLines(content: string) {
  return content.split("\n").map(line => {
    const m = line.match(/^- \[(x| )\] (.+)/);
    if (m) return { type: "todo" as const, checked: m[1]==="x", text: m[2] };
    return { type: "para" as const, text: line };
  });
}

/* ── memo content ── */
function MemoContent({ content, todos, onToggle }: {
  content: string; todos: Todo[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = parseLines(content);
  const MAX = 4;
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
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, cursor: "pointer" }}
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
        return <div key={i}>{line.text || <>&nbsp;</>}</div>;
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

/* ── memo bubble ── */
function MemoBubble({ memo, onPin, onImportant, onDelete, onToggle }: {
  memo: Memo;
  onPin: () => void; onImportant: () => void; onDelete: () => void;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const [hover, setHover] = useState(false);

  const isImportant = memo.important;
  const bubbleBg    = isImportant ? "var(--reply-bubble-color)" : "var(--msg-bubble-color)";
  const textColor   = isImportant ? "var(--reply-text-color)"  : "var(--msg-text-color)";

  function copyText() { navigator.clipboard.writeText(memo.content).catch(() => {}); }

  return (
    <div data-guestbook-entry-id={memo.id} draggable
      style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4, animation: "y2kFadeIn 0.3s ease", cursor: "default" }}>

      <div style={{ alignSelf: "flex-end", position: "relative", maxWidth: "85%" }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>

        {/* always-visible pin/important badges */}
        {(memo.pinned || memo.important) && (
          <div style={{ position: "absolute", right: "100%", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4, paddingRight: 4 }}>
            {memo.pinned && (
              <button onClick={onPin} title="고정 해제"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "var(--accent)", opacity: 1, transition: "color 0.15s, transform 0.15s, opacity 0.15s", transform: "scale(1.1)" }}>
                <PinIcon />
              </button>
            )}
            {memo.important && (
              <button onClick={onImportant} title="중요 해제"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 13, color: "var(--accent)", opacity: 1, transition: "color 0.15s, transform 0.15s, opacity 0.15s", transform: "scale(1.1)" }}>♥</button>
            )}
          </div>
        )}

        {/* bubble */}
        <div style={{
          background: bubbleBg, border: "none",
          padding: "9px 14px", borderRadius: "12px 12px 2px 12px",
          fontSize: 13, color: textColor, lineHeight: 1.4,
          wordBreak: "break-word", whiteSpace: "pre-wrap",
          boxShadow: "1px 1px 0 rgba(0,0,0,0.02)", fontFamily: "inherit",
          transition: "background 0.2s, color 0.2s",
        }}>
          <MemoContent content={memo.content} todos={memo.todos} onToggle={onToggle} />

          {/* hover actions */}
          {hover && (
            <div style={{
              position: "absolute", top: -30, right: 0,
              display: "flex", gap: 3,
              background: "var(--bg-color)", border: "1px solid var(--border-color)",
              borderRadius: 8, padding: "3px 6px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)", zIndex: 10,
            }}>
              {[
                { title: memo.pinned ? "고정 해제" : "고정", onClick: onPin,
                  icon: <PinIcon /> },
                { title: memo.important ? "중요 해제" : "중요", onClick: onImportant,
                  icon: <span style={{ fontSize: 12 }}>♥</span> },
                { title: "복사", onClick: copyText,
                  icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> },
                { title: "삭제", onClick: onDelete,
                  icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> },
              ].map(a => (
                <button key={a.title} onClick={a.onClick} title={a.title}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#aaa", lineHeight: 1, transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#aaa")}
                >{a.icon}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* reply bubble */}
      {memo.reply && (
        <div style={{ alignSelf: "flex-start", display: "flex", flexDirection: "column", alignItems: "flex-start", maxWidth: "85%", marginTop: 2 }}>
          <div className="y2k-reply" style={{
            background: "var(--reply-bubble-color)", padding: "9px 14px",
            borderRadius: "12px 12px 12px 2px", fontSize: 13,
            color: "var(--reply-text-color)", lineHeight: 1.4,
            wordBreak: "break-word", whiteSpace: "pre-wrap", fontFamily: "inherit",
          }}>
            {memo.reply}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── main ── */
export default function WidgetPage() {
  const router = useRouter();
  const [cfg, setCfg]           = useState<Config | null>(null);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [memos, setMemos]       = useState<Memo[]>([]);
  const [loading, setLoading]   = useState(false);
  const [activeFolder, setFolder] = useState("ALL");
  const [showSidebar, setShowSidebar] = useState(true);
  const [inputText, setInputText] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore]   = useState(false);
  const [sending, setSending]   = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem("bubble-memo-config");
    if (raw) setCfg(JSON.parse(raw));
    setCfgLoaded(true);
  }, []);

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
      if (cursor) {
        setMemos(prev => [...d.memos, ...prev]);
      } else {
        setMemos(d.memos ?? []);
        setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 60);
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
      const targetFolder =
        activeFolder === "ALL" || activeFolder === "고정" || activeFolder === "중요"
          ? (cfg.folderOptions[0] ?? "")
          : activeFolder;
      const r = await fetch("/api/notion/memos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cfg.token, databaseId: cfg.databaseId, content, folder: targetFolder, folderProp: cfg.folderProp, pinnedProp: cfg.pinnedProp, importantProp: cfg.importantProp }),
      });
      const d = await r.json();
      if (d.id) {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2,"0");
        const createdAt = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const newMemo: Memo = { id: d.id, content, todos: [], createdAt, pinned: false, important: false, folder: targetFolder };
        setMemos(prev => [...prev, newMemo]);
        setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 60);
      }
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

  async function toggleTodo(todoId: string, checked: boolean, memoId: string) {
    if (!cfg) return;
    setMemos(prev => prev.map(m => m.id === memoId
      ? { ...m, todos: m.todos.map(t => t.id === todoId ? { ...t, checked } : t) } : m));
    await fetch(`/api/notion/blocks/${todoId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, checked }),
    });
  }

  if (!cfgLoaded) return (
    <div style={{ width:"100%", height:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", background:"#fff" }}>
      <span style={{ fontSize:13, color:"#bbb" }}>로딩 중...</span>
    </div>
  );

  const folderList = cfg?.folderOptions ?? [];

  const filteredMemos = activeFolder === "ALL"   ? memos
    : activeFolder === "고정"  ? memos.filter(m => m.pinned)
    : activeFolder === "중요"  ? memos.filter(m => m.important)
    : memos.filter(m => m.folder === activeFolder);

  const folderColor = (f: string) => {
    if (!cfg) return "var(--accent)";
    const i = cfg.folderOptions.indexOf(f);
    return i >= 0 ? (cfg.folderColorPalette[i] ?? "var(--accent)") : "var(--accent)";
  };

  /* sidebar grid items: folders in left col, 고정 at right row1, 중요 at right row2 */
  const sidebarItems: Array<{ type: "folder"|"pinned"|"important"|"empty"; label?: string; color?: string }> = [];
  folderList.forEach((f, i) => {
    sidebarItems.push({ type: "folder", label: f, color: folderColor(f) });
    if (i === 0) sidebarItems.push({ type: "pinned" });
    else if (i === 1) sidebarItems.push({ type: "important" });
    else sidebarItems.push({ type: "empty" });
  });

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

        {/* ── titlebar ── */}
        <div style={{
          height:35, background:"var(--accent-light)",
          borderBottom:"1px solid var(--accent)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 8px 0 10px", fontSize:13, color:"var(--accent)", flexShrink:0,
        }}>
          <div style={{ display:"flex", gap:4, alignItems:"center", flex:1, minWidth:0, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:0, fontSize:12, fontWeight:600, fontFamily:"inherit", minWidth:0, flex:1 }}>
              {/* sidebar toggle */}
              <button className="y2k-folder-btn" onClick={() => setShowSidebar(v => !v)} title="폴더 숨기기"
                style={{ background:"none", border:"none", cursor:"pointer", padding:"0 5px 0 2px", lineHeight:"35px", height:35, display:"flex", alignItems:"center", color:"var(--accent)", opacity:0.7, transition:"opacity 0.15s", flexShrink:0 }}>
                <FolderIcon size={14} fill="currentColor" stroke="currentColor" />
              </button>

              {/* folder tabs */}
              <div className="y2k-folder-tabs" style={{ display:"flex", alignItems:"center", flex:1, minWidth:0, overflowX:"auto" }}>
                {/* ALL tab */}
                <button className="y2k-folder-btn" onClick={() => setFolder("ALL")}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:"0 9px", fontSize:12, fontWeight: activeFolder==="ALL" ? 700 : 500, fontFamily:"inherit", color:"var(--text-color)", opacity: activeFolder==="ALL" ? 1 : 0.55, lineHeight:"35px", height:35, borderRadius:0, transition:"all 0.15s", flexShrink:0, whiteSpace:"nowrap" }}>
                  ALL
                </button>
                {/* folder tabs */}
                {folderList.map(f => (
                  <div key={f} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                    <span style={{ color:"var(--accent)", opacity:0.3, fontSize:9 }}>|</span>
                    <button className="y2k-folder-btn" onClick={() => setFolder(f)}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:"0 9px", fontSize:12, fontWeight: activeFolder===f ? 700 : 500, fontFamily:"inherit", color:"var(--text-color)", opacity: activeFolder===f ? 1 : 0.55, lineHeight:"35px", height:35, borderRadius:0, transition:"all 0.15s", whiteSpace:"nowrap" }}>
                      {f}
                    </button>
                  </div>
                ))}
                {/* 고정 tab */}
                <div style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                  <span style={{ color:"var(--accent)", opacity:0.3, fontSize:9 }}>|</span>
                  <button className="y2k-folder-btn" onClick={() => setFolder("고정")}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:"0 7px", lineHeight:"35px", height:35, display:"flex", alignItems:"center", gap:3, opacity: activeFolder==="고정" ? 1 : 0.5, transition:"opacity 0.15s", color:"var(--text-color)" }}>
                    <FolderIcon size={13} fill="currentColor" stroke="currentColor" />
                    <span style={{ fontSize:10, fontFamily:"inherit", fontWeight:500 }}>고정</span>
                  </button>
                </div>
                {/* 중요 tab */}
                <div style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                  <span style={{ color:"var(--accent)", opacity:0.3, fontSize:9 }}>|</span>
                  <button className="y2k-folder-btn" onClick={() => setFolder("중요")}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:"0 7px", lineHeight:"35px", height:35, display:"flex", alignItems:"center", gap:3, opacity: activeFolder==="중요" ? 1 : 0.5, transition:"opacity 0.15s", color:"var(--text-color)" }}>
                    <FolderIcon size={13} fill="currentColor" stroke="currentColor" />
                    <span style={{ fontSize:10, fontFamily:"inherit", fontWeight:500 }}>중요</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* window buttons */}
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

        {/* ── body ── */}
        <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"row", overflow:"hidden" }}>

          {/* sidebar */}
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
                const color = isSpecial ? "var(--accent)" : (item.type === "important" ? "var(--accent-light)" : item.color!);
                const isRight = isSpecial;
                const isActive = activeFolder === label;
                const onClick = () => setFolder(label);
                return (
                  <div key={i} className="y2k-folder-btn"
                    onClick={onClick}
                    style={{
                      display:"flex", flexDirection:"column", alignItems:"center", gap:1,
                      padding:"3px 4px", borderRadius:0, cursor:"pointer",
                      pointerEvents:"auto", background:"transparent",
                      transition:"background 0.15s, transform 0.15s",
                      ...(isRight ? { justifySelf:"end" } : {}),
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

          {/* memo list */}
          <div ref={scrollRef} className="y2k-scroll"
            style={{ flex:1, minHeight:0, overflowY:"auto", padding:"10px 14px 10px 8px" }}>

            {hasMore && (
              <div style={{ textAlign:"center", padding:"4px 0 8px" }}>
                <button onClick={() => nextCursor && loadMemos(nextCursor)} disabled={loading}
                  style={{ background:"none", border:"1px dashed var(--accent)", borderRadius:8, padding:"4px 18px", fontSize:11, color:"var(--accent)", cursor:"pointer", fontFamily:"inherit", opacity:0.65 }}>
                  {loading ? "..." : "이전 메모 불러오기"}
                </button>
              </div>
            )}

            {loading && memos.length === 0 && (
              <div style={{ padding:40, textAlign:"center", color:"var(--accent)", fontSize:13 }}>
                <span style={{ display:"inline-block", width:16, height:16, border:"2px solid var(--accent-light)", borderTopColor:"var(--accent)", borderRadius:"50%", animation:"spin 0.7s linear infinite", marginBottom:8 }} />
                <br />불러오는 중...
              </div>
            )}

            {!loading && filteredMemos.length === 0 && (
              <div style={{ padding:40, textAlign:"center", color:"var(--border-color)", fontSize:13 }}>
                메모가 없습니다.
              </div>
            )}

            {filteredMemos.map(memo => (
              <MemoBubble key={memo.id} memo={memo}
                onPin={() => updateMemo(memo.id, { pinned: !memo.pinned })}
                onImportant={() => updateMemo(memo.id, { important: !memo.important })}
                onDelete={() => deleteMemo(memo.id)}
                onToggle={(tid, checked) => toggleTodo(tid, checked, memo.id)}
              />
            ))}
          </div>
        </div>

        {/* ── input form ── */}
        <form onSubmit={sendMemo} style={{
          padding:"8px", paddingBottom:8,
          borderTop:"1px dotted var(--border-dot)",
          display:"flex", gap:6, background:"var(--bg-color)", flexShrink:0, alignItems:"flex-end",
        }}>
          <button type="button" title="이미지 첨부"
            style={{ width:32, height:32, border:"1px solid var(--accent-light)", borderRadius:4, background:"var(--bg-color)", color:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", padding:0, flexShrink:0, cursor:"pointer", opacity:0.75, transition:"opacity 0.15s, border-color 0.15s" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <input type="file" accept="image/*" multiple style={{ display:"none" }} />

          <textarea ref={textareaRef} value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMemo(e as unknown as React.FormEvent); } }}
            placeholder="memo" autoComplete="off" rows={1}
            className="y2k-input"
            style={{
              flex:1, padding:"7px 10px", border:"1px solid var(--border-color, #e8e8e8)",
              borderRadius:4, fontSize:13, fontFamily:"inherit", color:"var(--text-color)",
              outline:"none", background:"var(--bg-color)", transition:"all 0.2s ease",
              resize:"none", overflow:"hidden", lineHeight:1.5, minHeight:32, maxHeight:120,
            }}
          />

          <button type="submit" disabled={!inputText.trim() || sending}
            className="y2k-send"
            style={{
              background: inputText.trim() ? "var(--accent)" : "var(--border-color, #e8e8e8)",
              color:"white", border:"none", borderRadius:12, padding:"0 14px",
              fontFamily:"inherit", fontSize:12, fontWeight:"bold", height:32,
              cursor: inputText.trim() ? "pointer" : "not-allowed", transition:"all 0.2s",
            }}>
            SEND
          </button>
        </form>
      </div>

      {/* fixed refresh */}
      <button onClick={() => loadMemos()} title="새로고침"
        style={{ position:"fixed", bottom:60, left:4, background:"none", border:"none", cursor:"pointer", fontSize:10, color:"#9ca3af", opacity:0.25, padding:2, lineHeight:1, zIndex:50 }}>
        ↻
      </button>
    </div>
  );
}
