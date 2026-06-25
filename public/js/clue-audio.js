// Audio clue preload, cache reporting, host sync, and countdown playback.
(function () {
  const COUNTDOWN_MS = 3000;
  let session = null;
  let countdownTimer = null;
  let playTimer = null;
  let lastReport = { percent: -1, ready: false, at: 0 };

  function isAudioClue(clue) {
    return !!(clue && (clue.audioUrl || "").trim());
  }

  function teardown() {
    if (countdownTimer) clearInterval(countdownTimer);
    if (playTimer) clearTimeout(playTimer);
    countdownTimer = null;
    playTimer = null;
    if (session && session.audio) {
      session.audio.pause();
      session.audio.removeAttribute("src");
      session.audio.load();
    }
    session = null;
    lastReport = { percent: -1, ready: false, at: 0 };
  }

  function bufferedPercent(audio) {
    const duration = audio.duration;
    if (!duration || !isFinite(duration) || duration <= 0) {
      return audio.readyState >= 3 ? 100 : 0;
    }
    const ranges = audio.buffered;
    if (!ranges || !ranges.length) return 0;
    let end = 0;
    for (let i = 0; i < ranges.length; i++) {
      end = Math.max(end, ranges.end(i));
    }
    return Math.min(100, Math.round((end / duration) * 100));
  }

  function reportProgress(percent, ready) {
    const now = Date.now();
    if (
      percent === lastReport.percent &&
      ready === lastReport.ready &&
      now - lastReport.at < 400
    ) {
      return;
    }
    lastReport = { percent, ready, at: now };
    if (!RoomSession.isPlayer()) return;
    Game.send({ type: "reportAudioCache", percent, ready });
  }

  function ensureSession(clueKey, audioUrl) {
    if (session && session.key === clueKey && session.url === audioUrl) {
      return session;
    }
    teardown();
    const audio = document.createElement("audio");
    audio.className = "clue-audio";
    audio.preload = "auto";
    audio.src = audioUrl;

    const update = () => {
      const percent = bufferedPercent(audio);
      const ready = audio.readyState >= 4 || percent >= 99;
      session.percent = percent;
      session.ready = ready;
      reportProgress(percent, ready);
      if (session.onProgress) session.onProgress(percent, ready);
    };

    audio.addEventListener("progress", update);
    audio.addEventListener("loadedmetadata", update);
    audio.addEventListener("canplay", update);
    audio.addEventListener("canplaythrough", () => {
      session.percent = 100;
      session.ready = true;
      reportProgress(100, true);
      if (session.onProgress) session.onProgress(100, true);
    });
    audio.addEventListener("error", () => {
      if (session.onProgress) session.onProgress(session.percent, false);
    });

    session = {
      key: clueKey,
      url: audioUrl,
      audio,
      percent: 0,
      ready: false,
      onProgress: null,
      playAt: null,
    };
    update();
    return session;
  }

  function renderBadge(container) {
    const badge = document.createElement("div");
    badge.className = "audio-clue-badge";
    badge.textContent = "AUDIO CLUE";
    container.appendChild(badge);
  }

  function renderStatus(container, text) {
    const status = document.createElement("div");
    status.className = "audio-clue-status";
    status.textContent = text;
    container.appendChild(status);
    return status;
  }

  function renderInto(container, clue, options) {
    if (!container) return null;
    const opts = options || {};
    container.innerHTML = "";

    if (opts.hidden) {
      const msg = document.createElement("div");
      msg.className = "clue-hidden-msg";
      msg.textContent = opts.hiddenMessage || "Question hidden — someone buzzed in!";
      container.appendChild(msg);
      return null;
    }

    const audioUrl = (clue.audioUrl || "").trim();
    const question = (clue.question || "").trim();
    const imageUrl = (clue.imageUrl || "").trim();

    renderBadge(container);

    if (imageUrl) {
      const img = document.createElement("img");
      img.className = "clue-image";
      img.src = imageUrl;
      img.alt = question || "Clue image";
      img.loading = "lazy";
      container.appendChild(img);
    }

    if (question) {
      const text = document.createElement("p");
      text.className = "clue-text-line";
      text.textContent = question;
      container.appendChild(text);
    }

    if (!audioUrl) return null;

    const wrap = document.createElement("div");
    wrap.className = "audio-clue-player-wrap";
    container.appendChild(wrap);

    const statusEl = renderStatus(wrap, "Loading audio…");
    const bar = document.createElement("div");
    bar.className = "audio-cache-bar";
    bar.innerHTML = '<div class="audio-cache-bar-fill"></div>';
    wrap.appendChild(bar);
    const fill = bar.querySelector(".audio-cache-bar-fill");

    const audioSlot = document.createElement("div");
    audioSlot.className = "audio-clue-slot";
    wrap.appendChild(audioSlot);

    return { wrap, statusEl, fill, audioSlot, audioUrl };
  }

  function syncCountdown(countdownEl, playAt, serverTime) {
    if (!countdownEl || !playAt) {
      if (countdownEl) countdownEl.classList.remove("show");
      return;
    }

    const offset = (serverTime || Date.now()) - Date.now();
    const target = playAt - offset;

    function tick() {
      const remaining = target - Date.now();
      if (remaining <= 0) {
        countdownEl.textContent = "";
        countdownEl.classList.remove("show");
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        return;
      }
      const secs = Math.ceil(remaining / 1000);
      countdownEl.textContent = String(secs);
      countdownEl.classList.add("show");
    }

    tick();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 100);
  }

  function schedulePlay(playAt, serverTime) {
    if (!session || !session.audio) return;
    if (session.playAt === playAt) return;
    session.playAt = playAt;

    const offset = (serverTime || Date.now()) - Date.now();
    const target = playAt - offset;
    const delay = Math.max(0, target - Date.now());

    if (playTimer) clearTimeout(playTimer);
    playTimer = setTimeout(() => {
      const audio = session && session.audio;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      if (session.onProgress) session.onProgress(100, true);
    }, delay);
  }

  function attach(clueKey, clue, container, options) {
    const ui = renderInto(container, clue, options);
    if (!ui) {
      if (session && session.audio) session.audio.pause();
      return;
    }

    const s = ensureSession(clueKey, ui.audioUrl);
    ui.audioSlot.appendChild(s.audio);
    s.audio.controls = false;

    s.onProgress = (percent, ready) => {
      ui.fill.style.width = percent + "%";
      if (ready) {
        ui.statusEl.textContent = options.allowControls
          ? "Ready — press Play audio when players are loaded"
          : "Ready — waiting for host to start";
      } else {
        ui.statusEl.textContent = "Loading audio… " + percent + "%";
      }
    };
    s.onProgress(s.percent, s.ready);
  }

  function handleState(state, container, countdownEl, options) {
    const active = state.game.active;
    if (!active || !container) {
      teardown();
      if (countdownEl) countdownEl.classList.remove("show");
      return;
    }

    const cat = state.settings.categories[active.cat];
    const clue = cat && cat.clues[active.row];
    if (!isAudioClue(clue)) {
      teardown();
      if (countdownEl) countdownEl.classList.remove("show");
      return;
    }

    const clueKey = active.cat + "-" + active.row;
    const show =
      options.isHost || state.game.showQuestionToPlayers !== false;
    const hidden = !show;

    if (!session || session.key !== clueKey || session.hidden !== hidden) {
      attach(clueKey, clue, container, { hidden, allowControls: false });
      if (session) session.hidden = hidden;
    } else if (session.onProgress) {
      session.onProgress(session.percent, session.ready);
    }

    if (state.game.audioPlayAt) {
      syncCountdown(countdownEl, state.game.audioPlayAt, state.serverTime);
      schedulePlay(state.game.audioPlayAt, state.serverTime);
    } else {
      if (countdownEl) countdownEl.classList.remove("show");
      if (session) session.playAt = null;
      if (playTimer) {
        clearTimeout(playTimer);
        playTimer = null;
      }
    }
  }

  window.ClueAudio = {
    isAudioClue,
    teardown,
    handleState,
    ensureSession,
    bufferedPercent,
    COUNTDOWN_MS,
  };
})();
