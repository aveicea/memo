"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Folder, Pin, ChevronLeft, Image as ImageIcon } from "lucide-react";

const ACCENT = "#E8A8C0";
const ACCENT_LIGHT = "#FFF0F5";
const FOLDER_COLORS = ["#FFB3BA","#E2D1F0","#C6EBC5","#FFDFBA","#BAE1FF","#FFD1DC","#B5EAD7","#FFDAC1"];

interface Block { id: string; type: "paragraph" | "to_do"; text: string; checked?: boolean }
interface Memo {
  id: string; blocks: Block[]; createdAt: string;
  reply?: string; pinned: boolean; important: boolean;
  folder: string; imageUrls: string[];
}
interface Config {
  token: string; databaseId: string; title: string;
  folderOptions: string[]; folderColorPalette: string[];
  fontFamily: string; accent: string;
  folderProp?: string; pinnedProp?: string;
  importantProp?: string; replyProp?: string;
}

function useSavedConfig(): Config | null {
  const [cfg, setCfg] = useState<Config | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem("bubble-memo-config");
    if (raw) setCfg(JSON.parse(raw));
  }, []);
  return cfg;
}

/* ───── Todo block parser ───── */
function renderBlocks(
  blocks: Block[],
  onToggle: (blockId: string, checked: boolean) => void,
  maxLines?: number
) {
  const shown = maxLines ? blocks.slice(0, maxLines) : blocks;
  const hidden = maxLines ? blocks.slice(maxLines) : [];
  return (
    <>
      {shown.map(b => (
        <div key={b.id} style={{ display: "flex", alignItems: "flex-start", gap: 5, cursor: b.type === "to_do" ? "pointer" : "default", wordBreak: "break-word" }}
          onClick={() => b.type === "to_do" && onToggle(b.id, !b.checked)}
        >
          {b.type === "to_do" && (
            <span style={{ flexShrink: 0, marginTop: 1, opacity: b.checked ? 0.35 : 0.6 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
                {b.checked && <polyline points="4.5 8.5 7 11 11.5 5.5" strokeWidth="1.8" />}
              </svg>
            </span>
          )}
          <span style={{ textDecoration: b.checked ? "line-through" : "none", opacity: b.checked ? 0.4 : 1 }}>
            {b.text || " "}
          </span>
        </div>
      ))}
      {hidden.length > 0 && (
        <button style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 0 0", fontSize: 10, color: "inherit", opacity: 0.4, fontFamily: "inherit" }}>
          ...더보기 (+{hidden.length})
        </button>
      )}
    </>
  );
}

/* ───── Memo bubble ───── */
function MemoBubble({
  memo, cfg, folderColor, onPin, onImportant, onDelete, onToggle,
}: {
  memo: Memo; cfg: Config; folderColor: string;
  onPin: () => void; onImportant: () => void; onDelete: () => void;
  onToggle: (blockId: string, checked: boolean) => void;
}) {
  const [hover, setHover] = useState(false);
  const isHighlighted = memo.pinned || memo.important;
  const bubbleBg = isHighlighted ? ACCENT_LIGHT : "#ffffff";
  const textColor = isHighlighted ? "#D4849E" : "#666666";

  return (
    <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4, animation: "y2kFadeIn 0.3s ease" }}>
      <div style={{ alignSelf: "flex-end", position: "relative", maxWidth: "85%" }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {/* pin / important indicators */}
        {(memo.pinned || memo.important) && (
          <div style={{ position: "absolute", right: "100%", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4, paddingRight: 4 }}>
            {memo.pinned && (
              <button onClick={onPin} title="고정 해제" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: ACCENT, lineHeight: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v3.76z"/>
                </svg>
              </button>
            )}
            {memo.important && (
              <button onClick={onImportant} title="중요 해제" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, color: ACCENT, lineHeight: 1 }}>♥</button>
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
          position: "relative",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {renderBlocks(memo.blocks, onToggle, 4)}
          </div>

          {/* hover actions */}
          {hover && (
            <div style={{ position: "absolute", top: -28, right: 0, display: "flex", gap: 4, background: "#fff", border: "1px solid #F5C6D0", borderRadius: 8, padding: "3px 6px", boxShadow: "0 2px 8px rgba(232,168,192,0.15)" }}>
              {[
                { title: memo.pinned ? "고정 해제" : "고정", onClick: onPin, icon: <Pin size={11} /> },
                { title: memo.important ? "중요 해제" : "중요", onClick: onImportant, icon: <span style={{ fontSize: 11 }}>♥</span> },
                { title: "삭제", onClick: onDelete, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> },
              ].map(a => (
                <button key={a.title} onClick={a.onClick} title={a.title}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#999", lineHeight: 1, transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = ACCENT)}
                  onMouseLeave={e => (e.currentTarget.style.color = "#999")}
                >{a.icon}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* reply */}
      {memo.reply && (
        <div style={{ alignSelf: "flex-start", maxWidth: "85%", marginTop: 2 }}>
          <div style={{ background: ACCENT_LIGHT, padding: "9px 14px", borderRadius: "12px 12px 12px 2px", fontSize: 13, color: "#D4849E", lineHeight: 1.4, wordBreak: "break-word", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
            {memo.reply}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Main widget ───── */
export default function WidgetPage() {
  const router = useRouter();
  const cfg = useSavedConfig();

  const [memos, setMemos]         = useState<Memo[]>([]);
  const [loading, setLoading]     = useState(false);
  const [activeFolder, setFolder] = useState("ALL");
  const [showSidebar, setShowSidebar] = useState(true);
  const [inputText, setInputText] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore]     = useState(false);
  const [sending, setSending]     = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cfg) return;
    // if schema props not stored, fetch them
    if (!cfg.folderProp && cfg.folderOptions.length > 0) {
      fetch("/api/notion/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cfg.token, databaseId: cfg.databaseId }),
      }).then(r => r.json()).then(d => {
        const updated = { ...cfg, folderProp: d.folderPropName, pinnedProp: d.pinnedPropName, importantProp: d.importantPropName, replyProp: d.replyPropName };
        localStorage.setItem("bubble-memo-config", JSON.stringify(updated));
      });
    }
  }, [cfg]);

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
      if (cursor) setMemos(prev => [...prev, ...d.memos]);
      else        setMemos(d.memos ?? []);
      setNextCursor(d.nextCursor);
      setHasMore(d.hasMore);
    } finally { setLoading(false); }
  }, [cfg]);

  useEffect(() => {
    if (cfg === null) {
      // still loading from localStorage
      return;
    }
    if (!cfg.token) {
      router.replace("/onboarding");
      return;
    }
    loadMemos();
  }, [cfg, loadMemos, router]);

  // auto-resize textarea
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
      await fetch("/api/notion/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cfg.token, databaseId: cfg.databaseId, content,
          folder: activeFolder === "ALL" ? (cfg.folderOptions[0] ?? "") : activeFolder,
          folderProp: cfg.folderProp, pinnedProp: cfg.pinnedProp,
          importantProp: cfg.importantProp,
        }),
      });
      await loadMemos();
      setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
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

  async function toggleBlock(blockId: string, checked: boolean, memoId: string) {
    if (!cfg) return;
    setMemos(prev => prev.map(m => m.id === memoId
      ? { ...m, blocks: m.blocks.map(b => b.id === blockId ? { ...b, checked } : b) }
      : m
    ));
    await fetch(`/api/notion/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cfg.token, checked }),
    });
  }

  if (!cfg) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFF5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 13, color: "#D4A5C9" }}>로딩 중...</p>
      </div>
    );
  }

  const folderColor = (f: string) => {
    const i = cfg.folderOptions.indexOf(f);
    return i >= 0 ? (cfg.folderColorPalette[i] ?? FOLDER_COLORS[i % FOLDER_COLORS.length]) : ACCENT_LIGHT;
  };

  const filteredMemos = activeFolder === "ALL" ? memos
    : activeFolder === "고정"  ? memos.filter(m => m.pinned)
    : activeFolder === "중요"  ? memos.filter(m => m.important)
    : memos.filter(m => m.folder === activeFolder);

  const allFolderTabs = ["ALL", ...cfg.folderOptions, "고정", "중요"];

  const font = cfg.fontFamily || "'Pretendard Variable','Pretendard',sans-serif";

  return (
    <div style={{
      margin: 0, padding: 0, minHeight: "100vh",
      backgroundColor: "#FFF5F9",
      backgroundImage: "linear-gradient(rgba(232,168,192,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(232,168,192,0.06) 1px,transparent 1px)",
      backgroundSize: "40px 40px",
      color: "#333", fontFamily: font,
    }}>
      <div style={{
        background: "rgba(255,255,255,0.95)", border: "2px solid #E8A8C0",
        boxShadow: "0 0 0 3px #FFF0F5,2px 2px 0px rgba(232,168,192,0.3),4px 4px 12px rgba(232,168,192,0.15)",
        borderRadius: 10, maxWidth: 1180, margin: "4rem auto",
        overflow: "hidden", backdropFilter: "blur(10px)", position: "relative",
      }}>
        {/* ── Title bar ── */}
        <div style={{
          background: ACCENT_LIGHT, padding: "0 8px 0 10px", height: 35,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: "1px solid #F5C6D0", fontFamily: "'Galmuri11',monospace", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0, fontSize: 12, fontWeight: 600, minWidth: 0, flex: 1 }}>
              {/* sidebar toggle */}
              <button onClick={() => setShowSidebar(v => !v)} title="폴더 숨기기"
                className="folder-btn"
                style={{ background: "none", border: "none", cursor: "pointer", padding: "0 5px 0 2px", height: 35, display: "flex", alignItems: "center", color: ACCENT, opacity: 0.7, flexShrink: 0 }}>
                <Folder size={14} />
              </button>

              {/* folder tabs */}
              <div className="folder-tabs" style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, overflowX: "auto" }}>
                {allFolderTabs.map((f, i) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    {i > 0 && <span style={{ color: ACCENT, opacity: 0.3, fontSize: 9 }}>|</span>}
                    <button onClick={() => setFolder(f)}
                      className="folder-btn"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: "0 9px", fontSize: 12, fontFamily: "inherit",
                        fontWeight: activeFolder === f ? 700 : 500,
                        color: "#666", opacity: activeFolder === f ? 1 : 0.55,
                        height: 35, whiteSpace: "nowrap",
                      }}
                    >{f}</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* window buttons */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button onClick={() => loadMemos()} title="새로고침"
              className="y2k-win-btn"
              style={{ width: 12, height: 12, border: `1px solid ${ACCENT}`, background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 8, borderRadius: 0 }}>
              <RefreshCw size={8} />
            </button>
            <button className="y2k-win-btn"
              style={{ width: 12, height: 12, border: `1px solid ${ACCENT}`, background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 9 }}>_</button>
            <button onClick={() => { localStorage.removeItem("bubble-memo-config"); router.push("/onboarding"); }}
              className="y2k-win-btn"
              style={{ width: 12, height: 12, border: `1px solid ${ACCENT}`, background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 9 }}>x</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", flexDirection: "row", minHeight: 560, overflow: "hidden" }}>
          {/* sidebar */}
          {showSidebar && (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", overflow: "hidden", flexShrink: 0 }}>
              <div style={{ width: 110, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 2px", padding: "18px 6px 8px 17px", overflowY: "auto", alignContent: "start" }}>
                {[...cfg.folderOptions, "고정", "중요"].map((f, i) => {
                  const isSpecial = f === "고정" || f === "중요";
                  const color = isSpecial ? (f === "고정" ? ACCENT : ACCENT_LIGHT) : (cfg.folderColorPalette[i] ?? FOLDER_COLORS[i % FOLDER_COLORS.length]);
                  return (
                    <div key={f}
                      className="folder-btn"
                      onClick={() => setFolder(f)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "3px 4px", cursor: "pointer", background: "transparent", transition: "background 0.15s", justifySelf: i % 2 === 1 ? "end" : "start" }}
                    >
                      <div style={{ opacity: 0.7 }}>
                        <Folder size={25} fill={color} color={color} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 500, color: "#666", opacity: 0.55, fontFamily: "inherit", textAlign: "center", maxWidth: 48, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f}</span>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setShowSidebar(false)} title="폴더 숨기기"
                style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: ACCENT, opacity: 0.6, display: "flex", alignItems: "flex-end", paddingBottom: 12 }}>
                <ChevronLeft size={13} />
              </button>
            </div>
          )}

          {/* memo list */}
          <div ref={scrollRef} className="y2k-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 14px 10px 8px" }}>
            {loading && memos.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "#D4A5C9", fontSize: 13 }}>
                <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #F5C6D0", borderTopColor: ACCENT, borderRadius: "50%", animation: "spin 0.7s linear infinite", marginBottom: 8 }} />
                <br />불러오는 중...
              </div>
            )}

            {!loading && filteredMemos.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "#D4A5C9", fontSize: 13 }}>
                메모가 없습니다.<br />
                <span style={{ fontSize: 11, opacity: 0.6 }}>아래에서 첫 메모를 작성해보세요!</span>
              </div>
            )}

            {filteredMemos.map(memo => (
              <MemoBubble
                key={memo.id}
                memo={memo}
                cfg={cfg}
                folderColor={folderColor(memo.folder)}
                onPin={() => updateMemo(memo.id, { pinned: !memo.pinned })}
                onImportant={() => updateMemo(memo.id, { important: !memo.important })}
                onDelete={() => deleteMemo(memo.id)}
                onToggle={(bId, checked) => toggleBlock(bId, checked, memo.id)}
              />
            ))}

            {hasMore && (
              <div style={{ padding: "12px 6px", textAlign: "center" }}>
                <button
                  onClick={() => nextCursor && loadMemos(nextCursor)}
                  disabled={loading}
                  style={{ background: "none", border: `1px dashed ${ACCENT}`, borderRadius: 8, padding: "6px 20px", fontSize: 12, color: ACCENT, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {loading ? "..." : "더 불러오기"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Input form ── */}
        <form onSubmit={sendMemo} style={{
          padding: "8px", paddingBottom: 8, borderTop: "1px dotted #F5C6D0",
          display: "flex", gap: 6, background: "#fff", alignItems: "flex-end", flexShrink: 0,
        }}>
          <button type="button" title="이미지 첨부"
            style={{ width: 32, height: 32, border: "1px solid #FFF0F5", borderRadius: 4, background: "#fff", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0, cursor: "pointer", opacity: 0.75 }}>
            <ImageIcon size={15} />
          </button>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMemo(e); }
            }}
            placeholder="memo"
            rows={1}
            className="y2k-input"
            style={{
              flex: 1, padding: "7px 10px", border: "1px solid #e8e8e8", borderRadius: 4,
              fontSize: 13, fontFamily: "inherit", color: "#666", outline: "none",
              background: "#fff", resize: "none", overflow: "hidden",
              lineHeight: 1.5, minHeight: 32, maxHeight: 120, transition: "all 0.2s",
            }}
          />

          <button type="submit" disabled={!inputText.trim() || sending}
            className="send-btn"
            style={{
              background: inputText.trim() ? ACCENT : "#e8e8e8",
              color: "white", border: "none", borderRadius: 12,
              padding: "0 14px", fontFamily: "'Galmuri11',monospace",
              fontSize: 12, fontWeight: "bold", height: 32,
              cursor: inputText.trim() ? "pointer" : "not-allowed",
              transition: "all 0.2s",
            }}>
            SEND
          </button>
        </form>
      </div>

      {/* refresh button */}
      <button onClick={() => loadMemos()} title="새로고침"
        style={{ position: "fixed", bottom: 60, left: 4, background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#9ca3af", opacity: 0.25, padding: 2, lineHeight: 1, zIndex: 50 }}>
        <RefreshCw size={10} />
      </button>

      <footer style={{ textAlign: "center", padding: "0 20px 40px", color: "#D4A5C9", fontSize: 12, lineHeight: 1.8 }}>
        <div style={{ marginBottom: 4, fontWeight: 600, color: "#999" }}>bubble memo</div>
        <div>made with <span style={{ color: ACCENT }}>♥</span></div>
      </footer>
    </div>
  );
}
