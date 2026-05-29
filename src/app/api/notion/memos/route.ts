import { NextRequest, NextResponse } from "next/server";

const N_VER = "2022-06-28";
const hdrs = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Notion-Version": N_VER,
});

interface RT { plain_text: string }
interface RichTextBlock { rich_text: RT[] }
interface NotionBlock {
  id: string; type: string;
  paragraph?: RichTextBlock;
  to_do?: { rich_text: RT[]; checked: boolean };
  bulleted_list_item?: RichTextBlock;
  numbered_list_item?: RichTextBlock;
  heading_1?: RichTextBlock; heading_2?: RichTextBlock; heading_3?: RichTextBlock;
  quote?: RichTextBlock; code?: RichTextBlock; callout?: RichTextBlock; toggle?: RichTextBlock;
  image?: { type: string; file?: { url: string }; external?: { url: string } };
}

const RT_TYPES = ["paragraph","bulleted_list_item","numbered_list_item","heading_1","heading_2","heading_3","quote","code","callout","toggle"] as const;

function getBlockText(b: NotionBlock): string {
  if (b.type === "to_do") {
    const text = b.to_do!.rich_text.map(r => r.plain_text).join("");
    return `- [${b.to_do!.checked ? "x" : " "}] ${text}`;
  }
  for (const t of RT_TYPES) {
    if (b.type === t) {
      const rt = (b[t] as RichTextBlock | undefined)?.rich_text ?? [];
      const text = rt.map(r => r.plain_text).join("");
      if (b.type === "bulleted_list_item" || b.type === "numbered_list_item") return `- ${text}`;
      return text;
    }
  }
  return "";
}

function parseBlocksToContent(blocks: NotionBlock[]): string {
  return blocks.filter(b => b.type !== "image").map(getBlockText).filter(Boolean).join("\n");
}

function parseBlocksToTodos(blocks: NotionBlock[]): { id: string; checked: boolean; text: string }[] {
  return blocks.filter(b => b.type === "to_do").map(b => ({
    id: b.id,
    checked: b.to_do!.checked,
    text: b.to_do!.rich_text.map(r => r.plain_text).join(""),
  }));
}

function parseBlocksToImageUrls(blocks: NotionBlock[]): string[] {
  return blocks.filter(b => b.type === "image").map(b => {
    if (b.image?.type === "file") return b.image.file?.url ?? "";
    if (b.image?.type === "external") return b.image.external?.url ?? "";
    return "";
  }).filter(Boolean);
}

function parseDate(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function lineToBlock(line: string) {
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

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token = p.get("token")!;
  const databaseId = p.get("databaseId")!;
  const cursor = p.get("cursor") ?? undefined;
  const folderProp = p.get("folderProp") ?? null;
  const pinnedProp = p.get("pinnedProp") ?? null;
  const importantProp = p.get("importantProp") ?? null;
  const replyProp = p.get("replyProp") ?? null;

  try {
    const body: Record<string, unknown> = {
      page_size: 20,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST", headers: hdrs(token), body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    const memos = await Promise.all(
      data.results.map(async (page: Record<string, unknown>) => {
        const props = page.properties as Record<string, { type: string; select?: { name: string }; checkbox?: boolean; rich_text?: RT[] }>;

        const bRes = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children`, { headers: hdrs(token) });
        const bData = await bRes.json();
        const rawBlocks: NotionBlock[] = bRes.ok ? (bData.results ?? []) : [];

        const folder = folderProp && props[folderProp]?.select?.name ? props[folderProp].select!.name : "";
        const pinned = pinnedProp ? (props[pinnedProp]?.checkbox ?? false) : false;
        const important = importantProp ? (props[importantProp]?.checkbox ?? false) : false;
        const replyStr = replyProp ? (props[replyProp]?.rich_text ?? []).map((r: RT) => r.plain_text).join("") : "";
        const replies = replyStr ? replyStr.split("|||").filter(Boolean) : [];

        return {
          id: page.id,
          content: parseBlocksToContent(rawBlocks),
          todos: parseBlocksToTodos(rawBlocks),
          imageUrls: parseBlocksToImageUrls(rawBlocks),
          createdAt: parseDate(page.created_time as string),
          replies, pinned, important, folder,
        };
      })
    );

    return NextResponse.json({ memos, nextCursor: data.next_cursor ?? null, hasMore: data.has_more });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, databaseId, content, folder, folderProp, pinnedProp, importantProp, imageUploadIds } = await req.json();

    const lines = (content as string).split("\n");
    const children: unknown[] = lines.filter((l: string) => l.trim() !== "").map(lineToBlock);

    if (Array.isArray(imageUploadIds) && imageUploadIds.length > 0) {
      for (const uploadId of imageUploadIds) {
        children.push({ object: "block", type: "image", image: { type: "file_upload", file_upload: { id: uploadId } } });
      }
    }

    const firstLine = (content as string).split("\n")[0].replace(/^\s*- \[.\] /, "").replace(/^\s*- /, "").slice(0, 100);
    const properties: Record<string, unknown> = {
      Name: { title: [{ text: { content: firstLine || "memo" } }] },
    };
    if (folderProp && folder) properties[folderProp] = { select: { name: folder } };
    if (pinnedProp)    properties[pinnedProp]    = { checkbox: false };
    if (importantProp) properties[importantProp] = { checkbox: false };

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST", headers: hdrs(token),
      body: JSON.stringify({ parent: { database_id: databaseId }, properties, children }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    return NextResponse.json({ id: data.id });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
