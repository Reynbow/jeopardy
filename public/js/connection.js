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

  const POLL_IDLE_MS = 1400;
  const POLL_ACTIVE_MS = 550;
  const POLL_BURST_MS = 280;
  const POLL_BURST_COUNT = 4;

  let pollTimer = null;
  let stateHandler = null;
  let lastRevision = -1;
  let lastStateJson = "";
  let fetchInFlight = false;
  let pollDelayMs = POLL_IDLE_MS;
  let hasActiveClue = false;
  let burstPollsLeft = 0;

  function deliverState(state, { fromAction = false } = {}) {
    if (!state || !stateHandler) return;
    const rev = typeof state.revision === "number" ? state.revision : 0;
    if (!fromAction && rev < lastRevision) return;
    const json = JSON.stringify(state);
    if (!fromAction && rev === lastRevision && json === lastStateJson) return;
    lastRevision = Math.max(lastRevision, rev);
    lastStateJson = json;
    hasActiveClue = !!state.game?.active;
    pollDelayMs = hasActiveClue ? POLL_ACTIVE_MS : POLL_IDLE_MS;
    stateHandler(state);
  }

  function authQuery() {
    const params = new URLSearchParams();
    if (RoomSession.isHost()) {
      const secret = RoomSession.getHostSecret();
      if (secret) params.set("hostSecret", secret);
    } else if (RoomSession.getPlayerId()) {
      params.set("playerId", RoomSession.getPlayerId());
    }
    if (lastRevision >= 0) {
      params.set("since", String(lastRevision));
    }
    return params;
  }

  function schedulePoll(delay) {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(() => {
      pollTimer = null;
      fetchState();
    }, delay);
  }

  function nextPollDelay() {
    if (burstPollsLeft > 0) {
      burstPollsLeft--;
      return POLL_BURST_MS;
    }
    return pollDelayMs;
  }

  async function fetchState() {
    if (fetchInFlight) {
      schedulePoll(nextPollDelay());
      return;
    }

    const code = RoomSession.getCode();
    if (!code) return;

    fetchInFlight = true;
    const qs = authQuery().toString();
    const url = `/api/rooms/${code}${qs ? `?${qs}` : ""}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.kicked && RoomSession.isPlayer()) {
        RoomSession.clear();
        sessionStorage.setItem("jeopardy_kicked", "1");
        window.location.href = "/";
        return;
      }
      if (data.unchanged) {
        if (typeof data.revision === "number") {
          lastRevision = Math.max(lastRevision, data.revision);
        }
        return;
      }
      if (data.state) deliverState(data.state);
    } catch {
      /* retry on next poll */
    } finally {
      fetchInFlight = false;
      if (RoomSession.getCode()) {
        schedulePoll(nextPollDelay());
      }
    }
  }

  function startPolling() {
    if (pollTimer) return;
    fetchState();
  }

  function kickBurstPoll() {
    burstPollsLeft = POLL_BURST_COUNT;
    if (!fetchInFlight) {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
      fetchState();
    }
  }

  async function send(obj) {
    const code = RoomSession.getCode();
    if (!code) return;
    const body = { ...obj };
    if (RoomSession.isHost()) body.hostSecret = RoomSession.getHostSecret();
    if (RoomSession.getPlayerId()) body.playerId = RoomSession.getPlayerId();

    kickBurstPoll();

    try {
      const res = await fetch(`/api/rooms/${code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) deliverState(data.state, { fromAction: true });
        kickBurstPoll();
        return;
      }
      if (res.status === 403 && RoomSession.isPlayer()) {
        RoomSession.clear();
        sessionStorage.setItem("jeopardy_kicked", "1");
        window.location.href = "/";
      }
    } catch {
      /* burst polls will recover */
    }
  }

  window.Game = {
    onState(fn) {
      stateHandler = fn;
      lastRevision = -1;
      lastStateJson = "";
      burstPollsLeft = 0;
      startPolling();
    },
    send,
    refresh: fetchState,
  };

  if (RoomSession.getCode()) startPolling();
})();
