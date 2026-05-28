import { NextRequest, NextResponse } from "next/server";

const hdrs = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { token, pinnedProp, importantProp, folderProp, replyProp, pinned, important, folder, reply } = await req.json();
    const properties: Record<string, unknown> = {};
    if (pinnedProp   && pinned   !== undefined) properties[pinnedProp]   = { checkbox: pinned };
    if (importantProp && important !== undefined) properties[importantProp] = { checkbox: important };
    if (folderProp   && folder   !== undefined) properties[folderProp]   = { select: folder ? { name: folder } : null };
    if (replyProp    && reply    !== undefined) properties[replyProp]    = { rich_text: reply ? [{ type: "text", text: { content: reply } }] : [] };

    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH", headers: hdrs(token),
      body: JSON.stringify({ properties }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { token } = await req.json();
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH", headers: hdrs(token),
      body: JSON.stringify({ archived: true }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
