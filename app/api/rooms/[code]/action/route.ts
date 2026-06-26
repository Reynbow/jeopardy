import { NextResponse } from "next/server";
import { toClientState } from "@/lib/client-state";
import { isValidRoomCode } from "@/lib/codes";
import { handleAction, type ActionMessage } from "@/lib/rooms";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upper = code.toUpperCase();

  if (!isValidRoomCode(upper)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  let body: ActionMessage & { hostSecret?: string; playerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { hostSecret, playerId, ...msg } = body;
  const result = await handleAction(upper, msg as ActionMessage, {
    hostSecret,
    playerId,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error || "Failed",
        ...(result.kicked ? { kicked: true } : {}),
      },
      { status: result.kicked ? 403 : 400 }
    );
  }

  if (!result.room) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const isHost = !!hostSecret && hostSecret === result.room.hostSecret;
  return NextResponse.json({
    state: toClientState(result.room, isHost),
  });
}
