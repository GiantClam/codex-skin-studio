const MAIN_URL = "app://-/index.html";

export function classifyCodexTarget(target) {
  let type;
  let value;
  try {
    type = target?.type;
    value = target?.url;
  } catch {
    return "unknown";
  }
  if (type !== "page" || typeof value !== "string") return "unknown";
  if (value === MAIN_URL) return "main";
  if (value.includes("#")) return "unknown";
  try {
    const url = new URL(value);
    if (url.protocol !== "app:" || url.username || url.password || url.port || url.hash) return "unknown";
    if (url.hostname === "-" && url.pathname === "/index.html" && url.searchParams.get("initialRoute") === "/avatar-overlay" && [...url.searchParams.keys()].length === 1) return "overlay";
    if (url.hostname === "codex" && url.pathname !== "/avatar-overlay") return "candidate";
  } catch {
    return "unknown";
  }
  return "unknown";
}

export function classifyCodexTargets(targets) {
  if (!Array.isArray(targets)) throw new TypeError("Codex targets must be an array");
  return targets.map((target) => ({ ...target, kind: classifyCodexTarget(target) }));
}
