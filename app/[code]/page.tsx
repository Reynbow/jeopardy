"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/codes";

export default function JoinRoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = normalizeRoomCode(String(params.code || ""));
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [roomTitle, setRoomTitle] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!isValidRoomCode(code)) {
      router.replace("/");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`);
        if (res.status === 404) {
          setError("Room not found. Check the code and try again.");
          setChecking(false);
          return;
        }
        const data = await res.json();
        setRoomTitle(data.title || "Jeopardy");
        setChecking(false);
      } catch {
        setError("Could not reach the server.");
        setChecking(false);
      }
    })();
  }, [code, router]);

  async function join() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name.");
      return;
    }
    setJoining(true);
    setError("");
    try {
      const clientId = sessionStorage.getItem("jeopardy_player_id") || undefined;
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, clientId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Join failed");
      }
      const data = await res.json();
      sessionStorage.setItem("jeopardy_code", data.code);
      sessionStorage.setItem("jeopardy_role", "player");
      sessionStorage.setItem("jeopardy_player_id", data.playerId);
      sessionStorage.setItem("jeopardy_player_name", trimmed);
      sessionStorage.removeItem("jeopardy_host_secret");
      router.push("/play");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
      setJoining(false);
    }
  }

  if (!isValidRoomCode(code)) return null;

  if (checking) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <p className="lobby-sub">Checking room {code}…</p>
        </div>
      </div>
    );
  }

  if (error && !roomTitle) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <p className="lobby-error">{error}</p>
          <button className="btn lobby-btn" onClick={() => router.push("/")}>
            Back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1 className="lobby-title">Join {roomTitle}</h1>
        <p className="lobby-sub">
          Room code: <strong className="room-code-display">{code}</strong>
        </p>
        <input
          type="text"
          className="lobby-name-input"
          placeholder="Your name"
          maxLength={32}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          autoFocus
        />
        <button
          className="btn gold lobby-btn"
          onClick={join}
          disabled={joining}
        >
          {joining ? "Joining…" : "Join game"}
        </button>
        {error && <p className="lobby-error">{error}</p>}
      </div>
    </div>
  );
}
