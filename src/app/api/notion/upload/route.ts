import { NextRequest, NextResponse } from "next/server";

const N_VER = "2022-06-28";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = formData.get("token") as string;
    const file = formData.get("file") as File | null;

    if (!token || !file) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    // Step 1: Create file upload slot
    const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": N_VER,
      },
      body: JSON.stringify({ mode: "single_part" }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) return NextResponse.json({ error: createData.message ?? "Upload init failed" }, { status: createRes.status });

    const uploadId = createData.id as string;

    // Step 2: Send the file
    const upload = new FormData();
    upload.append("file", file, file.name || "image.png");

    const sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${uploadId}/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": N_VER,
      },
      body: upload,
    });
    const sendData = await sendRes.json();
    if (!sendRes.ok) return NextResponse.json({ error: sendData.message ?? "Upload failed" }, { status: sendRes.status });

    return NextResponse.json({ uploadId });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
