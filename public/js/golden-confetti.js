(function () {
  const COLORS = [
    "#ffd700",
    "#ffe566",
    "#d4a017",
    "#ffb347",
    "#fff4a3",
    "#f5c542",
    "#ffec8b",
    "#ffffff",
  ];

  function createParticle(w) {
    const shape = Math.random();
    return {
      x: Math.random() * w,
      y: -12 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 0.35,
      vy: 0.45 + Math.random() * 0.9,
      w: 5 + Math.random() * 8,
      h: 5 + Math.random() * 11,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 0.8,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      circle: shape > 0.78,
      streamer: shape > 0.58 && shape <= 0.78,
      spawnAt: Math.random() * 600,
      active: false,
    };
  }

  function burst() {
    const overlay = document.getElementById("overlay");
    const host = overlay || document.body;

    const canvas = document.createElement("canvas");
    canvas.className = "golden-confetti-canvas";
    canvas.setAttribute("aria-hidden", "true");

    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    if (overlay) {
      overlay.insertBefore(canvas, overlay.firstChild);
    } else {
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    const particles = [];
    const total = 150;
    for (let i = 0; i < total; i++) {
      particles.push(createParticle(w));
    }

    let frameId = 0;
    let lastFrame = performance.now();
    const started = lastFrame;
    const maxMs = 12000;

    function tick(now) {
      const dt = Math.min((now - lastFrame) / 16.67, 1.8);
      lastFrame = now;

      ctx.clearRect(0, 0, w, h);

      let alive = false;
      const elapsed = now - started;

      for (const p of particles) {
        if (!p.active) {
          if (elapsed >= p.spawnAt) p.active = true;
          else continue;
        }

        p.vy += 0.018 * dt;
        p.vx += (Math.random() - 0.5) * 0.004 * dt;
        p.x += (p.vx + Math.sin(p.phase) * 0.22) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.phase += 0.012 * dt;

        if (p.y > h + 30) continue;
        alive = true;

        const fadeZone = 120;
        let alpha = 1;
        if (p.y > h - fadeZone) {
          alpha = Math.max(0, (h - p.y) / fadeZone);
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.circle) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.streamer) {
          ctx.fillRect(-p.w * 0.18, -p.h * 0.5, p.w * 0.36, p.h * 1.6);
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }

        ctx.restore();
      }

      if (elapsed < maxMs && (alive || elapsed < 3500)) {
        frameId = requestAnimationFrame(tick);
      } else {
        canvas.remove();
      }
    }

    frameId = requestAnimationFrame(tick);

    window.setTimeout(() => {
      cancelAnimationFrame(frameId);
      if (canvas.parentNode) canvas.remove();
    }, maxMs + 300);
  }

  window.GoldenConfetti = { burst };
})();
