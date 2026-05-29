import { NextRequest, NextResponse } from "next/server";

const N_VER = "2022-06-28";
const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Notion-Version": N_VER,
});

function parseBlocksToContent(blocks: NotionBlock[]): string {
  return blocks
    .filter(b => b.type === "paragraph" || b.type === "to_do")
    .map(b => {
      if (b.type === "to_do") {
        const text = b.to_do!.rich_text.map((r: RT) => r.plain_text).join("");
        return `- [${b.to_do!.checked ? "x" : " "}] ${text}`;
      }
      return b.paragraph!.rich_text.map((r: RT) => r.plain_text).join("");
    })
    .join("\n");
}

function parseBlocksToTodos(blocks: NotionBlock[]): { id: string; checked: boolean; text: string }[] {
  return blocks
    .filter(b => b.type === "to_do")
    .map(b => ({
      id: b.id,
      checked: b.to_do!.checked,
      text: b.to_do!.rich_text.map((r: RT) => r.plain_text).join(""),
    }));
}

function parseDate(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface RT { plain_text: string }
interface NotionBlock {
  id: string; type: string;
  paragraph?: { rich_text: RT[] };
  to_do?: { rich_text: RT[]; checked: boolean };
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
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    const memos = await Promise.all(
      data.results.map(async (page: Record<string, unknown>) => {
        const props = page.properties as Record<string, { type: string; select?: { name: string }; checkbox?: boolean; rich_text?: RT[] }>;

        const bRes = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children`, {
          headers: headers(token),
        });
        const bData = await bRes.json();
        const rawBlocks: NotionBlock[] = bRes.ok ? (bData.results ?? []) : [];
        const content = parseBlocksToContent(rawBlocks);
        const todos = parseBlocksToTodos(rawBlocks);

        const folder = folderProp && props[folderProp]?.select?.name ? props[folderProp].select!.name : "";
        const pinned = pinnedProp ? (props[pinnedProp]?.checkbox ?? false) : false;
        const important = importantProp ? (props[importantProp]?.checkbox ?? false) : false;
        const replyStr = replyProp ? (props[replyProp]?.rich_text ?? []).map((r: RT) => r.plain_text).join("") : "";
        const replies = replyStr ? replyStr.split("|||").filter(Boolean) : [];

        return {
          id: page.id,
          content,
          todos,
          createdAt: parseDate(page.created_time as string),
          replies,
          pinned,
          important,
          folder,
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
    const { token, databaseId, content, folder, folderProp, pinnedProp, importantProp } = await req.json();

    const lines = (content as string).split("\n");
    const children = lines
      .filter(l => l.trim() !== "")
      .map(line => {
        const todoMatch = line.match(/^- \[(x| )\] (.+)/);
        if (todoMatch) {
          return {
            object: "block", type: "to_do",
            to_do: { rich_text: [{ type: "text", text: { content: todoMatch[2] } }], checked: todoMatch[1] === "x" },
          };
        }
        return {
          object: "block", type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: line } }] },
        };
      });

    const properties: Record<string, unknown> = {
      Name: { title: [{ text: { content: (content as string).split("\n")[0].slice(0, 100) } }] },
    };
    if (folderProp && folder) properties[folderProp] = { select: { name: folder } };
    if (pinnedProp)   properties[pinnedProp]   = { checkbox: false };
    if (importantProp) properties[importantProp] = { checkbox: false };

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ parent: { database_id: databaseId }, properties, children }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    return NextResponse.json({ id: data.id });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
