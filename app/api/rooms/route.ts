import { NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms";

export async function POST() {
  const { code, hostSecret } = await createRoom();
  return NextResponse.json({ code, hostSecret });
}
