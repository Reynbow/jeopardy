(function () {
  const titleInput = document.getElementById("title");
  const numCatsInput = document.getElementById("numCats");
  const numRowsInput = document.getElementById("numRows");
  const goldenBuzzerInput = document.getElementById("goldenBuzzer");
  const rowValuesStrip = document.getElementById("rowValuesStrip");
  const boardEl = document.getElementById("categoriesEditor");
  const saveIndicator = document.getElementById("saveIndicator");

  const MODES = ["text", "image", "audio"];

  let local = null;
  let saveTimer = null;

  Game.onState((state) => {
    if (!local) {
      local = cloneSettings(state.settings);
      renderAll();
    }
  });

  function cloneSettings(s) {
    return {
      title: s.title || "JEOPARDY!",
      rows: s.rows,
      values: s.values.slice(),
      goldenBuzzerEnabled: !!s.goldenBuzzerEnabled,
      categories: s.categories.map((c) => ({
        name: c.name || "",
        clues: c.clues.map((q) => ({
          question: q.question || "",
          answer: q.answer || "",
          promptType: q.promptType || inferMode(q),
          imageUrl: q.imageUrl || "",
          audioUrl: q.audioUrl || "",
        })),
      })),
    };
  }

  function inferMode(clue) {
    if ((clue.audioUrl || "").trim()) return "audio";
    if ((clue.imageUrl || "").trim()) return "image";
    return "text";
  }

  function emptyClue() {
    return {
      question: "",
      answer: "",
      promptType: "text",
      imageUrl: "",
      audioUrl: "",
    };
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 350);
  }

  function save() {
    Game.send({ type: "updateSettings", settings: local });
    saveIndicator.classList.add("show");
    setTimeout(() => saveIndicator.classList.remove("show"), 1200);
  }

  async function uploadMedia(file) {
    const code = RoomSession.getCode();
    const hostSecret = RoomSession.getHostSecret();
    if (!code || !hostSecret) throw new Error("Host session required");

    const form = new FormData();
    form.append("file", file);
    form.append("code", code);
    form.append("hostSecret", hostSecret);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.url;
  }

  function renderAll() {
    titleInput.value = local.title;
    numCatsInput.value = local.categories.length;
    numRowsInput.value = local.rows;
    if (goldenBuzzerInput) {
      goldenBuzzerInput.checked = !!local.goldenBuzzerEnabled;
    }
    renderRowValues();
    renderBoard();
  }

  function renderRowValues() {
    rowValuesStrip.innerHTML = "";
    const heading = document.createElement("div");
    heading.className = "row-values-heading";
    heading.textContent = "Row values";
    rowValuesStrip.appendChild(heading);

    for (let r = 0; r < local.rows; r++) {
      const item = document.createElement("div");
      item.className = "row-value-item";
      const label = document.createElement("label");
      label.textContent = "Row " + (r + 1);
      const input = document.createElement("input");
      input.type = "number";
      input.value = local.values[r];
      input.step = "100";
      input.addEventListener("input", () => {
        local.values[r] = Number(input.value) || 0;
        boardEl
          .querySelectorAll(`.settings-tile[data-row="${r}"] .settings-tile-value`)
          .forEach((el) => {
            el.textContent = "$" + local.values[r];
          });
        scheduleSave();
      });
      item.appendChild(label);
      item.appendChild(input);
      rowValuesStrip.appendChild(item);
    }
  }

  function renderBoard() {
    const cols = local.categories.length;
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

    local.categories.forEach((cat, c) => {
      const head = document.createElement("div");
      head.className = "settings-cat-cell";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "settings-cat-input";
      input.value = cat.name;
      input.placeholder = "Category " + (c + 1);
      input.addEventListener("input", () => {
        local.categories[c].name = input.value;
        scheduleSave();
      });
      head.appendChild(input);
      boardEl.appendChild(head);
    });

    for (let r = 0; r < local.rows; r++) {
      local.categories.forEach((cat, c) => {
        boardEl.appendChild(createClueTile(c, r));
      });
    }
  }

  function setClueMode(c, r, mode) {
    const clue = local.categories[c].clues[r];
    clue.promptType = mode;
    const tile = boardEl.querySelector(
      `.settings-tile[data-cat="${c}"][data-row="${r}"]`
    );
    if (tile) {
      updateModeButtons(tile, mode);
      renderTileBody(tile, c, r);
    }
    scheduleSave();
  }

  function updateModeButtons(tile, mode) {
    tile.querySelectorAll(".settings-mode-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
  }

  function renderTileBody(tile, c, r) {
    const clue = local.categories[c].clues[r];
    const body = tile.querySelector(".settings-tile-body");
    if (!body) return;
    body.innerHTML = "";

    const mode = clue.promptType || "text";

    if (mode === "text") {
      const ta = document.createElement("textarea");
      ta.className = "settings-clue-text";
      ta.placeholder = "Clue text";
      ta.rows = 3;
      ta.value = clue.question;
      ta.addEventListener("input", () => {
        clue.question = ta.value;
        scheduleSave();
      });
      body.appendChild(ta);
      return;
    }

    if (mode === "image") {
      body.appendChild(createMediaEditor(c, r, "image"));
      return;
    }

    if (mode === "audio") {
      body.appendChild(createMediaEditor(c, r, "audio"));
    }
  }

  function createMediaEditor(c, r, kind) {
    const clue = local.categories[c].clues[r];
    const wrap = document.createElement("div");
    wrap.className = "settings-media-editor";

    const urlKey = kind === "image" ? "imageUrl" : "audioUrl";
    const accept =
      kind === "image"
        ? "image/jpeg,image/png,image/gif,image/webp"
        : "audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4";

    const row = document.createElement("div");
    row.className = "media-input-row";

    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.className = "media-url-input";
    urlInput.placeholder = kind === "image" ? "Image URL" : "Audio URL";
    urlInput.value = clue[urlKey] || "";
    urlInput.addEventListener("input", () => {
      clue[urlKey] = urlInput.value.trim();
      renderMediaPreview(preview, clue, kind);
      scheduleSave();
    });

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = accept;
    fileInput.hidden = true;

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "btn small";
    uploadBtn.textContent = "Upload";
    uploadBtn.addEventListener("click", () => fileInput.click());

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn small danger";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => {
      clue[urlKey] = "";
      urlInput.value = "";
      renderMediaPreview(preview, clue, kind);
      scheduleSave();
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      uploadBtn.disabled = true;
      uploadBtn.textContent = "…";
      try {
        const url = await uploadMedia(file);
        clue[urlKey] = url;
        urlInput.value = url;
        renderMediaPreview(preview, clue, kind);
        scheduleSave();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Upload failed");
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Upload";
      }
    });

    row.appendChild(urlInput);
    row.appendChild(uploadBtn);
    row.appendChild(clearBtn);
    row.appendChild(fileInput);
    wrap.appendChild(row);

    const preview = document.createElement("div");
    preview.className = "media-preview";
    renderMediaPreview(preview, clue, kind);
    wrap.appendChild(preview);

    return wrap;
  }

  function renderMediaPreview(preview, clue, kind) {
    preview.innerHTML = "";
    const urlKey = kind === "image" ? "imageUrl" : "audioUrl";
    const url = (clue[urlKey] || "").trim();
    if (!url) return;
    if (kind === "image") {
      const img = document.createElement("img");
      img.className = "clue-image-preview";
      img.src = url;
      img.alt = "Preview";
      preview.appendChild(img);
    } else {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = url;
      audio.className = "clue-audio-preview";
      preview.appendChild(audio);
    }
  }

  function createClueTile(c, r) {
    const clue = local.categories[c].clues[r];
    const mode = clue.promptType || "text";

    const tile = document.createElement("div");
    tile.className = "settings-tile";
    tile.dataset.cat = String(c);
    tile.dataset.row = String(r);

    const value = document.createElement("div");
    value.className = "settings-tile-value";
    value.textContent = "$" + local.values[r];
    tile.appendChild(value);

    const modeBar = document.createElement("div");
    modeBar.className = "settings-mode-bar";
    MODES.forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "settings-mode-btn" + (m === mode ? " active" : "");
      btn.dataset.mode = m;
      btn.textContent = m === "text" ? "Text" : m === "image" ? "Image" : "Audio";
      btn.title = "Use " + btn.textContent.toLowerCase() + " for this clue";
      btn.addEventListener("click", () => setClueMode(c, r, m));
      modeBar.appendChild(btn);
    });
    tile.appendChild(modeBar);

    const body = document.createElement("div");
    body.className = "settings-tile-body";
    tile.appendChild(body);

    const answerWrap = document.createElement("div");
    answerWrap.className = "settings-tile-answer";
    const answerLabel = document.createElement("label");
    answerLabel.textContent = "Answer";
    const answer = document.createElement("textarea");
    answer.className = "settings-answer-text";
    answer.placeholder = "Host only";
    answer.rows = 2;
    answer.value = clue.answer;
    answer.addEventListener("input", () => {
      clue.answer = answer.value;
      scheduleSave();
    });
    answerWrap.appendChild(answerLabel);
    answerWrap.appendChild(answer);
    tile.appendChild(answerWrap);

    renderTileBody(tile, c, r);
    return tile;
  }

  numCatsInput.addEventListener("change", () => {
    let n = Math.max(1, Math.min(12, parseInt(numCatsInput.value, 10) || 1));
    numCatsInput.value = n;
    const cur = local.categories.length;
    if (n > cur) {
      for (let i = cur; i < n; i++) {
        local.categories.push({
          name: "",
          clues: Array.from({ length: local.rows }, () => emptyClue()),
        });
      }
    } else if (n < cur) {
      local.categories.length = n;
    }
    renderAll();
    save();
  });

  numRowsInput.addEventListener("change", () => {
    let n = Math.max(1, Math.min(10, parseInt(numRowsInput.value, 10) || 1));
    numRowsInput.value = n;
    const cur = local.rows;
    if (n > cur) {
      for (let r = cur; r < n; r++) {
        local.values.push((r + 1) * 200);
        local.categories.forEach((cat) => cat.clues.push(emptyClue()));
      }
    } else if (n < cur) {
      local.values.length = n;
      local.categories.forEach((cat) => (cat.clues.length = n));
    }
    local.rows = n;
    renderAll();
    save();
  });

  titleInput.addEventListener("input", () => {
    local.title = titleInput.value;
    scheduleSave();
  });

  goldenBuzzerInput?.addEventListener("change", () => {
    local.goldenBuzzerEnabled = goldenBuzzerInput.checked;
    scheduleSave();
  });

  function clearAllClues() {
    if (
      !confirm(
        "Clear every question and answer on the board? Category names and row values will be kept."
      )
    ) {
      return;
    }
    local.categories.forEach((cat) => {
      cat.clues = cat.clues.map(() => emptyClue());
    });
    renderBoard();
    save();
  }

  document.getElementById("clearAllCluesBtn")?.addEventListener("click", clearAllClues);
})();
