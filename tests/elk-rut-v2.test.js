"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const v2 = require("../api/live-v2.js")._test;
const legacy = require("../api/live.js")._test;

test("corrected sunset stays on the requested Rocky Mountain local date", () => {
  const ymd = "2026-09-12";
  const sunset = v2.correctedSunTime(ymd, legacy.ZONES.east.lat, legacy.ZONES.east.lon, false);
  assert.ok(sunset);
  assert.equal(legacy.localParts(sunset).ymd, ymd);
});

test("corrected sunrise stays on the requested Rocky Mountain local date", () => {
  const ymd = "2026-09-12";
  const sunrise = v2.correctedSunTime(ymd, legacy.ZONES.east.lat, legacy.ZONES.east.lon, true);
  assert.ok(sunrise);
  assert.equal(legacy.localParts(sunrise).ymd, ymd);
});

test("upcoming windows are chronological and include same-day dusk", () => {
  const now = new Date("2026-09-11T18:00:00Z");
  const windows = v2.makeWindows("2026-09-11", now, { east: null, west: null });
  assert.equal(windows.length, 6);
  assert.equal(windows[0].key, "2026-09-11-dusk");
  for (let i = 1; i < windows.length; i++) {
    assert.ok(new Date(windows[i - 1].start).getTime() <= new Date(windows[i].start).getTime());
  }
});
