#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadPetContract, parsePetArgs, petError, validatePetDirectory } from "./pet.mjs";

const json = (value) => JSON.stringify(value, null, 2);
const required = (options, name) => {
  const value = options.get(name);
  if (typeof value !== "string" || !value.trim()) throw petError("PET_INPUT_INVALID", `missing required option: --${name}`);
  return value.trim();
};

async function main() {
  const options = parsePetArgs(process.argv.slice(2));
  const contract = await loadPetContract(required(options, "contract"), { allowProvisional: options.get("allow-provisional") === true });
  const result = await validatePetDirectory(required(options, "directory"), { contract, allowProvisional: options.get("allow-provisional") === true });
  console.log(options.get("json") ? json(result) : result.directory);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(json({ status: "failed", code: error.code || "PET_COMMAND_FAILED", message: error.message, details: error.details })); process.exitCode = 1; });
}
