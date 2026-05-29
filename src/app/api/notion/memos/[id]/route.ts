import { NextRequest, NextResponse } from "next/server";

const hdrs = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
});

type RTItem = { type: "text"; text: { content: string }; annotations?: { bold?: boolean; italic?: boolean; strikethrough?: boolean; code?: boolean } };

function parseRichText(text: string): RTItem[] {
  const items: RTItem[] = [];
  const regex = /\*\*([\s\S]+?)\*\*|_([\s\S]+?)_|~~([\s\S]+?)~~|`([\s\S]+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) items.push({ type: "text", text: { content: text.slice(last, m.index) } });
    if      (m[1] !== undefined) items.push({ type: "text", text: { content: m[1] }, annotations: { bold: true } });
    else if (m[2] !== undefined) items.push({ type: "text", text: { content: m[2] }, annotations: { italic: true } });
    else if (m[3] !== undefined) items.push({ type: "text", text: { content: m[3] }, annotations: { strikethrough: true } });
    else if (m[4] !== undefined) items.push({ type: "text", text: { content: m[4] }, annotations: { code: true } });
    last = regex.lastIndex;
  }
  if (last < text.length) items.push({ type: "text", text: { content: text.slice(last) } });
  return items.length > 0 ? items : [{ type: "text", text: { content: text } }];
}

function linesToBlocks(content: string): unknown[] {
  const items = content.split("\n")
    .filter(l => l.trim() !== "")
    .map(line => ({
      indent: Math.floor((line.match(/^( *)/)?.[1]?.length ?? 0) / 2),
      block: lineToBlock(line) as Record<string, unknown>,
    }));
  const result: Record<string, unknown>[] = [];
  const stack: { indent: number; block: Record<string, unknown> }[] = [];
  for (const item of items) {
    while (stack.length > 0 && stack[stack.length - 1].indent >= item.indent) stack.pop();
    if (stack.length === 0) {
      result.push(item.block);
    } else {
      const parent = stack[stack.length - 1].block;
      if (!parent.children) parent.children = [];
      (parent.children as Record<string, unknown>[]).push(item.block);
    }
    stack.push(item);
  }
  return result;
}

function lineToBlock(line: string) {
  const trimmed = line.trimStart();
  const todoMatch = trimmed.match(/^- \[(x| )\] (.*)/);
  if (todoMatch) return {
    object: "block", type: "to_do",
    to_do: { rich_text: parseRichText(todoMatch[2]), checked: todoMatch[1] === "x" },
  };
  const numberedMatch = trimmed.match(/^\d+\. (.*)/);
  if (numberedMatch) return {
    object: "block", type: "numbered_list_item",
    numbered_list_item: { rich_text: parseRichText(numberedMatch[1]) },
  };
  const bulletMatch = trimmed.match(/^- (.*)/);
  if (bulletMatch) return {
    object: "block", type: "bulleted_list_item",
    bulleted_list_item: { rich_text: parseRichText(bulletMatch[1]) },
  };
  return {
    object: "block", type: "paragraph",
    paragraph: { rich_text: parseRichText(trimmed || line) },
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
      const children = linesToBlocks(content as string);
      if (children.length > 0) {
        await fetch(`https://api.notion.com/v1/blocks/${id}/children`, {
          method: "PATCH", headers: hdrs(token),
          body: JSON.stringify({ children }),
        });
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
