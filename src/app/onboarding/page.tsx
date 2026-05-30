"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { CONFIG_STORAGE_KEY, buildShareUrl, decodeConfig, encodeConfig } from "@/lib/config";

/* ── types ── */
interface DB { id: string; title: string }
interface Design {
  accent: string; accentLight: string; textColor: string;
  msgBubbleBg: string; msgTextColor: string;
  replyBubbleBg: string; replyTextColor: string;
  folderColorPalette: string[]; folderBubblePalette: string[]; fontFamily: string; alignLeft: boolean;
  mobile?: boolean;
}
interface Config extends Design {
  token: string; databaseId: string; title: string; folderOptions: string[];
  folderProp?: string; pinnedProp?: string; importantProp?: string; replyProp?: string; dateProp?: string;
}

/* ── theme presets ── */
const PRESETS: Array<{ label: string; dot: string } & Design> = [
  { label:"파스텔톤", dot:"#E8A8C0", accent:"#E8A8C0", accentLight:"#FFF0F5", textColor:"#666666", msgBubbleBg:"#ffffff", msgTextColor:"#666666", replyBubbleBg:"#FFF0F5", replyTextColor:"#D4849E", folderColorPalette:["#FFB3BA","#E2D1F0","#C6EBC5","#FFDFBA","#BAE1FF","#FFD1DC","#B5EAD7","#FFDAC1"], folderBubblePalette:[], fontFamily:"'Pretendard Variable','Pretendard',sans-serif", alignLeft:false },
  { label:"핑크",    dot:"#F472B6", accent:"#F472B6", accentLight:"#FDF2F8", textColor:"#5b5b5b", msgBubbleBg:"#ffffff", msgTextColor:"#5b5b5b", replyBubbleBg:"#FCE7F3", replyTextColor:"#be185d", folderColorPalette:["#fbcfe8","#f9a8d4","#f472b6","#ec4899","#db2777","#be185d","#9d174d","#831843"], folderBubblePalette:[], fontFamily:"'Pretendard Variable','Pretendard',sans-serif", alignLeft:false },
  { label:"블랙",    dot:"#333333", accent:"#474747", accentLight:"#f5f5f5", textColor:"#333333", msgBubbleBg:"#ffffff", msgTextColor:"#333333", replyBubbleBg:"#474747", replyTextColor:"#ffffff", folderColorPalette:["#d4d4d4","#b5b5b5","#949494","#787878","#666666","#454545","#2a2a2a","#111111"], folderBubblePalette:[], fontFamily:"'Pretendard Variable','Pretendard',sans-serif", alignLeft:false },
  { label:"보라",    dot:"#9F7AEA", accent:"#9F7AEA", accentLight:"#FAF5FF", textColor:"#4a4a4a", msgBubbleBg:"#ffffff", msgTextColor:"#4a4a4a", replyBubbleBg:"#E9D8FD", replyTextColor:"#553c9a", folderColorPalette:["#e9d8fd","#d6bcfa","#b794f4","#9f7aea","#805ad5","#6b46c1","#553c9a","#44337a"], folderBubblePalette:[], fontFamily:"'Pretendard Variable','Pretendard',sans-serif", alignLeft:false },
  { label:"그린",    dot:"#68D391", accent:"#68D391", accentLight:"#F0FFF4", textColor:"#276749", msgBubbleBg:"#ffffff", msgTextColor:"#276749", replyBubbleBg:"#C6F6D5", replyTextColor:"#276749", folderColorPalette:["#c6f6d5","#9ae6b4","#68d391","#48bb78","#38a169","#2f855a","#276749","#22543d"], folderBubblePalette:[], fontFamily:"'Pretendard Variable','Pretendard',sans-serif", alignLeft:false },
  { label:"블루",    dot:"#63B3ED", accent:"#63B3ED", accentLight:"#EBF8FF", textColor:"#2c5282", msgBubbleBg:"#ffffff", msgTextColor:"#2c5282", replyBubbleBg:"#BEE3F8", replyTextColor:"#2c5282", folderColorPalette:["#bee3f8","#90cdf4","#63b3ed","#4299e1","#3182ce","#2b6cb0","#2c5282","#2a4365"], folderBubblePalette:[], fontFamily:"'Pretendard Variable','Pretendard',sans-serif", alignLeft:false },
  { label:"노랑",    dot:"#ECC94B", accent:"#ECC94B", accentLight:"#FFFFF0", textColor:"#744210", msgBubbleBg:"#ffffff", msgTextColor:"#744210", replyBubbleBg:"#FEFCBF", replyTextColor:"#744210", folderColorPalette:["#fefcbf","#faf089","#f6e05e","#ecc94b","#d69e2e","#b7791f","#975a16","#744210"], folderBubblePalette:[], fontFamily:"'Pretendard Variable','Pretendard',sans-serif", alignLeft:false },
];

const DEFAULT_DESIGN: Design = PRESETS[0];

const FONTS = [
  { label: "Pretendard", css: "'Pretendard Variable','Pretendard',sans-serif", sample: "안녕 Hello" },
  { label: "Corbel",     css: "'Corbel',sans-serif",                            sample: "안녕 Hello" },
  { label: "도스샘플",   css: "'Galmuri11',monospace",                          sample: "안녕 Hello" },
];

/* ── helpers ── */
function FolderSvg({ color, size=25 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>
    </svg>
  );
}

function ColorRow({ label, sub, value, onChange }: { label: string; sub?: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display:"flex", alignItems:"center", padding:"10px 16px", borderBottom:"1px solid #f3f3f3" }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, color:"#444" }}>{label}</div>
        {sub && <div style={{ fontSize:10, color:"#aaa", marginTop:1 }}>{sub}</div>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:11, color:"#bbb", fontFamily:"monospace" }}>{value.toUpperCase()}</span>
        <div style={{ position:"relative", width:28, height:28, cursor:"pointer", borderRadius:4, border:"1px solid #e8e8e8", overflow:"hidden" }}
          onClick={() => ref.current?.click()}>
          <div style={{ width:"100%", height:"100%", background:value }} />
          <input ref={ref} type="color" value={value} onChange={e => onChange(e.target.value)}
            style={{ position:"absolute", opacity:0, width:"100%", height:"100%", cursor:"pointer", top:0, left:0, border:"none", padding:0 }} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:12, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px 10px", borderBottom:"1px solid #f5f5f5" }}>
        <span style={{ fontSize:11, fontWeight:700, color:"#E8A8C0", letterSpacing:0.5 }}>✦ {title}</span>
      </div>
      {children}
    </div>
  );
}

/* ── preview helpers ── */
function hex2hsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), mn = Math.min(r,g,b);
  const l = (max+mn)/2;
  if (max===mn) return [0,0,l*100];
  const d = max-mn;
  const s = l>0.5 ? d/(2-max-mn) : d/(max+mn);
  let h = 0;
  if (max===r) h = ((g-b)/d + (g<b?6:0))/6;
  else if (max===g) h = ((b-r)/d+2)/6;
  else h = ((r-g)/d+4)/6;
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}
function folderToBubbleColor(hex: string): string {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return "#f5f5f5";
  const [h, s] = hex2hsl(hex);
  return `hsl(${h}, ${Math.min(s * 0.4, 30)}%, 93%)`;
}

/* ── preview ── */
const colorInputStyle: React.CSSProperties = {
  position:"absolute", opacity:0, inset:0, width:"100%", height:"100%",
  cursor:"pointer", border:"none", padding:0,
};

function Preview({ d, folderOptions, onChangeFolderColor, onChangeBubbleColor }: {
  d: Design; folderOptions: string[];
  onChangeFolderColor: (i: number, c: string) => void;
  onChangeBubbleColor: (i: number, c: string) => void;
}) {
  const accent = d.accent;
  const displayFolders = folderOptions.length > 0 ? folderOptions : ["폴더1","폴더2","폴더3"];
  return (
    <div style={{ background:"#f8f8f8", borderRadius:12, padding:12, display:"flex", flexDirection:"column", gap:0, height:"100%", minHeight:380, overflow:"hidden" }}>
      <div style={{ fontSize:10, fontWeight:700, color:"#999", letterSpacing:0.5, marginBottom:4, textAlign:"center" }}>PREVIEW</div>
      <div style={{ fontSize:9, color:"#bbb", textAlign:"center", marginBottom:6 }}>폴더 아이콘 = 폴더색 &nbsp;·&nbsp; 말풍선 = 말풍선색</div>
      <div style={{ flex:1, background:"#fff", borderRadius:8, border:`1px solid ${accent}40`, overflow:"hidden", display:"flex", flexDirection:"column", fontFamily:d.fontFamily }}>
        {/* titlebar */}
        <div style={{ background:d.accentLight, borderBottom:`1px solid ${accent}`, padding:"0 8px", height:28, display:"flex", alignItems:"center", gap:0, fontSize:10 }}>
          {displayFolders.slice(0,3).map((f,i) => (
            <span key={f} style={{ padding:"0 7px", color:i===0?accent:"#888", fontWeight:i===0?700:400, opacity:i===0?1:0.6, fontSize:9 }}>{f}</span>
          ))}
          <div style={{ flex:1 }}/>
          {[1,1,1].map((_,i)=><div key={i} style={{width:8,height:8,border:`1px solid ${accent}`,marginLeft:2,background:"white"}}/>)}
        </div>
        {/* body */}
        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
          {/* sidebar — click folder icon to change folder color */}
          <div style={{ width:52, padding:"8px 4px", display:"flex", flexDirection:"column", gap:4, alignItems:"center", borderRight:`1px solid ${accent}20`, overflowY:"auto" }}>
            {displayFolders.map((name, i) => {
              const fc = d.folderColorPalette[i] ?? accent;
              return (
                <div key={i} style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:1, cursor:"pointer" }} title={`${name} 폴더색`}>
                  <FolderSvg size={16} color={fc} />
                  <span style={{ fontSize:7, color:"#888", maxWidth:44, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"center" }}>{name}</span>
                  <input type="color" value={fc} onChange={e => onChangeFolderColor(i, e.target.value)} style={colorInputStyle} />
                </div>
              );
            })}
          </div>
          {/* memos — click bubble to change bubble color */}
          <div style={{ flex:1, padding:"6px 8px", display:"flex", flexDirection:"column", gap:3, overflowY:"auto" }}>
            {displayFolders.map((name, i) => {
              const fc = d.folderColorPalette[i] ?? accent;
              const bg = d.folderBubblePalette[i] || folderToBubbleColor(fc);
              return (
                <div key={i} style={{ position:"relative", alignSelf:"flex-end", background:bg, border:`1px solid ${fc}40`, borderRadius:"8px 8px 1px 8px", padding:"5px 8px", fontSize:10, color:d.msgTextColor, maxWidth:"80%", cursor:"pointer" }} title={`${name} 말풍선색`}>
                  {name}
                  <input type="color" value={bg.startsWith("#") ? bg : fc} onChange={e => onChangeBubbleColor(i, e.target.value)} style={colorInputStyle} />
                </div>
              );
            })}
            <div style={{ alignSelf:"flex-start", background:d.replyBubbleBg, borderRadius:"8px 8px 8px 1px", padding:"5px 8px", fontSize:10, color:d.replyTextColor, maxWidth:"80%" }}>
              always grateful ♥
            </div>
          </div>
        </div>
        {/* input */}
        <div style={{ borderTop:`1px dotted ${accent}40`, padding:"5px 6px", display:"flex", gap:4, alignItems:"center" }}>
          <div style={{ flex:1, background:"#f9f9f9", borderRadius:3, padding:"4px 7px", fontSize:9, color:"#ccc" }}>memo</div>
          <div style={{ background:accent, borderRadius:8, padding:"3px 8px", fontSize:9, color:"white", fontWeight:700 }}>SEND</div>
        </div>
      </div>
      {/* IMPORTANT preview */}
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:9, fontWeight:700, color:"#aaa", letterSpacing:0.5, marginBottom:4 }}>IMPORTANT</div>
        {["don't forget","deadline D-3"].map(t => (
          <div key={t} style={{ fontSize:10, color:d.textColor, padding:"2px 0" }}>{t}</div>
        ))}
      </div>
    </div>
  );
}

/* ── titlebar ── */
function TitleBar() {
  return (
    <div style={{ background:"#FFF0F5", padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #F5C6D0", fontFamily:"'Galmuri11',monospace" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, color:"#E8A8C0", fontWeight:700, fontSize:12, letterSpacing:0.5 }}>
        <Sparkles size={14} color="#E8A8C0" aria-hidden />BUBBLE MEMO
      </div>
      <div style={{ display:"flex", gap:6 }}>
        {["#F5C6D0","#F5C6D0","#E8A8C0"].map((c,i)=>(
          <span key={i} style={{ width:10, height:10, borderRadius:"50%", background:c, display:"inline-block" }}/>
        ))}
      </div>
    </div>
  );
}

/* ── steps ── */
function Steps({ current }: { current: number }) {
  return (
    <div style={{ display:"flex", justifyContent:"center", gap:10, marginBottom:40 }}>
      {[{n:"01",l:"연결"},{n:"02",l:"디자인"},{n:"03",l:"완료"}].map((s,i)=>{
        const a = i+1 === current;
        return (
          <div key={s.n} style={{ padding:"7px 18px", fontSize:11, fontWeight:600, borderRadius:50, transition:"all 0.3s", color:a?"#fff":"#D4A5C9", background:a?"#E8A8C0":"#FFF5F9", border:`1px solid ${a?"#E8A8C0":"#F5C6D0"}`, boxShadow:a?"0 4px 12px rgba(232,168,192,0.3)":"none" }}>
            {s.n} {s.l}
          </div>
        );
      })}
    </div>
  );
}

/* ── step 1 ── */
function Step1({ onNext, onImport }: {
  onNext: (d: { token:string; databaseId:string; title:string; folderOptions:string[]; folderProp?:string; pinnedProp?:string; importantProp?:string; replyProp?:string; dateProp?:string }) => void;
  onImport: (c: Config) => void;
}) {
  const [token, setToken]   = useState("");
  const [dbs, setDbs]       = useState<DB[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [link, setLink]     = useState("");
  const [linkError, setLinkError] = useState("");

  function importLink() {
    const raw = link.trim();
    if (!raw) return;
    // Accept a full share URL (…/?config=xxxx) or a bare encoded string.
    let encoded = raw;
    const idx = raw.indexOf("config=");
    if (idx >= 0) encoded = raw.slice(idx + "config=".length).split("&")[0];
    try { encoded = decodeURIComponent(encoded); } catch { /* already decoded */ }
    const decoded = decodeConfig<Config>(encoded);
    if (decoded?.token) { setLinkError(""); onImport(decoded); }
    else setLinkError("올바른 설정 링크가 아니에요");
  }

  async function fetchDBs() {
    if (!token.trim()) { setError("API 토큰을 입력해주세요"); return; }
    setLoading(true); setError(""); setDbs([]); setSelected("");
    try {
      const r = await fetch("/api/notion/databases", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ token:token.trim() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (!d.databases.length) throw new Error("연결된 DB가 없습니다. 인테그레이션에 DB를 공유했는지 확인해주세요.");
      setDbs(d.databases);
    } catch(e) { setError(e instanceof Error ? e.message : "오류"); }
    finally { setLoading(false); }
  }

  async function handleNext() {
    const db = dbs.find(d => d.id === selected);
    if (!db) return;
    let folderOptions: string[] = [];
    let folderProp: string | undefined, pinnedProp: string | undefined, importantProp: string | undefined, replyProp: string | undefined, dateProp: string | undefined;
    try {
      const r = await fetch("/api/notion/schema", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ token:token.trim(), databaseId:selected }) });
      const d = await r.json();
      folderOptions   = d.folderOptions ?? [];
      folderProp      = d.folderPropName ?? undefined;
      pinnedProp      = d.pinnedPropName ?? undefined;
      importantProp   = d.importantPropName ?? undefined;
      replyProp       = d.replyPropName ?? undefined;
      dateProp        = d.datePropName ?? undefined;
    } catch { /* ok */ }
    onNext({ token:token.trim(), databaseId:selected, title:db.title, folderOptions, folderProp, pinnedProp, importantProp, replyProp, dateProp });
  }

  return (
    <div className="animate-fadeIn" style={{ display:"flex", flexDirection:"column", gap:34, maxWidth:500, margin:"0 auto", width:"100%" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:70, height:70, background:"#FFF0F5", border:"1px solid #F5C6D0", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E8A8C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, marginBottom:8, color:"#333" }}>노션 연결</h2>
        <p style={{ fontSize:13, color:"#999", lineHeight:1.6 }}>Internal Integration Secret을 입력하고 연결할 DB를 선택하세요.</p>
      </div>

      <div>
        <label style={{ display:"block", marginBottom:8, fontSize:12, fontWeight:600, color:"#999" }}>API TOKEN</label>
        <input type="password" value={token} onChange={e=>{setToken(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&fetchDBs()}
          placeholder="ntn_xxxxxxxxxxxxx" className="y2k-input"
          style={{ width:"100%", padding:14, border:"1px solid #F5C6D0", background:"#FFF5F9", fontSize:14, color:"#333", borderRadius:10, fontFamily:"inherit", transition:"all 0.2s", boxSizing:"border-box" }} />
      </div>

      {error && <p style={{ fontSize:12, color:"#e53e3e", marginTop:-20 }}>{error}</p>}

      <button onClick={fetchDBs} disabled={loading||!token.trim()}
        style={{ background:"#E8A8C0", color:"#fff", border:"none", padding:"12px 28px", fontSize:13, fontWeight:600, cursor:loading||!token.trim()?"not-allowed":"pointer", borderRadius:10, fontFamily:"inherit", transition:"all 0.2s", boxShadow:"0 4px 12px rgba(232,168,192,0.3)", opacity:loading||!token.trim()?0.6:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        {loading ? <><span style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }}/>조회중</> : "DB 조회"}
      </button>

      {dbs.length > 0 && (
        <div className="animate-fadeIn">
          <label style={{ display:"block", marginBottom:8, fontSize:12, fontWeight:600, color:"#999" }}>데이터베이스 선택</label>
          <select value={selected} onChange={e=>setSelected(e.target.value)} className="y2k-input"
            style={{ width:"100%", padding:14, border:"1px solid #F5C6D0", background:"#FFF5F9", fontSize:14, color:selected?"#333":"#999", borderRadius:10, fontFamily:"inherit", cursor:"pointer" }}>
            <option value="">DB를 선택하세요</option>
            {dbs.map(db=><option key={db.id} value={db.id}>{db.title}</option>)}
          </select>
        </div>
      )}

      {selected && (
        <button onClick={handleNext} className="animate-fadeIn"
          style={{ background:"#E8A8C0", color:"#fff", border:"none", padding:"12px 28px", fontSize:13, fontWeight:600, cursor:"pointer", borderRadius:10, fontFamily:"inherit", boxShadow:"0 4px 12px rgba(232,168,192,0.3)" }}>
          다음 →
        </button>
      )}

      {/* import an existing config from a share link */}
      <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0" }}>
        <div style={{ flex:1, height:1, background:"#F5C6D0" }} />
        <span style={{ fontSize:11, color:"#C9A0B6" }}>또는 기존 설정 링크로</span>
        <div style={{ flex:1, height:1, background:"#F5C6D0" }} />
      </div>
      <div>
        <label style={{ display:"block", marginBottom:8, fontSize:12, fontWeight:600, color:"#999" }}>설정 링크 붙여넣기</label>
        <div style={{ display:"flex", gap:6 }}>
          <input value={link} onChange={e=>{setLink(e.target.value);setLinkError("");}} onKeyDown={e=>e.key==="Enter"&&importLink()}
            placeholder="https://…/?config=…" className="y2k-input"
            style={{ flex:1, padding:12, border:"1px solid #F5C6D0", background:"#FFF5F9", fontSize:13, color:"#333", borderRadius:10, fontFamily:"inherit", boxSizing:"border-box" }} />
          <button onClick={importLink} disabled={!link.trim()}
            style={{ flexShrink:0, padding:"0 18px", fontSize:13, fontWeight:600, background:link.trim()?"#fff":"#f5f5f5", color:"#E8A8C0", border:"1px solid #F5C6D0", borderRadius:10, cursor:link.trim()?"pointer":"not-allowed", fontFamily:"inherit" }}>
            불러오기
          </button>
        </div>
        {linkError && <p style={{ fontSize:12, color:"#e53e3e", marginTop:8 }}>{linkError}</p>}
        <p style={{ fontSize:11, color:"#bbb", marginTop:8, lineHeight:1.5 }}>이전에 만든 설정 링크를 붙여넣으면 그대로 불러와 수정할 수 있어요.</p>
      </div>
    </div>
  );
}

/* ── step 2 ── */
function Step2({ folderOptions, initial, onNext, onBack }: { folderOptions: string[]; initial?: Design; onNext: (d: Design) => void; onBack: () => void }) {
  const [d, setD] = useState<Design>(
    initial
      ? { ...initial, folderColorPalette: [...initial.folderColorPalette] }
      : { ...DEFAULT_DESIGN, folderColorPalette: [...DEFAULT_DESIGN.folderColorPalette] }
  );
  const [fontIdx, setFontIdx] = useState(() => {
    const i = FONTS.findIndex(f => f.css === initial?.fontFamily);
    return i >= 0 ? i : 0;
  });

  function applyPreset(p: typeof PRESETS[0]) {
    // Preserve the mobile toggle across theme switches — it's a layout target,
    // not part of the color theme.
    setD(prev => ({ ...p, folderColorPalette: [...p.folderColorPalette], mobile: prev.mobile }));
    setFontIdx(FONTS.findIndex(f => f.css === p.fontFamily) ?? 0);
  }

  function setFolderColor(i: number, c: string) {
    setD(prev => { const pal = [...prev.folderColorPalette]; pal[i] = c; return { ...prev, folderColorPalette: pal }; });
  }
  function setFolderBubbleColor(i: number, c: string) {
    setD(prev => { const pal = [...(prev.folderBubblePalette ?? [])]; pal[i] = c; return { ...prev, folderBubblePalette: pal }; });
  }

  function setField<K extends keyof Design>(k: K, v: Design[K]) {
    setD(prev => ({ ...prev, [k]: v }));
  }

  function handleNext() {
    onNext({ ...d, fontFamily: FONTS[fontIdx].css });
  }

  return (
    <div className="animate-fadeIn" style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* presets */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {PRESETS.map(p => {
          const active = d.accent === p.accent && d.accentLight === p.accentLight;
          return (
            <button key={p.label} onClick={() => applyPreset(p)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:50, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.2s", border:`1px solid ${active?"#E8A8C0":"#F5C6D0"}`, background:active?"#E8A8C0":"#fff", color:active?"#fff":"#999" }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:p.dot, display:"inline-block", flexShrink:0 }}/>
              {p.label}
            </button>
          );
        })}
      </div>

      {/* main grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 280px", gap:16, alignItems:"start" }}>

        {/* LEFT: THEME + 내 말풍선 */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <SectionCard title="THEME">
            <div style={{ padding:"8px 16px 4px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #f3f3f3" }}>
              <span style={{ fontSize:12, color:"#888" }}>MODE</span>
              <div style={{ display:"flex", gap:6, alignItems:"center", fontSize:11, color:"#bbb" }}>
                <span style={{ color:"#555", fontWeight:600 }}>LIGHT</span>
                <span style={{ fontSize:10 }}>☉</span>
                <span>DARK</span>
              </div>
            </div>
            <ColorRow label="Accent" sub="강조색" value={d.accent} onChange={v=>setField("accent",v)} />
            <ColorRow label="Light"  sub="연한 배경" value={d.accentLight} onChange={v=>setField("accentLight",v)} />
            <ColorRow label="Text"   sub="입력 텍스트" value={d.textColor} onChange={v=>setField("textColor",v)} />
          </SectionCard>

          <SectionCard title="내 말풍선">
            <ColorRow label="배경" value={d.msgBubbleBg}   onChange={v=>setField("msgBubbleBg",v)} />
            <ColorRow label="텍스트" value={d.msgTextColor} onChange={v=>setField("msgTextColor",v)} />
          </SectionCard>
        </div>

        {/* MIDDLE: FOLDER COLORS + FONT + 답글/중요 */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <SectionCard title="FOLDER COLORS">
            <div style={{ padding:"12px 16px", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px 4px" }}>
              {(folderOptions.length ? folderOptions : ["폴더1","폴더2","폴더3","폴더4"]).map((name, i) => {
                const color = d.folderColorPalette[i] ?? "#e0e0e0";
                return (
                  <div key={i} style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer" }}>
                    <FolderSvg size={36} color={color} />
                    <span title={name} style={{ fontSize:9, color:"#888", maxWidth:60, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"center" }}>{name}</span>
                    <input type="color" value={color} onChange={e=>setFolderColor(i,e.target.value)} style={colorInputStyle} />
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="FONT">
            <div style={{ padding:"12px 16px", display:"flex", gap:8 }}>
              {FONTS.map((f, i) => (
                <label key={f.label} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:12, color:"#555" }}>
                  <div style={{ width:14, height:14, borderRadius:"50%", border:`2px solid ${fontIdx===i?"#E8A8C0":"#ccc"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
                    onClick={() => setFontIdx(i)}>
                    {fontIdx===i && <div style={{ width:6, height:6, borderRadius:"50%", background:"#E8A8C0" }}/>}
                  </div>
                  <span style={{ fontFamily:f.css }}>{f.label}</span>
                </label>
              ))}
            </div>
            <div style={{ padding:"0 16px 12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:"#888" }}>말풍선 왼쪽 정렬</span>
              <div onClick={() => setField("alignLeft", !d.alignLeft)}
                style={{ width:38, height:20, borderRadius:10, background:d.alignLeft?"#E8A8C0":"#e0e0e0", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
                <div style={{ position:"absolute", top:2, left:d.alignLeft?"20px":"2px", width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
              </div>
            </div>
            <div style={{ padding:"0 16px 12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:"#888" }}>모바일 맞춤</span>
              <div onClick={() => setField("mobile", !d.mobile)}
                style={{ width:38, height:20, borderRadius:10, background:d.mobile?"#E8A8C0":"#e0e0e0", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
                <div style={{ position:"absolute", top:2, left:d.mobile?"20px":"2px", width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="답글/중요 말풍선">
            <ColorRow label="배경" value={d.replyBubbleBg}   onChange={v=>setField("replyBubbleBg",v)} />
            <ColorRow label="텍스트" value={d.replyTextColor} onChange={v=>setField("replyTextColor",v)} />
          </SectionCard>
        </div>

        {/* RIGHT: PREVIEW */}
        <Preview d={d} folderOptions={folderOptions} onChangeFolderColor={setFolderColor} onChangeBubbleColor={setFolderBubbleColor} />
      </div>

      {/* buttons */}
      <div style={{ display:"flex", gap:10, paddingTop:4 }}>
        <button onClick={onBack}
          style={{ flex:"0 0 120px", padding:"13px 0", fontSize:13, fontWeight:500, border:"1px solid #F5C6D0", background:"transparent", color:"#999", borderRadius:10, cursor:"pointer", fontFamily:"inherit" }}>
          이전으로
        </button>
        <button onClick={handleNext}
          style={{ flex:1, padding:"13px 0", fontSize:13, fontWeight:600, background:"#E8A8C0", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 12px rgba(232,168,192,0.3)" }}>
          완료 및 생성 &gt;
        </button>
      </div>
    </div>
  );
}

/* ── step 3 ── */
function Step3({ config, onBack }: { config: Config; onBack: () => void }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const shareUrl = buildShareUrl(config);

  function start() {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    router.push(`/?config=${encodeConfig(config)}`);
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); }
    catch { /* clipboard may be unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="animate-fadeIn" style={{ display:"flex", flexDirection:"column", gap:24, textAlign:"center", maxWidth:500, margin:"0 auto", width:"100%" }}>
      <div>
        <div style={{ width:70, height:70, background:"#E8A8C0", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
          <CheckCircle2 size={32} color="#fff" aria-hidden />
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, marginBottom:8, color:"#333" }}>설정 완료!</h2>
        <p style={{ fontSize:13, color:"#999", lineHeight:1.6 }}>
          <strong style={{ color:"#333" }}>{config.title}</strong> 데이터베이스가 연결되었습니다.
          <br/>지금 바로 메모를 시작해보세요.
        </p>
      </div>
      <div style={{ background:"#FFF5F9", borderRadius:10, padding:"16px 20px", border:"1px solid #F5C6D0", textAlign:"left" }}>
        {[{ label:"데이터베이스", value:config.title }, { label:"폴더 수", value:`${config.folderOptions.length}개` }].map(item => (
          <div key={item.label} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:13 }}>
            <span style={{ color:"#999" }}>{item.label}</span>
            <span style={{ color:"#333", fontWeight:600 }}>{item.value}</span>
          </div>
        ))}
      </div>
      {/* shareable link — embeds the whole config in the URL */}
      <div style={{ background:"#FFF5F9", borderRadius:10, padding:"14px 16px", border:"1px solid #F5C6D0", textAlign:"left" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#E8A8C0", marginBottom:8, letterSpacing:0.3 }}>✦ 공유 링크</div>
        <p style={{ fontSize:11, color:"#aaa", lineHeight:1.5, margin:"0 0 10px" }}>
          이 링크를 열면 설정이 자동으로 적용돼요. 다른 기기나 위젯 임베드에 붙여넣으세요.
        </p>
        <div style={{ display:"flex", gap:6 }}>
          <input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()}
            style={{ flex:1, padding:"9px 12px", border:"1px solid #F5C6D0", background:"#fff", fontSize:11, color:"#777", borderRadius:8, fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", boxSizing:"border-box" }} />
          <button onClick={copyLink}
            style={{ flexShrink:0, padding:"0 16px", fontSize:12, fontWeight:600, background: copied ? "#9AE6B4" : "#fff", color: copied ? "#276749" : "#E8A8C0", border:`1px solid ${copied ? "#9AE6B4" : "#F5C6D0"}`, borderRadius:8, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}>
            {copied ? "복사됨!" : "복사"}
          </button>
        </div>
      </div>

      <div style={{ display:"flex", gap:8 }}>
        <button onClick={onBack} style={{ flex:1, padding:"12px 0", fontSize:13, fontWeight:500, border:"1px solid #F5C6D0", background:"transparent", color:"#999", borderRadius:10, cursor:"pointer", fontFamily:"inherit" }}>이전</button>
        <button onClick={start}  style={{ flex:1, padding:"12px 0", fontSize:13, fontWeight:600, background:"#E8A8C0", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 12px rgba(232,168,192,0.3)" }}>시작하기 ✨</button>
      </div>
    </div>
  );
}

/* ── main ── */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Config>({
    token:"", databaseId:"", title:"", folderOptions:[],
    ...DEFAULT_DESIGN,
  });

  function handleStep1(d: { token:string; databaseId:string; title:string; folderOptions:string[] }) {
    setConfig(prev => ({ ...prev, ...d }));
    setStep(2);
  }
  function handleImport(c: Config) {
    // Save to localStorage and jump directly to the widget — the link already
    // contains a complete config so there's nothing left to set up.
    const merged = { ...c, folderColorPalette: [...(c.folderColorPalette ?? DEFAULT_DESIGN.folderColorPalette)] };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged));
    router.push("/");
  }
  function handleStep2(d: Design) {
    setConfig(prev => ({ ...prev, ...d }));
    setStep(3);
  }

  return (
    <div style={{ minHeight:"100vh", backgroundColor:"#FFF5F9", backgroundImage:"linear-gradient(rgba(232,168,192,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(232,168,192,0.06) 1px,transparent 1px)", backgroundSize:"40px 40px", color:"#333", fontFamily:"'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <div style={{ background:"rgba(255,255,255,0.95)", border:"2px solid #E8A8C0", boxShadow:"0 0 0 3px #FFF0F5,2px 2px 0px rgba(232,168,192,0.3),4px 4px 12px rgba(232,168,192,0.15)", borderRadius:10, maxWidth:step===2?1180:700, margin:"4rem auto", overflow:"hidden", backdropFilter:"blur(10px)", transition:"max-width 0.3s ease" }}>
        <TitleBar />
        <div style={{ padding: step===2 ? "52px 52px 40px" : "52px 52px 40px" }}>
          <Steps current={step} />
          {step===1 && <Step1 onNext={handleStep1} onImport={handleImport} />}
          {step===2 && <Step2 folderOptions={config.folderOptions} initial={config} onNext={handleStep2} onBack={() => setStep(1)} />}
          {step===3 && <Step3 config={config} onBack={() => setStep(2)} />}
        </div>
      </div>
    </div>
  );
}
