import { NextRequest, NextResponse } from "next/server";

const hdrs = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
});

function lineToBlock(line: string) {
  const trimmed = line.trimStart();
  const todoMatch = trimmed.match(/^- \[(x| )\] (.+)/);
  if (todoMatch) return {
    object: "block", type: "to_do",
    to_do: { rich_text: [{ type: "text", text: { content: todoMatch[2] } }], checked: todoMatch[1] === "x" },
  };
  const bulletMatch = trimmed.match(/^- (.+)/);
  const hasIndent = line.length > line.trimStart().length;
  if (bulletMatch && !hasIndent) return {
    object: "block", type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [{ type: "text", text: { content: bulletMatch[1] } }] },
  };
  return {
    object: "block", type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: line } }] },
  };
}

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
      const children = (content as string).split("\n").filter((l: string) => l.trim() !== "").map(lineToBlock);
      if (children.length > 0) {
        await fetch(`https://api.notion.com/v1/blocks/${id}/children`, {
          method: "PATCH", headers: hdrs(token),
          body: JSON.stringify({ children }),
        });
      }
      const title = (content as string).split("\n")[0].replace(/^- \[.\] /, "").replace(/^- /, "").slice(0, 100);
      await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH", headers: hdrs(token),
        body: JSON.stringify({ properties: { Name: { title: [{ type: "text", text: { content: title || "memo" } }] } } }),
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
