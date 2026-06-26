(function () {
  const boardEl = document.getElementById("board");
  const contestantsEl = document.getElementById("contestants");
  const buzzerDock = document.getElementById("buzzerDock");
  const playBottom = document.getElementById("playBottom");
  const overlay = document.getElementById("overlay");
  const clueCard = document.getElementById("clueCard");
  const clueMeta = document.getElementById("clueMeta");
  const clueText = document.getElementById("clueText");
  const clueAnswer = document.getElementById("clueAnswer");
  const audioCountdown = document.getElementById("audioCountdown");
  const audioPlayerBar = document.getElementById("audioPlayerBar");
  const audioVolume = document.getElementById("audioVolume");

  const isPlayer = RoomSession.isPlayer();
  const myId = RoomSession.getPlayerId();
  let latestState = null;
  let lastBuzzerKey = "";
  let lastClueKey = "";
  let pendingBuzz = null;
  const celebratedGoldenBuzzes = new Set();

  function fireGoldenConfetti() {
    if (window.GoldenConfetti) {
      window.GoldenConfetti.burst();
    }
  }

  Game.onState((state) => {
    latestState = state;
    checkGoldenConfetti(state);
    render(state);
  });

  function checkGoldenConfetti(state) {
    const active = state.game.active;
    if (!active) {
      lastClueKey = "";
      celebratedGoldenBuzzes.clear();
      return;
    }

    const clueKey = `${active.cat}-${active.row}`;
    if (clueKey !== lastClueKey) {
      lastClueKey = clueKey;
      celebratedGoldenBuzzes.clear();
    }

    const buzzes = state.game.buzzes || [];
    buzzes.forEach((b) => {
      if (!b.golden) return;
      const key = `${clueKey}:${b.playerId}:${b.at}`;
      if (celebratedGoldenBuzzes.has(key)) return;
      celebratedGoldenBuzzes.add(key);
      fireGoldenConfetti();
    });
  }

  if (audioVolume && window.ClueAudio) {
    const stored = ClueAudio.getVolume();
    audioVolume.value = String(Math.round(stored * 100));
    audioVolume.addEventListener("input", () => {
      ClueAudio.setVolume(Number(audioVolume.value) / 100);
    });
  }

  if (buzzerDock) {
    buzzerDock.addEventListener("click", (e) => {
      const goldenBtn = e.target.closest(".golden-buzzer-btn");
      if (goldenBtn && !goldenBtn.disabled) {
        goldenBtn.disabled = true;
        pendingBuzz = "golden";
        if (latestState) renderBuzzerDock(latestState);
        Game.send({ type: "goldenBuzz" });
        return;
      }
      const btn = e.target.closest(".buzzer-btn");
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      pendingBuzz = "buzz";
      if (latestState) renderBuzzerDock(latestState);
      Game.send({ type: "buzz" });
    });
  }

  function render(state) {
    const { settings, game } = state;
    if (window.ScoreEffects) ScoreEffects.trackScores(state);
    document.title = (settings.title || "Jeopardy") + " — Board";

    const cols = settings.categories.length;
    const isPlayLayout = !!document.querySelector(".play-layout");
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    if (isPlayLayout) {
      boardEl.style.gridTemplateRows = `minmax(56px, 1fr) repeat(${settings.rows}, 1fr)`;
    } else {
      boardEl.style.gridTemplateRows = "";
    }
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
          "tile readonly" +
          (used ? " used" : "") +
          (!hasContent ? " empty" : "");
        if (isActive) tile.classList.add("active-tile");

        const v = document.createElement("div");
        v.className = "value";
        v.textContent = "$" + (settings.values[r] ?? 0);
        tile.appendChild(v);
        boardEl.appendChild(tile);
      });
    }

    renderContestants(state);
    renderBuzzerDock(state);
    renderOverlay(state);
  }

  function renderContestants(state) {
    const players = state.players || [];
    const buzzes = state.game.buzzes || [];
    const firstBuzz = buzzes[0];

    contestantsEl.innerHTML = "";

    players.forEach((c) => {
      const box = document.createElement("div");
      box.className = "contestant";
      box.dataset.playerId = c.id;

      const buzzIdx = buzzes.findIndex((b) => b.playerId === c.id);
      const buzz = buzzIdx >= 0 ? buzzes[buzzIdx] : null;

      if (buzz) {
        box.classList.add("buzzed");
        if (buzzIdx === 0) box.classList.add("buzz-first");
        if (buzz.golden) box.classList.add("buzz-golden");
      }

      const name = document.createElement("div");
      name.className = "c-name";
      name.textContent = c.name || "";

      const score = document.createElement("div");
      score.className = "c-score" + (c.score < 0 ? " neg" : "");
      score.textContent = formatMoney(c.score);

      box.appendChild(name);
      box.appendChild(score);

      if (buzz && firstBuzz) {
        const tag = document.createElement("div");
        tag.className = "buzz-tag" + (buzz.golden ? " golden" : "");
        if (buzzIdx === 0) {
          tag.textContent = buzz.golden ? "FIRST! (GOLD)" : "FIRST!";
        } else {
          tag.textContent =
            formatDelay(buzz.at - firstBuzz.at) +
            (buzz.golden ? " · GOLD" : "");
        }
        box.appendChild(tag);
      }

      contestantsEl.appendChild(box);
    });

    if (window.ScoreEffects) ScoreEffects.flush(contestantsEl);
  }

  function renderBuzzerDock(state) {
    if (!buzzerDock) return;

    const active = !!state.game.active;
    const buzzes = state.game.buzzes || [];
    const myBuzzIdx = buzzes.findIndex((b) => b.playerId === myId);

    if (!active) {
      pendingBuzz = null;
    } else if (myBuzzIdx >= 0) {
      pendingBuzz = null;
    }

    const goldenEnabled = !!state.settings.goldenBuzzerEnabled;
    const goldenSpent = !!(state.game.goldenUsed && state.game.goldenUsed[myId]);
    const buzzerKey = `${active}:${myBuzzIdx}:${buzzes.length}:${goldenEnabled}:${goldenSpent}:${pendingBuzz}`;
    if (buzzerKey === lastBuzzerKey) return;
    lastBuzzerKey = buzzerKey;

    buzzerDock.innerHTML = "";

    if (!active || !isPlayer) return;

    const firstBuzz = buzzes[0];
    const myBuzz = myBuzzIdx >= 0 ? buzzes[myBuzzIdx] : null;

    if (myBuzz && firstBuzz) {
      const status = document.createElement("div");
      status.className =
        "buzzer-status" + (myBuzzIdx === 0 ? " first" : "");
      let msg =
        myBuzzIdx === 0
          ? "You buzzed in first!"
          : "You buzzed " + formatDelay(myBuzz.at - firstBuzz.at) + " later";
      if (myBuzz.golden) {
        msg += " Golden buzzer — 2× if you score on this clue!";
      }
      status.textContent = msg;
      buzzerDock.appendChild(status);
      return;
    }

    if (pendingBuzz) {
      const status = document.createElement("div");
      status.className = "buzzer-status";
      status.textContent =
        pendingBuzz === "golden"
          ? "Golden buzz sent…"
          : "Buzz sent…";
      buzzerDock.appendChild(status);
      return;
    }

    const row = document.createElement("div");
    row.className = "buzzer-buttons";

    if (goldenEnabled && !goldenSpent) {
      const goldenBtn = document.createElement("button");
      goldenBtn.className = "btn golden-buzzer-btn";
      goldenBtn.textContent = "GOLD!";
      goldenBtn.title = "One-time use — doubles your points on this clue if scored";
      row.appendChild(goldenBtn);
    }

    const buzzBtn = document.createElement("button");
    buzzBtn.className = "btn buzzer-btn";
    buzzBtn.textContent = "BUZZ!";
    row.appendChild(buzzBtn);

    buzzerDock.appendChild(row);
  }

  function renderOverlay(state) {
    const active = state.game.active;
    if (!active) {
      ClueAudio.teardown();
      overlay.classList.remove("show");
      clueCard?.classList.remove("golden-buzz");
      playBottom?.classList.remove("has-clue");
      if (audioCountdown) audioCountdown.classList.remove("show");
      if (audioPlayerBar) audioPlayerBar.style.display = "none";
      return;
    }
    const cat = state.settings.categories[active.cat];
    const clue = cat && cat.clues[active.row];
    if (!clue) {
      ClueAudio.teardown();
      overlay.classList.remove("show");
      clueCard?.classList.remove("golden-buzz");
      playBottom?.classList.remove("has-clue");
      return;
    }

    const goldenBuzz = (state.game.buzzes || []).some((b) => b.golden);
    clueCard?.classList.toggle("golden-buzz", goldenBuzz);

    clueMeta.textContent = `${cat.name || ""} — $${state.settings.values[active.row] ?? 0}`;

    const showQuestion =
      RoomSession.isHost() || state.game.showQuestionToPlayers !== false;

    const isAudio = ClueAudio.isAudioClue(clue);
    if (audioPlayerBar) {
      audioPlayerBar.style.display = isAudio ? "flex" : "none";
    }

    if (isAudio) {
      ClueAudio.handleState(state, clueText, audioCountdown, {
        isHost: RoomSession.isHost(),
      });
    } else {
      ClueAudio.teardown();
      if (audioCountdown) audioCountdown.classList.remove("show");
      const block = document.getElementById("audioCountdownBlock");
      if (block) block.classList.remove("show");
      clueText.classList.remove("hidden-clue");
      ClueMedia.renderInto(clueText, clue, {
        hidden: !showQuestion,
      });
    }

    const answerText =
      state.activeAnswer ||
      (RoomSession.isHost() &&
      state.game.showAnswerToPlayers &&
      clue.answer
        ? clue.answer
        : null);

    if (clueAnswer) {
      if (answerText) {
        clueAnswer.textContent = answerText;
        clueAnswer.style.display = "block";
      } else {
        clueAnswer.textContent = "";
        clueAnswer.style.display = "none";
      }
    }

    overlay.classList.add("show");
    playBottom?.classList.add("has-clue");
  }

  function formatMoney(n) {
    const neg = n < 0;
    const abs = Math.abs(n).toLocaleString("en-US");
    return (neg ? "-$" : "$") + abs;
  }

  function formatDelay(ms) {
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(2) + "s";
  }
})();
