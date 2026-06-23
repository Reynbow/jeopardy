"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeRoomCode } from "@/lib/codes";

export default function LobbyPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createGame() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) throw new Error("Could not create room");
      const { code, hostSecret } = await res.json();
      sessionStorage.setItem("jeopardy_code", code);
      sessionStorage.setItem("jeopardy_role", "host");
      sessionStorage.setItem("jeopardy_host_secret", hostSecret);
      sessionStorage.removeItem("jeopardy_player_id");
      sessionStorage.removeItem("jeopardy_player_name");
      router.push("/host");
    } catch {
      setError("Failed to create a room. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function goJoin(code?: string) {
    const normalized = normalizeRoomCode(code ?? joinCode);
    if (normalized.length !== 6) {
      setError("Enter a 6-character room code.");
      return;
    }
    setError("");
    router.push(`/${normalized}`);
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1 className="lobby-title">JEOPARDY!</h1>
        <p className="lobby-sub">Host a game or join with a room code</p>

        <button
          className="btn gold lobby-btn"
          onClick={createGame}
          disabled={loading}
        >
          {loading ? "Creating…" : "Create game (host)"}
        </button>

        <div className="lobby-divider">
          <span>or join</span>
        </div>

        <div className="lobby-join">
          <input
            type="text"
            className="lobby-code-input"
            placeholder="ROOM CODE"
            maxLength={6}
            value={joinCode}
            onChange={(e) =>
              setJoinCode(normalizeRoomCode(e.target.value))
            }
            onKeyDown={(e) => e.key === "Enter" && goJoin()}
          />
          <button className="btn lobby-join-btn" onClick={() => goJoin()}>
            Join
          </button>
        </div>

        {error && <p className="lobby-error">{error}</p>}
      </div>
    </div>
  );
}
