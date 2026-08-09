(function () {
  const gate = document.getElementById("adminGate");
  const stats = document.getElementById("adminStats");
  const keyInput = document.getElementById("adminKey");
  const loadBtn = document.getElementById("loadBtn");
  const gateError = document.getElementById("gateError");

  keyInput.value = window.APP_CONFIG.ADMIN_KEY || "";

  const FOOD_LABELS = {
    bagel: "Bagel + avocado + tomato",
    chicken_parm: "Chicken Parm",
    caesar: "Caesar + sourdough",
    mushroom_soup: "Mushroom soup",
  };

  const PHRASE_LABELS = {
    verbose_exit: "Exiting the premises",
    fuck_out: "Get the fuck out",
    polite_exit: "About ready to be on my way",
    lets_leave: "Lets leave",
  };

  function pct(n) {
    return `${Math.round(n * 1000) / 10}%`;
  }

  function score(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function signedPct(n) {
    const v = Math.round(n * 1000) / 10;
    return `${v > 0 ? "+" : ""}${v}pp`;
  }

  function polarLabel(sd) {
    if (sd < 1.1) return { text: "Very low", cls: "" };
    if (sd < 1.7) return { text: "Low", cls: "" };
    if (sd < 2.3) return { text: "Medium", cls: "pill--high" };
    return { text: "High", cls: "pill--high" };
  }

  function photoCard(row, subtitle) {
    const p = window.PHOTO_BY_ID[row.id];
    if (!p) return "";
    return `
      <article class="top-card">
        <img src="${p.src}" alt="${p.label}" loading="lazy" />
        <div class="top-card__meta">
          <strong>Photo ${p.label}</strong>
          <span>${subtitle}</span>
        </div>
      </article>
    `;
  }

  function renderSummary(data) {
    const fam = data.familiarity || {};
    const items = [
      ["Responses", data.n],
      ["Knows you", fam.counts?.knows ?? 0],
      ["Strangers", fam.counts?.stranger ?? 0],
      [
        "Top-six overlap",
        fam.topSixOverlap != null ? `${fam.topSixOverlap}/6` : "-",
      ],
    ];
    document.getElementById("summaryRow").innerHTML = items
      .map(
        ([label, value]) => `
        <div class="stat">
          <div class="stat__label">${label}</div>
          <div class="stat__value">${value}</div>
        </div>`
      )
      .join("");
  }

  function renderFamiliarity(data) {
    const fam = data.familiarity || {};
    const counts = fam.counts || {};
    document.getElementById("familiarityRow").innerHTML = [
      ["Knows", counts.knows ?? 0],
      ["Mixed", counts.mixed ?? 0],
      ["Stranger", counts.stranger ?? 0],
      [
        "Avg familiarity",
        fam.avgScore != null ? fam.avgScore.toFixed(2) + " / 4" : "-",
      ],
    ]
      .map(
        ([label, value]) => `
        <div class="stat">
          <div class="stat__label">${label}</div>
          <div class="stat__value">${value}</div>
        </div>`
      )
      .join("");

    const overlap = fam.topSixOverlap;
    document.getElementById("familiarityNote").textContent =
      overlap == null
        ? "Need responses in both groups before the split stabilizes."
        : overlap >= 5
          ? "People who know you and strangers are mostly picking the same shortlist."
          : overlap >= 3
            ? "Partial agreement. Some photographs diverge by familiarity."
            : "Strong split. Strangers and people who know you are choosing different photographs.";

    document.getElementById("knowsTopSix").innerHTML = (fam.knowsTopSix || [])
      .map((row) =>
        photoCard(
          row,
          `${pct(row.selectionRate)} selected · score ${score(row.finalScore)}`
        )
      )
      .join("") || "<p class='admin__sub'>No knows-you responses yet.</p>";

    document.getElementById("strangerTopSix").innerHTML = (
      fam.strangerTopSix || []
    )
      .map((row) =>
        photoCard(
          row,
          `${pct(row.selectionRate)} selected · score ${score(row.finalScore)}`
        )
      )
      .join("") || "<p class='admin__sub'>No stranger responses yet.</p>";

    document.getElementById("gapBody").innerHTML = (fam.largestGaps || [])
      .map((row) => {
        const p = window.PHOTO_BY_ID[row.id];
        return `
          <tr>
            <td>
              <div class="td-photo">
                <img src="${p.src}" alt="" />
                <span>${p.label}</span>
              </div>
            </td>
            <td>${pct(row.knowsSelectionRate)}</td>
            <td>${pct(row.strangerSelectionRate)}</td>
            <td>${signedPct(row.deltaSelection)}</td>
          </tr>`;
      })
      .join("");
  }

  function renderGrids(data) {
    document.getElementById("topSix").innerHTML = data.topSix
      .map((row) =>
        photoCard(
          row,
          `${pct(row.selectionRate)} selected · score ${score(row.finalScore)}`
        )
      )
      .join("");

    document.getElementById("mostNumberOne").innerHTML = data.mostNumberOne
      .slice(0, 3)
      .map((row) => photoCard(row, `${pct(row.numberOneRate)} chose as #1`))
      .join("");

    document.getElementById("weakest").innerHTML = data.weakest
      .slice(0, 3)
      .map((row) =>
        photoCard(
          row,
          `${pct(row.selectionRate)} selected · score ${score(row.finalScore)}`
        )
      )
      .join("");

    document.getElementById("polarized").innerHTML = data.mostPolarized
      .slice(0, 3)
      .map((row) => {
        const p = polarLabel(row.polarization);
        return photoCard(row, `${p.text} · SD ${row.polarization.toFixed(2)}`);
      })
      .join("");
  }

  function renderTable(rows) {
    document.getElementById("tableBody").innerHTML = rows
      .map((row) => {
        const p = window.PHOTO_BY_ID[row.id];
        const pol = polarLabel(row.polarization);
        const avgRank =
          row.avgRankWhenSelected == null
            ? "-"
            : row.avgRankWhenSelected.toFixed(1);
        return `
          <tr>
            <td>
              <div class="td-photo">
                <img src="${p.src}" alt="" />
                <span>${p.label} · ${row.id}</span>
              </div>
            </td>
            <td>${pct(row.selectionRate)}</td>
            <td>${avgRank}</td>
            <td>${pct(row.numberOneRate)}</td>
            <td>${score(row.finalScore)}</td>
            <td><span class="pill ${pol.cls}">${pol.text}</span> ${row.polarization.toFixed(2)}</td>
          </tr>`;
      })
      .join("");
  }

  function renderBars(elId, items, labels) {
    const max = Math.max(...items.map((m) => m.count), 1);
    document.getElementById(elId).innerHTML = items
      .map((m) => {
        const label = labels[m.id] || m.id;
        return `
          <div class="bar-row">
            <span title="${label}">${label}</span>
            <div class="bar-track"><span style="width:${(m.count / max) * 100}%"></span></div>
            <span>${m.count}</span>
          </div>`;
      })
      .join("");
  }

  function renderWildcards(data) {
    const must = data.mustGo || [];
    const max = Math.max(...must.map((m) => m.count), 1);
    document.getElementById("mustGoBars").innerHTML = must
      .slice(0, 8)
      .map((m) => {
        const p = window.PHOTO_BY_ID[m.id];
        return `
          <div class="bar-row">
            <span>${p ? p.label : m.id}</span>
            <div class="bar-track"><span style="width:${(m.count / max) * 100}%"></span></div>
            <span>${m.count}</span>
          </div>`;
      })
      .join("");

    renderBars("foodBars", data.foodAnswers || [], FOOD_LABELS);
    renderBars("phraseBars", data.phraseAnswers || [], PHRASE_LABELS);

    const c = data.calibration;
    document.getElementById("calibRow").innerHTML = `
      <div class="stat">
        <div class="stat__label">Appearance mean (1-4)</div>
        <div class="stat__value">${c.appearanceAvg?.toFixed(2) ?? "-"}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Personality mean (1-4)</div>
        <div class="stat__value">${c.personalityAvg?.toFixed(2) ?? "-"}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Appearance % yes+</div>
        <div class="stat__value">${pct(c.appearancePositiveRate || 0)}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Personality % yes+</div>
        <div class="stat__value">${pct(c.personalityPositiveRate || 0)}</div>
      </div>`;
  }

  async function load() {
    gateError.hidden = true;
    const key = keyInput.value.trim();
    if (!key) {
      gateError.hidden = false;
      gateError.textContent = "Enter the admin key.";
      return;
    }
    if (!window.API.isConfigured()) {
      gateError.hidden = false;
      gateError.textContent = "Set SCRIPT_URL in js/config.js first.";
      return;
    }

    loadBtn.disabled = true;
    loadBtn.textContent = "Loading...";
    const previous = window.APP_CONFIG.ADMIN_KEY;
    window.APP_CONFIG.ADMIN_KEY = key;

    try {
      const data = await window.API.getAdminStats();
      if (!data || data.error) {
        throw new Error(data?.error || "Unauthorized");
      }
      renderSummary(data);
      renderFamiliarity(data);
      renderGrids(data);
      renderTable(data.photos);
      renderWildcards(data);
      gate.style.display = "none";
      stats.classList.add("is-visible");
    } catch (err) {
      window.APP_CONFIG.ADMIN_KEY = previous;
      gateError.hidden = false;
      gateError.textContent = err.message || "Could not load results.";
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = "Load results";
    }
  }

  loadBtn.addEventListener("click", load);
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") load();
  });
})();
