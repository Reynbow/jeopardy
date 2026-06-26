import { NextResponse } from "next/server";
import { toClientState } from "@/lib/client-state";
import { isValidRoomCode } from "@/lib/codes";
import { getRoom } from "@/lib/rooms";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upper = code.toUpperCase();

  if (!isValidRoomCode(upper)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const room = await getRoom(upper);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const hostSecret = url.searchParams.get("hostSecret") || undefined;
  const playerId = url.searchParams.get("playerId") || undefined;
  const sinceRaw = url.searchParams.get("since");
  const sinceRev =
    sinceRaw !== null && sinceRaw !== "" ? parseInt(sinceRaw, 10) : null;

  const isHost = !!hostSecret && hostSecret === room.hostSecret;
  const isPlayer = !!playerId && room.players.some((p) => p.id === playerId);

  if (playerId && !isHost && !isPlayer) {
    return NextResponse.json({
      kicked: true,
      exists: true,
      code: room.code,
      title: room.settings.title,
    });
  }

  if (!isHost && !isPlayer) {
    return NextResponse.json({
      exists: true,
      code: room.code,
      title: room.settings.title,
      playerCount: room.players.length,
    });
  }

  const revision = room.revision ?? 0;
  if (
    sinceRev !== null &&
    Number.isFinite(sinceRev) &&
    sinceRev >= 0 &&
    sinceRev === revision
  ) {
    return NextResponse.json({
      unchanged: true,
      revision,
      serverTime: Date.now(),
    });
  }

  return NextResponse.json({
    state: toClientState(room, isHost),
    code: room.code,
    role: isHost ? "host" : "player",
  });
}
