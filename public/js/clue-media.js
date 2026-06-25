// Shared clue content rendering (text, image). Audio clues use ClueAudio.
(function () {
  function hasContent(clue) {
    if (!clue) return false;
    return !!(
      (clue.question || "").trim() ||
      (clue.imageUrl || "").trim() ||
      (clue.audioUrl || "").trim()
    );
  }

  function renderInto(container, clue, options) {
    if (!container) return;
    const opts = options || {};
    container.innerHTML = "";

    if (opts.hidden) {
      const msg = document.createElement("div");
      msg.className = "clue-hidden-msg";
      msg.textContent = opts.hiddenMessage || "Question hidden — someone buzzed in!";
      container.appendChild(msg);
      return;
    }

    if (!clue) return;

    const imageUrl = (clue.imageUrl || "").trim();
    const question = (clue.question || "").trim();

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
  }

  window.ClueMedia = {
    hasContent,
    renderInto,
  };
})();
