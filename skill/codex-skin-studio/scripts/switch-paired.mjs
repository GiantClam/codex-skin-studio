#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defaultPetsDir, loadPetContract, parsePetArgs, petError } from "./pet.mjs";
import { switchPairBundle } from "./paired.mjs";

const json = (value) => JSON.stringify(value, null, 2);
const required = (options, name) => {
  const value = options.get(name);
  if (typeof value !== "string" || !value.trim()) throw petError("PAIR_INPUT_INVALID", `missing required option: --${name}`);
  return value.trim();
};

async function main() {
  const options = parsePetArgs(process.argv.slice(2));
  const allowProvisional = options.get("allow-provisional") === true;
  const contract = await loadPetContract(required(options, "contract"), { allowProvisional });
  const result = await switchPairBundle(required(options, "bundle"), { contract, petsDir: options.get("pets-dir") || defaultPetsDir(), port: options.has("port") ? Number(options.get("port")) : 9341, replace: options.get("replace") !== false, allowProvisional, nativePet: options.get("manual-pet") !== true });
  console.log(options.get("json") ? json(result) : result.nextAction);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(json({ status: "failed", code: error.code || "PAIR_COMMAND_FAILED", message: error.message, details: error.details })); process.exitCode = 1; });
}
