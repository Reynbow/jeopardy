import { NextResponse } from "next/server";
import { toClientState } from "@/lib/client-state";
import { isValidRoomCode } from "@/lib/codes";
import { joinRoom } from "@/lib/rooms";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upper = code.toUpperCase();

  if (!isValidRoomCode(upper)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  let body: { name?: string; clientId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const result = await joinRoom(upper, name, body.clientId);

  if (!result) {
    return NextResponse.json({ error: "Could not join room" }, { status: 404 });
  }

  return NextResponse.json({
    playerId: result.playerId,
    code: result.room.code,
    state: toClientState(result.room, false),
  });
}
