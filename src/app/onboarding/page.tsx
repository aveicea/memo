"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Theme = "light" | "dark" | "warm" | "mint";
type FontStyle = "sans" | "serif" | "mono";

interface Config {
  token: string;
  dbId: string;
  dbName: string;
  theme: Theme;
  font: FontStyle;
}

interface Database {
  id: string;
  title: string;
}

const STEP_LIST = [
  { num: "01", label: "연결" },
  { num: "02", label: "디자인" },
  { num: "03", label: "완료" },
];

const THEMES: { id: Theme; label: string; bg: string; border: string }[] = [
  { id: "light", label: "라이트", bg: "#ffffff", border: "#e8e6e0" },
  { id: "dark", label: "다크", bg: "#1a1918", border: "#3a3836" },
  { id: "warm", label: "웜", bg: "#fef9f0", border: "#f0e8d8" },
  { id: "mint", label: "민트", bg: "#f0f9f6", border: "#c8ece4" },
];

const FONTS: { id: FontStyle; label: string; sample: string }[] = [
  { id: "sans", label: "고딕체", sample: "가나다 ABC" },
  { id: "serif", label: "명조체", sample: "가나다 ABC" },
  { id: "mono", label: "모노체", sample: "가나다 ABC" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-12">
      {STEP_LIST.map((step, i) => {
        const idx = i + 1;
        const isActive = idx === current;
        const isDone = idx < current;

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold tracking-widest transition-all duration-300"
                style={{
                  color: isActive || isDone ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {step.num}
              </span>
              <span
                className="text-xs font-medium transition-all duration-300"
                style={{
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
            {i < STEP_LIST.length - 1 && (
              <div
                className="mx-4 h-px w-8 transition-all duration-500"
                style={{
                  background: isDone ? "var(--text-primary)" : "var(--border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Step1({
  onNext,
}: {
  onNext: (data: Pick<Config, "token" | "dbId" | "dbName">) => void;
}) {
  const [token, setToken] = useState("");
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchDatabases = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setError("API 토큰을 입력해주세요");
      return;
    }
    setLoading(true);
    setError("");
    setDatabases([]);
    setSelectedDb("");
    try {
      const res = await fetch("/api/notion/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.databases.length === 0) {
        setError("연결된 데이터베이스가 없습니다. 인테그레이션에 DB를 공유했는지 확인해주세요.");
        return;
      }
      setDatabases(data.databases);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    const db = databases.find((d) => d.id === selectedDb);
    if (!db) return;
    onNext({ token: token.trim(), dbId: selectedDb, dbName: db.title });
  };

  return (
    <div className="animate-fade-in">
      <h2
        className="text-xl font-semibold mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        노션 연결
      </h2>
      <p
        className="text-sm mb-8 leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        Internal Integration Secret을 입력하고 연결할 DB를 선택하세요
      </p>

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label
              className="block text-xs font-semibold tracking-widest mb-1.5 uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              API TOKEN
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && fetchDatabases()}
              placeholder="secret_xxxxxxxxxxxxxxxx"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-all"
              style={{
                background: "var(--bg)",
                border: "1.5px solid var(--border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--text-primary)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchDatabases}
              disabled={loading || !token.trim()}
              className="px-4 py-2.5 text-sm font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "var(--accent)",
                color: "#ffffff",
                minWidth: "80px",
              }}
              onMouseEnter={(e) => {
                if (!loading && token.trim())
                  e.currentTarget.style.background = "var(--accent-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--accent)";
              }}
            >
              {loading ? (
                <span className="flex items-center gap-1.5 justify-center">
                  <span className="block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  조회중
                </span>
              ) : (
                "DB 조회"
              )}
            </button>
          </div>
        </div>

        {error && (
          <p
            className="text-xs animate-fade-in"
            style={{ color: "#e53e3e" }}
          >
            {error}
          </p>
        )}

        {databases.length > 0 && (
          <div className="animate-fade-in">
            <label
              className="block text-xs font-semibold tracking-widest mb-1.5 uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              데이터베이스
            </label>
            <select
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-all appearance-none cursor-pointer"
              style={{
                background: "var(--bg)",
                border: "1.5px solid var(--border)",
                color: selectedDb ? "var(--text-primary)" : "var(--text-muted)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--text-primary)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <option value="" style={{ color: "var(--text-muted)" }}>
                DB를 선택하세요
              </option>
              {databases.map((db) => (
                <option key={db.id} value={db.id}>
                  {db.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedDb && (
        <div className="mt-8 animate-fade-in">
          <button
            onClick={handleNext}
            className="w-full py-3 text-sm font-semibold rounded-lg transition-all"
            style={{
              background: "var(--accent)",
              color: "#ffffff",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent)";
            }}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

function Step2({
  config,
  onNext,
  onBack,
}: {
  config: Pick<Config, "theme" | "font">;
  onNext: (data: Pick<Config, "theme" | "font">) => void;
  onBack: () => void;
}) {
  const [theme, setTheme] = useState<Theme>(config.theme);
  const [font, setFont] = useState<FontStyle>(config.font);

  return (
    <div className="animate-fade-in">
      <h2
        className="text-xl font-semibold mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        디자인 설정
      </h2>
      <p
        className="text-sm mb-8 leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        메모 페이지의 테마와 폰트를 선택하세요
      </p>

      <div className="space-y-6">
        <div>
          <label
            className="block text-xs font-semibold tracking-widest mb-3 uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            테마
          </label>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all"
                style={{
                  border: `1.5px solid ${theme === t.id ? "var(--text-primary)" : "var(--border)"}`,
                  background: theme === t.id ? "var(--bg)" : "transparent",
                }}
              >
                <div
                  className="w-full h-8 rounded-md border"
                  style={{ background: t.bg, borderColor: t.border }}
                />
                <span
                  className="text-xs font-medium"
                  style={{
                    color: theme === t.id ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            className="block text-xs font-semibold tracking-widest mb-3 uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            폰트
          </label>
          <div className="space-y-2">
            {FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFont(f.id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all"
                style={{
                  border: `1.5px solid ${font === f.id ? "var(--text-primary)" : "var(--border)"}`,
                  background: "transparent",
                }}
              >
                <span
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  {f.label}
                </span>
                <span
                  className="text-sm"
                  style={{
                    color: font === f.id ? "var(--text-primary)" : "var(--text-secondary)",
                    fontFamily:
                      f.id === "serif"
                        ? "Georgia, serif"
                        : f.id === "mono"
                        ? "monospace"
                        : "inherit",
                  }}
                >
                  {f.sample}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-8">
        <button
          onClick={onBack}
          className="flex-1 py-3 text-sm font-medium rounded-lg transition-all"
          style={{
            border: "1.5px solid var(--border)",
            color: "var(--text-secondary)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--text-primary)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          이전
        </button>
        <button
          onClick={() => onNext({ theme, font })}
          className="flex-1 py-3 text-sm font-semibold rounded-lg transition-all"
          style={{ background: "var(--accent)", color: "#ffffff" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--accent)";
          }}
        >
          다음
        </button>
      </div>
    </div>
  );
}

function Step3({
  config,
  onBack,
}: {
  config: Config;
  onBack: () => void;
}) {
  const router = useRouter();

  const handleStart = () => {
    localStorage.setItem("bubble-memo-config", JSON.stringify(config));
    router.push("/");
  };

  return (
    <div className="animate-fade-in text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-6"
        style={{ background: "var(--accent)" }}
      >
        <span style={{ filter: "invert(1)" }}>✓</span>
      </div>

      <h2
        className="text-xl font-semibold mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        설정 완료
      </h2>
      <p
        className="text-sm leading-relaxed mb-8"
        style={{ color: "var(--text-secondary)" }}
      >
        <span
          className="font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {config.dbName}
        </span>
        이(가) 연결되었습니다.
        <br />
        지금 바로 메모를 시작해보세요.
      </p>

      <div
        className="text-left rounded-xl p-4 mb-8 space-y-2"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
        }}
      >
        {[
          { label: "데이터베이스", value: config.dbName },
          {
            label: "테마",
            value: THEMES.find((t) => t.id === config.theme)?.label ?? config.theme,
          },
          {
            label: "폰트",
            value: FONTS.find((f) => f.id === config.font)?.label ?? config.font,
          },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              {item.label}
            </span>
            <span
              className="text-sm"
              style={{ color: "var(--text-primary)" }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 text-sm font-medium rounded-lg transition-all"
          style={{
            border: "1.5px solid var(--border)",
            color: "var(--text-secondary)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--text-primary)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          이전
        </button>
        <button
          onClick={handleStart}
          className="flex-1 py-3 text-sm font-semibold rounded-lg transition-all"
          style={{ background: "var(--accent)", color: "#ffffff" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--accent)";
          }}
        >
          시작하기
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Config>({
    token: "",
    dbId: "",
    dbName: "",
    theme: "light",
    font: "sans",
  });

  const handleStep1 = (data: Pick<Config, "token" | "dbId" | "dbName">) => {
    setConfig((prev) => ({ ...prev, ...data }));
    setStep(2);
  };

  const handleStep2 = (data: Pick<Config, "theme" | "font">) => {
    setConfig((prev) => ({ ...prev, ...data }));
    setStep(3);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <h1
              className="text-base font-semibold tracking-[0.25em] uppercase"
              style={{ color: "var(--text-primary)" }}
            >
              bubble memo
            </h1>
          </div>

          <StepIndicator current={step} />

          <div
            className="rounded-2xl p-8"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            {step === 1 && <Step1 onNext={handleStep1} />}
            {step === 2 && (
              <Step2
                config={{ theme: config.theme, font: config.font }}
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

      <footer className="py-6 text-center">
        <p
          className="text-xs tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          bubble memo &nbsp;·&nbsp; made with ♥
        </p>
      </footer>
    </div>
  );
}
