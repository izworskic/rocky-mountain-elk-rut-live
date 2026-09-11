import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("public/national-tools/elk-rut/index.html", "utf8");
const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";
const description = html.match(/<meta name="description" content="([^"]*)"/i)?.[1] || "";

assert.ok(title.length > 0 && title.length <= 60, `title length=${title.length}`);
assert.ok(description.length > 0 && description.length <= 158, `description length=${description.length}`);
assert.match(html, /https:\/\/chrisizworski\.com\/national-tools\/elk-rut\//);
assert.match(html, /G-Y5D2V2W7HN/);
assert.match(html, /ca-pub-8222782620788075/);
assert.match(html, /https:\/\/chrisizworski\.com\/#person/);
assert.match(html, /\/national-tools\/elk-rut\/_api\/live/);
assert.match(html, /\/api\/live/);
assert.match(html, /Stay at least 75 feet/);
assert.match(html, /5:00 AM–6:00 PM/);
assert.match(html, /9:00 AM–2:00 PM/);
console.log(`Static verification: PASS | title=${title.length} | description=${description.length}`);
