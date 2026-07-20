import { mkdir, open, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const STALE_AFTER_MS = 120_000;

function lockPath(root) {
  return join(root, "operation.lock");
}

async function staleLock(path, now = Date.now()) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (Number.isSafeInteger(value?.pid) && value.pid > 0) {
      try { process.kill(value.pid, 0); return false; } catch (error) { if (error.code === "EPERM") return false; }
    }
    return !Number.isFinite(value?.createdAt) || now - value.createdAt > STALE_AFTER_MS;
  } catch {
    return true;
  }
}

export async function acquireOperationLock(root, operation = "apply", { now = Date.now } = {}) {
  const path = lockPath(root);
  const payload = JSON.stringify({ schemaVersion: 1, pid: process.pid, operation, createdAt: now() });
  await mkdir(root, { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(path, "wx", 0o600);
      await handle.writeFile(payload, "utf8");
      await handle.close();
      return { path, release: async () => { await rm(path, { force: true }); } };
    } catch (error) {
      if (error.code !== "EEXIST" || attempt > 0 || !(await staleLock(path, now()))) throw new Error("another skin operation is already in progress", { cause: error });
      await rm(path, { force: true });
    }
  }
  throw new Error("unable to acquire the skin operation lock");
}

export async function withOperationLock(root, operation, callback, options = {}) {
  const lock = await acquireOperationLock(root, operation, options);
  try { return await callback(); } finally { await lock.release(); }
}

export { lockPath };
