import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildWindowsOpenSettingsScript, openChatGptSettings } from "../skill/codex-skin-studio/scripts/pet-desktop.mjs";
import { DEFAULT_PET_CONTRACT, defaultPetsDir, installPet, validatePetDirectory } from "../skill/codex-skin-studio/scripts/pet.mjs";

const examplePet = join(fileURLToPath(new URL("..", import.meta.url)), "skill", "codex-skin-studio", "examples", "pets", "mascot");

test("Windows resolves a user Pet root without hard-coded paths", () => {
  assert.equal(defaultPetsDir({ platform: "win32", env: { USERPROFILE: "C:\\Users\\Test User" } }), "C:\\Users\\Test User\\.codex\\pets");
  assert.equal(defaultPetsDir({ platform: "win32", env: { CODEX_HOME: "D:\\Codex Home", USERPROFILE: "C:\\Users\\Test User" } }), "D:\\Codex Home\\pets");
});

test("Windows opens ChatGPT Settings through PowerShell without private state access", async () => {
  const calls = [];
  const result = await openChatGptSettings({ platformName: "win32", execFileFn: async (file, args) => { calls.push({ file, args }); } });
  assert.equal(result.status, "opened");
  assert.equal(calls[0].file, "powershell.exe");
  assert.match(calls[0].args.at(-1), /AppActivate\('ChatGPT'\)/);
  assert.match(calls[0].args.at(-1), /SendKeys\('\^,'\)/);
  assert.doesNotMatch(calls[0].args.at(-1), /app\.asar|selected-avatar|localStorage/i);
  assert.match(buildWindowsOpenSettingsScript(), /ChatGPT/);
});

test("Windows validates and atomically installs the official v2 example Pet", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-pet-windows-"));
  try {
    const validation = await validatePetDirectory(examplePet, { contract: DEFAULT_PET_CONTRACT });
    assert.equal(validation.dimensions.width, 1536);
    assert.equal(validation.dimensions.height, 2288);
    const installed = await installPet(examplePet, { petsDir: join(root, "User Profile", ".codex", "pets"), contract: DEFAULT_PET_CONTRACT, replace: true });
    assert.equal(installed.status, "installed");
    assert.equal(JSON.parse(await readFile(join(installed.destination, "pet.json"), "utf8")).spriteVersionNumber, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
