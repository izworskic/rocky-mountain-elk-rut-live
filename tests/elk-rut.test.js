const test = require("node:test");
const assert = require("node:assert/strict");
const elk = require("../api/live.js")._test;

test("rut season peaks from mid-September into mid-October", () => {
  assert.ok(elk.seasonScore("2026-09-25") >= 95);
  assert.ok(elk.seasonScore("2026-10-10") >= 95);
  assert.ok(elk.seasonScore("2026-07-01") <= 20);
  assert.ok(elk.seasonScore("2026-11-08") < 30);
});

test("Moraine Park uses the Bear Lake Road timed-entry window", () => {
  const moraine = elk.SPOTS.find(s => s.id === "moraine-park");
  const inside = new Date("2026-09-11T23:30:00Z"); // 5:30 PM MDT
  const outside = new Date("2026-09-12T00:30:00Z"); // 6:30 PM MDT
  assert.match(elk.accessAdvice(moraine, inside).status, /required/i);
  assert.match(elk.accessAdvice(moraine, outside).status, /outside/i);
});

test("Horseshoe Park evening window is outside standard timed entry", () => {
  const horseshoe = elk.SPOTS.find(s => s.id === "horseshoe-park");
  const evening = new Date("2026-09-11T23:30:00Z");
  assert.match(elk.accessAdvice(horseshoe, evening).status, /outside/i);
});

test("solar math produces plausible September sunrise and sunset in RMNP", () => {
  const z = elk.ZONES.east;
  const sunrise = elk.sunTime("2026-09-11", z.lat, z.lon, true);
  const sunset = elk.sunTime("2026-09-11", z.lat, z.lon, false);
  assert.ok(sunrise instanceof Date);
  assert.ok(sunset instanceof Date);
  const sr = elk.localParts(sunrise);
  const ss = elk.localParts(sunset);
  assert.ok(sr.hour >= 6 && sr.hour <= 7, `sunrise hour ${sr.hour}`);
  assert.ok(ss.hour >= 18 && ss.hour <= 20, `sunset hour ${ss.hour}`);
});

test("weather score rewards quieter and drier viewing conditions", () => {
  const calm = elk.weatherQuality([{
    temperature: 44,
    windSpeed: "5 mph",
    probabilityOfPrecipitation: { value: 5 },
    shortForecast: "Clear",
  }]);
  const rough = elk.weatherQuality([{
    temperature: 58,
    windSpeed: "30 mph",
    probabilityOfPrecipitation: { value: 80 },
    shortForecast: "Thunderstorms",
  }]);
  assert.ok(calm.score > rough.score);
});


test("hazardous weather caps the visitor-facing score even during peak rut", () => {
  assert.equal(elk.combinedScore(96, 50, "thunder"), 55);
  assert.equal(elk.combinedScore(96, 55, "winter"), 50);
  assert.equal(elk.combinedScore(96, 60, "visibility"), 68);
});

test("low visitor-quality scores are not mislabeled as off-peak rut", () => {
  assert.equal(elk.scoreLabel(54), "Poor");
  assert.equal(elk.scoreLabel(63), "Marginal");
});
