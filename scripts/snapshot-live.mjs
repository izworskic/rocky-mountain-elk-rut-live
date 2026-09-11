import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const handler = require("../api/live-v2.js");

let payload = null;
let statusCode = 200;
const headers = new Map();

const req = { method: "GET" };
const res = {
  setHeader(name, value) {
    headers.set(String(name).toLowerCase(), value);
  },
  status(code) {
    statusCode = code;
    return this;
  },
  json(value) {
    payload = value;
    return this;
  },
  end() {
    return this;
  },
};

await handler(req, res);

if (statusCode !== 200 || !payload || typeof payload !== "object") {
  throw new Error(`Snapshot failed: status=${statusCode}`);
}

payload.schemaVersion = 1;

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public/v1");
const outPath = resolve(outDir, "live.json");
mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Wrote ${outPath}`);
console.log(`schemaVersion=${payload.schemaVersion} mode=${payload.mode} generatedAt=${payload.generatedAt} windows=${payload.windows?.length ?? 0}`);
