#!/usr/bin/env node

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep, win32 as winPath } from "node:path";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir, homedir, platform as hostPlatform } from "node:os";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
let sharp = null;
try { sharp = require("sharp"); } catch { sharp = null; }
if (!sharp) {
  const bundledRoots = [
    process.env.CODEX_NODE_MODULES,
    join(dirname(process.execPath), "..", "lib", "node_modules"),
    "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules",
  ].filter(Boolean);
  for (const root of bundledRoots) {
    try { sharp = createRequire(join(root, "package.json"))("sharp"); break; } catch { /* Try the next bundled runtime path. */ }
  }
}

export const PET_CONTRACT_SCHEMA = 1;
export const DEFAULT_PET_CONTRACT = {
  schemaVersion: PET_CONTRACT_SCHEMA,
  contractVersion: "chatgpt-desktop-pet-8x9-provisional",
  status: "provisional",
  source: "codex-skin-studio-template",
  grid: { columns: 8, rows: 9 },
  frame: { width: 192, height: 208 },
  spritesheet: { format: "webp", colorMode: "rgba" },
  rows: ["idle", "running-right", "running-left", "waving", "jumping", "failed", "waiting", "running", "review"],
};

const PET_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const DEFAULT_MAX_INPUT_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_ATLAS_BYTES = 20 * 1024 * 1024;

export function petError(code, message, details = undefined) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

function requiredOption(options, name) {
  const value = options.get(name);
  if (typeof value !== "string" || !value.trim()) throw petError("PET_INPUT_INVALID", `missing required option: --${name}`);
  return value.trim();
}

export function parsePetArgs(argv) {
  const options = new Map();
  const booleanFlags = new Set(["json", "replace", "dry-run", "allow-provisional", "chroma-key"]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) throw petError("PET_INPUT_INVALID", `unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (booleanFlags.has(key)) { options.set(key, true); continue; }
    const value = argv[++index];
    if (!value || value.startsWith("--")) throw petError("PET_INPUT_INVALID", `missing value for --${key}`);
    options.set(key, value);
  }
  return options;
}

function assertPetId(id) {
  if (!PET_ID.test(id)) throw petError("PET_MANIFEST_INVALID", "pet id must be lowercase letters, numbers, and hyphens");
  return id;
}

function assertInside(root, candidate, label) {
  const rootPath = resolve(root);
  const candidatePath = resolve(candidate);
  const prefix = rootPath.endsWith(sep) ? rootPath : `${rootPath}${sep}`;
  if (candidatePath !== rootPath && !candidatePath.startsWith(prefix)) throw petError("PET_PATH_UNSAFE", `${label} must remain inside ${rootPath}`);
  return candidatePath;
}

async function readJsonFile(file, code = "PET_INPUT_INVALID") {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { throw petError(code, `invalid JSON: ${file}`, { cause: error.message }); }
}

async function writeJsonFile(file, value) {
  await writeFile(file, `${json(value)}\n`, "utf8");
}

function assertInteger(value, label, min = 1, max = 8192) {
  if (!Number.isInteger(value) || value < min || value > max) throw petError("PET_CONTRACT_MISMATCH", `${label} must be an integer from ${min} through ${max}`);
}

export function validateContract(contract, { allowProvisional = false } = {}) {
  if (!contract || typeof contract !== "object") throw petError("PET_CONTRACT_MISMATCH", "pet contract must be an object");
  if (contract.schemaVersion !== PET_CONTRACT_SCHEMA) throw petError("PET_CONTRACT_MISMATCH", `unsupported pet contract schema: ${contract.schemaVersion}`);
  if (typeof contract.contractVersion !== "string" || !contract.contractVersion.trim()) throw petError("PET_CONTRACT_MISMATCH", "pet contract version is required");
  if (!allowProvisional && contract.status !== "observed") throw petError("PET_CONTRACT_MISMATCH", "pet contract is provisional; capture an observed hatch-pet contract first");
  if (!contract.grid || contract.grid.columns !== 8 || contract.grid.rows !== 9) throw petError("PET_CONTRACT_MISMATCH", "the current MVP requires an observed 8x9 pet atlas contract");
  assertInteger(contract.frame?.width, "frame.width");
  assertInteger(contract.frame?.height, "frame.height");
  if (!Array.isArray(contract.rows) || contract.rows.length !== contract.grid.rows || contract.rows.some((row) => typeof row !== "string" || !row.trim())) throw petError("PET_CONTRACT_MISMATCH", "pet contract must define exactly nine named rows");
  if (contract.spritesheet?.format !== "webp" || contract.spritesheet?.colorMode !== "rgba") throw petError("PET_CONTRACT_MISMATCH", "pet contract must require RGBA WebP output");
  return contract;
}

export async function loadPetContract(file, options = {}) {
  const contract = await readJsonFile(resolve(file), "PET_CONTRACT_MISMATCH");
  return validateContract(contract, options);
}

export function defaultPetsDir({ platform = hostPlatform(), env = process.env } = {}) {
  const override = env.CODEX_PETS_DIR;
  const pathApi = platform === "win32" ? winPath : { join, resolve };
  if (override) return pathApi.resolve(override);
  const home = platform === "win32" ? (env.USERPROFILE || env.HOME || homedir()) : (env.HOME || homedir());
  const codexHome = env.CODEX_HOME ? pathApi.resolve(env.CODEX_HOME) : pathApi.join(home, ".codex");
  return pathApi.join(codexHome, "pets");
}

function requireSharp() {
  if (!sharp) throw petError("PET_IMAGE_PROCESSOR_UNAVAILABLE", "Pet image processing requires the sharp package");
  return sharp;
}

async function assertImage(file) {
  const path = resolve(file);
  const extension = extname(path).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) throw petError("PET_IMAGE_INVALID", `unsupported image extension: ${extension}`);
  let details;
  try { details = await stat(path); } catch (error) { throw petError("PET_IMAGE_INVALID", `image does not exist: ${path}`, { cause: error.message }); }
  if (!details.isFile() || details.size === 0 || details.size > DEFAULT_MAX_INPUT_BYTES) throw petError("PET_IMAGE_INVALID", `image must be a non-empty file no larger than ${DEFAULT_MAX_INPUT_BYTES} bytes: ${path}`);
  return path;
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function chromaKeyBuffer(file) {
  const image = requireSharp();
  const { data, info } = await image(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let removed = 0;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    if (green > 140 && green > red * 1.22 && green > blue * 1.22) {
      data[index + 3] = 0;
      removed += 1;
    }
  }
  return { buffer: await image(data, { raw: info }).png().toBuffer(), removed, width: info.width, height: info.height };
}

async function frameSource(file, { chromaKey = true } = {}) {
  const path = await assertImage(file);
  const input = await readFile(path);
  if (!chromaKey) return { path, buffer: input, sourceHash: hashBuffer(input), removedPixels: 0 };
  const processed = await chromaKeyBuffer(path);
  return { path, buffer: processed.buffer, sourceHash: hashBuffer(input), removedPixels: processed.removed };
}

function frameManifestFromOptions(options, contract) {
  const file = options.get("frames") || options.get("input");
  if (!file) throw petError("PET_INPUT_INVALID", "missing required option: --frames");
  return { file: resolve(file), contract };
}

async function loadFrameManifest(file, contract) {
  const manifest = await readJsonFile(file, "PET_INPUT_INVALID");
  if (!manifest || typeof manifest !== "object" || !manifest.rows || typeof manifest.rows !== "object") throw petError("PET_INPUT_INVALID", "frame manifest must contain rows");
  if (manifest.contractVersion !== contract.contractVersion) throw petError("PET_CONTRACT_MISMATCH", "frame manifest contractVersion does not match the selected pet contract");
  const rows = {};
  for (const rowName of contract.rows) {
    const row = manifest.rows[rowName];
    if (!row || !Array.isArray(row.frames) || row.frames.length !== contract.grid.columns) throw petError("PET_INPUT_INVALID", `row ${rowName} must contain exactly ${contract.grid.columns} frames`);
    rows[rowName] = row.frames.map((file) => {
      if (typeof file !== "string" || !file.trim()) throw petError("PET_INPUT_INVALID", `row ${rowName} contains an invalid frame path`);
      return file.trim();
    });
  }
  const base = dirname(resolve(file));
  for (const rowName of contract.rows) rows[rowName] = rows[rowName].map((frame) => assertInside(base, resolve(base, frame), "frame"));
  return { rows, source: file };
}

export async function createPet({ id, displayName, description, frames, out, contract, replace = false, chromaKey = true } = {}) {
  const petId = assertPetId(id);
  validateContract(contract);
  const output = resolve(out);
  const parent = dirname(output);
  await mkdir(parent, { recursive: true });
  const sourceManifest = await loadFrameManifest(resolve(frames), contract);
  const image = requireSharp();
  const staging = await mkdtemp(join(parent, `.${petId}.`));
  try {
    const frameWidth = contract.frame.width;
    const frameHeight = contract.frame.height;
    const composites = [];
    const hashes = {};
    for (let rowIndex = 0; rowIndex < contract.rows.length; rowIndex += 1) {
      const rowName = contract.rows[rowIndex];
      for (let column = 0; column < contract.grid.columns; column += 1) {
        const source = await frameSource(sourceManifest.rows[rowName][column], { chromaKey });
        hashes[`${rowName}:${column}`] = source.sourceHash;
        const resized = await image(source.buffer).resize({ width: frameWidth, height: frameHeight, fit: "contain", position: "center", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        composites.push({ input: resized, left: column * frameWidth, top: rowIndex * frameHeight });
      }
    }
    const atlasPath = join(staging, "spritesheet.webp");
    const atlas = await image({ create: { width: frameWidth * contract.grid.columns, height: frameHeight * contract.grid.rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).webp({ quality: 86, alphaQuality: 100, effort: 4 }).toBuffer();
    if (atlas.length > DEFAULT_MAX_ATLAS_BYTES) throw petError("PET_SPRITESHEET_INVALID", `generated spritesheet exceeds ${DEFAULT_MAX_ATLAS_BYTES} bytes`);
    await writeFile(atlasPath, atlas);
    const manifest = {
      id: petId,
      displayName: String(displayName || petId).trim(),
      description: String(description || "A cute anthropomorphic desktop companion.").trim(),
      spritesheetPath: "spritesheet.webp",
      contractVersion: contract.contractVersion,
      visualContract: { style: "cartoon", anthropomorphic: true, headToBody: "large-head-small-body" },
      sourceFrameHashes: hashes,
    };
    await writeJsonFile(join(staging, "pet.json"), manifest);
    await validatePetDirectory(staging, { contract, allowProvisional: false });
    try {
      await stat(output);
      if (!replace) throw petError("PET_INSTALL_FAILED", `pet output is not empty: ${output}; pass --replace to overwrite`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await commitDirectory(staging, output, replace);
    return { status: "created", id: petId, directory: output, manifestPath: join(output, "pet.json"), spritesheetPath: join(output, "spritesheet.webp"), contractVersion: contract.contractVersion };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function commitDirectory(staging, output, replace) {
  if (!replace) { await rename(staging, output); return; }
  const backup = `${output}.backup-${process.pid}-${Date.now()}`;
  let hadOutput = false;
  try { await rename(output, backup); hadOutput = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
  try { await rename(staging, output); } catch (error) { if (hadOutput) await rename(backup, output); throw error; }
  if (hadOutput) await rm(backup, { recursive: true, force: true });
}

async function validateCorners(file) {
  const image = requireSharp();
  const { data, info } = await image(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const points = [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]];
  const alpha = points.map(([x, y]) => data[(y * info.width + x) * 4 + 3]);
  return { width: info.width, height: info.height, hasAlpha: info.channels === 4, cornerAlpha: alpha, cornersTransparent: alpha.every((value) => value === 0) };
}

async function validateFrameCells(file, contract) {
  const image = requireSharp();
  const { data, info } = await image(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frameWidth = contract.frame.width;
  const frameHeight = contract.frame.height;
  const frames = [];
  for (let row = 0; row < contract.grid.rows; row += 1) {
    for (let column = 0; column < contract.grid.columns; column += 1) {
      let left = frameWidth;
      let top = frameHeight;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < frameWidth; x += 1) {
          const atlasX = column * frameWidth + x;
          const atlasY = row * frameHeight + y;
          if (data[(atlasY * info.width + atlasX) * 4 + 3] === 0) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      if (right < 0) throw petError("PET_SPRITESHEET_INVALID", `frame ${row}:${column} contains no visible character`);
      const padding = Math.min(left, top, frameWidth - 1 - right, frameHeight - 1 - bottom);
      if (padding < Math.floor(Math.min(frameWidth, frameHeight) * 0.02)) throw petError("PET_SPRITESHEET_INVALID", `frame ${row}:${column} is cropped or lacks safe padding`);
      frames.push({ row, column, left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, padding });
    }
  }
  return { frameCount: frames.length, frames };
}

export async function validatePetDirectory(directory, { contract, allowProvisional = false } = {}) {
  validateContract(contract, { allowProvisional });
  const root = resolve(directory);
  const manifestPath = join(root, "pet.json");
  const manifest = await readJsonFile(manifestPath, "PET_MANIFEST_INVALID");
  assertPetId(manifest.id);
  if (typeof manifest.displayName !== "string" || !manifest.displayName.trim()) throw petError("PET_MANIFEST_INVALID", "pet displayName is required");
  if (manifest.contractVersion !== contract.contractVersion) throw petError("PET_CONTRACT_MISMATCH", "pet manifest contractVersion does not match the selected contract");
  if (!manifest.visualContract || manifest.visualContract.style !== "cartoon" || manifest.visualContract.anthropomorphic !== true || manifest.visualContract.headToBody !== "large-head-small-body") throw petError("PET_MANIFEST_INVALID", "pet manifest must declare the cartoon anthropomorphic large-head-small-body visual contract");
  if (typeof manifest.spritesheetPath !== "string" || isAbsolute(manifest.spritesheetPath)) throw petError("PET_MANIFEST_INVALID", "spritesheetPath must be relative");
  const spritesheet = assertInside(root, join(root, manifest.spritesheetPath), "spritesheet");
  const extension = extname(spritesheet).toLowerCase();
  if (extension !== ".webp" && extension !== ".png") throw petError("PET_MANIFEST_INVALID", "spritesheet must be WebP or PNG");
  const details = await stat(spritesheet).catch((error) => { throw petError("PET_IMAGE_INVALID", `spritesheet does not exist: ${spritesheet}`, { cause: error.message }); });
  if (!details.isFile() || details.size === 0 || details.size > DEFAULT_MAX_ATLAS_BYTES) throw petError("PET_SPRITESHEET_INVALID", "spritesheet is empty or too large");
  const imageInfo = await validateCorners(spritesheet);
  const expected = { width: contract.frame.width * contract.grid.columns, height: contract.frame.height * contract.grid.rows };
  if (imageInfo.width !== expected.width || imageInfo.height !== expected.height) throw petError("PET_SPRITESHEET_INVALID", `spritesheet must be ${expected.width}x${expected.height}`);
  if (!imageInfo.hasAlpha || !imageInfo.cornersTransparent) throw petError("PET_ALPHA_INVALID", "spritesheet must contain RGBA alpha with transparent corners", imageInfo);
  const frames = await validateFrameCells(spritesheet, contract);
  return { status: "valid", id: manifest.id, directory: root, manifestPath, spritesheet, dimensions: imageInfo, frames, contractVersion: contract.contractVersion };
}

export async function installPet(directory, { petsDir = defaultPetsDir(), contract, replace = false, allowProvisional = false, dryRun = false } = {}) {
  const source = resolve(directory);
  const validation = await validatePetDirectory(source, { contract, allowProvisional });
  const destinationRoot = resolve(petsDir);
  await mkdir(destinationRoot, { recursive: true });
  const destination = assertInside(destinationRoot, join(destinationRoot, validation.id), "pet destination");
  if (dryRun) return { ...validation, status: "validated", dryRun: true, destination };
  if (!replace) {
    try {
      await stat(destination);
      throw petError("PET_INSTALL_FAILED", `pet destination is not empty: ${destination}; pass --replace to overwrite`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const staging = await mkdtemp(join(destinationRoot, `.${validation.id}.`));
  try {
    const manifest = await readFile(join(source, "pet.json"));
    const spritesheet = await readFile(validation.spritesheet);
    await writeFile(join(staging, "pet.json"), manifest);
    await writeFile(join(staging, basename(validation.spritesheet)), spritesheet);
    await commitDirectory(staging, destination, replace);
    const statePath = join(destinationRoot, ".codex-skin-studio-pet-state.json");
    await writeJsonFile(statePath, { schemaVersion: 1, installedId: validation.id, installedAt: new Date().toISOString(), directory: destination, selection: "refresh-required" });
    return { ...validation, status: "installed", destination, refreshRequired: true, selection: "refresh-required" };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (error.code) throw error;
    throw petError("PET_INSTALL_FAILED", error.message);
  }
}

export async function listInstalledPets({ petsDir = defaultPetsDir() } = {}) {
  const root = resolve(petsDir);
  let entries;
  try { entries = await (await import("node:fs/promises")).readdir(root, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const result = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    try {
      const manifest = await readJsonFile(join(root, entry.name, "pet.json"), "PET_MANIFEST_INVALID");
      result.push({ id: manifest.id, displayName: manifest.displayName, directory: join(root, entry.name), contractVersion: manifest.contractVersion });
    } catch { /* Ignore unrelated directories in the user Pet root. */ }
  }
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

export async function petStatus({ petsDir = defaultPetsDir() } = {}) {
  const root = resolve(petsDir);
  let state = null;
  try { state = await readJsonFile(join(root, ".codex-skin-studio-pet-state.json")); } catch { state = null; }
  return { status: "ok", petsDir: root, active: state?.installedId || null, selection: state?.selection || "unknown", pets: await listInstalledPets({ petsDir: root }) };
}

async function cli() {
  const [command, ...argv] = process.argv.slice(2);
  const options = parsePetArgs(argv);
  if (command === "status") {
    const result = await petStatus({ petsDir: options.get("pets-dir") || defaultPetsDir() });
    console.log(options.get("json") ? json(result) : result.message || json(result));
    return;
  }
  const contractPath = options.get("contract");
  if (!contractPath) throw petError("PET_CONTRACT_MISMATCH", "missing required option: --contract");
  const contract = await loadPetContract(contractPath, { allowProvisional: options.get("allow-provisional") === true });
  let result;
  if (command === "validate") result = await validatePetDirectory(requiredOption(options, "directory"), { contract, allowProvisional: options.get("allow-provisional") === true });
  else if (command === "create") result = await createPet({ id: requiredOption(options, "id"), displayName: options.get("name"), description: options.get("description"), frames: requiredOption(options, "frames"), out: requiredOption(options, "out"), contract, replace: options.get("replace") === true, chromaKey: options.get("chroma-key") !== false });
  else if (command === "install") result = await installPet(requiredOption(options, "directory"), { petsDir: options.get("pets-dir") || defaultPetsDir(), contract, replace: options.get("replace") === true, allowProvisional: options.get("allow-provisional") === true, dryRun: options.get("dry-run") === true });
  else throw petError("PET_INPUT_INVALID", "usage: pet.mjs create|validate|install|status --contract PATH [options]");
  console.log(options.get("json") ? json(result) : result.message || json(result));
}

export { assertInside, assertPetId, chromaKeyBuffer, commitDirectory, frameSource, loadFrameManifest, requireSharp };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch((error) => { console.error(json({ status: "failed", code: error.code || "PET_COMMAND_FAILED", message: error.message, details: error.details })); process.exitCode = 1; });
}
