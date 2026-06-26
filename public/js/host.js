(function () {
  const boardEl = document.getElementById("board");
  const answerBox = document.getElementById("answerBox");
  const scoresEl = document.getElementById("scores");

  let latest = null;
  let lastAnswerKey = "";

  Game.onState((state) => {
    latest = state;
    render(state);
  });

  function render(state) {
    const { settings, game } = state;
    if (window.ScoreEffects) ScoreEffects.trackScores(state);
    document.title = (settings.title || "Jeopardy") + " — Host";

    const cols = settings.categories.length;
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    boardEl.innerHTML = "";

    settings.categories.forEach((cat) => {
      const cell = document.createElement("div");
      cell.className = "cat-cell";
      cell.textContent = cat.name || "";
      boardEl.appendChild(cell);
    });

    for (let r = 0; r < settings.rows; r++) {
      settings.categories.forEach((cat, c) => {
        const clue = cat.clues[r] || { question: "", answer: "" };
        const tile = document.createElement("div");
        const key = `${c}-${r}`;
        const used = !!game.revealed[key];
        const hasContent = ClueMedia.hasContent(clue);
        const isActive =
          game.active && game.active.cat === c && game.active.row === r;

        tile.className =
          "tile" + (used ? " used" : "") + (!hasContent ? " empty" : "");
        if (isActive) tile.style.outline = "3px solid var(--gold-bright)";
        tile.dataset.cat = String(c);
        tile.dataset.row = String(r);

        const v = document.createElement("div");
        v.className = "value";
        v.textContent = "$" + (settings.values[r] ?? 0);
        tile.appendChild(v);

        boardEl.appendChild(tile);
      });
    }

    renderAnswer(state);
    renderScores(state);
    renderBuzzPanel(state);
    renderGoldenDoubleBanner(state);
    renderAudioHostPanel(state);
    updateShowQuestionBtn(state);
    updateShowAnswerBtn(state);
  }

  function updateShowQuestionBtn(state) {
    const btn = document.getElementById("showQuestionBtn");
    if (!btn) return;
    const active = !!state.game.active;
    btn.style.display = active ? "inline-block" : "none";
    btn.disabled = !active || state.game.showQuestionToPlayers !== false;
  }

  function updateShowAnswerBtn(state) {
    const btn = document.getElementById("showAnswerBtn");
    if (!btn) return;
    const active = !!state.game.active;
    btn.style.display = active ? "inline-block" : "none";
    btn.disabled = !active || !!state.game.showAnswerToPlayers;
  }

  function hasGoldenBuzz(state) {
    return (state.game.buzzes || []).some((b) => b.golden);
  }

  function renderBuzzPanel(state) {
    const panel = document.getElementById("buzzPanel");
    if (!panel) return;

    const buzzes = state.game.buzzes || [];
    if (!buzzes.length || !state.game.active) {
      panel.innerHTML = "";
      panel.style.display = "none";
      return;
    }

    panel.style.display = "block";
    panel.innerHTML = "<h3>Buzz order</h3>";
    const list = document.createElement("div");
    list.className = "buzz-list";

    const first = buzzes[0];
    const players = state.players || [];

    buzzes.forEach((b, i) => {
      const p = players.find((pl) => pl.id === b.playerId);
      const row = document.createElement("div");
      row.className =
        "buzz-list-row" +
        (i === 0 ? " first" : "") +
        (b.golden ? " golden" : "");
      const name = document.createElement("span");
      name.textContent = (p ? p.name : "Unknown") + (b.golden ? " ★" : "");
      const time = document.createElement("span");
      time.className = "buzz-list-time";
      time.textContent =
        i === 0
          ? b.golden
            ? "1st · GOLD"
            : "1st"
          : formatDelay(b.at - first.at) + (b.golden ? " · GOLD" : "");
      row.appendChild(name);
      row.appendChild(time);
      list.appendChild(row);
    });

    panel.appendChild(list);
  }

  function hasGoldenBuzz(state, playerId) {
    return (state.game.buzzes || []).some(
      (b) => b.playerId === playerId && b.golden
    );
  }

  function renderGoldenDoubleBanner(state) {
    const banner = document.getElementById("goldenDoubleBanner");
    if (!banner) return;

    const buzzes = state.game.buzzes || [];
    const goldenBuzzes = buzzes.filter((b) => b.golden);
    if (!goldenBuzzes.length || !state.game.active) {
      banner.style.display = "none";
      banner.textContent = "";
      return;
    }

    const players = state.players || [];
    const names = goldenBuzzes
      .map((b) => players.find((p) => p.id === b.playerId)?.name || "Unknown")
      .filter((n, i, arr) => arr.indexOf(n) === i);

    banner.style.display = "block";
    banner.textContent =
      names.length === 1
        ? `${names[0]} earns 2× if scored on this clue`
        : `${names.join(", ")} earn 2× if scored on this clue`;
  }

  function renderAudioHostPanel(state) {
    const panel = document.getElementById("audioHostPanel");
    const list = document.getElementById("audioCacheList");
    const playBtn = document.getElementById("playAudioBtn");
    const pauseBtn = document.getElementById("pauseAudioBtn");
    const restartBtn = document.getElementById("restartAudioBtn");
    if (!panel || !list) return;

    const active = state.game.active;
    let clue = null;
    if (active) {
      const cat = state.settings.categories[active.cat];
      clue = cat && cat.clues[active.row];
    }

    if (!ClueAudio.isAudioClue(clue)) {
      panel.style.display = "none";
      return;
    }

    panel.style.display = "block";
    list.innerHTML = "";

    const cache = state.game.audioCache || {};
    const players = state.players || [];

    if (!players.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "No players joined yet.";
      list.appendChild(empty);
    }

    players.forEach((p) => {
      const entry = cache[p.id] || { percent: 0, ready: false };
      const row = document.createElement("div");
      row.className = "audio-cache-row";

      const name = document.createElement("span");
      name.className = "audio-cache-name";
      name.textContent = p.name || "Player";

      const bar = document.createElement("div");
      bar.className = "audio-cache-bar";
      const fill = document.createElement("div");
      fill.className = "audio-cache-bar-fill";
      fill.style.width = entry.percent + "%";
      bar.appendChild(fill);

      const pct = document.createElement("span");
      pct.className = "audio-cache-pct";
      pct.textContent = entry.ready ? "Ready" : entry.percent + "%";

      row.appendChild(name);
      row.appendChild(bar);
      row.appendChild(pct);
      list.appendChild(row);
    });

    const playAt = state.game.audioPlayAt;
    const paused = !!state.game.audioPaused;

    if (playBtn) {
      playBtn.style.display = !playAt ? "inline-block" : "none";
    }
    if (pauseBtn) {
      pauseBtn.style.display = playAt && !paused ? "inline-block" : "none";
    }
    if (restartBtn) {
      restartBtn.style.display = playAt ? "inline-block" : "none";
    }
  }

  function formatDelay(ms) {
    if (ms < 1000) return "+" + ms + "ms";
    return "+" + (ms / 1000).toFixed(2) + "s";
  }

  function renderAnswer(state) {
    const active = state.game.active;
    if (!active) {
      lastAnswerKey = "";
      ClueAudio.teardown();
      answerBox.classList.remove("golden-buzz");
      answerBox.innerHTML =
        '<div class="ab-empty">No clue selected. Click a tile on the board (here or on the main screen).</div>';
      return;
    }
    const cat = state.settings.categories[active.cat];
    const clue = cat && cat.clues[active.row];
    if (!clue) {
      lastAnswerKey = "";
      answerBox.classList.remove("golden-buzz");
      answerBox.innerHTML = '<div class="ab-empty">Clue unavailable.</div>';
      return;
    }

    answerBox.classList.toggle("golden-buzz", hasGoldenBuzz(state));

    const key = `${active.cat}-${active.row}`;
    const isAudio = ClueAudio.isAudioClue(clue);

    if (isAudio && key === lastAnswerKey && answerBox.querySelector(".ab-q")) {
      answerBox.classList.toggle("golden-buzz", hasGoldenBuzz(state));
      const q = answerBox.querySelector(".ab-q");
      const countdown = answerBox.querySelector(".audio-countdown");
      ClueAudio.handleState(state, q, countdown, { isHost: true });
      return;
    }

    lastAnswerKey = isAudio ? key : "";

    const val = state.settings.values[active.row] ?? 0;
    answerBox.innerHTML = "";
    const head = document.createElement("div");
    head.className = "ab-cat";
    head.textContent = `${cat.name || ""} — $${val}`;
    const q = document.createElement("div");
    q.className = "ab-q";

    const countdown = document.createElement("div");
    countdown.className = "audio-countdown";

    const a = document.createElement("div");
    a.className = "ab-a";
    a.textContent = "Answer: " + (clue.answer || "(no answer set)");

    answerBox.appendChild(head);
    answerBox.appendChild(q);
    answerBox.appendChild(countdown);
    answerBox.appendChild(a);

    if (ClueAudio.isAudioClue(clue)) {
      ClueAudio.handleState(state, q, countdown, { isHost: true });
    } else {
      ClueAudio.teardown();
      ClueMedia.renderInto(q, clue);
      if (!ClueMedia.hasContent(clue)) {
        q.textContent = "(no clue content)";
      }
    }
  }

  function renderScores(state) {
    const active = state.game.active;
    const val = active ? state.settings.values[active.row] ?? 0 : 0;
    scoresEl.innerHTML = "";

    const players = state.players || [];
    players.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "score-row";
      row.dataset.index = String(i);
      row.dataset.playerId = c.id;

      const name = document.createElement("div");
      name.className = "sr-name";
      name.textContent = c.name || "";

      const score = document.createElement("input");
      score.type = "number";
      score.className = "sr-score";
      score.value = c.score;

      const buttons = document.createElement("div");
      buttons.className = "score-buttons";

      if (active && val) {
        const isDouble = hasGoldenBuzz(state, c.id);
        const displayVal = isDouble ? val * 2 : val;
        const correct = document.createElement("button");
        correct.className = "btn small correct" + (isDouble ? " golden-double" : "");
        correct.textContent = "+$" + displayVal;
        correct.title = isDouble
          ? "Correct answer (golden 2×)"
          : "Correct answer";

        const wrong = document.createElement("button");
        wrong.className = "btn small wrong" + (isDouble ? " golden-double" : "");
        wrong.textContent = "-$" + displayVal;
        wrong.title = isDouble
          ? "Wrong answer (golden 2×)"
          : "Wrong answer";

        buttons.appendChild(correct);
        buttons.appendChild(wrong);
      }

      row.appendChild(name);
      row.appendChild(score);
      row.appendChild(buttons);

      const kick = document.createElement("button");
      kick.className = "btn small danger kick-btn";
      kick.textContent = "Kick";
      kick.title = "Remove from game";
      row.appendChild(kick);

      scoresEl.appendChild(row);
    });

    if (window.ScoreEffects) ScoreEffects.flush(scoresEl);
  }

  boardEl.addEventListener("click", (e) => {
    const tile = e.target.closest(".tile:not(.used):not(.empty)");
    if (!tile) return;
    const cat = Number(tile.dataset.cat);
    const row = Number(tile.dataset.row);
    if (!Number.isInteger(cat) || !Number.isInteger(row)) return;
    Game.send({ type: "reveal", cat, row });
  });

  scoresEl.addEventListener("click", (e) => {
    const rowEl = e.target.closest(".score-row");
    if (!rowEl) return;
    const index = Number(rowEl.dataset.index);
    const playerId = rowEl.dataset.playerId;
    if (!Number.isInteger(index) || !playerId) return;

    if (e.target.closest(".kick-btn")) {
      const label = rowEl.querySelector(".sr-name")?.textContent || "this player";
      if (confirm(`Remove ${label} from the game?`)) {
        Game.send({ type: "kickPlayer", targetPlayerId: playerId });
      }
      return;
    }

    const active = latest?.game.active;
    const val = active ? latest.settings.values[active.row] ?? 0 : 0;
    if (e.target.closest(".btn.correct")) {
      Game.send({ type: "adjustScore", index, delta: val });
    } else if (e.target.closest(".btn.wrong")) {
      Game.send({ type: "adjustScore", index, delta: -val });
    }
  });

  scoresEl.addEventListener("change", (e) => {
    if (!e.target.matches(".sr-score")) return;
    const rowEl = e.target.closest(".score-row");
    if (!rowEl) return;
    const index = Number(rowEl.dataset.index);
    if (!Number.isInteger(index)) return;
    Game.send({ type: "setScore", index, value: Number(e.target.value) });
  });

  document
    .getElementById("closeBtn")
    .addEventListener("click", () => Game.send({ type: "closeClue" }));
  document
    .getElementById("showQuestionBtn")
    ?.addEventListener("click", () => Game.send({ type: "showQuestion" }));
  document
    .getElementById("showAnswerBtn")
    ?.addEventListener("click", () => Game.send({ type: "showAnswer" }));
  document.getElementById("playAudioBtn")?.addEventListener("click", () => {
    Game.send({ type: "startAudio" });
  });
  document.getElementById("pauseAudioBtn")?.addEventListener("click", () => {
    Game.send({ type: "pauseAudio" });
  });
  document.getElementById("restartAudioBtn")?.addEventListener("click", () => {
    Game.send({ type: "restartAudio" });
  });
  document
    .getElementById("resetGameBtn")
    .addEventListener("click", () => {
      if (confirm("Reset the board? All tiles will be playable again."))
        Game.send({ type: "resetGame" });
    });
  document
    .getElementById("resetScoresBtn")
    .addEventListener("click", () => {
      if (confirm("Reset all scores to 0?"))
        Game.send({ type: "resetScores" });
    });
  document.getElementById("newGameBtn").addEventListener("click", () => {
    if (confirm("Start a new game? Board and scores will reset."))
      Game.send({ type: "newGame" });
  });

  // Share link + room code for players
  const code = RoomSession.getCode();
  if (code) {
    const shareLink = document.getElementById("shareLink");
    const shareCode = document.getElementById("shareCode");
    const joinUrl = `${location.origin}/${code}`;
    if (shareLink) shareLink.value = joinUrl;
    if (shareCode) shareCode.textContent = code;
    const badge = document.getElementById("roomBadge");
    if (badge) badge.textContent = `· ${code}`;
    document.getElementById("copyLinkBtn")?.addEventListener("click", () => {
      navigator.clipboard.writeText(joinUrl).catch(() => {
        shareLink?.select();
      });
    });
  }
})();
