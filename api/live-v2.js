"use strict";

const legacy = require("./live.js");
const t = legacy._test;

const TZ = "America/Denver";
const UA = "ChrisIzworskiElkRut/2.0 (+https://chrisizworski.com/national-tools/elk-rut/)";

const SOURCES = [
  { name: "NPS — Watching Elk", url: "https://www.nps.gov/thingstodo/romo_watchelk.htm", role: "rut season, meadow closures and 75-foot wildlife distance" },
  { name: "NPS — 2026 Timed Entry", url: "https://www.nps.gov/romo/planyourvisit/timed-entry-permit-system.htm", role: "Bear Lake Road and rest-of-park reservation hours" },
  { name: "NPS — Webcams", url: "https://www.nps.gov/romo/learn/photosmultimedia/webcams.htm", role: "entrance, alpine and Kawuneeche Valley cameras" },
  { name: "National Weather Service", url: "https://www.weather.gov/", role: "hourly weather forecast" },
];

function shiftMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function correctedSunTime(ymd, lat, lon, isSunrise) {
  let date = t.sunTime(ymd, lat, lon, isSunrise);
  if (!date) return null;

  for (let i = 0; i < 3; i++) {
    const localYmd = t.localParts(date).ymd;
    if (localYmd === ymd) return date;
    date = new Date(date.getTime() + (localYmd < ymd ? 86400000 : -86400000));
  }
  return date;
}

function scoreLabel(score) {
  if (score >= 90) return "Prime";
  if (score >= 82) return "Excellent";
  if (score >= 72) return "Good";
  if (score >= 58) return "Fair";
  return "Off peak";
}

function confidenceFor(hoursAhead, hasWeather) {
  if (!hasWeather) return "Seasonal only";
  if (hoursAhead <= 18) return "High";
  if (hoursAhead <= 42) return "Medium-high";
  if (hoursAhead <= 66) return "Medium";
  return "Lower";
}

async function fetchJson(url, timeout = 6500) {
  const response = await fetch(url, {
    headers: {
      accept: "application/geo+json, application/json",
      "user-agent": UA,
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  return response.json();
}

async function fetchZoneForecast(zone) {
  const pointUrl = `https://api.weather.gov/points/${zone.lat.toFixed(4)},${zone.lon.toFixed(4)}`;
  const point = await fetchJson(pointUrl);
  const hourlyUrl = point?.properties?.forecastHourly;
  if (!hourlyUrl) throw new Error("NWS point response did not include hourly forecast URL");
  const forecast = await fetchJson(hourlyUrl);
  return {
    zone: zone.id,
    source: hourlyUrl,
    updated: forecast?.properties?.updateTime || null,
    periods: forecast?.properties?.periods || [],
  };
}

function periodsForWindow(forecast, start, end) {
  if (!forecast?.periods?.length) return [];
  const padStart = start.getTime() - 45 * 60000;
  const padEnd = end.getTime() + 45 * 60000;
  return forecast.periods.filter(period => {
    const ts = new Date(period.startTime).getTime();
    return ts >= padStart && ts <= padEnd;
  });
}

function makeWindows(todayYmd, now, forecasts) {
  const windows = [];
  const zone = t.ZONES.east;

  for (let offset = 0; offset < 4; offset++) {
    const ymd = t.addDays(todayYmd, offset);
    const sunrise = correctedSunTime(ymd, zone.lat, zone.lon, true);
    const sunset = correctedSunTime(ymd, zone.lat, zone.lon, false);

    if (sunrise) {
      windows.push({
        key: `${ymd}-dawn`,
        ymd,
        period: "Dawn",
        start: shiftMinutes(sunrise, -75),
        end: shiftMinutes(sunrise, 75),
        anchor: sunrise,
        recommendedArrival: shiftMinutes(sunrise, -105),
      });
    }

    if (sunset) {
      windows.push({
        key: `${ymd}-dusk`,
        ymd,
        period: "Dusk",
        start: shiftMinutes(sunset, -75),
        end: shiftMinutes(sunset, 90),
        anchor: sunset,
        recommendedArrival: shiftMinutes(sunset, -105),
      });
    }
  }

  return windows
    .filter(w => w.end.getTime() > now.getTime() - 15 * 60000)
    .sort((a, b) => a.start - b.start)
    .slice(0, 6)
    .map(w => {
      const rut = t.seasonScore(w.ymd);
      const eastWeather = t.weatherQuality(periodsForWindow(forecasts.east, w.start, w.end));
      const westWeather = t.weatherQuality(periodsForWindow(forecasts.west, w.start, w.end));
      const eastScore = t.combinedScore(rut, eastWeather.score);
      const westScore = t.combinedScore(rut, westWeather.score);
      const bestZone = westScore > eastScore + 2 ? "west" : "east";
      const bestWeather = bestZone === "west" ? westWeather : eastWeather;
      const score = bestZone === "west" ? westScore : eastScore;
      const hoursAhead = Math.max(0, (w.start.getTime() - now.getTime()) / 3600000);

      return {
        key: w.key,
        date: formatDate(w.anchor),
        ymd: w.ymd,
        period: w.period,
        start: w.start.toISOString(),
        end: w.end.toISOString(),
        anchor: w.anchor.toISOString(),
        startLabel: formatTime(w.start),
        endLabel: formatTime(w.end),
        anchorLabel: formatTime(w.anchor),
        arrival: w.recommendedArrival.toISOString(),
        arrivalLabel: formatTime(w.recommendedArrival),
        rutSeasonScore: rut,
        score,
        label: scoreLabel(score),
        bestZone,
        confidence: confidenceFor(hoursAhead, bestWeather.score != null),
        weather: { east: eastWeather, west: westWeather },
      };
    });
}

function spotPayload(window) {
  if (!window) return t.SPOTS.map(spot => ({ ...spot }));

  return t.SPOTS.map(spot => {
    const zoneWeather = window.weather?.[spot.zone] || {};
    const zoneScore = t.combinedScore(window.rutSeasonScore, zoneWeather.score);
    const access = t.accessAdvice(spot, new Date(window.arrival));
    const score = Math.max(0, Math.min(100, Math.round(zoneScore * 0.92 + spot.rank * 0.08)));
    return {
      ...spot,
      score,
      scoreLabel: scoreLabel(score),
      access,
      closure: "Sep. 1–Oct. 31: designated rut meadows are closed to foot travel from 5:00 PM–10:00 AM. Observe from established roads/trails and posted viewing areas.",
    };
  }).sort((a, b) => b.score - a.score);
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1800");

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const now = new Date();
  const todayYmd = t.currentLocalDate(now);
  const results = await Promise.allSettled([
    fetchZoneForecast(t.ZONES.east),
    fetchZoneForecast(t.ZONES.west),
  ]);

  const forecasts = { east: null, west: null };
  const errors = [];

  if (results[0].status === "fulfilled") forecasts.east = results[0].value;
  else errors.push(`east forecast: ${String(results[0].reason?.message || results[0].reason)}`);

  if (results[1].status === "fulfilled") forecasts.west = results[1].value;
  else errors.push(`west forecast: ${String(results[1].reason?.message || results[1].reason)}`);

  const windows = makeWindows(todayYmd, now, forecasts);
  const primary = windows[0] || null;
  const spots = spotPayload(primary);

  const payload = {
    generatedAt: now.toISOString(),
    localDate: todayYmd,
    timezone: TZ,
    title: "Rocky Mountain Elk Rut Live",
    mode: errors.length ? "degraded" : "live",
    dataNote: errors.length
      ? "One or more NWS feeds are temporarily unavailable. Rut timing still uses the NPS seasonal baseline and solar windows; missing weather is not guessed."
      : "Live NWS hourly forecasts are blended with the NPS rut-season baseline for decision support.",
    errors: errors.map(x => x.slice(0, 180)),
    primary,
    windows,
    spots,
    recommendations: {
      classic: spots.find(s => s.id === "moraine-park"),
      easyAccess: spots.find(s => s.id === "horseshoe-park"),
      westSide: spots.find(s => s.id === "harbison-meadow"),
    },
    safety: {
      distance: "Stay at least 75 feet (two bus lengths) from elk.",
      closure: "From Sep. 1–Oct. 31, Horseshoe Park, Moraine Park, Upper Beaver Meadows, Harbison Meadow and Holzwarth Meadow are closed to foot travel from 5:00 PM–10:00 AM daily.",
      warning: "Bull elk can be aggressive during the rut. Never approach, surround, call to, feed or block wildlife.",
    },
    permit2026: {
      bearLake: "Timed Entry+ Bear Lake Road: required 5:00 AM–6:00 PM daily May 22–Oct. 18, 2026.",
      rest: "Timed Entry (rest of park): required 9:00 AM–2:00 PM daily May 22–Oct. 12, 2026.",
      release: "Additional next-day timed-entry reservations are released at 7:00 PM MDT on Recreation.gov, subject to availability.",
    },
    methodology: {
      statement: "The score is not a probability of seeing elk. It ranks dawn/dusk viewing windows using the seasonal rut phase (72%) and forecast viewing conditions (28%).",
      season: "Seasonal weighting follows NPS guidance that September and October are rut months, with peak rut generally from mid-September to mid-October.",
      weather: "Weather adjusts viewing quality using precipitation, wind (important for hearing bugles) and temperature comfort. It does not claim weather controls the rut.",
      uncertainty: "Wildlife behavior is variable. Road conditions, crowds, closures, predators and local herd movement can change what visitors actually observe.",
    },
    sources: SOURCES,
    weatherSources: Object.values(forecasts).filter(Boolean).map(f => ({ zone: f.zone, url: f.source, updated: f.updated })),
  };

  if (req.method === "HEAD") return res.status(200).end();
  return res.status(200).json(payload);
}

module.exports = handler;
module.exports._test = {
  correctedSunTime,
  makeWindows,
  spotPayload,
  scoreLabel,
};
