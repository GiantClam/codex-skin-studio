import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function validPid(pid) {
  return Number.isSafeInteger(pid) && pid > 0;
}

export async function readProcessIdentity(pid, { platform = process.platform, execFileFn = execFileAsync } = {}) {
  if (!validPid(pid)) throw new TypeError("process identity pid must be positive");
  if (platform === "win32") {
    const script = `$p=Get-Process -Id ${pid} -ErrorAction Stop; [Console]::Out.Write((@{pid=[int]$p.Id;startedAt=$p.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress))`;
    try {
      const { stdout } = await execFileFn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], { timeout: 5000, maxBuffer: 16 * 1024 });
      const value = JSON.parse(stdout);
      return value?.pid === pid && typeof value.startedAt === "string" ? { pid, startedAt: value.startedAt } : null;
    } catch (error) {
      if (error?.code === 1 || /cannot find a process/i.test(String(error?.stderr || ""))) return null;
      throw error;
    }
  }
  try {
    const { stdout } = await execFileFn("/bin/ps", ["-p", String(pid), "-o", "pid=,lstart="], { timeout: 5000, maxBuffer: 16 * 1024 });
    const match = /^\s*(\d+)\s+(.+?)\s*$/.exec(stdout);
    return match && Number(match[1]) === pid ? { pid, startedAt: match[2] } : null;
  } catch (error) {
    if (error?.code === 1) return null;
    throw error;
  }
}

export function sameProcessIdentity(left, right) {
  return left?.pid === right?.pid && left?.startedAt === right?.startedAt;
}
