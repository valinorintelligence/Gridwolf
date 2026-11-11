// ForgeCompliance may only map requirement areas to finding types the passive engine actually emits.
// EMITTED mirrors EMITTED_FINDING_TYPES in the backend test suite (tests/test_engine.py, retained under f4-retained/).
// run: node --test gridwolf-bridge/tests/compliance_mapping.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "..", "ui", "frontend", "ForgeCompliance.js"), "utf8");
const EMITTED = new Set(["asymmetric_flow", "beacon", "dns_exfil", "insecure_service", "protocol_anomaly", "purdue_violation", "write_path"]);

test("every finding type mapped by ForgeCompliance is emitted by the engine", () => {
  const block = src.slice(src.indexOf("const T = {"), src.indexOf("};", src.indexOf("const T = {")));
  const mapped = [...block.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(mapped.length >= 5, "mapping block not parsed");
  const unknown = mapped.filter((t) => !EMITTED.has(t));
  assert.deepEqual(unknown, []);
});

test("page contains no fixed percentage score and states it makes no compliance claim", () => {
  assert.doesNotMatch(src, /["`][^"`\n]*\b\d{2,3}\s?%[^"`\n]*["`]/);
  assert.match(src, /makes no compliance claim/i);
});
