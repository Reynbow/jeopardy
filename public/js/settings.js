(function () {
  const titleInput = document.getElementById("title");
  const numCatsInput = document.getElementById("numCats");
  const numRowsInput = document.getElementById("numRows");
  const rowValuesStrip = document.getElementById("rowValuesStrip");
  const categoriesEditor = document.getElementById("categoriesEditor");
  const saveIndicator = document.getElementById("saveIndicator");

  let local = null;

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
      categories: s.categories.map((c) => ({
        name: c.name || "",
        clues: c.clues.map((q) => ({
          question: q.question || "",
          answer: q.answer || "",
          imageUrl: q.imageUrl || "",
          audioUrl: q.audioUrl || "",
        })),
      })),
    };
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

  function createMediaField(label, kind, clue, onUpdate) {
    const field = document.createElement("div");
    field.className = "clue-field clue-media-field";

    const fieldLabel = document.createElement("label");
    fieldLabel.textContent = label;
    field.appendChild(fieldLabel);

    const row = document.createElement("div");
    row.className = "media-input-row";

    const urlKey = kind === "image" ? "imageUrl" : "audioUrl";
    const accept =
      kind === "image"
        ? "image/jpeg,image/png,image/gif,image/webp"
        : "audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4";

    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.className = "media-url-input";
    urlInput.placeholder = kind === "image" ? "Image URL" : "Audio URL";
    urlInput.value = clue[urlKey] || "";
    urlInput.addEventListener("input", () => {
      clue[urlKey] = urlInput.value.trim();
      onUpdate();
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
      onUpdate();
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
        onUpdate();
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
    field.appendChild(row);

    const preview = document.createElement("div");
    preview.className = "media-preview";

    function renderPreview() {
      preview.innerHTML = "";
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

    renderPreview();
    field.appendChild(preview);

    return { field, renderPreview };
  }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 350);
  }
  function save() {
    Game.send({ type: "updateSettings", settings: local });
    saveIndicator.classList.add("show");
    setTimeout(() => saveIndicator.classList.remove("show"), 1200);
  }

  function renderAll() {
    titleInput.value = local.title;
    numCatsInput.value = local.categories.length;
    numRowsInput.value = local.rows;
    renderRowValues();
    renderCategories();
    enableMiddleMouseScroll(rowValuesStrip);
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
        renderCategories();
        scheduleSave();
      });
      item.appendChild(label);
      item.appendChild(input);
      rowValuesStrip.appendChild(item);
    }
  }

  function renderCategories() {
    categoriesEditor.innerHTML = "";

    local.categories.forEach((cat, c) => {
      const block = document.createElement("div");
      block.className = "category-block";

      const head = document.createElement("div");
      head.className = "category-block-head";
      const num = document.createElement("span");
      num.className = "cat-num";
      num.textContent = "Category " + (c + 1);
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = cat.name;
      nameInput.placeholder = "Category name";
      nameInput.addEventListener("input", () => {
        local.categories[c].name = nameInput.value;
        scheduleSave();
      });
      head.appendChild(num);
      head.appendChild(nameInput);
      block.appendChild(head);

      const rows = document.createElement("div");
      rows.className = "clue-rows";

      for (let r = 0; r < local.rows; r++) {
        const rowEl = document.createElement("div");
        rowEl.className = "clue-edit-row";

        const valLabel = document.createElement("div");
        valLabel.className = "clue-value-label";
        valLabel.textContent = "$" + local.values[r];

        const qField = document.createElement("div");
        qField.className = "clue-field";
        const qLabel = document.createElement("label");
        qLabel.textContent = "Question (text)";
        const q = document.createElement("textarea");
        q.placeholder = "Optional text shown with the clue";
        q.value = cat.clues[r].question;
        q.addEventListener("input", () => {
          local.categories[c].clues[r].question = q.value;
          scheduleSave();
        });
        qField.appendChild(qLabel);
        qField.appendChild(q);

        const clue = cat.clues[r];
        const imageField = createMediaField("Image", "image", clue, () =>
          imageField.renderPreview()
        );
        const audioField = createMediaField("Audio", "audio", clue, () =>
          audioField.renderPreview()
        );

        const aField = document.createElement("div");
        aField.className = "clue-field";
        const aLabel = document.createElement("label");
        aLabel.textContent = "Answer";
        const a = document.createElement("textarea");
        a.placeholder = "Host only";
        a.value = cat.clues[r].answer;
        a.addEventListener("input", () => {
          local.categories[c].clues[r].answer = a.value;
          scheduleSave();
        });
        aField.appendChild(aLabel);
        aField.appendChild(a);

        rowEl.appendChild(valLabel);
        rowEl.appendChild(qField);
        rowEl.appendChild(imageField.field);
        rowEl.appendChild(audioField.field);
        rowEl.appendChild(aField);
        rows.appendChild(rowEl);
      }

      block.appendChild(rows);
      categoriesEditor.appendChild(block);
    });
  }

  numCatsInput.addEventListener("change", () => {
    let n = Math.max(1, Math.min(12, parseInt(numCatsInput.value, 10) || 1));
    numCatsInput.value = n;
    const cur = local.categories.length;
    if (n > cur) {
      for (let i = cur; i < n; i++) {
        local.categories.push({
          name: "",
          clues: Array.from({ length: local.rows }, () => ({
            question: "",
            answer: "",
            imageUrl: "",
            audioUrl: "",
          })),
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
        local.categories.forEach((cat) =>
          cat.clues.push({ question: "", answer: "", imageUrl: "", audioUrl: "" })
        );
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

  function enableMiddleMouseScroll(el) {
    if (!el || el.dataset.panBound) return;
    el.dataset.panBound = "1";

    let panning = false;
    let startX = 0;
    let scrollLeft = 0;

    el.addEventListener("mousedown", (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      panning = true;
      startX = e.clientX;
      scrollLeft = el.scrollLeft;
      el.classList.add("panning");
    });

    el.addEventListener("mousemove", (e) => {
      if (!panning) return;
      e.preventDefault();
      el.scrollLeft = scrollLeft - (e.clientX - startX);
    });

    const stop = () => {
      panning = false;
      el.classList.remove("panning");
    };
    el.addEventListener("mouseup", stop);
    el.addEventListener("mouseleave", stop);
    el.addEventListener("auxclick", (e) => {
      if (e.button === 1) e.preventDefault();
    });
  }
})();
