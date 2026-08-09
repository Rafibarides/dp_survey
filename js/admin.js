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
    return `${Math.round((n || 0) * 1000) / 10}%`;
  }

  function famRates(data) {
    const fam = data.familiarity || {};
    const counts = fam.counts || {};
    const scored =
      (counts.knows || 0) +
      (counts.mixed || 0) +
      (counts.stranger || 0);
    const denom = scored || data.n || 0;
    const rate = (count) => (denom ? count / denom : 0);
    return {
      counts,
      scored,
      knowsPercent: fam.knowsPercent != null ? fam.knowsPercent : rate(counts.knows || 0),
      mixedPercent: fam.mixedPercent != null ? fam.mixedPercent : rate(counts.mixed || 0),
      strangerPercent:
        fam.strangerPercent != null ? fam.strangerPercent : rate(counts.stranger || 0),
      avgScore: fam.avgScore,
      topSixOverlap: fam.topSixOverlap,
    };
  }

  function score(n) {
    if (n == null || Number.isNaN(n)) return "-";
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

  function orderedCard(row, index) {
    const p = window.PHOTO_BY_ID[row.id];
    if (!p) return "";
    const rank = row.rank || index + 1;
    const bits = [];
    if (row.selectionRate != null) bits.push(`${pct(row.selectionRate)} selected`);
    if (row.finalScore != null) bits.push(`score ${score(row.finalScore)}`);
    if (row.rate != null) bits.push(`${pct(row.rate)} of responses`);
    if (row.count != null && row.rate == null) bits.push(`${row.count} votes`);
    return `
      <article class="ordered-card">
        <div class="ordered-card__rank">${rank}</div>
        <img src="${p.src}" alt="Photo ${p.label}" loading="lazy" />
        <div class="ordered-card__meta">
          <strong>Photo ${p.label}</strong>
          <span>${bits.join(" · ") || "Ranked pick"}</span>
        </div>
      </article>
    `;
  }

  function renderOrdered(elId, rows, emptyText) {
    const node = document.getElementById(elId);
    if (!rows || !rows.length) {
      node.innerHTML = `<p class="admin__sub">${emptyText}</p>`;
      return;
    }
    node.innerHTML = rows.map((row, i) => orderedCard(row, i)).join("");
  }

  function renderSummary(data) {
    const fam = famRates(data);
    const items = [
      ["Total responses", data.n],
      ["Know you well", `${fam.counts.knows || 0} · ${pct(fam.knowsPercent)}`],
      ["Strangers", `${fam.counts.stranger || 0} · ${pct(fam.strangerPercent)}`],
      [
        "Knows vs stranger overlap",
        fam.topSixOverlap != null ? `${fam.topSixOverlap} of 6 photos` : "-",
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

  function renderLeastFamiliar(data) {
    const lf = data.leastFamiliar;
    const help = document.getElementById("leastFamiliarHelp");
    const wrap = document.getElementById("leastFamiliarStrangerWrap");
    const fam = data.familiarity || {};
    const strangerTop = (fam.strangerTopSix || []).map((row, i) => ({
      ...row,
      rank: i + 1,
    }));
    const strangerCount = fam.counts?.stranger || 0;

    // Backend deploy is stale: familiarity exists, but leastFamiliar payload is missing.
    if (!lf) {
      if (strangerCount > 0 && strangerTop.length) {
        help.textContent = `Your sheet already has familiarity scores (${strangerCount} stranger${strangerCount === 1 ? "" : "s"}). Showing the stranger group top six for now. Redeploy apps-script/Code.gs as a new web app version to unlock the exact shortlist from the single least-familiar respondent.`;
        renderOrdered("leastFamiliarSix", strangerTop, "No stranger shortlist yet.");
        wrap.hidden = true;
        return;
      }
      if ((fam.counts?.knows || 0) + (fam.counts?.mixed || 0) > 0) {
        help.textContent =
          "Familiarity scores exist, but this section needs the latest Apps Script deploy. In the Apps Script editor, paste apps-script/Code.gs, then Deploy → Manage deployments → Edit → New version.";
      } else {
        help.textContent =
          "No familiarity scores yet. Once people answer the food and phrase asides, the least-familiar shortlist appears here.";
      }
      renderOrdered("leastFamiliarSix", [], "No least-familiar shortlist yet.");
      wrap.hidden = true;
      return;
    }

    if (lf.source === "single") {
      help.textContent = `Exact #1 through #6 from the single respondent with the lowest familiarity score (${lf.minScore} of 4). This is what someone who knows you least actually picked.`;
    } else {
      help.textContent = `${lf.tiedCount} respondents tied for the lowest familiarity score (${lf.minScore} of 4). Their shortlists are pooled into one ordered set below, then compared with the full stranger group.`;
    }

    renderOrdered(
      "leastFamiliarSix",
      lf.topSix,
      "No least-familiar shortlist yet."
    );

    const groupSix = lf.strangerGroupTopSix?.length
      ? lf.strangerGroupTopSix
      : strangerTop;
    const showStranger = lf.source === "tie" || groupSix.length > 0;
    wrap.hidden = !showStranger;
    if (showStranger) {
      renderOrdered(
        "leastFamiliarStrangerSix",
        groupSix,
        "No stranger group shortlist yet."
      );
    }
  }

  function renderFamiliarity(data) {
    const fam = famRates(data);
    const counts = fam.counts;
    const full = data.familiarity || {};
    document.getElementById("familiarityRow").innerHTML = [
      ["Know you well", `${counts.knows ?? 0} · ${pct(fam.knowsPercent)}`],
      ["Mixed", `${counts.mixed ?? 0} · ${pct(fam.mixedPercent)}`],
      ["Stranger", `${counts.stranger ?? 0} · ${pct(fam.strangerPercent)}`],
      [
        "Avg familiarity score",
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

    renderOrdered(
      "knowsTopSix",
      (full.knowsTopSix || []).map((row, i) => ({ ...row, rank: i + 1 })),
      "No knows-you responses yet."
    );
    renderOrdered(
      "strangerTopSix",
      (full.strangerTopSix || []).map((row, i) => ({ ...row, rank: i + 1 })),
      "No stranger responses yet."
    );

    document.getElementById("gapBody").innerHTML = (full.largestGaps || [])
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
    renderOrdered(
      "topSix",
      (data.topSix || []).map((row, i) => ({ ...row, rank: i + 1 })),
      "No responses yet."
    );

    document.getElementById("mostNumberOne").innerHTML = (data.mostNumberOne || [])
      .slice(0, 3)
      .map((row) => photoCard(row, `${pct(row.numberOneRate)} chose as #1`))
      .join("");

    document.getElementById("weakest").innerHTML = (data.weakest || [])
      .slice(0, 3)
      .map((row) =>
        photoCard(
          row,
          `${pct(row.selectionRate)} selected · score ${score(row.finalScore)}`
        )
      )
      .join("");

    document.getElementById("polarized").innerHTML = (data.mostPolarized || [])
      .slice(0, 3)
      .map((row) => {
        const p = polarLabel(row.polarization);
        return photoCard(row, `${p.text} · SD ${row.polarization.toFixed(2)}`);
      })
      .join("");
  }

  function renderTable(rows) {
    document.getElementById("tableBody").innerHTML = (rows || [])
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
    const list = items || [];
    const max = Math.max(...list.map((m) => m.count), 1);
    document.getElementById(elId).innerHTML = list.length
      ? list
          .map((m) => {
            const label = labels[m.id] || m.id;
            return `
          <div class="bar-row">
            <span title="${label}">${label}</span>
            <div class="bar-track"><span style="width:${(m.count / max) * 100}%"></span></div>
            <span>${m.count}</span>
          </div>`;
          })
          .join("")
      : "<p class='admin__sub'>No answers yet.</p>";
  }

  function renderWildcards(data) {
    const fam = famRates(data);
    document.getElementById("wildcardFamiliarityRow").innerHTML = [
      ["Know you well", `${fam.counts.knows || 0} · ${pct(fam.knowsPercent)}`],
      ["Mixed", `${fam.counts.mixed || 0} · ${pct(fam.mixedPercent)}`],
      ["Stranger", `${fam.counts.stranger || 0} · ${pct(fam.strangerPercent)}`],
      ["Responses scored", fam.scored],
    ]
      .map(
        ([label, value]) => `
        <div class="stat">
          <div class="stat__label">${label}</div>
          <div class="stat__value">${value}</div>
        </div>`
      )
      .join("");

    const must = (data.mustGo || []).map((m, i) => ({
      ...m,
      rank: i + 1,
    }));
    renderOrdered("mustGoPhotos", must.slice(0, 6), "No must-go votes yet.");

    renderBars("foodBars", data.foodAnswers || [], FOOD_LABELS);
    renderBars("phraseBars", data.phraseAnswers || [], PHRASE_LABELS);

    const c = data.calibration || {};
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
      renderGrids(data);
      renderLeastFamiliar(data);
      renderFamiliarity(data);
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
