import { NextRequest, NextResponse } from "next/server";

const N_VER = "2022-06-28";
const hdrs = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Notion-Version": N_VER,
});

interface RT { plain_text: string; annotations?: { bold?: boolean; italic?: boolean; strikethrough?: boolean; code?: boolean } }
interface RichTextBlock { rich_text: RT[] }
interface NotionBlock {
  id: string; type: string; has_children?: boolean; _children?: NotionBlock[];
  paragraph?: RichTextBlock;
  to_do?: { rich_text: RT[]; checked: boolean };
  bulleted_list_item?: RichTextBlock;
  numbered_list_item?: RichTextBlock;
  heading_1?: RichTextBlock; heading_2?: RichTextBlock; heading_3?: RichTextBlock;
  quote?: RichTextBlock; code?: RichTextBlock; callout?: RichTextBlock; toggle?: RichTextBlock;
  image?: { type: string; file?: { url: string }; external?: { url: string } };
}

const RT_TYPES = ["paragraph","bulleted_list_item","numbered_list_item","heading_1","heading_2","heading_3","quote","code","callout","toggle"] as const;

function rtToMarkdown(rt: RT[]): string {
  return rt.map(r => {
    let t = r.plain_text;
    if (r.annotations?.code)          t = `\`${t}\``;
    if (r.annotations?.bold)          t = `**${t}**`;
    if (r.annotations?.italic)        t = `_${t}_`;
    if (r.annotations?.strikethrough) t = `~~${t}~~`;
    return t;
  }).join("");
}

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

function getBlockText(b: NotionBlock, numberedIdx = 0, pre = ""): string {
  if (b.type === "to_do") return `${pre}- [${b.to_do!.checked ? "x" : " "}] ${rtToMarkdown(b.to_do!.rich_text)}`;
  for (const t of RT_TYPES) {
    if (b.type === t) {
      const rt = (b[t] as RichTextBlock | undefined)?.rich_text ?? [];
      const text = rtToMarkdown(rt);
      if (b.type === "bulleted_list_item") return `${pre}- ${text}`;
      if (b.type === "numbered_list_item") return `${pre}${numberedIdx}. ${text}`;
      return `${pre}${text}`;
    }
  }
  return "";
}

function parseBlocksToContent(blocks: NotionBlock[], indent = 0): string {
  const parts: string[] = [];
  const pre = "    ".repeat(indent);
  let numIdx = 0;
  for (const b of blocks) {
    if (b.type === "image") continue;
    if (b.type !== "numbered_list_item") numIdx = 0; else numIdx++;
    const text = getBlockText(b, numIdx, pre);
    if (text) parts.push(text);
    if (b._children?.length) {
      const child = parseBlocksToContent(b._children, indent + 1);
      if (child) parts.push(child);
    }
  }
  return parts.join("\n");
}

function parseBlocksToTodos(blocks: NotionBlock[]): { id: string; checked: boolean; text: string }[] {
  const result: { id: string; checked: boolean; text: string }[] = [];
  for (const b of blocks) {
    if (b.type === "to_do") result.push({ id: b.id, checked: b.to_do!.checked, text: rtToMarkdown(b.to_do!.rich_text) });
    if (b._children?.length) result.push(...parseBlocksToTodos(b._children));
  }
  return result;
}

// Recursively fetch a block's children so nested indentation round-trips back
// to the app. Capped at a few levels to avoid runaway requests on huge pages.
async function fetchBlockTree(token: string, blockId: string, depth: number): Promise<NotionBlock[]> {
  if (depth > 4) return [];
  const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children`, { headers: hdrs(token) });
  if (!res.ok) return [];
  const data = await res.json();
  const blocks: NotionBlock[] = data.results ?? [];
  return Promise.all(blocks.map(async b => {
    if (!b.has_children) return b;
    return { ...b, _children: await fetchBlockTree(token, b.id, depth + 1) };
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

// A node in the indentation tree: one block plus its nested children.
export interface BlockNode { block: Record<string, unknown>; kids: BlockNode[] }

// Build a tree of block nodes from indented text lines (2 spaces = one level).
// We DON'T inline a `children` key on the blocks — Notion validates inline
// nesting strictly (2-level cap + some paths reject it), which fails the whole
// request. Instead we attach children afterward via append calls (see appendTree).
export function linesToTree(content: string): BlockNode[] {
  const items = content.split("\n")
    .filter(l => l.trim() !== "")
    .map(line => ({
      indent: Math.floor((line.match(/^( *)/)?.[1]?.length ?? 0) / 4),
      node: { block: lineToBlock(line) as Record<string, unknown>, kids: [] } as BlockNode,
    }));
  const roots: BlockNode[] = [];
  const stack: { indent: number; node: BlockNode }[] = [];
  for (const item of items) {
    while (stack.length > 0 && stack[stack.length - 1].indent >= item.indent) stack.pop();
    if (stack.length === 0) roots.push(item.node);
    else stack[stack.length - 1].node.kids.push(item.node);
    stack.push(item);
  }
  return roots;
}

// Append a flat batch of blocks under a parent, then recurse for each block's
// kids using the returned block IDs. Each call sends a single flat level (no
// inline `children` key), so Notion's nesting validation never trips.
export async function appendTree(token: string, parentId: string, nodes: BlockNode[]): Promise<void> {
  if (nodes.length === 0) return;
  const res = await fetch(`https://api.notion.com/v1/blocks/${parentId}/children`, {
    method: "PATCH", headers: hdrs(token),
    body: JSON.stringify({ children: nodes.map(n => n.block) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "append failed");
  const created: { id: string }[] = data.results ?? [];
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].kids.length > 0 && created[i]) {
      await appendTree(token, created[i].id, nodes[i].kids);
    }
  }
}

// Notion requires writing the page title under whatever name the database's
// title property actually uses — it is NOT always "Name". Look it up so page
// creation doesn't fail silently for databases with a renamed title column.
export async function resolveTitleProp(token: string, databaseId: string): Promise<string> {
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, { headers: hdrs(token) });
    const data = await res.json();
    if (!res.ok) return "Name";
    const props = data.properties as Record<string, { type: string }>;
    const titleEntry = Object.entries(props).find(([, v]) => v.type === "title");
    return titleEntry?.[0] ?? "Name";
  } catch {
    return "Name";
  }
}

export function lineToBlock(line: string) {
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
        const props = page.properties as Record<string, {
          type: string; select?: { name: string }; checkbox?: boolean; rich_text?: RT[];
          files?: Array<{ type: string; file?: { url: string }; external?: { url: string } }>;
        }>;

        const rawBlocks: NotionBlock[] = await fetchBlockTree(token, page.id as string, 0);

        const folder = folderProp && props[folderProp]?.select?.name ? props[folderProp].select!.name : "";
        const pinned = pinnedProp ? (props[pinnedProp]?.checkbox ?? false) : false;
        const important = importantProp ? (props[importantProp]?.checkbox ?? false) : false;
        const replyStr = replyProp ? (props[replyProp]?.rich_text ?? []).map((r: RT) => r.plain_text).join("") : "";
        const replies = replyStr ? replyStr.split("|||").filter(Boolean) : [];

        // Pull images both from image blocks in the page body AND from any
        // "files" property on the page (e.g. an "이미지"/"첨부" column).
        const propFileUrls: string[] = [];
        for (const v of Object.values(props)) {
          if (v?.type === "files" && Array.isArray(v.files)) {
            for (const f of v.files) {
              const url = f.type === "external" ? f.external?.url : f.file?.url;
              if (url && /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|$)/i.test(url)) propFileUrls.push(url);
            }
          }
        }

        return {
          id: page.id,
          content: parseBlocksToContent(rawBlocks),
          todos: parseBlocksToTodos(rawBlocks),
          imageUrls: [...parseBlocksToImageUrls(rawBlocks), ...propFileUrls],
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
    const { token, databaseId, content, folder, folderProp, pinnedProp, importantProp, dateProp, imageUploadIds } = await req.json();

    // Top-level text blocks become the indentation tree; images append as flat
    // root-level blocks after the text.
    const roots = linesToTree(content as string);
    if (Array.isArray(imageUploadIds) && imageUploadIds.length > 0) {
      for (const uploadId of imageUploadIds) {
        roots.push({ block: { object: "block", type: "image", image: { type: "file_upload", file_upload: { id: uploadId } } }, kids: [] });
      }
    }

    const firstLine = (content as string).split("\n")[0].replace(/^\s*- \[.\] /, "").replace(/^\s*- /, "").slice(0, 100);
    const titleProp = await resolveTitleProp(token, databaseId);
    const properties: Record<string, unknown> = {
      [titleProp]: { title: [{ text: { content: firstLine || "memo" } }] },
    };
    if (folderProp && folder) properties[folderProp] = { select: { name: folder } };
    if (pinnedProp)    properties[pinnedProp]    = { checkbox: false };
    if (importantProp) properties[importantProp] = { checkbox: false };
    if (dateProp) properties[dateProp] = { date: { start: new Date().toISOString() } };

    // Create the page empty, then append the block tree level-by-level so we
    // never send an inline `children` key (which Notion rejects).
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST", headers: hdrs(token),
      body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    try {
      await appendTree(token, data.id, roots);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "본문 저장 실패" }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
