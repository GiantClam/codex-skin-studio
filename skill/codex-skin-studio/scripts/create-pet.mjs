#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createPet, loadPetContract, parsePetArgs, petError } from "./pet.mjs";

const json = (value) => JSON.stringify(value, null, 2);
const required = (options, name) => {
  const value = options.get(name);
  if (typeof value !== "string" || !value.trim()) throw petError("PET_INPUT_INVALID", `missing required option: --${name}`);
  return value.trim();
};

async function main() {
  const options = parsePetArgs(process.argv.slice(2));
  const contract = await loadPetContract(required(options, "contract"));
  const result = await createPet({
    id: required(options, "id"),
    displayName: options.get("name"),
    description: options.get("description"),
    frames: required(options, "frames"),
    out: required(options, "out"),
    contract,
    replace: options.get("replace") === true,
    chromaKey: options.get("chroma-key") !== false,
  });
  console.log(options.get("json") ? json(result) : result.directory);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(json({ status: "failed", code: error.code || "PET_COMMAND_FAILED", message: error.message, details: error.details })); process.exitCode = 1; });
}
