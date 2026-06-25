import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { isValidRoomCode } from "@/lib/codes";
import { registerUploadedMedia } from "@/lib/media";
import { getRoom } from "@/lib/rooms";

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
]);

function extFor(type: string, name: string, isImage: boolean) {
  const fromName = path.extname(name);
  if (fromName) return fromName;
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/gif") return ".gif";
  if (type === "image/webp") return ".webp";
  if (type === "audio/mpeg" || type === "audio/mp3") return ".mp3";
  if (type === "audio/wav" || type === "audio/x-wav") return ".wav";
  if (type === "audio/ogg") return ".ogg";
  if (type === "audio/webm") return ".webm";
  return isImage ? ".jpg" : ".mp3";
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const code = String(form.get("code") || "").toUpperCase();
  const hostSecret = String(form.get("hostSecret") || "");
  const file = form.get("file");

  if (!isValidRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const room = await getRoom(code);
  if (!room || room.hostSecret !== hostSecret) {
    return NextResponse.json({ error: "Host only" }, { status: 403 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 8 MB)" },
      { status: 400 }
    );
  }

  const isImage = IMAGE_TYPES.has(file.type);
  const isAudio = AUDIO_TYPES.has(file.type);
  if (!isImage && !isAudio) {
    return NextResponse.json(
      { error: "Use JPEG, PNG, GIF, WebP, MP3, WAV, OGG, or WebM" },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extFor(file.type, file.name, isImage);
  const filename = `${randomUUID()}${ext}`;

  let url: string;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`jeopardy/${filename}`, buf, {
        access: "public",
        contentType: file.type || undefined,
      });
      url = blob.url;
    } catch {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } else {
    try {
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, filename), buf);
      url = `/uploads/${filename}`;
    } catch {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

  await registerUploadedMedia(code, url);
  return NextResponse.json({ url });
}
