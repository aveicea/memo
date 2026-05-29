import { NextRequest, NextResponse } from "next/server";

const hdrs = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { token, pinnedProp, importantProp, folderProp, replyProp, pinned, important, folder, reply, content } = body;

    /* ── update content blocks ── */
    if (content !== undefined) {
      // 1. get existing blocks
      const bRes = await fetch(`https://api.notion.com/v1/blocks/${id}/children`, { headers: hdrs(token) });
      const bData = await bRes.json();
      // 2. archive each existing content block
      for (const block of (bData.results ?? [])) {
        if (block.type === "paragraph" || block.type === "to_do") {
          await fetch(`https://api.notion.com/v1/blocks/${block.id}`, {
            method: "PATCH", headers: hdrs(token),
            body: JSON.stringify({ archived: true }),
          });
        }
      }
      // 3. append new blocks
      const lines = (content as string).split("\n");
      const children = lines.filter((l: string) => l.trim() !== "").map((line: string) => {
        const m = line.match(/^- \[(x| )\] (.+)/);
        if (m) return { object: "block", type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: m[2] } }], checked: m[1] === "x" } };
        return { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: line } }] } };
      });
      if (children.length > 0) {
        await fetch(`https://api.notion.com/v1/blocks/${id}/children`, {
          method: "PATCH", headers: hdrs(token),
          body: JSON.stringify({ children }),
        });
      }
      // update title too
      const title = (content as string).split("\n")[0].replace(/^- \[.\] /, "").slice(0, 100);
      await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH", headers: hdrs(token),
        body: JSON.stringify({ properties: { Name: { title: [{ type: "text", text: { content: title } }] } } }),
      });
    }

    /* ── update properties ── */
    const properties: Record<string, unknown> = {};
    if (pinnedProp   && pinned     !== undefined) properties[pinnedProp]    = { checkbox: pinned };
    if (importantProp && important !== undefined) properties[importantProp] = { checkbox: important };
    if (folderProp   && folder     !== undefined) properties[folderProp]    = { select: folder ? { name: folder } : null };
    if (replyProp    && reply      !== undefined) properties[replyProp]     = { rich_text: reply ? [{ type: "text", text: { content: reply } }] : [] };

    if (Object.keys(properties).length > 0) {
      const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH", headers: hdrs(token), body: JSON.stringify({ properties }),
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    }

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
      method: "PATCH", headers: hdrs(token), body: JSON.stringify({ archived: true }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

