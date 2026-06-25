(function () {
  const boardEl = document.getElementById("board");
  const contestantsEl = document.getElementById("contestants");
  const buzzerDock = document.getElementById("buzzerDock");
  const playBottom = document.getElementById("playBottom");
  const overlay = document.getElementById("overlay");
  const clueMeta = document.getElementById("clueMeta");
  const clueText = document.getElementById("clueText");
  const clueAnswer = document.getElementById("clueAnswer");
  const audioCountdown = document.getElementById("audioCountdown");

  const isPlayer = RoomSession.isPlayer();
  const myId = RoomSession.getPlayerId();
  let lastBuzzerKey = "";

  Game.onState((state) => {
    render(state);
  });

  if (buzzerDock) {
    buzzerDock.addEventListener("click", (e) => {
      const btn = e.target.closest(".buzzer-btn");
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      Game.send({ type: "buzz" });
    });
  }

  function render(state) {
    const { settings, game } = state;
    document.title = (settings.title || "Jeopardy") + " — Board";

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

      const buzzIdx = buzzes.findIndex((b) => b.playerId === c.id);
      const buzz = buzzIdx >= 0 ? buzzes[buzzIdx] : null;

      if (buzz) {
        box.classList.add("buzzed");
        if (buzzIdx === 0) box.classList.add("buzz-first");
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
        tag.className = "buzz-tag";
        if (buzzIdx === 0) {
          tag.textContent = "FIRST!";
        } else {
          tag.textContent = formatDelay(buzz.at - firstBuzz.at);
        }
        box.appendChild(tag);
      }

      contestantsEl.appendChild(box);
    });
  }

  function renderBuzzerDock(state) {
    if (!buzzerDock) return;

    const active = !!state.game.active;
    const buzzes = state.game.buzzes || [];
    const myBuzzIdx = buzzes.findIndex((b) => b.playerId === myId);
    const buzzerKey = `${active}:${myBuzzIdx}:${buzzes.length}`;
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
      status.textContent =
        myBuzzIdx === 0
          ? "You buzzed in first!"
          : "You buzzed " + formatDelay(myBuzz.at - firstBuzz.at) + " later";
      buzzerDock.appendChild(status);
      return;
    }

    const buzzBtn = document.createElement("button");
    buzzBtn.className = "btn buzzer-btn";
    buzzBtn.textContent = "BUZZ!";
    buzzerDock.appendChild(buzzBtn);
  }

  function renderOverlay(state) {
    const active = state.game.active;
    if (!active) {
      ClueAudio.teardown();
      overlay.classList.remove("show");
      playBottom?.classList.remove("has-clue");
      if (audioCountdown) audioCountdown.classList.remove("show");
      return;
    }
    const cat = state.settings.categories[active.cat];
    const clue = cat && cat.clues[active.row];
    if (!clue) {
      ClueAudio.teardown();
      overlay.classList.remove("show");
      playBottom?.classList.remove("has-clue");
      return;
    }

    clueMeta.textContent = `${cat.name || ""} — $${state.settings.values[active.row] ?? 0}`;

    const showQuestion =
      RoomSession.isHost() || state.game.showQuestionToPlayers !== false;

    if (ClueAudio.isAudioClue(clue)) {
      ClueAudio.handleState(state, clueText, audioCountdown, {
        isHost: RoomSession.isHost(),
      });
    } else {
      ClueAudio.teardown();
      if (audioCountdown) audioCountdown.classList.remove("show");
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
