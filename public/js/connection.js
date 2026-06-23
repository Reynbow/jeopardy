// Room session (sessionStorage) + live sync via HTTP polling.
(function () {
  const KEYS = {
    code: "jeopardy_code",
    role: "jeopardy_role",
    hostSecret: "jeopardy_host_secret",
    playerId: "jeopardy_player_id",
    playerName: "jeopardy_player_name",
  };

  window.RoomSession = {
    getCode() {
      return sessionStorage.getItem(KEYS.code);
    },
    isHost() {
      return sessionStorage.getItem(KEYS.role) === "host";
    },
    isPlayer() {
      return sessionStorage.getItem(KEYS.role) === "player";
    },
    getHostSecret() {
      return sessionStorage.getItem(KEYS.hostSecret);
    },
    getPlayerId() {
      return sessionStorage.getItem(KEYS.playerId);
    },
    getPlayerName() {
      return sessionStorage.getItem(KEYS.playerName);
    },
    clear() {
      Object.values(KEYS).forEach((k) => sessionStorage.removeItem(k));
    },
  };

  const POLL_MS = 400;
  let pollTimer = null;
  let stateHandler = null;

  function authQuery() {
    const params = new URLSearchParams();
    if (RoomSession.isHost()) {
      const secret = RoomSession.getHostSecret();
      if (secret) params.set("hostSecret", secret);
    } else if (RoomSession.getPlayerId()) {
      params.set("playerId", RoomSession.getPlayerId());
    }
    return params;
  }

  async function fetchState() {
    const code = RoomSession.getCode();
    if (!code) return;
    const qs = authQuery().toString();
    const url = `/api/rooms/${code}${qs ? `?${qs}` : ""}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.state && stateHandler) {
        stateHandler(data.state);
      }
    } catch {
      /* retry on next poll */
    }
  }

  function startPolling() {
    if (pollTimer) return;
    fetchState();
    pollTimer = setInterval(fetchState, POLL_MS);
  }

  async function send(obj) {
    const code = RoomSession.getCode();
    if (!code) return;
    const body = { ...obj };
    if (RoomSession.isHost()) body.hostSecret = RoomSession.getHostSecret();
    if (RoomSession.getPlayerId()) body.playerId = RoomSession.getPlayerId();

    try {
      const res = await fetch(`/api/rooms/${code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state && stateHandler) stateHandler(data.state);
      }
    } catch {
      /* next poll will recover */
    }
    fetchState();
  }

  window.Game = {
    onState(fn) {
      stateHandler = fn;
      fetchState();
      startPolling();
    },
    send,
    refresh: fetchState,
  };

  if (RoomSession.getCode()) startPolling();
})();
