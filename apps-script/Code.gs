/**
 * Visual Preference Study — Google Apps Script backend
 *
 * SETUP
 * 1. Create a Google Sheet.
 * 2. Extensions → Apps Script. Delete any stub code.
 * 3. Paste this entire file. Save.
 * 4. Set ADMIN_KEY below to something private. Match js/config.js.
 * 5. Deploy → New deployment → Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 6. Copy the Web App URL into js/config.js as SCRIPT_URL.
 * 7. First request auto-creates the Responses sheet.
 *
 * Rotate ADMIN_KEY before sharing the survey widely.
 *
 * Familiarity is scored only on the server. Participants never see it.
 */

var ADMIN_KEY = "gRASS59NI(E";
var PHOTO_IDS = [
  "DP_1", "DP_2", "DP_3", "DP_4", "DP_5",
  "DP_6", "DP_7", "DP_8", "DP_9", "DP_10",
  "DP_11", "DP_12", "DP_13", "DP_14", "DP_15",
  "DP_16", "DP_17", "DP_18", "DP_19", "DP_20",
  "DP_21", "DP_22", "DP_23", "DP_24", "DP_25"
];
var SELECT_COUNT = 6;
var SELECTION_WEIGHT = 0.7;
var RANK_WEIGHT = 0.3;
var SHEET_NAME = "Responses";

var FOOD_IDS = ["bagel", "chicken_parm", "caesar", "mushroom_soup"];
var PHRASE_IDS = ["verbose_exit", "fuck_out", "polite_exit", "lets_leave"];

var HEADERS = [
  "timestamp",
  "respondent_id",
  "rank1",
  "rank2",
  "rank3",
  "rank4",
  "rank5",
  "rank6",
  "must_go",
  "food",
  "phrase",
  "familiarity_score",
  "familiarity_group",
  "appearance",
  "personality",
  "order_shown",
  "duration_ms",
  "user_agent"
];

function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) || "ping";
    if (action === "ping") {
      return json_({ ok: true, service: "dp-study" });
    }
    if (action === "compare") {
      var rankedParam = (e.parameter.ranked || "").split(",").filter(Boolean);
      return json_(comparePayload_(rankedParam));
    }
    if (action === "admin") {
      if ((e.parameter.key || "") !== ADMIN_KEY) {
        return json_({ error: "Unauthorized" });
      }
      return json_(computeAdmin_());
    }
    return json_({ error: "Unknown action" });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action || "submit";
    if (action !== "submit") {
      return json_({ error: "Unknown action" });
    }
    var saved = saveResponse_(body);
    return json_({ ok: true, id: saved });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    return sheet;
  }
  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  var width = Math.max(sheet.getLastColumn(), HEADERS.length);
  var current = sheet.getRange(1, 1, 1, width).getValues()[0];
  var needsRewrite = false;
  for (var i = 0; i < HEADERS.length; i++) {
    if (current[i] !== HEADERS[i]) {
      needsRewrite = true;
      break;
    }
  }
  if (needsRewrite) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

/**
 * Secret familiarity model:
 * Food: bagel=2, chicken_parm/caesar=1, mushroom_soup=0
 * Phrase: verbose_exit/fuck_out=2, lets_leave=1, polite_exit=0
 * Total 0-4 → stranger (0-1), mixed (2), knows (3-4)
 */
function scoreFamiliarity_(food, phrase) {
  var foodPts = 0;
  if (food === "bagel") foodPts = 2;
  else if (food === "chicken_parm" || food === "caesar") foodPts = 1;
  else if (food === "mushroom_soup") foodPts = 0;

  var phrasePts = 0;
  if (phrase === "verbose_exit" || phrase === "fuck_out") phrasePts = 2;
  else if (phrase === "lets_leave") phrasePts = 1;
  else if (phrase === "polite_exit") phrasePts = 0;

  var score = foodPts + phrasePts;
  var group = "mixed";
  if (score <= 1) group = "stranger";
  else if (score >= 3) group = "knows";

  return {
    score: score,
    group: group,
    foodPts: foodPts,
    phrasePts: phrasePts,
    hitLeastFood: food === "mushroom_soup",
    hitLeastPhrase: phrase === "polite_exit",
    hitFoodCorrect: food === "bagel",
    hitPhraseCorrect: phrase === "verbose_exit" || phrase === "fuck_out"
  };
}

function saveResponse_(body) {
  var ranked = body.ranked || [];
  if (!ranked || ranked.length !== SELECT_COUNT) {
    throw new Error("Need exactly six ranked photos");
  }
  for (var i = 0; i < ranked.length; i++) {
    if (PHOTO_IDS.indexOf(ranked[i]) === -1) {
      throw new Error("Unknown photo id: " + ranked[i]);
    }
  }
  var unique = {};
  for (var u = 0; u < ranked.length; u++) {
    if (unique[ranked[u]]) throw new Error("Duplicate ranked photo");
    unique[ranked[u]] = true;
  }
  if (!body.mustGo || PHOTO_IDS.indexOf(body.mustGo) === -1) {
    throw new Error("Invalid mustGo");
  }
  if (FOOD_IDS.indexOf(body.food) === -1) throw new Error("Invalid food");
  if (PHRASE_IDS.indexOf(body.phrase) === -1) throw new Error("Invalid phrase");

  var appearance = Number(body.appearance);
  var personality = Number(body.personality);
  if (!(appearance >= 1 && appearance <= 4)) throw new Error("Invalid appearance");
  if (!(personality >= 1 && personality <= 4)) throw new Error("Invalid personality");

  var fam = scoreFamiliarity_(body.food, body.phrase);
  var sheet = getSheet_();
  var respondentId = String(body.respondentId || Utilities.getUuid());
  sheet.appendRow([
    body.submittedAt || new Date().toISOString(),
    respondentId,
    ranked[0],
    ranked[1],
    ranked[2],
    ranked[3],
    ranked[4],
    ranked[5],
    body.mustGo,
    body.food,
    body.phrase,
    fam.score,
    fam.group,
    appearance,
    personality,
    (body.orderShown || []).join("|"),
    Number(body.durationMs) || 0,
    String(body.userAgent || "").slice(0, 180)
  ]);
  return respondentId;
}

function readResponses_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow, HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[2]) continue;

    // Support both new schema and older rows missing diagnostic columns.
    var food = row[9];
    var phrase = row[10];
    var famScore = row[11];
    var famGroup = row[12];
    var appearance = row[13];
    var personality = row[14];
    var orderShown = row[15];
    var durationMs = row[16];

    // Legacy layout: must_go, appearance, personality, order, duration, ua
    if (FOOD_IDS.indexOf(food) === -1 && (food === "" || food == null || typeof food === "number")) {
      appearance = row[9];
      personality = row[10];
      orderShown = row[11];
      durationMs = row[12];
      food = "";
      phrase = "";
      famScore = "";
      famGroup = "unknown";
    }

    var fam = null;
    if (FOOD_IDS.indexOf(food) !== -1 && PHRASE_IDS.indexOf(phrase) !== -1) {
      fam = scoreFamiliarity_(food, phrase);
    }

    out.push({
      timestamp: row[0],
      respondentId: row[1],
      ranked: [row[2], row[3], row[4], row[5], row[6], row[7]],
      mustGo: row[8],
      food: food || null,
      phrase: phrase || null,
      familiarityScore: fam ? fam.score : (famScore === "" ? null : Number(famScore)),
      familiarityGroup: fam ? fam.group : (famGroup || "unknown"),
      appearance: Number(appearance),
      personality: Number(personality),
      orderShown: String(orderShown || "").split("|").filter(Boolean),
      durationMs: Number(durationMs) || 0,
      famDetail: fam
    });
  }
  return out;
}

function evaluationScore_(ranked, photoId) {
  var idx = ranked.indexOf(photoId);
  if (idx === -1) return 0;
  return SELECT_COUNT - idx;
}

function mean_(arr) {
  if (!arr.length) return 0;
  var sum = 0;
  for (var i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function stddev_(arr) {
  if (arr.length < 2) return 0;
  var m = mean_(arr);
  var acc = 0;
  for (var i = 0; i < arr.length; i++) {
    var d = arr[i] - m;
    acc += d * d;
  }
  return Math.sqrt(acc / (arr.length - 1));
}

function computePhotoStats_(responses) {
  var n = responses.length;
  var stats = {};
  for (var p = 0; p < PHOTO_IDS.length; p++) {
    var id = PHOTO_IDS[p];
    stats[id] = {
      id: id,
      selectedCount: 0,
      numberOneCount: 0,
      rankSumWhenSelected: 0,
      evalScores: []
    };
  }

  for (var r = 0; r < responses.length; r++) {
    var ranked = responses[r].ranked;
    for (var i = 0; i < PHOTO_IDS.length; i++) {
      var pid = PHOTO_IDS[i];
      var score = evaluationScore_(ranked, pid);
      stats[pid].evalScores.push(score);
      if (score > 0) {
        stats[pid].selectedCount += 1;
        var rank = SELECT_COUNT - score + 1;
        stats[pid].rankSumWhenSelected += rank;
      }
    }
    if (ranked[0] && stats[ranked[0]]) {
      stats[ranked[0]].numberOneCount += 1;
    }
  }

  var rows = [];
  for (var j = 0; j < PHOTO_IDS.length; j++) {
    var s = stats[PHOTO_IDS[j]];
    var selectionRate = n ? s.selectedCount / n : 0;
    var rankScore = n ? mean_(s.evalScores) / SELECT_COUNT : 0;
    var finalScore = SELECTION_WEIGHT * selectionRate + RANK_WEIGHT * rankScore;
    var avgRankWhenSelected = s.selectedCount
      ? s.rankSumWhenSelected / s.selectedCount
      : null;
    rows.push({
      id: s.id,
      selectionRate: selectionRate,
      rankScore: rankScore,
      finalScore: finalScore,
      numberOneRate: n ? s.numberOneCount / n : 0,
      avgRankWhenSelected: avgRankWhenSelected,
      polarization: stddev_(s.evalScores),
      selectedCount: s.selectedCount,
      numberOneCount: s.numberOneCount
    });
  }

  rows.sort(function (a, b) {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.selectionRate !== a.selectionRate) return b.selectionRate - a.selectionRate;
    return b.numberOneRate - a.numberOneRate;
  });
  return { n: n, photos: rows };
}

function comparePayload_(ranked) {
  var responses = readResponses_();
  var computed = computePhotoStats_(responses);
  var topSix = computed.photos.slice(0, SELECT_COUNT).map(function (p) {
    return p.id;
  });
  var topSixSet = {};
  for (var i = 0; i < topSix.length; i++) topSixSet[topSix[i]] = true;

  var overlapCount = 0;
  for (var j = 0; j < ranked.length; j++) {
    if (topSixSet[ranked[j]]) overlapCount += 1;
  }

  var alignSum = 0;
  for (var k = 0; k < ranked.length; k++) {
    var row = null;
    for (var m = 0; m < computed.photos.length; m++) {
      if (computed.photos[m].id === ranked[k]) {
        row = computed.photos[m];
        break;
      }
    }
    var sel = row ? row.selectionRate : 0;
    var consensusRank = topSix.indexOf(ranked[k]);
    var rankBonus = 0;
    if (consensusRank !== -1) {
      var distance = Math.abs(consensusRank - k);
      rankBonus = (SELECT_COUNT - distance) / SELECT_COUNT * 0.25;
    }
    alignSum += Math.min(1, sel + rankBonus);
  }
  var alignmentScore = ranked.length ? alignSum / ranked.length : 0;

  var consensusNumberOne = computed.photos
    .slice()
    .sort(function (a, b) {
      return b.numberOneRate - a.numberOneRate;
    })[0];

  var userTop = ranked[0] || null;
  return {
    n: computed.n,
    overlapCount: overlapCount,
    alignmentScore: alignmentScore,
    top1IsConsensus: !!(userTop && consensusNumberOne && userTop === consensusNumberOne.id),
    top1InGroupTop6: !!(userTop && topSixSet[userTop])
  };
}

function filterGroup_(responses, group) {
  var out = [];
  for (var i = 0; i < responses.length; i++) {
    if (responses[i].familiarityGroup === group) out.push(responses[i]);
  }
  return out;
}

function topIds_(photos) {
  return photos.slice(0, SELECT_COUNT).map(function (p) { return p.id; });
}

function overlapIds_(a, b) {
  var set = {};
  for (var i = 0; i < a.length; i++) set[a[i]] = true;
  var count = 0;
  for (var j = 0; j < b.length; j++) if (set[b[j]]) count += 1;
  return count;
}

function selectionDeltaRows_(knowsPhotos, strangerPhotos) {
  var strangerMap = {};
  for (var i = 0; i < strangerPhotos.length; i++) {
    strangerMap[strangerPhotos[i].id] = strangerPhotos[i];
  }
  var rows = [];
  for (var j = 0; j < knowsPhotos.length; j++) {
    var k = knowsPhotos[j];
    var s = strangerMap[k.id] || { selectionRate: 0, finalScore: 0, numberOneRate: 0 };
    rows.push({
      id: k.id,
      knowsSelectionRate: k.selectionRate,
      strangerSelectionRate: s.selectionRate,
      deltaSelection: k.selectionRate - s.selectionRate,
      knowsFinalScore: k.finalScore,
      strangerFinalScore: s.finalScore,
      deltaFinal: k.finalScore - s.finalScore,
      knowsNumberOneRate: k.numberOneRate,
      strangerNumberOneRate: s.numberOneRate
    });
  }
  rows.sort(function (a, b) {
    return Math.abs(b.deltaSelection) - Math.abs(a.deltaSelection);
  });
  return rows;
}

function countAnswers_(responses, key) {
  var counts = {};
  for (var i = 0; i < responses.length; i++) {
    var val = responses[i][key];
    if (!val) continue;
    counts[val] = (counts[val] || 0) + 1;
  }
  return Object.keys(counts)
    .map(function (id) { return { id: id, count: counts[id] }; })
    .sort(function (a, b) { return b.count - a.count; });
}

function computeAdmin_() {
  var responses = readResponses_();
  var computed = computePhotoStats_(responses);
  var photos = computed.photos;

  var knows = filterGroup_(responses, "knows");
  var strangers = filterGroup_(responses, "stranger");
  var mixed = filterGroup_(responses, "mixed");

  var knowsStats = computePhotoStats_(knows);
  var strangerStats = computePhotoStats_(strangers);

  var knowsTop = topIds_(knowsStats.photos);
  var strangerTop = topIds_(strangerStats.photos);

  var mostNumberOne = photos.slice().sort(function (a, b) {
    if (b.numberOneRate !== a.numberOneRate) return b.numberOneRate - a.numberOneRate;
    return b.selectionRate - a.selectionRate;
  });

  var weakest = photos.slice().sort(function (a, b) {
    if (a.finalScore !== b.finalScore) return a.finalScore - b.finalScore;
    return a.selectionRate - b.selectionRate;
  });

  var mostPolarized = photos.slice().sort(function (a, b) {
    return b.polarization - a.polarization;
  });

  var mustGoCounts = {};
  var appearanceVals = [];
  var personalityVals = [];
  var famScores = [];
  for (var i = 0; i < responses.length; i++) {
    var mg = responses[i].mustGo;
    if (mg) mustGoCounts[mg] = (mustGoCounts[mg] || 0) + 1;
    if (responses[i].appearance) appearanceVals.push(responses[i].appearance);
    if (responses[i].personality) personalityVals.push(responses[i].personality);
    if (responses[i].familiarityScore != null && !isNaN(responses[i].familiarityScore)) {
      famScores.push(responses[i].familiarityScore);
    }
  }

  var mustGo = Object.keys(mustGoCounts)
    .map(function (id) { return { id: id, count: mustGoCounts[id] }; })
    .sort(function (a, b) { return b.count - a.count; });

  function positiveRate(arr) {
    if (!arr.length) return 0;
    var hits = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i] >= 3) hits += 1;
    return hits / arr.length;
  }

  var deltas = selectionDeltaRows_(knowsStats.photos, strangerStats.photos);
  var favoredByKnows = deltas.slice().sort(function (a, b) {
    return b.deltaSelection - a.deltaSelection;
  }).slice(0, 6);
  var favoredByStrangers = deltas.slice().sort(function (a, b) {
    return a.deltaSelection - b.deltaSelection;
  }).slice(0, 6);

  var scored = [];
  for (var s = 0; s < responses.length; s++) {
    if (responses[s].familiarityScore != null && !isNaN(responses[s].familiarityScore)) {
      scored.push(responses[s]);
    }
  }

  var leastFamiliar = null;
  if (scored.length) {
    var minScore = scored[0].familiarityScore;
    for (var m = 1; m < scored.length; m++) {
      if (scored[m].familiarityScore < minScore) minScore = scored[m].familiarityScore;
    }
    var tied = [];
    for (var t = 0; t < scored.length; t++) {
      if (scored[t].familiarityScore === minScore) tied.push(scored[t]);
    }

    var orderedTop = [];
    if (tied.length === 1) {
      for (var r = 0; r < tied[0].ranked.length; r++) {
        orderedTop.push({
          id: tied[0].ranked[r],
          rank: r + 1,
          selectionRate: null,
          finalScore: null
        });
      }
    } else {
      var tiedStats = computePhotoStats_(tied);
      for (var x = 0; x < SELECT_COUNT && x < tiedStats.photos.length; x++) {
        orderedTop.push({
          id: tiedStats.photos[x].id,
          rank: x + 1,
          selectionRate: tiedStats.photos[x].selectionRate,
          finalScore: tiedStats.photos[x].finalScore
        });
      }
    }

    leastFamiliar = {
      minScore: minScore,
      tiedCount: tied.length,
      source: tied.length === 1 ? "single" : "tie",
      topSix: orderedTop,
      strangerGroupTopSix: strangerStats.photos.slice(0, SELECT_COUNT).map(function (p, idx) {
        return {
          id: p.id,
          rank: idx + 1,
          selectionRate: p.selectionRate,
          finalScore: p.finalScore
        };
      })
    };
  }

  var knownN = knows.length + mixed.length + strangers.length;
  var knowsPercent = knownN ? knows.length / knownN : 0;
  var strangerPercent = knownN ? strangers.length / knownN : 0;

  var mustGoWithRate = mustGo.map(function (item) {
    return {
      id: item.id,
      count: item.count,
      rate: computed.n ? item.count / computed.n : 0
    };
  });

  return {
    n: computed.n,
    photos: photos,
    topSix: photos.slice(0, SELECT_COUNT),
    mostNumberOne: mostNumberOne,
    weakest: weakest,
    mostPolarized: mostPolarized,
    mustGo: mustGoWithRate,
    foodAnswers: countAnswers_(responses, "food"),
    phraseAnswers: countAnswers_(responses, "phrase"),
    calibration: {
      appearanceAvg: appearanceVals.length ? mean_(appearanceVals) : null,
      personalityAvg: personalityVals.length ? mean_(personalityVals) : null,
      appearancePositiveRate: positiveRate(appearanceVals),
      personalityPositiveRate: positiveRate(personalityVals)
    },
    leastFamiliar: leastFamiliar,
    familiarity: {
      avgScore: famScores.length ? mean_(famScores) : null,
      knowsPercent: knowsPercent,
      strangerPercent: strangerPercent,
      mixedPercent: knownN ? mixed.length / knownN : 0,
      counts: {
        knows: knows.length,
        mixed: mixed.length,
        stranger: strangers.length,
        unknown: filterGroup_(responses, "unknown").length
      },
      knowsTopSix: knowsStats.photos.slice(0, SELECT_COUNT),
      strangerTopSix: strangerStats.photos.slice(0, SELECT_COUNT),
      topSixOverlap: overlapIds_(knowsTop, strangerTop),
      favoredByKnows: favoredByKnows,
      favoredByStrangers: favoredByStrangers,
      largestGaps: deltas.slice(0, 8)
    },
    weights: {
      selection: SELECTION_WEIGHT,
      rank: RANK_WEIGHT
    },
    glossary: {
      selectionRate: "Share of all respondents who put this photo in their top 6.",
      finalScore: "0.7 x selection rate + 0.3 x rank strength. Consensus beats enthusiasm.",
      numberOneRate: "Share of respondents who ranked this photo as their single favorite.",
      polarization: "How split people are. Low = agreement. High = love-it or leave-it.",
      familiarity: "Secret score from food + phrase asides. 3-4 = knows you, 0-1 = stranger."
    }
  };
}

function smokeTest() {
  var sheet = getSheet_();
  Logger.log("Sheet ready: " + sheet.getName());
  Logger.log(JSON.stringify(scoreFamiliarity_("bagel", "verbose_exit")));
  Logger.log(JSON.stringify(scoreFamiliarity_("mushroom_soup", "polite_exit")));
}
