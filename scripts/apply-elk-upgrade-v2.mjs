import fs from 'node:fs';

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing replacement anchor: ${label}`);
  return source.replace(from, to);
}

const apiPath = 'api/live.js';
let api = fs.readFileSync(apiPath, 'utf8');

api = replaceOnce(api,
`  let conditionMultiplier = 1;
  if (/thunder|severe/.test(text)) conditionMultiplier = 0.62;
  else if (/fog|dense fog/.test(text)) conditionMultiplier = 0.78;
  else if (/heavy snow|blizzard/.test(text)) conditionMultiplier = 0.70;

  const score = round((0.25 * tempScore + 0.35 * windScore + 0.40 * precipScore) * conditionMultiplier);
  const summary = periods[0]?.shortForecast || "NWS hourly forecast";
  return {
    score: clamp(score, 0, 100),
    temperature: temp == null ? null : round(temp),
    windMph: wind == null ? null : round(wind),
    precipChance: pop == null ? null : round(pop),
    summary,
  };`,
`  let conditionMultiplier = 1;
  let hazard = null;
  if (/thunder|severe/.test(text)) {
    conditionMultiplier = 0.62;
    hazard = "thunder";
  } else if (/heavy snow|blizzard/.test(text)) {
    conditionMultiplier = 0.70;
    hazard = "winter";
  } else if (/fog|dense fog/.test(text)) {
    conditionMultiplier = 0.78;
    hazard = "visibility";
  }

  const score = round((0.25 * tempScore + 0.35 * windScore + 0.40 * precipScore) * conditionMultiplier);
  const summary = periods[0]?.shortForecast || "NWS hourly forecast";
  return {
    score: clamp(score, 0, 100),
    temperature: temp == null ? null : round(temp),
    windMph: wind == null ? null : round(wind),
    precipChance: pop == null ? null : round(pop),
    summary,
    hazard,
  };`, 'weather hazard');

api = replaceOnce(api,
`function combinedScore(rutScore, weatherScore) {
  if (weatherScore == null) return rutScore;
  return round(0.72 * rutScore + 0.28 * weatherScore);
}

function scoreLabel(score) {
  if (score >= 90) return "Prime";
  if (score >= 82) return "Excellent";
  if (score >= 72) return "Good";
  if (score >= 58) return "Fair";
  return "Off peak";
}`,
`function combinedScore(rutScore, weatherScore, hazard = null) {
  if (weatherScore == null) return rutScore;
  let score = round(0.72 * rutScore + 0.28 * weatherScore);
  if (hazard === "thunder") score = Math.min(score, 55);
  else if (hazard === "winter") score = Math.min(score, 50);
  else if (hazard === "visibility") score = Math.min(score, 68);
  return score;
}

function scoreLabel(score) {
  if (score >= 90) return "Prime";
  if (score >= 82) return "Excellent";
  if (score >= 72) return "Good";
  if (score >= 58) return "Marginal";
  return "Poor";
}`,'score caps');

api = api.replaceAll('combinedScore(rut, eastWeather.score)', 'combinedScore(rut, eastWeather.score, eastWeather.hazard)');
api = api.replaceAll('combinedScore(rut, westWeather.score)', 'combinedScore(rut, westWeather.score, westWeather.hazard)');
api = api.replace('combinedScore(window.rutSeasonScore, zoneWeather.score)', 'combinedScore(window.rutSeasonScore, zoneWeather.score, zoneWeather.hazard)');
api = api.replace('const future = windows.filter(w => w.end.getTime() > now.getTime() - 15 * 60000).slice(0, 6);', 'const future = windows.filter(w => w.end.getTime() > now.getTime()).slice(0, 6);');

api = replaceOnce(api,
`  const windows = makeWindows(todayYmd, now, forecasts);
  const primary = windows[0] || null;
  const spots = spotPayload(primary, forecasts);`,
`  const windows = makeWindows(todayYmd, now, forecasts);
  const nextWindow = windows[0] || null;
  const decisionHorizon = windows.filter(w => new Date(w.start).getTime() <= now.getTime() + 42 * 3600000);
  const primary = (decisionHorizon.length ? decisionHorizon : windows).reduce((best, w) => !best || w.score > best.score ? w : best, null);
  const spots = spotPayload(primary, forecasts);`, 'primary choice');

api = replaceOnce(api,
`    primary,
    windows,
    spots,`,
`    primary,
    nextWindow,
    windows,
    spots,`, 'payload nextWindow');
api = api.replace('  combinedScore,\n  accessAdvice,', '  combinedScore,\n  scoreLabel,\n  accessAdvice,');
fs.writeFileSync(apiPath, api);

const testPath = 'tests/elk-rut.test.js';
let tests = fs.readFileSync(testPath, 'utf8');
if (!tests.includes('hazardous weather caps the visitor-facing score')) {
  tests += `\n\ntest("hazardous weather caps the visitor-facing score even during peak rut", () => {\n  assert.equal(elk.combinedScore(96, 50, "thunder"), 55);\n  assert.equal(elk.combinedScore(96, 55, "winter"), 50);\n  assert.equal(elk.combinedScore(96, 60, "visibility"), 68);\n});\n\ntest("low visitor-quality scores are not mislabeled as off-peak rut", () => {\n  assert.equal(elk.scoreLabel(54), "Poor");\n  assert.equal(elk.scoreLabel(63), "Marginal");\n});\n`;
}
fs.writeFileSync(testPath, tests);

const pagePath = 'public/national-tools/elk-rut/index.html';
let page = fs.readFileSync(pagePath, 'utf8');

page = replaceOnce(page,
`.metric strong{display:block;font-size:.97rem;margin-top:3px}`,
`.metric strong{display:block;font-size:.97rem;margin-top:3px}
.decision-strip{display:grid;grid-template-columns:1.2fr .8fr;gap:10px;margin:14px 0 4px}
.choice-card{border:1px solid var(--line);border-radius:12px;padding:12px;background:#faf9f3}
.choice-card.best{background:var(--green-soft);border-color:#b9caba}
.choice-card span{display:block;font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:760}
.choice-card strong{display:block;margin-top:3px}
.choice-card small{display:block;color:var(--muted);margin-top:3px}
.action-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.action-link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:1px solid #bfc8bf;border-radius:9px;padding:8px 10px;font-size:.82rem;font-weight:760;background:#fff}
.action-link.primary{background:var(--forest);border-color:var(--forest);color:#fff}
.countdown{font-size:.82rem;font-weight:760;color:var(--forest);margin-top:7px}
.spot-fit{font-weight:800;color:var(--forest);font-size:.83rem;text-align:right}
.spot-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.spot-actions a{font-size:.78rem;font-weight:740;text-underline-offset:3px}
.permit-release{margin-top:10px;padding:10px 11px;border-radius:10px;background:#fff8ed;color:#68401f;font-size:.82rem}`,
'css additions');
page = page.replace('  .metric-row{grid-template-columns:1fr}\n  .windows{grid-template-columns:1fr}', '  .metric-row,.decision-strip{grid-template-columns:1fr}\n  .windows{grid-template-columns:1fr}');

page = replaceOnce(page,
`      <div class="metric-row">
        <div class="metric"><span>Rut phase</span><strong id="metric-rut">--</strong></div>
        <div class="metric"><span>Forecast</span><strong id="metric-weather">--</strong></div>
        <div class="metric"><span>Confidence</span><strong id="metric-confidence">--</strong></div>
      </div>`,
`      <div class="metric-row">
        <div class="metric"><span>Rut phase</span><strong id="metric-rut">--</strong></div>
        <div class="metric"><span>Forecast</span><strong id="metric-weather">--</strong></div>
        <div class="metric"><span>Confidence</span><strong id="metric-confidence">--</strong></div>
      </div>
      <div class="decision-strip">
        <div class="choice-card best"><span>Best within 42 hours</span><strong id="best-choice">Loading…</strong><small id="best-choice-detail"></small></div>
        <div class="choice-card"><span>Next window</span><strong id="next-choice">Loading…</strong><small id="next-choice-detail"></small></div>
      </div>`,
'choice cards');

page = replaceOnce(page,
`      <div class="arrival-time" id="arrival-time">--</div>
      <p id="arrival-copy">The recommended arrival builds in setup time before the crepuscular activity window.</p>`,
`      <div class="arrival-time" id="arrival-time">--</div>
      <div class="countdown" id="arrival-countdown">Calculating time to arrival…</div>
      <p id="arrival-copy">The recommended arrival builds in setup time before the crepuscular activity window.</p>`,
'arrival countdown');

page = replaceOnce(page,
`      <p id="access-detail" style="margin-top:12px">Moraine Park has different timed-entry rules from most of the park.</p>`,
`      <p id="access-detail" style="margin-top:12px">Moraine Park has different timed-entry rules from most of the park.</p>
      <div class="permit-release"><strong>No reservation yet?</strong> Additional next-day timed-entry reservations are released at <strong>7:00 PM MDT</strong> on Recreation.gov, subject to availability.</div>
      <div class="action-row"><a class="action-link primary" href="https://www.recreation.gov/timed-entry/10086986" target="_blank" rel="noopener">Timed entry ↗</a><a class="action-link" href="https://www.nps.gov/romo/learn/photosmultimedia/webcams.htm" target="_blank" rel="noopener">NPS webcams ↗</a></div>`,
'permit actions');

page = page.replace('Best elk viewing areas for the next window', 'Best planning fits for the recommended window');
page = page.replace('Scores combine the same rut/weather window with a small destination preference. They do not imply that elk are currently standing in a specific meadow.', 'These are planning fits, not live elk-location scores. Weather, access and the meadow’s viewing usefulness shape the order; elk can move anywhere.');
page = page.replace('<div class="spot-head"><div><h3>${esc(s.name)}</h3><div class="place">${esc(s.place)}</div></div><div class="spot-score">${esc(s.score)}/100</div></div>', '<div class="spot-head"><div><h3>${esc(s.name)}</h3><div class="place">${esc(s.place)}</div></div><div class="spot-fit">${esc(s.scoreLabel)} fit</div></div>');
page = page.replace('    <p>${esc(s.note)}</p>\n    <div class="access">', '    <p>${esc(s.note)}</p>\n    <div class="spot-actions"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(s.lat) + "," + String(s.lon))}" target="_blank" rel="noopener">Open map ↗</a>${s.id === "harbison-meadow" ? "<a href=\\"https://www.nps.gov/romo/learn/photosmultimedia/webcams.htm\\" target=\\"_blank\\" rel=\\"noopener\\">Check Kawuneeche webcam ↗</a>" : ""}</div>\n    <div class="access">');

page = replaceOnce(page,
`function renderPrimary(data) {
  const w = data.primary;`,
`let countdownTimer = null;
function countdownText(targetIso) {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (!Number.isFinite(diff)) return "";
  if (diff <= 0) return "Recommended arrival time has passed — use current conditions and go only if access still works.";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return "Leave soon: recommended arrival in " + mins + " min";
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return "Recommended arrival in " + hours + " hr" + (hours === 1 ? "" : "s") + (rem ? " " + rem + " min" : "");
}

function renderPrimary(data) {
  const w = data.primary;`,
'countdown function');

page = replaceOnce(page,
`  $("primary-verdict").textContent =
    w.score >= 82 ? "This is a strong window to choose if you can make the access logistics work." :
    w.score >= 72 ? "A worthwhile window, though conditions are not quite at the top tier." :
    "The rut is active seasonally, but this window has meaningful tradeoffs.";`,
`  const hazard = w.weather?.[w.bestZone]?.hazard;
  $("primary-verdict").textContent = hazard
    ? "The rut may be strong, but the live weather creates a real viewing tradeoff. The score is intentionally capped so seasonality cannot hide that."
    : w.score >= 82 ? "This is the strongest near-term choice if the access logistics work for you."
    : w.score >= 72 ? "A worthwhile near-term choice, though another window may be close enough to compare."
    : "The rut is active seasonally, but this window has meaningful visitor-condition tradeoffs.";`,
'verdict');

page = replaceOnce(page,
`  $("arrival-time").textContent = w.arrivalLabel;

  const moraine`,
`  $("arrival-time").textContent = w.arrivalLabel;
  const next = data.nextWindow || data.windows?.[0] || w;
  const same = next?.key === w.key;
  $("best-choice").textContent = w.date + " " + w.period + " · " + w.score + "/100";
  $("best-choice-detail").textContent = w.startLabel + "–" + w.endLabel + " · " + (w.bestZone === "west" ? "West side" : "East side") + " favored";
  $("next-choice").textContent = next.date + " " + next.period + " · " + next.score + "/100";
  $("next-choice-detail").textContent = same ? "The next window is also the best near-term choice." : next.startLabel + "–" + next.endLabel + " · " + (w.score > next.score ? (w.score - next.score) + " points below the best" : "Comparable to the best");
  const updateCountdown = () => { $("arrival-countdown").textContent = countdownText(w.arrival); };
  updateCountdown();
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(updateCountdown, 60000);

  const moraine`,
'primary comparison');

page = page.replace('$("primary-title").textContent = `${w.label} elk-rut viewing window`;', '$("primary-title").textContent = w.label + ": " + w.date + " " + w.period + " is the best near-term window";');
fs.writeFileSync(pagePath, page);
