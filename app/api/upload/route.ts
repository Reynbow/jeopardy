import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isValidRoomCode } from "@/lib/codes";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { registerUploadedMedia } from "@/lib/media";
import { getRoom } from "@/lib/rooms";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
];

// Files upload directly from the browser to Vercel Blob. This route only
// mints a short-lived, scoped upload token (and records the URL when done),
// so the upload bypasses Vercel's 4.5 MB serverless request body limit.
export async function POST(req: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Uploads are not configured on this server" },
      { status: 500 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let payload: { code?: string; hostSecret?: string } = {};
        try {
          payload = JSON.parse(clientPayload || "{}");
        } catch {
          throw new Error("Invalid upload request");
        }

        const code = String(payload.code || "").toUpperCase();
        const hostSecret = String(payload.hostSecret || "");

        if (!isValidRoomCode(code)) throw new Error("Invalid room code");

        const room = await getRoom(code);
        if (!room || room.hostSecret !== hostSecret) {
          throw new Error("Host only");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ code }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const { code } = JSON.parse(tokenPayload || "{}");
          if (code) await registerUploadedMedia(code, blob.url);
        } catch {
          /* best-effort; settings save also registers media */
        }
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
