#!/usr/bin/env node

import { execFile } from "node:child_process";
import { platform } from "node:os";
import { promisify } from "node:util";
import { delay, evaluateAll, MAIN_TARGET_PROBE, selectMainTarget, Session, targets } from "./apply.mjs";
import { assertPetId, petError } from "./pet.mjs";

const execFileAsync = promisify(execFile);
const DEFAULT_PORT = 9341;
const ADAPTER_VERSION = "chatgpt-desktop-pets-settings-v2";
const SETTINGS_TIMEOUT_MS = 12000;
const UI_POLL_MS = 120;
const REFRESH_LABELS = new Set([
  "refresh",
  "\u5237\u65b0",
  "\u66f4\u65b0",
  "actualizar",
  "actualiser",
  "aktualisieren",
  "aggiorna",
]);
const SELECT_LABELS = new Set([
  "select",
  "\u9009\u62e9",
  "ausw\u00e4hlen",
  "s\u00e9lectionner",
  "seleccionar",
  "ausw\u00e4hlen",
]);
const SELECTED_LABELS = new Set([
  "selected",
  "\u5df2\u9009",
  "ausgew\u00e4hlt",
  "s\u00e9lectionn\u00e9",
  "seleccionado",
]);

const json = (value) => JSON.stringify(value);

function commandFailure(error, fallback = "PET_NATIVE_UI_UNAVAILABLE") {
  const message = String(error?.message || error || "native ChatGPT Desktop UI command failed");
  return petError(error?.code || fallback, message, error?.details);
}

export const PET_UI_STATE_EXPRESSION = `(() => {
  const slugNodes = [...document.querySelectorAll('[data-settings-panel-slug]')];
  const normalized = (node) => (node?.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const isActive = (node) => {
    const clickable = node?.closest?.('button,[role="button"],a') || node;
    return [node, clickable].filter(Boolean).some((candidate) => candidate.getAttribute('aria-current') === 'page' || candidate.getAttribute('aria-selected') === 'true' || /^(active|selected)$/.test((candidate.getAttribute('data-state') || '').toLowerCase()));
  };
  const petsPanel = slugNodes.some((node) => node.getAttribute('data-settings-panel-slug') === 'pets' && isActive(node))
    || [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].some((node) => /^pets?$/.test(normalized(node)))
    || [...document.querySelectorAll('button,[role="button"]')].some((node) => /refresh\\s+(custom\\s+)?pets?|custom\\s+pets?/i.test((node.getAttribute('aria-label') || '') + ' ' + (node.textContent || '')));
  return {
    settingsSlugs: slugNodes.map((node) => node.getAttribute('data-settings-panel-slug')).filter(Boolean),
    settings: Boolean(document.querySelector('[data-settings-panel-slug], [data-testid*="settings-panel"], [role="dialog"]') || [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].some((node) => /^(settings|preferences|appearance|pets?)$/i.test((node.textContent || '').replace(/\\s+/g, ' ').trim()))),
    petsPanel: Boolean(petsPanel),
    customPetIds: [...document.querySelectorAll('[data-avatar-id^="custom:"],[data-pet-id]')].map((node) => node.getAttribute('data-avatar-id')?.startsWith('custom:') ? node.getAttribute('data-avatar-id').slice(7) : node.getAttribute('data-pet-id')?.replace(/^custom:/, '')).filter(Boolean),
    main: (() => { const probe = ${MAIN_TARGET_PROBE}; return Boolean(probe.main && probe.root); })()
  };
})()`;

export const OPEN_PETS_PANEL_EXPRESSION = `(() => {
  const visible = (node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
  const describe = (candidate) => {
    const slug = (candidate.getAttribute('data-settings-panel-slug') || '').toLowerCase();
    const value = ((candidate.getAttribute('aria-label') || '') + ' ' + (candidate.getAttribute('title') || '') + ' ' + (candidate.textContent || '')).replace(/\\s+/g, ' ').trim().toLowerCase();
    const href = (candidate.getAttribute('href') || '').toLowerCase();
    return { candidate, slug, value, href };
  };
  const records = [...document.querySelectorAll('[data-settings-panel-slug],button,[role="button"],a')].filter(visible).map(describe);
  const exact = (record, name) => record.slug === name || record.slug === name + 's' || new RegExp('^' + name + 's?$').test(record.value) || new RegExp('/' + name + 's?(?:[/?#]|$)').test(record.href);
  const broad = (record, name) => new RegExp('(^|\\\\s)' + name + 's?(\\\\s|$)').test(record.value);
  const record = records.find((item) => exact(item, 'pet'))
    || records.find((item) => exact(item, 'appearance'))
    || records.find((item) => broad(item, 'pet'))
    || records.find((item) => broad(item, 'appearance'));
  const diagnostics = records.slice(0, 40).map(({ candidate, slug, value, href }) => {
    const parent = candidate.closest?.('button,[role="button"],a') || candidate.parentElement;
    return { tag: candidate.tagName?.toLowerCase() || null, role: candidate.getAttribute('role'), slug, label: value.slice(0, 120), href, parentTag: parent?.tagName?.toLowerCase() || null, parentRole: parent?.getAttribute?.('role') || null };
  });
  if (!record) return { ok: false, reason: "pets-settings-button-not-found", candidates: diagnostics };
  const source = record.candidate;
  const button = source.closest?.('button,[role="button"],a') || source.querySelector?.('button,[role="button"],a') || source;
  if (!visible(button) || button.disabled || button.getAttribute?.('aria-disabled') === 'true') return { ok: false, reason: "pets-settings-control-not-clickable", candidates: diagnostics };
  try { button.focus?.({ preventScroll: true }); } catch { button.focus?.(); }
  const rect = button.getBoundingClientRect();
  return { ok: true, slug: record.slug || (record.value.includes('appearance') ? 'appearance' : 'pets'), sourceTag: source.tagName?.toLowerCase() || null, clickedTag: button.tagName?.toLowerCase() || null, activation: 'keyboard-via-cdp', activationKey: 'Space', clickPoint: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } };
})()`;

export const OPEN_SETTINGS_EXPRESSION = `(() => {
  const visible = (node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
  const activate = (button) => {
    try { button.focus?.({ preventScroll: true }); } catch { button.focus?.(); }
  };
  const candidates = [...document.querySelectorAll('button,[role="button"],[role="menuitem"],a,[data-testid]')].filter(visible);
  const button = candidates.find((candidate) => {
    const value = ((candidate.getAttribute('aria-label') || '') + ' ' + (candidate.getAttribute('title') || '') + ' ' + (candidate.textContent || '')).replace(/\\s+/g, ' ').trim().toLowerCase();
    const testId = (candidate.getAttribute('data-testid') || '').toLowerCase();
    const href = (candidate.getAttribute('href') || '').toLowerCase();
    return /^(settings|preferences|\\u504f\\u597d\\u8bbe\\u7f6e|\\u8bbe\\u7f6e)(?:\\s|\\u2318|ctrl|$)/.test(value) || /(^|\\s)(settings|preferences)(\\s|$)/.test(value) || /settings|preferences/.test(testId) || /\\/(settings|preferences)(?:[/?#]|$)/.test(href);
  });
  if (!button) return { ok: false, reason: "settings-control-not-found", candidates: candidates.slice(0, 40).map((candidate) => ({ tag: candidate.tagName.toLowerCase(), label: ((candidate.getAttribute('aria-label') || '') + ' ' + (candidate.getAttribute('title') || '') + ' ' + (candidate.textContent || '')).replace(/\\s+/g, ' ').trim().slice(0, 120), testId: candidate.getAttribute('data-testid'), href: candidate.getAttribute('href') })) };
  activate(button);
  const rect = button.getBoundingClientRect();
  return { ok: true, activationKey: button.getAttribute('role') === 'menuitem' ? 'Enter' : 'Space', clickPoint: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } };
})()`;

export const OPEN_ACCOUNT_MENU_EXPRESSION = `(() => {
  const visible = (node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
  const activate = (button) => {
    try { button.focus?.({ preventScroll: true }); } catch { button.focus?.(); }
  };
  const candidates = [...document.querySelectorAll('button,[role="button"],a')].filter(visible);
  const profile = candidates.find((candidate) => candidate.getAttribute('aria-haspopup') === 'menu' && Boolean(candidate.querySelector('img,[data-avatar],[data-user-avatar]')));
  const button = profile || candidates.find((candidate) => {
    const value = ((candidate.getAttribute('aria-label') || '') + ' ' + (candidate.getAttribute('title') || '') + ' ' + (candidate.textContent || '')).replace(/\\s+/g, ' ').trim().toLowerCase();
    const testId = (candidate.getAttribute('data-testid') || '').toLowerCase();
    return /account|profile|user menu|avatar|personal settings|\u4e2a\u4eba\u8d44\u6599\u83dc\u5355|\u8d26\u6237|\u5934\u50cf/.test(value) || /account|profile|user|avatar/.test(testId);
  });
  if (!button) return { ok: false, reason: "account-menu-not-found", candidates: candidates.slice(0, 40).map((candidate) => ({ tag: candidate.tagName.toLowerCase(), label: ((candidate.getAttribute('aria-label') || '') + ' ' + (candidate.getAttribute('title') || '') + ' ' + (candidate.textContent || '')).replace(/\\s+/g, ' ').trim().slice(0, 120), testId: candidate.getAttribute('data-testid'), href: candidate.getAttribute('href') })) };
  if (button.getAttribute('aria-expanded') === 'true') return { ok: true, alreadyOpen: true, activate: false, label: ((button.getAttribute('aria-label') || '') + ' ' + (button.textContent || '')).replace(/\\s+/g, ' ').trim().slice(0, 120) };
  activate(button);
  const rect = button.getBoundingClientRect();
  return { ok: true, activationKey: 'Space', label: ((button.getAttribute('aria-label') || '') + ' ' + (button.textContent || '')).replace(/\\s+/g, ' ').trim().slice(0, 120), clickPoint: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } };
})()`;

export const REFRESH_PETS_EXPRESSION = `(() => {
  const labels = ${json([...REFRESH_LABELS])};
  const visible = (node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
  const button = [...document.querySelectorAll('button,[role="button"]')].filter(visible).find((candidate) => {
    const value = ((candidate.getAttribute('aria-label') || '') + ' ' + (candidate.textContent || '')).replace(/\\s+/g, ' ').trim().toLowerCase();
    return labels.includes(value) || (value.includes('refresh') && /(custom\\s+)?pets?|avatars?/.test(value));
  });
  if (!button) return { ok: false, reason: "refresh-button-not-found" };
  try { button.focus?.({ preventScroll: true }); } catch { button.focus?.(); }
  const rect = button.getBoundingClientRect();
  return { ok: true, activationKey: 'Space', clickPoint: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } };
})()`;

export function selectPetExpression(petId) {
  assertPetId(petId);
  const selector = `[data-avatar-id="custom:${petId}"], [data-pet-id="${petId}"], [data-pet-id="custom:${petId}"]`;
  return `(() => {
    const avatar = document.querySelector(${JSON.stringify(selector)});
    if (!avatar) return { ok: false, reason: "pet-not-found" };
    let row = avatar.closest('[role="listitem"], [data-pet-row], [data-testid*="pet-row"], .flex.items-center.justify-between');
    if (!row) row = avatar.parentElement?.parentElement?.parentElement || null;
    if (!row) return { ok: false, reason: "pet-row-not-found" };
    const labels = ${json([...SELECT_LABELS, "choose", "use", "apply"])};
    const selected = ${json([...SELECTED_LABELS])};
    const button = [...row.querySelectorAll('button')].find((candidate) => labels.includes((candidate.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase()));
    const target = button || avatar;
    if (target) { try { target.focus?.({ preventScroll: true }); } catch { target.focus?.(); } }
    const rowText = (row.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const rect = target?.getBoundingClientRect?.();
    return { ok: true, clicked: Boolean(target), selected: selected.some((label) => rowText.includes(label)), rowText, activationKey: 'Space', clickPoint: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null };
  })()`;
}

export function petSelectionStateExpression(petId) {
  assertPetId(petId);
  const selector = `[data-avatar-id="custom:${petId}"], [data-pet-id="${petId}"], [data-pet-id="custom:${petId}"]`;
  return `(() => {
    const avatar = document.querySelector(${JSON.stringify(selector)});
    const row = avatar?.closest('[role="listitem"], [data-pet-row], [data-testid*="pet-row"], .flex.items-center.justify-between') || null;
    const preview = avatar?.querySelector('[data-testid="codex-avatar"], img, [style*="background-image"]') || avatar;
    const selected = ${json([...SELECTED_LABELS])};
    const rowText = (row?.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const backgroundImage = preview ? getComputedStyle(preview).backgroundImage : '';
    const image = preview?.tagName === 'IMG' ? preview : preview?.querySelector?.('img');
    const imageLoaded = Boolean(image?.complete && image.naturalWidth > 0);
    const source = image?.currentSrc || image?.src || '';
    return {
      exists: Boolean(avatar),
      selected: selected.some((label) => rowText.includes(label)),
      assetLoaded: Boolean((backgroundImage && backgroundImage !== 'none') || imageLoaded),
      assetSource: backgroundImage.startsWith('url("data:') || backgroundImage.startsWith('url(data:') || source.startsWith('data:') ? 'embedded' : (backgroundImage || source) ? 'other' : 'none',
      rowText,
    };
  })()`;
}

export const RETURN_TO_APP_EXPRESSION = `(() => {
  const labels = ["back to app", "\u8fd4\u56de\u5e94\u7528", "retour \u00e0 l'application", "volver a la aplicaci\u00f3n"];
  const link = [...document.querySelectorAll('[role="link"]')].find((candidate) => labels.includes((candidate.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase()));
  if (!link) return { ok: false, reason: "return-link-not-found" };
  link.click();
  return { ok: true };
})()`;

export function buildMacOpenSettingsScript({ appName = "ChatGPT" } = {}) {
  const escaped = String(appName).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
  return `tell application "${escaped}" to activate\ndelay 0.2\ntell application "System Events"\n  tell process "${escaped}"\n    keystroke "," using {command down}\n  end tell\nend tell`;
}

export function buildWindowsOpenSettingsScript() {
  return "$shell = New-Object -ComObject WScript.Shell; $activated = $shell.AppActivate('ChatGPT') -or $shell.AppActivate('Codex'); if (-not $activated) { throw 'ChatGPT Desktop window was not found' }; Start-Sleep -Milliseconds 200; $shell.SendKeys('^,')";
}

export async function openChatGptSettings({ platformName = platform(), execFileFn = execFileAsync } = {}) {
  try {
    if (platformName === "darwin") {
      await execFileFn("/usr/bin/osascript", ["-e", buildMacOpenSettingsScript()]);
      return { status: "opened", platform: platformName, adapterVersion: ADAPTER_VERSION };
    }
    if (platformName === "win32") {
      await execFileFn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", buildWindowsOpenSettingsScript()]);
      return { status: "opened", platform: platformName, adapterVersion: ADAPTER_VERSION };
    }
    throw petError("PET_NATIVE_UI_UNAVAILABLE", "ChatGPT Desktop Pet UI automation supports macOS and Windows only");
  } catch (error) {
    throw commandFailure(error);
  }
}

async function evaluateTarget(target, expression) {
  const values = await evaluateAll([target], expression);
  return values[0];
}

async function evaluateAndClickTarget(target, expression) {
  const session = new Session(target.webSocketDebuggerUrl);
  try {
    await session.open();
    const value = await session.evaluate(expression);
    const point = value?.clickPoint;
    if (!value?.ok || value.activate === false || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return value;
    const key = value.activationKey === "Space"
      ? { key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, text: " " }
      : { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
    await session.send("Input.dispatchKeyEvent", { type: "keyDown", ...key });
    delete key.text;
    await session.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
    return { ...value, trustedActivation: value.activationKey || "Enter" };
  } finally {
    session.close();
  }
}

async function currentTarget(port) {
  const list = await targets(port);
  const target = await selectMainTarget(list, evaluateTarget, { allowTransient: true });
  if (!target) throw petError("PET_NATIVE_UI_UNAVAILABLE", "ChatGPT Desktop main renderer was not found");
  return target;
}

async function waitForExpression(port, expression, predicate, { timeoutMs = SETTINGS_TIMEOUT_MS, delayMs = UI_POLL_MS } = {}) {
  const started = Date.now();
  let lastError = null;
  let lastValue = null;
  while (Date.now() - started <= timeoutMs) {
    try {
      const target = await currentTarget(port);
      const value = await evaluateTarget(target, expression);
      lastValue = value;
      if (predicate(value)) return { target, value };
    } catch (error) {
      lastError = error;
    }
    await delay(delayMs);
  }
  throw petError("PET_NATIVE_UI_TIMEOUT", "ChatGPT Desktop Pet settings did not reach the expected state", { cause: lastError?.message || null, lastValue });
}

async function waitForState(port, predicate, options = {}) {
  return waitForExpression(port, PET_UI_STATE_EXPRESSION, predicate, options);
}

async function waitForClickableExpression(port, expression, predicate, { timeoutMs = SETTINGS_TIMEOUT_MS, delayMs = UI_POLL_MS } = {}) {
  const started = Date.now();
  let lastValue = null;
  let lastError = null;
  while (Date.now() - started <= timeoutMs) {
    try {
      const target = await currentTarget(port);
      const value = await evaluateAndClickTarget(target, expression);
      lastValue = value;
      if (predicate(value)) return { target, value };
    } catch (error) {
      lastError = error;
    }
    await delay(delayMs);
  }
  throw petError("PET_NATIVE_UI_TIMEOUT", "ChatGPT Desktop visible control did not become clickable", { cause: lastError?.message || null, lastValue });
}

async function openSettingsThroughVisibleControl(port) {
  const target = await currentTarget(port);
  const opened = await evaluateAndClickTarget(target, OPEN_SETTINGS_EXPRESSION);
  if (opened?.ok) return opened;

  const account = await evaluateAndClickTarget(target, OPEN_ACCOUNT_MENU_EXPRESSION);
  if (!account?.ok) {
    throw petError("PET_NATIVE_UI_UNAVAILABLE", opened?.reason || "could not open ChatGPT Desktop Settings through visible UI", {
      candidates: opened?.candidates || [],
      accountCandidates: account?.candidates || [],
    });
  }

  let nested;
  try {
    nested = (await waitForClickableExpression(port, OPEN_SETTINGS_EXPRESSION, (value) => value?.ok, { timeoutMs: 2500 })).value;
  } catch (error) {
    throw petError("PET_NATIVE_UI_UNAVAILABLE", "could not open ChatGPT Desktop Settings from the account menu", {
      cause: error.message,
      lastValue: error.details?.lastValue || null,
      accountMenuOpened: true,
    });
  }
  return { ...nested, via: "account-menu" };
}

export async function selectPetInChatGptDesktop({ petId, port = DEFAULT_PORT, openSettingsFn = openChatGptSettings, restoreApp = true } = {}) {
  assertPetId(petId);
  let state = null;
  try {
    state = (await waitForState(port, (value) => value.settings, { timeoutMs: 300 })).value;
  } catch {
    let nativeOpenError = null;
    try { await openSettingsFn(); } catch (error) { nativeOpenError = error; }
    try {
      state = (await waitForState(port, (value) => value.settings, { timeoutMs: 1800 })).value;
    } catch {
      try {
        await openSettingsThroughVisibleControl(port);
        state = (await waitForState(port, (value) => value.settings)).value;
      } catch (visibleError) {
        if (nativeOpenError) throw commandFailure(visibleError, "PET_NATIVE_UI_UNAVAILABLE");
        throw visibleError;
      }
    }
  }

  let target = await currentTarget(port);
  if (!state.petsPanel) {
    const opened = await evaluateAndClickTarget(target, OPEN_PETS_PANEL_EXPRESSION);
    if (!opened?.ok) throw petError("PET_NATIVE_UI_UNAVAILABLE", opened?.reason || "could not open ChatGPT Desktop Pets settings");
    target = (await waitForState(port, (value) => value.petsPanel)).target;
  }

  const refreshed = await evaluateAndClickTarget(target, REFRESH_PETS_EXPRESSION);
  if (!refreshed?.ok) throw petError("PET_NATIVE_UI_UNAVAILABLE", refreshed?.reason || "could not refresh ChatGPT Desktop custom Pets");
  target = (await waitForState(port, (value) => value.customPetIds.includes(petId))).target;

  const selected = await evaluateAndClickTarget(target, selectPetExpression(petId));
  if (!selected?.ok) throw petError("PET_NATIVE_UI_UNAVAILABLE", selected?.reason || "could not select the installed ChatGPT Desktop Pet");
  const selectionState = await waitForExpression(port, petSelectionStateExpression(petId), (value) => value.exists && value.selected && value.assetLoaded);

  if (restoreApp) {
    const appTarget = await currentTarget(port);
    await evaluateTarget(appTarget, RETURN_TO_APP_EXPRESSION).catch(() => null);
  }
  return { status: "selected", selection: "native-ui-confirmed", petId, adapterVersion: ADAPTER_VERSION, refreshed: true, assetLoaded: selectionState.value.assetLoaded, assetSource: selectionState.value.assetSource };
}

export { ADAPTER_VERSION, DEFAULT_PORT, REFRESH_LABELS, SELECT_LABELS, SELECTED_LABELS };
