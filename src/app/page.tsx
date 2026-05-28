"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const config = localStorage.getItem("bubble-memo-config");
    if (!config) {
      router.replace("/onboarding");
    }
  }, [router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        로딩 중...
      </p>
    </div>
  );
}
