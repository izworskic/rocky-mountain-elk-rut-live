"use strict";

const TZ = "America/Denver";
const UA = "ChrisIzworskiElkRut/1.0 (+https://chrisizworski.com/national-tools/elk-rut/)";

const ZONES = {
  east: {
    id: "east",
    name: "East side / Estes Park",
    lat: 40.365,
    lon: -105.604,
  },
  west: {
    id: "west",
    name: "Kawuneeche Valley / Grand Lake",
    lat: 40.296,
    lon: -105.841,
  },
};

const SPOTS = [
  {
    id: "moraine-park",
    name: "Moraine Park",
    zone: "east",
    corridor: "bear-lake",
    rank: 100,
    place: "Bear Lake Road corridor",
    note: "The classic broad-meadow rut view. Strong sightlines and one of the park's best-known elk gathering areas.",
    lat: 40.356,
    lon: -105.604,
  },
  {
    id: "horseshoe-park",
    name: "Horseshoe Park",
    zone: "east",
    corridor: "rest",
    rank: 96,
    place: "Fall River / east side",
    note: "Wide meadow views with easy roadside observation. A strong alternative when Bear Lake Road access is inconvenient.",
    lat: 40.406,
    lon: -105.628,
  },
  {
    id: "upper-beaver-meadows",
    name: "Upper Beaver Meadows",
    zone: "east",
    corridor: "rest",
    rank: 90,
    place: "Beaver Meadows / east side",
    note: "Open meadow-edge habitat close to Estes Park, useful for an evening or dawn stop without entering Bear Lake Road.",
    lat: 40.365,
    lon: -105.577,
  },
  {
    id: "harbison-meadow",
    name: "Harbison Meadow",
    zone: "west",
    corridor: "rest",
    rank: 94,
    place: "Kawuneeche Valley / west side",
    note: "A west-side meadow just north of Grand Lake with an NPS webcam overlooking the valley.",
    lat: 40.271,
    lon: -105.837,
  },
  {
    id: "holzwarth-meadow",
    name: "Holzwarth Meadow",
    zone: "west",
    corridor: "rest",
    rank: 88,
    place: "Upper Kawuneeche Valley",
    note: "A quieter west-side rut area with broad valley habitat. Stay on established roads and trails during rut closures.",
    lat: 40.371,
    lon: -105.853,
  },
];

const SOURCES = [
  {
    name: "NPS — Watching Elk",
    url: "https://www.nps.gov/thingstodo/romo_watchelk.htm",
    role: "rut season, meadow closures and 75-foot wildlife distance",
  },
  {
    name: "NPS — 2026 Timed Entry",
    url: "https://www.nps.gov/romo/planyourvisit/timed-entry-permit-system.htm",
    role: "Bear Lake Road and rest-of-park reservation hours",
  },
  {
    name: "NPS — Webcams",
    url: "https://www.nps.gov/romo/learn/photosmultimedia/webcams.htm",
    role: "entrance, alpine and Kawuneeche Valley cameras",
  },
  {
    name: "National Weather Service",
    url: "https://www.weather.gov/",
    role: "hourly weather forecast",
  },
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function round(v) {
  return Math.round(v);
}

function parseYmd(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

function addDays(ymd, n) {
  const { year, month, day } = parseYmd(ymd);
  const d = new Date(Date.UTC(year, month - 1, day + n, 12));
  return d.toISOString().slice(0, 10);
}

function localParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const out = {};
  for (const p of parts) if (p.type !== "literal") out[p.type] = p.value;
  return {
    ymd: `${out.year}-${out.month}-${out.day}`,
    hour: Number(out.hour),
    minute: Number(out.minute),
  };
}

function currentLocalDate(now = new Date()) {
  return localParts(now).ymd;
}

function dayOfYear(ymd) {
  const { year, month, day } = parseYmd(ymd);
  const start = Date.UTC(year, 0, 0);
  const cur = Date.UTC(year, month - 1, day);
  return Math.floor((cur - start) / 86400000);
}

function normalizeDegrees(n) {
  let x = n % 360;
  if (x < 0) x += 360;
  return x;
}

function normalizeHours(n) {
  let x = n % 24;
  if (x < 0) x += 24;
  return x;
}

// NOAA-style sunrise/sunset approximation; output is UTC.
function sunTime(ymd, lat, lon, isSunrise) {
  const { year, month, day } = parseYmd(ymd);
  const N = dayOfYear(ymd);
  const lngHour = lon / 15;
  const t = N + ((isSunrise ? 6 : 18) - lngHour) / 24;
  const M = (0.9856 * t) - 3.289;
  let L = M + (1.916 * Math.sin(M * Math.PI / 180)) +
    (0.020 * Math.sin(2 * M * Math.PI / 180)) + 282.634;
  L = normalizeDegrees(L);

  let RA = Math.atan(0.91764 * Math.tan(L * Math.PI / 180)) * 180 / Math.PI;
  RA = normalizeDegrees(RA);
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = (RA + (Lquadrant - RAquadrant)) / 15;

  const sinDec = 0.39782 * Math.sin(L * Math.PI / 180);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (
    Math.cos(90.833 * Math.PI / 180) -
    (sinDec * Math.sin(lat * Math.PI / 180))
  ) / (cosDec * Math.cos(lat * Math.PI / 180));

  if (cosH > 1 || cosH < -1) return null;
  let H = Math.acos(cosH) * 180 / Math.PI;
  if (isSunrise) H = 360 - H;
  H /= 15;

  const T = H + RA - (0.06571 * t) - 6.622;
  const UT = normalizeHours(T - lngHour);
  const hours = Math.floor(UT);
  const minutesFloat = (UT - hours) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
}

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

function seasonScore(ymd) {
  const { month, day } = parseYmd(ymd);
  const md = month * 100 + day;
  if (md < 815 || md > 1110) return 14;
  if (md <= 831) {
    const p = (day - 15) / 16;
    return round(30 + clamp(p, 0, 1) * 25);
  }
  if (md <= 914) {
    const p = day / 14;
    return round(58 + clamp(p, 0, 1) * 30);
  }
  if (md <= 1015) return 96;
  if (md <= 1031) {
    const p = (day - 15) / 16;
    return round(88 - clamp(p, 0, 1) * 32);
  }
  const p = (day - 1) / 9;
  return round(42 - clamp(p, 0, 1) * 22);
}

function numericWindSpeed(text) {
  const nums = String(text || "").match(/\d+/g)?.map(Number) || [];
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function average(values) {
  const clean = values.filter(v => Number.isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
}

function weatherQuality(periods) {
  if (!periods?.length) {
    return {
      score: null,
      temperature: null,
      windMph: null,
      precipChance: null,
      summary: "Live weather unavailable",
    };
  }
  const temp = average(periods.map(p => Number(p.temperature)));
  const wind = average(periods.map(p => numericWindSpeed(p.windSpeed)));
  const pop = average(periods.map(p => Number(p.probabilityOfPrecipitation?.value ?? 0)));

  let tempScore = 72;
  if (temp != null) {
    if (temp >= 28 && temp <= 55) tempScore = 100;
    else if (temp >= 20 && temp <= 65) tempScore = 90;
    else if (temp >= 12 && temp <= 72) tempScore = 75;
    else tempScore = 58;
  }

  let windScore = 75;
  if (wind != null) {
    if (wind <= 8) windScore = 100;
    else if (wind <= 14) windScore = 90;
    else if (wind <= 20) windScore = 72;
    else if (wind <= 28) windScore = 48;
    else windScore = 28;
  }

  let precipScore = 80;
  if (pop != null) {
    if (pop <= 10) precipScore = 100;
    else if (pop <= 30) precipScore = 88;
    else if (pop <= 50) precipScore = 70;
    else if (pop <= 70) precipScore = 52;
    else precipScore = 35;
  }

  const text = periods.map(p => `${p.shortForecast || ""} ${p.detailedForecast || ""}`).join(" ").toLowerCase();
  let conditionMultiplier = 1;
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
  };
}

function combinedScore(rutScore, weatherScore, hazard = null) {
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
}

function confidenceFor(hoursAhead, hasWeather) {
  if (!hasWeather) return "Seasonal only";
  if (hoursAhead <= 18) return "High";
  if (hoursAhead <= 42) return "Medium-high";
  if (hoursAhead <= 66) return "Medium";
  return "Lower";
}

function isBetweenYmd(ymd, start, end) {
  return ymd >= start && ymd <= end;
}

function accessAdvice(spot, when) {
  const lp = localParts(when);
  const decimalHour = lp.hour + lp.minute / 60;
  if (spot.corridor === "bear-lake") {
    const active = isBetweenYmd(lp.ymd, "2026-05-22", "2026-10-18");
    if (active && decimalHour >= 5 && decimalHour < 18) {
      return {
        status: "Timed Entry+ required",
        tone: "permit",
        detail: "Bear Lake Road requires Timed Entry+ from 5:00 AM–6:00 PM through Oct. 18. Without one, cross the corridor checkpoint before 5:00 AM or enter after 6:00 PM.",
      };
    }
    return {
      status: "Outside timed-entry hours",
      tone: "open",
      detail: active
        ? "No Timed Entry+ is required before 5:00 AM or after 6:00 PM; normal park entrance requirements still apply."
        : "The 2026 Bear Lake Road timed-entry season is not active on this date; normal park entrance requirements still apply.",
    };
  }

  const active = isBetweenYmd(lp.ymd, "2026-05-22", "2026-10-12");
  if (active && decimalHour >= 9 && decimalHour < 14) {
    return {
      status: "Timed Entry required",
      tone: "permit",
      detail: "Most of RMNP requires Timed Entry from 9:00 AM–2:00 PM through Oct. 12. Dawn and evening rut windows normally fall outside those hours.",
    };
  }
  return {
    status: "Outside timed-entry hours",
    tone: "open",
    detail: active
      ? "This window falls before 9:00 AM or after 2:00 PM, outside the standard 2026 timed-entry reservation hours."
      : "The standard 2026 timed-entry season is not active on this date.",
  };
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
  const periods = forecast?.properties?.periods || [];
  return {
    zone: zone.id,
    source: hourlyUrl,
    updated: forecast?.properties?.updateTime || null,
    periods,
  };
}

function periodsForWindow(forecast, start, end) {
  if (!forecast?.periods?.length) return [];
  const padStart = start.getTime() - 45 * 60000;
  const padEnd = end.getTime() + 45 * 60000;
  return forecast.periods.filter(period => {
    const t = new Date(period.startTime).getTime();
    return t >= padStart && t <= padEnd;
  });
}

function makeWindows(todayYmd, now, forecasts) {
  const windows = [];
  const zone = ZONES.east;
  for (let offset = 0; offset < 3; offset++) {
    const ymd = addDays(todayYmd, offset);
    const sunrise = sunTime(ymd, zone.lat, zone.lon, true);
    const sunset = sunTime(ymd, zone.lat, zone.lon, false);
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

  const future = windows.filter(w => w.end.getTime() > now.getTime()).slice(0, 6);
  return future.map(w => {
    const rut = seasonScore(w.ymd);
    const eastPeriods = periodsForWindow(forecasts.east, w.start, w.end);
    const westPeriods = periodsForWindow(forecasts.west, w.start, w.end);
    const eastWeather = weatherQuality(eastPeriods);
    const westWeather = weatherQuality(westPeriods);
    const eastScore = combinedScore(rut, eastWeather.score, eastWeather.hazard);
    const westScore = combinedScore(rut, westWeather.score, westWeather.hazard);
    const bestZone = westScore > eastScore + 2 ? "west" : "east";
    const bestWeather = bestZone === "west" ? westWeather : eastWeather;
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
      score: bestZone === "west" ? westScore : eastScore,
      label: scoreLabel(bestZone === "west" ? westScore : eastScore),
      bestZone,
      confidence: confidenceFor(hoursAhead, bestWeather.score != null),
      weather: {
        east: eastWeather,
        west: westWeather,
      },
    };
  });
}

function spotPayload(window, forecasts) {
  if (!window) return SPOTS.map(spot => ({ ...spot }));
  return SPOTS.map(spot => {
    const zoneWeather = window.weather?.[spot.zone] || {};
    const zoneScore = combinedScore(window.rutSeasonScore, zoneWeather.score, zoneWeather.hazard);
    const access = accessAdvice(spot, new Date(window.arrival));
    const score = clamp(round(zoneScore * 0.92 + spot.rank * 0.08), 0, 100);
    return {
      ...spot,
      score,
      scoreLabel: scoreLabel(score),
      access,
      closure:
        "Sep. 1–Oct. 31: designated rut meadows are closed to foot travel from 5:00 PM–10:00 AM. Observe from established roads/trails and posted viewing areas.",
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
  const todayYmd = currentLocalDate(now);
  const results = await Promise.allSettled([
    fetchZoneForecast(ZONES.east),
    fetchZoneForecast(ZONES.west),
  ]);

  const forecasts = { east: null, west: null };
  const errors = [];
  if (results[0].status === "fulfilled") forecasts.east = results[0].value;
  else errors.push(`east forecast: ${String(results[0].reason?.message || results[0].reason)}`);
  if (results[1].status === "fulfilled") forecasts.west = results[1].value;
  else errors.push(`west forecast: ${String(results[1].reason?.message || results[1].reason)}`);

  const windows = makeWindows(todayYmd, now, forecasts);
  const nextWindow = windows[0] || null;
  const decisionHorizon = windows.filter(w => new Date(w.start).getTime() <= now.getTime() + 42 * 3600000);
  const primary = (decisionHorizon.length ? decisionHorizon : windows).reduce((best, w) => !best || w.score > best.score ? w : best, null);
  const spots = spotPayload(primary, forecasts);
  const classic = spots.find(s => s.id === "moraine-park");
  const easiest = spots.find(s => s.id === "horseshoe-park");
  const west = spots.find(s => s.id === "harbison-meadow");

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
    nextWindow,
    windows,
    spots,
    recommendations: {
      classic,
      easyAccess: easiest,
      westSide: west,
    },
    safety: {
      distance: "Stay at least 75 feet (two bus lengths) from elk.",
      closure:
        "From Sep. 1–Oct. 31, Horseshoe Park, Moraine Park, Upper Beaver Meadows, Harbison Meadow and Holzwarth Meadow are closed to foot travel from 5:00 PM–10:00 AM daily.",
      warning: "Bull elk can be aggressive during the rut. Never approach, surround, call to, feed or block wildlife.",
    },
    permit2026: {
      bearLake:
        "Timed Entry+ Bear Lake Road: required 5:00 AM–6:00 PM daily May 22–Oct. 18, 2026.",
      rest:
        "Timed Entry (rest of park): required 9:00 AM–2:00 PM daily May 22–Oct. 12, 2026.",
      release:
        "Additional next-day timed-entry reservations are released at 7:00 PM MDT on Recreation.gov, subject to availability.",
    },
    methodology: {
      statement:
        "The score is not a probability of seeing elk. It ranks dawn/dusk viewing windows using the seasonal rut phase (72%) and forecast viewing conditions (28%).",
      season:
        "Seasonal weighting follows NPS guidance that September and October are rut months, with peak rut generally from mid-September to mid-October.",
      weather:
        "Weather adjusts viewing quality using precipitation, wind (important for hearing bugles) and temperature comfort. It does not claim weather controls the rut.",
      uncertainty:
        "Wildlife behavior is variable. Road conditions, crowds, closures, predators and local herd movement can change what visitors actually observe.",
    },
    sources: SOURCES,
    weatherSources: Object.values(forecasts).filter(Boolean).map(f => ({
      zone: f.zone,
      url: f.source,
      updated: f.updated,
    })),
  };

  if (req.method === "HEAD") return res.status(200).end();
  return res.status(200).json(payload);
}

module.exports = handler;
module.exports._test = {
  seasonScore,
  sunTime,
  weatherQuality,
  combinedScore,
  scoreLabel,
  accessAdvice,
  localParts,
  currentLocalDate,
  addDays,
  ZONES,
  SPOTS,
};
