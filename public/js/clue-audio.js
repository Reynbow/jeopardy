// Audio clue preload, cache reporting, host sync, and countdown playback.
(function () {
  const COUNTDOWN_MS = 3000;
  const VOLUME_KEY = "jeopardy_audio_volume";
  let session = null;
  let countdownTimer = null;
  let playTimer = null;
  let lastReport = { percent: -1, ready: false, at: 0 };
  let attachToken = 0;
  let lastControlRev = -1;
  let lastPauseKey = "";

  function getVolume() {
    const v = parseFloat(sessionStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  }

  function setVolume(level) {
    const vol = Math.max(0, Math.min(1, Number(level) || 0));
    sessionStorage.setItem(VOLUME_KEY, String(vol));
    applyVolumeToSession();
  }

  function applyVolumeToSession() {
    if (!session) return;
    const vol = getVolume();
    if (session.type === "youtube" && session.player) {
      try {
        session.player.setVolume(Math.round(vol * 100));
      } catch {
        /* ignore */
      }
    } else if (session.audio) {
      session.audio.volume = vol;
    }
  }

  function countdownBlock(countdownEl) {
    return countdownEl && countdownEl.closest(".audio-countdown-block");
  }

  function setCountdownVisible(countdownEl, visible) {
    const block = countdownBlock(countdownEl);
    if (block) block.classList.toggle("show", visible);
    if (countdownEl) countdownEl.classList.toggle("show", visible);
  }

  function isYouTubeSource(url) {
    return window.YouTubeAudio && YouTubeAudio.isYouTubeUrl(url);
  }

  function isAudioClue(clue) {
    return !!(clue && (clue.audioUrl || "").trim());
  }

  function stopPlayback() {
    if (!session) return;
    if (session.type === "youtube" && session.player) {
      YouTubeAudio.pausePlayer(session.player);
    } else if (session.audio) {
      session.audio.pause();
    }
  }

  function seekToPosition(positionMs) {
    if (!session) return;
    const sec = Math.max(0, (positionMs || 0) / 1000);
    if (session.type === "youtube" && session.player) {
      YouTubeAudio.seekTo(session.player, sec);
    } else if (session.audio) {
      session.audio.currentTime = sec;
    }
  }

  function applyPausedState(positionMs, controlRev) {
    const key = controlRev + ":" + positionMs;
    if (lastPauseKey === key) return;
    lastPauseKey = key;

    if (playTimer) {
      clearTimeout(playTimer);
      playTimer = null;
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (session) {
      session.playAt = null;
      session.scheduleKey = null;
    }
    stopPlayback();
    seekToPosition(positionMs);
  }

  function teardown() {
    attachToken++;
    if (countdownTimer) clearInterval(countdownTimer);
    if (playTimer) clearTimeout(playTimer);
    countdownTimer = null;
    playTimer = null;
    if (session) {
      if (session.type === "youtube" && session.player) {
        YouTubeAudio.destroyPlayer(session.player);
      } else if (session.audio) {
        session.audio.pause();
        session.audio.removeAttribute("src");
        session.audio.load();
      }
    }
    session = null;
    lastReport = { percent: -1, ready: false, at: 0 };
    lastControlRev = -1;
    lastPauseKey = "";
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

  function bindProgressHandlers(s, update) {
    s.onProgress = update;
    update(s.percent, s.ready);
  }

  function ensureFileSession(clueKey, audioUrl) {
    if (
      session &&
      session.type === "file" &&
      session.key === clueKey &&
      session.url === audioUrl
    ) {
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
      type: "file",
      key: clueKey,
      url: audioUrl,
      audio,
      percent: 0,
      ready: false,
      onProgress: null,
      playAt: null,
      hidden: false,
    };
    audio.volume = getVolume();
    update();
    return session;
  }

  function ensureYouTubeSession(clueKey, audioUrl, slotEl, ui, options) {
    if (
      session &&
      session.type === "youtube" &&
      session.key === clueKey &&
      session.url === audioUrl
    ) {
      bindProgressHandlers(session, ui.update);
      return Promise.resolve(session);
    }

    teardown();
    const videoId = YouTubeAudio.parseVideoId(audioUrl);
    if (!videoId) {
      ui.statusEl.textContent = "Invalid YouTube link";
      return Promise.resolve(null);
    }

    const token = ++attachToken;
    slotEl.innerHTML = "";
    const holder = document.createElement("div");
    holder.className = "youtube-audio-player";
    slotEl.appendChild(holder);

    ui.statusEl.textContent = "Loading YouTube audio…";

    return YouTubeAudio.loadApi().then(() => {
      if (token !== attachToken) return null;

      return new Promise((resolve) => {
        const player = YouTubeAudio.createPlayer(holder, videoId, {
          onReady: () => {
            if (token !== attachToken) {
              YouTubeAudio.destroyPlayer(player);
              resolve(null);
              return;
            }
            session = {
              type: "youtube",
              key: clueKey,
              url: audioUrl,
              videoId,
              player,
              percent: 100,
              ready: true,
              onProgress: null,
              playAt: null,
              hidden: !!options.hidden,
            };
            applyVolumeToSession();
            reportProgress(100, true);
            bindProgressHandlers(session, ui.update);
            resolve(session);
          },
          onError: () => {
            if (token !== attachToken) return;
            ui.statusEl.textContent = "Could not load YouTube audio";
            ui.update(0, false);
            resolve(null);
          },
        });
      });
    });
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
    const youtube = isYouTubeSource(audioUrl);

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

    const statusEl = renderStatus(
      wrap,
      youtube ? "Loading YouTube audio…" : "Loading audio…"
    );
    const bar = document.createElement("div");
    bar.className = "audio-cache-bar";
    bar.innerHTML = '<div class="audio-cache-bar-fill"></div>';
    wrap.appendChild(bar);
    const fill = bar.querySelector(".audio-cache-bar-fill");

    const audioSlot = document.createElement("div");
    audioSlot.className = "audio-clue-slot";
    wrap.appendChild(audioSlot);

    const update = (percent, ready) => {
      fill.style.width = percent + "%";
      if (ready) {
        statusEl.textContent = opts.allowControls
          ? "Ready — press Play audio when players are loaded"
          : "Ready — waiting for host to start";
      } else {
        statusEl.textContent = youtube
          ? "Loading YouTube audio…"
          : "Loading audio… " + percent + "%";
      }
    };

    return { wrap, statusEl, fill, audioSlot, audioUrl, youtube, update };
  }

  function syncCountdown(countdownEl, playAt, serverTime) {
    if (!countdownEl || !playAt) {
      setCountdownVisible(countdownEl, false);
      return;
    }

    const offset = (serverTime || Date.now()) - Date.now();
    const target = playAt - offset;

    function tick() {
      const remaining = target - Date.now();
      if (remaining <= 0) {
        countdownEl.textContent = "";
        setCountdownVisible(countdownEl, false);
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        return;
      }
      const secs = Math.ceil(remaining / 1000);
      countdownEl.textContent = String(secs);
      setCountdownVisible(countdownEl, true);
    }

    tick();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 100);
  }

  function schedulePlay(playAt, serverTime, positionMs, controlRev) {
    if (!session) return;
    const scheduleKey = playAt + ":" + controlRev + ":" + (positionMs || 0);
    if (session.scheduleKey === scheduleKey) return;
    session.scheduleKey = scheduleKey;
    session.playAt = playAt;

    const offset = (serverTime || Date.now()) - Date.now();
    const target = playAt - offset;
    const delay = Math.max(0, target - Date.now());

    if (playTimer) clearTimeout(playTimer);
    playTimer = setTimeout(() => {
      if (!session) return;
      seekToPosition(positionMs || 0);
      if (session.type === "youtube" && session.player) {
        session.player.playVideo();
      } else if (session.audio) {
        session.audio.play().catch(() => {});
      }
      if (session.onProgress) session.onProgress(100, true);
    }, delay);
  }

  function attach(clueKey, clue, container, options) {
    const ui = renderInto(container, clue, options);
    if (!ui) {
      stopPlayback();
      return;
    }

    if (ui.youtube) {
      ensureYouTubeSession(clueKey, ui.audioUrl, ui.audioSlot, ui, options);
      return;
    }

    const s = ensureFileSession(clueKey, ui.audioUrl);
    ui.audioSlot.appendChild(s.audio);
    s.audio.controls = false;
    s.hidden = !!options.hidden;
    bindProgressHandlers(s, ui.update);
  }

  function handleState(state, container, countdownEl, options) {
    const active = state.game.active;
    if (!active || !container) {
      teardown();
      setCountdownVisible(countdownEl, false);
      return;
    }

    const cat = state.settings.categories[active.cat];
    const clue = cat && cat.clues[active.row];
    if (!isAudioClue(clue)) {
      teardown();
      setCountdownVisible(countdownEl, false);
      return;
    }

    const clueKey = active.cat + "-" + active.row;
    const audioUrl = (clue.audioUrl || "").trim();
    const show =
      options.isHost || state.game.showQuestionToPlayers !== false;
    const hidden = !show;

    if (
      !session ||
      session.key !== clueKey ||
      session.url !== audioUrl ||
      session.hidden !== hidden
    ) {
      attach(clueKey, clue, container, { hidden, allowControls: false });
    } else if (session.onProgress) {
      session.onProgress(session.percent, session.ready);
    }

    const controlRev = state.game.audioControlRev || 0;
    const paused = !!state.game.audioPaused;
    const positionMs = state.game.audioPositionMs || 0;
    const playAt = state.game.audioPlayAt;

    if (controlRev !== lastControlRev) {
      if (playTimer) {
        clearTimeout(playTimer);
        playTimer = null;
      }
      if (session) {
        session.playAt = null;
        session.scheduleKey = null;
      }
      stopPlayback();
      lastControlRev = controlRev;
      lastPauseKey = "";
    }

    if (paused) {
      setCountdownVisible(countdownEl, false);
      applyPausedState(positionMs, controlRev);
      return;
    }

    lastPauseKey = "";

    if (playAt) {
      syncCountdown(countdownEl, playAt, state.serverTime);
      schedulePlay(playAt, state.serverTime, positionMs, controlRev);
    } else {
      setCountdownVisible(countdownEl, false);
      if (session) {
        session.playAt = null;
        session.scheduleKey = null;
      }
      if (playTimer) {
        clearTimeout(playTimer);
        playTimer = null;
      }
    }
  }

  window.ClueAudio = {
    isAudioClue,
    isYouTubeSource,
    getVolume,
    setVolume,
    applyVolumeToSession,
    teardown,
    handleState,
    ensureSession: ensureFileSession,
    bufferedPercent,
    COUNTDOWN_MS,
  };
})();
