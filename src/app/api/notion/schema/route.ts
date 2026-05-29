import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, databaseId } = await req.json();
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    const props = data.properties as Record<string, { type: string; select?: { options: { name: string }[] } }>;
    const selectEntry = Object.entries(props).find(([, v]) => v.type === "select");
    const folderOptions = selectEntry
      ? (selectEntry[1].select?.options ?? []).map((o) => o.name)
      : [];

    // detect property names
    const checkboxes = Object.entries(props)
      .filter(([, v]) => v.type === "checkbox")
      .map(([k]) => k);

    const richTexts = Object.entries(props)
      .filter(([, v]) => v.type === "rich_text")
      .map(([k]) => k);

    const dates = Object.entries(props)
      .filter(([, v]) => v.type === "date")
      .map(([k]) => k);

    return NextResponse.json({
      folderOptions,
      folderPropName: selectEntry?.[0] ?? null,
      pinnedPropName: checkboxes.find(k => /고정|pin/i.test(k)) ?? checkboxes[0] ?? null,
      importantPropName: checkboxes.find(k => /중요|import/i.test(k)) ?? checkboxes[1] ?? null,
      replyPropName: richTexts.find(k => /답글|reply/i.test(k)) ?? richTexts[0] ?? null,
      datePropName: dates.find(k => /날짜|date|time|created/i.test(k)) ?? dates[0] ?? null,
    });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
