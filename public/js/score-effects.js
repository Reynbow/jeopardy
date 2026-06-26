(function () {
  const lastScores = new Map();
  const pending = [];

  function formatDelta(n) {
    const abs = Math.abs(n).toLocaleString("en-US");
    return (n > 0 ? "+$" : "-$") + abs;
  }

  function trackScores(state) {
    const players = state.players || [];
    const changes = [];
    const ids = new Set();

    for (const p of players) {
      ids.add(p.id);
      const prev = lastScores.get(p.id);
      if (prev !== undefined && prev !== p.score) {
        changes.push({
          playerId: p.id,
          delta: p.score - prev,
          amount: Math.abs(p.score - prev),
        });
      }
      lastScores.set(p.id, p.score);
    }

    for (const id of lastScores.keys()) {
      if (!ids.has(id)) lastScores.delete(id);
    }

    if (changes.length === 1 && changes[0].amount > 0) {
      pending.push(changes[0]);
    }
  }

  function playOnElement(el, { delta, amount }) {
    const gain = delta > 0;
    el.classList.remove("score-gain-flash", "score-loss-flash");
    void el.offsetWidth;
    el.classList.add(gain ? "score-gain-flash" : "score-loss-flash");

    const scoreEl = el.querySelector(".c-score, .sr-score");
    if (scoreEl) {
      scoreEl.classList.remove("score-pop-gain", "score-pop-loss");
      void scoreEl.offsetWidth;
      scoreEl.classList.add(gain ? "score-pop-gain" : "score-pop-loss");
    }

    const floater = document.createElement("div");
    floater.className =
      "score-delta-floater " + (gain ? "score-delta-gain" : "score-delta-loss");
    floater.textContent = formatDelta(gain ? amount : -amount);
    el.appendChild(floater);

    window.setTimeout(() => floater.remove(), 1400);
    window.setTimeout(
      () => el.classList.remove("score-gain-flash", "score-loss-flash"),
      900
    );
  }

  function flush(root) {
    if (!root || !pending.length) return;
    while (pending.length) {
      const anim = pending.shift();
      const el = root.querySelector(`[data-player-id="${anim.playerId}"]`);
      if (el) playOnElement(el, anim);
    }
  }

  function reset() {
    lastScores.clear();
    pending.length = 0;
  }

  window.ScoreEffects = { trackScores, flush, reset };
})();
