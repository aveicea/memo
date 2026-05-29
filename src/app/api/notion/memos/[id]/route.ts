import { NextRequest, NextResponse } from "next/server";
import { linesToTree, appendTree } from "../route";

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

    if (content !== undefined) {
      const bRes = await fetch(`https://api.notion.com/v1/blocks/${id}/children`, { headers: hdrs(token) });
      const bData = await bRes.json();
      for (const block of (bData.results ?? [])) {
        if (["paragraph","to_do","bulleted_list_item","numbered_list_item","heading_1","heading_2","heading_3"].includes(block.type)) {
          await fetch(`https://api.notion.com/v1/blocks/${block.id}`, {
            method: "PATCH", headers: hdrs(token),
            body: JSON.stringify({ archived: true }),
          });
        }
      }
      // Append the new block tree level-by-level (no inline `children` key,
      // which Notion rejects). Archiving a parent above also removed its
      // children, so we rebuild the whole tree fresh.
      const roots = linesToTree(content as string);
      try {
        await appendTree(token, id, roots);
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "본문 저장 실패" }, { status: 500 });
      }
      const title = (content as string).split("\n")[0].replace(/^- \[.\] /, "").replace(/^- /, "").slice(0, 100);
      // Resolve the page's actual title property name (not always "Name").
      let titleProp = "Name";
      try {
        const pRes = await fetch(`https://api.notion.com/v1/pages/${id}`, { headers: hdrs(token) });
        const pData = await pRes.json();
        if (pRes.ok) {
          const props = pData.properties as Record<string, { type: string }>;
          const titleEntry = Object.entries(props).find(([, v]) => v.type === "title");
          if (titleEntry) titleProp = titleEntry[0];
        }
      } catch { /* fall back to "Name" */ }
      await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH", headers: hdrs(token),
        body: JSON.stringify({ properties: { [titleProp]: { title: [{ type: "text", text: { content: title || "memo" } }] } } }),
      });
    }

    const properties: Record<string, unknown> = {};
    if (pinnedProp    && pinned     !== undefined) properties[pinnedProp]    = { checkbox: pinned };
    if (importantProp && important  !== undefined) properties[importantProp] = { checkbox: important };
    if (folderProp    && folder     !== undefined) properties[folderProp]    = { select: folder ? { name: folder } : null };
    if (replyProp     && reply      !== undefined) properties[replyProp]     = { rich_text: reply ? [{ type: "text", text: { content: reply } }] : [] };

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
