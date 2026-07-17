#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defaultPetsDir, parsePetArgs } from "./pet.mjs";
import { pairedStatus } from "./paired.mjs";

const json = (value) => JSON.stringify(value, null, 2);

async function main() {
  const options = parsePetArgs(process.argv.slice(2));
  const result = await pairedStatus({ petsDir: options.get("pets-dir") || defaultPetsDir(), port: options.has("port") ? Number(options.get("port")) : 9341 });
  console.log(options.get("json") ? json(result) : result.status);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(json({ status: "failed", code: error.code || "PAIR_COMMAND_FAILED", message: error.message, details: error.details })); process.exitCode = 1; });
}
