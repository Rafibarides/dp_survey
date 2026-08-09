(function () {
  const SELECT_COUNT = window.APP_CONFIG.SELECT_COUNT || 6;
  const STORAGE_KEY = "dp_study_submitted_v1";

  const SCALE = [
    { value: 1, label: "Not at all" },
    { value: 2, label: "Not really" },
    { value: 3, label: "Yes" },
    { value: 4, label: "Very accurately" },
  ];

  // Option order is shuffled per session. Correctness is never shown to the respondent.
  const FOOD_OPTIONS = [
    { id: "bagel", label: "A bagel toasted with avocados and tomatoes" },
    { id: "chicken_parm", label: "Chicken Parm with salad" },
    { id: "caesar", label: "Caesar salad with sourdough bread on the side" },
    { id: "mushroom_soup", label: "Creamy mushroom soup" },
  ];

  const PHRASE_OPTIONS = [
    {
      id: "verbose_exit",
      label:
        "What are the chances you would potentially be interested in exiting the premises",
    },
    { id: "fuck_out", label: "Lets get the fuck out of here?" },
    {
      id: "polite_exit",
      label: "Thank you, I am about ready to be on my way",
    },
    { id: "lets_leave", label: "Lets leave" },
  ];

  const state = {
    order: [],
    selected: [],
    ranked: [],
    mustGo: null,
    food: null,
    phrase: null,
    foodOrder: [],
    phraseOrder: [],
    appearance: null,
    personality: null,
    startedAt: 0,
    screen: "intro",
  };

  const el = {
    progressBar: document.getElementById("progressBar"),
    startBtn: document.getElementById("startBtn"),
    selectGrid: document.getElementById("selectGrid"),
    selectCount: document.getElementById("selectCount"),
    tray: document.getElementById("selectTray"),
    traySlots: document.getElementById("traySlots"),
    toRankBtn: document.getElementById("toRankBtn"),
    rankList: document.getElementById("rankList"),
    rankCount: document.getElementById("rankCount"),
    rankHint: document.getElementById("rankHint"),
    toMustGoBtn: document.getElementById("toMustGoBtn"),
    resetRankBtn: document.getElementById("resetRankBtn"),
    mustGoGrid: document.getElementById("mustGoGrid"),
    toFoodBtn: document.getElementById("toFoodBtn"),
    foodScale: document.getElementById("foodScale"),
    toPhraseBtn: document.getElementById("toPhraseBtn"),
    phraseScale: document.getElementById("phraseScale"),
    toAppearanceBtn: document.getElementById("toAppearanceBtn"),
    appearanceScale: document.getElementById("appearanceScale"),
    toPersonalityBtn: document.getElementById("toPersonalityBtn"),
    personalityScale: document.getElementById("personalityScale"),
    submitBtn: document.getElementById("submitBtn"),
    overlapValue: document.getElementById("overlapValue"),
    overlapMeter: document.getElementById("overlapMeter"),
    overlapNote: document.getElementById("overlapNote"),
    alignValue: document.getElementById("alignValue"),
    alignMeter: document.getElementById("alignMeter"),
    alignNote: document.getElementById("alignNote"),
    topNote: document.getElementById("topNote"),
    doneStatus: document.getElementById("doneStatus"),
    doneError: document.getElementById("doneError"),
  };

  const SCREENS = [
    "intro",
    "select",
    "rank",
    "mustgo",
    "food",
    "phrase",
    "appearance",
    "personality",
    "done",
  ];

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function photo(id) {
    return window.PHOTO_BY_ID[id];
  }

  function setProgress(screen) {
    const idx = Math.max(0, SCREENS.indexOf(screen));
    const pct = (idx / (SCREENS.length - 1)) * 100;
    el.progressBar.style.width = `${pct}%`;
  }

  function showScreen(name) {
    state.screen = name;
    document.querySelectorAll(".screen").forEach((node) => {
      node.classList.toggle("is-active", node.dataset.screen === name);
    });
    setProgress(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function makeTile(p, { selected = false, dimmed = false, mark = "" } = {}) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "photo-tile";
    btn.dataset.id = p.id;
    btn.setAttribute("aria-label", `Photo ${p.label}`);
    if (selected) btn.classList.add("is-selected");
    if (dimmed) btn.classList.add("is-dimmed");
    btn.innerHTML = `
      <img src="${p.src}" alt="" loading="lazy" decoding="async" />
      <div class="photo-tile__mark"><span>${mark || ""}</span></div>
    `;
    return btn;
  }

  function renderTray() {
    el.traySlots.innerHTML = "";
    for (let i = 0; i < SELECT_COUNT; i += 1) {
      const slot = document.createElement("div");
      slot.className = "slot";
      const id = state.selected[i];
      if (id) {
        slot.classList.add("is-filled");
        slot.dataset.id = id;
        slot.innerHTML = `<img src="${photo(id).src}" alt="" />`;
        slot.addEventListener("click", () => toggleSelect(id));
      } else {
        slot.innerHTML = `<div class="slot__num">${i + 1}</div>`;
      }
      el.traySlots.appendChild(slot);
    }

    const full = state.selected.length === SELECT_COUNT;
    el.selectCount.textContent = String(state.selected.length);
    el.toRankBtn.disabled = !full;
    el.toRankBtn.classList.toggle("is-ready", full);
    el.tray.classList.add("is-visible");
  }

  function renderSelectGrid() {
    el.selectGrid.innerHTML = "";
    const full = state.selected.length === SELECT_COUNT;
    state.order.forEach((id) => {
      const p = photo(id);
      const selected = state.selected.includes(id);
      const mark = selected ? String(state.selected.indexOf(id) + 1) : "";
      const tile = makeTile(p, {
        selected,
        dimmed: full && !selected,
        mark,
      });
      if (full && !selected) tile.classList.add("is-locked");
      else tile.classList.add("is-pickable");
      tile.addEventListener("click", () => toggleSelect(id));
      el.selectGrid.appendChild(tile);
    });
    renderTray();
  }

  function toggleSelect(id) {
    const idx = state.selected.indexOf(id);
    if (idx >= 0) {
      state.selected.splice(idx, 1);
    } else if (state.selected.length < SELECT_COUNT) {
      state.selected.push(id);
      if (navigator.vibrate) navigator.vibrate(8);
    }
    renderSelectGrid();
  }

  function renderRank() {
    el.rankList.innerHTML = "";
    const nextRank = state.ranked.length + 1;
    state.selected.forEach((id) => {
      const rankIdx = state.ranked.indexOf(id);
      const assigned = rankIdx >= 0;
      const li = document.createElement("li");
      li.className = "rank-item";
      if (assigned) li.classList.add("is-assigned");
      if (!assigned && state.ranked.length < SELECT_COUNT) li.classList.add("is-next");
      li.dataset.id = id;
      li.innerHTML = `
        <div class="rank-item__badge">${assigned ? rankIdx + 1 : nextRank}</div>
        <div class="rank-item__photo"><img src="${photo(id).src}" alt="" /></div>
      `;
      li.addEventListener("click", () => assignRank(id));
      el.rankList.appendChild(li);
    });

    const done = state.ranked.length === SELECT_COUNT;
    el.rankCount.textContent = String(state.ranked.length);
    el.toMustGoBtn.disabled = !done;
    el.toMustGoBtn.classList.toggle("is-ready", done);
    el.rankHint.textContent = done
      ? "Ranking locked. Continue when ready."
      : nextRank === 1
        ? "Tap your single favorite first. Then next strongest, through six."
        : `Tap your number ${nextRank}.`;
  }

  function assignRank(id) {
    if (state.ranked.includes(id)) return;
    if (state.ranked.length >= SELECT_COUNT) return;
    state.ranked.push(id);
    if (navigator.vibrate) navigator.vibrate(10);
    renderRank();
  }

  function resetRank() {
    state.ranked = [];
    renderRank();
  }

  function renderMustGo() {
    el.mustGoGrid.innerHTML = "";
    state.order.forEach((id) => {
      const selected = state.mustGo === id;
      const tile = makeTile(photo(id), {
        selected,
        dimmed: state.mustGo && !selected,
        mark: selected ? "X" : "",
      });
      tile.addEventListener("click", () => {
        state.mustGo = id;
        el.toFoodBtn.disabled = false;
        el.toFoodBtn.classList.add("is-ready");
        renderMustGo();
      });
      el.mustGoGrid.appendChild(tile);
    });
  }

  function renderChoice(container, options, order, key, continueBtn) {
    container.innerHTML = "";
    order.forEach((id) => {
      const opt = options.find((o) => o.id === id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scale__option";
      if (state[key] === opt.id) btn.classList.add("is-selected");
      btn.innerHTML = `<strong>${opt.label}</strong>`;
      btn.addEventListener("click", () => {
        state[key] = opt.id;
        continueBtn.disabled = false;
        continueBtn.classList.add("is-ready");
        renderChoice(container, options, order, key, continueBtn);
      });
      container.appendChild(btn);
    });
  }

  function renderScale(container, key, continueBtn) {
    container.innerHTML = "";
    SCALE.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scale__option";
      if (state[key] === opt.value) btn.classList.add("is-selected");
      btn.innerHTML = `<strong>${opt.label}</strong><span>${opt.value}</span>`;
      btn.addEventListener("click", () => {
        state[key] = opt.value;
        continueBtn.disabled = false;
        continueBtn.classList.add("is-ready");
        renderScale(container, key, continueBtn);
      });
      container.appendChild(btn);
    });
  }

  function buildPayload() {
    return {
      respondentId: crypto.randomUUID
        ? crypto.randomUUID()
        : `r_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ranked: state.ranked.slice(),
      mustGo: state.mustGo,
      food: state.food,
      phrase: state.phrase,
      appearance: state.appearance,
      personality: state.personality,
      orderShown: state.order.slice(),
      durationMs: Date.now() - state.startedAt,
      userAgent: navigator.userAgent.slice(0, 180),
      submittedAt: new Date().toISOString(),
    };
  }

  function showLocalCompareFallback() {
    el.doneStatus.textContent =
      "Saved on this device. Connect the sheet backend to compare against the pool.";
    el.overlapValue.textContent = "n/a";
    el.alignValue.textContent = "n/a";
    el.overlapNote.textContent = "Pool comparison needs the Google Sheet URL.";
    el.alignNote.textContent = "";
    el.topNote.textContent = `Your number one was photo ${photo(state.ranked[0]).label}.`;
  }

  function renderCompare(data) {
    const overlap = data.overlapCount ?? 0;
    const align = Math.round((data.alignmentScore ?? 0) * 100);
    el.overlapValue.textContent = `${overlap}/6`;
    el.alignValue.textContent = `${align}%`;
    requestAnimationFrame(() => {
      el.overlapMeter.style.width = `${(overlap / 6) * 100}%`;
      el.alignMeter.style.width = `${align}%`;
    });
    el.overlapNote.textContent =
      overlap >= 4
        ? "You and the group largely shortlisted the same images."
        : overlap >= 2
          ? "Some overlap with the group shortlist. Your eye is partly independent."
          : "Low overlap. Your shortlist diverges from the current pool.";
    el.alignNote.textContent =
      data.n > 1
        ? `Compared against ${data.n} responses so far.`
        : "You are among the first responses. Alignment will stabilize as the pool grows.";
    if (data.top1IsConsensus) {
      el.topNote.textContent =
        "Your number one is currently the most common number one.";
    } else if (data.top1InGroupTop6) {
      el.topNote.textContent =
        "Your number one is in the group's current top six, but not their most common number one.";
    } else {
      el.topNote.textContent =
        "Your number one is outside the group's current top six.";
    }
    el.doneStatus.textContent = "Done. You can close this page.";
  }

  async function submit() {
    el.submitBtn.disabled = true;
    el.submitBtn.textContent = "Submitting...";
    showScreen("done");

    const payload = buildPayload();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    if (!window.API.isConfigured()) {
      showLocalCompareFallback();
      el.doneError.hidden = false;
      el.doneError.textContent =
        "Backend URL missing in js/config.js. Response kept locally only.";
      return;
    }

    try {
      await window.API.submitResponse(payload);
      const compare = await window.API.getCompare(payload.ranked);
      renderCompare(compare);
    } catch (err) {
      console.error(err);
      el.doneError.hidden = false;
      el.doneError.textContent =
        "Could not reach the study server. Your answers stayed on this device.";
      showLocalCompareFallback();
    }
  }

  function start() {
    state.order = shuffle(window.PHOTOS.map((p) => p.id));
    state.selected = [];
    state.ranked = [];
    state.mustGo = null;
    state.food = null;
    state.phrase = null;
    state.foodOrder = shuffle(FOOD_OPTIONS.map((o) => o.id));
    state.phraseOrder = shuffle(PHRASE_OPTIONS.map((o) => o.id));
    state.appearance = null;
    state.personality = null;
    state.startedAt = Date.now();
    el.toFoodBtn.disabled = true;
    el.toFoodBtn.classList.remove("is-ready");
    el.toPhraseBtn.disabled = true;
    el.toPhraseBtn.classList.remove("is-ready");
    el.toAppearanceBtn.disabled = true;
    el.toAppearanceBtn.classList.remove("is-ready");
    el.toPersonalityBtn.disabled = true;
    el.toPersonalityBtn.classList.remove("is-ready");
    el.submitBtn.disabled = true;
    el.submitBtn.classList.remove("is-ready");
    el.submitBtn.textContent = "Submit response";
    renderSelectGrid();
    showScreen("select");
  }

  el.startBtn.addEventListener("click", start);
  el.toRankBtn.addEventListener("click", () => {
    state.ranked = [];
    renderRank();
    showScreen("rank");
  });
  el.resetRankBtn.addEventListener("click", resetRank);
  el.toMustGoBtn.addEventListener("click", () => {
    renderMustGo();
    showScreen("mustgo");
  });
  el.toFoodBtn.addEventListener("click", () => {
    renderChoice(
      el.foodScale,
      FOOD_OPTIONS,
      state.foodOrder,
      "food",
      el.toPhraseBtn
    );
    showScreen("food");
  });
  el.toPhraseBtn.addEventListener("click", () => {
    renderChoice(
      el.phraseScale,
      PHRASE_OPTIONS,
      state.phraseOrder,
      "phrase",
      el.toAppearanceBtn
    );
    showScreen("phrase");
  });
  el.toAppearanceBtn.addEventListener("click", () => {
    renderScale(el.appearanceScale, "appearance", el.toPersonalityBtn);
    showScreen("appearance");
  });
  el.toPersonalityBtn.addEventListener("click", () => {
    renderScale(el.personalityScale, "personality", el.submitBtn);
    showScreen("personality");
  });
  el.submitBtn.addEventListener("click", submit);

  window.addEventListener("load", () => {
    window.PHOTOS.slice(0, 9).forEach((p) => {
      const img = new Image();
      img.src = p.src;
    });
  });
})();
