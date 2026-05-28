"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Database, Palette, CheckCircle2 } from "lucide-react";

const ACCENT = "#E8A8C0";
const COLOR_PALETTE = ["#FFB3BA","#E2D1F0","#C6EBC5","#FFDFBA","#BAE1FF","#FFD1DC","#B5EAD7","#FFDAC1"];

type FontKey = "pretendard" | "inter" | "caveat" | "italiana";
const FONTS: { id: FontKey; label: string; sample: string; css: string }[] = [
  { id: "pretendard", label: "Pretendard", sample: "안녕하세요 Hello", css: "'Pretendard Variable','Pretendard',sans-serif" },
  { id: "inter",      label: "Inter",      sample: "안녕하세요 Hello", css: "'Inter',sans-serif" },
  { id: "caveat",     label: "Caveat",     sample: "안녕하세요 Hello", css: "'Caveat',cursive" },
  { id: "italiana",   label: "Italiana",   sample: "안녕하세요 Hello", css: "'Italiana',serif" },
];

interface DB { id: string; title: string }
interface Config {
  token: string;
  databaseId: string;
  title: string;
  folderOptions: string[];
  folderColorPalette: string[];
  fontFamily: string;
  accent: string;
}

/* ───── Title bar ───── */
function TitleBar() {
  return (
    <div style={{
      background: "#FFF0F5", padding: "12px 20px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      borderBottom: "1px solid #F5C6D0", fontFamily: "'Galmuri11',monospace",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: ACCENT, fontWeight: 700, fontSize: 12, letterSpacing: 0.5 }}>
        <Sparkles size={14} color={ACCENT} aria-hidden />
        BUBBLE MEMO
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {["#F5C6D0","#F5C6D0","#E8A8C0"].map((c,i) => (
          <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block" }} />
        ))}
      </div>
    </div>
  );
}

/* ───── Step pills ───── */
function Steps({ current }: { current: number }) {
  const steps = [{ num: "01", label: "연결" }, { num: "02", label: "디자인" }, { num: "03", label: "완료" }];
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 56 }}>
      {steps.map((s, i) => {
        const active = i + 1 === current;
        return (
          <div key={s.num} style={{
            padding: "7px 18px", fontSize: 11, fontWeight: 600, borderRadius: 50,
            transition: "all 0.3s",
            color:      active ? "#fff" : "#D4A5C9",
            background: active ? ACCENT : "#FFF5F9",
            border:     `1px solid ${active ? ACCENT : "#F5C6D0"}`,
            boxShadow:  active ? "0 4px 12px rgba(232,168,192,0.3)" : "none",
          }}>
            {s.num} {s.label}
          </div>
        );
      })}
    </div>
  );
}

/* ───── Step 1: Notion 연결 ───── */
function Step1({ onNext }: { onNext: (d: { token: string; databaseId: string; title: string; folderOptions: string[] }) => void }) {
  const [token, setToken]     = useState("");
  const [dbs, setDbs]         = useState<DB[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function fetchDBs() {
    if (!token.trim()) { setError("API 토큰을 입력해주세요"); return; }
    setLoading(true); setError(""); setDbs([]); setSelected("");
    try {
      const r = await fetch("/api/notion/databases", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (!d.databases.length) throw new Error("연결된 데이터베이스가 없습니다. 인테그레이션에 DB를 공유했는지 확인해주세요.");
      setDbs(d.databases);
    } catch (e) { setError(e instanceof Error ? e.message : "오류가 발생했습니다"); }
    finally { setLoading(false); }
  }

  async function handleNext() {
    const db = dbs.find(d => d.id === selected);
    if (!db) return;
    // get folder options from schema
    let folderOptions: string[] = [];
    try {
      const r = await fetch("/api/notion/schema", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), databaseId: selected }),
      });
      const d = await r.json();
      folderOptions = d.folderOptions ?? [];
    } catch { /* ok */ }
    onNext({ token: token.trim(), databaseId: selected, title: db.title, folderOptions });
  }

  return (
    <div className="animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: 34 }}>
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div style={{
          width: 70, height: 70, background: "#FFF0F5", border: "1px solid #F5C6D0",
          borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <Database size={32} color={ACCENT} aria-hidden />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#333" }}>노션 연결</h2>
        <p style={{ fontSize: 13, color: "#999", lineHeight: 1.6 }}>
          Internal Integration Secret을 입력하고 연결할 DB를 선택하세요.
        </p>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 600, color: "#999" }}>API TOKEN</label>
        <input
          type="password"
          value={token}
          onChange={e => { setToken(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && fetchDBs()}
          placeholder="ntn_xxxxxxxxxxxxx"
          className="y2k-input"
          style={{
            width: "100%", padding: 14, border: "1px solid #F5C6D0",
            background: "#FFF5F9", fontSize: 14, color: "#333", borderRadius: 10,
            fontFamily: "inherit", transition: "all 0.2s",
          }}
        />
      </div>

      {error && <p style={{ fontSize: 12, color: "#e53e3e", marginTop: -20 }}>{error}</p>}

      <button
        onClick={fetchDBs}
        disabled={loading || !token.trim()}
        style={{
          background: ACCENT, color: "#fff", border: "none",
          padding: "12px 28px", fontSize: 13, fontWeight: 600,
          cursor: loading || !token.trim() ? "not-allowed" : "pointer",
          borderRadius: 10, fontFamily: "inherit", transition: "all 0.2s",
          boxShadow: "0 4px 12px rgba(232,168,192,0.3)",
          opacity: loading || !token.trim() ? 0.6 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {loading ? (
          <>
            <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
            조회중
          </>
        ) : "DB 조회"}
      </button>

      {dbs.length > 0 && (
        <div className="animate-fadeIn">
          <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 600, color: "#999" }}>데이터베이스 선택</label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="y2k-input"
            style={{
              width: "100%", padding: 14, border: "1px solid #F5C6D0",
              background: "#FFF5F9", fontSize: 14, color: selected ? "#333" : "#999",
              borderRadius: 10, fontFamily: "inherit", cursor: "pointer",
            }}
          >
            <option value="">DB를 선택하세요</option>
            {dbs.map(db => <option key={db.id} value={db.id}>{db.title}</option>)}
          </select>
        </div>
      )}

      {selected && (
        <button
          onClick={handleNext}
          className="animate-fadeIn"
          style={{
            background: ACCENT, color: "#fff", border: "none",
            padding: "12px 28px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", borderRadius: 10, fontFamily: "inherit",
            boxShadow: "0 4px 12px rgba(232,168,192,0.3)",
          }}
        >
          다음 →
        </button>
      )}
    </div>
  );
}

/* ───── Step 2: 디자인 ───── */
function Step2({
  folderOptions,
  onNext,
  onBack,
}: {
  folderOptions: string[];
  onNext: (d: { folderColorPalette: string[]; fontFamily: string }) => void;
  onBack: () => void;
}) {
  const defaultColors = folderOptions.map((_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length]);
  const [colors, setColors] = useState<string[]>(defaultColors);
  const [font, setFont]     = useState<FontKey>("pretendard");

  function setColor(idx: number, c: string) {
    setColors(prev => { const n = [...prev]; n[idx] = c; return n; });
  }

  return (
    <div className="animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 70, height: 70, background: "#FFF0F5", border: "1px solid #F5C6D0",
          borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <Palette size={32} color={ACCENT} aria-hidden />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#333" }}>디자인 설정</h2>
        <p style={{ fontSize: 13, color: "#999", lineHeight: 1.6 }}>폴더 색상과 폰트를 설정하세요.</p>
      </div>

      {folderOptions.length > 0 && (
        <div>
          <label style={{ display: "block", marginBottom: 12, fontSize: 12, fontWeight: 600, color: "#999" }}>폴더 색상</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {folderOptions.map((folder, i) => (
              <div key={folder} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 12, color: "#666", width: 64, flexShrink: 0, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{folder}</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(i, c)}
                      style={{
                        width: 20, height: 20, borderRadius: "50%", background: c,
                        border: colors[i] === c ? "2px solid #333" : "2px solid transparent",
                        cursor: "pointer", transition: "border 0.15s",
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label style={{ display: "block", marginBottom: 12, fontSize: 12, fontWeight: 600, color: "#999" }}>폰트</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {FONTS.map(f => (
            <button
              key={f.id}
              onClick={() => setFont(f.id)}
              style={{
                padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${font === f.id ? ACCENT : "#F5C6D0"}`,
                background: font === f.id ? "#FFF0F5" : "#FFF5F9",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 10, color: "#999", marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: "#333", fontFamily: f.css }}>{f.sample}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onBack}
          style={{
            flex: 1, padding: "12px 0", fontSize: 13, fontWeight: 500,
            border: "1px solid #F5C6D0", background: "transparent", color: "#999",
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          이전
        </button>
        <button
          onClick={() => onNext({ folderColorPalette: colors, fontFamily: FONTS.find(f => f.id === font)!.css })}
          style={{
            flex: 1, padding: "12px 0", fontSize: 13, fontWeight: 600,
            background: ACCENT, color: "#fff", border: "none",
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 4px 12px rgba(232,168,192,0.3)",
          }}
        >
          다음 →
        </button>
      </div>
    </div>
  );
}

/* ───── Step 3: 완료 ───── */
function Step3({ config, onBack }: { config: Config; onBack: () => void }) {
  const router = useRouter();

  function start() {
    localStorage.setItem("bubble-memo-config", JSON.stringify(config));
    router.push("/");
  }

  return (
    <div className="animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: 24, textAlign: "center" }}>
      <div>
        <div style={{
          width: 70, height: 70, background: ACCENT, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
        }}>
          <CheckCircle2 size={32} color="#fff" aria-hidden />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#333" }}>설정 완료!</h2>
        <p style={{ fontSize: 13, color: "#999", lineHeight: 1.6 }}>
          <strong style={{ color: "#333" }}>{config.title}</strong> 데이터베이스가 연결되었습니다.
          <br />지금 바로 메모를 시작해보세요.
        </p>
      </div>

      <div style={{
        background: "#FFF5F9", borderRadius: 10, padding: "16px 20px",
        border: "1px solid #F5C6D0", textAlign: "left",
      }}>
        {[
          { label: "데이터베이스", value: config.title },
          { label: "폴더 수", value: `${config.folderOptions.length}개` },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
            <span style={{ color: "#999" }}>{item.label}</span>
            <span style={{ color: "#333", fontWeight: 600 }}>{item.value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onBack}
          style={{
            flex: 1, padding: "12px 0", fontSize: 13, fontWeight: 500,
            border: "1px solid #F5C6D0", background: "transparent", color: "#999",
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          이전
        </button>
        <button
          onClick={start}
          style={{
            flex: 1, padding: "12px 0", fontSize: 13, fontWeight: 600,
            background: ACCENT, color: "#fff", border: "none",
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 4px 12px rgba(232,168,192,0.3)",
          }}
        >
          시작하기 ✨
        </button>
      </div>
    </div>
  );
}

/* ───── Main ───── */
export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Config>({
    token: "", databaseId: "", title: "",
    folderOptions: [], folderColorPalette: [],
    fontFamily: "'Pretendard Variable','Pretendard',sans-serif",
    accent: ACCENT,
  });

  function handleStep1(d: { token: string; databaseId: string; title: string; folderOptions: string[] }) {
    setConfig(prev => ({ ...prev, ...d }));
    setStep(2);
  }
  function handleStep2(d: { folderColorPalette: string[]; fontFamily: string }) {
    setConfig(prev => ({ ...prev, ...d }));
    setStep(3);
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#FFF5F9",
      backgroundImage: "linear-gradient(rgba(232,168,192,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(232,168,192,0.06) 1px,transparent 1px)",
      backgroundSize: "40px 40px",
      color: "#333",
      fontFamily: "'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,sans-serif",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.95)",
        border: "2px solid #E8A8C0",
        boxShadow: "0 0 0 3px #FFF0F5,2px 2px 0px rgba(232,168,192,0.3),4px 4px 12px rgba(232,168,192,0.15)",
        borderRadius: 10,
        maxWidth: 700,
        margin: "4rem auto",
        overflow: "hidden",
        backdropFilter: "blur(10px)",
      }}>
        <TitleBar />

        <div style={{ padding: "52px 52px 40px" }}>
          <Steps current={step} />

          <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
            <div style={{ maxWidth: 500, width: "100%" }}>
              {step === 1 && <Step1 onNext={handleStep1} />}
              {step === 2 && (
                <Step2
                  folderOptions={config.folderOptions}
                  onNext={handleStep2}
                  onBack={() => setStep(1)}
                />
              )}
              {step === 3 && (
                <Step3 config={config} onBack={() => setStep(2)} />
              )}
            </div>
          </div>
        </div>
      </div>

      <footer style={{ textAlign: "center", padding: "0 20px 40px", color: "#D4A5C9", fontSize: 12, lineHeight: 1.8 }}>
        <div style={{ marginBottom: 4, fontWeight: 600, color: "#999" }}>bubble memo</div>
        <div>made with <span style={{ color: ACCENT }}>♥</span></div>
      </footer>
    </div>
  );
}
