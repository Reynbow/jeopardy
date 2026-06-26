// YouTube URL parsing and hidden IFrame player (audio-only UX).
(function () {
  const API_SRC = "https://www.youtube.com/iframe_api";
  let apiPromise = null;

  function parseVideoId(url) {
    const raw = (url || "").trim();
    if (!raw) return null;
    try {
      const u = new URL(raw);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        return u.pathname.slice(1).split("/")[0] || null;
      }
      if (host === "youtube.com" || host === "m.youtube.com") {
        const v = u.searchParams.get("v");
        if (v) return v;
        const embed = u.pathname.match(/\/embed\/([^/?]+)/);
        if (embed) return embed[1];
        const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
        if (shorts) return shorts[1];
      }
    } catch {
      return null;
    }
    return null;
  }

  function isYouTubeUrl(url) {
    return !!parseVideoId(url);
  }

  function loadApi() {
    if (window.YT && window.YT.Player) {
      return Promise.resolve();
    }
    if (apiPromise) return apiPromise;

    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === "function") prev();
        resolve();
      };
      const existing = document.querySelector('script[src="' + API_SRC + '"]');
      if (!existing) {
        const tag = document.createElement("script");
        tag.src = API_SRC;
        document.head.appendChild(tag);
      }
    });

    return apiPromise;
  }

  function createPlayer(container, videoId, events) {
    return new YT.Player(container, {
      width: 1,
      height: 1,
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        origin: window.location.origin,
      },
      events: events || {},
    });
  }

  function destroyPlayer(player) {
    if (!player) return;
    try {
      player.stopVideo();
    } catch {
      /* ignore */
    }
    try {
      player.destroy();
    } catch {
      /* ignore */
    }
  }

  function playFromStart(player) {
    if (!player) return;
    try {
      player.seekTo(0, true);
      player.playVideo();
    } catch {
      /* ignore */
    }
  }

  function pausePlayer(player) {
    if (!player) return;
    try {
      player.pauseVideo();
    } catch {
      /* ignore */
    }
  }

  function seekTo(player, seconds) {
    if (!player) return;
    try {
      player.seekTo(seconds, true);
    } catch {
      /* ignore */
    }
  }

  window.YouTubeAudio = {
    parseVideoId,
    isYouTubeUrl,
    loadApi,
    createPlayer,
    destroyPlayer,
    playFromStart,
    pausePlayer,
    seekTo,
  };
})();
